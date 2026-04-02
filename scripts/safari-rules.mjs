export const SAFARI_RULES_VERSION = "2026-04-02";

export const SAFARI_RULES_NOTES = [
  "Safari on macOS keeps the frozen Macintosh platform token and Safari/605.1.15.",
  "Safari on iPhone and iPad uses fixed iOS 18_6 platform tokens for the Safari 26 cycle rather than mirroring the current OS release number.",
  "The generated iPad variant intentionally uses the mobile Safari token so the public top-five set contains a unique and immediately useful iPad UA."
];

const DESKTOP_PLATFORM = "Macintosh; Intel Mac OS X 10_15_7";
const IPHONE_PLATFORM = "iPhone; CPU iPhone OS 18_6 like Mac OS X";
const IPAD_PLATFORM = "iPad; CPU OS 18_6 like Mac OS X";
const WEBKIT = "AppleWebKit/605.1.15 (KHTML, like Gecko)";
const DESKTOP_SAFARI = "Safari/605.1.15";
const MOBILE_SAFARI = "Mobile/15E148 Safari/604.1";

function normalizeSafariVersion(version) {
  if (/^\d+$/.test(version)) {
    return `${version}.0`;
  }

  return version;
}

export function buildSafariUserAgent({ platform, version }) {
  const safariVersion = normalizeSafariVersion(version);

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
      `Mozilla/5.0 (${IPHONE_PLATFORM})`,
      WEBKIT,
      `Version/${safariVersion}`,
      MOBILE_SAFARI
    ].join(" ");
  }

  if (platform === "ipad-mobile") {
    return [
      `Mozilla/5.0 (${IPAD_PLATFORM})`,
      WEBKIT,
      `Version/${safariVersion}`,
      MOBILE_SAFARI
    ].join(" ");
  }

  throw new Error(`Unsupported Safari platform: ${platform}`);
}
