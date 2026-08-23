import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

// Exercises the actual generated (and manually corrected) migration 0015
// against a fixture mirroring the pre-migration `clients`/`video_logs`
// shape -- the same pattern as
// src/modules/crm/geladeira.integration.test.mjs. This migration had a
// real drizzle-kit generation bug (documented in the Sprint 1.2.2 round
// report): the auto-generated INSERT...SELECT for the video_logs table
// rebuild listed the three brand-new columns as SELECT sources from the
// OLD table, which doesn't have them. This test is what stops that bug
// from silently coming back if the migration file is ever regenerated.
const migrationPath = new URL(
  "../../db/migrations/0015_fixed_slipstream.sql",
  import.meta.url,
);
const migration = readFileSync(migrationPath, "utf8");

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
  `);
  return db;
}

test("migration 0015 preserves existing clients and video_logs rows with honest NULLs for the new columns", () => {
  const db = createFixtureDatabase();

  db.prepare("INSERT INTO clients (id, name, email) VALUES (1, 'Acme Co', 'client@example.com')").run();
  db.prepare("INSERT INTO projects (id, client_id, name) VALUES (1, 1, 'Launch')").run();
  db.prepare(
    `INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivery_url, notes)
     VALUES (1, '2026-08-01', 'Existing legacy video', 1, 1, 'DONE', 'https://example.com/watch', 'legacy notes')`,
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
