import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  SENSOR_OBSERVATION_INSERT_SQL,
  SENSOR_SESSION_APPROVE_INSERT_SQL,
  SENSOR_SESSION_APPROVE_MARK_SQL,
  SENSOR_SESSION_ARCHIVE_SQL,
  SENSOR_SESSION_DELETE_SQL,
  SENSOR_SESSION_START_SQL,
  SENSOR_SESSION_STOP_SQL,
} from "./core.ts";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE video_logs (id INTEGER PRIMARY KEY);
    CREATE TABLE sensor_devices (id INTEGER PRIMARY KEY, public_id TEXT NOT NULL UNIQUE);
    CREATE TABLE work_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL REFERENCES video_logs(id) ON DELETE RESTRICT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      activity_type TEXT NOT NULL,
      note TEXT,
      source TEXT NOT NULL DEFAULT 'WEB_TIMER',
      sensor_device_id INTEGER REFERENCES sensor_devices(id) ON DELETE SET NULL,
      sensor_local_id TEXT
    );
    CREATE UNIQUE INDEX work_sessions_one_open_idx ON work_sessions ((1)) WHERE ended_at IS NULL;
    CREATE UNIQUE INDEX work_sessions_sensor_local_unique ON work_sessions (sensor_device_id, sensor_local_id);
    CREATE TABLE sensor_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_device_id INTEGER NOT NULL REFERENCES sensor_devices(id) ON DELETE RESTRICT,
      local_session_id TEXT NOT NULL,
      video_id INTEGER NOT NULL REFERENCES video_logs(id) ON DELETE RESTRICT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      activity_type TEXT NOT NULL,
      note TEXT,
      approval_state TEXT NOT NULL DEFAULT 'PENDING',
      approved_work_session_id INTEGER REFERENCES work_sessions(id) ON DELETE SET NULL,
      approved_at INTEGER,
      archived_at INTEGER,
      deleted_at INTEGER,
      source TEXT NOT NULL DEFAULT 'MAC_SENSOR',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER
    );
    CREATE UNIQUE INDEX sensor_sessions_device_local_unique ON sensor_sessions (sensor_device_id, local_session_id);
    CREATE UNIQUE INDEX sensor_sessions_approved_work_unique ON sensor_sessions (approved_work_session_id);
    CREATE TABLE device_activity_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_device_id INTEGER NOT NULL REFERENCES sensor_devices(id) ON DELETE RESTRICT,
      local_observation_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      app_name TEXT NOT NULL,
      bundle_id TEXT,
      window_title TEXT,
      idle INTEGER NOT NULL,
      keystroke_count INTEGER,
      mouse_movement_count INTEGER,
      source TEXT NOT NULL
    );
    CREATE UNIQUE INDEX device_activity_observations_device_local_unique
      ON device_activity_observations (sensor_device_id, local_observation_id);
    INSERT INTO video_logs VALUES (4), (5);
    INSERT INTO sensor_devices VALUES (1, 'device-a');
  `);
  return db;
}

test("completed Sensor session enters Inbox but not the canonical Ledger", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const inbox = db.prepare(SENSOR_SESSION_START_SQL).get(4, 100, 200, "EDITING", "offline", 1, local);
  assert.equal(inbox.approval_state, "PENDING");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sensor_sessions").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM work_sessions").get().count, 0);
  assert.equal(db.prepare(SENSOR_SESSION_START_SQL).get(4, 100, 200, "EDITING", "offline", 1, local), undefined);
});

test("open Sensor session stops into Inbox and never auto-approves", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  assert.equal(db.prepare(SENSOR_SESSION_START_SQL).get(4, 100, null, "EDITING", null, 1, local).ended_at, null);
  assert.equal(db.prepare(SENSOR_SESSION_STOP_SQL).get(1, local, 200).ended_at, 200);
  assert.equal(db.prepare(SENSOR_SESSION_STOP_SQL).get(1, local, 201), undefined);
  assert.equal(db.prepare("SELECT approval_state FROM sensor_sessions").get().approval_state, "PENDING");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM work_sessions").get().count, 0);
});

test("Approve creates exactly one MAC_SENSOR_APPROVED Work Session", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const sensorId = db.prepare(SENSOR_SESSION_START_SQL).get(4, 100, 200, "EDITING", "review me", 1, local).id;
  const approve = () => {
    db.prepare(SENSOR_SESSION_APPROVE_INSERT_SQL).get(sensorId);
    db.prepare(SENSOR_SESSION_APPROVE_MARK_SQL).get(sensorId, 300);
  };
  approve();
  approve();
  const row = db.prepare("SELECT * FROM work_sessions").get();
  assert.equal(row.source, "MAC_SENSOR_APPROVED");
  assert.equal(row.sensor_local_id, local);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM work_sessions").get().count, 1);
  const evidence = db.prepare("SELECT approval_state, approved_work_session_id FROM sensor_sessions").get();
  assert.equal(evidence.approval_state, "APPROVED");
  assert.equal(evidence.approved_work_session_id, row.id);
});

test("Archive hides review without deleting evidence; Delete requires Archive", () => {
  const db = fixture();
  const first = db.prepare(SENSOR_SESSION_START_SQL).get(4, 100, 200, "REVIEW", null, 1, "52dd6ad8-770e-4bc9-a200-c453fea749cf");
  assert.equal(db.prepare(SENSOR_SESSION_DELETE_SQL).get(first.id, 250), undefined);
  assert.equal(db.prepare(SENSOR_SESSION_ARCHIVE_SQL).get(first.id, 250).id, first.id);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sensor_sessions WHERE approval_state='PENDING'").get().count, 0);
  assert.equal(db.prepare("SELECT approval_state, ended_at FROM sensor_sessions WHERE id=?").get(first.id).ended_at, 200);
  assert.equal(db.prepare(SENSOR_SESSION_DELETE_SQL).get(first.id, 300).id, first.id);
  const evidence = db.prepare("SELECT approval_state, deleted_at FROM sensor_sessions WHERE id=?").get(first.id);
  assert.equal(evidence.approval_state, "DELETED");
  assert.equal(evidence.deleted_at, 300);
});

test("passive apps, NULL counters, and overlap aggregation remain independent", () => {
  const db = fixture();
  const sensor = db.prepare(SENSOR_SESSION_START_SQL).get(4, 100, 200, "EDITING", null, 1, "52dd6ad8-770e-4bc9-a200-c453fea749cf");
  const observation = db.prepare(SENSOR_OBSERVATION_INSERT_SQL);
  observation.run(1, "1e314ee3-5df6-4c95-b460-104275ae4da3", 90, 150, "Notion", "notion.id", null, 0, null, null);
  observation.run(1, "2e314ee3-5df6-4c95-b460-104275ae4da3", 150, 250, "Premiere Pro", "premiere.id", null, 0, 12, 8);
  observation.run(1, "3e314ee3-5df6-4c95-b460-104275ae4da3", 170, 190, "Finder", "finder.id", null, 1, null, null);
  assert.deepEqual(
    db.prepare("SELECT app_name FROM device_activity_observations ORDER BY app_name").all().map((row) => row.app_name),
    ["Finder", "Notion", "Premiere Pro"],
  );
  const notion = db.prepare("SELECT keystroke_count, mouse_movement_count FROM device_activity_observations WHERE app_name='Notion'").get();
  assert.equal(notion.keystroke_count, null);
  assert.equal(notion.mouse_movement_count, null);
  const apps = db.prepare(`
    SELECT app_name, SUM(MIN(ended_at, ?2) - MAX(started_at, ?1)) AS seconds
    FROM device_activity_observations
    WHERE sensor_device_id = 1 AND idle = 0 AND started_at < ?2 AND ended_at > ?1
    GROUP BY app_name ORDER BY app_name
  `).all(100, 200);
  assert.deepEqual(apps.map((row) => ({ ...row })), [
    { app_name: "Notion", seconds: 50 },
    { app_name: "Premiere Pro", seconds: 50 },
  ]);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM work_sessions").get().count, 0);
  assert.equal(db.prepare("SELECT approval_state FROM sensor_sessions WHERE id=?").get(sensor.id).approval_state, "PENDING");
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
});
