import assert from "node:assert/strict";
import test from "node:test";

import {
  daysAgoISO,
  formatOperatorTime,
  inclusiveWindowStartISO,
  operatorDateKey,
  operatorMonthProgress,
  previousMonthComparableRangeISO,
  previousMonthRangeISO,
  startOfMonthISO,
  todayISO,
} from "./date.ts";

test("23:30 in Sao Paulo stays on the operator's local calendar day", () => {
  assert.equal(operatorDateKey("2026-09-01T02:30:00.000Z"), "2026-08-31");
});

test("inclusive seven-day windows contain today plus exactly six prior dates", () => {
  const now = new Date("2026-09-01T12:00:00.000Z");
  assert.equal(inclusiveWindowStartISO(7, now), "2026-08-26");
  assert.throws(() => inclusiveWindowStartISO(0, now), /positive integer/);
});

test("month comparisons use the same elapsed operator-calendar days", () => {
  assert.deepEqual(
    previousMonthComparableRangeISO(new Date("2026-09-01T12:00:00.000Z")),
    { start: "2026-08-01", end: "2026-08-01" },
  );
  assert.deepEqual(
    previousMonthComparableRangeISO(new Date("2026-03-31T12:00:00.000Z")),
    { start: "2026-02-01", end: "2026-02-28" },
  );
});

test("UTC midnight does not silently move an operator event to tomorrow", () => {
  assert.equal(operatorDateKey("2026-09-01T00:00:00.000Z"), "2026-08-31");
});

test("Sao Paulo local midnight starts the next operator day", () => {
  assert.equal(operatorDateKey("2026-09-01T03:00:00.000Z"), "2026-09-01");
});

test("month boundaries and calendar subtraction use America/Sao_Paulo", () => {
  const beforeLocalMidnight = new Date("2026-09-01T02:59:59.000Z");
  assert.equal(todayISO(beforeLocalMidnight), "2026-08-31");
  assert.equal(startOfMonthISO(beforeLocalMidnight), "2026-08-01");
  assert.equal(daysAgoISO(1, beforeLocalMidnight), "2026-08-30");
  assert.deepEqual(previousMonthRangeISO(beforeLocalMidnight), {
    start: "2026-07-01",
    end: "2026-07-31",
  });
  assert.deepEqual(operatorMonthProgress(beforeLocalMidnight), {
    dayOfMonth: 31,
    daysInMonth: 31,
  });
});

// Global Health Audit — War Room hydration P0 (React #418): the bug was
// two different runtimes computing different text for the same instant
// because neither called out an explicit timeZone. This test pins
// formatOperatorTime's output for a fixed instant so a regression that
// reintroduces a bare toLocaleTimeString()-style call (implicitly using
// whatever timezone the test runner's own host happens to be in) fails
// here instead of only showing up as a live-site hydration mismatch.
test("formatOperatorTime is stable for a fixed instant regardless of host timezone", () => {
  const instant = "2026-09-01T23:58:01.000Z";
  assert.equal(formatOperatorTime(instant), "08:58:01 PM");
  assert.equal(formatOperatorTime(new Date(instant)), "08:58:01 PM");
});
