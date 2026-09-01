import { test } from "node:test";
import assert from "node:assert/strict";
import { countsTowardRevenue, isVideoKind } from "./core.ts";

test("countsTowardRevenue: CLIENT_WORK counts", () => {
  assert.equal(countsTowardRevenue("CLIENT_WORK"), true);
});
test("countsTowardRevenue: SAMPLE_VIDEO never counts, even if fixed-price fields are set", () => {
  assert.equal(countsTowardRevenue("SAMPLE_VIDEO"), false);
});
test("countsTowardRevenue: INTERNAL never counts", () => {
  assert.equal(countsTowardRevenue("INTERNAL"), false);
});
test("isVideoKind: rejects garbage", () => {
  assert.equal(isVideoKind("MADE_UP"), false);
  assert.equal(isVideoKind("SAMPLE_VIDEO"), true);
});
