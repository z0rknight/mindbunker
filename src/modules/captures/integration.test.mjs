import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

// RMEDIA Engine — Operational Capture MVP (Wave 2). Schema-level
// invariant tests, following this codebase's established pattern
// (src/modules/work-sessions/integration.test.mjs) of a hand-rolled
// in-memory SQLite fixture rather than a live D1 binding. Tables here
// are minimal reproductions of the CURRENT real shape (schema.ts) --
// only the columns these specific assertions touch.

function createFixtureDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL
    );
    CREATE TABLE video_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id),
      project_id INTEGER REFERENCES projects(id),
      title TEXT
    );
    CREATE TABLE work_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL REFERENCES video_logs(id),
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      client_id INTEGER REFERENCES clients(id)
    );
    -- Exact shape from src/db/migrations/0042_careless_sebastian_shaw.sql
    -- plus 0043_little_supreme_intelligence.sql (promotion_claimed_at).
    CREATE TABLE captures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      context TEXT NOT NULL,
      counterparty_label TEXT,
      channel TEXT,
      event_type TEXT DEFAULT 'OTHER' NOT NULL,
      note TEXT,
      started_at INTEGER,
      ended_at INTEGER,
      outcome TEXT DEFAULT 'UNRESOLVED' NOT NULL,
      source TEXT DEFAULT 'WEB_QUICK_CAPTURE' NOT NULL,
      sensor_device_id INTEGER,
      local_capture_id TEXT,
      promotion_claimed_at INTEGER,
      promoted_client_id INTEGER REFERENCES clients(id),
      promoted_project_id INTEGER REFERENCES projects(id),
      promoted_video_id INTEGER REFERENCES video_logs(id),
      promoted_work_session_id INTEGER REFERENCES work_sessions(id),
      dismissed_at INTEGER,
      archived_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      updated_at INTEGER,
      CONSTRAINT captures_ended_after_started_check CHECK (
        ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at
      )
    );
    CREATE UNIQUE INDEX captures_promoted_work_session_unique
      ON captures (promoted_work_session_id);
  `);
  return db;
}

function insertCapture(db, overrides = {}) {
  const values = {
    context: "LEAD",
    counterparty_label: null,
    channel: null,
    event_type: "SAMPLE",
    note: null,
    started_at: null,
    ended_at: null,
    outcome: "UNRESOLVED",
    ...overrides,
  };
  const stmt = db.prepare(`
    INSERT INTO captures (context, counterparty_label, channel, event_type, note, started_at, ended_at, outcome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    values.context,
    values.counterparty_label,
    values.channel,
    values.event_type,
    values.note,
    values.started_at,
    values.ended_at,
    values.outcome,
  );
  return Number(result.lastInsertRowid);
}

function countRows(db, table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

// Wave 2.1 (Promotion Custody release gate). Faithfully mirrors the real
// promoteCapture() in actions.ts step-for-step at the SQL level -- same
// order (claim -> client -> checkpoint -> project -> checkpoint -> video
// -> checkpoint -> work session -> checkpoint -> finalize outcome), same
// re-entry logic (reuse an already-checkpointed id instead of creating a
// new one). `stopAfter` lets a test simulate a crash immediately after
// one specific major step -- exactly the boundaries the mission's
// Failure Matrix (A-D) names -- without needing the real Next.js/D1
// runtime this "use server" function depends on.
//
// staleMs mirrors PROMOTION_CLAIM_STALE_MS (config.ts) so the claim
// logic under test is the real algorithm, not a simplified stand-in.
function scopeComplete(row, wantsVideo) {
  const coreDone = row.promoted_client_id !== null && row.promoted_project_id !== null;
  const videoDone = !wantsVideo || row.promoted_video_id !== null;
  return coreDone && videoDone;
}

function promoteCaptureSim(db, captureId, { stopAfter = null, projectName = "Sample project", createVideo = false, staleMs = 60_000 } = {}) {
  const capture = db.prepare("SELECT * FROM captures WHERE id = ?").get(captureId);
  if (!capture) return { success: false, error: "Capture not found." };

  // Wave 2.1 fix: scope-aware, not just "client+project set" -- a retry
  // that also wants a video must not be short-circuited away just
  // because an earlier attempt already got as far as project. Mirrors
  // core.ts's isPromotionScopeComplete exactly.
  if (scopeComplete(capture, createVideo)) {
    return { success: true, alreadyPromoted: true, clientId: capture.promoted_client_id, projectId: capture.promoted_project_id, videoId: capture.promoted_video_id, workSessionId: capture.promoted_work_session_id };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const staleBefore = nowSeconds - Math.floor(staleMs / 1000);
  const stillIncomplete = createVideo
    ? "(promoted_project_id IS NULL OR promoted_video_id IS NULL)"
    : "promoted_project_id IS NULL";
  const claim = db.prepare(`
    UPDATE captures
    SET promotion_claimed_at = ?
    WHERE id = ? AND ${stillIncomplete}
      AND (promotion_claimed_at IS NULL OR promotion_claimed_at < ?)
  `).run(nowSeconds, captureId, staleBefore);

  if (claim.changes === 0) {
    const fresh = db.prepare("SELECT * FROM captures WHERE id = ?").get(captureId);
    if (scopeComplete(fresh, createVideo)) {
      return { success: true, alreadyPromoted: true, clientId: fresh.promoted_client_id, projectId: fresh.promoted_project_id, videoId: fresh.promoted_video_id, workSessionId: fresh.promoted_work_session_id };
    }
    return { success: false, error: "Promotion is already in progress for this capture. Try again in a moment." };
  }

  let clientId = capture.promoted_client_id;
  if (!clientId) {
    clientId = Number(db.prepare("INSERT INTO clients (name) VALUES (?)").run(capture.counterparty_label ?? "Unnamed").lastInsertRowid);
    db.prepare("UPDATE captures SET promoted_client_id = ? WHERE id = ?").run(clientId, captureId);
  }
  if (stopAfter === "client") return { success: false, error: "SIMULATED_CRASH", clientId };

  let projectId = capture.promoted_project_id;
  if (!projectId) {
    projectId = Number(db.prepare("INSERT INTO projects (client_id, name) VALUES (?, ?)").run(clientId, projectName).lastInsertRowid);
    db.prepare("UPDATE captures SET promoted_project_id = ? WHERE id = ?").run(projectId, captureId);
  }
  if (stopAfter === "project") return { success: false, error: "SIMULATED_CRASH", clientId, projectId };

  let videoId = capture.promoted_video_id;
  let workSessionId = capture.promoted_work_session_id;
  if (createVideo && !videoId) {
    videoId = Number(db.prepare("INSERT INTO video_logs (client_id, project_id, title) VALUES (?, ?, ?)").run(clientId, projectId, "Sample video").lastInsertRowid);
    db.prepare("UPDATE captures SET promoted_video_id = ? WHERE id = ?").run(videoId, captureId);
    if (stopAfter === "video") return { success: false, error: "SIMULATED_CRASH", clientId, projectId, videoId };

    workSessionId = Number(db.prepare("INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, ?, ?)").run(videoId, capture.started_at ?? 0, capture.ended_at ?? 1).lastInsertRowid);
    db.prepare("UPDATE captures SET promoted_work_session_id = ? WHERE id = ?").run(workSessionId, captureId);
    if (stopAfter === "workSession") return { success: false, error: "SIMULATED_CRASH", clientId, projectId, videoId, workSessionId };
  }

  db.prepare("UPDATE captures SET outcome = 'CONVERTED' WHERE id = ?").run(captureId);
  return { success: true, alreadyPromoted: false, clientId, projectId, videoId, workSessionId };
}

// ─── A. Moritz creation: LEAD + SAMPLE + 15m, no client/project/video ──────

test("a LEAD/SAMPLE capture can be stored with every attribution FK null", () => {
  const db = createFixtureDatabase();
  const now = Math.floor(Date.now() / 1000);
  const id = insertCapture(db, {
    counterparty_label: "Moritz-Alexander Germann",
    channel: "UPWORK",
    note: "Proof of work sent",
    started_at: now - 15 * 60,
    ended_at: now,
  });
  const row = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  assert.equal(row.context, "LEAD");
  assert.equal(row.event_type, "SAMPLE");
  assert.equal(row.outcome, "UNRESOLVED");
  assert.equal(row.promoted_client_id, null);
  assert.equal(row.promoted_project_id, null);
  assert.equal(row.promoted_video_id, null);
  assert.equal(row.promoted_work_session_id, null);
  db.close();
});

// ─── B. Internal creation: no canonical business entities required ────────

test("an INTERNAL/INTERNAL_WORK capture can exist with zero canonical rows in the fixture", () => {
  const db = createFixtureDatabase();
  const id = insertCapture(db, {
    context: "INTERNAL",
    counterparty_label: "RMEDIA Engine",
    event_type: "INTERNAL_WORK",
    outcome: "NOT_APPLICABLE",
  });
  assert.equal(countRows(db, "clients"), 0);
  assert.equal(countRows(db, "projects"), 0);
  assert.equal(countRows(db, "video_logs"), 0);
  const row = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  assert.equal(row.context, "INTERNAL");
  db.close();
});

// ─── D. No automatic commercial mutation ───────────────────────────────────

test("creating a capture never inserts a transaction, work session, client, or project", () => {
  const db = createFixtureDatabase();
  insertCapture(db, { context: "LEAD", counterparty_label: "Moritz" });
  insertCapture(db, { context: "INTERNAL", counterparty_label: "RMEDIA Engine", outcome: "NOT_APPLICABLE" });
  assert.equal(countRows(db, "captures"), 2);
  assert.equal(countRows(db, "transactions"), 0);
  assert.equal(countRows(db, "work_sessions"), 0);
  assert.equal(countRows(db, "clients"), 0);
  assert.equal(countRows(db, "projects"), 0);
  db.close();
});

// ─── E. Promotion provenance ────────────────────────────────────────────────

test("promotion preserves every original evidence field unchanged", () => {
  const db = createFixtureDatabase();
  const startedAt = Math.floor(Date.now() / 1000) - 900;
  const endedAt = Math.floor(Date.now() / 1000);
  const id = insertCapture(db, {
    counterparty_label: "Moritz-Alexander Germann",
    channel: "UPWORK",
    note: "Proof of work sent",
    started_at: startedAt,
    ended_at: endedAt,
  });
  const before = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);

  const result = promoteCaptureSim(db, id);
  assert.equal(result.success, true);

  const after = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);

  // Immutable evidence fields (mission §5) -- byte-for-byte unchanged.
  for (const field of ["context", "counterparty_label", "channel", "event_type", "started_at", "ended_at", "source", "created_at"]) {
    assert.equal(after[field], before[field], `${field} must not change during promotion`);
  }
  assert.equal(after.promoted_client_id, result.clientId);
  assert.equal(after.promoted_project_id, result.projectId);
  assert.equal(after.outcome, "CONVERTED");
  db.close();
});

// ─── Wave 2.1: crash/retry safety at every named failure-matrix boundary ───
//
// These are the tests the release-gate audit explicitly required: force a
// simulated crash AFTER a canonical entity has already been created, THEN
// retry the SAME Capture, and assert exact counts -- N+1, never N+2. A
// uniqueness constraint alone (test F below) is not sufficient evidence
// per the audit's own instruction; these prove the actual retry path.

test("boundary A (crash after Client, before Project): retry creates exactly one Client, not two", () => {
  const db = createFixtureDatabase();
  const id = insertCapture(db, { counterparty_label: "Moritz-Alexander Germann" });

  const first = promoteCaptureSim(db, id, { stopAfter: "client" });
  assert.equal(first.success, false);
  assert.equal(countRows(db, "clients"), 1, "the Client from the crashed attempt must exist");
  assert.equal(countRows(db, "projects"), 0);

  // Simulate real time passing so the claim is no longer live (a real
  // crash never releases it) -- backdate it past the staleness window
  // rather than sleeping in the test.
  db.prepare("UPDATE captures SET promotion_claimed_at = promotion_claimed_at - 61 WHERE id = ?").run(id);

  const retry = promoteCaptureSim(db, id);
  assert.equal(retry.success, true);
  assert.equal(countRows(db, "clients"), 1, "retry must reuse the already-created Client, not duplicate it");
  assert.equal(countRows(db, "projects"), 1);
  assert.equal(retry.clientId, first.clientId);
});

test("boundary B (crash after Project, before Video): retry creates exactly one Client and one Project", () => {
  const db = createFixtureDatabase();
  const id = insertCapture(db, { counterparty_label: "Moritz-Alexander Germann", started_at: 1000, ended_at: 1900 });

  const first = promoteCaptureSim(db, id, { stopAfter: "project", createVideo: true });
  assert.equal(first.success, false);
  assert.equal(countRows(db, "clients"), 1);
  assert.equal(countRows(db, "projects"), 1);
  assert.equal(countRows(db, "video_logs"), 0);

  db.prepare("UPDATE captures SET promotion_claimed_at = promotion_claimed_at - 61 WHERE id = ?").run(id);
  const retry = promoteCaptureSim(db, id, { createVideo: true });
  assert.equal(retry.success, true);
  assert.equal(countRows(db, "clients"), 1);
  assert.equal(countRows(db, "projects"), 1);
  assert.equal(countRows(db, "video_logs"), 1);
  assert.equal(retry.projectId, first.projectId);
});

// Work Session logging is intentionally non-fatal/best-effort (matching
// the pre-existing design, unchanged from Wave 2: "A failure here is not
// fatal to promotion... we do not fabricate a work session"), unlike
// Client/Project/Video, which are the required structural steps.
// isPromotionScopeComplete therefore deliberately does NOT require
// promotedWorkSessionId to consider a video-requesting promotion
// "complete" -- an earlier draft of this test asserted the opposite and
// was itself wrong (caught while writing this release gate): requiring
// a retry to keep re-attempting logManualWorkSession risks actually
// logging the captured minutes twice if an earlier attempt's write
// silently succeeded but its response was lost, which is exactly the
// kind of Finance-adjacent double-count this whole audit exists to
// prevent. A crash at this exact boundary is a rare, accepted gap: the
// video exists with zero tracked time, discoverable and fixable
// normally from Productivity, not a silently duplicated fact.
test("boundary C (crash after Video, before Work Session): retry does not duplicate the Video and does not retry Work Session logging", () => {
  const db = createFixtureDatabase();
  const id = insertCapture(db, { counterparty_label: "Moritz-Alexander Germann", started_at: 1000, ended_at: 1900 });

  const first = promoteCaptureSim(db, id, { stopAfter: "video", createVideo: true });
  assert.equal(first.success, false);
  assert.equal(countRows(db, "video_logs"), 1);
  assert.equal(countRows(db, "work_sessions"), 0);

  db.prepare("UPDATE captures SET promotion_claimed_at = promotion_claimed_at - 61 WHERE id = ?").run(id);
  const retry = promoteCaptureSim(db, id, { createVideo: true });
  assert.equal(retry.success, true);
  assert.equal(retry.alreadyPromoted, true, "video done + client/project done is already scope-complete");
  assert.equal(countRows(db, "clients"), 1);
  assert.equal(countRows(db, "projects"), 1);
  assert.equal(countRows(db, "video_logs"), 1, "retry must reuse the already-created Video, not duplicate it");
  assert.equal(countRows(db, "work_sessions"), 0, "an unattempted Work Session is an accepted gap, never silently retried");
  assert.equal(retry.videoId, first.videoId);
});

test("boundary D/E (crash after full linkage): retry is a pure no-op idempotent read", () => {
  const db = createFixtureDatabase();
  const id = insertCapture(db, { counterparty_label: "Moritz-Alexander Germann" });
  const first = promoteCaptureSim(db, id);
  assert.equal(first.success, true);
  assert.equal(countRows(db, "clients"), 1);
  assert.equal(countRows(db, "projects"), 1);

  // No claim to steal here at all -- promoted_client_id/project_id are
  // both already set, so the top-of-function idempotent check returns
  // before the claim UPDATE is even attempted (see promoteCaptureSim).
  const retry = promoteCaptureSim(db, id);
  assert.equal(retry.success, true);
  assert.equal(retry.alreadyPromoted, true);
  assert.equal(countRows(db, "clients"), 1, "no duplicate Client from a retry after full completion");
  assert.equal(countRows(db, "projects"), 1, "no duplicate Project from a retry after full completion");
});

// ─── Wave 2.1: concurrency ──────────────────────────────────────────────────
//
// Two "simultaneous" promotion requests for the same Capture: the atomic
// conditional UPDATE (the claim) can only ever be won by one caller, even
// though node:sqlite's synchronous API can't model true thread-level
// interleaving -- SQLite serializes the two UPDATE statements regardless
// of call order, which is exactly the property the real D1/Workers
// runtime also guarantees for a single UPDATE statement. This proves the
// SQL pattern itself is race-free, which is what actually matters.

test("concurrent claim attempts: only one request can win the atomic claim for the same Capture", () => {
  const db = createFixtureDatabase();
  const id = insertCapture(db, { counterparty_label: "Moritz-Alexander Germann" });

  // Both "requests" read the Capture before either has written anything --
  // the exact race window the audit named as the concurrency risk.
  const readByA = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  const readByB = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  assert.equal(readByA.promoted_client_id, null);
  assert.equal(readByB.promoted_client_id, null);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const claimA = db.prepare(`
    UPDATE captures SET promotion_claimed_at = ?
    WHERE id = ? AND promoted_project_id IS NULL AND (promotion_claimed_at IS NULL OR promotion_claimed_at < ?)
  `).run(nowSeconds, id, nowSeconds - 60);
  const claimB = db.prepare(`
    UPDATE captures SET promotion_claimed_at = ?
    WHERE id = ? AND promoted_project_id IS NULL AND (promotion_claimed_at IS NULL OR promotion_claimed_at < ?)
  `).run(nowSeconds, id, nowSeconds - 60);

  assert.equal(claimA.changes, 1, "the first claim must win");
  assert.equal(claimB.changes, 0, "the second claim must be rejected while the first is live");
});

test("concurrent promoteCaptureSim calls cannot both create a Client for the same Capture", () => {
  const db = createFixtureDatabase();
  const id = insertCapture(db, { counterparty_label: "Moritz-Alexander Germann" });

  // node:sqlite's API is synchronous, so two full promoteCaptureSim(...)
  // calls can never genuinely interleave -- the first always finishes
  // (and releases/consumes its claim) before the second starts, which
  // would make this test trivially pass for the wrong reason. To model
  // "request A is still running" honestly, stop A mid-flight (its claim
  // stays live, un-backdated -- exactly what a real in-flight request
  // looks like from request B's point of view) and immediately attempt B
  // before A ever completes or crashes.
  const resultA = promoteCaptureSim(db, id, { stopAfter: "client" });
  assert.equal(resultA.success, false, "A is mid-flight, not finished");
  assert.equal(countRows(db, "clients"), 1, "A already created its Client");

  const resultB = promoteCaptureSim(db, id);
  assert.equal(resultB.success, false, "B must be rejected while A's claim is still live");
  assert.match(resultB.error, /already in progress/);
  assert.equal(countRows(db, "clients"), 1, "B must not have created a second Client");
  assert.equal(countRows(db, "projects"), 0, "B must not have proceeded to create a Project either");
});

// ─── F. Promotion idempotency (schema-level guarantee) ─────────────────────

test("captures_promoted_work_session_unique prevents two captures linking to the same Work Session", () => {
  const db = createFixtureDatabase();
  const videoId = Number(db.prepare("INSERT INTO video_logs (title) VALUES (?)").run("Sample video").lastInsertRowid);
  const workSessionId = Number(
    db.prepare("INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, ?, ?)")
      .run(videoId, 1000, 2000).lastInsertRowid,
  );
  const captureA = insertCapture(db, { counterparty_label: "Moritz" });
  const captureB = insertCapture(db, { counterparty_label: "Moritz (duplicate attempt)" });

  db.prepare("UPDATE captures SET promoted_work_session_id = ? WHERE id = ?").run(workSessionId, captureA);
  assert.throws(
    () => db.prepare("UPDATE captures SET promoted_work_session_id = ? WHERE id = ?").run(workSessionId, captureB),
    /UNIQUE constraint failed/,
  );
  db.close();
});

// ─── started_at/ended_at CHECK ─────────────────────────────────────────────

test("the ended_at >= started_at CHECK rejects an inverted interval", () => {
  const db = createFixtureDatabase();
  assert.throws(
    () => insertCapture(db, { started_at: 2000, ended_at: 1000 }),
    /CHECK constraint failed/,
  );
  db.close();
});
