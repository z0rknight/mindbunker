import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const deliveryMigration = readFileSync(
  new URL("../../db/migrations/0010_old_morgan_stark.sql", import.meta.url),
  "utf8",
);

test("delivery URL migration is additive and preserves every existing video value", () => {
  assert.match(
    deliveryMigration.trim(),
    /^ALTER TABLE `video_logs` ADD `delivery_url` text;$/u,
  );
  assert.doesNotMatch(deliveryMigration, /DROP TABLE|CREATE TABLE|__new_/u);

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
      name TEXT NOT NULL
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
      updated_at INTEGER,
      status TEXT DEFAULT 'PLANNED' NOT NULL,
      started_at INTEGER
    );
    INSERT INTO clients (id, name) VALUES (2, 'Fictitious Pilot');
    INSERT INTO projects (id, client_id, name) VALUES (1, 2, 'MINI SERIES');
    INSERT INTO video_logs
      (id, date, title, client_id, project_id, revisions_count, delivered,
       notes, created_at, updated_at, status, started_at)
      VALUES
      (2, '2026-08-19', NULL, NULL, NULL, 1, 1, NULL, 1787124831, NULL, 'DONE', NULL),
      (3, '2026-08-21', NULL, NULL, NULL, 0, 1, NULL, 1787344948, NULL, 'DONE', NULL),
      (4, '2026-08-21', 'Video 1 - MINI SERIES', 2, 1, 0, 0,
       'Internal notes', 1787357686, 1787357712, 'IN_PROGRESS', 1787357712);
  `);

  const before = db
    .prepare("SELECT * FROM video_logs ORDER BY id")
    .all()
    .map((row) => ({ ...row }));
  db.exec(deliveryMigration);
  const after = db
    .prepare("SELECT * FROM video_logs ORDER BY id")
    .all()
    .map((row) => ({ ...row }));

  assert.deepEqual(
    after.map(({ delivery_url: _deliveryUrl, ...row }) => row),
    before,
  );
  assert.deepEqual(
    after.map(({ id, delivery_url }) => ({ id, delivery_url })),
    [
      { id: 2, delivery_url: null },
      { id: 3, delivery_url: null },
      { id: 4, delivery_url: null },
    ],
  );
  db.exec(
    "UPDATE video_logs SET delivery_url = 'https://example.com/pilot' WHERE id = 4",
  );
  assert.deepEqual(
    {
      ...db
        .prepare("SELECT id, delivery_url FROM video_logs WHERE id = 4")
        .get(),
    },
    { id: 4, delivery_url: "https://example.com/pilot" },
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});
