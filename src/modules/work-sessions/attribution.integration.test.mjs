import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORK_SESSION_ATTRIBUTION_SQL,
  computeProjectStreaks,
  computeTodayWorkSessionStats,
  dayKeyFor,
} from "./core.ts";

// NIGHT SHIFT REALITY PATCH §5/§6/§9 — project streaks and today's work
// session stats, covered against the real migration chain, same convention
// as the repo's other *.integration.test.mjs files (these are only ever
// read through "use server" data functions that need a Next/Cloudflare
// request context this test runner doesn't have).

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

function seedClientProjectVideo(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'MINI SERIES', 'active');
    INSERT INTO video_logs (id, date, title, client_id, project_id, status)
    VALUES (1, '2026-08-25', 'Episode 1', 1, 1, 'IN_PROGRESS');
  `);
}

function insertWorkSession(db, { id, startedAt, endedAt }) {
  db.exec(`
    INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type)
    VALUES (${id}, 1, ${startedAt}, ${endedAt}, 'EDITING');
  `);
}

function runAttributionQuery(db, cutoffEpoch) {
  const stmt = db.prepare(WORK_SESSION_ATTRIBUTION_SQL);
  const rows = stmt.all(cutoffEpoch);
  return rows.map((row) => ({
    projectId: row.project_id === null ? null : Number(row.project_id),
    projectName: row.project_name,
    clientId: row.client_id === null ? null : Number(row.client_id),
    clientName: row.client_name,
    startedAt: new Date(Number(row.started_at) * 1_000).toISOString(),
    durationSeconds: Math.max(0, Number(row.ended_at) - Number(row.started_at)),
  }));
}

test("WORK_SESSION_ATTRIBUTION_SQL + computeProjectStreaks reproduce a real 3-day streak end to end", () => {
  const db = buildMigratedDb();
  seedClientProjectVideo(db);
  // 2026-08-23, 08-24, 08-25, all at 14:00 UTC (safely midday Brazil, no boundary risk).
  insertWorkSession(db, { id: 1, startedAt: 1787493600, endedAt: 1787497200 }); // Aug 23 14:00-15:00 UTC
  insertWorkSession(db, { id: 2, startedAt: 1787580000, endedAt: 1787583600 }); // Aug 24 14:00-15:00 UTC
  insertWorkSession(db, { id: 3, startedAt: 1787666400, endedAt: 1787670000 }); // Aug 25 14:00-15:00 UTC

  const rows = runAttributionQuery(db, 0);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].projectName, "MINI SERIES");
  assert.equal(rows[0].clientName, "Taryn Dubreuil");

  const streaks = computeProjectStreaks(rows, "2026-08-25");
  assert.equal(streaks.length, 1);
  assert.equal(streaks[0].currentStreak, 3);
});

test("passive device_activity_observations alone never create a project streak", () => {
  const db = buildMigratedDb();
  seedClientProjectVideo(db);
  db.exec(`
    INSERT INTO sensor_devices (id, public_id, name, token_hash, scopes)
    VALUES (1, 'dev-1', 'Mac Mini', 'hash', 'observe');
    INSERT INTO device_activity_observations
      (sensor_device_id, local_observation_id, started_at, ended_at, app_name)
    VALUES (1, 'obs-1', 1787666400, 1787670000, 'Adobe Premiere Pro');
  `);
  // No work_sessions row at all -- WORK_SESSION_ATTRIBUTION_SQL never
  // touches device_activity_observations, so this must produce nothing.
  const rows = runAttributionQuery(db, 0);
  assert.equal(rows.length, 0);
  assert.equal(computeProjectStreaks(rows, "2026-08-25").length, 0);
});

test("computeTodayWorkSessionStats end to end: per-client seconds feed the rate-equivalent use case", () => {
  const db = buildMigratedDb();
  seedClientProjectVideo(db);
  insertWorkSession(db, { id: 1, startedAt: 1787666400, endedAt: 1787670000 }); // Aug 25, 1h
  insertWorkSession(db, { id: 2, startedAt: 1787580000, endedAt: 1787583600 }); // Aug 24, must not count

  const rows = runAttributionQuery(db, 0);
  const stats = computeTodayWorkSessionStats(rows, "2026-08-25");
  assert.equal(stats.totalSeconds, 3600);
  assert.equal(stats.sessionCount, 1);
  assert.deepEqual(stats.byClient, [{ clientId: 1, clientName: "Taryn Dubreuil", seconds: 3600 }]);
});

test("dayKeyFor is consistent between the SQL-fetched timestamp and the JS boundary check", () => {
  const db = buildMigratedDb();
  seedClientProjectVideo(db);
  // 2026-08-25T03:01:00Z = Brazil 2026-08-25T00:01 -- just after local midnight.
  insertWorkSession(db, { id: 1, startedAt: 1787626860, endedAt: 1787627160 });
  const rows = runAttributionQuery(db, 0);
  assert.equal(dayKeyFor(rows[0].startedAt), "2026-08-25");
});
