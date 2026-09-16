import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  OPEN_SENSOR_SESSION_SQL,
  SENSOR_OBSERVATION_INSERT_SQL,
  SENSOR_SESSION_APPROVE_INSERT_SQL,
  SENSOR_SESSION_APPROVE_MARK_SQL,
  SENSOR_SESSION_ARCHIVE_SQL,
  SENSOR_SESSION_DELETE_SQL,
  SENSOR_SESSION_START_SQL,
  SENSOR_SESSION_STOP_SQL,
  SENSOR_SESSION_UPDATE_SQL,
  SENSOR_SESSION_UPDATE_NONCLIENT_SQL,
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
      video_id INTEGER REFERENCES video_logs(id) ON DELETE RESTRICT,
      context_type TEXT NOT NULL DEFAULT 'CLIENT' CHECK(context_type IN ('CLIENT','LEAD','INTERNAL','ADMIN')),
      context_label TEXT,
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
      updated_at INTEGER,
      CHECK (context_type = 'CLIENT' OR video_id IS NULL)
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
  const inbox = db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, 200, "EDITING", "offline", 1, local);
  assert.equal(inbox.approval_state, "PENDING");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sensor_sessions").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM work_sessions").get().count, 0);
  assert.equal(db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, 200, "EDITING", "offline", 1, local), undefined);
});

test("open Sensor session stops into Inbox and never auto-approves", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  assert.equal(db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, null, "EDITING", null, 1, local).ended_at, null);
  assert.equal(db.prepare(SENSOR_SESSION_STOP_SQL).get(1, local, 200).ended_at, 200);
  assert.equal(db.prepare(SENSOR_SESSION_STOP_SQL).get(1, local, 201), undefined);
  assert.equal(db.prepare("SELECT approval_state FROM sensor_sessions").get().approval_state, "PENDING");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM work_sessions").get().count, 0);
});

test("Approve creates exactly one MAC_SENSOR_APPROVED Work Session", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const sensorId = db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, 200, "EDITING", "review me", 1, local).id;
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
  const first = db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, 200, "REVIEW", null, 1, "52dd6ad8-770e-4bc9-a200-c453fea749cf");
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
  const sensor = db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, 200, "EDITING", null, 1, "52dd6ad8-770e-4bc9-a200-c453fea749cf");
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

// Sensor Reality Sync §8: edit a PENDING, already-stopped staging
// session (the "forgot to stop, Mac slept, now it says 10h" case)
// BEFORE it becomes canonical history.
test("editing a PENDING, stopped staging session persists the correction and leaves approval untouched", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const sensorId = db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, 36_100, "EDITING", "forgot to stop", 1, local).id;
  const updated = db.prepare(SENSOR_SESSION_UPDATE_SQL).get(sensorId, 5, 100, 1_900, "REVIEW", "corrected: actually 30 minutes", 400);
  assert.equal(updated.id, sensorId);
  const row = db.prepare("SELECT video_id, started_at, ended_at, activity_type, note, approval_state FROM sensor_sessions WHERE id=?").get(sensorId);
  assert.equal(row.video_id, 5);
  assert.equal(row.ended_at, 1_900);
  assert.equal(row.activity_type, "REVIEW");
  assert.equal(row.note, "corrected: actually 30 minutes");
  assert.equal(row.approval_state, "PENDING");
});

test("editing a still-open staging session is rejected -- it's live, not staged history yet", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const sensorId = db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, null, "EDITING", null, 1, local).id;
  assert.equal(db.prepare(SENSOR_SESSION_UPDATE_SQL).get(sensorId, 4, 100, 1_000, "EDITING", null, 400), undefined);
});

test("editing an already-approved staging session is rejected -- it's canonical history now, use correctWorkSession instead", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const sensorId = db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, 200, "EDITING", null, 1, local).id;
  db.prepare(SENSOR_SESSION_APPROVE_INSERT_SQL).get(sensorId);
  db.prepare(SENSOR_SESSION_APPROVE_MARK_SQL).get(sensorId, 300);
  assert.equal(db.prepare(SENSOR_SESSION_UPDATE_SQL).get(sensorId, 4, 100, 5_000, "EDITING", null, 400), undefined);
});

function fixtureWithClientsAndBilling() {
  const db = fixture();
  db.exec(`
    CREATE TABLE clients (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    ALTER TABLE video_logs ADD COLUMN client_id INTEGER REFERENCES clients(id);
    ALTER TABLE video_logs ADD COLUMN project_id INTEGER REFERENCES projects(id);
    ALTER TABLE video_logs ADD COLUMN title TEXT;
    ALTER TABLE video_logs ADD COLUMN date TEXT DEFAULT '2026-09-15';
    ALTER TABLE sensor_devices ADD COLUMN name TEXT DEFAULT 'device';
    CREATE TABLE billing_evidence (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE billing_allocations (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE payment_requests (id INTEGER PRIMARY KEY AUTOINCREMENT);
    INSERT INTO clients VALUES (1, 'Taryn'), (2, 'Dave');
    UPDATE video_logs SET client_id = 1 WHERE id = 4;
    UPDATE video_logs SET client_id = 2 WHERE id = 5;
  `);
  return db;
}

test("approving one client's Sensor session never mutates another client's video, session, or billing rows", () => {
  const db = fixtureWithClientsAndBilling();
  const tarynLocal = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const daveLocal = "63ee7bf9-881f-5d0a-b571-215386bf5ea0";
  const tarynSensorId = db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, 200, "EDITING", null, 1, tarynLocal).id;
  const daveSensorId = db.prepare(SENSOR_SESSION_START_SQL).get(5, "CLIENT", null, 300, 400, "EDITING", null, 1, daveLocal).id;

  db.prepare(SENSOR_SESSION_APPROVE_INSERT_SQL).get(tarynSensorId);
  db.prepare(SENSOR_SESSION_APPROVE_MARK_SQL).get(tarynSensorId, 500);

  // Dave's staging row is completely untouched by Taryn's approval.
  const dave = db.prepare("SELECT approval_state, approved_work_session_id FROM sensor_sessions WHERE id=?").get(daveSensorId);
  assert.equal(dave.approval_state, "PENDING");
  assert.equal(dave.approved_work_session_id, null);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM work_sessions WHERE video_id=5").get().n, 0);

  // The one canonical row created belongs to Taryn's video only.
  const created = db.prepare("SELECT video_id FROM work_sessions").get();
  assert.equal(created.video_id, 4);

  // No billing-shaped table was touched by an ordinary Sensor approval.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM billing_evidence").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM billing_allocations").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM payment_requests").get().n, 0);
});

// Sensor Reality Sync §3: the exact read War Room uses to decide
// SENSOR RECORDING vs idle -- confirms it only ever returns the one
// truly-open row, and nothing once it's stopped.
test("OPEN_SENSOR_SESSION_SQL reflects an open staging session and goes empty the instant it's stopped", () => {
  const db = fixtureWithClientsAndBilling();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, null, "EDITING", null, 1, local);
  const open = db.prepare(OPEN_SENSOR_SESSION_SQL).get();
  assert.equal(open.video_id, 4);
  assert.equal(open.client_id, 1);

  db.prepare(SENSOR_SESSION_STOP_SQL).get(1, local, 200);
  assert.equal(db.prepare(OPEN_SENSOR_SESSION_SQL).get(), undefined);
});

// Operational Context Sync Hotfix: real production QA found ADMIN/INTERNAL/
// LEAD sessions silently never reaching MindBunker at all -- the sync gate
// was tied to canonical video attribution, which non-client contexts can
// never have. These four tests use the actual server SQL, not a native-side
// simulation, to prove each context now durably reaches sensor_sessions
// with no video_id and no fake client attribution, while CLIENT is
// unaffected.
for (const [contextType, label] of [["LEAD", "Moritz / Upwork"], ["INTERNAL", "MindBunker maintenance"], ["ADMIN", null]]) {
  test(`${contextType} Start durably enters sensor_sessions with no video_id and its own context_label`, () => {
    const db = fixture();
    const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
    const inserted = db.prepare(SENSOR_SESSION_START_SQL).get(null, contextType, label, 100, null, "OTHER", null, 1, local);
    assert.equal(inserted.video_id, null, `${contextType} must never carry a video_id`);
    assert.equal(inserted.context_type, contextType);
    assert.equal(inserted.context_label, label);
    assert.equal(inserted.approval_state, "PENDING");
    const stopped = db.prepare(SENSOR_SESSION_STOP_SQL).get(1, local, 200);
    assert.equal(stopped.ended_at, 200);
  });
}

test("a non-CLIENT session (no video_id) can never be approved into a canonical Work Session", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const sensorId = db.prepare(SENSOR_SESSION_START_SQL).get(null, "ADMIN", null, 100, 200, "ADMIN", null, 1, local).id;
  const approveInsert = db.prepare(SENSOR_SESSION_APPROVE_INSERT_SQL).get(sensorId);
  assert.equal(approveInsert, undefined, "the video_id IS NOT NULL guard must reject the insert, not throw a constraint error");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM work_sessions").get().count, 0);
  const evidence = db.prepare("SELECT approval_state, approved_work_session_id FROM sensor_sessions WHERE id=?").get(sensorId);
  assert.equal(evidence.approval_state, "PENDING", "a non-client session stays PENDING/reviewable, never silently vanishes");
  assert.equal(evidence.approved_work_session_id, null);
  // Archive remains available as the non-client review outcome.
  assert.equal(db.prepare(SENSOR_SESSION_ARCHIVE_SQL).get(sensorId, 300).id, sensorId);
});

test("OPEN_SENSOR_SESSION_SQL surfaces an open non-client session with its context_label, no fabricated client/video", () => {
  const db = fixtureWithClientsAndBilling();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  db.prepare(SENSOR_SESSION_START_SQL).get(null, "LEAD", "Counterparty Inc", 100, null, "OTHER", null, 1, local);
  const open = db.prepare(OPEN_SENSOR_SESSION_SQL).get();
  assert.equal(open.video_id, null);
  assert.equal(open.video_title, null);
  assert.equal(open.client_id, null);
  assert.equal(open.client_name, null);
  assert.equal(open.context_type, "LEAD");
  assert.equal(open.context_label, "Counterparty Inc");
});

test("approving a CLIENT session alongside open non-client Sensor activity never touches billing tables", () => {
  const db = fixtureWithClientsAndBilling();
  const clientLocal = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const adminLocal = "63ee7bf9-881f-5d0a-b571-215386bf5ea0";
  const clientSensorId = db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, 200, "EDITING", null, 1, clientLocal).id;
  db.prepare(SENSOR_SESSION_START_SQL).get(null, "ADMIN", null, 300, null, "ADMIN", null, 1, adminLocal);

  db.prepare(SENSOR_SESSION_APPROVE_INSERT_SQL).get(clientSensorId);
  db.prepare(SENSOR_SESSION_APPROVE_MARK_SQL).get(clientSensorId, 500);

  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM billing_evidence").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM billing_allocations").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM payment_requests").get().n, 0);
  // The still-open ADMIN session is untouched by the unrelated CLIENT approval.
  const admin = db.prepare("SELECT approval_state, ended_at FROM sensor_sessions WHERE local_session_id=?").get(adminLocal);
  assert.equal(admin.approval_state, "PENDING");
  assert.equal(admin.ended_at, null);
});

// Sensor Operational Ledger Patch: closing a non-CLIENT session must
// finalize it atomically in the same Stop write -- no separate approval
// click, no lingering PENDING. CLIENT keeps its exact prior behavior.
for (const contextType of ["LEAD", "INTERNAL", "ADMIN"]) {
  test(`${contextType} Stop finalizes to ARCHIVED atomically, with archived_at set, no approval required`, () => {
    const db = fixture();
    const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
    const label = contextType === "LEAD" ? "Counterparty Inc" : null;
    db.prepare(SENSOR_SESSION_START_SQL).get(null, contextType, label, 100, null, "OTHER", null, 1, local);
    const stopped = db.prepare(SENSOR_SESSION_STOP_SQL).get(1, local, 200);
    assert.equal(stopped.approval_state, "ARCHIVED");
    const row = db.prepare("SELECT approval_state, archived_at, video_id FROM sensor_sessions WHERE local_session_id=?").get(local);
    assert.equal(row.approval_state, "ARCHIVED");
    assert.equal(row.archived_at, 200);
    assert.equal(row.video_id, null, "non-CLIENT must never gain a video_id");
    // Never counted as pending review.
    assert.equal(
      db.prepare("SELECT COUNT(*) AS n FROM sensor_sessions WHERE approval_state='PENDING' AND ended_at IS NOT NULL").get().n,
      0,
    );
  });
}

test("CLIENT Stop is completely unaffected: stays PENDING, still requires explicit approval", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, null, "EDITING", null, 1, local);
  const stopped = db.prepare(SENSOR_SESSION_STOP_SQL).get(1, local, 200);
  assert.equal(stopped.approval_state, "PENDING");
  const row = db.prepare("SELECT approval_state, archived_at FROM sensor_sessions WHERE local_session_id=?").get(local);
  assert.equal(row.approval_state, "PENDING");
  assert.equal(row.archived_at, null);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM sensor_sessions WHERE approval_state='PENDING' AND ended_at IS NOT NULL").get().n,
    1,
  );
});

test("a finalized non-CLIENT session can be corrected (start/end/context/label) without approval or a fake video", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const started = db.prepare(SENSOR_SESSION_START_SQL).get(null, "INTERNAL", "old label", 100, null, "OTHER", null, 1, local);
  db.prepare(SENSOR_SESSION_STOP_SQL).get(1, local, 3_760); // 61 minutes
  const corrected = db.prepare(SENSOR_SESSION_UPDATE_NONCLIENT_SQL).get(started.id, "ADMIN", "new label", 100, 2_920, 500); // 47 minutes
  assert.equal(corrected.context_type, "ADMIN");
  assert.equal(corrected.context_label, "new label");
  assert.equal(corrected.ended_at, 2_920);
  const row = db.prepare("SELECT context_type, context_label, ended_at, video_id, approval_state FROM sensor_sessions WHERE id=?").get(started.id);
  assert.equal(row.context_type, "ADMIN");
  assert.equal(row.approval_state, "ARCHIVED", "correction must not require re-approval");
  assert.equal(row.video_id, null);
});

test("SENSOR_SESSION_UPDATE_NONCLIENT_SQL refuses to touch a CLIENT row or move a row into/out of CLIENT", () => {
  const db = fixture();
  const clientLocal = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const client = db.prepare(SENSOR_SESSION_START_SQL).get(4, "CLIENT", null, 100, 200, "EDITING", null, 1, clientLocal);
  // Cannot correct a CLIENT row through the non-client path at all.
  assert.equal(db.prepare(SENSOR_SESSION_UPDATE_NONCLIENT_SQL).get(client.id, "INTERNAL", null, 100, 200, 500), undefined);

  const internalLocal = "63ee7bf9-881f-5d0a-b571-215386bf5ea0";
  const internal = db.prepare(SENSOR_SESSION_START_SQL).get(null, "INTERNAL", null, 100, null, "OTHER", null, 1, internalLocal);
  db.prepare(SENSOR_SESSION_STOP_SQL).get(1, internalLocal, 200);
  // Cannot use this path to convert a non-client row into CLIENT.
  assert.equal(db.prepare(SENSOR_SESSION_UPDATE_NONCLIENT_SQL).get(internal.id, "CLIENT", null, 100, 200, 500), undefined);
  assert.equal(db.prepare("SELECT context_type FROM sensor_sessions WHERE id=?").get(internal.id).context_type, "INTERNAL");
});

test("a still-open (never stopped) non-CLIENT session cannot be corrected through the finalized-session path", () => {
  const db = fixture();
  const local = "52dd6ad8-770e-4bc9-a200-c453fea749cf";
  const started = db.prepare(SENSOR_SESSION_START_SQL).get(null, "ADMIN", null, 100, null, "ADMIN", null, 1, local);
  assert.equal(db.prepare(SENSOR_SESSION_UPDATE_NONCLIENT_SQL).get(started.id, "ADMIN", null, 100, 200, 500), undefined);
});
