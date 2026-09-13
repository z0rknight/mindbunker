import assert from "node:assert/strict";
import test from "node:test";
import { buildMigratedDb, seedClientAndProject, ingestOrderRowSql, ingestItemsSql } from "./test-helpers.mjs";
import { deriveProductionOrderPhase, activeDeliverableItems } from "./core.ts";

// RMEDIA LET'S COOK Wave 1 — Taryn Dubreuil fixture (the exercise
// document's canonical hourly/Upwork, 6-video "Content Waterfall" batch),
// run against the real migrated schema (0000..HEAD, including 0044's new
// production_orders table and video_logs additions).

function readItems(db, orderId) {
  return db
    .prepare(
      `SELECT id as videoId, status, cancelled_at as cancelledAt, is_operational_container as isOperationalContainer
       FROM video_logs WHERE production_order_id = ?`,
    )
    .all(orderId)
    .map((r) => ({ ...r, cancelledAt: r.cancelledAt ? new Date(r.cancelledAt) : null, isOperationalContainer: !!r.isOperationalContainer }));
}

test("Taryn: creation invariants — one order, one container, N deliverables, all linked", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, {
    clientId: 1, projectId: 1, label: "Content Waterfall — Batch 1",
    pricingModel: "HOURLY", receivedAt: "2026-08-24", ingestKey: "taryn-batch-1",
  });
  const result = ingestItemsSql(db, {
    orderId: order.id, clientId: 1, projectId: 1, label: "Content Waterfall — Batch 1",
    receivedAt: "2026-08-24",
    itemTitles: ["Reel 1", "Reel 2", "Reel 3", "Reel 4", "Reel 5", "Reel 6"],
  });
  assert.equal(result.skipped, false);
  assert.equal(result.itemIds.length, 6);

  const rows = readItems(db, order.id);
  assert.equal(rows.length, 7); // 1 container + 6 deliverables
  assert.equal(rows.filter((r) => r.isOperationalContainer).length, 1);
  assert.equal(rows.filter((r) => !r.isOperationalContainer).length, 6);
  for (const row of rows) assert.equal(row.status, "PLANNED");
});

test("Batch contract migration is additive and preserves legacy orders", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, {
    clientId: 1,
    projectId: 1,
    label: "Legacy batch",
    receivedAt: "2026-08-24",
    ingestKey: "legacy-contract-null",
  });

  const columns = db.prepare(`PRAGMA table_info(production_orders)`).all();
  assert.ok(columns.some((column) => column.name === "contract_id"));
  assert.equal(
    db.prepare(`SELECT contract_id FROM production_orders WHERE id = ?`).get(order.id).contract_id,
    null,
    "existing orders stay valid without a fabricated contract",
  );

  db.prepare(
    `INSERT INTO commercial_contracts (client_id, platform, billing_type, hourly_rate, currency, status)
     VALUES (1, 'Upwork', 'HOURLY', 25, 'USD', 'ACTIVE')`,
  ).run();
  const contractId = db.prepare(`SELECT id FROM commercial_contracts WHERE client_id = 1`).get().id;
  db.prepare(`UPDATE production_orders SET contract_id = ? WHERE id = ?`).run(contractId, order.id);
  assert.equal(
    db.prepare(`SELECT contract_id FROM production_orders WHERE id = ?`).get(order.id).contract_id,
    contractId,
  );
  assert.throws(
    () => db.prepare(`UPDATE production_orders SET contract_id = 999999 WHERE id = ?`).run(order.id),
    /FOREIGN KEY constraint failed/,
  );
  assert.deepEqual(db.prepare(`PRAGMA foreign_key_check`).all(), []);
});

test("Taryn: the container is excluded from Sensor-eligible deliverable counting semantics but stays a real video_logs row", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", ingestKey: "k1" });
  ingestItemsSql(db, { orderId: order.id, clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", itemTitles: ["A", "B"] });
  const rows = readItems(db, order.id);
  const container = rows.find((r) => r.isOperationalContainer);
  assert.ok(container, "container row exists and is queryable like any other video_logs row");
  assert.equal(activeDeliverableItems(rows).length, 2, "container excluded from active deliverable set");
});

test("Taryn: only one operational container per order is allowed (video_logs_one_container_per_order_idx)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", ingestKey: "k2" });
  ingestItemsSql(db, { orderId: order.id, clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", itemTitles: ["A"] });

  assert.throws(() => {
    db.prepare(
      `INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, is_operational_container, production_order_id)
       VALUES ('2026-08-24', 'Second container', 1, 1, 'PLANNED', 0, 1, ?)`,
    ).run(order.id);
  }, /UNIQUE constraint failed/);
});

test("Taryn: cancelling an item preserves history and shrinks the active-item denominator only", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", ingestKey: "k3" });
  const { itemIds } = ingestItemsSql(db, { orderId: order.id, clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", itemTitles: ["Reel 1", "Reel 2", "Reel 3"] });

  // Give the cancelled item real history: a work session and a status change.
  db.prepare(`UPDATE video_logs SET status = 'IN_PROGRESS' WHERE id = ?`).run(itemIds[0]);
  db.prepare(`INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, 100, 700)`).run(itemIds[0]);

  const before = readItems(db, order.id);
  assert.equal(activeDeliverableItems(before).length, 3);

  db.prepare(`UPDATE video_logs SET cancelled_at = ? WHERE id = ?`).run(Date.now(), itemIds[0]);

  const after = readItems(db, order.id);
  assert.equal(activeDeliverableItems(after).length, 2, "active denominator shrinks by exactly one");
  assert.equal(after.length, before.length, "row count unchanged -- nothing deleted");
  const cancelled = after.find((r) => r.videoId === itemIds[0]);
  assert.equal(cancelled.status, "IN_PROGRESS", "status is untouched by cancellation");
  const sessionStillThere = db.prepare(`SELECT COUNT(*) as n FROM work_sessions WHERE video_id = ?`).get(itemIds[0]);
  assert.equal(sessionStillThere.n, 1, "the work session survives cancellation intact");
});

test("Taryn: phase transitions follow active-item status exactly", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", ingestKey: "k4" });
  const { itemIds } = ingestItemsSql(db, { orderId: order.id, clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", itemTitles: ["Reel 1", "Reel 2"] });

  assert.equal(deriveProductionOrderPhase(readItems(db, order.id)), "RECEIVED");

  db.prepare(`UPDATE video_logs SET status = 'IN_PROGRESS' WHERE id = ?`).run(itemIds[0]);
  assert.equal(deriveProductionOrderPhase(readItems(db, order.id)), "IN_PRODUCTION");

  db.prepare(`UPDATE video_logs SET status = 'READY_FOR_REVIEW' WHERE id = ?`).run(itemIds[0]);
  db.prepare(`UPDATE video_logs SET status = 'READY_FOR_REVIEW' WHERE id = ?`).run(itemIds[1]);
  assert.equal(deriveProductionOrderPhase(readItems(db, order.id)), "REVIEW");

  db.prepare(`UPDATE video_logs SET status = 'DONE' WHERE id = ?`).run(itemIds[0]);
  db.prepare(`UPDATE video_logs SET status = 'DONE' WHERE id = ?`).run(itemIds[1]);
  assert.equal(deriveProductionOrderPhase(readItems(db, order.id)), "DELIVERED");
});

test("Taryn: commercial allocation flows through the container video, not the deliverables", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch 1", pricingModel: "HOURLY", receivedAt: "2026-08-24", ingestKey: "k5" });
  ingestItemsSql(db, { orderId: order.id, clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", itemTitles: ["Reel 1"] });
  const container = db.prepare(`SELECT id FROM video_logs WHERE production_order_id = ? AND is_operational_container = 1`).get(order.id);

  db.prepare(`INSERT INTO commercial_contracts (client_id, platform, billing_type, hourly_rate, currency) VALUES (1, 'Upwork', 'HOURLY', 50, 'USD')`).run();
  const contractId = db.prepare(`SELECT id FROM commercial_contracts WHERE client_id = 1`).get().id;
  db.prepare(
    `INSERT INTO billing_evidence (contract_id, period_start, period_end, billable_minutes, rate, gross_amount, currency, source, idempotency_key)
     VALUES (?, '2026-08-18', '2026-08-24', 600, 50, 500, 'USD', 'MANUAL', 'k5-evidence')`,
  ).run(contractId);
  const evidenceId = db.prepare(`SELECT id FROM billing_evidence WHERE currency = 'USD'`).get().id;
  db.prepare(`INSERT INTO billing_allocations (billing_evidence_id, video_id, method, amount, currency) VALUES (?, ?, 'MANUAL_AMOUNT', 500, 'USD')`).run(evidenceId, container.id);

  const allocations = db.prepare(`SELECT amount, currency FROM billing_allocations WHERE video_id = ?`).all(container.id);
  assert.equal(allocations.length, 1);
  assert.equal(allocations[0].amount, 500);

  // No automatic billing evidence/revenue is created by ingest itself --
  // confirm ingest alone (without this explicit INSERT above) never
  // populates billing_evidence for this client.
  const db2 = buildMigratedDb();
  seedClientAndProject(db2);
  const order2 = ingestOrderRowSql(db2, { clientId: 1, projectId: 1, label: "Batch 2", receivedAt: "2026-08-24", ingestKey: "k6" });
  ingestItemsSql(db2, { orderId: order2.id, clientId: 1, projectId: 1, label: "Batch 2", receivedAt: "2026-08-24", itemTitles: ["Reel 1"] });
  const evidenceCount = db2.prepare(`SELECT COUNT(*) as n FROM billing_evidence`).get().n;
  assert.equal(evidenceCount, 0, "ingest never fabricates billing evidence or revenue on its own");
});

test("Taryn: idempotency — retrying the same ingest key never creates a second order or duplicate items", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const key = "taryn-retry-key";

  const attempt1 = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", ingestKey: key });
  const items1 = ingestItemsSql(db, { orderId: attempt1.id, clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", itemTitles: ["Reel 1", "Reel 2"] });
  assert.equal(items1.skipped, false);

  // Simulate a network retry / double-click of the exact same submit.
  const attempt2 = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", ingestKey: key });
  const items2 = ingestItemsSql(db, { orderId: attempt2.id, clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", itemTitles: ["Reel 1", "Reel 2"] });

  assert.equal(attempt1.id, attempt2.id, "same order id resolved both times");
  assert.equal(items2.skipped, true, "second attempt does not re-create items");

  const orderCount = db.prepare(`SELECT COUNT(*) as n FROM production_orders WHERE ingest_key = ?`).get(key).n;
  assert.equal(orderCount, 1);
  const itemCount = db.prepare(`SELECT COUNT(*) as n FROM video_logs WHERE production_order_id = ?`).get(attempt1.id).n;
  assert.equal(itemCount, 3, "1 container + 2 deliverables, not 6");
});
