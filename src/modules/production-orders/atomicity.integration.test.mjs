import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMigratedDb,
  ingestOrderAtomicallySql,
  ingestOrderRowSql,
  ingestItemsSql,
  seedClientAndProject,
} from "./test-helpers.mjs";

function input(overrides = {}) {
  return {
    clientId: 1,
    projectId: 1,
    label: " September Batch ",
    receivedAt: "2026-09-14",
    itemTitles: [" Cut 1 ", "Cut 2", "Cut 3", "Cut 4", "Cut 5"],
    ingestKey: "atomic-five",
    ...overrides,
  };
}

test("valid five-video order persists one order, one container, and five children", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = ingestOrderAtomicallySql(db, input());
  assert.equal(result.success, true);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM production_orders").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM video_logs WHERE is_operational_container = 1").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM video_logs WHERE is_operational_container = 0").get().n, 5);
});

test("child validation failure happens before any business write", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = ingestOrderAtomicallySql(db, input({ itemTitles: ["Good", "   "] }));
  assert.equal(result.success, false);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM production_orders").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM video_logs").get().n, 0);
});

test("injected child persistence failure rolls back order, container, and prior children", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = ingestOrderAtomicallySql(db, input(), { failAtChildIndex: 2 });
  assert.equal(result.success, false);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM production_orders").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM video_logs").get().n, 0);
});

test("same ingest key retry creates no duplicate business state", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  assert.equal(ingestOrderAtomicallySql(db, input()).success, true);
  const retry = ingestOrderAtomicallySql(db, input());
  assert.equal(retry.success, true);
  assert.equal(retry.skipped, true);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM production_orders").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM video_logs").get().n, 6);
});

test("operational container remains excluded from the ordinary Productivity queue", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  ingestOrderAtomicallySql(db, input());
  const queueRows = db
    .prepare("SELECT title FROM video_logs WHERE is_operational_container = 0 AND cancelled_at IS NULL")
    .all();
  assert.equal(queueRows.length, 5);
  assert.equal(queueRows.some((row) => row.title.startsWith("[Container]")), false);
});

test("children use ordinary Add normalization and safe creation defaults", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  ingestOrderAtomicallySql(db, input());
  const child = db
    .prepare(`SELECT title, status, delivered, video_kind, visible_to_client,
                     started_at, revisions_count, cancelled_at
              FROM video_logs WHERE is_operational_container = 0 ORDER BY id LIMIT 1`)
    .get();
  assert.deepEqual({ ...child }, {
    title: "Cut 1",
    status: "PLANNED",
    delivered: 0,
    video_kind: "CLIENT_WORK",
    visible_to_client: 1,
    started_at: null,
    revisions_count: 0,
    cancelled_at: null,
  });
});

test("existing pre-hardening order remains readable", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, {
    clientId: 1,
    projectId: 1,
    label: "Legacy Batch",
    receivedAt: "2026-08-24",
    ingestKey: "legacy-order",
  });
  ingestItemsSql(db, {
    orderId: order.id,
    clientId: 1,
    projectId: 1,
    label: "Legacy Batch",
    receivedAt: "2026-08-24",
    itemTitles: ["Legacy Cut"],
  });
  const stored = db.prepare("SELECT * FROM production_orders WHERE id = ?").get(order.id);
  const items = db.prepare("SELECT * FROM video_logs WHERE production_order_id = ? ORDER BY id").all(order.id);
  assert.equal(stored.label, "Legacy Batch");
  assert.equal(items.length, 2);
  assert.equal(items[0].is_operational_container, 1);
  assert.equal(items[1].title, "Legacy Cut");
});
