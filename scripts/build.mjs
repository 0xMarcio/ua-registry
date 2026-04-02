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

function plainTextPayload(item) {
  return `${item.user_agent}\n`;
}

function plainTextListPayload(items) {
  return `${items.map((item) => item.user_agent).join("\n")}\n`;
}

function buildReadme(collections) {
  const lines = ["# Latest Browser User Agents", ""];

  for (const browser of BROWSER_ORDER) {
    const label = BROWSER_LABELS[browser];
    const items = collections.browserItems[browser];
    lines.push(`## ${label}`);
    lines.push("");

    for (const item of items) {
      lines.push(`### ${item.platform}`);
      lines.push("");
      lines.push("```text");
      lines.push(item.user_agent);
      lines.push("```");
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function buildPublishedResolvedVersions(resolvedVersions) {
  return Object.fromEntries(
    BROWSER_ORDER.map((browser) => [browser, { current: resolvedVersions[browser].current }])
  );
}

function buildPublishedSourceUrls(sourceReferences) {
  return {
    chrome: sourceReferences.chrome,
    edge: sourceReferences.edge,
    firefox: sourceReferences.firefox,
    safari: {
      current_release_notes: sourceReferences.safari.current_release_notes,
      fallback: sourceReferences.safari.fallback,
      release_notes_index: sourceReferences.safari.release_notes_index,
      release_notes_page: sourceReferences.safari.release_notes_page,
      ua_validation_article: sourceReferences.safari.ua_validation_article
    }
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
      path: "api/all",
      group: "global",
      description: "All generated UA strings",
      count: collections.allItems.length,
      format: "text"
    },
    {
      path: "api/desktop.json",
      group: "global",
      description: "All desktop UA entries",
      count: collections.desktopItems.length
    },
    {
      path: "api/desktop",
      group: "global",
      description: "All desktop UA strings",
      count: collections.desktopItems.length,
      format: "text"
    },
    {
      path: "api/mobile.json",
      group: "global",
      description: "All mobile UA entries",
      count: collections.mobileItems.length
    },
    {
      path: "api/mobile",
      group: "global",
      description: "All mobile UA strings",
      count: collections.mobileItems.length,
      format: "text"
    },
  ];

  for (const browser of BROWSER_ORDER) {
    const items = collections.browserItems[browser];
    const desktopItems = items.filter((item) => item.device_class === "desktop");
    const mobileItems = items.filter((item) => item.device_class === "mobile");

    endpoints.push(
      {
        path: `api/${browser}.json`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} current variants`,
        count: items.length
      },
      {
        path: `api/${browser}/desktop`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} desktop UA strings`,
        count: desktopItems.length,
        format: "text"
      },
      {
        path: `api/${browser}/desktop.json`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} desktop variants`,
        count: desktopItems.length
      },
      {
        path: `api/${browser}/mobile`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} mobile UA strings`,
        count: mobileItems.length,
        format: "text"
      },
      {
        path: `api/${browser}/mobile.json`,
        group: browser,
        description: `${BROWSER_LABELS[browser]} mobile variants`,
        count: mobileItems.length
      }
    );

    for (const item of items) {
      endpoints.push(
        {
          path: `api/${browser}/${item.platform}`,
          group: browser,
          description: `${BROWSER_LABELS[browser]} ${item.platform} UA string`,
          count: 1,
          format: "text"
        },
        {
          path: `api/${browser}/${item.platform}.json`,
          group: browser,
          description: `${BROWSER_LABELS[browser]} ${item.platform} UA`,
          count: 1
        }
      );
    }
  }

  endpoints.sort((left, right) => left.path.localeCompare(right.path));

  return {
    generated_at: generatedAt,
    description: "Relative-path manifest for the published static JSON and text endpoints.",
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
  const publishedResolvedVersions = buildPublishedResolvedVersions(resolvedVersions);
  const publishedSourceUrls = buildPublishedSourceUrls(sourceReferences);

  return {
    generated_at: generatedAt,
    build_sha: buildSha ?? null,
    generator_version: GENERATOR_VERSION,
    source_strategy: {
      primary: "Official vendor version feeds plus deterministic UA template generation.",
      fallbacks: [
        "Safari current-version discovery can fall back to browsers.fyi only when Apple release-note parsing does not safely expose the current stable release."
      ]
    },
    source_urls: publishedSourceUrls,
    resolved_versions: publishedResolvedVersions,
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
  const jsonEndpoints = {
    "api/all.json": listPayload(generatedAt, "all", "all", collections.allItems),
    "api/desktop.json": listPayload(generatedAt, "all", "desktop", collections.desktopItems),
    "api/mobile.json": listPayload(generatedAt, "all", "mobile", collections.mobileItems),
    "api/meta.json": meta
  };

  for (const browser of BROWSER_ORDER) {
    const items = collections.browserItems[browser];
    jsonEndpoints[`api/${browser}.json`] = listPayload(generatedAt, browser, "all", items);
    jsonEndpoints[`api/${browser}/desktop.json`] = listPayload(
      generatedAt,
      browser,
      "desktop",
      items.filter((item) => item.device_class === "desktop")
    );
    jsonEndpoints[`api/${browser}/mobile.json`] = listPayload(
      generatedAt,
      browser,
      "mobile",
      items.filter((item) => item.device_class === "mobile")
    );

    for (const item of items) {
      jsonEndpoints[`api/${browser}/${item.platform}.json`] = singlePayload(generatedAt, item);
    }
  }

  jsonEndpoints["api/index.json"] = buildManifest(generatedAt, collections);

  const textEndpoints = Object.fromEntries(
    [
      ["api/all", plainTextListPayload(collections.allItems)],
      ["api/desktop", plainTextListPayload(collections.desktopItems)],
      ["api/mobile", plainTextListPayload(collections.mobileItems)],
      ...BROWSER_ORDER.flatMap((browser) => {
        const items = collections.browserItems[browser];
        const desktopItems = items.filter((item) => item.device_class === "desktop");
        const mobileItems = items.filter((item) => item.device_class === "mobile");

        return [
          [`api/${browser}/desktop`, plainTextListPayload(desktopItems)],
          [`api/${browser}/mobile`, plainTextListPayload(mobileItems)],
          ...items.map((item) => [`api/${browser}/${item.platform}`, plainTextPayload(item)])
        ];
      })
    ]
  );

  return {
    jsonEndpoints,
    textEndpoints
  };
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

  const { jsonEndpoints, textEndpoints } = buildEndpointMap(generatedAt, collections, finalMeta);
  const generatedFiles = {
    "README.md": buildReadme(collections)
  };
  const site = { endpoints: jsonEndpoints, textEndpoints, generatedFiles };

  validateSiteModel(site);
  const changedFiles = await writeSite(docsDirectory, site);

  return {
    changedFiles,
    generatedAt,
    endpoints: jsonEndpoints,
    textEndpoints,
    meta: finalMeta
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await buildProject();
  process.stdout.write(
    `Build completed. Changed files: ${result.changedFiles.length}. Generated at: ${result.generatedAt}\n`
  );
}
