import assert from "node:assert/strict";
import test from "node:test";
import { buildCollections, buildVariantItem } from "../scripts/templates.mjs";

const FIXTURE_UA_CONTEXT = {
  firefox: {
    android_version: "16"
  },
  safari: {
    ios_ipados_compat_version: "18.6"
  }
};

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

test("Chromium-based templates use reduced UA formats", () => {
  const chrome = buildVariantItem("chrome", "current-windows", FIXTURE_VERSIONS, FIXTURE_UA_CONTEXT);
  const edgeDesktop = buildVariantItem("edge", "current-windows", FIXTURE_VERSIONS, FIXTURE_UA_CONTEXT);
  const edge = buildVariantItem("edge", "current-android", FIXTURE_VERSIONS, FIXTURE_UA_CONTEXT);

  assert.equal(
    chrome.user_agent,
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
  );
  assert.equal(
    edgeDesktop.user_agent,
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.3856.97"
  );
  assert.equal(
    edge.user_agent,
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36 EdgA/146.0.3856.85"
  );
});

test("Safari templates keep the isolated platform quirks", () => {
  const safariPhone = buildVariantItem("safari", "current-iphone", FIXTURE_VERSIONS, FIXTURE_UA_CONTEXT);
  const safariTablet = buildVariantItem("safari", "current-ipad-mobile", FIXTURE_VERSIONS, FIXTURE_UA_CONTEXT);

  assert.match(safariPhone.user_agent, /iPhone; CPU iPhone OS 18_6 like Mac OS X/);
  assert.match(safariPhone.user_agent, /Version\/26\.4 Mobile\/15E148 Safari\/604\.1$/);
  assert.match(safariTablet.user_agent, /iPad; CPU OS 18_6 like Mac OS X/);
});

test("Firefox templates include the expected desktop and mobile forms", () => {
  const firefoxUbuntu = buildVariantItem("firefox", "current-ubuntu", FIXTURE_VERSIONS, FIXTURE_UA_CONTEXT);
  const firefoxAndroid = buildVariantItem("firefox", "current-android", FIXTURE_VERSIONS, FIXTURE_UA_CONTEXT);
  const collections = buildCollections(FIXTURE_VERSIONS, FIXTURE_UA_CONTEXT);

  assert.match(firefoxUbuntu.user_agent, /X11; Ubuntu; Linux x86_64/);
  assert.match(firefoxAndroid.user_agent, /^Mozilla\/5\.0 \(Android 16; Mobile; rv:149\.0\) Gecko\/149\.0 Firefox\/149\.0$/);
  assert.equal(collections.browserItems.firefox.length, 5);
});
