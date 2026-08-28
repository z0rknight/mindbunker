import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeActivityWatchEvent } from "./core.ts";

// Pre-Operation Reality Hardening — ActivityWatch Import round.
//
// confirmActivityWatchImport (actions.ts) is a "use server" action needing
// a Next.js/Cloudflare/R2 request context this test runner doesn't have,
// so (same convention as revisions.integration.test.mjs and
// video-priority.integration.test.mjs) this file mirrors its exact SQL
// against the real migration chain instead of invoking the action
// directly. What's under test here is the SCHEMA-LEVEL contract
// (idempotency via the fingerprint unique index, provenance default,
// import<->event linkage) -- the event NORMALIZATION itself (what makes
// two events the "same" event) is the real, imported pure function from
// core.ts, not a re-implementation.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) db.exec(trimmed);
    }
  }
  return db;
}

function insertImportRow(db, { bucketId, bucketType, hostname, fileFingerprint, r2ObjectKey, fileSizeBytes }) {
  const existing = db
    .prepare("SELECT id FROM activitywatch_imports WHERE file_fingerprint = ?")
    .get(fileFingerprint);
  if (existing) return { id: existing.id, alreadyImported: true };
  db.prepare(
    `INSERT INTO activitywatch_imports
       (bucket_id, bucket_type, hostname, file_fingerprint, r2_object_key, file_size_bytes)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(bucketId, bucketType, hostname, fileFingerprint, r2ObjectKey, fileSizeBytes);
  const row = db
    .prepare("SELECT id FROM activitywatch_imports WHERE file_fingerprint = ?")
    .get(fileFingerprint);
  return { id: row.id, alreadyImported: false };
}

// Mirrors confirmActivityWatchImport's per-row INSERT ... ON CONFLICT DO
// NOTHING. Returns true if a NEW row was actually inserted, false if the
// fingerprint already existed (duplicate, correctly skipped).
function insertEvent(db, importId, event) {
  const info = db
    .prepare(
      `INSERT INTO activitywatch_events
         (import_id, bucket_id, bucket_type, hostname, started_at, duration_seconds, app_name, window_title, afk_status, fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fingerprint) DO NOTHING`,
    )
    .run(
      importId,
      event.bucketId,
      event.bucketType,
      event.hostname,
      Math.floor(event.startedAt.getTime() / 1000),
      event.durationSeconds,
      event.appName,
      event.windowTitle,
      event.afkStatus,
      event.fingerprint,
    );
  return info.changes === 1;
}

function makeWindowEvent(bucketId, hostname, isoTimestamp, duration, app, title) {
  const result = normalizeActivityWatchEvent(
    { timestamp: isoTimestamp, duration, data: { app, title } },
    { bucketId, bucketType: "WINDOW", hostname },
  );
  assert.equal(result.ok, true);
  return result.event;
}

function makeAfkEvent(bucketId, hostname, isoTimestamp, duration, status) {
  const result = normalizeActivityWatchEvent(
    { timestamp: isoTimestamp, duration, data: { status } },
    { bucketId, bucketType: "AFK", hostname },
  );
  assert.equal(result.ok, true);
  return result.event;
}

test("importing the same file twice writes each event exactly once (idempotent reimport)", () => {
  const db = buildMigratedDb();
  const events = [
    makeWindowEvent("aw-watcher-window_host", "host", "2026-08-01T10:00:00Z", 5, "Safari", "Docs"),
    makeWindowEvent("aw-watcher-window_host", "host", "2026-08-01T10:00:05Z", 3, "Terminal", "zsh"),
  ];

  const first = insertImportRow(db, {
    bucketId: "aw-watcher-window_host",
    bucketType: "WINDOW",
    hostname: "host",
    fileFingerprint: "file-fp-1",
    r2ObjectKey: "activitywatch-imports/one.json",
    fileSizeBytes: 1234,
  });
  assert.equal(first.alreadyImported, false);
  const firstInsertedCount = events.filter((e) => insertEvent(db, first.id, e)).length;
  assert.equal(firstInsertedCount, 2);

  // Reimport the exact same file (same fileFingerprint) -- the fast path
  // in confirmActivityWatchImport would short-circuit here; this test
  // proves that even if it didn't, the per-event fingerprint unique index
  // makes a second pass a true no-op.
  const second = insertImportRow(db, {
    bucketId: "aw-watcher-window_host",
    bucketType: "WINDOW",
    hostname: "host",
    fileFingerprint: "file-fp-1",
    r2ObjectKey: "activitywatch-imports/one.json",
    fileSizeBytes: 1234,
  });
  assert.equal(second.alreadyImported, true);
  assert.equal(second.id, first.id);

  const secondInsertedCount = events.filter((e) => insertEvent(db, second.id, e)).length;
  assert.equal(secondInsertedCount, 0, "reimporting must insert zero new rows");

  const total = db.prepare("SELECT COUNT(*) AS n FROM activitywatch_events").get();
  assert.equal(total.n, 2, "exactly two events on disk, never four");
});

test("overlapping event ranges from two DIFFERENT export files still dedupe at the per-event level", () => {
  const db = buildMigratedDb();
  const overlapping = makeWindowEvent(
    "aw-watcher-window_host",
    "host",
    "2026-08-01T10:00:00Z",
    5,
    "Safari",
    "Docs",
  );
  const onlyInFileA = makeWindowEvent(
    "aw-watcher-window_host",
    "host",
    "2026-08-01T09:59:00Z",
    5,
    "Mail",
    "Inbox",
  );
  const onlyInFileB = makeWindowEvent(
    "aw-watcher-window_host",
    "host",
    "2026-08-01T10:01:00Z",
    5,
    "Slack",
    "#general",
  );

  const importA = insertImportRow(db, {
    bucketId: "aw-watcher-window_host",
    bucketType: "WINDOW",
    hostname: "host",
    fileFingerprint: "file-fp-A",
    r2ObjectKey: "a.json",
    fileSizeBytes: 100,
  });
  [onlyInFileA, overlapping].forEach((e) => insertEvent(db, importA.id, e));

  const importB = insertImportRow(db, {
    bucketId: "aw-watcher-window_host",
    bucketType: "WINDOW",
    hostname: "host",
    fileFingerprint: "file-fp-B", // a DIFFERENT file (e.g. a later, wider re-export)
    r2ObjectKey: "b.json",
    fileSizeBytes: 200,
  });
  const insertedFromB = [overlapping, onlyInFileB].filter((e) => insertEvent(db, importB.id, e));
  assert.equal(insertedFromB.length, 1, "the overlapping event must not be inserted twice");
  assert.equal(insertedFromB[0].windowTitle, "#general");

  const total = db.prepare("SELECT COUNT(*) AS n FROM activitywatch_events").get();
  assert.equal(total.n, 3, "3 real distinct events total, not 4");
});

test("provenance is always ACTIVITYWATCH (the schema default, never something else)", () => {
  const db = buildMigratedDb();
  const importRow = insertImportRow(db, {
    bucketId: "aw-watcher-afk_host",
    bucketType: "AFK",
    hostname: "host",
    fileFingerprint: "file-fp-afk",
    r2ObjectKey: "afk.json",
    fileSizeBytes: 50,
  });
  insertEvent(db, importRow.id, makeAfkEvent("aw-watcher-afk_host", "host", "2026-08-01T00:00:00Z", 300, "afk"));

  const row = db.prepare("SELECT provenance FROM activitywatch_events LIMIT 1").get();
  assert.equal(row.provenance, "ACTIVITYWATCH");
});

test("WINDOW and AFK events are stored as independent facts -- no correlation, no merging", () => {
  const db = buildMigratedDb();
  const windowImport = insertImportRow(db, {
    bucketId: "aw-watcher-window_host",
    bucketType: "WINDOW",
    hostname: "host",
    fileFingerprint: "file-fp-w",
    r2ObjectKey: "w.json",
    fileSizeBytes: 10,
  });
  const afkImport = insertImportRow(db, {
    bucketId: "aw-watcher-afk_host",
    bucketType: "AFK",
    hostname: "host",
    fileFingerprint: "file-fp-a",
    r2ObjectKey: "a.json",
    fileSizeBytes: 10,
  });
  insertEvent(
    db,
    windowImport.id,
    makeWindowEvent("aw-watcher-window_host", "host", "2026-08-01T10:00:00Z", 5, "Safari", "Docs"),
  );
  insertEvent(db, afkImport.id, makeAfkEvent("aw-watcher-afk_host", "host", "2026-08-01T10:00:00Z", 5, "not-afk"));

  const windowRows = db.prepare("SELECT * FROM activitywatch_events WHERE bucket_type = 'WINDOW'").all();
  const afkRows = db.prepare("SELECT * FROM activitywatch_events WHERE bucket_type = 'AFK'").all();
  assert.equal(windowRows.length, 1);
  assert.equal(afkRows.length, 1);
  assert.equal(windowRows[0].afk_status, null);
  assert.equal(afkRows[0].app_name, null);
  // Different import rows -- nothing links a WINDOW row to an AFK row.
  assert.notEqual(windowRows[0].import_id, afkRows[0].import_id);
});

test("no ActivityWatch import ever writes to sensor_sessions", () => {
  const db = buildMigratedDb();
  const importRow = insertImportRow(db, {
    bucketId: "aw-watcher-window_host",
    bucketType: "WINDOW",
    hostname: "host",
    fileFingerprint: "file-fp-sensor-check",
    r2ObjectKey: "w.json",
    fileSizeBytes: 10,
  });
  insertEvent(
    db,
    importRow.id,
    makeWindowEvent("aw-watcher-window_host", "host", "2026-08-01T10:00:00Z", 5, "Safari", "Docs"),
  );

  const sensorSessions = db.prepare("SELECT COUNT(*) AS n FROM sensor_sessions").get();
  assert.equal(sensorSessions.n, 0);
  const deviceObservations = db.prepare("SELECT COUNT(*) AS n FROM device_activity_observations").get();
  assert.equal(deviceObservations.n, 0);
  const workSessions = db.prepare("SELECT COUNT(*) AS n FROM work_sessions").get();
  assert.equal(workSessions.n, 0);
});

test("activitywatch_events.import_id references a real activitywatch_imports row (foreign key integrity)", () => {
  const db = buildMigratedDb();
  const importRow = insertImportRow(db, {
    bucketId: "aw-watcher-window_host",
    bucketType: "WINDOW",
    hostname: "host",
    fileFingerprint: "file-fp-fk",
    r2ObjectKey: "w.json",
    fileSizeBytes: 10,
  });
  insertEvent(
    db,
    importRow.id,
    makeWindowEvent("aw-watcher-window_host", "host", "2026-08-01T10:00:00Z", 5, "Safari", "Docs"),
  );
  const violations = db.prepare("PRAGMA foreign_key_check").all();
  assert.deepEqual(violations, []);
});

test("navigation: /all-history links to /all-history/import via a visible 'Import history' control", () => {
  const pagePath = path.resolve(__dirname, "../../app/all-history/page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /href="\/mindbunker\/all-history\/import"/);
  assert.match(source, /Import history/);
});
