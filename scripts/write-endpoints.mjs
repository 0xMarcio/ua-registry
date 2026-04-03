import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

function stringifyJson(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

async function writeIfChanged(filePath, content) {
  let currentContent = null;

  try {
    currentContent = await readFile(filePath, "utf8");
  } catch {
    currentContent = null;
  }

  if (currentContent === content) {
    return false;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return true;
}

async function pruneGeneratedApiFiles(docsDirectory, expectedApiPaths) {
  const apiDirectory = path.join(docsDirectory, "api");
  const removedFiles = [];

  async function walk(directory) {
    let entries;

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        const remaining = await readdir(fullPath);

        if (remaining.length === 0) {
          await rm(fullPath, { recursive: true, force: true });
        }

        continue;
      }

      const relativePath = path.relative(docsDirectory, fullPath).replaceAll(path.sep, "/");

      if (!expectedApiPaths.has(relativePath)) {
        await rm(fullPath, { force: true });
        removedFiles.push(relativePath);
      }
    }
  }

  await walk(apiDirectory);
  return removedFiles;
}

function buildIndexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>UA Registry</title>
    <meta
      name="description"
      content="Static JSON and plaintext endpoints for current browser user-agent strings."
    >
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main class="page">
      <header class="header">
        <div class="header-top">
          <h1>ua-registry</h1>
        </div>
        <p class="sub">Current user-agent strings for Chrome, Safari, Edge &amp; Firefox.</p>
        <div class="header-meta">
          <span id="last-updated" class="dim">...</span>
          <span class="sep">|</span>
          <a href="./api/index.json">manifest</a>
          <a href="./api/meta.json">meta</a>
        </div>
      </header>

      <details class="section" id="ua-section" open>
        <summary><h2>Desktop User Agents</h2></summary>
        <div id="ua-list">
          <p class="dim">Loading...</p>
        </div>
      </details>

      <section class="section">
        <h2>Endpoints</h2>
        <div id="endpoint-list">
          <p class="dim">Loading...</p>
        </div>
      </section>

      <section class="section">
        <h2>Usage</h2>
        <div id="usage-list">
          <div class="usage-example">
            <div class="ua-value">
              <div class="ua-code">fetch("https://ua.syntax9.ai/api/chrome/windows.json").then(r =&gt; r.json())</div>
              <button class="copy-btn usage-copy" type="button" data-copy='fetch("https://ua.syntax9.ai/api/chrome/windows.json").then(r =&gt; r.json())'>cp</button>
            </div>
          </div>
          <div class="usage-example">
            <div class="ua-value">
              <div class="ua-code">curl https://ua.syntax9.ai/api/chrome/desktop</div>
              <button class="copy-btn usage-copy" type="button" data-copy="curl https://ua.syntax9.ai/api/chrome/desktop">cp</button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <script type="module" src="./app.js"></script>
  </body>
</html>
`;
}

function buildStylesCss() {
  return `*,*::before,*::after{box-sizing:border-box;margin:0}

:root{
  color-scheme:dark;
  --bg:#09090b;
  --surface:#111113;
  --border:#1e1e22;
  --text:#e4e4e7;
  --dim:#71717a;
  --accent:#a1a1aa;
  --link:#e4e4e7;
  --mono:"SF Mono","Menlo","Consolas","Liberation Mono",monospace;
  --sans:system-ui,-apple-system,"Segoe UI",sans-serif;
}

body{
  background:var(--bg);
  color:var(--text);
  font:14px/1.6 var(--sans);
  -webkit-font-smoothing:antialiased;
}

code,pre{font-family:var(--mono);font-size:13px}

a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline}

.page{
  max-width:720px;
  margin:0 auto;
  padding:3rem 1.5rem 4rem;
}

/* ---- header ---- */
.header{
  padding-bottom:1.5rem;
  border-bottom:1px solid var(--border);
}

.header-top{
  display:flex;
  align-items:baseline;
  flex-wrap:wrap;
}

h1{
  font-size:1.25rem;
  font-weight:600;
  letter-spacing:-0.02em;
}

.sub{
  margin-top:0.375rem;
  color:var(--dim);
  font-size:13px;
}

.header-meta{
  margin-top:0.75rem;
  display:flex;
  align-items:center;
  gap:0.5rem;
  font-size:12px;
  font-family:var(--mono);
}

.header-meta a{color:var(--dim)}
.header-meta a:hover{color:var(--text)}
.sep{color:var(--border)}
.dim{color:var(--dim)}

/* ---- sections ---- */
.section{
  margin-top:2rem;
}

h2{
  font-size:11px;
  font-weight:500;
  text-transform:uppercase;
  letter-spacing:0.08em;
  color:var(--dim);
  margin-bottom:0.75rem;
}

/* ---- shared details ---- */
details summary{
  cursor:pointer;
  list-style:none;
}

details summary::-webkit-details-marker{display:none}

details summary h2{
  display:inline;
  margin:0;
}

details summary:hover h2{
  color:var(--text);
}

/* ---- endpoints ---- */
.endpoint-group{
  margin-bottom:1rem;
  border-bottom:1px solid var(--border);
}

.endpoint-group summary{
  cursor:pointer;
  list-style:none;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:0.75rem;
  padding-bottom:0.5rem;
}

.endpoint-group summary::-webkit-details-marker{display:none}

.endpoint-group summary::after{
  content:"+";
  color:var(--dim);
  font:14px/1 var(--mono);
}

.endpoint-group[open] summary::after{
  content:"-";
}

.endpoint-group h3{
  font-size:12px;
  font-weight:500;
  color:var(--accent);
  text-transform:uppercase;
  letter-spacing:0.06em;
  margin:0;
}

.endpoint-group summary:hover h3,
.endpoint-group[open] summary h3{
  color:var(--text);
}

.endpoint-items{
  padding-bottom:0.5rem;
}

.ua-browser{
  margin-top:1rem;
}

.ua-browser:first-child{
  margin-top:0.5rem;
}

.ua-browser h3{
  font-size:1rem;
  font-weight:600;
  margin:0 0 0.625rem;
  padding-bottom:0.5rem;
  border-bottom:1px solid var(--border);
}

.ua-list{
  display:grid;
  gap:0.75rem;
}

.ua-item{
  display:grid;
  gap:0.35rem;
}

.ua-platform{
  font-size:11px;
  font-weight:600;
  letter-spacing:0.06em;
  text-transform:uppercase;
  color:var(--accent);
}

.ua-value{
  display:grid;
  grid-template-columns:1fr auto;
  align-items:start;
  gap:0.5rem;
  padding:0.625rem 0.75rem;
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:6px;
}

.ua-code{
  min-width:0;
  white-space:nowrap;
  overflow-x:auto;
  color:var(--text);
  font:12px/1.45 var(--mono);
  scrollbar-width:thin;
}

.ua-copy{
  align-self:center;
}

.endpoint-row{
  display:grid;
  grid-template-columns:1fr 8ch auto;
  align-items:baseline;
  gap:0.5rem;
  padding:0.3rem 0;
  font-family:var(--mono);
  font-size:13px;
}

.endpoint-link{
  color:var(--text);
  text-decoration:none;
  overflow:hidden;
  text-overflow:ellipsis;
}
.endpoint-link:hover{color:#fff;text-decoration:underline}

.endpoint-desc{
  color:var(--dim);
  font-size:12px;
  text-align:right;
}

.copy-btn{
  background:none;
  border:1px solid var(--border);
  color:var(--dim);
  font:11px var(--mono);
  padding:2px 8px;
  border-radius:3px;
  cursor:pointer;
  flex-shrink:0;
}
.copy-btn:hover{color:var(--text);border-color:var(--accent)}

/* ---- usage ---- */
.usage-example + .usage-example{
  margin-top:0.375rem;
}

.usage-copy{
  align-self:center;
}

/* ---- responsive ---- */
@media(max-width:540px){
  .page{padding:1.5rem 1rem 3rem}
  .endpoint-row{grid-template-columns:1fr auto auto;gap:0.375rem}
}
`;
}

function buildAppJs() {
  return `const base = new URL("./", document.baseURI);
const desktopUrl = new URL("./api/desktop.json", base);
const manifestUrl = new URL("./api/index.json", base);
const metaUrl = new URL("./api/meta.json", base);

const $ = (s) => document.querySelector(s);
const uaList = $("#ua-list");
const endpointList = $("#endpoint-list");
const lastUpdated = $("#last-updated");
const browserLabels = {
  chrome: "Google Chrome",
  safari: "Apple Safari",
  edge: "Microsoft Edge",
  firefox: "Mozilla Firefox"
};
const browserOrder = ["chrome", "safari", "edge", "firefox"];

function url(p) { return new URL(p, base); }

function ts(iso) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function flashCopyState(btn) {
  btn.textContent = "ok";
  setTimeout(() => { btn.textContent = "cp"; }, 900);
}

async function copyValue(value, btn) {
  try {
    await navigator.clipboard.writeText(value);
    flashCopyState(btn);
  } catch { prompt("Copy", value); }
}

async function copy(path, btn) {
  await copyValue(url(path).href, btn);
}

function bindUsageCopyButtons() {
  for (const button of document.querySelectorAll(".usage-copy")) {
    button.addEventListener("click", () => copyValue(button.dataset.copy ?? "", button));
  }
}

function renderUserAgents(payload) {
  uaList.innerHTML = "";
  const grouped = new Map();

  for (const browser of browserOrder) {
    grouped.set(browser, []);
  }

  for (const item of payload.items) {
    if (!grouped.has(item.browser)) {
      grouped.set(item.browser, []);
    }

    grouped.get(item.browser).push(item);
  }

  for (const browser of browserOrder) {
    const items = grouped.get(browser) ?? [];

    if (items.length === 0) {
      continue;
    }

    const section = document.createElement("section");
    section.className = "ua-browser";

    const heading = document.createElement("h3");
    heading.textContent = browserLabels[browser] ?? browser;
    section.append(heading);

    const list = document.createElement("div");
    list.className = "ua-list";

    for (const item of items) {
      const entry = document.createElement("div");
      entry.className = "ua-item";

      const platform = document.createElement("div");
      platform.className = "ua-platform";
      platform.textContent = item.platform;

      const value = document.createElement("div");
      value.className = "ua-value";

      const code = document.createElement("div");
      code.className = "ua-code";
      code.textContent = item.user_agent;

      const btn = document.createElement("button");
      btn.className = "copy-btn ua-copy";
      btn.type = "button";
      btn.textContent = "cp";
      btn.addEventListener("click", () => copyValue(item.user_agent, btn));

      value.append(code, btn);
      entry.append(platform, value);
      list.append(entry);
    }

    section.append(list);
    uaList.append(section);
  }
}

function renderEndpoints(manifest) {
  endpointList.innerHTML = "";
  const groups = new Map();
  for (const ep of manifest.endpoints) {
    const g = ep.group || "other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(ep);
  }

  for (const [name, eps] of groups) {
    const sec = document.createElement("details");
    sec.className = "endpoint-group";
    const summary = document.createElement("summary");
    const h = document.createElement("h3");
    h.textContent = name;
    summary.append(h);
    sec.append(summary);

    const items = document.createElement("div");
    items.className = "endpoint-items";

    for (const ep of eps) {
      const row = document.createElement("div");
      row.className = "endpoint-row";

      const link = document.createElement("a");
      link.className = "endpoint-link";
      link.href = url(ep.path);
      link.textContent = ep.path;

      const desc = document.createElement("span");
      desc.className = "endpoint-desc";
      desc.textContent = Number.isInteger(ep.count) ? \`\${ep.count} item\${ep.count === 1 ? "" : "s"}\` : "—";

      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      btn.textContent = "cp";
      btn.addEventListener("click", () => copy(ep.path, btn));

      row.append(link, desc, btn);
      items.append(row);
    }

    sec.append(items);
    endpointList.append(sec);
  }
}

function renderMeta(meta) {
  lastUpdated.textContent = ts(meta.generated_at);
}

async function load() {
  try {
    const [all, manifest, meta] = await Promise.all([
      fetch(desktopUrl).then(r => r.json()),
      fetch(manifestUrl).then(r => r.json()),
      fetch(metaUrl).then(r => r.json())
    ]);
    renderUserAgents(all);
    renderEndpoints(manifest);
    renderMeta(meta);
    bindUsageCopyButtons();
  } catch (e) {
    uaList.innerHTML = \`<p class="dim">Error: \${e.message}</p>\`;
    endpointList.innerHTML = \`<p class="dim">Error: \${e.message}</p>\`;
  }
}

load();
`;
}

export async function writeSite(rootDirectory, site) {
  const changedFiles = [];
  const docsDirectory = rootDirectory;
  const repositoryRoot = path.resolve(docsDirectory, "..");
  const expectedApiPaths = new Set([
    ...Object.keys(site.endpoints),
    ...Object.keys(site.textEndpoints ?? {})
  ]);

  const staticFiles = {
    ".nojekyll": "",
    "index.html": buildIndexHtml(),
    "styles.css": buildStylesCss(),
    "app.js": buildAppJs()
  };

  for (const [relativePath, content] of Object.entries(staticFiles)) {
    const filePath = path.join(docsDirectory, relativePath);

    if (await writeIfChanged(filePath, content)) {
      changedFiles.push(relativePath);
    }
  }

  const removedApiFiles = await pruneGeneratedApiFiles(docsDirectory, expectedApiPaths);
  changedFiles.push(...removedApiFiles);

  for (const [relativePath, payload] of Object.entries(site.endpoints)) {
    const filePath = path.join(docsDirectory, relativePath);

    if (await writeIfChanged(filePath, stringifyJson(payload))) {
      changedFiles.push(relativePath);
    }
  }

  for (const [relativePath, content] of Object.entries(site.textEndpoints ?? {})) {
    const filePath = path.join(docsDirectory, relativePath);

    if (await writeIfChanged(filePath, content)) {
      changedFiles.push(relativePath);
    }
  }

  for (const [relativePath, content] of Object.entries(site.generatedFiles ?? {})) {
    const filePath = path.join(repositoryRoot, relativePath);

    if (await writeIfChanged(filePath, content)) {
      changedFiles.push(relativePath);
    }
  }

  return changedFiles;
}
