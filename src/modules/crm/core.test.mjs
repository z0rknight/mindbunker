import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_SURFACE,
  GELADEIRA,
  EMPTY_CLIENT_DEPENDENCY_COUNTS,
  clientHasProtectedHistory,
  describeProtectedHistory,
  isActiveSurface,
  isCrmActivityType,
  isPositiveId,
  planArchivalTransition,
  validateLogCrmActivityInput,
} from "./core.ts";

test("isActiveSurface treats ACTIVE_SURFACE as visible and GELADEIRA as hidden", () => {
  assert.equal(isActiveSurface(ACTIVE_SURFACE), true);
  assert.equal(isActiveSurface(GELADEIRA), false);
});

test("isPositiveId rejects everything but positive safe integers", () => {
  assert.equal(isPositiveId(1), true);
  assert.equal(isPositiveId(0), false);
  assert.equal(isPositiveId(-1), false);
  assert.equal(isPositiveId(1.5), false);
  assert.equal(isPositiveId("1"), false);
  assert.equal(isPositiveId(Number.MAX_SAFE_INTEGER + 1), false);
});

test("archiving an ACTIVE_SURFACE client is a real transition", () => {
  const plan = planArchivalTransition(ACTIVE_SURFACE, GELADEIRA);
  assert.deepEqual(plan, { changed: true, nextState: GELADEIRA });
});

test("reactivating a GELADEIRA client is a real transition", () => {
  const plan = planArchivalTransition(GELADEIRA, ACTIVE_SURFACE);
  assert.deepEqual(plan, { changed: true, nextState: ACTIVE_SURFACE });
});

test("archiving an already-archived client is a no-op (idempotent)", () => {
  const plan = planArchivalTransition(GELADEIRA, GELADEIRA);
  assert.deepEqual(plan, { changed: false, nextState: GELADEIRA });
});

test("reactivating an already-visible client is a no-op (idempotent)", () => {
  const plan = planArchivalTransition(ACTIVE_SURFACE, ACTIVE_SURFACE);
  assert.deepEqual(plan, { changed: false, nextState: ACTIVE_SURFACE });
});

test("a brand-new client with zero dependencies has no protected history", () => {
  assert.equal(clientHasProtectedHistory(EMPTY_CLIENT_DEPENDENCY_COUNTS), false);
  assert.equal(describeProtectedHistory(EMPTY_CLIENT_DEPENDENCY_COUNTS), "");
});

test("any single non-zero dependency counts as protected history", () => {
  const dimensions = [
    "projects",
    "bookings",
    "gatewayInvitations",
    "intakeSubmissions",
    "videos",
    "nonCreationEvents",
  ];
  for (const dimension of dimensions) {
    const counts = { ...EMPTY_CLIENT_DEPENDENCY_COUNTS, [dimension]: 1 };
    assert.equal(
      clientHasProtectedHistory(counts),
      true,
      `${dimension} should mark the client protected`,
    );
    assert.notEqual(describeProtectedHistory(counts), "");
  }
});

test("describeProtectedHistory lists only present dependencies with correct pluralization", () => {
  assert.equal(
    describeProtectedHistory({
      ...EMPTY_CLIENT_DEPENDENCY_COUNTS,
      projects: 1,
      videos: 3,
    }),
    "1 project, 3 videos",
  );
  assert.equal(
    describeProtectedHistory({
      ...EMPTY_CLIENT_DEPENDENCY_COUNTS,
      bookings: 2,
      gatewayInvitations: 1,
      intakeSubmissions: 1,
      nonCreationEvents: 5,
    }),
    "2 bookings, 1 Gateway invitation, 1 intake submission, 5 CRM events",
  );
});

test("a client with real accumulated history across every dimension is protected", () => {
  assert.equal(
    clientHasProtectedHistory({
      projects: 2,
      bookings: 1,
      gatewayInvitations: 1,
      intakeSubmissions: 1,
      videos: 4,
      nonCreationEvents: 6,
    }),
    true,
  );
});


// Sprint 3 (CRM Lead Workspace — fast activity quick-log).
test("isCrmActivityType accepts only the fixed vocabulary", () => {
  assert.equal(isCrmActivityType("call"), true);
  assert.equal(isCrmActivityType("note"), true);
  assert.equal(isCrmActivityType("workflow_triggered"), false);
  assert.equal(isCrmActivityType(""), false);
  assert.equal(isCrmActivityType(undefined), false);
});

test("validateLogCrmActivityInput rejects an empty note", () => {
  const result = validateLogCrmActivityInput({ type: "call", description: "   " });
  assert.equal(result.success, false);
});

test("validateLogCrmActivityInput trims the note and defaults an unknown type to note", () => {
  const result = validateLogCrmActivityInput({
    type: "not-a-real-type",
    description: "  Called about the invoice  ",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.type, "note");
  assert.equal(result.data.description, "Called about the invoice");
});

test("validateLogCrmActivityInput preserves a valid explicit type", () => {
  const result = validateLogCrmActivityInput({ type: "meeting", description: "Kickoff call" });
  assert.equal(result.success, true);
  assert.equal(result.data.type, "meeting");
});
