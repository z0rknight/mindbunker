import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDir = new URL("../../db/migrations/", import.meta.url);

function createDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    db.exec(readFileSync(new URL(file, migrationsDir), "utf8"));
  }
  return db;
}

test("Pre-Wave 1 keeps source custody, intentional time and capture occurrence as separate facts", () => {
  const db = createDatabase();
  db.prepare("INSERT INTO clients (id, name, status) VALUES (2, 'Taryn', 'active')").run();
  db.prepare("INSERT INTO projects (id, client_id, name, status) VALUES (19, 2, 'GEOFF - September Long Form Videos', 'active')").run();
  db.prepare(`
    INSERT INTO video_logs (id, date, title, client_id, project_id, status, published_url)
    VALUES (86, '2026-10-06', 'Offer Doc', 2, 19, 'IN_PROGRESS', 'https://drive.example/source.mov')
  `).run();

  assert.equal(
    db.prepare("SELECT COUNT(*) count FROM source_media_references WHERE project_id = 19").get().count,
    0,
    "A URL in published_url must not masquerade as a Source Media reference",
  );
  db.prepare(`
    INSERT INTO source_media_references (project_id, source_url, location, profile)
    VALUES (19, 'https://drive.example/source.mov', 'Google Drive', '1080p source')
  `).run();
  assert.equal(
    db.prepare("SELECT COUNT(*) count FROM source_media_references WHERE project_id = 19").get().count,
    1,
    "Source Media count must come only from its canonical collection",
  );

  db.prepare("INSERT INTO sensor_devices (id, public_id, name, token_hash, scopes) VALUES (1, 'qa-device', 'QA Mac', 'hash', 'OBSERVATION_WRITE,SESSION_WRITE')").run();
  db.prepare(`
    INSERT INTO work_sessions (id, video_id, started_at, activity_type, source, sensor_device_id)
    VALUES (105, 86, 1000, 'EDITING', 'MAC_SENSOR', 1)
  `).run();
  db.prepare(`
    INSERT INTO captures
      (context, event_type, note, started_at, source, sensor_device_id, local_capture_id,
       context_snapshot_json, canonical_work_session_id, created_at)
    VALUES
      ('CLIENT', 'OTHER', 'terminei a limpeza no video', 1300, 'MAC_SENSOR', 1,
       '52dd6ad8-770e-4bc9-a200-c453fea749cf', '{"schemaVersion":1}', 105, 1500)
  `).run();
  db.prepare("UPDATE work_sessions SET ended_at = 1600 WHERE id = 105").run();

  assert.deepEqual(
    { ...db.prepare(`
      SELECT SUM(ended_at - started_at) closed_seconds, COUNT(*) session_count
      FROM work_sessions WHERE video_id = 86 AND ended_at IS NOT NULL
    `).get() },
    { closed_seconds: 600, session_count: 1 },
  );
  assert.equal(
    db.prepare("SELECT status FROM video_logs WHERE id = 86").get().status,
    "IN_PROGRESS",
    "Ending a Session must not finish the Video",
  );
  assert.deepEqual(
    { ...db.prepare("SELECT started_at occurred_at, created_at recorded_at, canonical_work_session_id session_id FROM captures WHERE local_capture_id = '52dd6ad8-770e-4bc9-a200-c453fea749cf'").get() },
    { occurred_at: 1300, recorded_at: 1500, session_id: 105 },
    "The read path must preserve occurred time separately from ingestion time",
  );

  const before = {
    clients: db.prepare("SELECT COUNT(*) count FROM clients").get().count,
    projects: db.prepare("SELECT COUNT(*) count FROM projects").get().count,
    videos: db.prepare("SELECT COUNT(*) count FROM video_logs").get().count,
    sessions: db.prepare("SELECT COUNT(*) count FROM work_sessions").get().count,
  };
  db.prepare(`
    INSERT INTO captures (context, event_type, note, started_at, source, sensor_device_id, local_capture_id, context_snapshot_json, created_at)
    VALUES ('UNKNOWN', 'OTHER', 'No Session note', 1700, 'MAC_SENSOR', 1,
      'd5a7412f-0842-4ac1-9ec3-c84eb632ba3c', '{"schemaVersion":1}', 1800)
  `).run();
  assert.deepEqual({
    clients: db.prepare("SELECT COUNT(*) count FROM clients").get().count,
    projects: db.prepare("SELECT COUNT(*) count FROM projects").get().count,
    videos: db.prepare("SELECT COUNT(*) count FROM video_logs").get().count,
    sessions: db.prepare("SELECT COUNT(*) count FROM work_sessions").get().count,
  }, before, "No-Session Capture must not invent domain entities");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
});

