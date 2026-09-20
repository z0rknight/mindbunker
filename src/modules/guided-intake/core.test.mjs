import assert from "node:assert/strict";
import test from "node:test";

import { resolveReferral } from "../referrals/core.ts";
import {
  buildGuidedIntakePayload,
  deriveGuidedIntake,
  GUIDED_INTAKE_EVENT_TYPE,
  GUIDED_INTAKE_PAYLOAD_SCHEMA_VERSION,
  isGuidedIntakePayload,
  projectGuidedIntakePayload,
  validateGuidedIntakeSubmission,
} from "./core.ts";

function answers(overrides = {}) {
  return {
    contentType: "short",
    durationBand: "under_90s",
    deliverableCountBand: "one",
    recurrence: "one_off",
    formatMaturity: "established",
    sourceReadiness: "ready",
    editorialReadiness: "defined",
    creativeFlexibility: "formula",
    technicalComplexityFlags: [],
    reviewComplexity: "one",
    deadlineType: "window",
    dependencyFlags: ["none"],
    contact: { name: "Guided QA", email: "QA@Example.com", company: "RMEDIA" },
    freeformContext: "A useful starting point.",
    ...overrides,
  };
}

function submission(answerOverrides = {}, requestOverrides = {}) {
  return {
    answers: answers(answerOverrides),
    idempotencyKey: "guided-qa-request-001",
    ref: null,
    company_website: "",
    ...requestOverrides,
  };
}

function validate(value = submission()) {
  const result = validateGuidedIntakeSubmission(value);
  assert.equal(result.success, true, JSON.stringify(result));
  return result.data;
}

test("payload V1 is built from validated raw answers and round-trips", () => {
  const payload = buildGuidedIntakePayload(validate(), null);
  assert.equal(payload.schemaVersion, GUIDED_INTAKE_PAYLOAD_SCHEMA_VERSION);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.answers.contact.email, "qa@example.com");
  assert.equal(payload.recommendedStartingPath, "DEFINED_PROJECT");
  assert.equal(payload.freeformContext, "A useful starting point.");
  assert.equal(isGuidedIntakePayload(JSON.parse(JSON.stringify(payload))), true);
  assert.equal(GUIDED_INTAKE_EVENT_TYPE, "guided_intake.submitted");
});

test("browser-derived recommendations and dimensions are rejected, then recomputed server-side", () => {
  const tampered = submission({}, {
    recommendedStartingPath: "REPEATABLE_PRODUCTION",
    derivedDimensions: { productionReadiness: "ready" },
  });
  const rejected = validateGuidedIntakeSubmission(tampered);
  assert.equal(rejected.success, false);
  assert.ok(rejected.errors.request);

  const raw = validate(submission({
    deliverableCountBand: "ongoing",
    recurrence: "recurring",
    formatMaturity: "references",
    creativeFlexibility: "some",
  }));
  assert.equal(buildGuidedIntakePayload(raw, null).recommendedStartingPath, "PILOT_SETUP");
});

test("all six canonical model scenarios remain deterministic", () => {
  const scenarios = [
    ["DEFINED_PROJECT", {}],
    ["REPEATABLE_PRODUCTION", { deliverableCountBand: "batch_5_10", recurrence: "recurring" }],
    ["PILOT_SETUP", { deliverableCountBand: "ongoing", recurrence: "recurring", formatMaturity: "references", creativeFlexibility: "some" }],
    ["FLEXIBLE_COLLABORATION", { contentType: "long", durationBand: "over_10m", creativeFlexibility: "high", technicalComplexityFlags: ["motion", "source_risk"] }],
    ["HUMAN_REVIEW_REQUIRED", { contentType: "unsure", deliverableCountBand: "unsure", recurrence: "unsure", formatMaturity: "unsure", sourceReadiness: "needs_help", editorialReadiness: "unsure", creativeFlexibility: "unsure", deadlineType: "urgent", reviewComplexity: "unclear" }],
    ["REPEATABLE_PRODUCTION", { deliverableCountBand: "batch_5_10", recurrence: "recurring" }],
  ];
  for (const [expected, overrides] of scenarios) {
    const data = validate(submission(overrides));
    assert.equal(deriveGuidedIntake(data.answers).recommendedStartingPath, expected);
  }
  const pdbm = buildGuidedIntakePayload(validate(submission({ deliverableCountBand: "batch_5_10", recurrence: "recurring" })), resolveReferral("pdbm"));
  assert.equal(pdbm.referralContext.source, "referral:pdbm");
});

test("strict validation rejects malformed answer structures and invalid values", () => {
  const extraAnswer = submission({ debugPayload: true });
  assert.equal(validateGuidedIntakeSubmission(extraAnswer).success, false);
  assert.equal(validateGuidedIntakeSubmission(submission({ contentType: "enterprise_video_package" })).success, false);
  assert.equal(validateGuidedIntakeSubmission(submission({ contact: { name: "QA", email: "bad", company: "" } })).success, false);
  assert.equal(validateGuidedIntakeSubmission(submission({}, { idempotencyKey: "short" })).success, false);
});

test("CRM projection is readable and does not require raw JSON", () => {
  const payload = buildGuidedIntakePayload(validate(submission({}, { ref: "pdbm" })), resolveReferral("pdbm"));
  const projection = projectGuidedIntakePayload(payload);
  assert.equal(projection.whatTheyWant, "Short clips");
  assert.equal(projection.startingPath, "Defined project");
  assert.match(projection.referralSource, /PDBM/u);
  assert.equal(projection.freeformContext, "A useful starting point.");
});

test("malformed historical payloads fail closed", () => {
  assert.equal(isGuidedIntakePayload(null), false);
  assert.equal(isGuidedIntakePayload({ schemaVersion: 1 }), false);
  assert.equal(isGuidedIntakePayload({
    schemaVersion: 1,
    modelVersion: "rmedia-guided-intake-v0",
    answers: {},
    derivedDimensions: {},
    recommendedStartingPath: "FORGED",
    submissionContext: { channel: "start" },
  }), false);
});
