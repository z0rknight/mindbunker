import assert from "node:assert/strict";
import test from "node:test";

import {
  selectRestaurantClients,
  attachRestaurantCommercials,
  buildRestaurantTickets,
  buildRestaurantActiveSession,
  buildRestaurantViewModel,
} from "./restaurant-core.ts";

const CLIENTS = [
  { id: 1, name: "Taryn", archivalState: null },
  { id: 2, name: "Dave", archivalState: null },
  { id: 3, name: "Old Client", archivalState: "GELADEIRA" },
  { id: 4, name: "RMEDIA", archivalState: null },
];

function video(overrides) {
  return {
    id: 1,
    clientId: 1,
    projectId: null,
    projectName: null,
    status: "PLANNED",
    videoKind: "CLIENT_WORK",
    isOperationalContainer: false,
    ...overrides,
  };
}

test("client selection is bounded to the limit", () => {
  const manyClients = Array.from({ length: 20 }, (_, i) => ({ id: i + 10, name: `Client ${i}`, archivalState: null }));
  const videos = manyClients.map((c) => video({ id: c.id, clientId: c.id, status: "IN_PROGRESS" }));
  const selected = selectRestaurantClients(manyClients, videos, new Set(), new Map(), 8);
  assert.equal(selected.length, 8);
});

test("clients with current active/review work are prioritized over idle recently-worked clients", () => {
  const videos = [video({ id: 1, clientId: 1, status: "IN_PROGRESS" })];
  const lastActive = new Map([[2, "2026-09-14T10:00:00.000Z"]]); // Dave: idle but recently worked
  const selected = selectRestaurantClients(CLIENTS, videos, new Set(), lastActive, 8);
  assert.equal(selected[0].id, 1);
  assert.equal(selected[0].health, "ACTIVE");
});

test("internal RMEDIA client and GELADEIRA-archived clients are excluded", () => {
  const videos = [
    video({ id: 1, clientId: 4, status: "IN_PROGRESS" }), // RMEDIA
    video({ id: 2, clientId: 3, status: "IN_PROGRESS" }), // archived
  ];
  const selected = selectRestaurantClients(CLIENTS, videos, new Set(), new Map(), 8);
  assert.deepEqual(selected, []);
});

test("table mapping is deterministic for identical input", () => {
  const videos = [video({ id: 1, clientId: 1, status: "IN_PROGRESS" }), video({ id: 2, clientId: 2, status: "READY_FOR_REVIEW" })];
  const a = selectRestaurantClients(CLIENTS, videos, new Set(), new Map(), 8);
  const b = selectRestaurantClients(CLIENTS, videos, new Set(), new Map(), 8);
  assert.deepEqual(a, b);
});

test("a blocked video sets BLOCKED health even when other videos are in review", () => {
  const videos = [
    video({ id: 1, clientId: 1, status: "READY_FOR_REVIEW" }),
    video({ id: 2, clientId: 1, status: "IN_PROGRESS" }),
  ];
  const selected = selectRestaurantClients(CLIENTS, videos, new Set([2]), new Map(), 8);
  assert.equal(selected[0].health, "BLOCKED");
});

test("cross-client safety: commercial amounts never leak between clients", () => {
  const selected = [
    { id: 1, name: "Taryn", activeCount: 1, reviewCount: 0, blockedCount: 0, health: "ACTIVE", lastActiveAt: null, projects: [] },
    { id: 2, name: "Dave", activeCount: 1, reviewCount: 0, blockedCount: 0, health: "ACTIVE", lastActiveAt: null, projects: [] },
  ];
  const commercialByClientId = new Map([
    [1, { byProject: [{ projectId: 5, projectName: "Bonnie", currency: "USD", amount: 37.5, minutes: 90 }], unallocatedManualEvidence: [] }],
  ]);
  const withCommercials = attachRestaurantCommercials(selected, commercialByClientId);
  const taryn = withCommercials.find((c) => c.id === 1);
  const dave = withCommercials.find((c) => c.id === 2);
  assert.deepEqual(taryn.attributable, [{ currency: "USD", amount: 37.5, minutes: 90 }]);
  assert.deepEqual(dave.attributable, []);
});

test("unknown commercial amount remains absent, never a fabricated $0", () => {
  const selected = [{ id: 2, name: "Dave", activeCount: 2, reviewCount: 0, blockedCount: 0, health: "ACTIVE", lastActiveAt: null, projects: [] }];
  const withCommercials = attachRestaurantCommercials(selected, new Map());
  assert.deepEqual(withCommercials[0].attributable, []);
  assert.equal(withCommercials[0].hasUnallocatedHistorical, false);
});

test("canonical allocation amount sums correctly across multiple allocation rows", () => {
  const selected = [{ id: 1, name: "Taryn", activeCount: 3, reviewCount: 0, blockedCount: 0, health: "ACTIVE", lastActiveAt: null, projects: [] }];
  const commercialByClientId = new Map([
    [
      1,
      {
        byProject: [
          { projectId: 5, projectName: "Bonnie", currency: "USD", amount: 25, minutes: 60 },
          { projectId: 5, projectName: "Bonnie", currency: "USD", amount: 12.5, minutes: 30 },
        ],
        unallocatedManualEvidence: [{ id: 9, amount: 75, currency: "USD", periodStart: "2026-01-19", periodEnd: "2026-01-22", label: "Jan" }],
      },
    ],
  ]);
  const withCommercials = attachRestaurantCommercials(selected, commercialByClientId);
  assert.deepEqual(withCommercials[0].attributable, [{ currency: "USD", amount: 37.5, minutes: 90 }]);
  assert.equal(withCommercials[0].hasUnallocatedHistorical, true);
});

test("production-order ticket mapping excludes delivered/cancelled/closed orders and is bounded", () => {
  const orders = [
    { id: 1, label: "A", channel: null, state: "OPEN", phase: "REVIEW", clientId: 1, clientName: "Taryn", projectId: 1, projectName: "P", receivedAt: "2026-09-01", activeItemCount: 2, doneItemCount: 0, cancelledItemCount: 0, expectedValueCents: null, currency: null, contractId: null, contractLabel: null },
    { id: 2, label: "B", channel: null, state: "OPEN", phase: "DELIVERED", clientId: 1, clientName: "Taryn", projectId: 1, projectName: "P", receivedAt: "2026-09-02", activeItemCount: 0, doneItemCount: 5, cancelledItemCount: 0, expectedValueCents: null, currency: null, contractId: null, contractLabel: null },
    { id: 3, label: "C", channel: null, state: "CANCELLED", phase: "RECEIVED", clientId: 2, clientName: "Dave", projectId: 2, projectName: "Q", receivedAt: "2026-09-03", activeItemCount: 0, doneItemCount: 0, cancelledItemCount: 3, expectedValueCents: null, currency: null, contractId: null, contractLabel: null },
    { id: 4, label: "D", channel: null, state: "OPEN", phase: "IN_PRODUCTION", clientId: 2, clientName: "Dave", projectId: 2, projectName: "Q", receivedAt: "2026-09-04", activeItemCount: 2, doneItemCount: 0, cancelledItemCount: 0, expectedValueCents: null, currency: null, contractId: null, contractLabel: null },
  ];
  const tickets = buildRestaurantTickets(orders, 8);
  assert.equal(tickets.length, 2);
  assert.deepEqual(tickets.map((t) => t.id), [1, 4]); // REVIEW ranks above IN_PRODUCTION
});

const WORK_SESSION_FIXTURE = { id: 1, videoId: 1, videoTitle: "Bonnie Ad", clientName: "Taryn", clientId: 1, projectName: "Content Waterfall", activityType: "EDITING", startedAt: "2026-09-14T10:00:00.000Z", deviceName: null };
const SENSOR_SESSION_FIXTURE = { id: 9, videoId: 2, videoTitle: "Dave Ad", clientName: "Dave", clientId: 2, projectName: null, activityType: "EDITING", startedAt: "2026-09-14T10:00:00.000Z", deviceName: "Emmanuel's Mac" };

test("active-session state reflects the canonical open Work Session, idle when neither exists", () => {
  const active = buildRestaurantActiveSession(WORK_SESSION_FIXTURE, 600, false, null, 0);
  assert.equal(active.kind, "WORKING");
  assert.equal(active.clientName, "Taryn");
  assert.equal(active.elapsedSeconds, 600);

  const idle = buildRestaurantActiveSession(null, 0, false, null, 0);
  assert.equal(idle, null);
});

test("an open Sensor recording surfaces as SENSOR_RECORDING when no canonical session is open", () => {
  const recording = buildRestaurantActiveSession(null, 0, false, SENSOR_SESSION_FIXTURE, 120);
  assert.equal(recording.kind, "SENSOR_RECORDING");
  assert.equal(recording.clientName, "Dave");
  assert.equal(recording.elapsedSeconds, 120);
});

test("a canonical open Work Session always wins over a simultaneously open Sensor recording -- never double-counted", () => {
  const both = buildRestaurantActiveSession(WORK_SESSION_FIXTURE, 600, false, SENSOR_SESSION_FIXTURE, 120);
  assert.equal(both.kind, "WORKING");
  assert.equal(both.clientName, "Taryn");
  assert.equal(both.elapsedSeconds, 600);
});

test("buildRestaurantViewModel composes selection, commercials, tickets and session without cross-contamination", () => {
  const selected = [
    { id: 1, name: "Taryn", activeCount: 1, reviewCount: 0, blockedCount: 0, health: "ACTIVE", lastActiveAt: null, projects: [] },
  ];
  const model = buildRestaurantViewModel({
    selectedClients: selected,
    commercialByClientId: new Map([[1, { byProject: [{ projectId: 5, projectName: "Bonnie", currency: "USD", amount: 37.5, minutes: 90 }], unallocatedManualEvidence: [] }]]),
    productionOrders: [],
    openSession: null,
    openSessionElapsedSeconds: 0,
    openSessionStale: false,
    openSensorSession: null,
    openSensorSessionElapsedSeconds: 0,
  });
  assert.equal(model.activeSession, null);
  assert.equal(model.clients.length, 1);
  assert.deepEqual(model.clients[0].attributable, [{ currency: "USD", amount: 37.5, minutes: 90 }]);
  assert.deepEqual(model.tickets, []);
});

test("buildRestaurantViewModel surfaces SENSOR_RECORDING through the full composition when no canonical session is open", () => {
  const model = buildRestaurantViewModel({
    selectedClients: [],
    commercialByClientId: new Map(),
    productionOrders: [],
    openSession: null,
    openSessionElapsedSeconds: 0,
    openSessionStale: false,
    openSensorSession: SENSOR_SESSION_FIXTURE,
    openSensorSessionElapsedSeconds: 45,
  });
  assert.equal(model.activeSession.kind, "SENSOR_RECORDING");
  assert.equal(model.activeSession.elapsedSeconds, 45);
});
