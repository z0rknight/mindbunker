import assert from "node:assert/strict";
import test from "node:test";
import { buildMigratedDb, seedClientAndProject, ingestOrderRowSql } from "./test-helpers.mjs";

// Sep 18 Morning Congruence Patch — existing-video batch composition.
// Operator-reported, verbatim: "seria interessante o let's cook dar a
// opção de começar a trabalhar em um lote já existente de videos, eu
// aponto os videos que vão formar o 'pedido'." This mirrors
// attachExistingVideosToProductionOrder's exact SQL/validation sequence
// against the real migration chain (this repo's established pattern --
// see dave/taryn/mixed-tracking.integration.test.mjs), not a hand-written
// approximation of the schema.

function insertPlainVideo(db, { clientId, projectId, title, isOperationalContainer = 0, cancelledAt = null, productionOrderId = null }) {
  const result = db
    .prepare(
      `INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, video_kind, is_operational_container, production_order_id, cancelled_at)
       VALUES ('2026-09-18', ?, ?, ?, 'PLANNED', 0, 'CLIENT_WORK', ?, ?, ?)`,
    )
    .run(title, clientId, projectId, isOperationalContainer, productionOrderId, cancelledAt);
  return Number(result.lastInsertRowid);
}

// Exact mirror of attachExistingVideosToProductionOrder's validation +
// write sequence (modules/production-orders/actions.ts).
function attachExistingVideosSql(db, { orderId, videoIds }) {
  const order = db.prepare(`SELECT id, project_id, state FROM production_orders WHERE id = ?`).get(orderId);
  if (!order) return { success: false, error: "Production Order not found." };
  if (order.state !== "OPEN") return { success: false, error: "This order is no longer open." };

  const placeholders = videoIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT id, project_id, production_order_id, is_operational_container, cancelled_at FROM video_logs WHERE id IN (${placeholders})`)
    .all(...videoIds);
  if (rows.length !== videoIds.length) return { success: false, error: "One or more selected videos could not be found." };

  for (const row of rows) {
    if (row.is_operational_container) return { success: false, error: "A batch container cannot itself be attached as a deliverable." };
    if (row.cancelled_at !== null) return { success: false, error: "A cancelled video cannot be attached to a batch." };
    if (row.project_id !== order.project_id) return { success: false, error: "Every selected video must already belong to this order's own project." };
    if (row.production_order_id !== null) return { success: false, error: "One or more selected videos already belong to a different Production Order." };
  }

  db.prepare(`UPDATE video_logs SET production_order_id = ? WHERE id IN (${placeholders})`).run(orderId, ...videoIds);
  return { success: true, orderId };
}

test("attaches several already-existing, unassigned videos from the same project in one call", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db, { clientId: 1, projectId: 1 });
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Second batch", receivedAt: "2026-09-18", ingestKey: "wave2a-1" });
  const v1 = insertPlainVideo(db, { clientId: 1, projectId: 1, title: "Marketing 101 Clip 1" });
  const v2 = insertPlainVideo(db, { clientId: 1, projectId: 1, title: "Text Hooks" });

  const result = attachExistingVideosSql(db, { orderId: order.id, videoIds: [v1, v2] });
  assert.equal(result.success, true);

  const rows = db.prepare(`SELECT id, production_order_id FROM video_logs WHERE id IN (?, ?)`).all(v1, v2);
  assert.deepEqual(rows.map((r) => r.production_order_id).sort(), [order.id, order.id]);
  // The video's own id, status, and every other fact are untouched -- this
  // call only ever sets production_order_id.
  const statuses = db.prepare(`SELECT status FROM video_logs WHERE id IN (?, ?)`).all(v1, v2);
  assert.deepEqual(statuses.map((r) => r.status), ["PLANNED", "PLANNED"]);
});

test("rejects a video from a different project -- client/project integrity is never silently crossed", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db, { clientId: 1, projectId: 1 });
  seedClientAndProject(db, { clientId: 2, projectId: 2, clientName: "Dave DeMink", projectName: "Dave Project" });
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Taryn batch", receivedAt: "2026-09-18", ingestKey: "wave2a-2" });
  const foreignVideo = insertPlainVideo(db, { clientId: 2, projectId: 2, title: "Dave's own video" });

  const result = attachExistingVideosSql(db, { orderId: order.id, videoIds: [foreignVideo] });
  assert.equal(result.success, false);
  assert.match(result.error, /own project/u);

  const row = db.prepare(`SELECT production_order_id FROM video_logs WHERE id = ?`).get(foreignVideo);
  assert.equal(row.production_order_id, null, "a rejected attach must never partially apply");
});

test("rejects a video that already belongs to a different Production Order -- no silent re-parenting", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db, { clientId: 1, projectId: 1 });
  const orderA = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch A", receivedAt: "2026-09-18", ingestKey: "wave2a-3a" });
  const orderB = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch B", receivedAt: "2026-09-18", ingestKey: "wave2a-3b" });
  const alreadyBatched = insertPlainVideo(db, { clientId: 1, projectId: 1, title: "Already in Batch A", productionOrderId: orderA.id });

  const result = attachExistingVideosSql(db, { orderId: orderB.id, videoIds: [alreadyBatched] });
  assert.equal(result.success, false);
  assert.match(result.error, /already belong/u);

  const row = db.prepare(`SELECT production_order_id FROM video_logs WHERE id = ?`).get(alreadyBatched);
  assert.equal(row.production_order_id, orderA.id, "must stay exactly where it was, not silently moved to Batch B");
});

test("rejects a container row -- a container is never itself a deliverable", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db, { clientId: 1, projectId: 1 });
  const orderA = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch A", receivedAt: "2026-09-18", ingestKey: "wave2a-4a" });
  const orderB = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch B", receivedAt: "2026-09-18", ingestKey: "wave2a-4b" });
  const containerId = insertPlainVideo(db, { clientId: 1, projectId: 1, title: "[Container] Batch A", isOperationalContainer: 1, productionOrderId: orderA.id });

  const result = attachExistingVideosSql(db, { orderId: orderB.id, videoIds: [containerId] });
  assert.equal(result.success, false);
  assert.match(result.error, /container/u);
});

test("rejects a cancelled video", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db, { clientId: 1, projectId: 1 });
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch A", receivedAt: "2026-09-18", ingestKey: "wave2a-5" });
  const cancelled = insertPlainVideo(db, { clientId: 1, projectId: 1, title: "Cancelled clip", cancelledAt: Math.floor(Date.now() / 1000) });

  const result = attachExistingVideosSql(db, { orderId: order.id, videoIds: [cancelled] });
  assert.equal(result.success, false);
  assert.match(result.error, /cancelled/u);
});

test("rejects attaching to a CLOSED order", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db, { clientId: 1, projectId: 1 });
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch A", receivedAt: "2026-09-18", ingestKey: "wave2a-6" });
  db.prepare(`UPDATE production_orders SET state = 'CLOSED' WHERE id = ?`).run(order.id);
  const v1 = insertPlainVideo(db, { clientId: 1, projectId: 1, title: "Some clip" });

  const result = attachExistingVideosSql(db, { orderId: order.id, videoIds: [v1] });
  assert.equal(result.success, false);
  assert.match(result.error, /no longer open/u);
});
