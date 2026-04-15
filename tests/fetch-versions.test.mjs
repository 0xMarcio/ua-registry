import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLatestStableAndroidVersion,
  resolveFirefoxVersions,
  resolveSafariFrozenMobileOsVersion,
  toFirefoxUaVersion
} from "../scripts/fetch-versions.mjs";

test("toFirefoxUaVersion drops Firefox patch releases down to the UA milestone token", () => {
  assert.equal(toFirefoxUaVersion("149.0.2"), "149.0");
  assert.equal(toFirefoxUaVersion("149.0"), "149.0");
  assert.equal(toFirefoxUaVersion("115.34.1"), "115.34");
});

test("resolveFirefoxVersions preserves the full shipped release and the UA version separately", () => {
  const resolved = resolveFirefoxVersions(
    {
      LATEST_FIREFOX_VERSION: "149.0.2",
      FIREFOX_ESR: "140.9.1esr"
    },
    {
      releases: {
        "firefox-149.0": {
          product: "firefox",
          version: "149.0"
        },
        "firefox-149.0.2": {
          product: "firefox",
          version: "149.0.2"
        },
        "firefox-148.0.2": {
          product: "firefox",
          version: "148.0.2"
        }
      }
    }
  );

  assert.deepEqual(resolved.current, {
    version: "149.0",
    full_version: "149.0.2"
  });
  assert.deepEqual(resolved.previous, {
    version: "148.0",
    full_version: "148.0.2"
  });
  assert.equal(resolved.esr, "140.9.1esr");
});

test("parseLatestStableAndroidVersion resolves the current stable Android major", () => {
  const html = `
    <div><span>Stable</span></div>
    <h3 id="android-16"><a href="/about/versions">Android 16</a></h3>
    <div>The latest version of Android is available for testing, development, and feedback.</div>
  `;

  assert.equal(parseLatestStableAndroidVersion(html), "16");
});

test("resolveSafariFrozenMobileOsVersion picks the latest stable pre-current iOS compatibility release", () => {
  const compatVersion = resolveSafariFrozenMobileOsVersion(
    {
      topicSections: [
        {
          title: "iOS & iPadOS 26",
          identifiers: ["doc://.../ios-ipados-26_4-release-notes"]
        },
        {
          title: "iOS & iPadOS 18",
          identifiers: [
            "doc://.../ios-ipados-18_6-release-notes",
            "doc://.../ios-ipados-18_5-release-notes"
          ]
        }
      ]
    },
    "26.4"
  );

  assert.equal(compatVersion, "18.6");
});
