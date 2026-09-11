import assert from "node:assert/strict";
import test from "node:test";
import { buildMigratedDb, seedClientAndProject, ingestOrderRowSql, ingestItemsSql } from "./test-helpers.mjs";
import { computeProductionOrderVariance, sumBilledByCurrency } from "./core.ts";

// RMEDIA LET'S COOK Wave 1 — Dave fixture (the exercise document's
// cross-validation case: fixed-price, not hourly/Upwork). The one
// invariant this fixture exists to prove: expected value is a stated
// commercial expectation set once at ingest and never recomputed or
// overwritten by anything downstream -- not by more tracked time, not by
// billing_allocations, not by phase changes.

test("Dave: fixed-price order stores an expected value at ingest", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db, { clientId: 2, projectId: 2, clientName: "Dave", projectName: "Dave — Product Launch" });
  const order = ingestOrderRowSql(db, {
    clientId: 2, projectId: 2, label: "Launch Video", pricingModel: "FIXED",
    expectedValueCents: 150000, currency: "USD", receivedAt: "2026-08-24", ingestKey: "dave-1",
  });
  assert.equal(order.pricing_model, "FIXED");
  assert.equal(order.expected_value_cents, 150000);
});

test("Dave: expected value never changes no matter how much time gets tracked", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db, { clientId: 2, projectId: 2, clientName: "Dave", projectName: "Dave — Product Launch" });
  const order = ingestOrderRowSql(db, {
    clientId: 2, projectId: 2, label: "Launch Video", pricingModel: "FIXED",
    expectedValueCents: 150000, currency: "USD", receivedAt: "2026-08-24", ingestKey: "dave-2",
  });
  ingestItemsSql(db, { orderId: order.id, clientId: 2, projectId: 2, label: "Launch Video", receivedAt: "2026-08-24", itemTitles: ["Launch Cut"] });
  const container = db.prepare(`SELECT id FROM video_logs WHERE production_order_id = ? AND is_operational_container = 1`).get(order.id);

  // Track a lot of time against the container -- far more than a $1500
  // fixed-price job would normally take.
  for (let i = 0; i < 20; i++) {
    db.prepare(`INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, ?, ?)`).run(container.id, i * 10000, i * 10000 + 3600);
  }

  const reread = db.prepare(`SELECT expected_value_cents FROM production_orders WHERE id = ?`).get(order.id);
  assert.equal(reread.expected_value_cents, 150000, "20 extra hours of tracked time did not touch expected_value_cents");

  // No production-orders write path in this Wave ever sets
  // expected_value_cents except the one INSERT at ingest -- confirmed by
  // construction (actions.ts's closeProductionOrder/cancelProductionOrder
  // update only state/closedAt/cancelledAt/updatedAt columns; see core.ts
  // computeProductionOrderVariance below, which is read-only).
});

test("Dave: variance is billed-minus-expected, computed read-only, in the same currency only", () => {
  const variance = computeProductionOrderVariance({
    expectedValueCents: 150000,
    currency: "USD",
    billedByCurrency: sumBilledByCurrency([{ amount: 1600, currency: "USD" }]),
  });
  assert.equal(variance.billedCents, 160000);
  assert.equal(variance.varianceCents, 10000); // billed $100 over expectation
});

test("Dave: a fixed-price order with zero billing_allocations still reports its expectation, billed as null", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db, { clientId: 2, projectId: 2, clientName: "Dave", projectName: "Dave — Product Launch" });
  const order = ingestOrderRowSql(db, {
    clientId: 2, projectId: 2, label: "Launch Video", pricingModel: "FIXED",
    expectedValueCents: 150000, currency: "USD", receivedAt: "2026-08-24", ingestKey: "dave-3",
  });
  const allocations = db.prepare(`SELECT amount, currency FROM billing_allocations`).all();
  assert.equal(allocations.length, 0);
  const variance = computeProductionOrderVariance({
    expectedValueCents: order.expected_value_cents,
    currency: order.currency,
    billedByCurrency: sumBilledByCurrency(allocations),
  });
  assert.equal(variance.billedCents, null);
  assert.equal(variance.varianceCents, null);
});
