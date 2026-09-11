import assert from "node:assert/strict";
import test from "node:test";

import {
  activeDeliverableItems,
  canCancelProductionOrderItem,
  computeProductionOrderTimeBreakdown,
  computeProductionOrderVariance,
  countActiveDeliverables,
  countCancelledDeliverables,
  countDoneDeliverables,
  deriveProductionOrderPhase,
  isProductionOrderMutable,
  isStaleProductionOrder,
  sumBilledByCurrency,
  validateProductionOrderIngestInput,
} from "./core.ts";

function item(status, overrides = {}) {
  return { videoId: overrides.videoId ?? 1, status, cancelledAt: null, isOperationalContainer: false, ...overrides };
}

// ─── Phase derivation ───────────────────────────────────────────────────────

test("phase: no items yet -> RECEIVED", () => {
  assert.equal(deriveProductionOrderPhase([]), "RECEIVED");
});

test("phase: every active item still PLANNED -> RECEIVED", () => {
  assert.equal(deriveProductionOrderPhase([item("PLANNED"), item("PLANNED")]), "RECEIVED");
});

test("phase: any item started -> IN_PRODUCTION", () => {
  assert.equal(deriveProductionOrderPhase([item("PLANNED"), item("IN_PROGRESS")]), "IN_PRODUCTION");
  assert.equal(deriveProductionOrderPhase([item("CHANGES_REQUESTED")]), "IN_PRODUCTION");
});

test("phase: all items READY_FOR_REVIEW or DONE, at least one waiting -> REVIEW", () => {
  assert.equal(deriveProductionOrderPhase([item("READY_FOR_REVIEW"), item("DONE")]), "REVIEW");
  assert.equal(deriveProductionOrderPhase([item("READY_FOR_REVIEW")]), "REVIEW");
});

test("phase: every active item DONE -> DELIVERED", () => {
  assert.equal(deriveProductionOrderPhase([item("DONE"), item("DONE")]), "DELIVERED");
});

test("phase: the operational container is excluded from phase derivation", () => {
  const items = [item("DONE"), item("IN_PROGRESS", { isOperationalContainer: true })];
  // Container is IN_PROGRESS but is not a deliverable -- only the one
  // real deliverable (DONE) counts, so the order reads DELIVERED.
  assert.equal(deriveProductionOrderPhase(items), "DELIVERED");
});

test("phase: a cancelled item is excluded from phase derivation", () => {
  const items = [item("DONE"), item("PLANNED", { cancelledAt: new Date() })];
  assert.equal(deriveProductionOrderPhase(items), "DELIVERED");
});

test("phase: all active items cancelled -> RECEIVED (no active work to judge)", () => {
  const items = [item("IN_PROGRESS", { cancelledAt: new Date() })];
  assert.equal(deriveProductionOrderPhase(items), "RECEIVED");
});

// ─── Active-item counting / cancellation ───────────────────────────────────

test("counts exclude the container and cancelled items consistently", () => {
  const items = [
    item("DONE"),
    item("IN_PROGRESS", { videoId: 2 }),
    item("PLANNED", { videoId: 3, cancelledAt: new Date() }),
    item("PLANNED", { videoId: 4, isOperationalContainer: true }),
  ];
  assert.equal(countActiveDeliverables(items), 2);
  assert.equal(countDoneDeliverables(items), 1);
  assert.equal(countCancelledDeliverables(items), 1);
  assert.deepEqual(activeDeliverableItems(items).map((i) => i.videoId), [1, 2]);
});

test("the container itself can never be cancelled through canCancelProductionOrderItem", () => {
  assert.equal(canCancelProductionOrderItem({ cancelledAt: null, isOperationalContainer: true }), false);
  assert.equal(canCancelProductionOrderItem({ cancelledAt: null, isOperationalContainer: false }), true);
  assert.equal(canCancelProductionOrderItem({ cancelledAt: new Date(), isOperationalContainer: false }), false);
});

// ─── Mixed tracking (locked, corrected semantics) ──────────────────────────

test("mixed tracking: container and item time are computed separately, never combined", () => {
  const breakdown = computeProductionOrderTimeBreakdown({
    containerVideoId: 100,
    sessions: [
      { videoId: 100, startedAt: new Date("2026-08-01T09:00:00Z"), endedAt: new Date("2026-08-01T10:00:00Z") }, // 1h container
      { videoId: 1, startedAt: new Date("2026-08-01T11:00:00Z"), endedAt: new Date("2026-08-01T11:30:00Z") }, // 30m item 1
      { videoId: 2, startedAt: new Date("2026-08-01T11:00:00Z"), endedAt: new Date("2026-08-01T12:00:00Z") }, // 1h item 2
    ],
  });
  assert.equal(breakdown.containerSeconds, 3600);
  assert.equal(breakdown.itemSecondsTotal, 5400);
  assert.deepEqual(
    breakdown.items.map((r) => [r.videoId, r.seconds]).sort(),
    [[1, 1800], [2, 3600]].sort(),
  );
  // No field anywhere on the result adds container + item time together.
  assert.equal(Object.keys(breakdown).includes("totalSeconds"), false);
  assert.equal(Object.keys(breakdown).includes("combinedSeconds"), false);
});

test("mixed tracking: different video_ids may legitimately have overlapping intervals -- both count in full", () => {
  const breakdown = computeProductionOrderTimeBreakdown({
    containerVideoId: null,
    sessions: [
      // Same wall-clock hour, two different videos: real, simultaneous,
      // non-erroneous operator/team time -- never merged or dropped.
      { videoId: 1, startedAt: new Date("2026-08-01T09:00:00Z"), endedAt: new Date("2026-08-01T10:00:00Z") },
      { videoId: 2, startedAt: new Date("2026-08-01T09:15:00Z"), endedAt: new Date("2026-08-01T09:45:00Z") },
    ],
  });
  assert.equal(breakdown.items.find((r) => r.videoId === 1).seconds, 3600);
  assert.equal(breakdown.items.find((r) => r.videoId === 2).seconds, 1800);
  assert.equal(breakdown.itemSecondsTotal, 5400);
});

test("mixed tracking: an open (unended) session contributes zero closed seconds, doesn't crash", () => {
  const breakdown = computeProductionOrderTimeBreakdown({
    containerVideoId: null,
    sessions: [{ videoId: 1, startedAt: new Date("2026-08-01T09:00:00Z"), endedAt: null }],
  });
  assert.equal(breakdown.itemSecondsTotal, 0);
});

// ─── Commercial: expectation vs. billed, read-only ─────────────────────────

test("sumBilledByCurrency groups by currency and ignores non-positive amounts", () => {
  const result = sumBilledByCurrency([
    { amount: 100, currency: "USD" },
    { amount: 50, currency: "USD" },
    { amount: 0, currency: "USD" },
    { amount: -10, currency: "USD" },
    { amount: 200, currency: "BRL" },
  ]);
  assert.deepEqual(result, [
    { currency: "BRL", amount: 200 },
    { currency: "USD", amount: 150 },
  ]);
});

test("Dave fixture: expected value is never touched by variance computation regardless of billed amount", () => {
  const expectedValueCents = 150000; // fixed price
  const variance1 = computeProductionOrderVariance({
    expectedValueCents,
    currency: "USD",
    billedByCurrency: [{ currency: "USD", amount: 1500 }],
  });
  const variance2 = computeProductionOrderVariance({
    expectedValueCents,
    currency: "USD",
    billedByCurrency: [{ currency: "USD", amount: 5000 }], // wildly more tracked/billed
  });
  // The input `expectedValueCents` itself is a caller-owned constant --
  // this function only ever reads it, and neither call above returns or
  // mutates a different expected value than what was passed in.
  assert.equal(variance1.billedCents, 150000);
  assert.equal(variance1.varianceCents, 0);
  assert.equal(variance2.billedCents, 500000);
  assert.equal(variance2.varianceCents, 350000);
});

test("variance is null when no expectation or no matching-currency billing exists", () => {
  assert.deepEqual(
    computeProductionOrderVariance({ expectedValueCents: null, currency: null, billedByCurrency: [] }),
    { billedCents: null, varianceCents: null },
  );
  assert.deepEqual(
    computeProductionOrderVariance({
      expectedValueCents: 1000,
      currency: "USD",
      billedByCurrency: [{ currency: "BRL", amount: 10 }],
    }),
    { billedCents: null, varianceCents: null },
  );
});

// ─── Validation ─────────────────────────────────────────────────────────────

test("validateProductionOrderIngestInput requires client, project, label, date, items", () => {
  const base = {
    clientId: 1,
    projectId: 1,
    label: "Batch 1",
    receivedAt: "2026-08-24",
    ingestKey: "abc",
    items: [{ title: "Video 1" }],
  };
  assert.equal(validateProductionOrderIngestInput(base), null);
  assert.match(validateProductionOrderIngestInput({ ...base, clientId: 0 }), /client/i);
  assert.match(validateProductionOrderIngestInput({ ...base, label: "" }), /label/i);
  assert.match(validateProductionOrderIngestInput({ ...base, receivedAt: "not-a-date" }), /date/i);
  assert.match(validateProductionOrderIngestInput({ ...base, items: [] }), /video/i);
  assert.match(validateProductionOrderIngestInput({ ...base, items: [{ title: "  " }] }), /title/i);
});

// ─── Order lifecycle ────────────────────────────────────────────────────────

test("only an OPEN order is mutable", () => {
  assert.equal(isProductionOrderMutable({ state: "OPEN" }), true);
  assert.equal(isProductionOrderMutable({ state: "CLOSED" }), false);
  assert.equal(isProductionOrderMutable({ state: "CANCELLED" }), false);
});

test("stale-order threshold is exactly the documented window", () => {
  const now = new Date("2026-08-24T00:00:00Z");
  assert.equal(
    isStaleProductionOrder({ id: 1, label: "x", clientName: null, projectName: null, receivedAt: new Date("2026-08-16T00:00:00Z") }, now),
    true,
  );
  assert.equal(
    isStaleProductionOrder({ id: 1, label: "x", clientName: null, projectName: null, receivedAt: new Date("2026-08-20T00:00:00Z") }, now),
    false,
  );
});
