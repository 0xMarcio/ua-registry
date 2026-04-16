export function formatDisplayVersion(version) {
  return String(version).replace(/(?:\.0)+$/, "");
}
