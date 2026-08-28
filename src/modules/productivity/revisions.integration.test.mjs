import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pre-Operation Reality Hardening §7 — revisions as historical facts.
// changeRevisionCount (modules/productivity/actions.ts) is a "use server"
// action needing a Next.js/Cloudflare request context this test runner
// doesn't have, so (same convention as video-priority.integration.test.mjs)
// this file mirrors its exact SQL/logic against the real migration chain
// instead of invoking the action directly.

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
      (1, 'Client A', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES
      (1, 1, 'Client A Project 1', 'active');
    INSERT INTO video_logs (id, date, title, client_id, project_id, revisions_count) VALUES
      (1, '2026-08-20', 'Video One', 1, 1, 0),
      (2, '2026-08-20', 'Video Two', 1, 1, 0),
      (3, '2026-08-20', 'Legacy Video (count with no rows)', 1, 1, 3);
  `);
}

// Mirrors changeRevisionCount's atomic D1 batch. DatabaseSync does not
// expose D1's batch API, so BEGIN IMMEDIATE/COMMIT supplies the equivalent
// serialized transaction for the same statements.
function changeRevisionCount(db, videoId, delta, { actor = "admin", note = null } = {}) {
  const current = db
    .prepare("SELECT id, revisions_count AS revisionsCount FROM video_logs WHERE id = ?")
    .get(videoId);
  if (!current) return { success: false, error: "Video not found." };
  if (delta === -1 && current.revisionsCount === 0) {
    return { success: false, error: "This video has no revision to remove." };
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    if (delta === 1) {
      db.prepare(
        "INSERT INTO revisions (video_id, actor, note) VALUES (?, ?, ?)",
      ).run(videoId, actor, note);
    } else {
      db.prepare(
        `DELETE FROM revisions WHERE id = (
           SELECT id FROM revisions WHERE video_id = ? ORDER BY created_at DESC, id DESC LIMIT 1
         )`,
      ).run(videoId);
    }
    db.prepare(
      "UPDATE video_logs SET revisions_count = MAX(revisions_count + ?, 0) WHERE id = ?",
    ).run(delta, videoId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const updated = db
    .prepare("SELECT revisions_count AS revisionsCount FROM video_logs WHERE id = ?")
    .get(videoId);
  return { success: true, revisionsCount: updated.revisionsCount };
}

function revisionsFor(db, videoId) {
  return db
    .prepare("SELECT id, video_id AS videoId, note, actor, created_at AS createdAt FROM revisions WHERE video_id = ? ORDER BY id")
    .all(videoId);
}

test("adding a revision creates a real revisions event row", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  const result = changeRevisionCount(db, 1, 1);
  assert.equal(result.success, true);

  const rows = revisionsFor(db, 1);
  assert.equal(rows.length, 1);
});

test("the revision event belongs to the correct video, not a sibling", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  changeRevisionCount(db, 1, 1);

  assert.equal(revisionsFor(db, 1).length, 1);
  assert.equal(revisionsFor(db, 2).length, 0);
});

test("actor is preserved on the event", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  changeRevisionCount(db, 1, 1, { actor: "admin" });
  assert.equal(revisionsFor(db, 1)[0].actor, "admin");
});

test("note is preserved on the event when provided", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  changeRevisionCount(db, 1, 1, { note: "client asked for a tighter cut" });
  assert.equal(revisionsFor(db, 1)[0].note, "client asked for a tighter cut");
});

test("a revision with no note is stored as null, not an empty string", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  changeRevisionCount(db, 1, 1);
  assert.equal(revisionsFor(db, 1)[0].note, null);
});

test("timestamp is preserved (not null) on the event", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  changeRevisionCount(db, 1, 1);
  assert.ok(revisionsFor(db, 1)[0].createdAt !== null);
});

test("derived cache (revisionsCount) increments in lockstep with the event count", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  changeRevisionCount(db, 1, 1);
  changeRevisionCount(db, 1, 1);
  const third = changeRevisionCount(db, 1, 1);

  assert.equal(third.revisionsCount, 3);
  assert.equal(revisionsFor(db, 1).length, 3);
});

test("undo (-1) removes only the most recently recorded revision for that video", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  changeRevisionCount(db, 1, 1, { note: "first" });
  changeRevisionCount(db, 1, 1, { note: "second" });
  changeRevisionCount(db, 1, 1, { note: "third" });

  const undone = changeRevisionCount(db, 1, -1);
  assert.equal(undone.success, true);
  assert.equal(undone.revisionsCount, 2);

  const remaining = revisionsFor(db, 1).map((r) => r.note);
  assert.deepEqual(remaining, ["first", "second"]);
});

test("undo on a legacy video (cache > 0, zero revisions rows) only decrements the cache, no crash", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  const result = changeRevisionCount(db, 3, -1);
  assert.equal(result.success, true);
  assert.equal(result.revisionsCount, 2);
  assert.equal(revisionsFor(db, 3).length, 0);
});

test("undo at zero is refused, same as before this round", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  const result = changeRevisionCount(db, 1, -1);
  assert.equal(result.success, false);
});

test("deletion/correction on one video's history never touches another video's rows", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  changeRevisionCount(db, 1, 1);
  changeRevisionCount(db, 2, 1);
  changeRevisionCount(db, 2, 1);

  changeRevisionCount(db, 2, -1);

  assert.equal(revisionsFor(db, 1).length, 1, "video 1's history must be untouched by video 2's undo");
  assert.equal(revisionsFor(db, 2).length, 1);
});

test("multiple revisions on the same video remain independently auditable rows", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  changeRevisionCount(db, 1, 1, { note: "round 1" });
  changeRevisionCount(db, 1, 1, { note: "round 2" });

  const rows = revisionsFor(db, 1);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.deepEqual(rows.map((r) => r.note), ["round 1", "round 2"]);
});

test("deleting a video cascades its revisions rows (ON DELETE CASCADE), not orphaned", () => {
  const db = buildMigratedDb();
  seedClientsProjectsVideos(db);

  changeRevisionCount(db, 1, 1);
  assert.equal(revisionsFor(db, 1).length, 1);

  db.exec("DELETE FROM video_logs WHERE id = 1");
  const orphans = db.prepare("SELECT COUNT(*) AS n FROM revisions WHERE video_id = 1").get();
  assert.equal(orphans.n, 0);
});
