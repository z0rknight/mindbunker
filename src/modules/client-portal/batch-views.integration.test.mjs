import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveProductionOrderPhase, sumBilledByCurrency } from "../production-orders/core.ts";

// Sunday QA Patch hardening round: dedicated coverage for
// getClientBatchViews() (modules/client-portal/data.ts) -- the new
// client-safe Production Order / Batch projection. Mirrors its exact
// three-query assembly (orders, items, containers -> billing allocation
// attribution) against the real migration chain, matching this repo's
// established integration-test convention (see
// portal-views.integration.test.mjs / taryn-ingest-readiness.integration.test.mjs).
// getClientBatchViews() itself never applies the portalCanSeeFinancials
// gate -- that happens one layer up, in getClientPortalView and
// getClientDashboardView (both now strip server-side, identically) -- so
// this file also mirrors that exact gate as its own small pure step,
// verified against both true/false.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) db.exec(trimmed);
    }
  }
  return db;
}

// Verbatim mirror of getClientBatchViews (modules/client-portal/data.ts).
function selectClientBatchViews(db, clientId) {
  const orders = db
    .prepare(
      `SELECT po.id, po.label, po.state, p.name as projectName, po.received_at as receivedAt,
              po.closed_at as closedAt, po.expected_value_cents as expectedValueCents, po.currency
       FROM production_orders po
       INNER JOIN projects p ON p.id = po.project_id
       WHERE po.client_id = ? AND p.client_id = ? AND p.visible_to_client = 1
       ORDER BY po.received_at DESC, po.id DESC`,
    )
    .all(clientId, clientId);
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map(() => "?").join(",");

  const items = db
    .prepare(
      `SELECT v.id, v.production_order_id as productionOrderId, v.title, v.date, v.status,
              v.cancelled_at as cancelledAt, v.is_operational_container as isOperationalContainer
       FROM video_logs v
       INNER JOIN projects p ON p.id = v.project_id
       WHERE v.production_order_id IN (${placeholders})
         AND v.client_id = ? AND p.client_id = ? AND p.visible_to_client = 1
         AND v.is_operational_container = 0 AND v.cancelled_at IS NULL AND v.visible_to_client = 1`,
    )
    .all(...orderIds, clientId, clientId);

  const containers = db
    .prepare(
      `SELECT v.id, v.production_order_id as productionOrderId
       FROM video_logs v
       WHERE v.production_order_id IN (${placeholders})
         AND v.client_id = ? AND v.is_operational_container = 1`,
    )
    .all(...orderIds, clientId);

  const containerIds = containers.map((row) => row.id);
  const allocationRows = containerIds.length > 0
    ? db
        .prepare(
          `SELECT video_id as videoId, amount, currency FROM billing_allocations
           WHERE video_id IN (${containerIds.map(() => "?").join(",")})`,
        )
        .all(...containerIds)
    : [];
  const orderByContainer = new Map(containers.map((row) => [row.id, row.productionOrderId]));

  return orders.map((order) => {
    const orderItems = items.filter((item) => item.productionOrderId === order.id);
    return {
      id: order.id,
      label: order.label,
      state: order.state,
      phase: deriveProductionOrderPhase(
        orderItems.map((item) => ({
          videoId: item.id,
          status: item.status,
          cancelledAt: item.cancelledAt ? new Date(item.cancelledAt * 1000) : null,
          isOperationalContainer: Boolean(item.isOperationalContainer),
        })),
      ),
      projectName: order.projectName,
      receivedAt: order.receivedAt,
      closedAt: order.closedAt ? new Date(order.closedAt * 1000).toISOString() : null,
      items: orderItems.map((item) => ({
        id: item.id,
        title: item.title?.trim() || `Video ${item.date}`,
        status: item.status,
      })),
      expectedValue: order.expectedValueCents != null && order.currency
        ? { amount: order.expectedValueCents / 100, currency: order.currency }
        : null,
      billed: sumBilledByCurrency(
        allocationRows
          .filter((allocation) => orderByContainer.get(allocation.videoId ?? -1) === order.id)
          .map((allocation) => ({ amount: allocation.amount, currency: allocation.currency })),
      ),
    };
  });
}

// Verbatim mirror of the financials gate applied in both
// getClientPortalView and getClientDashboardView (data.ts) -- identical
// on both paths after this round's hardening fix.
function applyFinancialsGate(batches, canSeeFinancials) {
  return canSeeFinancials
    ? batches
    : batches.map((batch) => ({ ...batch, expectedValue: null, billed: [] }));
}

function seedFixture(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES
      (1, 'Taryn Dubreuil', 'active'),
      (2, 'Dave DeMink', 'active');

    -- project 10: Taryn, client-visible. project 11: Taryn, HIDDEN (case F).
    -- project 20: Dave, client-visible.
    INSERT INTO projects (id, client_id, name, status, visible_to_client) VALUES
      (10, 1, 'Mini Series', 'active', 1),
      (11, 1, 'Hidden Project', 'active', 0),
      (20, 2, 'Short Form Videos', 'active', 1);

    INSERT INTO commercial_contracts (id, client_id, platform, billing_type, hourly_rate, currency, status)
    VALUES (1, 1, 'Upwork', 'HOURLY', 25.00, 'USD', 'ACTIVE');

    -- order 100: Taryn's normal batch, contract-linked, expected value set (cases A, K).
    INSERT INTO production_orders (id, client_id, project_id, label, state, contract_id, expected_value_cents, currency, received_at, ingest_key)
    VALUES (100, 1, 10, 'Content Waterfall', 'OPEN', 1, 50000, 'USD', '2026-09-11', 'ik-100');

    -- order 101: Taryn's second batch, no contract, no allocation at all (case J).
    INSERT INTO production_orders (id, client_id, project_id, label, state, expected_value_cents, currency, received_at, ingest_key)
    VALUES (101, 1, 10, 'No Billing Yet', 'OPEN', 20000, 'USD', '2026-09-12', 'ik-101');

    -- order 200: Dave's batch, own container + own billing allocation
    -- (must never leak into Taryn's projection -- case L).
    INSERT INTO production_orders (id, client_id, project_id, label, state, received_at, ingest_key)
    VALUES (200, 2, 20, 'Dave Batch', 'OPEN', '2026-09-11', 'ik-200');

    -- order 300: Taryn's batch inside the HIDDEN project -- must be
    -- excluded from the projection entirely (case F).
    INSERT INTO production_orders (id, client_id, project_id, label, state, received_at, ingest_key)
    VALUES (300, 1, 11, 'Hidden Batch', 'OPEN', '2026-09-11', 'ik-300');

    -- order 100's items: container (500, excluded per case C), a normal
    -- visible item (501), a cancelled item (502, excluded per case D), a
    -- visible_to_client=0 item (503, excluded per case E).
    INSERT INTO video_logs (id, project_id, client_id, production_order_id, title, date, status, is_operational_container, cancelled_at, visible_to_client)
    VALUES
      (500, 10, 1, 100, '[Container] Content Waterfall', '2026-09-11', 'PLANNED', 1, NULL, 1),
      (501, 10, 1, 100, 'Content Waterfall - Video 1', '2026-09-11', 'PLANNED', 0, NULL, 1),
      (502, 10, 1, 100, 'Content Waterfall - Video 2', '2026-09-11', 'PLANNED', 0, unixepoch(), 1),
      (503, 10, 1, 100, 'Content Waterfall - Video 3', '2026-09-11', 'PLANNED', 0, NULL, 0);

    -- order 101's items: just a container, no deliverable, no allocation.
    INSERT INTO video_logs (id, project_id, client_id, production_order_id, title, date, status, is_operational_container, visible_to_client)
    VALUES (510, 10, 1, 101, '[Container] No Billing Yet', '2026-09-12', 'PLANNED', 1, 1);

    -- order 200's (Dave) container + one visible item.
    INSERT INTO video_logs (id, project_id, client_id, production_order_id, title, date, status, is_operational_container, visible_to_client)
    VALUES
      (520, 20, 2, 200, '[Container] Dave Batch', '2026-09-11', 'PLANNED', 1, 1),
      (521, 20, 2, 200, 'Dave Video 1', '2026-09-11', 'PLANNED', 0, 1);

    -- billing evidence + allocation attributed to order 100's container
    -- (500) -- proves container-based attribution (case I).
    INSERT INTO commercial_contracts (id, client_id, platform, billing_type, hourly_rate, currency, status)
    VALUES (2, 2, 'Upwork', 'HOURLY', 30.00, 'USD', 'ACTIVE');
    INSERT INTO billing_evidence (id, contract_id, period_start, period_end, billable_minutes, rate, gross_amount, currency, source, idempotency_key)
    VALUES
      (1, 1, '2026-09-01', '2026-09-30', 240, 25.00, 100.00, 'USD', 'MANUAL', 'be-1'),
      (2, 2, '2026-09-01', '2026-09-30', 60, 30.00, 999.00, 'USD', 'MANUAL', 'be-2');
    INSERT INTO billing_allocations (id, billing_evidence_id, video_id, method, amount, currency)
    VALUES
      (1, 1, 500, 'MANUAL_AMOUNT', 100.00, 'USD'),
      (2, 2, 520, 'MANUAL_AMOUNT', 999.00, 'USD');
  `);
}

test("A. a normal client batch is visible with its real deliverable items", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const result = selectClientBatchViews(db, 1);
  const order100 = result.find((b) => b.id === 100);
  assert.ok(order100, "order 100 must be visible to Taryn");
  assert.equal(order100.label, "Content Waterfall");
  db.close();
});

test("B. another client's batch never appears in this client's projection", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const taryn = selectClientBatchViews(db, 1);
  assert.equal(taryn.some((b) => b.id === 200), false, "Dave's order 200 must not appear for Taryn");
  const dave = selectClientBatchViews(db, 2);
  assert.equal(dave.some((b) => b.id === 100), false, "Taryn's order 100 must not appear for Dave");
  db.close();
});

test("C. the operational container never appears in items", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const order100 = selectClientBatchViews(db, 1).find((b) => b.id === 100);
  assert.equal(order100.items.some((item) => item.id === 500), false);
  assert.equal(order100.items.some((item) => item.title.includes("[Container]")), false);
  db.close();
});

test("D. a cancelled item is excluded from items", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const order100 = selectClientBatchViews(db, 1).find((b) => b.id === 100);
  assert.equal(order100.items.some((item) => item.id === 502), false);
  db.close();
});

test("E. a visible_to_client=false item is excluded from items", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const order100 = selectClientBatchViews(db, 1).find((b) => b.id === 100);
  assert.equal(order100.items.some((item) => item.id === 503), false);
  // The one real, visible, active item must still be present.
  assert.deepEqual(order100.items.map((item) => item.id), [501]);
  db.close();
});

test("F. a batch whose project is visible_to_client=false is excluded entirely", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const taryn = selectClientBatchViews(db, 1);
  assert.equal(taryn.some((b) => b.id === 300), false, "order 300 lives in the hidden project and must not appear at all");
  db.close();
});

test("G. portalCanSeeFinancials=true exposes expected/billed fields", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const gated = applyFinancialsGate(selectClientBatchViews(db, 1), true);
  const order100 = gated.find((b) => b.id === 100);
  assert.deepEqual(order100.expectedValue, { amount: 500, currency: "USD" });
  assert.deepEqual(order100.billed, [{ currency: "USD", amount: 100 }]);
  db.close();
});

test("H. portalCanSeeFinancials=false nulls expected/billed at the server read-model level", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const gated = applyFinancialsGate(selectClientBatchViews(db, 1), false);
  const order100 = gated.find((b) => b.id === 100);
  assert.equal(order100.expectedValue, null);
  assert.deepEqual(order100.billed, []);
  // Not just empty at the top -- every batch in the array must be stripped.
  for (const batch of gated) {
    assert.equal(batch.expectedValue, null);
    assert.deepEqual(batch.billed, []);
  }
  db.close();
});

test("I. billing attribution through the operational container maps to the correct order", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const order100 = selectClientBatchViews(db, 1).find((b) => b.id === 100);
  // $100 was allocated against container 500, which belongs to order 100.
  assert.deepEqual(order100.billed, [{ currency: "USD", amount: 100 }]);
  db.close();
});

test("J. an order with no billing allocation reports no fabricated billed value", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const order101 = selectClientBatchViews(db, 1).find((b) => b.id === 101);
  assert.deepEqual(order101.billed, []);
  assert.notEqual(order101.billed, null, "must be an empty array, not null -- distinct from 'financials hidden'");
  db.close();
});

test("K. a linked contract's identity may inform the batch, but its presence alone fabricates no financial fact", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const order100 = selectClientBatchViews(db, 1).find((b) => b.id === 100);
  // order 100 is contract-linked (contract 1) -- getClientBatchViews itself
  // does not currently project contract identity into ClientBatchView at
  // all (no contractId/contractLabel field on the type), so there is
  // nothing to fabricate: expectedValue/billed still come only from the
  // order's own stated expectation and real billing_allocations, never
  // derived from the contract's rate.
  assert.deepEqual(order100.expectedValue, { amount: 500, currency: "USD" });
  assert.deepEqual(order100.billed, [{ currency: "USD", amount: 100 }]);
  db.close();
});

test("L. a cross-client billing allocation cannot leak into this client's batch projection", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const taryn = selectClientBatchViews(db, 1);
  const serialized = JSON.stringify(taryn);
  // Dave's $999 allocation (against his own container, order 200) must
  // never appear anywhere in Taryn's projection.
  assert.equal(serialized.includes("999"), false);
  const order100 = taryn.find((b) => b.id === 100);
  assert.deepEqual(order100.billed, [{ currency: "USD", amount: 100 }], "only Taryn's own $100 allocation, never Dave's $999");
  db.close();
});
