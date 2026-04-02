import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { fetchResolvedVersions } from "./fetch-versions.mjs";
import { SAFARI_RULES_NOTES, SAFARI_RULES_VERSION } from "./safari-rules.mjs";
import {
  BROWSER_LABELS,
  BROWSER_ORDER,
  GENERATOR_VERSION,
  VARIANT_CONFIG_NOTES,
  getVariantConfigSignature
} from "./variants.mjs";
import { buildCollections } from "./templates.mjs";
import { validateSiteModel } from "./validate.mjs";
import { writeSite } from "./write-endpoints.mjs";

function listPayload(generatedAt, browser, deviceClass, items) {
  return {
    generated_at: generatedAt,
    browser,
    device_class: deviceClass,
    count: items.length,
    items
  };
}

function singlePayload(generatedAt, item) {
  return {
    generated_at: generatedAt,
    ...item
  };
}

function buildManifest(generatedAt, collections) {
  const endpoints = [
    {
      path: "api/index.json",
      group: "global",
      description: "Endpoint manifest"
    },
    {
      path: "api/meta.json",
      group: "global",
      description: "Build and source metadata"
    },
    {
      path: "api/all.json",
      group: "global",
      description: "All generated UA entries",
      count: collections.allItems.length
    },
    {
      path: "api/desktop.json",
      group: "global",
      description: "All desktop UA entries",
      count: collections.desktopItems.length
    },
    {
      path: "api/mobile.json",
      group: "global",
      description: "All mobile UA entries",
      count: collections.mobileItems.length
    },
    {
      path: "api/latest.json",
      group: "global",
      description: "Latest desktop and mobile UA per browser family"
    }
  ];

  for (const browser of BROWSER_ORDER) {
    const items = collections.browserItems[browser];
    const desktopItems = items.filter((item) => item.device_class === "desktop");
    const mobileItems = items.filter((item) => item.device_class === "mobile");

    endpoints.push(
      {
        path: `api/${browser}.json`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} top-five variants`,
        count: items.length
      },
      {
        path: `api/${browser}/desktop.json`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} desktop variants`,
        count: desktopItems.length
      },
      {
        path: `api/${browser}/mobile.json`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} mobile variants`,
        count: mobileItems.length
      },
      {
        path: `api/${browser}/latest.json`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} latest desktop and mobile`
      },
      {
        path: `api/${browser}/latest-desktop.json`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} latest desktop UA`
      },
      {
        path: `api/${browser}/latest-mobile.json`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} latest mobile UA`
      }
    );
  }

  endpoints.sort((left, right) => left.path.localeCompare(right.path));

  return {
    generated_at: generatedAt,
    description: "Relative-path manifest for the published static JSON endpoints.",
    browser_counts: Object.fromEntries(
      BROWSER_ORDER.map((browser) => [browser, collections.browserItems[browser].length])
    ),
    endpoints
  };
}

function buildMeta({
  generatedAt,
  buildSha,
  resolvedVersions,
  sourceReferences,
  fallbackUse,
  collections
}) {
  return {
    generated_at: generatedAt,
    build_sha: buildSha ?? null,
    generator_version: GENERATOR_VERSION,
    source_strategy: {
      primary: "Official vendor version feeds plus deterministic UA template generation.",
      fallbacks: [
        "Safari current-version discovery can fall back to browsers.fyi only when Apple release-note parsing does not safely expose both stable releases."
      ]
    },
    source_urls: sourceReferences,
    resolved_versions: resolvedVersions,
    variant_config: {
      signature: getVariantConfigSignature(),
      notes: VARIANT_CONFIG_NOTES
    },
    safari_rules: {
      version: SAFARI_RULES_VERSION,
      notes: SAFARI_RULES_NOTES
    },
    fallback_source_use: fallbackUse,
    counts: {
      all: collections.allItems.length,
      desktop: collections.desktopItems.length,
      mobile: collections.mobileItems.length,
      by_browser: Object.fromEntries(
        BROWSER_ORDER.map((browser) => [browser, collections.browserItems[browser].length])
      )
    }
  };
}

function signatureForMeta(meta) {
  const normalized = {
    ...meta,
    generated_at: null,
    build_sha: null
  };

  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

async function loadExistingMeta(docsDirectory) {
  const filePath = path.join(docsDirectory, "api", "meta.json");

  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function buildEndpointMap(generatedAt, collections, meta) {
  const endpoints = {
    "api/all.json": listPayload(generatedAt, "all", "all", collections.allItems),
    "api/desktop.json": listPayload(generatedAt, "all", "desktop", collections.desktopItems),
    "api/mobile.json": listPayload(generatedAt, "all", "mobile", collections.mobileItems),
    "api/latest.json": {
      generated_at: generatedAt,
      browsers: collections.latest
    },
    "api/meta.json": meta
  };

  for (const browser of BROWSER_ORDER) {
    const items = collections.browserItems[browser];
    const latest = collections.latest[browser];
    endpoints[`api/${browser}.json`] = listPayload(generatedAt, browser, "all", items);
    endpoints[`api/${browser}/desktop.json`] = listPayload(
      generatedAt,
      browser,
      "desktop",
      items.filter((item) => item.device_class === "desktop")
    );
    endpoints[`api/${browser}/mobile.json`] = listPayload(
      generatedAt,
      browser,
      "mobile",
      items.filter((item) => item.device_class === "mobile")
    );
    endpoints[`api/${browser}/latest.json`] = {
      generated_at: generatedAt,
      desktop: latest.desktop,
      mobile: latest.mobile
    };
    endpoints[`api/${browser}/latest-desktop.json`] = singlePayload(generatedAt, latest.desktop);
    endpoints[`api/${browser}/latest-mobile.json`] = singlePayload(generatedAt, latest.mobile);
  }

  endpoints["api/index.json"] = buildManifest(generatedAt, collections);
  return endpoints;
}

export async function buildProject({
  rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  buildSha = process.env.GITHUB_SHA ?? null,
  now = new Date().toISOString(),
  resolvedVersionsInput = null,
  sourceReferencesInput = null,
  fallbackUseInput = null
} = {}) {
  const docsDirectory = path.join(rootDirectory, "docs");
  const existingMeta = await loadExistingMeta(docsDirectory);

  const resolvedSourceData =
    resolvedVersionsInput && sourceReferencesInput && fallbackUseInput
      ? {
          resolvedVersions: resolvedVersionsInput,
          sourceReferences: sourceReferencesInput,
          fallbackUse: fallbackUseInput
        }
      : await fetchResolvedVersions({ existingMeta });

  const collections = buildCollections(resolvedSourceData.resolvedVersions);
  const provisionalMeta = buildMeta({
    generatedAt: now,
    buildSha,
    resolvedVersions: resolvedSourceData.resolvedVersions,
    sourceReferences: resolvedSourceData.sourceReferences,
    fallbackUse: resolvedSourceData.fallbackUse,
    collections
  });

  const nextSignature = signatureForMeta(provisionalMeta);
  const existingSignature = existingMeta ? signatureForMeta(existingMeta) : null;
  const generatedAt =
    existingSignature === nextSignature && existingMeta?.generated_at
      ? existingMeta.generated_at
      : now;
  const finalBuildSha =
    existingSignature === nextSignature ? existingMeta?.build_sha ?? buildSha : buildSha;

  const finalMeta = buildMeta({
    generatedAt,
    buildSha: finalBuildSha,
    resolvedVersions: resolvedSourceData.resolvedVersions,
    sourceReferences: resolvedSourceData.sourceReferences,
    fallbackUse: resolvedSourceData.fallbackUse,
    collections
  });

  const endpoints = buildEndpointMap(generatedAt, collections, finalMeta);
  const site = { endpoints };

  validateSiteModel(site);
  const changedFiles = await writeSite(docsDirectory, site);

  return {
    changedFiles,
    generatedAt,
    endpoints,
    meta: finalMeta
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await buildProject();
  process.stdout.write(
    `Build completed. Changed files: ${result.changedFiles.length}. Generated at: ${result.generatedAt}\n`
  );
}
