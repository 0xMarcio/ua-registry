export const SAFARI_RULES_VERSION = "2026-04-15";

export const SAFARI_RULES_NOTES = [
  "Safari on macOS keeps the frozen Macintosh platform token and Safari/605.1.15.",
  "Safari on iPhone and iPad uses the latest stable iOS/iPadOS release line prior to the current Safari cycle as a frozen compatibility token rather than mirroring the current OS release number.",
  "The generated iPad variant intentionally uses the mobile Safari token so the public top-five set contains a unique and immediately useful iPad UA."
];

const DESKTOP_PLATFORM = "Macintosh; Intel Mac OS X 10_15_7";
const WEBKIT = "AppleWebKit/605.1.15 (KHTML, like Gecko)";
const DESKTOP_SAFARI = "Safari/605.1.15";
const MOBILE_SAFARI = "Mobile/15E148 Safari/604.1";
const DEFAULT_IOS_IPADOS_COMPAT_VERSION = "18.6";

function normalizeSafariVersion(version) {
  if (/^\d+$/.test(version)) {
    return `${version}.0`;
  }

  return version;
}

function safariMobileCompatToken(version) {
  return String(version).replaceAll(".", "_");
}

export function buildSafariUserAgent({
  platform,
  version,
  iosIpadosCompatVersion = DEFAULT_IOS_IPADOS_COMPAT_VERSION
}) {
  const safariVersion = normalizeSafariVersion(version);
  const compatToken = safariMobileCompatToken(iosIpadosCompatVersion);

  if (platform === "macos") {
    return [
      `Mozilla/5.0 (${DESKTOP_PLATFORM})`,
      WEBKIT,
      `Version/${safariVersion}`,
      DESKTOP_SAFARI
    ].join(" ");
  }

  if (platform === "iphone") {
    return [
      `Mozilla/5.0 (iPhone; CPU iPhone OS ${compatToken} like Mac OS X)`,
      WEBKIT,
      `Version/${safariVersion}`,
      MOBILE_SAFARI
    ].join(" ");
  }

  if (platform === "ipad-mobile") {
    return [
      `Mozilla/5.0 (iPad; CPU OS ${compatToken} like Mac OS X)`,
      WEBKIT,
      `Version/${safariVersion}`,
      MOBILE_SAFARI
    ].join(" ");
  }

  throw new Error(`Unsupported Safari platform: ${platform}`);
}
