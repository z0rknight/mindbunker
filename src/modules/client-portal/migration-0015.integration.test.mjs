import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

// Exercises migration 0015 against the production FK topology. The original
// generated table rebuild failed remotely because `work_sessions.video_id`
// and `crm_events.video_id` both reference `video_logs`. The intended delta
// is additive, so this regression protects the safer ALTER TABLE strategy.
const migrationPath = new URL(
  "../../db/migrations/0015_fixed_slipstream.sql",
  import.meta.url,
);
const migration = readFileSync(migrationPath, "utf8");
const migrationsDir = new URL("../../db/migrations/", import.meta.url);

const plain = (row) => (row ? { ...row } : row);

function createFixtureDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
    CREATE TABLE video_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      title TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'PLANNED',
      started_at INTEGER,
      revisions_count INTEGER NOT NULL DEFAULT 0,
      delivered INTEGER NOT NULL DEFAULT 1,
      delivery_url TEXT,
      notes TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE INDEX video_logs_project_created_idx
      ON video_logs (project_id, created_at);
    CREATE INDEX video_logs_client_created_idx
      ON video_logs (client_id, created_at);
    CREATE TABLE crm_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      video_id INTEGER REFERENCES video_logs(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'system',
      description TEXT NOT NULL,
      created_at INTEGER
    );
    CREATE TABLE work_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL REFERENCES video_logs(id) ON DELETE RESTRICT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      activity_type TEXT NOT NULL DEFAULT 'EDITING',
      note TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      source TEXT NOT NULL DEFAULT 'WEB_TIMER',
      updated_at INTEGER
    );
    CREATE UNIQUE INDEX work_sessions_one_open_idx
      ON work_sessions ((1)) WHERE ended_at IS NULL;
  `);
  return db;
}

function createExact0014Database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql") && name < "0015_")
    .sort();
  for (const file of migrationFiles) {
    db.exec(readFileSync(new URL(file, migrationsDir), "utf8"));
  }
  return db;
}

test("migration 0015 applies over the exact 0000-0014 schema with production inbound FKs", () => {
  const db = createExact0014Database();

  db.prepare("INSERT INTO clients (id, name) VALUES (41, 'Fixture Client')").run();
  db.prepare(
    "INSERT INTO projects (id, client_id, name, status) VALUES (51, 41, 'Fixture Project', 'active')",
  ).run();
  db.prepare(
    `INSERT INTO video_logs
       (id, date, title, client_id, project_id, status, revisions_count, delivered, notes)
     VALUES
       (61, '2026-08-23', 'Review video', 41, 51, 'READY_FOR_REVIEW', 2, 0, 'preserve me'),
       (62, '2026-08-22', NULL, NULL, NULL, 'DONE', 0, 1, NULL)`,
  ).run();
  db.prepare(
    `INSERT INTO work_sessions
       (id, video_id, started_at, ended_at, activity_type)
     VALUES (71, 61, 1000, 1900, 'EDITING')`,
  ).run();
  db.prepare(
    `INSERT INTO crm_events
       (id, client_id, video_id, type, description)
     VALUES (81, 41, 61, 'video.ready_for_review', 'Ready for review')`,
  ).run();

  const videosBefore = db
    .prepare("SELECT * FROM video_logs ORDER BY id")
    .all()
    .map(plain);
  const sessionsBefore = db
    .prepare("SELECT id, video_id FROM work_sessions ORDER BY id")
    .all()
    .map(plain);
  const eventsBefore = db
    .prepare("SELECT id, client_id, video_id FROM crm_events ORDER BY id")
    .all()
    .map(plain);

  db.exec(migration);

  const videosAfter = db
    .prepare("SELECT * FROM video_logs ORDER BY id")
    .all()
    .map(plain);
  assert.equal(videosAfter.length, videosBefore.length);
  assert.deepEqual(
    videosAfter.map(({ cover_url, orientation, content_type, ...row }) => row),
    videosBefore,
  );
  assert.ok(
    videosAfter.every(
      (row) =>
        row.cover_url === null &&
        row.orientation === null &&
        row.content_type === null,
    ),
  );
  assert.deepEqual(
    db
      .prepare("SELECT id, video_id FROM work_sessions ORDER BY id")
      .all()
      .map(plain),
    sessionsBefore,
  );
  assert.deepEqual(
    db
      .prepare("SELECT id, client_id, video_id FROM crm_events ORDER BY id")
      .all()
      .map(plain),
    eventsBefore,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.deepEqual(
    db.prepare("SELECT name FROM sqlite_master WHERE name LIKE '__new_%'").all(),
    [],
  );
});

test("migration 0015 preserves existing clients and video_logs rows with honest NULLs for the new columns", () => {
  const db = createFixtureDatabase();

  db.prepare("INSERT INTO clients (id, name, email) VALUES (1, 'Acme Co', 'client@example.com')").run();
  db.prepare("INSERT INTO projects (id, client_id, name) VALUES (1, 1, 'Launch')").run();
  db.prepare(
    `INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivery_url, notes)
     VALUES (1, '2026-08-01', 'Existing legacy video', 1, 1, 'DONE', 'https://example.com/watch', 'legacy notes')`,
  ).run();
  db.prepare(
    `INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type)
     VALUES (7, 1, 1000, 1600, 'EDITING')`,
  ).run();
  db.prepare(
    `INSERT INTO crm_events (id, client_id, video_id, type, description, created_at)
     VALUES (9, 1, 1, 'video.ready_for_review', 'Ready for review', 1600)`,
  ).run();

  db.exec(migration);

  const client = plain(db.prepare("SELECT * FROM clients WHERE id = 1").get());
  assert.equal(client.name, "Acme Co");
  assert.equal(client.portal_password_hash, null);
  assert.equal(client.portal_password_set_at, null);
  assert.equal(client.portal_reset_token_hash, null);
  assert.equal(client.portal_reset_expires_at, null);

  const video = plain(db.prepare("SELECT * FROM video_logs WHERE id = 1").get());
  assert.equal(video.title, "Existing legacy video");
  assert.equal(video.notes, "legacy notes");
  assert.equal(video.delivery_url, "https://example.com/watch");
  // The three new columns must default honestly to NULL (unknown), never
  // to an inferred/guessed value -- this is the exact spot the generation
  // bug would have broken (either the migration would have failed outright
  // with a misleading CHECK-constraint error, or if the bug had gone
  // undetected in a different form, it could have coerced these to an
  // unintended default instead of NULL).
  assert.equal(video.cover_url, null);
  assert.equal(video.orientation, null);
  assert.equal(video.content_type, null);

  assert.deepEqual(
    plain(db.prepare("SELECT id, video_id FROM work_sessions WHERE id = 7").get()),
    { id: 7, video_id: 1 },
  );
  assert.deepEqual(
    plain(db.prepare("SELECT id, client_id, video_id FROM crm_events WHERE id = 9").get()),
    { id: 9, client_id: 1, video_id: 1 },
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.deepEqual(
    db
      .prepare("SELECT name FROM sqlite_master WHERE name LIKE '__new_%'")
      .all(),
    [],
  );
  assert.deepEqual(
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('video_logs_client_created_idx', 'video_logs_project_created_idx', 'work_sessions_one_open_idx') ORDER BY name",
      )
      .all()
      .map((row) => row.name),
    [
      "video_logs_client_created_idx",
      "video_logs_project_created_idx",
      "work_sessions_one_open_idx",
    ],
  );
});

test("migration 0015's orientation and content_type CHECK constraints enforce the canonical vocabulary", () => {
  const db = createFixtureDatabase();
  db.prepare("INSERT INTO clients (id, name) VALUES (1, 'Acme Co')").run();
  db.exec(migration);

  const insertWith = (orientation, contentType) =>
    db
      .prepare(
        "INSERT INTO video_logs (date, title, orientation, content_type) VALUES ('2026-08-23', 'Test', ?, ?)",
      )
      .run(orientation, contentType);

  // Valid values and NULL both succeed.
  assert.doesNotThrow(() => insertWith("LANDSCAPE", "short-form"));
  assert.doesNotThrow(() => insertWith("VERTICAL", null));
  assert.doesNotThrow(() => insertWith(null, "mini-doc"));
  assert.doesNotThrow(() => insertWith(null, null));

  // Anything outside the enum is rejected at the database level, not just
  // in application code -- defense in depth against a future bypass of
  // validateVideoInput.
  assert.throws(() => insertWith("DIAGONAL", null), /CHECK constraint failed/u);
  assert.throws(() => insertWith(null, "vlog"), /CHECK constraint failed/u);
});
