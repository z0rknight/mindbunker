import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WORK_SESSION_ACTIVITY,
  WORK_SESSION_ACTIVITY_TYPES,
  formatClosedDuration,
  isWorkSessionActivityType,
  isWorkSessionVideoId,
  toUnixSeconds,
} from "./core.ts";

test("the approved activity vocabulary validates explicitly", () => {
  assert.equal(DEFAULT_WORK_SESSION_ACTIVITY, "EDITING");
  assert.deepEqual(WORK_SESSION_ACTIVITY_TYPES, [
    "EDITING",
    "MOTION_GRAPHICS",
    "COLOR",
    "AUDIO",
    "REVIEW",
    "EXPORT",
    "ADMIN",
    "OTHER",
  ]);
  for (const activity of WORK_SESSION_ACTIVITY_TYPES) {
    assert.equal(isWorkSessionActivityType(activity), true);
  }
  assert.equal(isWorkSessionActivityType("SURVEILLANCE"), false);
  assert.equal(isWorkSessionActivityType("editing"), false);
});

test("work-session identifiers and server timestamps fail closed", () => {
  assert.equal(isWorkSessionVideoId(1), true);
  assert.equal(isWorkSessionVideoId(0), false);
  assert.equal(isWorkSessionVideoId(1.5), false);
  assert.equal(isWorkSessionVideoId("1"), false);
  assert.equal(toUnixSeconds(new Date("2026-08-22T12:00:00.999Z")), 1_787_400_000);
});

test("closed production time uses the compact operator format", () => {
  assert.equal(formatClosedDuration(0), "0m");
  assert.equal(formatClosedDuration(30), "<1m");
  assert.equal(formatClosedDuration(3_599), "59m");
  assert.equal(formatClosedDuration(6_138), "1h 42m");
});
