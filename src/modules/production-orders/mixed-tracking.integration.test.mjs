import assert from "node:assert/strict";
import test from "node:test";
import { buildMigratedDb, seedClientAndProject, ingestOrderRowSql, ingestItemsSql } from "./test-helpers.mjs";
import { computeProductionOrderTimeBreakdown } from "./core.ts";

// RMEDIA LET'S COOK Wave 1 — Mixed Tracking fixture (corrected/locked
// semantics, brief §3). Covers both the non-overlapping and the
// overlapping-interval cases against real work_sessions rows attached to
// a real container + deliverable set, and asserts no fake combined total
// and no automatic reattribution is ever produced.

function loadSessions(db, videoIds) {
  const placeholders = videoIds.map(() => "?").join(",");
  return db
    .prepare(`SELECT video_id as videoId, started_at as startedAt, ended_at as endedAt FROM work_sessions WHERE video_id IN (${placeholders})`)
    .all(...videoIds)
    .map((r) => ({ videoId: r.videoId, startedAt: new Date(r.startedAt * 1000), endedAt: r.endedAt ? new Date(r.endedAt * 1000) : null }));
}

test("Mixed tracking: non-overlapping container and item sessions stay separate, never summed into one total", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", ingestKey: "mt-1" });
  const { containerVideoId, itemIds } = ingestItemsSql(db, {
    orderId: order.id, clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", itemTitles: ["Reel 1", "Reel 2"],
  });

  // Container: 09:00-10:00 (1h, pre-flight review time on the batch).
  db.prepare(`INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, 32400, 36000)`).run(containerVideoId);
  // Reel 1: 11:00-11:30 (30m). Reel 2: 13:00-14:00 (1h). Neither overlaps
  // the container or each other.
  db.prepare(`INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, 39600, 41400)`).run(itemIds[0]);
  db.prepare(`INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, 46800, 50400)`).run(itemIds[1]);

  const sessions = loadSessions(db, [containerVideoId, ...itemIds]);
  const breakdown = computeProductionOrderTimeBreakdown({ containerVideoId, sessions });

  assert.equal(breakdown.containerSeconds, 3600);
  assert.equal(breakdown.itemSecondsTotal, 5400); // 1800 + 3600
  assert.equal(
    "totalSeconds" in breakdown,
    false,
    "no field ever combines container + item time into one number",
  );
});

test("Mixed tracking: sessions on the container and on a deliverable can genuinely overlap in wall-clock time -- both count in full, not merged or rejected", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", ingestKey: "mt-2" });
  const { containerVideoId, itemIds } = ingestItemsSql(db, {
    orderId: order.id, clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", itemTitles: ["Reel 1"],
  });

  // Container session 09:00-10:00 and Reel 1 session 09:30-10:30 overlap
  // by 30 minutes -- e.g. the operator started a batch-level Sensor run,
  // then separately opened the specific deliverable's own timer while
  // still mid-review. This is real, legitimate, simultaneous work; the
  // brief is explicit this must never be assumed impossible.
  db.prepare(`INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, 32400, 36000)`).run(containerVideoId);
  db.prepare(`INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, 34200, 37800)`).run(itemIds[0]);

  const sessions = loadSessions(db, [containerVideoId, ...itemIds]);
  const breakdown = computeProductionOrderTimeBreakdown({ containerVideoId, sessions });

  // Both intervals count in full -- no interval-union/dedup logic drops
  // or shrinks either one just because they overlap a different video_id.
  assert.equal(breakdown.containerSeconds, 3600, "container's own 1h counted in full");
  assert.equal(breakdown.items.find((r) => r.videoId === itemIds[0]).seconds, 3600, "item's own 1h counted in full, unreduced by the overlap");
  assert.equal(breakdown.itemSecondsTotal, 3600);
});

test("Mixed tracking: multiple deliverables with concurrent sessions are each attributed to their own video_id, never reattributed to another", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const order = ingestOrderRowSql(db, { clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", ingestKey: "mt-3" });
  const { itemIds } = ingestItemsSql(db, {
    orderId: order.id, clientId: 1, projectId: 1, label: "Batch 1", receivedAt: "2026-08-24", itemTitles: ["Reel 1", "Reel 2", "Reel 3"],
  });

  // Three deliverables worked at genuinely overlapping times (e.g. two
  // editors on the same order simultaneously).
  db.prepare(`INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, 0, 1800)`).run(itemIds[0]); // 30m
  db.prepare(`INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, 900, 2700)`).run(itemIds[1]); // 30m, overlaps Reel 1
  db.prepare(`INSERT INTO work_sessions (video_id, started_at, ended_at) VALUES (?, 1200, 1500)`).run(itemIds[2]); // 5m, inside both

  const sessions = loadSessions(db, itemIds);
  const breakdown = computeProductionOrderTimeBreakdown({ containerVideoId: null, sessions });

  const byVideo = Object.fromEntries(breakdown.items.map((r) => [r.videoId, r.seconds]));
  assert.equal(byVideo[itemIds[0]], 1800, "Reel 1 keeps exactly its own logged time");
  assert.equal(byVideo[itemIds[1]], 1800, "Reel 2 keeps exactly its own logged time");
  assert.equal(byVideo[itemIds[2]], 300, "Reel 3 keeps exactly its own logged time");
  assert.equal(breakdown.itemSecondsTotal, 3900, "each video_id's time is additive across items -- no cross-item time is stolen or shared");
});
