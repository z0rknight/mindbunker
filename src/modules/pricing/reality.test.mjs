import assert from "node:assert/strict";
import test from "node:test";

import { classifyPricingEvidence, describePricingEvidence, selectPricingReality } from "./reality.ts";

test("pricing evidence stays low-confidence with fewer than four completed samples", () => {
  assert.equal(classifyPricingEvidence(0), "LOW");
  assert.equal(classifyPricingEvidence(3), "LOW");
  assert.match(describePricingEvidence(1, 1), /reality check, not a pricing rule/);
});

test("pricing evidence confidence is driven by completed, not active, samples", () => {
  assert.equal(classifyPricingEvidence(4), "MEDIUM");
  assert.equal(classifyPricingEvidence(10), "HIGH");
  assert.match(describePricingEvidence(4, 20), /never changes the estimate automatically/);
});

test("pricing evidence follows the calculator content type", () => {
  const rows = [
    { videoId: 1, contentType: "short-form", status: "DONE" },
    { videoId: 2, contentType: "long-form", status: "IN_PROGRESS" },
    { videoId: 3, contentType: "other", status: "DONE" },
  ];
  const reality = { rows, completedSampleCount: 2, activeSampleCount: 1, confidence: "LOW", note: "all" };
  const short = selectPricingReality(reality, "short-form");
  assert.deepEqual(short.rows.map((row) => row.videoId), [1]);
  assert.equal(short.completedSampleCount, 1);
  const custom = selectPricingReality(reality, "custom");
  assert.deepEqual(custom.rows.map((row) => row.videoId), [3]);
});
