import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDir = new URL("../../db/migrations/", import.meta.url);
const migration = readFileSync(new URL("../../db/migrations/0058_commercial_operating_layer.sql", import.meta.url), "utf8");

function exact0057() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql") && name < "0058_").sort()) {
    db.exec(readFileSync(new URL(file, migrationsDir), "utf8"));
  }
  return db;
}

test("0058 upgrades 0057 additively and seeds only the explicit capacity default", () => {
  const db = exact0057();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Existing client', 'active');
    INSERT INTO quotes (id, client_id, amount_cents, content_type_label, turnaround_label, revisions_included, scope_text)
    VALUES (1, 1, 15000, 'Existing work', 'Human review', 2, 'Edit');`);
  const before = { ...db.prepare("SELECT id, client_id, amount_cents, status FROM quotes WHERE id = 1").get() };
  db.exec(migration);
  assert.deepEqual({ ...db.prepare("SELECT id, client_id, amount_cents, status FROM quotes WHERE id = 1").get() }, before);
  assert.deepEqual({ ...db.prepare("SELECT id, state, recurring_seats, hero_projects, actor FROM commercial_capacity_state").get() }, { id: 1, state: "OPEN", recurring_seats: 1, hero_projects: 0, actor: "migration-default" });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM quotes WHERE public_token_hash IS NOT NULL").get().n, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
});

test("capacity constraints and public token uniqueness guard the operating contract", () => {
  const db = exact0057();
  db.exec(migration);
  assert.throws(() => db.exec("UPDATE commercial_capacity_state SET recurring_seats = 4 WHERE id = 1"), /CHECK/iu);
  assert.throws(() => db.exec("INSERT INTO commercial_capacity_state (id, state, recurring_seats, hero_projects) VALUES (2, 'OPEN', 0, 0)"), /CHECK/iu);
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Lead', 'lead');
    INSERT INTO quotes (id, client_id, amount_cents, content_type_label, turnaround_label, revisions_included, scope_text, public_token_hash)
      VALUES (1, 1, 10000, 'Offer one', 'TBD', 1, 'Edit', 'hash');`);
  assert.throws(() => db.exec(`INSERT INTO quotes (id, client_id, amount_cents, content_type_label, turnaround_label, revisions_included, scope_text, public_token_hash)
      VALUES (2, 1, 12000, 'Offer two', 'TBD', 1, 'Edit', 'hash')`), /UNIQUE/iu);
});
