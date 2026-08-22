import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const lifecycleMigration = readFileSync(
  new URL("../../db/migrations/0007_overrated_landau.sql", import.meta.url),
  "utf8",
);
const eventMigration = readFileSync(
  new URL("../../db/migrations/0008_nappy_skrulls.sql", import.meta.url),
  "utf8",
);
const standaloneAuditMigration = readFileSync(
  new URL(
    "../../db/migrations/0009_colossal_phantom_reporter.sql",
    import.meta.url,
  ),
  "utf8",
);

const plain = (row) => ({ ...row });

function createPreLifecycleDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'planned' NOT NULL
    );
    CREATE TABLE video_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      date TEXT NOT NULL,
      title TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      revisions_count INTEGER DEFAULT 0 NOT NULL,
      delivered INTEGER DEFAULT true NOT NULL,
      notes TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE crm_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      actor TEXT DEFAULT 'system' NOT NULL,
      description TEXT NOT NULL,
      created_at INTEGER
    );
    INSERT INTO clients (id, name) VALUES (1, 'Fictitious Client');
    INSERT INTO projects (id, client_id, name, status)
      VALUES (1, 1, 'Fictitious Project', 'active');
    INSERT INTO video_logs
      (id, date, title, client_id, project_id, revisions_count, delivered, notes, created_at, updated_at)
      VALUES
      (2, '2026-08-19', NULL, NULL, NULL, 1, 1, NULL, 1787124831, NULL),
      (3, '2026-08-21', NULL, NULL, NULL, 0, 1, NULL, 1787344948, NULL);
  `);
  return db;
}

test("lifecycle migration backfills legacy rows to DONE but defaults future rows to PLANNED", () => {
  const db = createPreLifecycleDatabase();
  db.exec(lifecycleMigration);

  assert.deepEqual(
    db
      .prepare("SELECT id, status, started_at FROM video_logs ORDER BY id")
      .all()
      .map(plain),
    [
      { id: 2, status: "DONE", started_at: null },
      { id: 3, status: "DONE", started_at: null },
    ],
  );

  db.exec("INSERT INTO video_logs (date, title) VALUES ('2026-08-21', 'Planned cut')");
  assert.deepEqual(
    plain(
      db.prepare("SELECT id, status FROM video_logs WHERE title = 'Planned cut'").get(),
    ),
    { id: 4, status: "PLANNED" },
  );
  db.close();
});

test("metadata edits preserve video identity and legacy nullable fields remain readable", () => {
  const db = createPreLifecycleDatabase();
  db.exec(lifecycleMigration);
  db.exec(eventMigration);

  assert.deepEqual(
    plain(
      db.prepare("SELECT id, title, project_id FROM video_logs WHERE id = 2").get(),
    ),
    { id: 2, title: null, project_id: null },
  );

  db.exec(`
    UPDATE video_logs
    SET title = 'Corrected title', client_id = 1, project_id = 1,
        notes = 'Corrected notes', updated_at = 1787345000
    WHERE id = 2
  `);
  assert.deepEqual(
    plain(
      db.prepare(
        "SELECT id, title, client_id, project_id, notes FROM video_logs WHERE id = 2",
      ).get(),
    ),
    {
      id: 2,
      title: "Corrected title",
      client_id: 1,
      project_id: 1,
      notes: "Corrected notes",
    },
  );
  db.close();
});

test("crm events preserve history, support standalone videos, and unlink deleted videos", () => {
  const db = createPreLifecycleDatabase();
  db.exec(lifecycleMigration);
  db.exec(`
    INSERT INTO crm_events
      (id, client_id, type, actor, description, created_at)
      VALUES
      (7, 1, 'lead_created', 'admin', 'Historical event', 1787344998),
      (12, 1, 'briefing_submitted', 'system', 'Historical briefing', 1787344999)
  `);
  db.exec(eventMigration);
  db.exec(`
    INSERT INTO crm_events
      (client_id, video_id, type, actor, description, created_at)
      VALUES (1, 2, 'video.updated', 'admin', 'Video updated: legacy', 1787345000)
  `);

  const rowsBeforeRebuild = db
    .prepare(
      `SELECT id, client_id, video_id, type, actor, description, created_at
       FROM crm_events ORDER BY id`,
    )
    .all()
    .map(plain);
  const sequenceBeforeRebuild = db
    .prepare("SELECT seq FROM sqlite_sequence WHERE name = 'crm_events'")
    .get().seq;

  db.exec(`BEGIN; ${standaloneAuditMigration} COMMIT;`);

  assert.deepEqual(
    db
      .prepare(
        `SELECT id, client_id, video_id, type, actor, description, created_at
         FROM crm_events ORDER BY id`,
      )
      .all()
      .map(plain),
    rowsBeforeRebuild,
  );
  assert.equal(
    db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'crm_events'").get()
      .seq,
    sequenceBeforeRebuild,
  );
  assert.deepEqual(
    db
      .prepare("PRAGMA table_info('crm_events')")
      .all()
      .filter(({ name }) => name === "client_id" || name === "video_id")
      .map(({ name, notnull }) => ({ name, notnull })),
    [
      { name: "client_id", notnull: 0 },
      { name: "video_id", notnull: 0 },
    ],
  );
  assert.deepEqual(
    db
      .prepare("PRAGMA foreign_key_list('crm_events')")
      .all()
      .map(({ from, table, to, on_delete }) => ({
        from,
        table,
        to,
        on_delete,
      }))
      .sort((a, b) => a.from.localeCompare(b.from)),
    [
      {
        from: "client_id",
        table: "clients",
        to: "id",
        on_delete: "CASCADE",
      },
      {
        from: "video_id",
        table: "video_logs",
        to: "id",
        on_delete: "SET NULL",
      },
    ],
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'index' AND tbl_name = 'crm_events' AND sql IS NOT NULL
         ORDER BY name`,
      )
      .all()
      .map(({ name }) => name),
    ["crm_events_client_created_idx", "crm_events_video_created_idx"],
  );
  assert.deepEqual(
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__new_crm_events'",
      )
      .all(),
    [],
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

  db.exec(`
    INSERT INTO crm_events
      (client_id, video_id, type, actor, description, created_at)
      VALUES (NULL, 3, 'video.started', 'admin', 'Standalone video started', 1787345001)
  `);

  assert.deepEqual(
    db
      .prepare("SELECT client_id, video_id, type FROM crm_events ORDER BY id")
      .all()
      .map(plain),
    [
      { client_id: 1, video_id: null, type: "lead_created" },
      { client_id: 1, video_id: null, type: "briefing_submitted" },
      { client_id: 1, video_id: 2, type: "video.updated" },
      { client_id: null, video_id: 3, type: "video.started" },
    ],
  );
  db.exec("DELETE FROM video_logs WHERE id = 2");
  assert.deepEqual(
    plain(
      db.prepare(
        "SELECT video_id, type FROM crm_events WHERE type = 'video.updated'",
      ).get(),
    ),
    { video_id: null, type: "video.updated" },
  );
  db.close();
});
