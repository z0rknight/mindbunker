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
  computeCRMActionableKPIs,
  getCRMNeedsAttention,
} from "./core.ts";

function client(overrides = {}) {
  return {
    id: 1,
    name: "Client",
    status: "active",
    archivalState: ACTIVE_SURFACE,
    opportunityStage: "active",
    nextAction: null,
    nextActionDate: null,
    lastInteractionAt: "2026-09-07T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function quote(overrides = {}) {
  return {
    id: 1,
    clientId: 1,
    status: "SENT",
    sentAt: "2026-09-01T00:00:00.000Z",
    amountCents: 10000,
    currency: "USD",
    ...overrides,
  };
}

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

test("getCRMNeedsAttention flags a follow-up strictly before today, not one due today", () => {
  const today = "2026-09-08";
  const overdue = client({ id: 1, nextActionDate: "2026-09-05" });
  const dueToday = client({ id: 2, nextActionDate: "2026-09-08" });
  const items = getCRMNeedsAttention([overdue, dueToday], [], today);
  assert.deepEqual(
    items.map((i) => i.clientId),
    [1],
  );
  assert.match(items[0].detail, /overdue by 3 days/u);
});

test("getCRMNeedsAttention excludes Geladeira clients from every bucket", () => {
  const today = "2026-09-08";
  const archived = client({
    id: 1,
    archivalState: GELADEIRA,
    nextActionDate: "2026-09-01",
    status: "active",
    lastInteractionAt: "2026-01-01T00:00:00.000Z",
  });
  const items = getCRMNeedsAttention([archived], [quote({ clientId: 1 })], today);
  assert.deepEqual(items, []);
});

test("getCRMNeedsAttention flags a SENT quote only once it has gone quiet for 5+ days", () => {
  const today = "2026-09-08";
  const c = client({ id: 1, nextActionDate: null });
  const fresh = quote({ clientId: 1, sentAt: "2026-09-05T00:00:00.000Z" });
  const stale = quote({ id: 2, clientId: 1, sentAt: "2026-09-01T00:00:00.000Z" });
  assert.deepEqual(getCRMNeedsAttention([c], [fresh], today), []);
  const items = getCRMNeedsAttention([c], [stale], today);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "QUOTE_AWAITING_RESPONSE");
  assert.match(items[0].detail, /7 days/u);
});

test("getCRMNeedsAttention flags a dormant active client but not a dormant lead", () => {
  const today = "2026-09-08";
  const dormantActive = client({
    id: 1,
    status: "active",
    lastInteractionAt: "2026-08-01T00:00:00.000Z",
  });
  const dormantLead = client({
    id: 2,
    status: "lead",
    lastInteractionAt: "2026-08-01T00:00:00.000Z",
  });
  const items = getCRMNeedsAttention([dormantActive, dormantLead], [], today);
  assert.deepEqual(
    items.map((i) => i.clientId),
    [1],
  );
  assert.equal(items[0].kind, "DORMANT");
});

test("getCRMNeedsAttention falls back to createdAt when a client never logged an interaction", () => {
  const today = "2026-09-08";
  const neverContacted = client({
    id: 1,
    status: "active",
    lastInteractionAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
  });
  const items = getCRMNeedsAttention([neverContacted], [], today);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "DORMANT");
});

test("computeCRMActionableKPIs counts follow-ups due today or earlier", () => {
  const today = "2026-09-08";
  const clients = [
    client({ id: 1, nextActionDate: "2026-09-08" }),
    client({ id: 2, nextActionDate: "2026-09-05" }),
    client({ id: 3, nextActionDate: "2026-09-09" }),
    client({ id: 4, nextActionDate: null }),
  ];
  const kpis = computeCRMActionableKPIs(clients, [], today);
  assert.equal(kpis.followUpsDue, 2);
});

test("computeCRMActionableKPIs counts leads whose stage has moved past new/lost as awaiting reply", () => {
  const today = "2026-09-08";
  const clients = [
    client({ id: 1, status: "lead", opportunityStage: "new" }),
    client({ id: 2, status: "lead", opportunityStage: "qualified" }),
    client({ id: 3, status: "lead", opportunityStage: "lost" }),
    client({ id: 4, status: "active", opportunityStage: "qualified" }),
  ];
  const kpis = computeCRMActionableKPIs(clients, [], today);
  assert.equal(kpis.leadsAwaitingReply, 1);
});

test("computeCRMActionableKPIs sums open quotes and pipeline value per currency, excluding Geladeira", () => {
  const today = "2026-09-08";
  const clients = [
    client({ id: 1 }),
    client({ id: 2, archivalState: GELADEIRA }),
  ];
  const quotes = [
    quote({ id: 1, clientId: 1, status: "SENT", amountCents: 10000, currency: "USD" }),
    quote({ id: 2, clientId: 1, status: "DRAFT", amountCents: 5000, currency: "USD" }),
    quote({ id: 3, clientId: 1, status: "APPROVED", amountCents: 999999, currency: "USD" }),
    quote({ id: 4, clientId: 2, status: "SENT", amountCents: 999999, currency: "USD" }),
  ];
  const kpis = computeCRMActionableKPIs(clients, quotes, today);
  assert.equal(kpis.openQuotes, 1);
  assert.deepEqual(kpis.pipelineValueByCurrency, [{ currency: "USD", amount: 150 }]);
});

test("computeCRMActionableKPIs clientsAtRisk matches the DORMANT bucket of getCRMNeedsAttention", () => {
  const today = "2026-09-08";
  const clients = [
    client({ id: 1, status: "active", lastInteractionAt: "2026-08-01T00:00:00.000Z" }),
    client({ id: 2, status: "active", lastInteractionAt: "2026-09-07T00:00:00.000Z" }),
  ];
  const kpis = computeCRMActionableKPIs(clients, [], today);
  assert.equal(kpis.clientsAtRisk, 1);
});
