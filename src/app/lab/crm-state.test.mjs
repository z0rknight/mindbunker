import { test } from "node:test";
import assert from "node:assert/strict";
import { mapToCrmState, isFollowUpDue } from "./crm-state.ts";

test("mapToCrmState: opportunityStage lost always maps to LOST regardless of client.status", () => {
  assert.equal(mapToCrmState({ status: "active", opportunityStage: "lost", archivalState: "ACTIVE_SURFACE", lastInteractionAt: null }, true), "LOST");
});

test("mapToCrmState: active + GELADEIRA is DORMANT", () => {
  assert.equal(mapToCrmState({ status: "active", opportunityStage: "active", archivalState: "GELADEIRA", lastInteractionAt: null }, true), "DORMANT");
});

test("mapToCrmState: lead + new stage is LEAD", () => {
  assert.equal(mapToCrmState({ status: "lead", opportunityStage: "new", archivalState: "ACTIVE_SURFACE", lastInteractionAt: null }, false), "LEAD");
});

test("mapToCrmState: active client with open work is ACTIVE even with no recent interaction", () => {
  const old = new Date(Date.now() - 90 * 86400000);
  assert.equal(mapToCrmState({ status: "active", opportunityStage: "active", archivalState: "ACTIVE_SURFACE", lastInteractionAt: old }, true), "ACTIVE");
});

test("mapToCrmState: active client with NO open work and stale interaction is AT_RISK", () => {
  const old = new Date(Date.now() - 90 * 86400000);
  assert.equal(mapToCrmState({ status: "active", opportunityStage: "active", archivalState: "ACTIVE_SURFACE", lastInteractionAt: old }, false), "AT_RISK");
});

test("isFollowUpDue: false for ACTIVE state regardless of interaction age (per brief)", () => {
  const old = new Date(Date.now() - 200 * 86400000);
  assert.equal(isFollowUpDue("ACTIVE", old), false);
});

test("isFollowUpDue: true for OPPORTUNITY with no interaction at all", () => {
  assert.equal(isFollowUpDue("OPPORTUNITY", null), true);
});

test("isFollowUpDue: true for LEAD past threshold, false within threshold", () => {
  const eightDaysAgo = new Date(Date.now() - 8 * 86400000);
  const oneDayAgo = new Date(Date.now() - 1 * 86400000);
  assert.equal(isFollowUpDue("LEAD", eightDaysAgo, new Date(), 7), true);
  assert.equal(isFollowUpDue("LEAD", oneDayAgo, new Date(), 7), false);
});
