import test from "node:test";
import assert from "node:assert/strict";
import { buildPayload, deriveIntake, emptyAnswers, visibleSteps } from "./model.mjs";

function answers(overrides = {}) {
  return {
    ...emptyAnswers(),
    contentType: "short",
    durationBand: "under_90s",
    deliverableCountBand: "one",
    recurrence: "one_off",
    formatMaturity: "established",
    sourceReadiness: "ready",
    editorialReadiness: "defined",
    creativeFlexibility: "formula",
    deadlineType: "window",
    reviewComplexity: "one",
    technicalComplexityFlags: ["none"],
    dependencyFlags: ["none"],
    ...overrides,
  };
}

test("A — ten monthly shorts with a known formula become repeatable production", () => {
  const result = deriveIntake(answers({ deliverableCountBand: "batch_5_10", recurrence: "recurring" }));
  assert.equal(result.recommendedStartingPath, "REPEATABLE_PRODUCTION");
  assert.equal(result.repeatabilityPotential, "high");
});

test("B — a weekly series with references but no formula starts with a pilot", () => {
  const result = deriveIntake(answers({
    deliverableCountBand: "ongoing",
    recurrence: "recurring",
    formatMaturity: "references",
    creativeFlexibility: "some",
  }));
  assert.equal(result.recommendedStartingPath, "PILOT_SETUP");
  assert.equal(result.likelyPilotNeed, true);
});

test("C — one important exploratory long-form video stays flexible", () => {
  const result = deriveIntake(answers({
    contentType: "long",
    durationBand: "over_10m",
    formatMaturity: "established",
    creativeFlexibility: "high",
    technicalComplexityFlags: ["motion", "source_risk"],
  }));
  assert.equal(result.recommendedStartingPath, "FLEXIBLE_COLLABORATION");
});

test("D — a bounded, ready one-off becomes a defined project", () => {
  assert.equal(deriveIntake(answers()).recommendedStartingPath, "DEFINED_PROJECT");
});

test("E — a lead who only knows they need video gets human guidance", () => {
  const result = deriveIntake(answers({
    contentType: "unsure",
    deliverableCountBand: "unsure",
    recurrence: "unsure",
    formatMaturity: "unsure",
    sourceReadiness: "needs_help",
    editorialReadiness: "unsure",
    creativeFlexibility: "unsure",
    deadlineType: "urgent",
    reviewComplexity: "unclear",
  }));
  assert.equal(result.recommendedStartingPath, "HUMAN_REVIEW_REQUIRED");
  assert.equal(result.uncertaintyLevel, "high");
});

test("evidence invariant — four known batch pieces can be simpler than one unresolved piece", () => {
  const knownBatch = deriveIntake(answers({ deliverableCountBand: "small_batch", recurrence: "campaign" }));
  const unresolvedSingle = deriveIntake(answers({
    deliverableCountBand: "one",
    formatMaturity: "discover",
    sourceReadiness: "partial",
    editorialReadiness: "editor_selects",
    creativeFlexibility: "high",
    technicalComplexityFlags: ["motion", "source_risk"],
  }));
  assert.equal(knownBatch.recommendedStartingPath, "REPEATABLE_PRODUCTION");
  assert.notEqual(unresolvedSingle.recommendedStartingPath, "DEFINED_PROJECT");
  assert.equal(unresolvedSingle.technicalUncertainty, "high");
});

test("simple ready work skips progressive complexity; unresolved work reveals it", () => {
  assert.equal(visibleSteps(answers()).some((step) => step.id === "complexity"), false);
  assert.equal(visibleSteps(answers({ formatMaturity: "discover" })).some((step) => step.id === "complexity"), true);
});

test("F — PDBM referral survives a complete scenario without commercial side effects", () => {
  const payload = buildPayload(answers({ deliverableCountBand: "batch_5_10", recurrence: "recurring" }), "referral:pdbm");
  assert.equal(payload.referralSource, "referral:pdbm");
  assert.equal(payload.derived.recommendedStartingPath, "REPEATABLE_PRODUCTION");
  assert.equal(payload.price, null);
  assert.equal(payload.discount, null);
  assert.equal(payload.capacityDecision, null);
  assert.equal(payload.requiresHumanReview, true);
});
