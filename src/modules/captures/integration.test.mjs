import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

// RMEDIA Engine — Operational Capture MVP (Wave 2). Schema-level
// invariant tests, following this codebase's established pattern
// (src/modules/work-sessions/integration.test.mjs) of a hand-rolled
// in-memory SQLite fixture rather than a live D1 binding. Tables here
// are minimal reproductions of the CURRENT real shape (schema.ts) --
// only the columns these specific assertions touch.

function createFixtureDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL
    );
    CREATE TABLE video_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id),
      project_id INTEGER REFERENCES projects(id),
      title TEXT
    );
    CREATE TABLE work_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL REFERENCES video_logs(id),
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      client_id INTEGER REFERENCES clients(id)
    );
    -- Exact shape from src/db/migrations/0042_careless_sebastian_shaw.sql
    CREATE TABLE captures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      context TEXT NOT NULL,
      counterparty_label TEXT,
      channel TEXT,
      event_type TEXT DEFAULT 'OTHER' NOT NULL,
      note TEXT,
      started_at INTEGER,
      ended_at INTEGER,
      outcome TEXT DEFAULT 'UNRESOLVED' NOT NULL,
      source TEXT DEFAULT 'WEB_QUICK_CAPTURE' NOT NULL,
      sensor_device_id INTEGER,
      local_capture_id TEXT,
      promoted_client_id INTEGER REFERENCES clients(id),
      promoted_project_id INTEGER REFERENCES projects(id),
      promoted_video_id INTEGER REFERENCES video_logs(id),
      promoted_work_session_id INTEGER REFERENCES work_sessions(id),
      dismissed_at INTEGER,
      archived_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      updated_at INTEGER,
      CONSTRAINT captures_ended_after_started_check CHECK (
        ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at
      )
    );
    CREATE UNIQUE INDEX captures_promoted_work_session_unique
      ON captures (promoted_work_session_id);
  `);
  return db;
}

function insertCapture(db, overrides = {}) {
  const values = {
    context: "LEAD",
    counterparty_label: null,
    channel: null,
    event_type: "SAMPLE",
    note: null,
    started_at: null,
    ended_at: null,
    outcome: "UNRESOLVED",
    ...overrides,
  };
  const stmt = db.prepare(`
    INSERT INTO captures (context, counterparty_label, channel, event_type, note, started_at, ended_at, outcome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    values.context,
    values.counterparty_label,
    values.channel,
    values.event_type,
    values.note,
    values.started_at,
    values.ended_at,
    values.outcome,
  );
  return Number(result.lastInsertRowid);
}

function countRows(db, table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

// ─── A. Moritz creation: LEAD + SAMPLE + 15m, no client/project/video ──────

test("a LEAD/SAMPLE capture can be stored with every attribution FK null", () => {
  const db = createFixtureDatabase();
  const now = Math.floor(Date.now() / 1000);
  const id = insertCapture(db, {
    counterparty_label: "Moritz-Alexander Germann",
    channel: "UPWORK",
    note: "Proof of work sent",
    started_at: now - 15 * 60,
    ended_at: now,
  });
  const row = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  assert.equal(row.context, "LEAD");
  assert.equal(row.event_type, "SAMPLE");
  assert.equal(row.outcome, "UNRESOLVED");
  assert.equal(row.promoted_client_id, null);
  assert.equal(row.promoted_project_id, null);
  assert.equal(row.promoted_video_id, null);
  assert.equal(row.promoted_work_session_id, null);
  db.close();
});

// ─── B. Internal creation: no canonical business entities required ────────

test("an INTERNAL/INTERNAL_WORK capture can exist with zero canonical rows in the fixture", () => {
  const db = createFixtureDatabase();
  const id = insertCapture(db, {
    context: "INTERNAL",
    counterparty_label: "RMEDIA Engine",
    event_type: "INTERNAL_WORK",
    outcome: "NOT_APPLICABLE",
  });
  assert.equal(countRows(db, "clients"), 0);
  assert.equal(countRows(db, "projects"), 0);
  assert.equal(countRows(db, "video_logs"), 0);
  const row = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  assert.equal(row.context, "INTERNAL");
  db.close();
});

// ─── D. No automatic commercial mutation ───────────────────────────────────

test("creating a capture never inserts a transaction, work session, client, or project", () => {
  const db = createFixtureDatabase();
  insertCapture(db, { context: "LEAD", counterparty_label: "Moritz" });
  insertCapture(db, { context: "INTERNAL", counterparty_label: "RMEDIA Engine", outcome: "NOT_APPLICABLE" });
  assert.equal(countRows(db, "captures"), 2);
  assert.equal(countRows(db, "transactions"), 0);
  assert.equal(countRows(db, "work_sessions"), 0);
  assert.equal(countRows(db, "clients"), 0);
  assert.equal(countRows(db, "projects"), 0);
  db.close();
});

// ─── E. Promotion provenance ────────────────────────────────────────────────

test("promotion preserves every original evidence field unchanged", () => {
  const db = createFixtureDatabase();
  const startedAt = Math.floor(Date.now() / 1000) - 900;
  const endedAt = Math.floor(Date.now() / 1000);
  const id = insertCapture(db, {
    counterparty_label: "Moritz-Alexander Germann",
    channel: "UPWORK",
    note: "Proof of work sent",
    started_at: startedAt,
    ended_at: endedAt,
  });
  const before = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);

  // Simulate promoteCapture's linkPromotion step.
  const clientId = Number(db.prepare("INSERT INTO clients (name) VALUES (?)").run("Moritz-Alexander Germann").lastInsertRowid);
  const projectId = Number(db.prepare("INSERT INTO projects (client_id, name) VALUES (?, ?)").run(clientId, "Sample project").lastInsertRowid);
  db.prepare(`
    UPDATE captures
    SET promoted_client_id = ?, promoted_project_id = ?, outcome = 'CONVERTED', updated_at = ?
    WHERE id = ?
  `).run(clientId, projectId, Math.floor(Date.now() / 1000), id);

  const after = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);

  // Immutable evidence fields (mission §5) -- byte-for-byte unchanged.
  for (const field of ["context", "counterparty_label", "channel", "event_type", "started_at", "ended_at", "source", "created_at"]) {
    assert.equal(after[field], before[field], `${field} must not change during promotion`);
  }
  // Only linkage/outcome/updated_at changed.
  assert.equal(after.promoted_client_id, clientId);
  assert.equal(after.promoted_project_id, projectId);
  assert.equal(after.outcome, "CONVERTED");
  assert.notEqual(after.updated_at, before.updated_at);
  db.close();
});

// ─── F. Promotion idempotency (schema-level guarantee) ─────────────────────

test("captures_promoted_work_session_unique prevents two captures linking to the same Work Session", () => {
  const db = createFixtureDatabase();
  const videoId = Number(db.prepare("INSERT INTO video_logs (title) VALUES (?)").run("Sample video").lastInsertRowid);
  const workSessionId = Number(
    db.prepare("INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, ?, ?)")
      .run(videoId, 1000, 2000).lastInsertRowid,
  );
  const captureA = insertCapture(db, { counterparty_label: "Moritz" });
  const captureB = insertCapture(db, { counterparty_label: "Moritz (duplicate attempt)" });

  db.prepare("UPDATE captures SET promoted_work_session_id = ? WHERE id = ?").run(workSessionId, captureA);
  assert.throws(
    () => db.prepare("UPDATE captures SET promoted_work_session_id = ? WHERE id = ?").run(workSessionId, captureB),
    /UNIQUE constraint failed/,
  );
  db.close();
});

// ─── started_at/ended_at CHECK ─────────────────────────────────────────────

test("the ended_at >= started_at CHECK rejects an inverted interval", () => {
  const db = createFixtureDatabase();
  assert.throws(
    () => insertCapture(db, { started_at: 2000, ended_at: 1000 }),
    /CHECK constraint failed/,
  );
  db.close();
});
