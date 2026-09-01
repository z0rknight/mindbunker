import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanOptionalText,
  cleanRequiredText,
  computeChecklistProgress,
  computePromiseAccuracy,
  isBlockerCategory,
  isChecklistStatus,
  isFrictionCategory,
  isProductionStep,
  isRevisionCategory,
  isRevisionCause,
  parseOptionalDueAt,
  parseOptionalNonNegativeMinutes,
} from "./core.ts";

test("operational vocabularies accept only the promoted finite values", () => {
  assert.equal(isFrictionCategory("FILES"), true);
  assert.equal(isFrictionCategory("RANDOM"), false);
  assert.equal(isBlockerCategory("PAYMENT"), true);
  assert.equal(isBlockerCategory("FRICTION"), false);
  assert.equal(isProductionStep("QA"), true);
  assert.equal(isChecklistStatus("NOT_REQUIRED"), true);
  assert.equal(isRevisionCause("OUR_ERROR"), true);
  assert.equal(isRevisionCategory("TECHNICAL"), true);
  assert.equal(isRevisionCause("CLIENT"), false);
});

test("text and minute validation rejects bureaucratic garbage cleanly", () => {
  assert.deepEqual(cleanRequiredText("  ship cut  ", "Commitment", 20), {
    success: true,
    value: "ship cut",
  });
  assert.equal(cleanRequiredText(" ", "Commitment", 20).success, false);
  assert.equal(cleanOptionalText("  note  ", 20), "note");
  assert.equal(cleanOptionalText("", 20), null);
  assert.equal(parseOptionalNonNegativeMinutes("42"), 42);
  assert.equal(parseOptionalNonNegativeMinutes("-1"), false);
  assert.equal(parseOptionalNonNegativeMinutes("1.5"), false);
});

test("promise accuracy reports raw evidence counts without percentages", () => {
  const due = new Date("2026-09-05T12:00:00Z");
  assert.deepEqual(
    computePromiseAccuracy([
      { dueAt: due, deliveredAt: new Date("2026-09-05T11:00:00Z") },
      { dueAt: due, deliveredAt: new Date("2026-09-05T13:00:00Z") },
      { dueAt: null, deliveredAt: new Date("2026-09-05T10:00:00Z") },
    ]),
    { sampleCount: 2, onTimeCount: 1, lateCount: 1 },
  );
  assert.equal(parseOptionalDueAt("not-a-date"), false);
});

test("empty checklist is unknown, not falsely complete", () => {
  assert.deepEqual(computeChecklistProgress([]), {
    done: 0,
    applicable: 0,
    complete: false,
  });
  assert.deepEqual(
    computeChecklistProgress([
      { status: "DONE" },
      { status: "NOT_REQUIRED" },
      { status: "NOT_STARTED" },
    ]),
    { done: 1, applicable: 2, complete: false },
  );
});
