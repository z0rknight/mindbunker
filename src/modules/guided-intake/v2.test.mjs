import assert from "node:assert/strict";
import test from "node:test";

import { projectGuidedIntakePayload } from "./core.ts";
import { resolveReferral } from "../referrals/core.ts";
import {
  buildGuidedIntakeV2Payload,
  deriveLeadIntentV2,
  isGuidedIntakePayloadV2,
  validateGuidedIntakeV2Submission,
} from "./v2.ts";

function answers(overrides = {}) {
  return {
    situation: "defined_project",
    contentShape: "long",
    workload: "one",
    priority: "speed",
    formatMaturity: "defined",
    specialistContext: "none",
    contact: { name: "Startvideo QA", email: "QA-V2@Example.com", company: "RMEDIA" },
    freeformContext: "Synthetic V2 evidence",
    ...overrides,
  };
}

function submission(answerOverrides = {}, requestOverrides = {}) {
  return {
    answers: answers(answerOverrides),
    idempotencyKey: "startvideo-qa-001",
    ref: null,
    company_website: "",
    ...requestOverrides,
  };
}

function validate(value = submission()) {
  const result = validateGuidedIntakeV2Submission(value);
  assert.equal(result.success, true, JSON.stringify(result));
  return result.data;
}

test("V2 payload versions the intake surface instead of the customer", () => {
  const payload = buildGuidedIntakeV2Payload(validate(submission({}, { ref: "pdbm" })), resolveReferral("pdbm"));
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.modelVersion, "rmedia-guided-intake-v2");
  assert.deepEqual(payload.submissionContext, {
    channel: "startvideo",
    surface: "startvideo",
    flowVersion: 2,
    answerSchemaVersion: 2,
    derivedIntentVersion: "lead-intent-v2",
  });
  assert.equal(payload.answers.contact.email, "qa-v2@example.com");
  assert.equal(payload.referralContext.source, "referral:pdbm");
  assert.equal(isGuidedIntakePayloadV2(JSON.parse(JSON.stringify(payload))), true);
});

test("server-side V2 interpretation covers recurring, defined, specialist and ambiguous fixtures", () => {
  const recurring = deriveLeadIntentV2(validate(submission({
    situation: "steady_flow",
    contentShape: "both",
    workload: "ongoing_weekly",
    priority: "consistency",
  })).answers);
  assert.deepEqual({ relationship: recurring.relationshipShape, need: recurring.primaryNeed, path: recurring.likelyPath, confidence: recurring.confidence }, {
    relationship: "RECURRING", need: "CONSISTENCY", path: "REPEATABLE_PRODUCTION", confidence: "SUPPORTED",
  });

  const project = deriveLeadIntentV2(validate(submission({ situation: "backlog", workload: "backlog" })).answers);
  assert.deepEqual({ relationship: project.relationshipShape, need: project.primaryNeed, path: project.likelyPath }, {
    relationship: "PROJECT", need: "BACKLOG_CLEARANCE", path: "DEFINED_PROJECT",
  });

  const specialist = deriveLeadIntentV2(validate(submission({ situation: "specialist", specialistContext: "workflow_system" })).answers);
  assert.deepEqual({ relationship: specialist.relationshipShape, signal: specialist.specialistSignal, path: specialist.likelyPath }, {
    relationship: "PROJECT", signal: "WORKFLOW_SYSTEM", path: "SPECIALIST_COLLABORATION",
  });

  const ambiguous = deriveLeadIntentV2(validate(submission({
    situation: "exploring",
    contentShape: "unsure",
    workload: "unsure",
    priority: "unsure",
    formatMaturity: "unsure",
    specialistContext: "unsure",
  })).answers);
  assert.deepEqual({ relationship: ambiguous.relationshipShape, need: ambiguous.primaryNeed, path: ambiguous.likelyPath, confidence: ambiguous.confidence }, {
    relationship: "EXPLORATORY", need: "UNKNOWN", path: "HUMAN_REVIEW_REQUIRED", confidence: "PARTIAL",
  });
});

test("specialist signal stays orthogonal to recurring/project/exploratory relationship shape", () => {
  const recurring = deriveLeadIntentV2(validate(submission({
    situation: "steady_flow",
    workload: "ongoing_monthly",
    priority: "clarity_accuracy",
    specialistContext: "technical_content",
  })).answers);
  assert.equal(recurring.relationshipShape, "RECURRING");
  assert.equal(recurring.specialistSignal, "TECHNICAL_CONTENT");
  assert.equal(recurring.likelyPath, "SPECIALIST_COLLABORATION");
});

test("tampered browser derivation is rejected and read models recompute from raw answers", () => {
  assert.equal(validateGuidedIntakeV2Submission({ ...submission(), leadIntent: { likelyPath: "REPEATABLE_PRODUCTION" } }).success, false);
  const payload = buildGuidedIntakeV2Payload(validate(), null);
  const tampered = { ...payload, leadIntent: { ...payload.leadIntent, likelyPath: "REPEATABLE_PRODUCTION" } };
  assert.equal(isGuidedIntakePayloadV2(tampered), false);
  const projection = projectGuidedIntakePayload(payload);
  assert.equal(projection.surface, "STARTVIDEO V2");
  assert.equal(projection.intakeVersion, "Flow 2 · answers 2 · intent 2");
  assert.equal(projection.relationshipShape, "PROJECT");
  assert.equal(projection.startingPath, "Defined project");
  assert.equal(projection.rawAnswers.length, 6);
});

test("strict V2 validation accepts uncertainty but rejects unknown keys and forged enums", () => {
  assert.equal(validateGuidedIntakeV2Submission(submission({ priority: "unsure" })).success, true);
  assert.equal(validateGuidedIntakeV2Submission(submission({ magicLeadScore: 91 })).success, false);
  assert.equal(validateGuidedIntakeV2Submission(submission({ situation: "enterprise_buyer" })).success, false);
  assert.equal(validateGuidedIntakeV2Submission(submission({ contact: { name: "QA", email: "bad", company: "" } })).success, false);
});
