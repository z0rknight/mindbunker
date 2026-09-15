import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

// Operational Context Sync Hotfix: migration 0050 makes sensor_sessions.video_id
// nullable and adds context_type/context_label. Mirrors the migration-0015
// regression pattern -- replay every real prior migration to get the exact
// production pre-0050 schema, rather than hand-writing an approximation that
// could hide a real drift.
const migrationPath = new URL(
  "../../db/migrations/0050_spooky_vampiro.sql",
  import.meta.url,
);
const migration = readFileSync(migrationPath, "utf8");
const migrationsDir = new URL("../../db/migrations/", import.meta.url);

const plain = (row) => (row ? { ...row } : row);

function createExact0049Database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql") && name < "0050_")
    .sort();
  for (const file of migrationFiles) {
    db.exec(readFileSync(new URL(file, migrationsDir), "utf8"));
  }
  return db;
}

test("migration 0050 preserves every existing sensor_sessions row and backfills context_type to CLIENT", () => {
  const db = createExact0049Database();

  db.prepare("INSERT INTO sensor_devices (id, public_id, name, token_hash, scopes) VALUES (1, 'dev-1', 'Mac', 'hash', 'SESSION_WRITE')").run();
  db.prepare("INSERT INTO video_logs (id, date) VALUES (61, '2026-09-01')").run();
  db.prepare(
    `INSERT INTO sensor_sessions
       (id, sensor_device_id, local_session_id, video_id, started_at, ended_at, activity_type, approval_state)
     VALUES
       (1, 1, 'closed-real-session', 61, 1000, 2000, 'EDITING', 'PENDING'),
       (2, 1, 'open-real-session', 61, 3000, NULL, 'EDITING', 'PENDING')`,
  ).run();

  const before = db
    .prepare("SELECT id, sensor_device_id, local_session_id, video_id, started_at, ended_at, activity_type, approval_state FROM sensor_sessions ORDER BY id")
    .all()
    .map(plain);

  db.exec(migration);

  const after = db
    .prepare("SELECT id, sensor_device_id, local_session_id, video_id, started_at, ended_at, activity_type, approval_state, context_type, context_label FROM sensor_sessions ORDER BY id")
    .all()
    .map(plain);

  assert.equal(after.length, before.length);
  assert.deepEqual(
    after.map(({ context_type, context_label, ...row }) => row),
    before,
    "every pre-existing column must survive the rebuild untouched",
  );
  assert.ok(
    after.every((row) => row.context_type === "CLIENT" && row.context_label === null),
    "every pre-existing row must backfill honestly to CLIENT with no label, not a guessed value",
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.deepEqual(
    db.prepare("SELECT name FROM sqlite_master WHERE name LIKE '__new_%'").all(),
    [],
  );
});

test("migration 0050's CHECK constraints enforce the context vocabulary and forbid a non-CLIENT video_id", () => {
  const db = createExact0049Database();
  db.prepare("INSERT INTO sensor_devices (id, public_id, name, token_hash, scopes) VALUES (1, 'dev-1', 'Mac', 'hash', 'SESSION_WRITE')").run();
  db.prepare("INSERT INTO video_logs (id, date) VALUES (61, '2026-09-01')").run();
  db.exec(migration);

  let counter = 0;
  const insertWith = (videoId, contextType, contextLabel) =>
    db
      .prepare(
        "INSERT INTO sensor_sessions (sensor_device_id, local_session_id, video_id, context_type, context_label, started_at, activity_type) VALUES (1, ?, ?, ?, ?, 1000, 'OTHER')",
      )
      .run(`ck-${counter++}`, videoId, contextType, contextLabel);

  // CLIENT with a real video: fine (unchanged path).
  assert.doesNotThrow(() => insertWith(61, "CLIENT", null));
  // Every non-client context with no video: fine.
  assert.doesNotThrow(() => insertWith(null, "LEAD", "Counterparty Inc"));
  assert.doesNotThrow(() => insertWith(null, "INTERNAL", "R&D"));
  assert.doesNotThrow(() => insertWith(null, "ADMIN", null));
  // CLIENT with no video is still allowed at the DB layer (the API/native
  // validation layer is what actually requires it) -- the DB-level
  // invariant this migration adds is narrower and non-negotiable: a
  // non-CLIENT session can never carry a video_id.
  assert.doesNotThrow(() => insertWith(null, "CLIENT", null));

  assert.throws(
    () => insertWith(61, "ADMIN", null),
    /CHECK constraint failed/u,
    "a non-CLIENT session must never be able to carry canonical video attribution",
  );
  assert.throws(
    () => insertWith(null, "CONTRACTOR", null),
    /CHECK constraint failed/u,
    "an unrecognized context_type must be rejected at the database level too",
  );
});

test("migration 0050 leaves work_sessions, approval linkage, and unrelated indexes untouched", () => {
  const db = createExact0049Database();
  db.prepare("INSERT INTO sensor_devices (id, public_id, name, token_hash, scopes) VALUES (1, 'dev-1', 'Mac', 'hash', 'SESSION_WRITE')").run();
  db.prepare("INSERT INTO video_logs (id, date) VALUES (61, '2026-09-01')").run();
  db.prepare(
    `INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type, source)
     VALUES (9, 61, 1000, 2000, 'EDITING', 'WEB_TIMER')`,
  ).run();
  db.prepare(
    `INSERT INTO sensor_sessions
       (id, sensor_device_id, local_session_id, video_id, started_at, ended_at, activity_type, approval_state, approved_work_session_id)
     VALUES (1, 1, 'approved-session', 61, 1000, 2000, 'EDITING', 'APPROVED', 9)`,
  ).run();

  db.exec(migration);

  assert.deepEqual(
    plain(db.prepare("SELECT id, video_id, activity_type, source FROM work_sessions WHERE id = 9").get()),
    { id: 9, video_id: 61, activity_type: "EDITING", source: "WEB_TIMER" },
  );
  assert.equal(
    db.prepare("SELECT approved_work_session_id FROM sensor_sessions WHERE id = 1").get().approved_work_session_id,
    9,
  );
  assert.deepEqual(
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('sensor_sessions_device_local_unique', 'sensor_sessions_approved_work_unique', 'sensor_sessions_review_idx', 'sensor_sessions_video_started_idx') ORDER BY name",
      )
      .all()
      .map((row) => row.name),
    [
      "sensor_sessions_approved_work_unique",
      "sensor_sessions_device_local_unique",
      "sensor_sessions_review_idx",
      "sensor_sessions_video_started_idx",
    ],
  );
});
