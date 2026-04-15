export const GENERATOR_VERSION = "1.0.0";

export const BROWSER_ORDER = ["chrome", "safari", "edge", "firefox"];

export const BROWSER_LABELS = {
  chrome: "Google Chrome",
  safari: "Apple Safari",
  edge: "Microsoft Edge",
  firefox: "Mozilla Firefox"
};

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
  "Firefox keeps Android as a single mainstream phone variant in config while the generated Android OS token is resolved from Android Developers because Firefox Android UAs reflect the device OS release."
];

export function getVariantConfigSignature() {
  return JSON.stringify({
    browserVariantOrder: BROWSER_VARIANT_ORDER,
    browserVariantFallbacks: BROWSER_VARIANT_FALLBACKS,
    generatorVersion: GENERATOR_VERSION
  });
}
