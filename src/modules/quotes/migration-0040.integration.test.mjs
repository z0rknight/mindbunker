import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migration = readFileSync(
  new URL("../../db/migrations/0040_wakeful_paladin.sql", import.meta.url),
  "utf8",
);

test("0040 contract attribution migration is additive-only (ALTER TABLE ADD, no rebuild)", () => {
  assert.doesNotMatch(migration, /DROP TABLE|CREATE TABLE|__new_/u);
  assert.match(migration, /ALTER TABLE `projects` ADD `contract_id`/u);
  assert.match(migration, /ALTER TABLE `video_logs` ADD `contract_id`/u);
});

test("0040 migration preserves every existing project/video row and enforces the FK", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE commercial_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      billing_type TEXT NOT NULL
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
    CREATE TABLE video_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      date TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL
    );
    INSERT INTO clients (id, name) VALUES (1, 'Dave DeMink');
    INSERT INTO commercial_contracts (id, client_id, billing_type) VALUES (1, 1, 'HOURLY');
    INSERT INTO projects (id, client_id, name) VALUES (1, 1, 'Meta Ads');
    INSERT INTO video_logs (id, date, client_id, project_id) VALUES (1, '2026-09-01', 1, 1);
  `);

  const beforeProjects = db.prepare("SELECT * FROM projects ORDER BY id").all();
  const beforeVideos = db.prepare("SELECT * FROM video_logs ORDER BY id").all();

  db.exec(migration);

  const afterProjects = db.prepare("SELECT * FROM projects ORDER BY id").all();
  const afterVideos = db.prepare("SELECT * FROM video_logs ORDER BY id").all();
  assert.equal(afterProjects.length, beforeProjects.length);
  assert.equal(afterVideos.length, beforeVideos.length);
  assert.equal(afterProjects[0].contract_id, null);
  assert.equal(afterVideos[0].contract_id, null);

  // The new column actually enforces the FK.
  db.exec("UPDATE projects SET contract_id = 1 WHERE id = 1");
  db.exec("UPDATE video_logs SET contract_id = 1 WHERE id = 1");
  assert.throws(() => db.exec("UPDATE projects SET contract_id = 999 WHERE id = 1"));
  assert.throws(() => db.exec("UPDATE video_logs SET contract_id = 999 WHERE id = 1"));

  const check = db.prepare("PRAGMA foreign_key_check").all();
  assert.deepEqual(check, []);
  const integrity = db.prepare("PRAGMA integrity_check").all();
  assert.equal(integrity.length, 1);
  assert.equal(integrity[0].integrity_check, "ok");
});
