import assert from "node:assert/strict";
import test from "node:test";

import { classifyPricingEvidence, describePricingEvidence } from "./reality.ts";

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
