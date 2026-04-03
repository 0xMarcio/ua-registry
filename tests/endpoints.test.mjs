import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateOutputDirectory } from "../scripts/validate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDirectory = path.resolve(__dirname, "..", "docs");
const apiDirectory = path.join(docsDirectory, "api");
const browsers = ["chrome", "safari", "edge", "firefox"];
const expectedBrowserCounts = {
  chrome: 4,
  safari: 3,
  edge: 4,
  firefox: 5
};
const expectedPlatforms = {
  chrome: ["windows", "macos", "linux", "android"],
  safari: ["macos", "iphone", "ipad"],
  edge: ["windows", "macos", "linux", "android"],
  firefox: ["windows", "macos", "linux", "android", "ubuntu"]
};

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("generated endpoints satisfy counts, manifest integrity, and platform endpoint shape", async () => {
  const { endpoints, textEndpoints } = await validateOutputDirectory(docsDirectory);
  const manifest = endpoints["api/index.json"];

  for (const browser of browsers) {
    const browserPayload = endpoints[`api/${browser}.json`];
    assert.equal(
      browserPayload.items.length,
      expectedBrowserCounts[browser],
      `${browser}.json should expose only current variants`
    );

    const uniqueUserAgents = new Set(browserPayload.items.map((item) => item.user_agent));
    assert.equal(
      uniqueUserAgents.size,
      browserPayload.items.length,
      `${browser}.json should not contain duplicate UA strings`
    );
    assert.ok(browserPayload.items.every((item) => item.track === "current"));

    const desktopText = textEndpoints[`api/${browser}/desktop`].trim().split("\n");
    const desktopJson = endpoints[`api/${browser}/desktop.json`].items.map((item) => item.user_agent);
    assert.deepEqual(desktopText, desktopJson);

    const mobileText = textEndpoints[`api/${browser}/mobile`].trim().split("\n");
    const mobileJson = endpoints[`api/${browser}/mobile.json`].items.map((item) => item.user_agent);
    assert.deepEqual(mobileText, mobileJson);

    for (const platform of expectedPlatforms[browser]) {
      assert.equal(typeof endpoints[`api/${browser}/${platform}.json`].user_agent, "string");
      assert.equal(
        textEndpoints[`api/${browser}/${platform}`],
        `${endpoints[`api/${browser}/${platform}.json`].user_agent}\n`
      );
    }
  }

  assert.equal(typeof endpoints["api/all.json"].items[0].user_agent, "string");
  assert.equal(typeof endpoints["api/desktop.json"].items[0].user_agent, "string");
  assert.equal(typeof endpoints["api/mobile.json"].items[0].user_agent, "string");
  assert.deepEqual(
    textEndpoints["api/all"].trim().split("\n"),
    endpoints["api/all.json"].items.map((item) => item.user_agent)
  );
  assert.deepEqual(
    textEndpoints["api/desktop"].trim().split("\n"),
    endpoints["api/desktop.json"].items.map((item) => item.user_agent)
  );
  assert.deepEqual(
    textEndpoints["api/mobile"].trim().split("\n"),
    endpoints["api/mobile.json"].items.map((item) => item.user_agent)
  );

  const edgeReleaseVersions = endpoints["api/meta.json"].resolved_versions.edge.current.releases;
  assert.match(
    endpoints["api/edge/windows.json"].user_agent,
    new RegExp(`Edg/${escapeRegex(edgeReleaseVersions.windows)}$`)
  );
  assert.match(
    endpoints["api/edge/android.json"].user_agent,
    new RegExp(`EdgA/${escapeRegex(edgeReleaseVersions.android)}$`)
  );

  for (const entry of manifest.endpoints) {
    assert.ok(
      endpoints[entry.path] || textEndpoints[entry.path],
      `manifest entry ${entry.path} should exist on disk`
    );
  }
});

test("homepage uses relative asset paths and only current routes are present", async () => {
  const topLevelEntries = await readdir(apiDirectory, { withFileTypes: true });
  const apiTopLevelFiles = topLevelEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const chromeFiles = await readdir(path.join(apiDirectory, "chrome"));

  assert.ok(apiTopLevelFiles.includes("all.json"));
  assert.ok(apiTopLevelFiles.includes("all"));
  assert.ok(apiTopLevelFiles.includes("desktop"));
  assert.ok(apiTopLevelFiles.includes("mobile"));
  assert.ok(!apiTopLevelFiles.includes("latest.json"));
  assert.ok(!chromeFiles.includes("latest.json"));
  assert.ok(!chromeFiles.includes("latest-desktop"));
  assert.ok(!chromeFiles.includes("latest-mobile"));

  const indexHtml = await readFile(path.join(docsDirectory, "index.html"), "utf8");
  const appJs = await readFile(path.join(docsDirectory, "app.js"), "utf8");
  const chromeTextEndpoint = await readFile(
    path.join(docsDirectory, "api", "chrome", "desktop"),
    "utf8"
  );

  assert.match(indexHtml, /href="\.\/styles\.css"/);
  assert.match(indexHtml, /src="\.\/app\.js"/);
  assert.match(indexHtml, /<details class="section" id="ua-section" open>/);
  assert.match(appJs, /new URL\("\.\/api\/index\.json"/);
  assert.match(appJs, /new URL\("\.\/api\/all\.json"/);
  assert.match(appJs, /new URL\("\.\/api\/meta\.json"/);
  assert.match(appJs, /function renderUserAgents\(payload\)/);
  assert.match(appJs, /browserLabels/);
  assert.match(appJs, /document\.createElement\("details"\)/);
  assert.match(appJs, /document\.createElement\("summary"\)/);
  assert.doesNotMatch(appJs, /#ua-section"\)\.open\s*=\s*false/);
  assert.doesNotMatch(appJs, /https?:\/\//);
  assert.match(chromeTextEndpoint, /^Mozilla\/5\.0/);
});
