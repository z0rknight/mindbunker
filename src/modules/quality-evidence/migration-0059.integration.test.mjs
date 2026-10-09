import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDir = new URL("../../db/migrations/", import.meta.url);
const migration = readFileSync(new URL("../../db/migrations/0059_quality_evidence.sql", import.meta.url), "utf8");

function exact0058() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql") && name < "0059_").sort()) {
    db.exec(readFileSync(new URL(file, migrationsDir), "utf8"));
  }
  return db;
}

function seed(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn', 'active'), (2, 'Other', 'active');
    INSERT INTO projects (id, client_id, name, status, visible_to_client) VALUES
      (10, 1, 'Offer Doc', 'active', 1),
      (20, 2, 'Secret', 'active', 1);
    INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivered, visible_to_client) VALUES
      (11, '2026-10-09', 'Offer Doc', 1, 10, 'DONE', 1, 1),
      (22, '2026-10-09', 'Other Video', 2, 20, 'DONE', 1, 1);
  `);
}

function clientSafeRows(db, clientId, videoId) {
  return db.prepare(`
    SELECT q.id, q.label
    FROM quality_evidence q
    INNER JOIN video_logs v ON q.video_id = v.id
    INNER JOIN projects p ON v.project_id = p.id
    WHERE q.video_id = ? AND q.visibility = 'CLIENT_SAFE'
      AND q.before_reference IS NOT NULL AND q.after_reference IS NOT NULL
      AND v.client_id = ? AND p.client_id = ?
      AND v.visible_to_client = 1 AND p.visible_to_client = 1
      AND p.status <> 'archived' AND v.is_operational_container = 0 AND v.cancelled_at IS NULL
    ORDER BY q.id
  `).all(videoId, clientId, clientId).map((row) => ({ ...row }));
}

test("0059 adds only the Video-owned evidence table and preserves existing Video truth", () => {
  const db = exact0058();
  seed(db);
  const before = { ...db.prepare("SELECT id, title, status FROM video_logs WHERE id = 11").get() };
  db.exec(migration);
  assert.deepEqual({ ...db.prepare("SELECT id, title, status FROM video_logs WHERE id = 11").get() }, before);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM quality_evidence").get().n, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
});

test("client projection includes only complete CLIENT_SAFE pairs owned by that client and Video", () => {
  const db = exact0058();
  seed(db);
  db.exec(migration);
  db.exec(`
    INSERT INTO quality_evidence (id, video_id, type, label, before_reference, after_reference, visibility, provenance) VALUES
      (1, 11, 'IMAGE_COMPARISON', 'Color', 'https://e/b1', 'https://e/a1', 'CLIENT_SAFE', 'operator'),
      (2, 11, 'AUDIO_COMPARISON', 'Audio incomplete', 'https://e/b2', NULL, 'CLIENT_SAFE', 'operator'),
      (3, 11, 'AUDIO_COMPARISON', 'Internal', 'https://e/b3', 'https://e/a3', 'INTERNAL_ONLY', 'operator'),
      (4, 22, 'IMAGE_COMPARISON', 'Other client', 'https://e/b4', 'https://e/a4', 'CLIENT_SAFE', 'operator');
  `);
  assert.deepEqual(clientSafeRows(db, 1, 11), [{ id: 1, label: "Color" }]);
  assert.deepEqual(clientSafeRows(db, 2, 11), [], "another client cannot read Taryn evidence");
  assert.deepEqual(clientSafeRows(db, 1, 22), [], "Taryn cannot read another Video's evidence");
});

test("database constraints preserve the narrow type, visibility and at-least-one-side contract", () => {
  const db = exact0058();
  seed(db);
  db.exec(migration);
  assert.throws(() => db.exec(`INSERT INTO quality_evidence (video_id, type, label, visibility, provenance)
    VALUES (11, 'IMAGE_COMPARISON', 'Empty', 'INTERNAL_ONLY', 'operator')`), /CHECK/iu);
  assert.throws(() => db.exec(`INSERT INTO quality_evidence (video_id, type, label, before_reference, visibility, provenance)
    VALUES (11, 'SCORE', 'Wrong', 'https://e/b', 'INTERNAL_ONLY', 'operator')`), /CHECK/iu);
});
