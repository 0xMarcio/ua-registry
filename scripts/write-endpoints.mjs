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
      content="Static GitHub Pages JSON endpoints for current full browser user-agent strings."
    >
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main class="page">
      <header class="hero">
        <p class="eyebrow">Static JSON on GitHub Pages</p>
        <h1>Browser user-agent registry</h1>
        <p class="lede">
          This site publishes current full user-agent strings for Chrome, Safari, Edge, and
          Firefox as plain static <code>.json</code> files. Every item exposes the full literal
          UA in <code>user_agent</code>.
        </p>
        <div class="hero-meta">
          <span id="last-updated">Loading last update…</span>
          <a class="link-chip" href="./api/index.json">Manifest</a>
          <a class="link-chip" href="./api/meta.json">Metadata</a>
        </div>
      </header>

      <section class="panel">
        <div class="panel-heading">
          <h2>Counts</h2>
          <p>Per-browser top-five sets from the generated manifest.</p>
        </div>
        <div id="browser-counts" class="stat-grid"></div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Endpoints</h2>
          <p>All public JSON endpoints with relative links and one-click copy buttons.</p>
        </div>
        <div id="endpoint-list" class="endpoint-list">
          <p class="empty">Loading endpoints…</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Usage</h2>
          <p>Fetch examples against the generated files.</p>
        </div>
        <div class="examples">
          <pre><code>fetch("./api/chrome/latest-desktop.json").then((r) =&gt; r.json())</code></pre>
          <pre><code>curl ./api/all.json</code></pre>
          <pre><code>fetch("./api/latest.json").then((r) =&gt; r.json())</code></pre>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Notes</h2>
          <p>Current source and build metadata.</p>
        </div>
        <div id="meta-notes" class="notes">
          <p class="empty">Loading metadata…</p>
        </div>
      </section>
    </main>

    <script type="module" src="./app.js"></script>
  </body>
</html>
`;
}

function buildStylesCss() {
  return `:root {
  color-scheme: light;
  --bg: #f4efe5;
  --panel: rgba(255, 255, 255, 0.86);
  --panel-border: rgba(60, 52, 39, 0.14);
  --text: #1f1b16;
  --muted: #605747;
  --accent: #1557ff;
  --accent-soft: rgba(21, 87, 255, 0.08);
  --shadow: 0 16px 40px rgba(60, 52, 39, 0.08);
  --radius: 22px;
  --radius-sm: 14px;
  font-family: "Avenir Next", "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(255, 217, 145, 0.6), transparent 38%),
    linear-gradient(180deg, #fff9ee 0%, var(--bg) 55%, #efe7d7 100%);
}

code,
pre {
  font-family: "SF Mono", "Menlo", "Consolas", monospace;
}

.page {
  width: min(1100px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 2rem 0 3rem;
}

.hero,
.panel {
  background: var(--panel);
  backdrop-filter: blur(10px);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.hero {
  padding: 2rem;
  margin-bottom: 1.25rem;
}

.eyebrow {
  margin: 0 0 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.78rem;
  color: var(--muted);
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0.75rem;
  font-size: clamp(2.1rem, 5vw, 3.5rem);
  line-height: 0.95;
}

.lede {
  max-width: 60ch;
  color: var(--muted);
  line-height: 1.55;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-top: 1.5rem;
}

.link-chip,
.copy-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid rgba(21, 87, 255, 0.18);
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 999px;
  padding: 0.55rem 0.9rem;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.link-chip:hover,
.copy-button:hover {
  background: rgba(21, 87, 255, 0.14);
}

.panel {
  padding: 1.4rem;
  margin-bottom: 1rem;
}

.panel-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1rem;
}

.panel-heading p {
  color: var(--muted);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.85rem;
}

.stat-card {
  padding: 1rem;
  border-radius: var(--radius-sm);
  background: #fffdf8;
  border: 1px solid rgba(60, 52, 39, 0.08);
}

.stat-card strong {
  display: block;
  font-size: 1.5rem;
  margin-top: 0.35rem;
}

.endpoint-group {
  margin-bottom: 1rem;
}

.endpoint-group h3 {
  margin: 0 0 0.65rem;
  font-size: 1rem;
}

.endpoint-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.9rem 0;
  border-top: 1px solid rgba(60, 52, 39, 0.08);
}

.endpoint-row:first-of-type {
  border-top: 0;
}

.endpoint-link {
  display: inline-block;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
  word-break: break-all;
}

.endpoint-link:hover {
  color: var(--accent);
}

.endpoint-meta {
  display: block;
  margin-top: 0.25rem;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.45;
}

.examples {
  display: grid;
  gap: 0.75rem;
}

pre {
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
  border-radius: var(--radius-sm);
  background: #1f1b16;
  color: #f8f4eb;
}

.notes,
.empty {
  color: var(--muted);
}

.note-list {
  margin: 0;
  padding-left: 1rem;
}

@media (max-width: 720px) {
  .page {
    width: min(100% - 1rem, 1000px);
    padding-top: 1rem;
  }

  .hero,
  .panel {
    padding: 1.1rem;
  }

  .endpoint-row {
    grid-template-columns: 1fr;
  }
}
`;
}

function buildAppJs() {
  return `const siteBase = new URL("./", document.baseURI);
const manifestUrl = new URL("./api/index.json", siteBase);
const metaUrl = new URL("./api/meta.json", siteBase);
const browserLabels = {
  chrome: "Chrome",
  safari: "Safari",
  edge: "Edge",
  firefox: "Firefox"
};

const endpointList = document.querySelector("#endpoint-list");
const browserCounts = document.querySelector("#browser-counts");
const metaNotes = document.querySelector("#meta-notes");
const lastUpdated = document.querySelector("#last-updated");

function endpointUrl(relativePath) {
  return new URL(relativePath, siteBase);
}

function formatTimestamp(iso) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(iso));
}

async function copyEndpoint(relativePath, button) {
  const url = endpointUrl(relativePath).href;

  try {
    await navigator.clipboard.writeText(url);
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = "Copy";
    }, 1200);
  } catch {
    window.prompt("Copy endpoint URL", url);
  }
}

function renderCounts(manifest) {
  browserCounts.innerHTML = "";

  for (const [browser, count] of Object.entries(manifest.browser_counts)) {
    const card = document.createElement("article");
    card.className = "stat-card";
    card.innerHTML = \`<span>\${browserLabels[browser] || browser}</span><strong>\${count}</strong><small>browser-specific items</small>\`;
    browserCounts.append(card);
  }
}

function renderEndpoints(manifest) {
  endpointList.innerHTML = "";
  const groups = new Map();

  for (const endpoint of manifest.endpoints) {
    const group = endpoint.group || "other";

    if (!groups.has(group)) {
      groups.set(group, []);
    }

    groups.get(group).push(endpoint);
  }

  for (const [groupName, endpoints] of groups) {
    const section = document.createElement("section");
    section.className = "endpoint-group";

    const title = document.createElement("h3");
    title.textContent = groupName;
    section.append(title);

    for (const endpoint of endpoints) {
      const row = document.createElement("div");
      row.className = "endpoint-row";

      const info = document.createElement("div");
      const link = document.createElement("a");
      link.className = "endpoint-link";
      link.href = endpointUrl(endpoint.path);
      link.textContent = endpoint.path;
      link.rel = "noopener";
      info.append(link);

      const meta = document.createElement("span");
      meta.className = "endpoint-meta";
      const countText = Number.isInteger(endpoint.count) ? \` Count: \${endpoint.count}.\` : "";
      meta.textContent = \`\${endpoint.description}.\${countText}\`;
      info.append(meta);

      const button = document.createElement("button");
      button.className = "copy-button";
      button.type = "button";
      button.textContent = "Copy";
      button.addEventListener("click", () => copyEndpoint(endpoint.path, button));

      row.append(info, button);
      section.append(row);
    }

    endpointList.append(section);
  }
}

function renderMeta(meta) {
  lastUpdated.textContent = \`Last updated: \${formatTimestamp(meta.generated_at)}\`;
  const versionSummary = \`Versions: Chrome \${meta.resolved_versions.chrome.current.version}, Safari \${meta.resolved_versions.safari.current.version}, Edge \${meta.resolved_versions.edge.current.version}, Firefox \${meta.resolved_versions.firefox.current.version}\`;
  const fallback = meta.fallback_source_use?.used
    ? \`Fallback used: \${meta.fallback_source_use.note}\`
    : "Fallback used: no";
  const notes = [
    versionSummary,
    \`Source strategy: \${meta.source_strategy.primary}\`,
    fallback,
    ...meta.safari_rules.notes
  ];
  metaNotes.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "note-list";

  for (const note of notes) {
    const item = document.createElement("li");
    item.textContent = note;
    list.append(item);
  }

  metaNotes.append(list);
}

async function load() {
  try {
    const [manifest, meta] = await Promise.all([
      fetch(manifestUrl).then((response) => response.json()),
      fetch(metaUrl).then((response) => response.json())
    ]);

    renderCounts(manifest);
    renderEndpoints(manifest);
    renderMeta(meta);
  } catch (error) {
    endpointList.innerHTML = \`<p class="empty">Could not load endpoint manifest: \${error.message}</p>\`;
    metaNotes.innerHTML = \`<p class="empty">Could not load metadata: \${error.message}</p>\`;
    lastUpdated.textContent = "Last updated: unavailable";
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
