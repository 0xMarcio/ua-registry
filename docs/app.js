const siteBase = new URL("./", document.baseURI);
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
    card.innerHTML = `<span>${browserLabels[browser] || browser}</span><strong>${count}</strong><small>browser-specific items</small>`;
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
      const countText = Number.isInteger(endpoint.count) ? ` Count: ${endpoint.count}.` : "";
      meta.textContent = `${endpoint.description}.${countText}`;
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
  lastUpdated.textContent = `Last updated: ${formatTimestamp(meta.generated_at)}`;
  const versionSummary = `Versions: Chrome ${meta.resolved_versions.chrome.current.version}, Safari ${meta.resolved_versions.safari.current.version}, Edge ${meta.resolved_versions.edge.current.version}, Firefox ${meta.resolved_versions.firefox.current.version}`;
  const fallback = meta.fallback_source_use?.used
    ? `Fallback used: ${meta.fallback_source_use.note}`
    : "Fallback used: no";
  const notes = [
    versionSummary,
    `Source strategy: ${meta.source_strategy.primary}`,
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
    endpointList.innerHTML = `<p class="empty">Could not load endpoint manifest: ${error.message}</p>`;
    metaNotes.innerHTML = `<p class="empty">Could not load metadata: ${error.message}</p>`;
    lastUpdated.textContent = "Last updated: unavailable";
  }
}

load();
