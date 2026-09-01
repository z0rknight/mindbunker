import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveIntegrityState } from "./core.ts";

test("deriveIntegrityState: INVALID and CORRECTED stay sticky regardless of open/elapsed", () => {
  assert.equal(deriveIntegrityState({ integrityState: "INVALID", endedAt: null, elapsedSeconds: 0 }), "INVALID");
  assert.equal(deriveIntegrityState({ integrityState: "CORRECTED", endedAt: new Date(), elapsedSeconds: 0 }), "CORRECTED");
});
test("deriveIntegrityState: a closed NORMAL session stays NORMAL no matter how long it ran", () => {
  assert.equal(deriveIntegrityState({ integrityState: "NORMAL", endedAt: new Date(), elapsedSeconds: 999999 }), "NORMAL");
});
test("deriveIntegrityState: an open session under 6h is NORMAL", () => {
  assert.equal(deriveIntegrityState({ integrityState: "NORMAL", endedAt: null, elapsedSeconds: 3 * 60 * 60 }), "NORMAL");
});
test("deriveIntegrityState: an open session at or past 6h is STALE", () => {
  assert.equal(deriveIntegrityState({ integrityState: "NORMAL", endedAt: null, elapsedSeconds: 6 * 60 * 60 }), "STALE");
  assert.equal(deriveIntegrityState({ integrityState: "NORMAL", endedAt: null, elapsedSeconds: 7 * 60 * 60 }), "STALE");
});
