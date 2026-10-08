import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDir = new URL("../../db/migrations/", import.meta.url);

function createExact0055Database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql") && name < "0056_").sort()) {
    db.exec(readFileSync(new URL(file, migrationsDir), "utf8"));
  }
  return db;
}

test("migration 0056 creates a deduplicated outreach list independent from CRM", () => {
  const db = createExact0055Database();
  db.exec(readFileSync(new URL("../../db/migrations/0056_chief_vance_astro.sql", import.meta.url), "utf8"));
  db.prepare(`INSERT INTO email_contacts
    (name, email, client_type, status, relationship_origin, source)
    VALUES (?, ?, 'UNCLASSIFIED', 'ACTIVE', 'PAST_CLIENT', 'notion:my-mail-list')`)
    .run("Past buyer", "buyer@example.com");
  assert.throws(() => db.prepare(`INSERT INTO email_contacts
    (name, email, client_type, status, relationship_origin, source)
    VALUES (?, ?, 'UNCLASSIFIED', 'ACTIVE', 'PAST_CLIENT', 'manual')`)
    .run("Duplicate", "buyer@example.com"));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM clients").get().n, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
