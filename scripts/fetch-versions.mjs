const CHROME_LAST_KNOWN_GOOD_URL =
  "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json";
const CHROME_MILESTONES_URL =
  "https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone.json";
const EDGE_PRODUCTS_URL = "https://edgeupdates.microsoft.com/api/products";
const FIREFOX_VERSIONS_URL =
  "https://product-details.mozilla.org/1.0/firefox_versions.json";
const FIREFOX_RELEASES_URL = "https://product-details.mozilla.org/1.0/firefox.json";
const SAFARI_RELEASE_NOTES_URL =
  "https://developer.apple.com/tutorials/data/documentation/safari-release-notes.json";
const SAFARI_FALLBACK_URL = "https://www.browsers.fyi/api/";

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
    reference:
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent/Firefox"
  },
  safari: {
    release_notes_index: SAFARI_RELEASE_NOTES_URL,
    release_notes_page:
      "https://developer.apple.com/documentation/safari-release-notes/",
    ua_validation_article:
      "https://nielsleenheer.com/articles/2025/the-user-agent-string-of-safari-on-ios-26-and-macos-26/",
    fallback: SAFARI_FALLBACK_URL
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
    return await response.json();
  } catch (error) {
    throw new Error(`Source parse failed for ${sourceLabel}: ${error.message}`);
  }
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

function resolveFirefoxVersions(firefoxVersions, firefoxReleases) {
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
      version: currentVersion,
      full_version: currentVersion
    },
    previous: {
      version: previousVersion,
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
      versions: {
        current: {
          version: current.version,
          release_notes: current.release_notes
        },
        previous: {
          version: previous.version,
          release_notes: previous.release_notes
        }
      },
      fallback_use: {
        used: false,
        source: null,
        note: null
      }
    };
  }

  const fallbackData = await fetchJson(SAFARI_FALLBACK_URL, "Safari fallback browsers.fyi API");
  const fallbackCurrent = fallbackData?.safari?.version;
  const existingPrevious = existingMeta?.resolved_versions?.safari?.previous?.version;

  if (!fallbackCurrent || !existingPrevious || fallbackCurrent === existingPrevious) {
    throw new Error(
      "Safari source parsing failed and the fallback source could not safely reconstruct both current and previous stable versions."
    );
  }

  return {
    versions: {
      current: {
        version: fallbackCurrent,
        release_notes: fallbackData?.safari?.release_notes ?? null
      },
      previous: {
        version: existingPrevious,
        release_notes:
          existingMeta?.resolved_versions?.safari?.previous?.release_notes ?? null
      }
    },
    fallback_use: {
      used: true,
      source: SAFARI_FALLBACK_URL,
      note:
        "Safari current version came from browsers.fyi because Apple release-note parsing did not expose two stable releases. Previous Safari remained pinned from the last known good metadata."
    }
  };
}

export async function fetchResolvedVersions({ existingMeta = null } = {}) {
  const [
    chromeLastKnownGood,
    chromeMilestones,
    edgeProducts,
    firefoxVersions,
    firefoxReleases,
    safariReleaseNotes
  ] = await Promise.all([
    fetchJson(CHROME_LAST_KNOWN_GOOD_URL, "Chrome last-known-good versions"),
    fetchJson(CHROME_MILESTONES_URL, "Chrome milestone versions"),
    fetchJson(EDGE_PRODUCTS_URL, "Edge products API"),
    fetchJson(FIREFOX_VERSIONS_URL, "Firefox versions feed"),
    fetchJson(FIREFOX_RELEASES_URL, "Firefox releases feed"),
    fetchJson(SAFARI_RELEASE_NOTES_URL, "Safari release notes index")
  ]);

  const safari = await resolveSafariVersions(safariReleaseNotes, existingMeta);

  const resolvedVersions = sortObjectKeys({
    chrome: resolveChromeVersions(chromeLastKnownGood, chromeMilestones),
    edge: resolveEdgeVersions(edgeProducts),
    firefox: resolveFirefoxVersions(firefoxVersions, firefoxReleases),
    safari: safari.versions
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
      versions: FIREFOX_VERSIONS_URL,
      releases: FIREFOX_RELEASES_URL,
      reference: SOURCE_URLS.firefox.reference,
      last_release_date: firefoxVersions?.LAST_RELEASE_DATE ?? null
    },
    safari: {
      release_notes_index: SAFARI_RELEASE_NOTES_URL,
      release_notes_page: SOURCE_URLS.safari.release_notes_page,
      current_release_notes: safari.versions.current.release_notes,
      previous_release_notes: safari.versions.previous.release_notes,
      ua_validation_article: SOURCE_URLS.safari.ua_validation_article,
      fallback: SOURCE_URLS.safari.fallback
    }
  });

  return {
    resolvedVersions,
    sourceReferences,
    fallbackUse: safari.fallback_use
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const payload = await fetchResolvedVersions();
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
