import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_ITEM_KEYS = [
  "label",
  "browser",
  "platform",
  "device_class",
  "track",
  "version",
  "user_agent"
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateItem(item, context) {
  for (const key of REQUIRED_ITEM_KEYS) {
    invariant(typeof item[key] === "string" && item[key].length > 0, `${context} is missing "${key}".`);
  }

  invariant(
    item.user_agent.startsWith("Mozilla/5.0"),
    `${context} must begin with "Mozilla/5.0".`
  );
}

function validateListEndpoint(pathname, payload) {
  invariant(Array.isArray(payload.items), `${pathname} must contain an "items" array.`);
  invariant(payload.count === payload.items.length, `${pathname} count does not match items.length.`);
  payload.items.forEach((item, index) => validateItem(item, `${pathname} item ${index}`));
}

function validateSingleItemEndpoint(pathname, payload) {
  validateItem(payload, pathname);
}

export function validateSiteModel(site) {
  const endpointEntries = Object.entries(site.endpoints);
  invariant(endpointEntries.length > 0, "No endpoints were generated.");

  for (const [pathname, payload] of endpointEntries) {
    invariant(pathname.endsWith(".json"), `${pathname} must end in .json.`);

    if (pathname === "api/index.json") {
      invariant(Array.isArray(payload.endpoints), "api/index.json must contain an endpoints array.");
      continue;
    }

    if (pathname === "api/meta.json") {
      invariant(typeof payload.generated_at === "string", "api/meta.json must include generated_at.");
      continue;
    }

    if (Array.isArray(payload.items)) {
      validateListEndpoint(pathname, payload);

      if (/api\/(chrome|safari|edge|firefox)\.json$/.test(pathname)) {
        const uniqueUserAgents = new Set(payload.items.map((item) => item.user_agent));
        invariant(
          uniqueUserAgents.size === payload.items.length,
          `${pathname} contains duplicate user-agent strings.`
        );
      }

      for (const item of payload.items) {
        invariant(item.track === "current", `${pathname} should only expose current variants.`);
      }

      continue;
    }

    validateSingleItemEndpoint(pathname, payload);
    invariant(payload.track === "current", `${pathname} should only expose current variants.`);
  }

  const manifest = site.endpoints["api/index.json"];
  invariant(manifest, "api/index.json was not generated.");

  for (const entry of manifest.endpoints) {
    const existsInJson = Object.prototype.hasOwnProperty.call(site.endpoints, entry.path);
    const existsInText = Object.prototype.hasOwnProperty.call(site.textEndpoints ?? {}, entry.path);
    invariant(existsInJson || existsInText, `Manifest entry ${entry.path} does not point to a generated endpoint.`);
  }

  for (const [pathname, content] of Object.entries(site.textEndpoints ?? {})) {
    invariant(typeof content === "string" && content.length > 0, `${pathname} must be plain text.`);
    const lines = content.trim().split("\n");
    invariant(lines.length > 0, `${pathname} must contain at least one UA string.`);

    for (const line of lines) {
      invariant(line.startsWith("Mozilla/5.0"), `${pathname} contains an invalid UA string.`);
    }
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

export async function validateOutputDirectory(rootDirectory) {
  const apiDirectory = path.join(rootDirectory, "api");
  const files = await walk(apiDirectory);
  const endpoints = {};
  const textEndpoints = {};

  for (const filePath of files) {
    const relativePath = path.relative(rootDirectory, filePath).replaceAll(path.sep, "/");

    if (filePath.endsWith(".json")) {
      endpoints[relativePath] = JSON.parse(await readFile(filePath, "utf8"));
      continue;
    }

    textEndpoints[relativePath] = await readFile(filePath, "utf8");
  }

  validateSiteModel({ endpoints, textEndpoints });
  return { endpoints, textEndpoints };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const docsDirectory = path.resolve(currentDirectory, "..", "docs");
  await validateOutputDirectory(docsDirectory);
  process.stdout.write("Validation passed.\n");
}
