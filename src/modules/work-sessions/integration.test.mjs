import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { Worker } from "node:worker_threads";

import {
  CORRECT_WORK_SESSION_SQL,
  OPEN_WORK_SESSION_SQL,
  START_WORK_SESSION_SQL,
  STOP_WORK_SESSION_AT_SQL,
  STOP_WORK_SESSION_SQL,
  VIDEO_WORK_SESSION_SUMMARY_SQL,
  WORK_SESSION_HISTORY_SQL,
} from "./core.ts";

const migration = readFileSync(
  new URL("../../db/migrations/0011_brainy_ultimo.sql", import.meta.url),
  "utf8",
);
// Sprint 1.2.1 Ledger P1's additive migration (source + updated_at
// columns). Applied on top of 0011 in the fixture below, exactly as it is
// in the real migration chain.
const ledgerMigration = readFileSync(
  new URL("../../db/migrations/0014_first_shockwave.sql", import.meta.url),
  "utf8",
);

const plain = (row) => (row ? { ...row } : row);

function createFixtureDatabase(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL
    );
    CREATE TABLE video_logs (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      title TEXT,
      client_id INTEGER REFERENCES clients(id),
      project_id INTEGER REFERENCES projects(id),
      status TEXT NOT NULL,
      started_at INTEGER
    );
    INSERT INTO clients VALUES (1, 'Client A'), (2, 'Client B');
    INSERT INTO projects VALUES
      (10, 1, 'Project A'),
      (20, 2, 'Project B');
    INSERT INTO video_logs VALUES
      (100, '2026-08-22', 'Video A', 1, 10, 'IN_PROGRESS', 900),
      (200, '2026-08-22', 'Video B', 2, 20, 'PLANNED', NULL),
      (300, '2026-08-22', 'Zero sessions', 1, 10, 'PLANNED', NULL);
  `);
  db.exec(migration);
  db.exec(ledgerMigration);
  return db;
}

function start(db, videoId, startedAt, activityType = "EDITING") {
  return plain(
    db.prepare(START_WORK_SESSION_SQL).get(videoId, startedAt, activityType),
  );
}

function stop(db, videoId, endedAt) {
  return plain(db.prepare(STOP_WORK_SESSION_SQL).get(videoId, endedAt));
}

test("valid Start and Stop preserve video lifecycle and raw timestamps", () => {
  const db = createFixtureDatabase();
  const lifecycleBefore = plain(
    db.prepare("SELECT status, started_at FROM video_logs WHERE id = 100").get(),
  );

  assert.deepEqual(start(db, 100, 1_000), {
    id: 1,
    video_id: 100,
    started_at: 1_000,
    ended_at: null,
    activity_type: "EDITING",
    note: null,
  });
  assert.deepEqual(stop(db, 100, 4_600), {
    id: 1,
    video_id: 100,
    started_at: 1_000,
    ended_at: 4_600,
    activity_type: "EDITING",
    note: null,
  });
  assert.deepEqual(
    plain(db.prepare("SELECT status, started_at FROM video_logs WHERE id = 100").get()),
    lifecycleBefore,
  );
  db.close();
});

test("nonexistent video and a second open Start are rejected without writes", () => {
  const db = createFixtureDatabase();
  assert.equal(start(db, 999, 1_000), undefined);
  assert.ok(start(db, 100, 1_000));
  assert.equal(start(db, 200, 1_001, "COLOR"), undefined);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM work_sessions WHERE ended_at IS NULL").get().count,
    1,
  );
  db.close();
});

test("the partial unique index structurally allows only one global open session", () => {
  const db = createFixtureDatabase();
  const indexSql = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'work_sessions_one_open_idx'",
    )
    .get().sql;
  assert.match(indexSql, /UNIQUE INDEX/u);
  assert.match(indexSql, /\(\(1\)\)/u);
  assert.match(indexSql, /WHERE .*ended_at.* is null/u);

  assert.ok(start(db, 100, 1_000));
  assert.throws(
    () =>
      db.exec(
        "INSERT INTO work_sessions (video_id, started_at, activity_type) VALUES (100, 1001, 'COLOR')",
      ),
    /work_sessions_one_open_idx/u,
  );
  assert.throws(
    () =>
      db.exec(
        "INSERT INTO work_sessions (video_id, started_at, activity_type) VALUES (200, 1002, 'AUDIO')",
      ),
    /work_sessions_one_open_idx/u,
  );

  assert.ok(stop(db, 100, 1_100));
  db.exec(`
    INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type)
    VALUES
      (100, 1200, 1300, 'REVIEW'),
      (200, 1400, 1500, 'EXPORT');
  `);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM work_sessions WHERE ended_at IS NOT NULL").get().count,
    3,
  );

  assert.ok(start(db, 200, 1_600, "COLOR"));
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM work_sessions WHERE ended_at IS NULL").get().count,
    1,
  );
  db.close();
});

test("double Stop and impossible end times are rejected safely", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000));
  assert.equal(stop(db, 100, 1_000), undefined);
  assert.equal(stop(db, 100, 999), undefined);
  assert.ok(stop(db, 100, 1_001));
  assert.equal(stop(db, 100, 1_002), undefined);
  assert.equal(
    db.prepare("SELECT ended_at FROM work_sessions WHERE id = 1").get().ended_at,
    1_001,
  );
  assert.throws(
    () =>
      db.exec(
        "INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (100, 20, 10)",
      ),
    /work_sessions_ended_after_started_check/u,
  );
  db.close();
});

test("invalid activity is rejected by the canonical table", () => {
  const db = createFixtureDatabase();
  assert.throws(
    () => start(db, 100, 1_000, "SURVEILLANCE"),
    /work_sessions_activity_type_check/u,
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM work_sessions").get().count, 0);
  db.close();
});

test("refresh or process restart recovers the active session", () => {
  const directory = mkdtempSync(join(tmpdir(), "mindbunker-work-session-recovery-"));
  const path = join(directory, "recovery.sqlite");
  try {
    const firstConnection = createFixtureDatabase(path);
    assert.ok(start(firstConnection, 100, 1_000, "MOTION_GRAPHICS"));
    firstConnection.close();

    const reloadedConnection = new DatabaseSync(path);
    const recovered = plain(
      reloadedConnection.prepare(OPEN_WORK_SESSION_SQL).get(),
    );
    assert.deepEqual(recovered, {
      id: 1,
      video_id: 100,
      video_title: "Video A",
      activity_type: "MOTION_GRAPHICS",
      started_at: 1_000,
    });
    reloadedConnection.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("closed aggregate excludes open sessions and zero-session videos return zero", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000));
  assert.ok(stop(db, 100, 2_800));
  assert.ok(start(db, 100, 4_000, "AUDIO"));

  assert.deepEqual(
    plain(db.prepare(VIDEO_WORK_SESSION_SUMMARY_SQL).get(100)),
    { video_id: 100, closed_seconds: 1_800, session_count: 2 },
  );
  assert.deepEqual(
    plain(db.prepare(VIDEO_WORK_SESSION_SUMMARY_SQL).get(300)),
    { video_id: 300, closed_seconds: 0, session_count: 0 },
  );
  db.close();
});

test("session attribution remains video-only and derives project and client", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000, "REVIEW"));
  assert.ok(stop(db, 100, 1_600));

  assert.deepEqual(
    db
      .prepare("PRAGMA table_info('work_sessions')")
      .all()
      .map(({ name }) => name),
    [
      "id",
      "video_id",
      "started_at",
      "ended_at",
      "activity_type",
      "note",
      "created_at",
      "source",
      "updated_at",
    ],
  );
  assert.deepEqual(
    plain(
      db.prepare(`
        SELECT ws.video_id, v.project_id, p.client_id,
               SUM(ws.ended_at - ws.started_at) AS closed_seconds
        FROM work_sessions ws
        JOIN video_logs v ON v.id = ws.video_id
        JOIN projects p ON p.id = v.project_id
        WHERE ws.ended_at IS NOT NULL
        GROUP BY ws.video_id, v.project_id, p.client_id
      `).get(),
    ),
    { video_id: 100, project_id: 10, client_id: 1, closed_seconds: 600 },
  );
  db.close();
});

test("tracked work prevents accidental video deletion", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000, "EDITING"));
  assert.ok(stop(db, 100, 1_600));
  assert.throws(
    () => db.exec("DELETE FROM video_logs WHERE id = 100"),
    /FOREIGN KEY constraint failed/u,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM video_logs WHERE id = 100").get().count,
    1,
  );
  db.close();
});

test("session history joins client/project, orders newest first, and leaves open sessions undated", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000, "EDITING"));
  assert.ok(stop(db, 100, 2_800));
  assert.ok(start(db, 200, 3_000, "COLOR"));

  const rows = db.prepare(WORK_SESSION_HISTORY_SQL).all(10).map(plain);
  assert.deepEqual(
    rows.map((row) => [row.video_id, row.client_name, row.project_name, row.ended_at]),
    [
      [200, "Client B", "Project B", null],
      [100, "Client A", "Project A", 2_800],
    ],
  );
  assert.equal(rows[0].started_at, 3_000);
  db.close();
});

test("session history respects the LIMIT parameter", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000));
  assert.ok(stop(db, 100, 1_100));
  assert.ok(start(db, 100, 1_200));
  assert.ok(stop(db, 100, 1_300));
  assert.ok(start(db, 100, 1_400));
  assert.ok(stop(db, 100, 1_500));

  const rows = db.prepare(WORK_SESSION_HISTORY_SQL).all(2).map(plain);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.started_at), [1_400, 1_200]);
  db.close();
});

test("session history video filter (local dogfooding consolidation) narrows to one video without changing the unfiltered query", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000, "EDITING"));
  assert.ok(stop(db, 100, 1_600));
  assert.ok(start(db, 200, 2_000, "COLOR"));
  assert.ok(stop(db, 200, 2_600));

  const filtered = db.prepare(WORK_SESSION_HISTORY_SQL).all(10, 200).map(plain);
  assert.deepEqual(filtered.map((row) => row.video_id), [200]);

  // A NULL filter (the default when no video is chosen) must still return
  // every video's sessions, exactly as before this filter existed.
  const unfiltered = db.prepare(WORK_SESSION_HISTORY_SQL).all(10, null).map(plain);
  assert.deepEqual(
    unfiltered.map((row) => row.video_id).sort(),
    [100, 200],
  );
  db.close();
});

test("competing Start requests cannot create two open sessions", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mindbunker-work-session-race-"));
  const path = join(directory, "race.sqlite");
  const workerSource = `
    const { parentPort, workerData } = require("node:worker_threads");
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(workerData.path);
    db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    parentPort.postMessage({ type: "ready" });
    parentPort.once("message", () => {
      let result;
      try {
        const row = db.prepare(workerData.sql).get(
          workerData.videoId,
          workerData.startedAt,
          workerData.activityType,
        );
        result = { type: "result", inserted: Boolean(row) };
      } catch (error) {
        result = {
          type: "result",
          inserted: false,
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        db.close();
      }
      parentPort.postMessage(result);
    });
  `;

  try {
    const setup = createFixtureDatabase(path);
    setup.close();
    const workers = [
      new Worker(workerSource, {
        eval: true,
        workerData: {
          path,
          sql: START_WORK_SESSION_SQL,
          videoId: 100,
          startedAt: 1_000,
          activityType: "EDITING",
        },
      }),
      new Worker(workerSource, {
        eval: true,
        workerData: {
          path,
          sql: START_WORK_SESSION_SQL,
          videoId: 200,
          startedAt: 1_001,
          activityType: "COLOR",
        },
      }),
    ];

    let ready = 0;
    const results = await Promise.all(
      workers.map(
        (worker) =>
          new Promise((resolve, reject) => {
            worker.on("error", reject);
            worker.on("message", (message) => {
              if (message.type === "ready") {
                ready += 1;
                if (ready === workers.length) {
                  for (const candidate of workers) candidate.postMessage("go");
                }
                return;
              }
              if (message.type === "result") resolve(message);
            });
          }),
      ),
    );

    const verification = new DatabaseSync(path);
    const openCount = verification
      .prepare("SELECT COUNT(*) AS count FROM work_sessions WHERE ended_at IS NULL")
      .get().count;
    const totalCount = verification
      .prepare("SELECT COUNT(*) AS count FROM work_sessions")
      .get().count;
    verification.close();

    assert.equal(results.filter(({ inserted }) => inserted).length, 1);
    assert.equal(openCount, 1);
    assert.equal(totalCount, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function correct(db, id, videoId, startedAt, endedAt, activityType, note, updatedAt) {
  return plain(
    db
      .prepare(CORRECT_WORK_SESSION_SQL)
      .get(id, videoId, startedAt, endedAt, activityType, note, updatedAt),
  );
}

function stopAt(db, videoId, endedAt, now) {
  return plain(db.prepare(STOP_WORK_SESSION_AT_SQL).get(videoId, endedAt, now));
}

test("new columns default honestly: every session is WEB_TIMER, never corrected until it is", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000));
  assert.ok(stop(db, 100, 1_600));
  const row = plain(
    db.prepare("SELECT source, updated_at FROM work_sessions WHERE id = 1").get(),
  );
  assert.deepEqual(row, { source: "WEB_TIMER", updated_at: null });
  db.close();
});

test("correction cannot touch the open session, only an already-closed one", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000, "EDITING"));
  // id 1 is still open — CORRECT_WORK_SESSION_SQL's own guard must refuse it.
  assert.equal(
    correct(db, 1, 100, 900, 1_500, "REVIEW", null, 5_000),
    undefined,
  );
  assert.deepEqual(
    plain(db.prepare("SELECT started_at, ended_at, activity_type FROM work_sessions WHERE id = 1").get()),
    { started_at: 1_000, ended_at: null, activity_type: "EDITING" },
  );
  db.close();
});

test("correction updates values, sets updated_at, and can reassign the video", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000, "EDITING"));
  assert.ok(stop(db, 100, 1_600));

  const corrected = correct(db, 1, 200, 900, 1_500, "REVIEW", "moved to the right video", 5_000);
  assert.deepEqual(corrected, {
    id: 1,
    video_id: 200,
    started_at: 900,
    ended_at: 1_500,
    activity_type: "REVIEW",
    note: "moved to the right video",
    updated_at: 5_000,
  });
  db.close();
});

test("correction rejects an inverted/zero duration and a nonexistent video, at the SQL level too", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000, "EDITING"));
  assert.ok(stop(db, 100, 1_600));

  assert.equal(
    correct(db, 1, 100, 1_500, 1_000, "EDITING", null, 5_000),
    undefined,
    "end before start must be rejected",
  );
  assert.equal(
    correct(db, 1, 100, 1_000, 1_000, "EDITING", null, 5_000),
    undefined,
    "zero-length duration must be rejected",
  );
  assert.equal(
    correct(db, 1, 999, 900, 1_500, "EDITING", null, 5_000),
    undefined,
    "reassigning to a nonexistent video must be rejected",
  );
  assert.deepEqual(
    plain(db.prepare("SELECT started_at, ended_at, video_id FROM work_sessions WHERE id = 1").get()),
    { started_at: 1_000, ended_at: 1_600, video_id: 100 },
    "none of the rejected attempts wrote anything",
  );
  db.close();
});

test("correction is idempotent-safe: correcting to the same values twice succeeds both times", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000, "EDITING"));
  assert.ok(stop(db, 100, 1_600));

  const first = correct(db, 1, 100, 1_000, 1_600, "REVIEW", "fixed activity", 5_000);
  assert.ok(first);
  const second = correct(db, 1, 100, 1_000, 1_600, "REVIEW", "fixed activity", 6_000);
  assert.ok(second);
  assert.equal(second.updated_at, 6_000);
  db.close();
});

test("stale-session recovery stops at a chosen past time, never in the future", () => {
  const db = createFixtureDatabase();
  assert.ok(start(db, 100, 1_000, "EDITING"));

  assert.equal(
    stopAt(db, 100, 900, 10_000),
    undefined,
    "chosen end before the session's own start must be rejected",
  );
  assert.equal(
    stopAt(db, 100, 11_000, 10_000),
    undefined,
    "chosen end after the passed-in now bound must be rejected",
  );
  const stopped = stopAt(db, 100, 5_000, 10_000);
  assert.deepEqual(stopped, {
    id: 1,
    video_id: 100,
    started_at: 1_000,
    ended_at: 5_000,
    activity_type: "EDITING",
    note: null,
  });
  db.close();
});

test("Historical module code never references work_sessions — the tier boundary is structural, not just convention", () => {
  const historicalDir = new URL("../historical/", import.meta.url);
  const sourceFiles = ["actions.ts", "core.ts", "data.ts"];
  for (const file of sourceFiles) {
    const text = readFileSync(new URL(file, historicalDir), "utf8");
    assert.doesNotMatch(
      text,
      /work_sessions|workSessions/u,
      `${file} must never read or write work_sessions — historical reconstructed evidence and native Work Sessions must stay two separate authorities`,
    );
  }
});
