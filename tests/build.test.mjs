import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildProject } from "../scripts/build.mjs";

const FIXTURE_VERSIONS = {
  chrome: {
    current: {
      version: "147",
      full_version: "147.0.7727.50",
      milestone: "147"
    },
    previous: {
      version: "146",
      full_version: "146.0.7680.165",
      milestone: "146"
    }
  },
  safari: {
    current: {
      version: "26.4",
      release_notes: "https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes"
    },
    previous: {
      version: "26.3",
      release_notes: "https://developer.apple.com/documentation/safari-release-notes/safari-26_3-release-notes"
    }
  },
  edge: {
    current: {
      version: "146",
      full_version: "146.0.3856.97",
      release_notes: "https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/146",
      releases: {
        windows: "146.0.3856.97",
        macos: "146.0.3856.97",
        linux: "146.0.3856.97",
        android: "146.0.3856.85"
      }
    },
    previous: {
      version: "145",
      full_version: null,
      derived_major: true,
      release_notes: "https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/145",
      releases: {
        windows: null,
        macos: null,
        linux: null,
        android: null
      }
    }
  },
  firefox: {
    current: {
      version: "149.0",
      full_version: "149.0"
    },
    previous: {
      version: "148.0.2",
      full_version: "148.0.2"
    },
    esr: "140.9.0esr"
  }
};

const FIXTURE_SOURCE_REFERENCES = {
  chrome: {
    last_known_good: "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json",
    milestones: "https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone.json",
    source_timestamp: "2026-04-02T07:37:29.301Z",
    ua_reduction: "https://www.chromium.org/updates/ua-reduction/"
  },
  edge: {
    guidance: "https://learn.microsoft.com/en-us/microsoft-edge/web-platform/user-agent-guidance",
    products: "https://edgeupdates.microsoft.com/api/products",
    useragent_reduction:
      "https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/useragentreduction"
  },
  firefox: {
    last_release_date: "2026-03-24",
    reference:
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent/Firefox",
    releases: "https://product-details.mozilla.org/1.0/firefox.json",
    versions: "https://product-details.mozilla.org/1.0/firefox_versions.json"
  },
  safari: {
    current_release_notes:
      "https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes",
    fallback: "https://www.browsers.fyi/api/",
    previous_release_notes:
      "https://developer.apple.com/documentation/safari-release-notes/safari-26_3-release-notes",
    release_notes_index:
      "https://developer.apple.com/tutorials/data/documentation/safari-release-notes.json",
    release_notes_page: "https://developer.apple.com/documentation/safari-release-notes/",
    ua_validation_article:
      "https://nielsleenheer.com/articles/2025/the-user-agent-string-of-safari-on-ios-26-and-macos-26/"
  }
};

const FIXTURE_FALLBACK = {
  used: false,
  source: null,
  note: null
};

test("buildProject writes deterministic outputs and preserves generated_at when inputs do not change", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ua-registry-"));

  const firstBuild = await buildProject({
    rootDirectory: tempRoot,
    now: "2026-04-02T12:34:56Z",
    buildSha: "1111111",
    resolvedVersionsInput: FIXTURE_VERSIONS,
    sourceReferencesInput: FIXTURE_SOURCE_REFERENCES,
    fallbackUseInput: FIXTURE_FALLBACK
  });

  assert.ok(firstBuild.changedFiles.length > 0);
  assert.equal(firstBuild.endpoints["api/chrome.json"].count, 4);

  const secondBuild = await buildProject({
    rootDirectory: tempRoot,
    now: "2026-04-03T08:00:00Z",
    buildSha: "2222222",
    resolvedVersionsInput: FIXTURE_VERSIONS,
    sourceReferencesInput: FIXTURE_SOURCE_REFERENCES,
    fallbackUseInput: FIXTURE_FALLBACK
  });

  assert.equal(secondBuild.generatedAt, "2026-04-02T12:34:56Z");
  assert.equal(secondBuild.changedFiles.length, 0);

  const meta = JSON.parse(
    await readFile(path.join(tempRoot, "docs", "api", "meta.json"), "utf8")
  );
  const readme = await readFile(path.join(tempRoot, "README.md"), "utf8");
  const chromeText = await readFile(
    path.join(tempRoot, "docs", "api", "chrome", "windows"),
    "utf8"
  );

  assert.equal(meta.generated_at, "2026-04-02T12:34:56Z");
  assert.equal(meta.build_sha, "1111111");
  assert.match(readme, /^# Latest Browser User Agents/);
  assert.match(chromeText, /^Mozilla\/5\.0/);
  assert.doesNotMatch(readme, /previous stable/i);
  assert.equal("previous" in meta.resolved_versions.chrome, false);
  assert.equal("previous_release_notes" in meta.source_urls.safari, false);
});
