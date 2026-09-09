import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { SESSION_TIMELINE_SQL } from "./timeline.ts";
import { dayKeyFor, mondayOfWeek } from "./core.ts";

// Same real work_sessions migration chain the sibling integration.test.mjs
// already trusts (0011 creates the table, 0014 adds source/updated_at) --
// this test exercises the new SESSION_TIMELINE_SQL join against the same
// real schema shape, not a second hand-rolled guess at it.
const migration = readFileSync(
  new URL("../../db/migrations/0011_brainy_ultimo.sql", import.meta.url),
  "utf8",
);
const ledgerMigration = readFileSync(
  new URL("../../db/migrations/0014_first_shockwave.sql", import.meta.url),
  "utf8",
);

const plain = (row) => (row ? { ...row } : row);

function createFixtureDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL
    );
    CREATE TABLE video_logs (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      title TEXT,
      client_id INTEGER REFERENCES clients(id),
      project_id INTEGER REFERENCES projects(id),
      status TEXT NOT NULL,
      started_at INTEGER,
      video_kind TEXT NOT NULL DEFAULT 'CLIENT_WORK'
    );
    CREATE TABLE sensor_sessions (
      id INTEGER PRIMARY KEY,
      approved_work_session_id INTEGER
    );
    INSERT INTO clients VALUES (1, 'Taryn Dubreuil'), (2, 'Dave DeMink');
    INSERT INTO projects VALUES (10, 1, 'MINI SERIES'), (20, 2, 'Short Form Videos');
    INSERT INTO video_logs VALUES
      (100, '2026-09-11', 'Video 1', 1, 10, 'IN_PROGRESS', NULL, 'CLIENT_WORK'),
      (200, '2026-09-11', 'Video 2', 2, 20, 'IN_PROGRESS', NULL, 'CLIENT_WORK'),
      (300, '2026-09-11', 'DESENVOLVIMENTO MINDBUNKER', NULL, NULL, 'IN_PROGRESS', NULL, 'INTERNAL');
  `);
  db.exec(migration);
  db.exec(ledgerMigration);
  return db;
}

function insertSession(db, { videoId, startedAt, endedAt, activityType = "EDITING", source = "WEB_TIMER" }) {
  db.prepare(
    `INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, source) VALUES (?, ?, ?, ?, ?)`,
  ).run(videoId, startedAt, endedAt, activityType, source);
}

function unixSeconds(iso) {
  return Math.floor(Date.parse(iso) / 1000);
}

// Faithful mirror of getSessionTimelineItems' own window+filter logic
// (data.ts) -- reimplemented here against node:sqlite rather than the
// Cloudflare D1 binding getAuthenticatedDb() requires, exactly the same
// "test the real exported SQL + the real exported pure functions, mirror
// only the glue" approach the sibling Capture integration tests already
// established.
function utcBoundForDateKey(dateKey, offsetDays) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return Math.floor(date.getTime() / 1000);
}

function queryRange(db, range) {
  const anchorKey = range.kind === "day" ? range.dayKey : range.mondayKey;
  const padStart = utcBoundForDateKey(anchorKey, -2);
  const padEnd = utcBoundForDateKey(anchorKey, range.kind === "day" ? 3 : 9);
  const rows = db.prepare(SESSION_TIMELINE_SQL).all(padStart, padEnd).map(plain);
  const startedAtIso = (row) => new Date(row.started_at * 1000).toISOString();
  if (range.kind === "day") {
    return rows.filter((row) => dayKeyFor(startedAtIso(row)) === range.dayKey);
  }
  return rows.filter((row) => mondayOfWeek(dayKeyFor(startedAtIso(row))) === range.mondayKey);
}

test("SESSION_TIMELINE_SQL: joins client/project/video_kind correctly for an attributed video", () => {
  const db = createFixtureDatabase();
  insertSession(db, { videoId: 100, startedAt: unixSeconds("2026-09-11T11:00:00.000Z"), endedAt: unixSeconds("2026-09-11T12:00:00.000Z") });
  const rows = queryRange(db, { kind: "day", dayKey: "2026-09-11" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].client_name, "Taryn Dubreuil");
  assert.equal(rows[0].project_name, "MINI SERIES");
  assert.equal(rows[0].video_kind, "CLIENT_WORK");
  db.close();
});

test("SESSION_TIMELINE_SQL: LEFT JOIN correctly returns null client/project for an unattributed (INTERNAL) video, never hides the row", () => {
  const db = createFixtureDatabase();
  insertSession(db, { videoId: 300, startedAt: unixSeconds("2026-09-11T11:00:00.000Z"), endedAt: unixSeconds("2026-09-11T12:00:00.000Z"), activityType: "ADMIN" });
  const rows = queryRange(db, { kind: "day", dayKey: "2026-09-11" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].client_id, null);
  assert.equal(rows[0].project_id, null);
  assert.equal(rows[0].video_kind, "INTERNAL");
  db.close();
});

test("SESSION_TIMELINE_SQL: resolves sensor_session_id via the existing 1:1 reverse lookup", () => {
  const db = createFixtureDatabase();
  insertSession(db, { videoId: 100, startedAt: unixSeconds("2026-09-11T11:00:00.000Z"), endedAt: unixSeconds("2026-09-11T12:00:00.000Z"), source: "MAC_SENSOR_APPROVED" });
  db.prepare("INSERT INTO sensor_sessions (id, approved_work_session_id) VALUES (901, 1)").run();
  const rows = queryRange(db, { kind: "day", dayKey: "2026-09-11" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sensor_session_id, 901);
  db.close();
});

test("day boundary: a session late at night America/Sao_Paulo (early UTC next day) is excluded from the wrong day and included in the right one", () => {
  const db = createFixtureDatabase();
  // 2026-09-12T01:30:00Z = 2026-09-11T22:30 local (America/Sao_Paulo, UTC-3)
  // -- this session belongs to the LOCAL day Sep 11, even though its raw
  // UTC timestamp falls on the calendar date Sep 12.
  insertSession(db, { videoId: 100, startedAt: unixSeconds("2026-09-12T01:30:00.000Z"), endedAt: unixSeconds("2026-09-12T02:00:00.000Z") });

  const sep11 = queryRange(db, { kind: "day", dayKey: "2026-09-11" });
  const sep12 = queryRange(db, { kind: "day", dayKey: "2026-09-12" });
  assert.equal(sep11.length, 1, "must appear on the local day it actually happened");
  assert.equal(sep12.length, 0, "must NOT appear on the UTC calendar date it happens to share a timestamp with");
  db.close();
});

test("day boundary: a session very early UTC (previous local evening) is excluded from the UTC-matching day", () => {
  const db = createFixtureDatabase();
  // 2026-09-11T02:00:00Z = 2026-09-10T23:00 local -- belongs to Sep 10 local.
  insertSession(db, { videoId: 100, startedAt: unixSeconds("2026-09-11T02:00:00.000Z"), endedAt: unixSeconds("2026-09-11T02:30:00.000Z") });

  const sep10 = queryRange(db, { kind: "day", dayKey: "2026-09-10" });
  const sep11 = queryRange(db, { kind: "day", dayKey: "2026-09-11" });
  assert.equal(sep10.length, 1);
  assert.equal(sep11.length, 0);
  db.close();
});

test("week boundary: a Sunday session does not leak into the following week's query", () => {
  const db = createFixtureDatabase();
  // 2026-09-13 is a Sunday, in the week of Monday 2026-09-07.
  insertSession(db, { videoId: 100, startedAt: unixSeconds("2026-09-13T14:00:00.000Z"), endedAt: unixSeconds("2026-09-13T15:00:00.000Z") });

  const thisWeek = queryRange(db, { kind: "week", mondayKey: "2026-09-07" });
  const nextWeek = queryRange(db, { kind: "week", mondayKey: "2026-09-14" });
  assert.equal(thisWeek.length, 1);
  assert.equal(nextWeek.length, 0);
  db.close();
});

test("range bound is exclusive on the far end: a session starting exactly at the next day's local midnight is excluded", () => {
  const db = createFixtureDatabase();
  // Local midnight starting 2026-09-12 in America/Sao_Paulo is 2026-09-12T03:00:00Z.
  insertSession(db, { videoId: 100, startedAt: unixSeconds("2026-09-12T03:00:00.000Z"), endedAt: unixSeconds("2026-09-12T03:30:00.000Z") });

  const sep11 = queryRange(db, { kind: "day", dayKey: "2026-09-11" });
  const sep12 = queryRange(db, { kind: "day", dayKey: "2026-09-12" });
  assert.equal(sep11.length, 0);
  assert.equal(sep12.length, 1);
  db.close();
});

test("an OPEN session (ended_at NULL) is still returned by the range query", () => {
  const db = createFixtureDatabase();
  insertSession(db, { videoId: 100, startedAt: unixSeconds("2026-09-11T18:00:00.000Z"), endedAt: null });
  const rows = queryRange(db, { kind: "day", dayKey: "2026-09-11" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ended_at, null);
  db.close();
});
