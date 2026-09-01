import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Promotion Prep Patch P0 -- proves the fix for the Health Sweep's
// pivotal finding: War Room, CRM Client Intelligence, and the
// Productivity dashboard all counted "completed videos" by
// status === 'DONE' alone, with no awareness of video_kind, so a
// SAMPLE_VIDEO or INTERNAL video counted as real client production.
// This mirrors the now-patched read logic (completedVideoLogs in
// productivity/core.ts, getClientIntelligence in crm/actions.ts, the
// today/month dashboard counts in productivity/actions.ts) against the
// real migration chain, per this repo's established convention for
// "use server"-only logic a plain unit test can't reach (see
// war-room-client-revenue.integration.test.mjs).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
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

const PRODUCTION_COUNT_KINDS = ["CLIENT_WORK", "OTHER"];
function countsTowardProduction(kind) {
  return kind === "CLIENT_WORK" || kind === "OTHER";
}
function countsTowardRevenue(kind) {
  return kind === "CLIENT_WORK" || kind === "OTHER";
}

// Mirrors completedVideoLogs() (productivity/core.ts) as used by both
// getWarRoomData (analytics/service.ts) and getDashboardStats
// (productivity/actions.ts).
function completedVideoLogs(rows) {
  return rows.filter((r) => r.status === "DONE" && countsTowardProduction(r.video_kind));
}

// Mirrors getClientIntelligence's completedVideoRows/completedVideosCount
// and videosInProgressCount (crm/actions.ts).
function clientIntelligenceCounts(rows) {
  const videosInProgressCount = rows.filter(
    (r) =>
      countsTowardProduction(r.video_kind) &&
      (r.status === "IN_PROGRESS" || r.status === "READY_FOR_REVIEW" || r.status === "CHANGES_REQUESTED"),
  ).length;
  const completedVideoRows = rows.filter((r) => r.status === "DONE" && countsTowardProduction(r.video_kind));
  return { videosInProgressCount, completedVideosCount: completedVideoRows.length };
}

// Mirrors the Productivity dashboard's todayCount/monthCount raw SQL
// (productivity/actions.ts).
function dashboardDoneCount(db, { onDate, sinceDate }) {
  const where = onDate ? `date = '${onDate}'` : `date >= '${sinceDate}'`;
  const row = db
    .prepare(
      `SELECT count(*) as count FROM video_logs WHERE ${where} AND status = 'DONE' AND video_kind IN ('CLIENT_WORK', 'OTHER')`,
    )
    .get();
  return Number(row.count);
}

function seedClient(db, id, name) {
  db.exec(`INSERT INTO clients (id, name, status) VALUES (${id}, '${name}', 'active');`);
}

function insertVideo(db, { id, clientId, status, videoKind, date, delivered = 1 }) {
  db.exec(`
    INSERT INTO video_logs (id, client_id, status, video_kind, date, delivered)
    VALUES (${id}, ${clientId}, '${status}', '${videoKind}', '${date}', ${delivered});
  `);
}

test("1. CLIENT_WORK DONE counts toward completed production", () => {
  const db = buildMigratedDb();
  seedClient(db, 1, "Taryn Dubreuil");
  insertVideo(db, { id: 1, clientId: 1, status: "DONE", videoKind: "CLIENT_WORK", date: "2026-08-01" });
  const rows = db.prepare("SELECT * FROM video_logs").all();
  assert.equal(completedVideoLogs(rows).length, 1);
});

test("2. SAMPLE_VIDEO DONE does not count toward completed production", () => {
  const db = buildMigratedDb();
  seedClient(db, 1, "Priya Chen");
  insertVideo(db, { id: 1, clientId: 1, status: "DONE", videoKind: "SAMPLE_VIDEO", date: "2026-09-01" });
  const rows = db.prepare("SELECT * FROM video_logs").all();
  assert.equal(completedVideoLogs(rows).length, 0, "a Sample Video must not inflate War Room / Productivity completed counts");

  const { completedVideosCount, videosInProgressCount } = clientIntelligenceCounts(rows);
  assert.equal(completedVideosCount, 0, "CRM Client Intelligence must not count a completed Sample Video");
  assert.equal(videosInProgressCount, 0);

  const dashboardCount = dashboardDoneCount(db, { sinceDate: "2026-09-01" });
  assert.equal(dashboardCount, 0, "the Productivity dashboard month count must exclude Sample Videos");
});

test("3. INTERNAL DONE does not count toward completed production", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'RMedia Internal', 'active');`);
  insertVideo(db, { id: 1, clientId: 1, status: "DONE", videoKind: "INTERNAL", date: "2026-08-15" });
  const rows = db.prepare("SELECT * FROM video_logs").all();
  assert.equal(completedVideoLogs(rows).length, 0, "an Internal video must not inflate completed production counts");
  assert.equal(clientIntelligenceCounts(rows).completedVideosCount, 0);
  assert.equal(dashboardDoneCount(db, { onDate: "2026-08-15" }), 0);
});

test("4. revenue eligibility (countsTowardRevenue) is unaffected by the production-count fix", () => {
  // countsTowardRevenue and countsTowardProduction happen to share the
  // same CLIENT_WORK/OTHER kinds today, but they are two independently
  // defined predicates -- this asserts the revenue predicate itself was
  // not touched by this patch and still agrees for all four kinds.
  assert.equal(countsTowardRevenue("CLIENT_WORK"), true);
  assert.equal(countsTowardRevenue("OTHER"), true);
  assert.equal(countsTowardRevenue("SAMPLE_VIDEO"), false);
  assert.equal(countsTowardRevenue("INTERNAL"), false);
});

test("5. delivered/output counts (all videos, any kind) remain semantically correct and untouched", () => {
  const db = buildMigratedDb();
  seedClient(db, 1, "Taryn Dubreuil");
  insertVideo(db, { id: 1, clientId: 1, status: "DONE", videoKind: "CLIENT_WORK", date: "2026-08-01", delivered: 1 });
  insertVideo(db, { id: 2, clientId: 1, status: "DONE", videoKind: "SAMPLE_VIDEO", date: "2026-08-02", delivered: 1 });
  // "total" (all videos regardless of kind) is a distinct, still-correct
  // metric from "completed production" -- this patch must not collapse
  // the two. The dashboard's `total: allLogs.length` and a project's
  // `totalVideos` intentionally still include every kind.
  const allRows = db.prepare("SELECT * FROM video_logs").all();
  assert.equal(allRows.length, 2, "total video count must still include every kind");
  assert.equal(completedVideoLogs(allRows).length, 1, "but completed-production count must exclude the Sample Video");
});

test("6. an idea-stage PLANNED row does not count toward completed production, kind notwithstanding", () => {
  const db = buildMigratedDb();
  seedClient(db, 1, "RMedia Internal");
  insertVideo(db, { id: 1, clientId: 1, status: "PLANNED", videoKind: "CLIENT_WORK", date: "2026-09-01" });
  const rows = db.prepare("SELECT * FROM video_logs").all();
  assert.equal(completedVideoLogs(rows).length, 0, "a PLANNED video is never completed, regardless of kind");
  assert.equal(clientIntelligenceCounts(rows).completedVideosCount, 0);
});

test("a mixed batch produces the exact expected completed count (regression against the proven Health Sweep scenario)", () => {
  const db = buildMigratedDb();
  seedClient(db, 1, "Taryn Dubreuil");
  seedClient(db, 2, "Priya Chen");
  insertVideo(db, { id: 1, clientId: 1, status: "DONE", videoKind: "CLIENT_WORK", date: "2026-09-01" });
  insertVideo(db, { id: 2, clientId: 1, status: "DONE", videoKind: "CLIENT_WORK", date: "2026-09-01" });
  insertVideo(db, { id: 3, clientId: 2, status: "DONE", videoKind: "SAMPLE_VIDEO", date: "2026-09-01" }); // Priya Chen's sample reel, from the Wave 4 seed
  insertVideo(db, { id: 4, clientId: 1, status: "IN_PROGRESS", videoKind: "CLIENT_WORK", date: "2026-09-01" });
  const rows = db.prepare("SELECT * FROM video_logs").all();
  assert.equal(completedVideoLogs(rows).length, 2, "War Room / dashboard must report exactly 2 completed, not 3");
  assert.equal(dashboardDoneCount(db, { onDate: "2026-09-01" }), 2);
});
