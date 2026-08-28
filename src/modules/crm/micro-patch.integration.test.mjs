import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// MICRO PATCH -- Open/Copy, Last Active, Provenance, /book highlight.
// Covers the three new SQL-backed queries (LAST_ACTIVE_BY_PROJECT_SQL,
// LAST_ACTIVE_BY_CLIENT_SQL in work-sessions/data.ts, and the recent
// /book-requests query in crm/actions.ts) against the real migration
// chain -- same convention as attribution.integration.test.mjs and
// client-stats.integration.test.mjs (these are only ever read through
// "use server" data functions that need a Next/Cloudflare request context
// this test runner doesn't have, so the SQL is mirrored directly).

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

const plain = (row) => (row ? { ...row } : row);

const LAST_ACTIVE_BY_PROJECT_SQL = `
  SELECT v.project_id AS group_id, MAX(ws.started_at) AS last_active_at
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  WHERE ws.ended_at IS NOT NULL AND v.project_id IS NOT NULL
  GROUP BY v.project_id
`;

const LAST_ACTIVE_BY_CLIENT_SQL = `
  SELECT v.client_id AS group_id, MAX(ws.started_at) AS last_active_at
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  WHERE ws.ended_at IS NOT NULL AND v.client_id IS NOT NULL
  GROUP BY v.client_id
`;

const RECENT_BOOK_REQUESTS_SQL = `
  SELECT ce.id AS event_id, ce.client_id AS client_id, c.name AS client_name, ce.created_at AS created_at
  FROM crm_events ce
  INNER JOIN clients c ON c.id = ce.client_id
  WHERE ce.type = 'book_request_submitted'
  ORDER BY ce.created_at DESC
  LIMIT 5
`;

function seedTwoProjectsTwoClients(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO clients (id, name, status) VALUES (2, 'Other Client', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'MINI SERIES', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (2, 2, 'Untouched Project', 'active');
    INSERT INTO video_logs (id, date, title, client_id, project_id, status)
    VALUES (1, '2026-08-25', 'Episode 1', 1, 1, 'IN_PROGRESS');
    INSERT INTO video_logs (id, date, title, client_id, project_id, status)
    VALUES (2, '2026-08-25', 'Untouched Video', 2, 2, 'PLANNED');
  `);
}

test("LAST_ACTIVE_BY_PROJECT_SQL reports the most recent closed session's timestamp, not the first", () => {
  const db = buildMigratedDb();
  seedTwoProjectsTwoClients(db);
  db.exec(`
    INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type)
    VALUES (1, 1, 1787580000, 1787583600, 'EDITING');
    INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type)
    VALUES (2, 1, 1787666400, 1787670000, 'EDITING');
  `);
  const rows = db.prepare(LAST_ACTIVE_BY_PROJECT_SQL).all().map(plain);
  assert.deepEqual(rows, [{ group_id: 1, last_active_at: 1787666400 }]);
});

test("LAST_ACTIVE_BY_PROJECT_SQL omits a project with no closed attributed session (never fabricated)", () => {
  const db = buildMigratedDb();
  seedTwoProjectsTwoClients(db);
  db.exec(`
    INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type)
    VALUES (1, 1, 1787580000, 1787583600, 'EDITING');
  `);
  const rows = db.prepare(LAST_ACTIVE_BY_PROJECT_SQL).all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].group_id, 1);
});

test("LAST_ACTIVE_BY_PROJECT_SQL excludes the currently open session (no ended_at yet)", () => {
  const db = buildMigratedDb();
  seedTwoProjectsTwoClients(db);
  db.exec(`
    INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type)
    VALUES (1, 1, 1787666400, NULL, 'EDITING');
  `);
  const rows = db.prepare(LAST_ACTIVE_BY_PROJECT_SQL).all();
  assert.equal(rows.length, 0);
});

test("LAST_ACTIVE_BY_CLIENT_SQL groups by client, separate from the project grouping", () => {
  const db = buildMigratedDb();
  seedTwoProjectsTwoClients(db);
  db.exec(`
    INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type)
    VALUES (1, 1, 1787580000, 1787583600, 'EDITING');
    INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type)
    VALUES (2, 2, 1787666400, 1787670000, 'EDITING');
  `);
  const rows = db.prepare(LAST_ACTIVE_BY_CLIENT_SQL).all().map(plain).sort((a, b) => a.group_id - b.group_id);
  assert.deepEqual(rows, [
    { group_id: 1, last_active_at: 1787580000 },
    { group_id: 2, last_active_at: 1787666400 },
  ]);
});

test("recent /book requests query returns newest first and only book_request_submitted events", () => {
  const db = buildMigratedDb();
  seedTwoProjectsTwoClients(db);
  db.exec(`
    INSERT INTO crm_events (id, client_id, type, actor, description, created_at)
    VALUES (1, 1, 'lead_created', 'gateway', 'Lead created from /book: Taryn Dubreuil', 1787580000);
    INSERT INTO crm_events (id, client_id, type, actor, description, created_at)
    VALUES (2, 1, 'book_request_submitted', 'gateway', 'Booking request', 1787580100);
    INSERT INTO crm_events (id, client_id, type, actor, description, created_at)
    VALUES (3, 2, 'book_request_submitted', 'gateway', 'Booking request', 1787666400);
  `);
  const rows = db.prepare(RECENT_BOOK_REQUESTS_SQL).all();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.client_id), [2, 1]); // newest first
  assert.ok(rows.every((r) => r.event_id !== 1)); // lead_created excluded
});

test("recent /book requests query respects the LIMIT (does not unboundedly grow)", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Repeat Client', 'active');`);
  for (let i = 0; i < 8; i++) {
    db.exec(`
      INSERT INTO crm_events (id, client_id, type, actor, description, created_at)
      VALUES (${i + 1}, 1, 'book_request_submitted', 'gateway', 'Booking request', ${1787580000 + i});
    `);
  }
  const rows = db.prepare(RECENT_BOOK_REQUESTS_SQL).all();
  assert.equal(rows.length, 5);
});
