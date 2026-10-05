import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { canonicalClientId } from "../../lib/client-identity.ts";
import {
  RMEDIA_CANONICAL_END_EVENT_SQL,
  RMEDIA_CANONICAL_END_SQL,
  RMEDIA_CANONICAL_START_EVENT_SQL,
  RMEDIA_CANONICAL_START_SQL,
  SENSOR_CAPTURE_INSERT_SQL,
} from "./core.ts";

const migrationsDir = new URL("../../db/migrations/", import.meta.url);
const migration = readFileSync(new URL("../../db/migrations/0054_thick_sheva_callister.sql", import.meta.url), "utf8");

function createExact0053Database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql") && name < "0054_").sort()) {
    db.exec(readFileSync(new URL(file, migrationsDir), "utf8"));
  }
  return db;
}

test("migration 0054 is additive, nullable, and keeps pre-existing Captures valid", () => {
  const db = createExact0053Database();
  db.prepare("INSERT INTO captures (context, event_type, note) VALUES ('LEAD', 'OTHER', 'existing evidence')").run();
  db.exec(migration);
  const row = db.prepare("SELECT note, context_snapshot_json, canonical_work_session_id FROM captures").get();
  assert.deepEqual({ ...row }, {
    note: "existing evidence",
    context_snapshot_json: null,
    canonical_work_session_id: null,
  });
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
});

test("same RMEDIA capture retried three times creates exactly one Capture and no domain side effects", () => {
  const db = createExact0053Database();
  db.exec(migration);
  db.prepare("INSERT INTO sensor_devices (id, public_id, name, token_hash, scopes) VALUES (1, 'device', 'Mac', 'hash', 'OBSERVATION_WRITE')").run();
  db.prepare("INSERT INTO clients (id, name, status) VALUES (12, 'Taryn DFY', 'active')").run();
  db.prepare("INSERT INTO projects (id, client_id, name) VALUES (20, 12, 'Mini Series')").run();
  db.prepare("INSERT INTO video_logs (id, date, title, client_id, project_id) VALUES (44, '2026-10-04', 'Waterfall Cut 15', 12, 20)").run();
  db.prepare("INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type, source) VALUES (392, 44, 1000, 1600, 'EDITING', 'MAC_SENSOR')").run();
  const before = {
    clients: db.prepare("SELECT COUNT(*) n FROM clients").get().n,
    projects: db.prepare("SELECT COUNT(*) n FROM projects").get().n,
    videos: db.prepare("SELECT COUNT(*) n FROM video_logs").get().n,
    sessions: db.prepare("SELECT COUNT(*) n FROM work_sessions").get().n,
    finance: db.prepare("SELECT COUNT(*) n FROM transactions").get().n,
  };
  const statement = db.prepare(SENSOR_CAPTURE_INSERT_SQL);
  const args = ["CLIENT", "OTHER", "Client requested a music change.", 1300, 1, "52dd6ad8-770e-4bc9-a200-c453fea749cf", '{"schemaVersion":1}', 392];
  const first = statement.get(...args);
  const second = statement.get(...args);
  const third = statement.get(...args);
  assert.ok(first?.id > 0);
  assert.equal(second, undefined);
  assert.equal(third, undefined);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM captures").get().n, 1);
  assert.deepEqual({
    clients: db.prepare("SELECT COUNT(*) n FROM clients").get().n,
    projects: db.prepare("SELECT COUNT(*) n FROM projects").get().n,
    videos: db.prepare("SELECT COUNT(*) n FROM video_logs").get().n,
    sessions: db.prepare("SELECT COUNT(*) n FROM work_sessions").get().n,
    finance: db.prepare("SELECT COUNT(*) n FROM transactions").get().n,
  }, before);
  assert.equal(canonicalClientId(12), 2, "the established Taryn alias still resolves to canonical Client 2");
});

test("capture-time Session association survives Session end and becomes null, not deleted, if history is removed", () => {
  const db = createExact0053Database();
  db.exec(migration);
  db.prepare("INSERT INTO sensor_devices (id, public_id, name, token_hash, scopes) VALUES (1, 'device', 'Mac', 'hash', 'OBSERVATION_WRITE')").run();
  db.prepare("INSERT INTO video_logs (id, date, title) VALUES (44, '2026-10-04', 'Internal research')").run();
  db.prepare("INSERT INTO work_sessions (id, video_id, started_at, ended_at, activity_type) VALUES (392, 44, 1000, NULL, 'OTHER')").run();
  db.prepare(SENSOR_CAPTURE_INSERT_SQL).get("UNKNOWN", "OTHER", "Researching reference footage.", 1300, 1, "52dd6ad8-770e-4bc9-a200-c453fea749cf", '{"schemaVersion":1}', 392);
  db.prepare("UPDATE work_sessions SET ended_at = 1600 WHERE id = 392").run();
  assert.equal(db.prepare("SELECT canonical_work_session_id id FROM captures").get().id, 392);
  db.prepare("DELETE FROM work_sessions WHERE id = 392").run();
  assert.equal(db.prepare("SELECT COUNT(*) n FROM captures").get().n, 1);
  assert.equal(db.prepare("SELECT canonical_work_session_id id FROM captures").get().id, null);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("RMEDIA Start creates one canonical Session and End only closes it without finishing the Video", () => {
  const db = createExact0053Database();
  db.exec(migration);
  db.prepare("INSERT INTO sensor_devices (id, public_id, name, token_hash, scopes) VALUES (1, 'device', 'Mac', 'hash', 'SESSION_WRITE')").run();
  db.prepare("INSERT INTO clients (id, name, status) VALUES (2, 'Taryn', 'active')").run();
  db.prepare("INSERT INTO projects (id, client_id, name, status) VALUES (20, 2, 'Mini Series', 'active')").run();
  db.prepare("INSERT INTO video_logs (id, date, title, client_id, project_id, status) VALUES (44, '2026-10-04', 'Waterfall Cut 15', 2, 20, 'PLANNED')").run();

  const started = db.prepare(RMEDIA_CANONICAL_START_SQL).get(44, 1000, "EDITING", 1);
  db.prepare(RMEDIA_CANONICAL_START_EVENT_SQL).run(44, 2, 1000, "Started from RMEDIA", "start:1", "EDITING", 1);
  assert.ok(started.work_session_id > 0);
  assert.deepEqual({ ...db.prepare("SELECT video_id, started_at, ended_at, activity_type, source, sensor_device_id FROM work_sessions").get() }, {
    video_id: 44,
    started_at: 1000,
    ended_at: null,
    activity_type: "EDITING",
    source: "MAC_SENSOR",
    sensor_device_id: 1,
  });
  assert.equal(db.prepare(RMEDIA_CANONICAL_START_SQL).get(44, 1001, "EDITING", 1), undefined);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM work_sessions").get().n, 1);
  assert.equal(db.prepare("SELECT status FROM video_logs WHERE id = 44").get().status, "PLANNED");

  db.prepare(RMEDIA_CANONICAL_END_SQL).get(started.work_session_id, 1600);
  db.prepare(RMEDIA_CANONICAL_END_EVENT_SQL).run(started.work_session_id, 2, 1600, "end:1");
  assert.equal(db.prepare("SELECT ended_at FROM work_sessions WHERE id = ?").get(started.work_session_id).ended_at, 1600);
  assert.equal(db.prepare("SELECT status FROM video_logs WHERE id = 44").get().status, "PLANNED");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM crm_events WHERE type LIKE 'work_session.%'").get().n, 2);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM transactions").get().n, 0);
});
