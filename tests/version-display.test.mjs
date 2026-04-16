import assert from "node:assert/strict";
import test from "node:test";
import { formatDisplayVersion } from "../scripts/version-display.mjs";

test("formatDisplayVersion omits only trailing .0 segments", () => {
  assert.equal(formatDisplayVersion("147"), "147");
  assert.equal(formatDisplayVersion("149.0"), "149");
  assert.equal(formatDisplayVersion("26.4"), "26.4");
  assert.equal(formatDisplayVersion("115.34.0"), "115.34");
});
