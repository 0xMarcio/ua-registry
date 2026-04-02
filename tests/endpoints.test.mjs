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

test("generated endpoints satisfy counts, manifest integrity, and latest endpoint shape", async () => {
  const { endpoints, textEndpoints } = await validateOutputDirectory(docsDirectory);
  const manifest = endpoints["api/index.json"];

  for (const browser of browsers) {
    const browserPayload = endpoints[`api/${browser}.json`];
    assert.equal(browserPayload.items.length, 5, `${browser}.json should expose 5 items`);

    const uniqueUserAgents = new Set(browserPayload.items.map((item) => item.user_agent));
    assert.equal(
      uniqueUserAgents.size,
      browserPayload.items.length,
      `${browser}.json should not contain duplicate UA strings`
    );

    const latestPair = endpoints[`api/${browser}/latest.json`];
    assert.ok(latestPair.desktop, `${browser}/latest.json should contain desktop`);
    assert.ok(latestPair.mobile, `${browser}/latest.json should contain mobile`);
    assert.equal(typeof endpoints[`api/${browser}/latest-desktop.json`].user_agent, "string");
    assert.equal(typeof endpoints[`api/${browser}/latest-mobile.json`].user_agent, "string");
    assert.equal(
      textEndpoints[`api/${browser}/latest-desktop`],
      `${endpoints[`api/${browser}/latest-desktop.json`].user_agent}\n`
    );
    assert.equal(
      textEndpoints[`api/${browser}/latest-mobile`],
      `${endpoints[`api/${browser}/latest-mobile.json`].user_agent}\n`
    );
  }

  assert.equal(typeof endpoints["api/latest.json"].browsers.chrome.desktop.user_agent, "string");
  assert.equal(typeof endpoints["api/all.json"].items[0].user_agent, "string");
  assert.equal(typeof endpoints["api/desktop.json"].items[0].user_agent, "string");
  assert.equal(typeof endpoints["api/mobile.json"].items[0].user_agent, "string");

  for (const entry of manifest.endpoints) {
    assert.ok(
      endpoints[entry.path] || textEndpoints[entry.path],
      `manifest entry ${entry.path} should exist on disk`
    );
  }
});

test("homepage uses relative asset paths and extensionless latest endpoints are present", async () => {
  const topLevelEntries = await readdir(apiDirectory, { withFileTypes: true });
  const apiTopLevelFiles = topLevelEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);

  assert.ok(apiTopLevelFiles.includes("all.json"));
  assert.ok(apiTopLevelFiles.includes("latest.json"));

  const indexHtml = await readFile(path.join(docsDirectory, "index.html"), "utf8");
  const appJs = await readFile(path.join(docsDirectory, "app.js"), "utf8");
  const chromeTextEndpoint = await readFile(
    path.join(docsDirectory, "api", "chrome", "latest-desktop"),
    "utf8"
  );

  assert.match(indexHtml, /href="\.\/styles\.css"/);
  assert.match(indexHtml, /src="\.\/app\.js"/);
  assert.match(appJs, /new URL\("\.\/api\/index\.json"/);
  assert.match(appJs, /new URL\("\.\/api\/meta\.json"/);
  assert.doesNotMatch(appJs, /https?:\/\//);
  assert.match(chromeTextEndpoint, /^Mozilla\/5\.0/);
});
