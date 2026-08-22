import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  VIDEO_OPERATIONAL_NOTE_EVENT_TYPE,
  videoOperationalMemoryBlocksDeletion,
} from "./core.ts";

const plain = (row) => (row ? { ...row } : row);

function createDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
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
      status TEXT NOT NULL,
      revisions_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE crm_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      video_id INTEGER REFERENCES video_logs(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      actor TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at INTEGER
    );
    CREATE TABLE work_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL REFERENCES video_logs(id) ON DELETE RESTRICT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    INSERT INTO clients VALUES (1, 'Client A'), (2, 'Client B');
    INSERT INTO projects VALUES (10, 1, 'Project A'), (20, 2, 'Project B');
    INSERT INTO video_logs VALUES
      (100, '2026-08-22', 'Episode A', 1, 10, 'IN_PROGRESS', 2),
      (200, '2026-08-22', 'Episode B', 2, 20, 'PLANNED', 0);
  `);
  return db;
}

function addNote(db, videoId, body, createdAt) {
  return db
    .prepare(`
      INSERT INTO crm_events
        (client_id, video_id, type, actor, description, created_at)
      VALUES (NULL, ?, ?, 'admin', ?, ?)
      RETURNING id, video_id, description, created_at
    `)
    .get(videoId, VIDEO_OPERATIONAL_NOTE_EVENT_TYPE, body, createdAt);
}

test("video memory is append-only, scoped to one existing video, and derives ownership", () => {
  const db = createDatabase();
  const stateBefore = plain(
    db.prepare("SELECT status, revisions_count FROM video_logs WHERE id = 100").get(),
  );

  addNote(db, 100, "Rough cut assembled", 1000);
  addNote(db, 100, "Missing section noticed", 1001);
  addNote(db, 200, "Other video note", 1002);

  assert.deepEqual(
    db
      .prepare(`
        SELECT id, description, created_at
        FROM crm_events
        WHERE video_id = 100 AND type = ?
        ORDER BY created_at DESC, id DESC
      `)
      .all(VIDEO_OPERATIONAL_NOTE_EVENT_TYPE)
      .map(plain),
    [
      { id: 2, description: "Missing section noticed", created_at: 1001 },
      { id: 1, description: "Rough cut assembled", created_at: 1000 },
    ],
  );
  assert.deepEqual(
    plain(
      db.prepare(`
        SELECT e.video_id, e.client_id AS stored_client_id,
               v.project_id, p.client_id AS derived_client_id
        FROM crm_events e
        JOIN video_logs v ON v.id = e.video_id
        JOIN projects p ON p.id = v.project_id
        WHERE e.video_id = 100 AND e.type = ?
        ORDER BY e.id LIMIT 1
      `).get(VIDEO_OPERATIONAL_NOTE_EVENT_TYPE),
    ),
    {
      video_id: 100,
      stored_client_id: null,
      project_id: 10,
      derived_client_id: 1,
    },
  );
  assert.deepEqual(
    plain(db.prepare("SELECT status, revisions_count FROM video_logs WHERE id = 100").get()),
    stateBefore,
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM work_sessions").get().count, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("a nonexistent video cannot receive memory and existing videos remain isolated", () => {
  const db = createDatabase();
  assert.throws(() => addNote(db, 999, "Impossible note", 1000), /FOREIGN KEY/u);
  addNote(db, 100, "Video A only", 1001);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM crm_events WHERE video_id = 200").get().count,
    0,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("manual operational memory explicitly blocks application deletion", () => {
  const db = createDatabase();
  addNote(db, 100, "Keep this history", 1000);
  const eventCount = Number(
    db.prepare("SELECT COUNT(*) AS count FROM crm_events WHERE video_id = 100 AND type = ?")
      .get(VIDEO_OPERATIONAL_NOTE_EVENT_TYPE).count,
  );
  assert.equal(videoOperationalMemoryBlocksDeletion(eventCount), true);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM video_logs WHERE id = 100").get().count,
    1,
  );
  db.close();
});
