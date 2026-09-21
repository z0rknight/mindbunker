import assert from "node:assert/strict";
import test from "node:test";

import {
  SYSTEM_INTAKE_EVENT_TYPES,
  SYSTEM_INTAKE_SEEN_EVENT_TYPE,
  buildSystemInboundProjection,
  buildSystemIntakeSeenPayload,
  isSystemIntakeEventType,
  systemIntakeSeenIdempotencyKey,
} from "./core.ts";

function payload({ ref = null, path = "REPEATABLE_PRODUCTION", context = "Needs a repeatable edit system" } = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    modelVersion: "rmedia-guided-intake-v0",
    answers: {
      contentType: "short",
      durationBand: "under_90s",
      deliverableCountBand: "batch_5_10",
      recurrence: "recurring",
      formatMaturity: "established",
      sourceReadiness: "ready",
      editorialReadiness: "defined",
      creativeFlexibility: "formula",
      technicalComplexityFlags: [],
      reviewComplexity: "one",
      deadlineType: "window",
      dependencyFlags: ["none"],
      contact: { name: "QA Lead", email: "qa@example.com", company: "QA" },
    },
    derivedDimensions: {
      productionReadiness: "ready",
      repeatabilityPotential: "high",
      decisionUncertainty: "low",
      technicalUncertainty: "low",
      coordinationLoad: "low",
      schedulePressure: "flexible",
      likelyPilotNeed: false,
      uncertaintyLevel: "low",
    },
    recommendedStartingPath: path,
    referralContext: ref ? { key: ref, source: `referral:${ref}` } : null,
    freeformContext: context,
    submissionContext: { channel: "start" },
  });
}

function row(overrides = {}) {
  return {
    eventId: 10,
    clientId: 2,
    eventType: "guided_intake.submitted",
    payloadJson: payload(),
    createdAt: new Date("2026-09-20T12:00:00Z"),
    name: "QA Lead",
    email: "qa@example.com",
    status: "lead",
    ...overrides,
  };
}

test("classification is an explicit registry and excludes manual Lead events", () => {
  assert.deepEqual(SYSTEM_INTAKE_EVENT_TYPES, ["guided_intake.submitted"]);
  assert.equal(isSystemIntakeEventType("guided_intake.submitted"), true);
  assert.equal(isSystemIntakeEventType("lead_created"), false);
  assert.equal(buildSystemInboundProjection([row({ eventType: "lead_created", payloadJson: null })]).groups.length, 0);
});

test("multiple legitimate intakes group under one canonical Lead and preserve every event", () => {
  const result = buildSystemInboundProjection([
    row({ eventId: 12, createdAt: new Date("2026-09-20T14:00:00Z"), payloadJson: payload({ ref: "pdbm" }) }),
    row({ eventId: 10 }),
  ]);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].clientId, 2);
  assert.equal(result.groups[0].intakeCount, 2);
  assert.equal(result.groups[0].unreadCount, 2);
  assert.equal(result.unreadEventCount, 2);
  assert.equal(result.groups[0].latestSourceLabel, "Perfect Day Business Mentorship (PDBM)");
  assert.deepEqual(result.groups[0].intakes.map((item) => item.eventId), [12, 10]);
});

test("append-only acknowledgement is event-precise and survives reload semantics", () => {
  const result = buildSystemInboundProjection([
    row({ eventId: 12, payloadJson: payload({ ref: "pdbm" }) }),
    row({ eventId: 10 }),
    row({
      eventId: 13,
      eventType: SYSTEM_INTAKE_SEEN_EVENT_TYPE,
      payloadJson: buildSystemIntakeSeenPayload(12),
      createdAt: new Date("2026-09-20T15:00:00Z"),
    }),
  ]);
  assert.equal(result.groups[0].intakeCount, 2);
  assert.equal(result.groups[0].unreadCount, 1);
  assert.equal(result.unreadEventCount, 1);
  assert.equal(result.groups[0].intakes.find((item) => item.eventId === 12).unread, false);
  assert.equal(systemIntakeSeenIdempotencyKey(12), "system-intake-seen:12");
});

test("immutable origin survives later mutable Lead edits", () => {
  const result = buildSystemInboundProjection([
    row({
      eventId: 12,
      name: "Renamed after intake",
      status: "active",
      payloadJson: payload({ ref: "pdbm", context: "Original request" }),
    }),
  ]);
  assert.equal(result.groups[0].name, "Renamed after intake");
  assert.equal(result.groups[0].status, "active");
  assert.equal(result.groups[0].latestSourceLabel, "Perfect Day Business Mentorship (PDBM)");
  assert.equal(result.groups[0].latestProjection.freeformContext, "Original request");
});
