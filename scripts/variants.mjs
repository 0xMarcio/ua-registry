export const GENERATOR_VERSION = "1.0.0";

export const BROWSER_ORDER = ["chrome", "safari", "edge", "firefox"];

export const BROWSER_LABELS = {
  chrome: "Google Chrome",
  safari: "Apple Safari",
  edge: "Microsoft Edge",
  firefox: "Mozilla Firefox"
};

export const FIREFOX_ANDROID_VERSION = "15";

export const BROWSER_VARIANT_ORDER = {
  chrome: ["current-windows", "current-macos", "current-linux", "current-android"],
  safari: ["current-macos", "current-iphone", "current-ipad-mobile"],
  edge: ["current-windows", "current-macos", "current-linux", "current-android"],
  firefox: [
    "current-windows",
    "current-macos",
    "current-linux",
    "current-android",
    "current-ubuntu"
  ]
};

// The fallback pools are intentionally small and browser-local so a duplicate
// can be replaced without touching generator logic.
export const BROWSER_VARIANT_FALLBACKS = {
  chrome: ["current-windows", "current-macos", "current-linux", "current-android"],
  safari: ["current-macos", "current-iphone", "current-ipad-mobile"],
  edge: ["current-windows", "current-macos", "current-linux", "current-android"],
  firefox: [
    "current-windows",
    "current-macos",
    "current-linux",
    "current-android",
    "current-ubuntu"
  ]
};

export const VARIANT_CONFIG_NOTES = [
  "Each browser-specific endpoint contains current variants only.",
  "If a slot would duplicate an already chosen UA, the generator walks that browser's fallback pool until it finds a unique replacement.",
  "Firefox keeps Android as a fixed mainstream phone variant in config because Mozilla's release feeds do not publish a preferred Android OS token."
];

export function getVariantConfigSignature() {
  return JSON.stringify({
    browserVariantOrder: BROWSER_VARIANT_ORDER,
    browserVariantFallbacks: BROWSER_VARIANT_FALLBACKS,
    firefoxAndroidVersion: FIREFOX_ANDROID_VERSION,
    generatorVersion: GENERATOR_VERSION
  });
}
