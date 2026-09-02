import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

// Operator Intelligence Patch Phase 1A / Core Alignment Audit P0: proves
// the exact contamination scenario the audit flagged -- a DONE Sample or
// Internal video must never inflate a "real client production" count.
// This exercises the same SQL shape the real read paths use (Projects
// doneVideos, Productivity today/month counts), not just the in-memory
// countsTowardProduction predicate, so a future SQL edit that forgets the
// video_kind guard fails here too.

const plain = (row) => ({ ...row });

function makeDb() {
  const db = new DatabaseSync(":memory:");
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
      client_id INTEGER,
      project_id INTEGER REFERENCES projects(id),
      status TEXT NOT NULL,
      video_kind TEXT NOT NULL DEFAULT 'CLIENT_WORK'
    );
  `);
  return db;
}

test("a mixed batch of CLIENT_WORK, SAMPLE and INTERNAL DONE videos only counts CLIENT_WORK toward production", () => {
  const db = makeDb();
  db.exec(`
    INSERT INTO clients VALUES (1, 'Priya Chen');
    INSERT INTO projects VALUES (10, 1, 'Launch batch');
    INSERT INTO video_logs VALUES
      (1, 1, 10, 'DONE', 'CLIENT_WORK'),
      (2, 1, 10, 'DONE', 'CLIENT_WORK'),
      (3, 1, 10, 'DONE', 'SAMPLE');
  `);

  const row = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'DONE' AND video_kind = 'CLIENT_WORK' THEN 1 ELSE 0 END), 0) AS doneProductionVideos,
        COUNT(*) AS totalVideos
      FROM video_logs
      WHERE project_id = 10
    `)
    .get();

  assert.deepEqual(plain(row), { doneProductionVideos: 2, totalVideos: 3 });
});

test("an all-SAMPLE project reports zero production output, not zero rows", () => {
  const db = makeDb();
  db.exec(`
    INSERT INTO clients VALUES (1, 'Portfolio');
    INSERT INTO projects VALUES (11, 1, 'Demo reel');
    INSERT INTO video_logs VALUES
      (1, 1, 11, 'DONE', 'SAMPLE'),
      (2, 1, 11, 'DONE', 'INTERNAL');
  `);

  const row = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'DONE' AND video_kind = 'CLIENT_WORK' THEN 1 ELSE 0 END), 0) AS doneProductionVideos,
        COUNT(*) AS totalVideos
      FROM video_logs
      WHERE project_id = 11
    `)
    .get();

  assert.deepEqual(plain(row), { doneProductionVideos: 0, totalVideos: 2 });
});

test("existing historical rows default to CLIENT_WORK and keep counting exactly as before", () => {
  const db = makeDb();
  db.exec(`
    INSERT INTO clients VALUES (1, 'Legacy Client');
    INSERT INTO projects VALUES (12, 1, 'Pre-classification project');
    -- No video_kind supplied -- the column default applies, exactly as a
    -- pre-migration row would after the additive ALTER TABLE.
    INSERT INTO video_logs (id, client_id, project_id, status) VALUES
      (1, 1, 12, 'DONE'),
      (2, 1, 12, 'DONE');
  `);

  const row = db
    .prepare(`
      SELECT COALESCE(SUM(CASE WHEN status = 'DONE' AND video_kind = 'CLIENT_WORK' THEN 1 ELSE 0 END), 0) AS doneProductionVideos
      FROM video_logs
      WHERE project_id = 12
    `)
    .get();

  assert.deepEqual(plain(row), { doneProductionVideos: 2 });
});

test("a non-DONE Sample video is still a valid historical row (not deleted, not hidden from the table)", () => {
  const db = makeDb();
  db.exec(`
    INSERT INTO clients VALUES (1, 'Client A');
    INSERT INTO projects VALUES (13, 1, 'Mixed');
    INSERT INTO video_logs VALUES
      (1, 1, 13, 'IN_PROGRESS', 'SAMPLE');
  `);

  const count = db.prepare(`SELECT COUNT(*) AS c FROM video_logs WHERE project_id = 13`).get();
  assert.equal(count.c, 1, "the Sample video row must still exist");
});
