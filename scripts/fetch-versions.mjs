const CHROME_LAST_KNOWN_GOOD_URL =
  "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json";
const CHROME_MILESTONES_URL =
  "https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone.json";
const EDGE_PRODUCTS_URL = "https://edgeupdates.microsoft.com/api/products";
const FIREFOX_VERSIONS_URL =
  "https://product-details.mozilla.org/1.0/firefox_versions.json";
const FIREFOX_RELEASES_URL = "https://product-details.mozilla.org/1.0/firefox.json";
const ANDROID_LATEST_UPDATES_URL = "https://developer.android.com/latest-updates/";
const SAFARI_RELEASE_NOTES_URL =
  "https://developer.apple.com/tutorials/data/documentation/safari-release-notes.json";
const IOS_IPADOS_RELEASE_NOTES_URL =
  "https://developer.apple.com/tutorials/data/documentation/ios-ipados-release-notes.json";
const WEBKIT_SAFARI_UA_BEHAVIOR_URL =
  "https://webkit.org/blog/17333/webkit-features-in-safari-26-0/";

export const SOURCE_URLS = {
  chrome: {
    last_known_good: CHROME_LAST_KNOWN_GOOD_URL,
    milestones: CHROME_MILESTONES_URL,
    ua_reduction: "https://www.chromium.org/updates/ua-reduction/"
  },
  edge: {
    products: EDGE_PRODUCTS_URL,
    guidance:
      "https://learn.microsoft.com/en-us/microsoft-edge/web-platform/user-agent-guidance",
    useragent_reduction:
      "https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/useragentreduction"
  },
  firefox: {
    versions: FIREFOX_VERSIONS_URL,
    releases: FIREFOX_RELEASES_URL,
    android_latest_updates: ANDROID_LATEST_UPDATES_URL,
    reference:
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent/Firefox"
  },
  safari: {
    release_notes_index: SAFARI_RELEASE_NOTES_URL,
    ios_ipados_release_notes_index: IOS_IPADOS_RELEASE_NOTES_URL,
    release_notes_page:
      "https://developer.apple.com/documentation/safari-release-notes/",
    ua_behavior_reference: WEBKIT_SAFARI_UA_BEHAVIOR_URL
  }
};

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortObjectKeys(value[key])])
    );
  }

  return value;
}

function extractNumericParts(version) {
  return String(version)
    .match(/\d+/g)
    ?.map((part) => Number(part)) ?? [0];
}

export function compareVersions(a, b) {
  const left = extractNumericParts(a);
  const right = extractNumericParts(b);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);

    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

export function extractMajor(version) {
  return String(version).split(".")[0];
}

async function fetchJson(url, sourceLabel) {
  return fetchWithParser(url, sourceLabel, (response) => response.json());
}

async function fetchText(url, sourceLabel) {
  return fetchWithParser(url, sourceLabel, (response) => response.text());
}

async function fetchWithParser(url, sourceLabel, parser) {
  let response;

  try {
    response = await fetch(url, {
      headers: {
        "user-agent": "ua-registry-build"
      },
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new Error(`Source fetch failed for ${sourceLabel}: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(
      `Source fetch failed for ${sourceLabel}: ${response.status} ${response.statusText}`
    );
  }

  try {
    return await parser(response);
  } catch (error) {
    throw new Error(`Source parse failed for ${sourceLabel}: ${error.message}`);
  }
}

export function parseLatestStableAndroidVersion(html) {
  const stableVersions = [...String(html).matchAll(
    /<(?:div|li)\b[^>]*\bandroid-latest-update--stable\b[^>]*>[\s\S]{0,2500}?<h3 id="android-(\d+)"[\s\S]{0,400}?>[\s\S]{0,400}?Android\s+\1\b/gi
  )]
    .map((match) => match[1])
    .sort(compareVersions);

  const latestStableVersion = stableVersions.at(-1);

  if (!latestStableVersion) {
    throw new Error("Android source page did not expose a stable platform version.");
  }

  return latestStableVersion;
}

function resolveChromeVersions(lastKnownGood, milestones) {
  const stableVersion = lastKnownGood?.channels?.Stable?.version;

  if (!stableVersion) {
    throw new Error("Chrome source data is missing the stable channel version.");
  }

  const currentMajor = extractMajor(stableVersion);
  const previousMajor = String(Number(currentMajor) - 1);
  const previousVersion = milestones?.milestones?.[previousMajor]?.version;

  if (!previousVersion) {
    throw new Error(
      `Chrome source data is missing milestone ${previousMajor} for previous stable resolution.`
    );
  }

  return {
    current: {
      version: currentMajor,
      full_version: stableVersion,
      milestone: currentMajor
    },
    previous: {
      version: previousMajor,
      full_version: previousVersion,
      milestone: previousMajor
    }
  };
}

function pickEdgeRelease(releases, major, platform, preferredArchitecture) {
  const matching = releases
    .filter((release) => {
      return (
        extractMajor(release.ProductVersion) === major &&
        release.Platform === platform
      );
    })
    .sort((left, right) => {
      const architectureBoost =
        Number(right.Architecture === preferredArchitecture) -
        Number(left.Architecture === preferredArchitecture);

      if (architectureBoost !== 0) {
        return architectureBoost;
      }

      const publishedAt =
        Date.parse(right.PublishedTime) - Date.parse(left.PublishedTime);

      if (publishedAt !== 0) {
        return publishedAt;
      }

      return compareVersions(right.ProductVersion, left.ProductVersion);
    });

  return matching[0] ?? null;
}

function resolveEdgeVersions(products) {
  const stableProduct = products.find((product) => product.Product === "Stable");

  if (!stableProduct) {
    throw new Error("Edge source data is missing the Stable product feed.");
  }

  const stableReleases = stableProduct.Releases;
  const majors = [...new Set(stableReleases.map((release) => extractMajor(release.ProductVersion)))]
    .sort((left, right) => Number(right) - Number(left));

  const currentMajor = majors[0];
  const previousMajor = majors[1] ?? String(Number(currentMajor) - 1);
  const previousDerived = majors.length < 2;

  if (!currentMajor) {
    throw new Error("Edge source data did not expose a current stable major.");
  }

  const platformTargets = {
    windows: ["Windows", "x64"],
    macos: ["MacOS", "universal"],
    linux: ["Linux", "x64"],
    android: ["Android", "arm64"]
  };

  const resolveReleaseSet = (major, { allowMissing = false } = {}) => {
    const releases = Object.fromEntries(
      Object.entries(platformTargets).map(([key, [platform, architecture]]) => {
        const release = pickEdgeRelease(stableReleases, major, platform, architecture);

        if (!release) {
          return [key, null];
        }

        return [key, release.ProductVersion];
      })
    );

    if (!allowMissing && !releases.windows) {
      throw new Error(`Edge source data is missing a Windows release for major ${major}.`);
    }

    return {
      version: major,
      full_version: releases.windows ?? null,
      releases,
      release_notes:
        `https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/${major}`
    };
  };

  return {
    current: resolveReleaseSet(currentMajor),
    previous: {
      ...resolveReleaseSet(previousMajor, { allowMissing: true }),
      derived_major: previousDerived
    }
  };
}

function isFirefoxStableVersion(version) {
  return /^\d+(?:\.\d+)*$/.test(version);
}

export function toFirefoxUaVersion(version) {
  const match = String(version).match(/^(\d+)(?:\.(\d+))?/);

  if (!match) {
    throw new Error(`Could not derive a Firefox UA version from "${version}".`);
  }

  return `${match[1]}.${match[2] ?? "0"}`;
}

export function resolveFirefoxVersions(firefoxVersions, firefoxReleases) {
  const currentVersion = firefoxVersions?.LATEST_FIREFOX_VERSION;

  if (!currentVersion) {
    throw new Error("Firefox source data is missing LATEST_FIREFOX_VERSION.");
  }

  const releaseVersions = Object.values(firefoxReleases?.releases ?? {})
    .filter((release) => release.product === "firefox")
    .map((release) => release.version)
    .filter(isFirefoxStableVersion);

  const currentMajor = Number(extractMajor(currentVersion));
  const previousCandidates = releaseVersions.filter(
    (version) => Number(extractMajor(version)) < currentMajor
  );

  const previousVersion = previousCandidates.sort(compareVersions).at(-1);

  if (!previousVersion) {
    throw new Error("Firefox source data did not expose a previous stable release.");
  }

  return {
    current: {
      // Firefox patch releases update the shipped application version, but the
      // browser UA keeps using the milestone form (for example 149.0.2 ships as
      // Firefox/149.0 in the UA). Keep both values so metadata can report the
      // current release while templates emit the UA-correct token.
      version: toFirefoxUaVersion(currentVersion),
      full_version: currentVersion
    },
    previous: {
      version: toFirefoxUaVersion(previousVersion),
      full_version: previousVersion
    },
    esr: firefoxVersions.FIREFOX_ESR ?? null
  };
}

function parseSafariStableEntries(appleIndex) {
  const entries = Object.values(appleIndex?.references ?? {})
    .map((reference) => {
      const title = String(reference?.title ?? "");
      const abstract = String(reference?.abstract?.[0]?.text ?? "");
      const versionMatch =
        title.match(/Safari\s+([0-9]+(?:\.[0-9]+)*)/i) ??
        abstract.match(/—\s*([0-9]+(?:\.[0-9]+)*)\s*\(/);

      if (!versionMatch) {
        return null;
      }

      const beta = /beta/i.test(title) || /beta/i.test(abstract);

      return {
        title,
        version: versionMatch[1],
        beta,
        release_notes: reference?.url
          ? `https://developer.apple.com${reference.url}`
          : null
      };
    })
    .filter(Boolean)
    .filter((entry) => !entry.beta);

  const uniqueByVersion = new Map();

  for (const entry of entries) {
    if (!uniqueByVersion.has(entry.version)) {
      uniqueByVersion.set(entry.version, entry);
    }
  }

  return [...uniqueByVersion.values()].sort((left, right) =>
    compareVersions(right.version, left.version)
  );
}

async function resolveSafariVersions(appleIndex, existingMeta) {
  const stableEntries = parseSafariStableEntries(appleIndex);

  if (stableEntries.length >= 2) {
    const [current, previous] = stableEntries;

    return {
      current: {
        version: current.version,
        release_notes: current.release_notes
      },
      previous: {
        version: previous.version,
        release_notes: previous.release_notes
      }
    };
  }

  throw new Error(
    "Safari source parsing failed because Apple release notes did not expose two stable releases. Official-source-only mode is enabled, so the build stops instead of falling back to a third-party source."
  );
}

function extractAppleReleaseNotesVersion(identifier) {
  const match = String(identifier).match(/-(\d+(?:_\d+)*)-release-notes$/);

  if (!match) {
    return null;
  }

  return match[1].replaceAll("_", ".");
}

export function resolveSafariFrozenMobileOsVersion(iosIpadosReleaseNotes, safariVersion) {
  const currentSafariMajor = Number(extractMajor(safariVersion));

  const sections = iosIpadosReleaseNotes?.topicSections ?? [];
  const compatibleSection = sections
    .map((section) => {
      const match = String(section?.title ?? "").match(/^iOS\s*&\s*iPadOS\s+(\d+)$/i);

      if (!match) {
        return null;
      }

      return {
        major: Number(match[1]),
        identifiers: section.identifiers ?? []
      };
    })
    .filter(Boolean)
    .filter((section) => section.major < currentSafariMajor)
    .sort((left, right) => right.major - left.major)[0];

  if (!compatibleSection) {
    throw new Error(
      `iOS & iPadOS release notes did not expose a stable compatibility line before Safari ${safariVersion}.`
    );
  }

  const versions = compatibleSection.identifiers
    .map(extractAppleReleaseNotesVersion)
    .filter(Boolean)
    .sort(compareVersions);

  const latestVersion = versions.at(-1);

  if (!latestVersion) {
    throw new Error(
      `iOS & iPadOS release notes did not expose a stable point release for compatibility line ${compatibleSection.major}.`
    );
  }

  return latestVersion;
}

export async function fetchResolvedVersions({ existingMeta = null } = {}) {
  const [
    chromeLastKnownGood,
    chromeMilestones,
    edgeProducts,
    firefoxVersions,
    firefoxReleases,
    androidLatestUpdates,
    safariReleaseNotes,
    iosIpadosReleaseNotes
  ] = await Promise.all([
    fetchJson(CHROME_LAST_KNOWN_GOOD_URL, "Chrome last-known-good versions"),
    fetchJson(CHROME_MILESTONES_URL, "Chrome milestone versions"),
    fetchJson(EDGE_PRODUCTS_URL, "Edge products API"),
    fetchJson(FIREFOX_VERSIONS_URL, "Firefox versions feed"),
    fetchJson(FIREFOX_RELEASES_URL, "Firefox releases feed"),
    fetchText(ANDROID_LATEST_UPDATES_URL, "Android latest updates page"),
    fetchJson(SAFARI_RELEASE_NOTES_URL, "Safari release notes index"),
    fetchJson(IOS_IPADOS_RELEASE_NOTES_URL, "iOS & iPadOS release notes index")
  ]);

  const safari = await resolveSafariVersions(safariReleaseNotes, existingMeta);
  const firefoxAndroidVersion = parseLatestStableAndroidVersion(androidLatestUpdates);
  const safariFrozenMobileOsVersion = resolveSafariFrozenMobileOsVersion(
    iosIpadosReleaseNotes,
    safari.current.version
  );

  const resolvedVersions = sortObjectKeys({
    chrome: resolveChromeVersions(chromeLastKnownGood, chromeMilestones),
    edge: resolveEdgeVersions(edgeProducts),
    firefox: resolveFirefoxVersions(firefoxVersions, firefoxReleases),
    safari
  });

  const uaContext = sortObjectKeys({
    firefox: {
      android_version: firefoxAndroidVersion
    },
    safari: {
      ios_ipados_compat_version: safariFrozenMobileOsVersion
    }
  });

  const sourceReferences = sortObjectKeys({
    chrome: {
      last_known_good: CHROME_LAST_KNOWN_GOOD_URL,
      milestones: CHROME_MILESTONES_URL,
      ua_reduction: SOURCE_URLS.chrome.ua_reduction,
      source_timestamp: chromeLastKnownGood?.timestamp ?? chromeMilestones?.timestamp ?? null
    },
    edge: {
      products: EDGE_PRODUCTS_URL,
      guidance: SOURCE_URLS.edge.guidance,
      useragent_reduction: SOURCE_URLS.edge.useragent_reduction
    },
    firefox: {
      android_latest_updates: ANDROID_LATEST_UPDATES_URL,
      versions: FIREFOX_VERSIONS_URL,
      releases: FIREFOX_RELEASES_URL,
      reference: SOURCE_URLS.firefox.reference,
      last_release_date: firefoxVersions?.LAST_RELEASE_DATE ?? null
    },
    safari: {
      ios_ipados_release_notes_index: IOS_IPADOS_RELEASE_NOTES_URL,
      release_notes_index: SAFARI_RELEASE_NOTES_URL,
      release_notes_page: SOURCE_URLS.safari.release_notes_page,
      current_release_notes: safari.current.release_notes,
      previous_release_notes: safari.previous.release_notes,
      ua_behavior_reference: SOURCE_URLS.safari.ua_behavior_reference
    }
  });

  return {
    resolvedVersions,
    uaContext,
    sourceReferences
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const payload = await fetchResolvedVersions();
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
