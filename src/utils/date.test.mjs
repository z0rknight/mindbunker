import assert from "node:assert/strict";
import test from "node:test";

import {
  daysAgoISO,
  operatorDateKey,
  operatorMonthProgress,
  previousMonthRangeISO,
  startOfMonthISO,
  todayISO,
} from "./date.ts";

test("23:30 in Sao Paulo stays on the operator's local calendar day", () => {
  assert.equal(operatorDateKey("2026-09-01T02:30:00.000Z"), "2026-08-31");
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
