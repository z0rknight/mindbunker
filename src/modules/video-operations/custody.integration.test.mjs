import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migration = readFileSync(
  new URL("../../db/migrations/0036_tired_darkstar.sql", import.meta.url),
  "utf8",
);

function applyMigration(db) {
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
}

function baseline() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE clients (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
    CREATE TABLE video_logs (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      title TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      revisions_count INTEGER NOT NULL DEFAULT 0,
      delivery_url TEXT,
      updated_at INTEGER
    );
    CREATE TABLE work_sessions (
      id INTEGER PRIMARY KEY,
      video_id INTEGER NOT NULL REFERENCES video_logs(id) ON DELETE RESTRICT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE TABLE revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      video_id INTEGER NOT NULL REFERENCES video_logs(id) ON DELETE CASCADE,
      note TEXT,
      actor TEXT NOT NULL DEFAULT 'admin',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX revisions_video_created_idx ON revisions(video_id, created_at);
    INSERT INTO clients VALUES (1, 'Taryn');
    INSERT INTO projects VALUES (10, 1, 'MINI SERIES');
    INSERT INTO video_logs VALUES
      (100, '2026-09-01', 'Episode 1', 1, 10, 1, NULL, NULL),
      (101, '2026-09-01', 'Episode 2', 1, 10, 0, NULL, NULL);
    INSERT INTO work_sessions VALUES (1000, 100, 100, 200);
    INSERT INTO revisions (id, video_id, note) VALUES (1, 100, 'legacy fact');
  `);
  return db;
}

test("0036 is additive, preserves legacy revisions, and starts operational tables empty", () => {
  assert.doesNotMatch(migration, /DROP TABLE|__new_|PRAGMA foreign_keys\s*=\s*OFF/u);
  assert.match(migration, /ALTER TABLE `revisions` ADD `caused_by`/u);
  const db = baseline();
  applyMigration(db);
  assert.deepEqual(
    { ...db.prepare("SELECT id, video_id, note, caused_by, category, minutes_rework FROM revisions").get() },
    { id: 1, video_id: 100, note: "legacy fact", caused_by: "UNKNOWN", category: null, minutes_rework: null },
  );
  for (const table of ["commitments", "friction_events", "blockers", "deliveries", "production_checklist_items"]) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  }
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("every promoted fact follows Video to Project to Client custody", () => {
  const db = baseline();
  applyMigration(db);
  db.exec(`
    INSERT INTO commitments (id, title, due_at, video_id) VALUES (1, 'Deliver approval cut', 500, 100);
    INSERT INTO friction_events (video_id, work_session_id, category, minutes_lost, note)
      VALUES (100, 1000, 'FILES', 12, 'Proxy relink');
    INSERT INTO blockers (video_id, category, note) VALUES (100, 'CLIENT', 'Waiting for selects');
    INSERT INTO production_checklist_items (video_id, step, status) VALUES (100, 'ASSEMBLY', 'DONE');
    INSERT INTO deliveries (video_id, commitment_id, version, delivery_url)
      VALUES (100, 1, 1, 'https://example.com/cut');
    INSERT INTO revisions (video_id, note, caused_by, category, minutes_rework)
      VALUES (100, 'Fix typo', 'OUR_ERROR', 'CONTENT', 8);
  `);
  const chain = db.prepare(`
    SELECT c.name AS client, p.name AS project, v.title AS video, cm.title AS commitment
    FROM commitments cm
    JOIN video_logs v ON v.id = cm.video_id
    JOIN projects p ON p.id = v.project_id
    JOIN clients c ON c.id = p.client_id
  `).get();
  assert.deepEqual({ ...chain }, {
    client: "Taryn",
    project: "MINI SERIES",
    video: "Episode 1",
    commitment: "Deliver approval cut",
  });
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("foreign keys reject orphan facts and cross-video promise links", () => {
  const db = baseline();
  applyMigration(db);
  assert.throws(
    () => db.exec("INSERT INTO commitments (title, video_id) VALUES ('Missing deadline', 100)"),
    /NOT NULL/u,
  );
  assert.throws(() => db.exec("INSERT INTO blockers (video_id, category) VALUES (999, 'FILES')"), /FOREIGN KEY/u);
  assert.throws(() => db.exec("INSERT INTO friction_events (video_id, category) VALUES (999, 'FILES')"), /FOREIGN KEY/u);
  assert.throws(() => db.exec("INSERT INTO production_checklist_items (video_id, step) VALUES (999, 'QA')"), /FOREIGN KEY/u);
  db.exec("INSERT INTO commitments (id, title, due_at, video_id) VALUES (1, 'Episode 1 promise', 500, 100)");
  assert.throws(
    () => db.exec("INSERT INTO deliveries (video_id, commitment_id, version) VALUES (101, 1, 1)"),
    /FOREIGN KEY/u,
  );
  assert.throws(() => db.exec("DELETE FROM video_logs WHERE id = 100"), /FOREIGN KEY/u);
  db.close();
});

test("delivery versions and checklist steps remain unique per video", () => {
  const db = baseline();
  applyMigration(db);
  db.exec("INSERT INTO deliveries (video_id, version) VALUES (100, 1)");
  assert.throws(() => db.exec("INSERT INTO deliveries (video_id, version) VALUES (100, 1)"), /UNIQUE/u);
  db.exec("INSERT INTO production_checklist_items (video_id, step) VALUES (100, 'QA')");
  assert.throws(() => db.exec("INSERT INTO production_checklist_items (video_id, step) VALUES (100, 'QA')"), /UNIQUE/u);
  db.close();
});
