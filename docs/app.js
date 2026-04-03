const base = new URL("./", document.baseURI);
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
    el.textContent = `${b} ${c}`;
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
      desc.textContent = Number.isInteger(ep.count) ? `${ep.count} item${ep.count === 1 ? "" : "s"}` : "—";

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
  const v = meta.resolved_versions;
  const versions = `Chrome ${v.chrome.current.version} / Safari ${v.safari.current.version} / Edge ${v.edge.current.version} / Firefox ${v.firefox.current.version}`;
  const notes = [
    versions,
    `strategy: ${meta.source_strategy.primary}`,
    meta.fallback_source_use?.used ? `fallback: ${meta.fallback_source_use.note}` : null,
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
    endpointList.innerHTML = `<p class="dim">Error: ${e.message}</p>`;
  }
}

load();
