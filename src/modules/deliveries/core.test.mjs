import { test } from "node:test";
import assert from "node:assert/strict";
import { computePromiseAccuracy } from "./core.ts";

test("computePromiseAccuracy: empty sample gives null average, zero counts", () => {
  const r = computePromiseAccuracy([]);
  assert.equal(r.sampleCount, 0);
  assert.equal(r.avgDeltaSeconds, null);
});

test("computePromiseAccuracy: on-time delivery has delta <= 0", () => {
  const r = computePromiseAccuracy([-3600, 0]);
  assert.equal(r.onTimeCount, 2);
  assert.equal(r.lateCount, 0);
});

test("computePromiseAccuracy: late delivery has positive delta, counted separately from on-time", () => {
  const r = computePromiseAccuracy([3600, -100]);
  assert.equal(r.onTimeCount, 1);
  assert.equal(r.lateCount, 1);
  assert.equal(r.avgDeltaSeconds, 1750);
});
