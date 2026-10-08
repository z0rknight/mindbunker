import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDir = new URL("../../db/migrations/", import.meta.url);
const migration = readFileSync(new URL("../../db/migrations/0057_delivery_recipes.sql", import.meta.url), "utf8");

function exact0056() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql") && name < "0057_").sort()) {
    db.exec(readFileSync(new URL(file, migrationsDir), "utf8"));
  }
  return db;
}

function seedVideo(db, status = "IN_PROGRESS") {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Current work', 'active');
    INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivered)
      VALUES (11, '2026-10-08', 'Real Video', 1, 1, '${status}', 0);
  `);
}

function attachSnapshot(db) {
  const instance = db.prepare(`INSERT INTO video_recipe_instances
    (video_id, recipe_id, recipe_name_snapshot) VALUES (11, 1, 'Long-form editorial') RETURNING id`).get();
  db.prepare(`INSERT INTO video_recipe_instance_steps
    (instance_id, template_step_id, label_snapshot, gate_snapshot, position_snapshot, quality_standard_snapshot)
    SELECT ?, id, label, gate, position, quality_standard
    FROM delivery_recipe_steps WHERE recipe_id = 1 AND enabled = 1 ORDER BY position, id`).run(instance.id);
  return Number(instance.id);
}

test("0057 upgrades a production-shaped 0056 database without mutating existing Videos", () => {
  const db = exact0056();
  seedVideo(db);
  const before = { ...db.prepare("SELECT id, title, status, delivered FROM video_logs WHERE id = 11").get() };
  db.exec(migration);
  const after = { ...db.prepare("SELECT id, title, status, delivered FROM video_logs WHERE id = 11").get() };
  assert.deepEqual(after, before);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM delivery_recipes").get().n, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
});

test("templates instantiate ordered snapshots and later template edits cannot rewrite history", () => {
  const db = exact0056();
  seedVideo(db);
  db.exec(migration);
  db.exec(`
    INSERT INTO delivery_recipes (id, name, applicability) VALUES (1, 'Long-form editorial', 'Narrative client videos');
    INSERT INTO delivery_recipe_steps (id, recipe_id, label, gate, position, quality_standard, enabled) VALUES
      (1, 1, 'Assembly', 'STRUCTURE', 0, 'The usable story is assembled.', 1),
      (2, 1, 'Audio mix', 'FINISH', 1, 'Dialogue is intelligible and balanced.', 1),
      (3, 1, 'Optional motion', 'FINISH', 2, NULL, 0);
  `);
  const instanceId = attachSnapshot(db);
  assert.deepEqual(db.prepare(`SELECT label_snapshot, gate_snapshot, position_snapshot, state
    FROM video_recipe_instance_steps WHERE instance_id = ? ORDER BY position_snapshot`).all(instanceId).map((row) => ({ ...row })), [
    { label_snapshot: "Assembly", gate_snapshot: "STRUCTURE", position_snapshot: 0, state: "NOT_STARTED" },
    { label_snapshot: "Audio mix", gate_snapshot: "FINISH", position_snapshot: 1, state: "NOT_STARTED" },
  ]);
  db.exec("UPDATE delivery_recipe_steps SET label = 'Changed later', position = 9 WHERE id = 1");
  assert.deepEqual({ ...db.prepare(`SELECT label_snapshot, position_snapshot FROM video_recipe_instance_steps
    WHERE instance_id = ? AND template_step_id = 1`).get(instanceId) }, {
    label_snapshot: "Assembly",
    position_snapshot: 0,
  });
  assert.throws(() => attachSnapshot(db), /UNIQUE/iu, "only one current Recipe per Video");
});

test("step events preserve start, completion and reopen history with exact Video association", () => {
  const db = exact0056();
  seedVideo(db);
  db.exec(migration);
  db.exec(`
    INSERT INTO delivery_recipes (id, name, applicability) VALUES (1, 'Short-form', 'Short videos');
    INSERT INTO delivery_recipe_steps (id, recipe_id, label, gate, position) VALUES (1, 1, 'Structure', 'STRUCTURE', 0);
  `);
  const instanceId = attachSnapshot(db);
  const stepId = Number(db.prepare("SELECT id FROM video_recipe_instance_steps WHERE instance_id = ?").get(instanceId).id);
  const transition = (from, to, at) => {
    db.prepare("UPDATE video_recipe_instance_steps SET state = ?, updated_at = ? WHERE id = ? AND state = ?").run(to, at, stepId, from);
    db.prepare(`INSERT INTO delivery_recipe_events
      (video_id, instance_id, instance_step_id, previous_state, new_state, occurred_at, actor, source, provenance)
      VALUES (11, ?, ?, ?, ?, ?, 'admin', 'MINDBUNKER_WEB', 'operator_click')`).run(instanceId, stepId, from, to, at);
  };
  transition("NOT_STARTED", "ACTIVE", 100);
  transition("ACTIVE", "DONE", 200);
  transition("DONE", "ACTIVE", 300);
  transition("ACTIVE", "DONE", 400);
  assert.deepEqual(db.prepare(`SELECT video_id, previous_state, new_state, occurred_at
    FROM delivery_recipe_events ORDER BY id`).all().map((row) => ({ ...row })), [
    { video_id: 11, previous_state: "NOT_STARTED", new_state: "ACTIVE", occurred_at: 100 },
    { video_id: 11, previous_state: "ACTIVE", new_state: "DONE", occurred_at: 200 },
    { video_id: 11, previous_state: "DONE", new_state: "ACTIVE", occurred_at: 300 },
    { video_id: 11, previous_state: "ACTIVE", new_state: "DONE", occurred_at: 400 },
  ]);
  assert.throws(() => db.prepare(`INSERT INTO delivery_recipe_events
    (video_id, instance_id, instance_step_id, previous_state, new_state, actor, source, provenance)
    VALUES (999, ?, ?, 'DONE', 'ACTIVE', 'admin', 'MINDBUNKER_WEB', 'operator_click')`).run(instanceId, stepId));
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("guarded transition SQL writes one event only when the expected previous state changed", () => {
  const db = exact0056();
  seedVideo(db);
  db.exec(migration);
  db.exec(`
    INSERT INTO delivery_recipes (id, name, applicability) VALUES (1, 'Guarded', 'QA');
    INSERT INTO delivery_recipe_steps (id, recipe_id, label, gate, position) VALUES (1, 1, 'Assembly', 'STRUCTURE', 0);
  `);
  const instanceId = attachSnapshot(db);
  const stepId = Number(db.prepare("SELECT id FROM video_recipe_instance_steps WHERE instance_id = ?").get(instanceId).id);
  const runGuarded = (from, to, at) => {
    const update = db.prepare(`UPDATE video_recipe_instance_steps SET state = ?, updated_at = ?
      WHERE id = ? AND instance_id = ? AND state = ? RETURNING id`).get(to, at, stepId, instanceId, from);
    db.prepare(`INSERT INTO delivery_recipe_events
      (video_id, instance_id, instance_step_id, previous_state, new_state, occurred_at, actor, source, provenance)
      SELECT 11, ?, ?, ?, ?, ?, 'admin', 'MINDBUNKER_WEB', 'operator_click'
      WHERE changes() = 1`).run(instanceId, stepId, from, to, at);
    return update;
  };
  assert.equal(Number(runGuarded("NOT_STARTED", "ACTIVE", 100).id), stepId);
  assert.equal(runGuarded("NOT_STARTED", "ACTIVE", 101), undefined, "stale replay cannot change the step");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM delivery_recipe_events").get().n, 1, "stale replay creates no duplicate event");
});

test("0057 accepts RMEDIA App as an auditable transition source", () => {
  const db = exact0056();
  seedVideo(db);
  db.exec(migration);
  db.exec(`
    INSERT INTO delivery_recipes (id, name, applicability) VALUES (1, 'Native', 'RMEDIA App QA');
    INSERT INTO delivery_recipe_steps (id, recipe_id, label, gate, position) VALUES (1, 1, 'Assembly', 'STRUCTURE', 0);
  `);
  const instanceId = attachSnapshot(db);
  const stepId = Number(db.prepare("SELECT id FROM video_recipe_instance_steps WHERE instance_id = ?").get(instanceId).id);
  db.prepare(`INSERT INTO delivery_recipe_events
    (video_id, instance_id, instance_step_id, previous_state, new_state, actor, source, provenance)
    VALUES (11, ?, ?, 'NOT_STARTED', 'ACTIVE', 'admin', 'RMEDIA_APP', 'native_operator_click:device:test')`)
    .run(instanceId, stepId);
  assert.deepEqual({ ...db.prepare("SELECT source, provenance FROM delivery_recipe_events").get() }, {
    source: "RMEDIA_APP",
    provenance: "native_operator_click:device:test",
  });
});
