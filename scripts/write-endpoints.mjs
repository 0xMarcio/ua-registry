import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function buildIndexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>UA Registry</title>
    <meta
      name="description"
      content="Static JSON endpoints for current browser user-agent strings."
    >
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main class="page">
      <header class="header">
        <div class="header-top">
          <h1>ua-registry</h1>
          <span id="browser-counts" class="counts"></span>
        </div>
        <p class="sub">Current user-agent strings for Chrome, Safari, Edge &amp; Firefox as static JSON.</p>
        <div class="header-meta">
          <span id="last-updated" class="dim">...</span>
          <span class="sep">|</span>
          <a href="./api/index.json">manifest</a>
          <a href="./api/meta.json">meta</a>
        </div>
      </header>

      <section class="section">
        <h2>Endpoints</h2>
        <div id="endpoint-list">
          <p class="dim">Loading...</p>
        </div>
      </section>

      <section class="section">
        <h2>Usage</h2>
        <pre><code>fetch("./api/chrome/latest-desktop.json").then(r =&gt; r.json())</code></pre>
        <pre><code>curl https://&lt;host&gt;/api/latest.json</code></pre>
      </section>

      <details class="section" id="meta-section">
        <summary><h2>Build info</h2></summary>
        <div id="meta-notes" class="dim">Loading...</div>
      </details>
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
  gap:1rem;
  flex-wrap:wrap;
}

h1{
  font-size:1.25rem;
  font-weight:600;
  letter-spacing:-0.02em;
}

.counts{
  display:flex;
  gap:0.625rem;
  font-size:12px;
  color:var(--dim);
  font-family:var(--mono);
}

.count-badge{
  padding:2px 8px;
  border:1px solid var(--border);
  border-radius:4px;
  white-space:nowrap;
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

/* ---- endpoints ---- */
.endpoint-group{margin-bottom:1.25rem}

.endpoint-group h3{
  font-size:12px;
  font-weight:500;
  color:var(--accent);
  text-transform:uppercase;
  letter-spacing:0.06em;
  margin-bottom:0.25rem;
  padding-bottom:0.375rem;
  border-bottom:1px solid var(--border);
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
pre{
  margin-top:0.5rem;
  padding:0.625rem 0.875rem;
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:6px;
  color:var(--dim);
  overflow-x:auto;
}
pre+pre{margin-top:0.375rem}

/* ---- build info ---- */
details summary{cursor:pointer;list-style:none}
details summary::-webkit-details-marker{display:none}
details summary h2{display:inline;margin:0}
details summary:hover h2{color:var(--text)}

.note-list{
  padding:0.5rem 0 0 1rem;
  color:var(--dim);
  font-size:13px;
}
.note-list li{margin-bottom:0.25rem}

/* ---- responsive ---- */
@media(max-width:540px){
  .page{padding:1.5rem 1rem 3rem}
  .header-top{flex-direction:column;gap:0.5rem}
  .endpoint-row{grid-template-columns:1fr auto auto;gap:0.375rem}
}
`;
}

function buildAppJs() {
  return `const base = new URL("./", document.baseURI);
const manifestUrl = new URL("./api/index.json", base);
const metaUrl = new URL("./api/meta.json", base);

const $ = (s) => document.querySelector(s);
const endpointList = $("#endpoint-list");
const browserCounts = $("#browser-counts");
const metaNotes = $("#meta-notes");
const lastUpdated = $("#last-updated");

function url(p) { return new URL(p, base); }

function ts(iso) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

async function copy(path, btn) {
  const u = url(path).href;
  try {
    await navigator.clipboard.writeText(u);
    btn.textContent = "ok";
    setTimeout(() => { btn.textContent = "cp"; }, 900);
  } catch { prompt("Copy URL", u); }
}

function renderCounts(manifest) {
  browserCounts.innerHTML = "";
  for (const [b, c] of Object.entries(manifest.browser_counts)) {
    const el = document.createElement("span");
    el.className = "count-badge";
    el.textContent = \`\${b} \${c}\`;
    browserCounts.append(el);
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
    const sec = document.createElement("div");
    sec.className = "endpoint-group";
    const h = document.createElement("h3");
    h.textContent = name;
    sec.append(h);

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
      sec.append(row);
    }
    endpointList.append(sec);
  }
}

function renderMeta(meta) {
  lastUpdated.textContent = ts(meta.generated_at);
  const v = meta.resolved_versions;
  const versions = \`Chrome \${v.chrome.current.version} / Safari \${v.safari.current.version} / Edge \${v.edge.current.version} / Firefox \${v.firefox.current.version}\`;
  const notes = [
    versions,
    \`strategy: \${meta.source_strategy.primary}\`,
    meta.fallback_source_use?.used ? \`fallback: \${meta.fallback_source_use.note}\` : null,
    ...meta.safari_rules.notes
  ].filter(Boolean);

  metaNotes.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "note-list";
  for (const n of notes) {
    const li = document.createElement("li");
    li.textContent = n;
    list.append(li);
  }
  metaNotes.append(list);
}

async function load() {
  try {
    const [manifest, meta] = await Promise.all([
      fetch(manifestUrl).then(r => r.json()),
      fetch(metaUrl).then(r => r.json())
    ]);
    renderCounts(manifest);
    renderEndpoints(manifest);
    renderMeta(meta);
  } catch (e) {
    endpointList.innerHTML = \`<p class="dim">Error: \${e.message}</p>\`;
  }
}

load();
`;
}

export async function writeSite(rootDirectory, site) {
  const changedFiles = [];
  const docsDirectory = rootDirectory;

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

  for (const [relativePath, payload] of Object.entries(site.endpoints)) {
    const filePath = path.join(docsDirectory, relativePath);

    if (await writeIfChanged(filePath, stringifyJson(payload))) {
      changedFiles.push(relativePath);
    }
  }

  return changedFiles;
}
