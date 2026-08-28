import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Lunch Reality Patch P1 §7 -- client-settable "priority now" video, one
// per project, isolated per client. setVideoPriorityAsClient
// (modules/productivity/actions.ts) is a "use server" action needing a
// Next.js/Cloudflare request context this test runner doesn't have, so
// (same convention as fx-personal-ledger.integration.test.mjs) this file
// mirrors its exact SQL/logic against the real migration chain instead of
// invoking the action directly.

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

function seedClientsProjectsVideos(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES
      (1, 'Client A', 'active'),
      (2, 'Client B', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES
      (1, 1, 'Client A Project 1', 'active'),
      (2, 1, 'Client A Project 2', 'active'),
      (3, 2, 'Client B Project', 'active');
    INSERT INTO video_logs (id, date, title, client_id, project_id) VALUES
      (1, '2026-08-20', 'A1 Video 1', 1, 1),
      (2, '2026-08-21', 'A1 Video 2', 1, 1),
      (3, '2026-08-20', 'A2 Video 1', 1, 2),
      (4, '2026-08-20', 'B Video 1', 2, 3);
  `);
}

// Mirrors setVideoPriorityAsClient's ownership check verbatim: the video
// must exist AND belong to the authenticated client, otherwise the
// identical "not found" response applies -- no cross-client mutation is
// ever reachable through this helper, exactly like the real action.
function findOwnedVideo(db, videoId, authenticatedClientId) {
  const row = db
    .prepare("SELECT id, client_id AS clientId, project_id AS projectId FROM video_logs WHERE id = ?")
    .get(videoId);
  if (!row || row.clientId !== authenticatedClientId) return null;
  return row;
}

// Mirrors setVideoPriorityAsClient's atomic D1 batch. DatabaseSync does not
// expose D1's batch API, so BEGIN IMMEDIATE/COMMIT supplies the equivalent
// serialized transaction for the same two statements.
function setPriority(db, videoId, authenticatedClientId, makePriority) {
  const video = findOwnedVideo(db, videoId, authenticatedClientId);
  if (!video) return { success: false, error: "Video not found." };
  if (makePriority && video.projectId === null) {
    return { success: false, error: "This video isn't part of a project yet." };
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    if (makePriority && video.projectId !== null) {
      db.prepare(
        "UPDATE video_logs SET is_priority = 0 WHERE project_id = ? AND id != ? AND is_priority = 1",
      ).run(video.projectId, videoId);
    }
    db.prepare("UPDATE video_logs SET is_priority = ? WHERE id = ?").run(makePriority ? 1 : 0, videoId);
    db.exec("COMMIT");
    return { success: true };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function priorityOf(db, videoId) {
  return Boolean(db.prepare("SELECT is_priority AS isPriority FROM video_logs WHERE id = ?").get(videoId).isPriority);
}

test("setting priority on a video clears any other priority video in the same project", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  const first = setPriority(db, 1, 1, true);
  assert.equal(first.success, true);
  assert.equal(priorityOf(db, 1), true);

  const second = setPriority(db, 2, 1, true);
  assert.equal(second.success, true);
  assert.equal(priorityOf(db, 1), false); // cleared
  assert.equal(priorityOf(db, 2), true);
});

test("competing serialized priority batches still leave exactly one priority in the project", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  // D1 serializes atomic batches; either request may win, but the second
  // committed batch must clear the first request's choice.
  setPriority(db, 1, 1, true);
  setPriority(db, 2, 1, true);

  const priorities = db
    .prepare("SELECT id FROM video_logs WHERE project_id = 1 AND is_priority = 1 ORDER BY id")
    .all()
    .map((row) => ({ ...row }));
  assert.deepEqual(priorities, [{ id: 2 }]);
});

test("priority in one project never touches a different project, even for the same client", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  setPriority(db, 1, 1, true); // Project 1
  setPriority(db, 3, 1, true); // Project 2 -- same client, different project

  assert.equal(priorityOf(db, 1), true); // untouched
  assert.equal(priorityOf(db, 3), true);
});

test("isolation: client A cannot set priority on client B's video -- identical not-found error", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  const result = setPriority(db, 4, 1, true); // video 4 belongs to client 2
  assert.equal(result.success, false);
  assert.equal(result.error, "Video not found.");
  assert.equal(priorityOf(db, 4), false); // untouched
});

test("isolation: the not-found error is identical whether the video belongs to another client or doesn't exist at all", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  const wrongClient = setPriority(db, 4, 1, true);
  const nonexistent = setPriority(db, 999, 1, true);
  assert.equal(wrongClient.error, nonexistent.error);
});

test("marking priority on a video with no project is rejected, not silently accepted", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Client A', 'active');
    INSERT INTO video_logs (id, date, title, client_id, project_id) VALUES (1, '2026-08-20', 'Orphan video', 1, NULL);
  `);
  const result = setPriority(db, 1, 1, true);
  assert.equal(result.success, false);
  assert.match(result.error, /project/i);
});

test("clearing priority never requires a project and never touches sibling videos", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);
  setPriority(db, 1, 1, true);
  const cleared = setPriority(db, 1, 1, false);
  assert.equal(cleared.success, true);
  assert.equal(priorityOf(db, 1), false);
  assert.equal(priorityOf(db, 2), false); // was never set, still isn't
});
