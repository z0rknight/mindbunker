import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { Worker } from "node:worker_threads";

import {
  OPEN_WORK_SESSION_SQL,
  START_WORK_SESSION_SQL,
  STOP_WORK_SESSION_SQL,
  VIDEO_WORK_SESSION_SUMMARY_SQL,
} from "./core.ts";

const migration = readFileSync(
  new URL("../../db/migrations/0011_brainy_ultimo.sql", import.meta.url),
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
    ["id", "video_id", "started_at", "ended_at", "activity_type", "note", "created_at"],
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
