import assert from "node:assert/strict";
import test from "node:test";

import { scanRelationshipIntegrity } from "./integrity.ts";

function input(overrides = {}) {
  return {
    clients: [
      { id: 2, name: "Taryn Dubreuil", email: "taryn@example.com", archivalState: "ACTIVE_SURFACE", source: "Upwork" },
      { id: 12, name: "Taryn DFY", email: null, archivalState: "ACTIVE_SURFACE", source: "Upwork" },
    ],
    projects: [{ id: 20, clientId: 12, name: "Taryn DFY — October", status: "active" }],
    videos: [{ id: 30, clientId: 12, projectId: 20, title: "Geoff", status: "IN_PROGRESS", videoKind: "CLIENT_WORK", isOperationalContainer: false, cancelledAt: null }],
    contracts: [{ id: 1, clientId: 2, status: "ACTIVE" }],
    paymentRequests: [],
    transactions: [{ id: 1, clientId: 2, type: "income", category: "Freelance" }],
    ...overrides,
  };
}

test("the canonical Taryn + DFY operational alias graph is healthy", () => {
  assert.deepEqual(scanRelationshipIntegrity(input()), []);
});

test("an alias whose canonical client is absent becomes an integrity error", () => {
  const result = scanRelationshipIntegrity(input({ clients: input().clients.filter((client) => client.id !== 2) }));
  assert.equal(result[0].code, "ALIAS_CANONICAL_MISSING");
  assert.equal(result[0].severity, "ERROR");
});

test("archived relationships with active work, contracts, or payment requests are visible warnings", () => {
  const clients = input().clients.map((client) =>
    client.id === 2 || client.id === 12 ? { ...client, archivalState: "GELADEIRA" } : client,
  );
  const result = scanRelationshipIntegrity(input({
    clients,
    paymentRequests: [{ id: 9, clientId: 2, status: "OPEN" }],
  }));
  assert.deepEqual(
    new Set(result.map((issue) => issue.code)),
    new Set([
      "ARCHIVED_CLIENT_ACTIVE_PROJECT",
      "ARCHIVED_CLIENT_ACTIVE_CONTRACT",
      "ARCHIVED_CLIENT_OPEN_PAYMENT_REQUEST",
    ]),
  );
});

test("project/video ownership drift and unassigned active client work are detected", () => {
  const result = scanRelationshipIntegrity(input({
    videos: [
      { id: 31, clientId: 2, projectId: 20, title: "Wrong owner", status: "IN_PROGRESS", videoKind: "CLIENT_WORK", isOperationalContainer: false, cancelledAt: null },
      { id: 32, clientId: null, projectId: null, title: "Unassigned", status: "PLANNED", videoKind: "CLIENT_WORK", isOperationalContainer: false, cancelledAt: null },
    ],
  }));
  assert.deepEqual(
    result.map((issue) => issue.code),
    ["VIDEO_PROJECT_CLIENT_MISMATCH", "VIDEO_CLIENT_MISSING"],
  );
});

test("a delivered Project with an unfinished real Video is a semantic integrity error", () => {
  const result = scanRelationshipIntegrity(input({
    projects: [{ id: 19, clientId: 12, name: "GEOFF - September Long Form Videos", status: "delivered" }],
    videos: [
      { id: 85, clientId: 12, projectId: 19, title: "Front Door Video 1", status: "IN_PROGRESS", videoKind: "CLIENT_WORK", isOperationalContainer: false, cancelledAt: null },
      { id: 86, clientId: 12, projectId: 19, title: "Offer Doc", status: "DONE", videoKind: "CLIENT_WORK", isOperationalContainer: false, cancelledAt: null },
    ],
  }));
  assert.equal(result[0].code, "DELIVERED_PROJECT_OPEN_VIDEO");
  assert.equal(result[0].severity, "ERROR");
  assert.match(result[0].message, /1 deliverable remains unfinished/u);
});

test("exact normalized identity duplicates are detected without fuzzy guessing", () => {
  const result = scanRelationshipIntegrity(input({
    clients: [
      ...input().clients,
      { id: 13, name: "  Taryn Dubreuil ", email: " TARYN@example.com ", archivalState: "ACTIVE_SURFACE", source: "manual" },
    ],
  }));
  assert.deepEqual(
    new Set(result.map((issue) => issue.code)),
    new Set(["DUPLICATE_CLIENT_EMAIL", "DUPLICATE_CLIENT_NAME"]),
  );
});
