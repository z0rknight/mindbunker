import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildClientPortalProjects, buildClientDashboard } from "./core.ts";

// Client Portal Reality round: getClientPortalView / getClientDashboardView
// (modules/client-portal/data.ts) are the one gap in this module's test
// coverage relative to the rest of the repo -- every other major module has
// an integration test replaying its exact SQL against the real migration
// chain, this one didn't. Both functions call getDb()/getAuthenticatedDb(),
// which need a Cloudflare Workers request context this test runner doesn't
// have, so -- same convention as fx/fx-personal-ledger.integration.test.mjs
// and finance/taryn-ingest-readiness.integration.test.mjs -- this file
// mirrors their exact SELECT statements verbatim and feeds the raw rows
// into the real, imported buildClientPortalProjects/buildClientDashboard.

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

// Mirrors data.ts's getClientPortalView project/video SELECT verbatim
// (minus the token->clientId resolution, which is gateway/auth-data's job,
// not this module's).
function selectPortalRowsForClient(db, clientId) {
  const projectRows = db
    .prepare(
      `SELECT id, client_id as clientId, name, status, deadline
       FROM projects WHERE client_id = ? AND visible_to_client = 1
       ORDER BY updated_at DESC, id DESC`,
    )
    .all(clientId);
  const videoRows = db
    .prepare(
      `SELECT
         v.id as id,
         v.project_id as projectId,
         v.client_id as clientId,
         p.client_id as projectClientId,
         v.title as title,
         v.date as date,
         v.status as status,
         v.delivery_url as deliveryUrl,
         v.review_url as reviewUrl,
         v.published_url as publishedUrl,
         v.batch_label as batchLabel,
         v.cover_url as coverUrl,
         p.cover_url as projectCoverUrl,
         v.created_at as createdAt,
         v.updated_at as updatedAt
       FROM video_logs v
       INNER JOIN projects p ON v.project_id = p.id
       WHERE v.client_id = ? AND p.client_id = ?
         AND p.visible_to_client = 1 AND v.visible_to_client = 1
         AND v.is_operational_container = 0 AND v.cancelled_at IS NULL
       ORDER BY v.updated_at DESC, v.created_at DESC`,
    )
    .all(clientId, clientId)
    .map((row) => ({
      ...row,
      createdAt: row.createdAt ? new Date(row.createdAt * 1000) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt * 1000) : null,
    }));
  return { projectRows, videoRows };
}

// Mirrors data.ts's getClientDashboardView project/video/completion-event
// SELECT verbatim -- unlike getClientPortalView's video SELECT above, this
// one also carries orientation/contentType/isPriority (ClientDashboardVideoRow
// needs them; ClientPortalVideoRow doesn't).
function selectDashboardRowsForClient(db, clientId) {
  const projectRows = db
    .prepare(
      `SELECT id, client_id as clientId, name, status, deadline
       FROM projects WHERE client_id = ? AND visible_to_client = 1
       ORDER BY updated_at DESC, id DESC`,
    )
    .all(clientId);
  const videoRows = db
    .prepare(
      `SELECT
         v.id as id,
         v.project_id as projectId,
         v.client_id as clientId,
         p.client_id as projectClientId,
         v.title as title,
         v.date as date,
         v.status as status,
         v.delivery_url as deliveryUrl,
         v.review_url as reviewUrl,
         v.published_url as publishedUrl,
         v.batch_label as batchLabel,
         v.cover_url as coverUrl,
         p.cover_url as projectCoverUrl,
         v.orientation as orientation,
         v.content_type as contentType,
         v.is_priority as isPriority,
         v.created_at as createdAt,
         v.updated_at as updatedAt
       FROM video_logs v
       INNER JOIN projects p ON v.project_id = p.id
       WHERE v.client_id = ? AND p.client_id = ?
         AND p.visible_to_client = 1 AND v.visible_to_client = 1
         AND v.is_operational_container = 0 AND v.cancelled_at IS NULL
       ORDER BY v.updated_at DESC, v.created_at DESC`,
    )
    .all(clientId, clientId)
    .map((row) => ({
      ...row,
      isPriority: Boolean(row.isPriority),
      createdAt: row.createdAt ? new Date(row.createdAt * 1000) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt * 1000) : null,
    }));
  const completionEventRows = db
    .prepare(
      `SELECT video_id as videoId, created_at as createdAt
       FROM crm_events
       WHERE client_id = ? AND type = 'video.finished'
       ORDER BY created_at DESC LIMIT 100`,
    )
    .all(clientId)
    .map((row) => ({
      ...row,
      createdAt: row.createdAt ? new Date(row.createdAt * 1000) : null,
    }));
  return { projectRows, videoRows, completionEventRows };
}

function seedTarynShapedFixture(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES
      (1, 'Taryn Dubreuil', 'active'),
      (2, 'Other Client', 'active');

    INSERT INTO projects (id, client_id, name, status, deadline, cover_url) VALUES
      (10, 1, 'MINI Series', 'active', '2026-09-01', 'https://cdn.example/mini-series-cover.jpg'),
      (11, 1, 'Bonnie - Content Waterfall', 'planned', NULL, NULL),
      (99, 2, 'Other client secret project', 'active', NULL, NULL);

    INSERT INTO video_logs
      (id, project_id, client_id, title, date, status, delivery_url, review_url, published_url, cover_url)
    VALUES
      (201, 10, 1, 'MINI Series Ep 1', '2026-08-20', 'IN_PROGRESS', NULL, NULL, NULL, 'https://cdn.example/ep1-cover.jpg'),
      (202, 10, 1, 'MINI Series Ep 2 (no own cover)', '2026-08-15', 'READY_FOR_REVIEW', NULL, 'https://review.example/ep2', NULL, NULL),
      (203, 10, 1, 'MINI Series Ep 0 (delivered, no link yet)', '2026-08-01', 'DONE', NULL, NULL, NULL, NULL),
      (204, 11, 1, 'Bonnie Reel 1 (delivered with link)', '2026-08-10', 'DONE', 'https://drive.example/bonnie-1', NULL, NULL, NULL),
      (301, 99, 2, 'Other client private video', '2026-08-20', 'DONE', 'https://video.example/private', NULL, NULL, NULL);

    UPDATE video_logs SET batch_label = 'MINI SERIES · Six episodes' WHERE id IN (201, 202, 203);

    INSERT INTO crm_events (client_id, video_id, type, description, created_at) VALUES
      (1, 204, 'video.finished', 'Bonnie Reel 1 marked DONE', unixepoch());
  `);
}

test("getClientPortalView's exact SQL projection: cross-client isolation holds over the real migration chain", () => {
  const db = buildMigratedDb();
  seedTarynShapedFixture(db);

  const { projectRows, videoRows } = selectPortalRowsForClient(db, 1);
  const result = buildClientPortalProjects(1, projectRows, videoRows);

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("Other client"), false);
  assert.equal(serialized.includes("private"), false);

  const names = result.map((p) => p.name).sort();
  assert.deepEqual(names, ["Bonnie - Content Waterfall", "MINI Series"]);
});

test("getClientPortalView's exact SQL projection: cover fallback chain resolves through a real join, and Delivered vs Completed reflects the real deliveryUrl column", () => {
  const db = buildMigratedDb();
  seedTarynShapedFixture(db);

  const { projectRows, videoRows } = selectPortalRowsForClient(db, 1);
  const result = buildClientPortalProjects(1, projectRows, videoRows);
  const miniSeries = result.find((p) => p.name === "MINI Series");
  const videoById = new Map(miniSeries.videos.map((v) => [v.id, v]));

  // Ep 1 has its own cover -- wins outright.
  assert.equal(videoById.get(201).coverUrl, "https://cdn.example/ep1-cover.jpg");
  assert.equal(videoById.get(201).batchLabel, "MINI SERIES · Six episodes");
  // Ep 2 has no own cover -- falls back to the project's cover.
  assert.equal(videoById.get(202).coverUrl, "https://cdn.example/mini-series-cover.jpg");
  // Ep 0 is DONE with no deliveryUrl -- "Completed", not "Delivered".
  assert.equal(videoById.get(203).status, "Completed");

  const bonnie = result.find((p) => p.name === "Bonnie - Content Waterfall");
  // Bonnie Reel 1 is DONE with a real deliveryUrl -- "Delivered".
  assert.equal(bonnie.videos[0].status, "Delivered");
});

test("getClientDashboardView's exact SQL projection: cross-client isolation and recent-deliveries all hold over the real migration chain", () => {
  const db = buildMigratedDb();
  seedTarynShapedFixture(db);

  const { projectRows, videoRows, completionEventRows } = selectDashboardRowsForClient(db, 1);
  const result = buildClientDashboard(1, projectRows, videoRows, completionEventRows, new Date());

  assert.equal(result.totalVideos, 4, "only Taryn's own 4 videos are counted, not the other client's");
  assert.equal(result.recentDeliveries.length, 1);
  assert.equal(result.recentDeliveries[0].id, 204);
  assert.equal(result.recentDeliveries[0].status, "DONE");
  assert.equal(result.recentDeliveries[0].statusLabel, "Delivered");
  assert.equal(result.allVideos.find((video) => video.id === 201).batchLabel, "MINI SERIES · Six episodes");

  const otherClientRows = selectDashboardRowsForClient(db, 2);
  const otherResult = buildClientDashboard(
    2,
    otherClientRows.projectRows,
    otherClientRows.videoRows,
    otherClientRows.completionEventRows,
    new Date(),
  );
  assert.equal(otherResult.totalVideos, 1);
  assert.equal(JSON.stringify(otherResult).includes("MINI Series"), false);
});

test("getClientDashboardView's exact SQL projection never selects internal-only columns (notes, revenue, revisions)", () => {
  const db = buildMigratedDb();
  seedTarynShapedFixture(db);
  db.exec(`UPDATE video_logs SET notes = 'private editing note', revisions_count = 7 WHERE id = 201;`);
  db.exec(`UPDATE clients SET notes = 'confidential CRM note', total_revenue = 5000 WHERE id = 1;`);

  const { projectRows, videoRows, completionEventRows } = selectDashboardRowsForClient(db, 1);
  const result = buildClientDashboard(1, projectRows, videoRows, completionEventRows, new Date());

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("private editing note"), false);
  assert.equal(serialized.includes("confidential CRM note"), false);
  assert.equal(serialized.includes("5000"), false);
});

test("explicit project/video visibility controls remove rows from both client projections", () => {
  const db = buildMigratedDb();
  seedTarynShapedFixture(db);
  db.exec(`
    UPDATE video_logs SET visible_to_client = 0 WHERE id = 201;
    UPDATE projects SET visible_to_client = 0 WHERE id = 11;
  `);

  const portal = selectPortalRowsForClient(db, 1);
  assert.equal(portal.projectRows.some((row) => row.id === 11), false);
  assert.equal(portal.videoRows.some((row) => row.id === 201), false);
  assert.equal(portal.videoRows.some((row) => row.projectId === 11), false);

  const dashboard = selectDashboardRowsForClient(db, 1);
  assert.equal(dashboard.projectRows.some((row) => row.id === 11), false);
  assert.equal(dashboard.videoRows.some((row) => row.id === 201), false);
  assert.equal(dashboard.videoRows.some((row) => row.projectId === 11), false);
});

// Dave Monday Release: getClientDashboardView's server-side financial gate
// on paymentRequest -- mirrors the exact ternary in data.ts (identical
// pattern to the one already applied to `batches`).
function selectOpenPaymentRequest(db, clientId) {
  return db
    .prepare(
      `SELECT id, client_id as clientId, amount_cents as amountCents, currency,
              payment_url as paymentUrl, status, note
       FROM payment_requests WHERE client_id = ? AND status = 'OPEN' LIMIT 1`,
    )
    .get(clientId);
}

function gatedPaymentRequest(row, canSeeFinancials) {
  if (!canSeeFinancials) return null;
  if (!row || row.status !== "OPEN") return null;
  return { amountCents: row.amountCents, currency: row.currency, paymentUrl: row.paymentUrl };
}

test("Dave-shaped fixture: portalCanSeeFinancials=true exposes the real OPEN payment request", () => {
  const db = buildMigratedDb();
  seedTarynShapedFixture(db);
  db.exec(`
    UPDATE clients SET name = 'Dave DeMink' WHERE id = 2;
    INSERT INTO payment_requests (id, client_id, amount_cents, currency, payment_url, status)
    VALUES (1, 2, 37266, 'USD', 'https://wise.com/pay/r/HO2YUO3U08AXDzo', 'OPEN');
  `);

  const row = selectOpenPaymentRequest(db, 2);
  const view = gatedPaymentRequest(row, true);
  assert.deepEqual(view, {
    amountCents: 37266,
    currency: "USD",
    paymentUrl: "https://wise.com/pay/r/HO2YUO3U08AXDzo",
  });
  db.close();
});

test("portalCanSeeFinancials=false strips the payment request server-side, indistinguishable from no request at all", () => {
  const db = buildMigratedDb();
  seedTarynShapedFixture(db);
  db.exec(`
    INSERT INTO payment_requests (id, client_id, amount_cents, currency, payment_url, status)
    VALUES (1, 2, 37266, 'USD', 'https://wise.com/pay/r/HO2YUO3U08AXDzo', 'OPEN');
  `);

  const row = selectOpenPaymentRequest(db, 2);
  const view = gatedPaymentRequest(row, false);
  assert.equal(view, null);
  db.close();
});

test("payment request client isolation: another client's OPEN request never resolves for this client", () => {
  const db = buildMigratedDb();
  seedTarynShapedFixture(db);
  db.exec(`
    INSERT INTO payment_requests (id, client_id, amount_cents, currency, payment_url, status)
    VALUES (1, 1, 10000, 'USD', 'https://wise.com/pay/r/taryn', 'OPEN');
  `);

  const daveRow = selectOpenPaymentRequest(db, 2);
  assert.equal(daveRow, undefined);
  db.close();
});
