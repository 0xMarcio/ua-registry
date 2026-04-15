import {
  BROWSER_LABELS,
  BROWSER_ORDER,
  BROWSER_VARIANT_FALLBACKS,
  BROWSER_VARIANT_ORDER
} from "./variants.mjs";
import { buildSafariUserAgent } from "./safari-rules.mjs";

const DEFAULT_FIREFOX_ANDROID_VERSION = "15";

function chromiumPlatformToken(platform) {
  if (platform === "windows") {
    return "Windows NT 10.0; Win64; x64";
  }

  if (platform === "macos") {
    return "Macintosh; Intel Mac OS X 10_15_7";
  }

  if (platform === "linux") {
    return "X11; Linux x86_64";
  }

  if (platform === "android") {
    return "Linux; Android 10; K";
  }

  throw new Error(`Unsupported Chromium platform: ${platform}`);
}

function buildChromiumUserAgent({ browser, platform, version, edgeVersion = null }) {
  const major = String(version);
  const base = [
    `Mozilla/5.0 (${chromiumPlatformToken(platform)})`,
    "AppleWebKit/537.36 (KHTML, like Gecko)",
    `Chrome/${major}.0.0.0`
  ];

  if (browser === "chrome") {
    if (platform === "android") {
      return [...base, "Mobile Safari/537.36"].join(" ");
    }

    return [...base, "Safari/537.36"].join(" ");
  }

  if (browser === "edge") {
    // Microsoft publishes platform-specific Edge app versions in the products
    // feed. Keep the Chromium token reduced, but use the full Edge app version
    // in the Edg/EdgA token so the UA reflects the latest stable release.
    const resolvedEdgeVersion = edgeVersion ?? `${major}.0.0.0`;

    if (platform === "android") {
      return [...base, "Mobile Safari/537.36", `EdgA/${resolvedEdgeVersion}`].join(" ");
    }

    return [...base, "Safari/537.36", `Edg/${resolvedEdgeVersion}`].join(" ");
  }

  throw new Error(`Unsupported Chromium browser: ${browser}`);
}

function firefoxPlatformToken(platform, uaContext) {
  if (platform === "windows") {
    return "Windows NT 10.0; Win64; x64";
  }

  if (platform === "macos") {
    return "Macintosh; Intel Mac OS X 10.15";
  }

  if (platform === "linux") {
    return "X11; Linux x86_64";
  }

  if (platform === "ubuntu") {
    return "X11; Ubuntu; Linux x86_64";
  }

  if (platform === "android") {
    return `Android ${uaContext.firefox?.android_version ?? DEFAULT_FIREFOX_ANDROID_VERSION}; Mobile`;
  }

  throw new Error(`Unsupported Firefox platform: ${platform}`);
}

function buildFirefoxUserAgent({ platform, version, uaContext }) {
  const firefoxVersion = String(version);
  const rv = firefoxVersion;

  if (platform === "android") {
    return [
      `Mozilla/5.0 (${firefoxPlatformToken(platform, uaContext)}; rv:${rv})`,
      `Gecko/${rv}`,
      `Firefox/${firefoxVersion}`
    ].join(" ");
  }

  return [
    `Mozilla/5.0 (${firefoxPlatformToken(platform, uaContext)}; rv:${rv})`,
    "Gecko/20100101",
    `Firefox/${firefoxVersion}`
  ].join(" ");
}

function titleCasePlatform(platform) {
  if (platform === "macos") {
    return "macOS";
  }

  if (platform === "android") {
    return "Android";
  }

  if (platform === "iphone") {
    return "iPhone";
  }

  if (platform === "ipad") {
    return "iPad";
  }

  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function variantDescriptor(browser, variantId) {
  const isPrevious = variantId.startsWith("previous-");
  const suffix = variantId.replace(/^(current|previous)-/, "");

  if (browser === "safari") {
    if (suffix === "iphone") {
      return {
        platform: "iphone",
        device_class: "mobile",
        labelPlatform: "iPhone",
        track: isPrevious ? "previous" : "current"
      };
    }

    if (suffix === "ipad-mobile") {
      return {
        platform: "ipad",
        templatePlatform: "ipad-mobile",
        device_class: "mobile",
        labelPlatform: "iPad",
        track: isPrevious ? "previous" : "current"
      };
    }

    if (suffix === "macos") {
      return {
        platform: "macos",
        device_class: "desktop",
        labelPlatform: "macOS",
        track: isPrevious ? "previous" : "current"
      };
    }
  }

  if (suffix === "windows" || suffix === "macos" || suffix === "linux") {
    return {
      platform: suffix,
      device_class: "desktop",
      labelPlatform: titleCasePlatform(suffix),
      track: isPrevious ? "previous" : "current"
    };
  }

  if (suffix === "android") {
    return {
      platform: "android",
      device_class: "mobile",
      labelPlatform: "Android",
      track: isPrevious ? "previous" : "current"
    };
  }

  if (suffix === "ubuntu") {
    return {
      platform: "ubuntu",
      device_class: "desktop",
      labelPlatform: "Ubuntu",
      track: isPrevious ? "previous" : "current"
    };
  }

  throw new Error(`Unsupported variant "${variantId}" for ${browser}.`);
}

function pickVersionRecord(browser, track, versions) {
  if (track === "current") {
    return versions[browser].current;
  }

  if (track === "previous") {
    return versions[browser].previous;
  }

  throw new Error(`Unsupported track: ${track}`);
}

export function buildVariantItem(browser, variantId, versions, uaContext = {}) {
  const descriptor = variantDescriptor(browser, variantId);
  const versionRecord = pickVersionRecord(browser, descriptor.track, versions);
  const browserLabel = BROWSER_LABELS[browser];
  const labelPrefix = descriptor.track === "previous" ? "previous stable on " : "on ";
  const label = `${browserLabel.split(" ").at(-1) === "Edge" ? browserLabel : browserLabel.replace("Google ", "").replace("Apple ", "").replace("Mozilla ", "")} ${labelPrefix}${descriptor.labelPlatform}`;

  let userAgent;

  if (browser === "chrome" || browser === "edge") {
    const edgeVersion =
      browser === "edge"
        ? versionRecord.releases?.[descriptor.platform] ??
          versionRecord.full_version ??
          `${versionRecord.version}.0.0.0`
        : null;

    userAgent = buildChromiumUserAgent({
      browser,
      platform: descriptor.platform,
      version: versionRecord.version,
      edgeVersion
    });
  } else if (browser === "firefox") {
    userAgent = buildFirefoxUserAgent({
      platform: descriptor.platform,
      version: versionRecord.version,
      uaContext
    });
  } else if (browser === "safari") {
    userAgent = buildSafariUserAgent({
      platform: descriptor.templatePlatform ?? descriptor.platform,
      version: versionRecord.version,
      iosIpadosCompatVersion:
        uaContext.safari?.ios_ipados_compat_version
    });
  } else {
    throw new Error(`Unsupported browser: ${browser}`);
  }

  return {
    label,
    browser,
    platform: descriptor.platform,
    device_class: descriptor.device_class,
    track: descriptor.track,
    version: String(versionRecord.version),
    user_agent: userAgent
  };
}

function selectUniqueBrowserItems(browser, versions, uaContext) {
  const requestedVariants = BROWSER_VARIANT_ORDER[browser];
  const fallbackPool = BROWSER_VARIANT_FALLBACKS[browser];
  const items = [];
  const seenUserAgents = new Set();

  for (const requestedVariant of requestedVariants) {
    const candidates = [
      requestedVariant,
      ...fallbackPool.filter((candidate) => candidate !== requestedVariant)
    ];
    let selectedItem = null;

    for (const candidate of candidates) {
      const item = buildVariantItem(browser, candidate, versions, uaContext);

      if (!seenUserAgents.has(item.user_agent)) {
        selectedItem = item;
        break;
      }
    }

    if (!selectedItem) {
      throw new Error(`Could not resolve a unique ${browser} variant for slot ${requestedVariant}.`);
    }

    seenUserAgents.add(selectedItem.user_agent);
    items.push(selectedItem);
  }

  if (items.length !== requestedVariants.length) {
    throw new Error(`${browser} endpoint did not resolve the requested number of variants.`);
  }

  return items;
}

export function buildBrowserItemsMap(versions, uaContext = {}) {
  return Object.fromEntries(
    BROWSER_ORDER.map((browser) => [browser, selectUniqueBrowserItems(browser, versions, uaContext)])
  );
}

export function buildCollections(versions, uaContext = {}) {
  const browserItems = buildBrowserItemsMap(versions, uaContext);
  const allItems = BROWSER_ORDER.flatMap((browser) => browserItems[browser]);
  const desktopItems = allItems.filter((item) => item.device_class === "desktop");
  const mobileItems = allItems.filter((item) => item.device_class === "mobile");
  const platformItems = Object.fromEntries(
    BROWSER_ORDER.map((browser) => [
      browser,
      Object.fromEntries(browserItems[browser].map((item) => [item.platform, item]))
    ])
  );

  return {
    browserItems,
    allItems,
    desktopItems,
    mobileItems,
    platformItems
  };
}
