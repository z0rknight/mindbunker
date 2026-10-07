import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDir = new URL("../../db/migrations/", import.meta.url);
const migration = readFileSync(new URL("../../db/migrations/0055_film_rolls.sql", import.meta.url), "utf8");

function createExact0054Database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql") && name < "0055_").sort()) {
    db.exec(readFileSync(new URL(file, migrationsDir), "utf8"));
  }
  return db;
}

test("migration 0055 creates reference-only Film Rolls with counted searchable subjects", () => {
  const db = createExact0054Database();
  db.exec(migration);
  const roll = db.prepare(`INSERT INTO film_rolls
    (name, status, captured_from, rating, aesthetic, tags, storage_reference)
    VALUES ('October Coffee', 'READY', '2026-10-07', 5, 'warm grain', 'coffee, backstage', 'NAS / Film Rolls')
    RETURNING id`).get();
  db.prepare("INSERT INTO film_roll_subjects (film_roll_id, label, shot_count) VALUES (?, 'coffee', 12)").run(roll.id);
  assert.deepEqual({ ...db.prepare(`SELECT r.name, r.rating, s.label, s.shot_count
    FROM film_rolls r JOIN film_roll_subjects s ON s.film_roll_id = r.id
    WHERE r.captured_from LIKE '2026-10%' AND lower(s.label) LIKE '%coffee%'`).get() }, {
    name: "October Coffee",
    rating: 5,
    label: "coffee",
    shot_count: 12,
  });
  assert.throws(() => db.prepare("UPDATE film_rolls SET rating = 6 WHERE id = ?").run(roll.id));
  db.prepare("DELETE FROM film_rolls WHERE id = ?").run(roll.id);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM film_roll_subjects").get().n, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
