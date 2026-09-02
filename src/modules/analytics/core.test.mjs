import assert from "node:assert/strict";
import test from "node:test";

import {
  computeConsistencyStreak,
  consistencyStreakFromSessions,
  computeGoalProgress,
  growthByCurrency,
  hasComparableTrendSample,
  isActiveExternalClient,
  sumIncomeByCurrency,
} from "./core.ts";

test("income totals remain separated by currency", () => {
  assert.deepEqual(sumIncomeByCurrency([
    { type: "income", amount: 100, currency: "USD" },
    { type: "income", amount: 200, currency: "BRL" },
    { type: "income", amount: 50, currency: "usd" },
  ]), [
    { currency: "BRL", amount: 200 },
    { currency: "USD", amount: 150 },
  ]);
});

test("goal progress uses only the goal currency for BRL and USD", () => {
  const revenues = [{ currency: "BRL", amount: 2_000 }, { currency: "USD", amount: 9_000 }];
  assert.deepEqual(computeGoalProgress({
    revenueByCurrency: revenues,
    goalAmount: 20_000,
    goalCurrency: "BRL",
    dayOfMonth: 10,
    daysInMonth: 20,
  }), { comparisonAvailable: true, revenue: 2_000, pct: 10, onTrack: false });
  assert.equal(computeGoalProgress({
    revenueByCurrency: revenues,
    goalAmount: 10_000,
    goalCurrency: "USD",
    dayOfMonth: 10,
    daysInMonth: 20,
  }).revenue, 9_000);
});

test("a target with only incompatible revenue fails closed", () => {
  const result = computeGoalProgress({
    revenueByCurrency: [{ currency: "USD", amount: 50_000 }],
    goalAmount: 20_000,
    goalCurrency: "BRL",
    dayOfMonth: 1,
    daysInMonth: 30,
  });
  assert.deepEqual(result, {
    comparisonAvailable: false,
    revenue: null,
    pct: null,
    onTrack: null,
  });
});

test("zero values remain honest and a missing goal currency fails closed", () => {
  assert.equal(computeGoalProgress({
    revenueByCurrency: [{ currency: "BRL", amount: 0 }], goalAmount: 20_000, goalCurrency: "BRL", dayOfMonth: 1, daysInMonth: 31,
  }).revenue, 0);
  assert.deepEqual(computeGoalProgress({
    revenueByCurrency: [], goalAmount: 20_000, goalCurrency: "", dayOfMonth: 1, daysInMonth: 31,
  }), { comparisonAvailable: false, revenue: null, pct: null, onTrack: null });
});

test("growth compares each currency only with itself", () => {
  assert.deepEqual(growthByCurrency(
    [{ currency: "BRL", amount: 200 }, { currency: "USD", amount: 100 }],
    [{ currency: "BRL", amount: 100 }, { currency: "USD", amount: 200 }],
  ), [
    { currency: "BRL", amount: 200, previousAmount: 100, growthPct: 100 },
    { currency: "USD", amount: 100, previousAmount: 200, growthPct: -50 },
  ]);
});

test("growth is unavailable without a prior-period baseline", () => {
  assert.deepEqual(growthByCurrency(
    [{ currency: "USD", amount: 100 }],
    [],
  ), [
    { currency: "USD", amount: 100, previousAmount: 0, growthPct: null },
  ]);
});

test("very early month comparisons fail closed instead of producing dramatic percentages", () => {
  assert.equal(hasComparableTrendSample(1), false);
  assert.equal(hasComparableTrendSample(2), false);
  assert.equal(hasComparableTrendSample(3), true);
});

test("consistency streak uses closed-session date keys and may end yesterday", () => {
  assert.equal(computeConsistencyStreak(["2026-08-28", "2026-08-27", "2026-08-26"], "2026-08-28"), 3);
  assert.equal(computeConsistencyStreak(["2026-08-27", "2026-08-26"], "2026-08-28"), 2);
  assert.equal(computeConsistencyStreak(["2026-08-26"], "2026-08-28"), 0);
  assert.equal(computeConsistencyStreak([], "2026-08-28"), 0);
});

test("consistency streak ignores open sessions and uses Sao Paulo civil dates", () => {
  const now = new Date("2026-09-01T03:30:00.000Z");
  assert.equal(consistencyStreakFromSessions([
    { startedAt: "2026-09-01T02:30:00.000Z", endedAt: "2026-09-01T02:45:00.000Z" },
    { startedAt: "2026-09-01T03:10:00.000Z", endedAt: null },
  ], now), 1);
});

test("active clients exclude Geladeira, inactive, leads, and RMEDIA", () => {
  assert.equal(isActiveExternalClient({ name: "Taryn", status: "active", archivalState: "ACTIVE_SURFACE" }), true);
  assert.equal(isActiveExternalClient({ name: "Taryn", status: "active", archivalState: "GELADEIRA" }), false);
  assert.equal(isActiveExternalClient({ name: "Taryn", status: "lead", archivalState: "ACTIVE_SURFACE" }), false);
  assert.equal(isActiveExternalClient({ name: "RMEDIA", status: "active", archivalState: "ACTIVE_SURFACE" }), false);
});
