import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDataCoverage, computeEffectiveRate } from "./core.ts";

test("classifyDataCoverage: zero valid closed sessions is LOW even with stale/invalid noise", () => {
  assert.equal(classifyDataCoverage({ validClosedSessionCount: 0, totalTrackedSeconds: 0, staleOrInvalidCount: 2 }), "LOW");
});

test("classifyDataCoverage: Dave-like fixture -- 2 valid sessions, 2.5h -- is MEDIUM, not HIGH (needs 3+ sessions for HIGH)", () => {
  assert.equal(classifyDataCoverage({ validClosedSessionCount: 2, totalTrackedSeconds: 9000, staleOrInvalidCount: 0 }), "MEDIUM");
});

test("classifyDataCoverage: one 4-hour session alone is MEDIUM -- substantial time, but HIGH requires multiple sessions", () => {
  assert.equal(classifyDataCoverage({ validClosedSessionCount: 1, totalTrackedSeconds: 4 * 3600, staleOrInvalidCount: 0 }), "MEDIUM");
});

test("classifyDataCoverage: one 4-minute session is LOW -- too little duration to count as real evidence", () => {
  assert.equal(classifyDataCoverage({ validClosedSessionCount: 1, totalTrackedSeconds: 4 * 60, staleOrInvalidCount: 0 }), "LOW");
});

test("classifyDataCoverage: a stale session present caps coverage below HIGH even with otherwise-strong evidence", () => {
  assert.equal(classifyDataCoverage({ validClosedSessionCount: 5, totalTrackedSeconds: 10 * 3600, staleOrInvalidCount: 1 }), "MEDIUM");
});

test("classifyDataCoverage: an invalid session alone (no valid closed sessions) is LOW", () => {
  assert.equal(classifyDataCoverage({ validClosedSessionCount: 0, totalTrackedSeconds: 0, staleOrInvalidCount: 1 }), "LOW");
});

test("classifyDataCoverage: 3+ valid sessions, 3+ hours, no integrity flags is HIGH", () => {
  assert.equal(classifyDataCoverage({ validClosedSessionCount: 3, totalTrackedSeconds: 3 * 3600, staleOrInvalidCount: 0 }), "HIGH");
});

test("computeEffectiveRate: null when no tracked time (avoid divide by zero)", () => {
  assert.equal(computeEffectiveRate(10000, 0), null);
});
test("computeEffectiveRate: $100 over 2 hours is $50/hr", () => {
  assert.equal(computeEffectiveRate(10000, 7200), 50);
});
