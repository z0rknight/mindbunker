import assert from "node:assert/strict";
import test from "node:test";

import {
  caffeineDayKey,
  mondayOfWeek,
  daysInWeekOf,
  sumCaffeineForDays,
  computeCaffeineSummary,
  resolveCaffeineTodayDisplay,
  computeCoffeesPerVideo,
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

test("computeCaffeineSummary: no event evidence remains unknown", () => {
  const summary = computeCaffeineSummary({}, "2026-08-27");
  assert.strictEqual(summary.todayCount, null);
  assert.strictEqual(summary.weekCount, null);
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

test("resolveCaffeineTodayDisplay: a precise manual entry overrides the quick-log estimate", () => {
  assert.strictEqual(resolveCaffeineTodayDisplay(50, 1), 50);
});

// NIGHT SHIFT REALITY PATCH -- P0 regression coverage for the exact root
// cause: getCaffeineSummary() used to compute todayKey via
// caffeineDayKey(nowBrazil().toISOString()). nowBrazil() already returns a
// Date whose UTC-labeled ISO string reads as Brazil's wall clock (a -3h
// fake shift); caffeineDayKey() then does its OWN correct
// America/Sao_Paulo conversion on top of whatever it's given. Feeding it
// nowBrazil()'s pre-shifted value double-shifts by another 3 hours. This
// test proves the double-shift lands on the wrong calendar day right
// after midnight, and that feeding caffeineDayKey the real UTC instant
// directly (the fix applied in actions.ts) does not.
test("BUG regression: double-shifting nowBrazil()'s value through caffeineDayKey lands on the wrong day just after midnight", () => {
  // Real UTC instant 2026-08-25T05:18:00Z = Brazil local 2026-08-25T02:18 --
  // just after midnight, a brand new Brazil calendar day.
  const realUtcNow = "2026-08-25T05:18:00.000Z";

  // Correct: feed caffeineDayKey the real UTC instant directly (the fix).
  const correctTodayKey = caffeineDayKey(realUtcNow);
  assert.strictEqual(correctTodayKey, "2026-08-25");

  // Buggy: simulate the old call site, which fed caffeineDayKey the output
  // of nowBrazil() -- itself already (realUtcNow - 3h), relabeled as UTC.
  const nowBrazilHackedIso = new Date(
    new Date(realUtcNow).getTime() - 3 * 60 * 60 * 1000,
  ).toISOString();
  const buggyTodayKey = caffeineDayKey(nowBrazilHackedIso);
  assert.strictEqual(buggyTodayKey, "2026-08-24"); // wrong: still "yesterday"
  assert.notStrictEqual(buggyTodayKey, correctTodayKey);
});

test("BUG regression: computeCaffeineSummary with the correct today key does not fold yesterday's count into today's", () => {
  // Taryn brief's own example shape: yesterday had 7 servings, today has 2.
  const counts = { "2026-08-24": 7, "2026-08-25": 2 };
  const summary = computeCaffeineSummary(counts, "2026-08-25");
  assert.strictEqual(summary.todayCount, 2); // not 9, not 7
});

test("BUG regression: an event at 23:59 local and one at 00:01 local land on different day keys", () => {
  // 2026-08-25T02:59:00Z = Brazil 2026-08-24T23:59 (still Aug 24 local).
  assert.strictEqual(caffeineDayKey("2026-08-25T02:59:00.000Z"), "2026-08-24");
  // 2026-08-25T03:01:00Z = Brazil 2026-08-25T00:01 (new day, Aug 25 local).
  assert.strictEqual(caffeineDayKey("2026-08-25T03:01:00.000Z"), "2026-08-25");
});

test("BUG regression: yesterday's historical count is untouched after computing today's summary (no destructive reset)", () => {
  const counts = { "2026-08-24": 7, "2026-08-25": 2 };
  computeCaffeineSummary(counts, "2026-08-25");
  // computeCaffeineSummary must be a pure read: caffeine events are
  // immutable facts and "today" is only ever a projection over them --
  // nothing about resolving today's count may zero out, delete, or
  // otherwise mutate any other day's historical figure.
  assert.strictEqual(counts["2026-08-24"], 7);
  assert.strictEqual(counts["2026-08-25"], 2);
});

test("BUG regression: month/year-old history survives alongside today, undisturbed", () => {
  const counts = {
    "2025-09-03": 5, // over a year old
    "2026-06-15": 3, // a few months old
    "2026-08-24": 7, // yesterday
    "2026-08-25": 2, // today
  };
  const summary = computeCaffeineSummary(counts, "2026-08-25");
  assert.strictEqual(summary.todayCount, 2);
  assert.strictEqual(counts["2025-09-03"], 5);
  assert.strictEqual(counts["2026-06-15"], 3);
  assert.strictEqual(counts["2026-08-24"], 7);
});

// Lunch Reality Patch P1 §6: coffees-per-completed-video ratio, replacing
// the old mg/R$ "Caffeine Ratio" card.
test("computeCoffeesPerVideo: a worked example -- 12 coffees across 5 completed videos", () => {
  assert.strictEqual(computeCoffeesPerVideo(12, 5), 2.4);
});

test("computeCoffeesPerVideo: zero completed videos is null, not a divide-by-zero or a fake 0", () => {
  assert.strictEqual(computeCoffeesPerVideo(0, 0), null);
  assert.strictEqual(computeCoffeesPerVideo(9, 0), null);
});

test("computeCoffeesPerVideo: zero coffees with real video output is an honest 0, not null", () => {
  assert.strictEqual(computeCoffeesPerVideo(0, 3), 0);
});

test("computeCoffeesPerVideo: rounds to 2 decimal places", () => {
  assert.strictEqual(computeCoffeesPerVideo(10, 3), 3.33);
});
