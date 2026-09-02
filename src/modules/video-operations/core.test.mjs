import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanOptionalText,
  cleanRequiredText,
  computeChecklistProgress,
  computePromiseAccuracy,
  commitmentChronologyIssue,
  instantToOperatorDateTimeLocal,
  isBlockerCategory,
  isChecklistStatus,
  isFrictionCategory,
  isProductionStep,
  isRevisionCategory,
  isRevisionCause,
  parseOptionalDueAt,
  parseOptionalNonNegativeMinutes,
  operatorLocalDateTimeToIso,
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
  assert.equal(parseOptionalDueAt("2026-09-05T12:00:00"), false);
  assert.equal(
    parseOptionalDueAt("2026-09-05T12:00:00-03:00").toISOString(),
    "2026-09-05T15:00:00.000Z",
  );
});

test("promise datetime-local input becomes an explicit Sao Paulo instant", () => {
  assert.equal(
    operatorLocalDateTimeToIso("2026-09-05T12:30"),
    "2026-09-05T15:30:00.000Z",
  );
  assert.equal(
    instantToOperatorDateTimeLocal("2026-09-05T15:30:00.000Z"),
    "2026-09-05T12:30",
  );
  assert.equal(operatorLocalDateTimeToIso("2026-02-30T12:00"), null);
  assert.equal(operatorLocalDateTimeToIso("2026-09-05 12:00"), null);
});

test("promise conversion is independent of the runtime timezone", () => {
  const previous = process.env.TZ;
  process.env.TZ = "Pacific/Honolulu";
  const honolulu = operatorLocalDateTimeToIso("2026-09-05T12:30");
  process.env.TZ = "Asia/Tokyo";
  const tokyo = operatorLocalDateTimeToIso("2026-09-05T12:30");
  if (previous === undefined) delete process.env.TZ;
  else process.env.TZ = previous;
  assert.equal(honolulu, "2026-09-05T15:30:00.000Z");
  assert.equal(tokyo, honolulu);
});

test("impossible promise chronology is a data issue, not overdue work", () => {
  assert.equal(
    commitmentChronologyIssue({
      createdAt: "2026-09-01T20:38:56.000Z",
      dueAt: "2026-08-31T17:38:00.000Z",
    }),
    "DUE_BEFORE_CREATED",
  );
  assert.equal(
    commitmentChronologyIssue({
      createdAt: "2026-09-01T20:38:56.000Z",
      dueAt: "2026-09-03T12:00:00.000Z",
    }),
    null,
  );
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
