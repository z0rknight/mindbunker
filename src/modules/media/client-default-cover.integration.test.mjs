import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migration = readFileSync(
  new URL("../../db/migrations/0045_swift_tomas.sql", import.meta.url),
  "utf8",
);

test("0045 adds one nullable client cover column without rebuilding or changing rows", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE clients (id INTEGER PRIMARY KEY, name TEXT NOT NULL);");
  db.exec("INSERT INTO clients (id, name) VALUES (1, 'Fictitious Client');");

  assert.equal(migration.trim(), "ALTER TABLE `clients` ADD `default_cover_url` text;");
  db.exec(migration);

  const row = db.prepare("SELECT id, name, default_cover_url FROM clients WHERE id = 1").get();
  assert.deepEqual({ ...row }, { id: 1, name: "Fictitious Client", default_cover_url: null });
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  db.close();
});
