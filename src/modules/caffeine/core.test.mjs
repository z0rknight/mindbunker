import assert from "node:assert/strict";
import test from "node:test";

import {
  caffeineDayKey,
  mondayOfWeek,
  daysInWeekOf,
  sumCaffeineForDays,
  computeCaffeineSummary,
  resolveCaffeineTodayDisplay,
} from "./core.ts";

test("caffeineDayKey buckets by America/Sao_Paulo day, not UTC day", () => {
  // 2026-08-24T02:30:00Z is still 2026-08-23 23:30 in America/Sao_Paulo (UTC-3).
  assert.strictEqual(caffeineDayKey("2026-08-24T02:30:00.000Z"), "2026-08-23");
  // 2026-08-24T15:00:00Z is 2026-08-24 12:00 in America/Sao_Paulo.
  assert.strictEqual(caffeineDayKey("2026-08-24T15:00:00.000Z"), "2026-08-24");
});

test("mondayOfWeek finds the Monday on or before a given day", () => {
  assert.strictEqual(mondayOfWeek("2026-08-24"), "2026-08-24"); // a Monday
  assert.strictEqual(mondayOfWeek("2026-08-27"), "2026-08-24"); // Thursday
  assert.strictEqual(mondayOfWeek("2026-08-23"), "2026-08-17"); // Sunday -> prior Monday
});

test("daysInWeekOf returns all 7 days Monday-first", () => {
  assert.deepEqual(daysInWeekOf("2026-08-27"), [
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
    "2026-08-27",
    "2026-08-28",
    "2026-08-29",
    "2026-08-30",
  ]);
});

test("sumCaffeineForDays sums only the requested days, treating missing days as 0", () => {
  const counts = { "2026-08-24": 2, "2026-08-26": 1 };
  assert.strictEqual(
    sumCaffeineForDays(counts, ["2026-08-24", "2026-08-25", "2026-08-26"]),
    3,
  );
});

test("computeCaffeineSummary: today count and week count", () => {
  const counts = {
    "2026-08-17": 5, // last week, must not count
    "2026-08-24": 3, // Monday this week
    "2026-08-26": 2, // Wednesday this week
    "2026-08-27": 1, // today
  };
  const summary = computeCaffeineSummary(counts, "2026-08-27");
  assert.strictEqual(summary.todayCount, 1);
  assert.strictEqual(summary.weekCount, 6); // 3 + 2 + 1, excludes last week's 5
});

test("computeCaffeineSummary: a day with zero events is 0, not undefined/null", () => {
  const summary = computeCaffeineSummary({}, "2026-08-27");
  assert.strictEqual(summary.todayCount, 0);
  assert.strictEqual(summary.weekCount, 0);
});

// Taryn August Ingest Readiness §17: regression coverage for the Dashboard
// "Caffeine Today" root cause -- a quick-logged coffee (servings, no
// manual health_logs.caffeineMg entry) must move this number, not just
// the War Room monthly total.
test("resolveCaffeineTodayDisplay: a quick-logged coffee with no manual entry still registers", () => {
  assert.strictEqual(resolveCaffeineTodayDisplay(null, 1), 90);
  assert.strictEqual(resolveCaffeineTodayDisplay(null, 2), 180);
});

test("resolveCaffeineTodayDisplay: nothing recorded either way is null, not 0", () => {
  assert.strictEqual(resolveCaffeineTodayDisplay(null, 0), null);
});

test("resolveCaffeineTodayDisplay: a manual entry higher than the quick-log estimate wins, never summed", () => {
  assert.strictEqual(resolveCaffeineTodayDisplay(300, 1), 300);
});

test("resolveCaffeineTodayDisplay: a quick-log estimate higher than a small manual entry wins", () => {
  assert.strictEqual(resolveCaffeineTodayDisplay(50, 1), 90);
});
