import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDeliveryUrl } from "./core.ts";
import { isVideoStatus } from "./config.ts";

// Sprint 3 P2 — two real bugs found in updateVideoLogsBulk
// (src/modules/productivity/actions.ts) during the completion-pass sweep,
// both fixed in that file. This mirrors the fixed patch-resolution logic
// exactly (tri-state clear/value/absent, same as
// bulk-ingest-brief-c.integration.test.mjs already does for the rest of
// this action), against the real migration chain -- "use server" actions
// need a Next.js/Cloudflare request context this test runner doesn't
// have, so this follows the repo's existing raw-SQL convention.
//
// Bug 1: an enabled-but-blank deliveryUrl/reviewUrl/batchLabel field
// (checkbox on, text box empty, "Clear" NOT checked) was silently nulling
// the field for every selected video -- directly contradicting this same
// file's own documented contract ("a blank bulk-edit field must mean
// 'leave unchanged', not 'erase'").
// Bug 2: bulk status change to READY_FOR_REVIEW bypassed the invariant
// enforced everywhere else in the app (creation, single-video transition)
// that a Video needs a reviewUrl before entering that status.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
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

function seedVideos(db, rows) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Project', 'active');
  `);
  const insert = db.prepare(
    `INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivery_url, review_url, batch_label)
     VALUES (?, '2026-08-01', ?, 1, 1, ?, ?, ?, ?)`,
  );
  for (const row of rows) {
    insert.run(row.id, row.title, row.status ?? "PLANNED", row.deliveryUrl ?? null, row.reviewUrl ?? null, row.batchLabel ?? null);
  }
}

// Mirrors updateVideoLogsBulk's fixed patch-resolution logic exactly.
function updateVideoLogsBulkSql(db, videoIds, patch) {
  const set = {};

  if (patch.status) {
    if (!isVideoStatus(patch.status.value)) return { success: false, error: "Choose a valid video status." };
    set.status = patch.status.value;
  }
  if (patch.deliveryUrl) {
    if ("clear" in patch.deliveryUrl) {
      set.deliveryUrl = null;
    } else if (!patch.deliveryUrl.value.trim()) {
      return { success: false, error: "Enter a delivery URL, or choose Clear to remove it." };
    } else {
      const parsed = validateDeliveryUrl(patch.deliveryUrl.value);
      if (!parsed.success) return parsed;
      set.deliveryUrl = parsed.value;
    }
  }
  if (patch.reviewUrl) {
    if ("clear" in patch.reviewUrl) {
      set.reviewUrl = null;
    } else if (!patch.reviewUrl.value.trim()) {
      return { success: false, error: "Enter a review URL, or choose Clear to remove it." };
    } else {
      const parsed = validateDeliveryUrl(patch.reviewUrl.value);
      if (!parsed.success) return parsed;
      set.reviewUrl = parsed.value;
    }
  }
  if (patch.batchLabel) {
    if ("clear" in patch.batchLabel) {
      set.batchLabel = null;
    } else if (!patch.batchLabel.value.trim()) {
      return { success: false, error: "Enter a batch label, or choose Clear to remove it." };
    } else {
      set.batchLabel = patch.batchLabel.value.trim().slice(0, 160);
    }
  }

  if (Object.keys(set).length === 0) return { success: false, error: "Change at least one field before saving." };

  const existing = db
    .prepare(`SELECT id, review_url AS reviewUrl FROM video_logs WHERE id IN (${videoIds.map(() => "?").join(",")})`)
    .all(...videoIds);
  if (existing.length === 0) return { success: false, error: "No matching videos found." };

  if (set.status === "READY_FOR_REVIEW") {
    const patchReviewUrl = patch.reviewUrl && !("clear" in patch.reviewUrl) ? set.reviewUrl : null;
    const missingReviewUrl = patchReviewUrl ? [] : existing.filter((row) => !row.reviewUrl);
    if (patch.reviewUrl && "clear" in patch.reviewUrl) {
      return { success: false, error: "Cannot set status to Ready for review while also clearing the review URL." };
    }
    if (missingReviewUrl.length > 0) {
      return { success: false, error: `${missingReviewUrl.length} of the selected videos have no review URL yet.` };
    }
  }

  const assignments = Object.keys(set).map((col) => {
    const column = { status: "status", deliveryUrl: "delivery_url", reviewUrl: "review_url", batchLabel: "batch_label" }[col];
    return `${column} = ?`;
  });
  db.prepare(
    `UPDATE video_logs SET ${assignments.join(", ")} WHERE id IN (${videoIds.map(() => "?").join(",")})`,
  ).run(...Object.values(set), ...videoIds);

  return { success: true, updatedCount: existing.length };
}

test("Bug 1: an enabled-but-blank deliveryUrl field is rejected, never silently nulled", () => {
  const db = buildMigratedDb();
  seedVideos(db, [{ id: 1, title: "A", deliveryUrl: "https://a.example.com" }]);

  const result = updateVideoLogsBulkSql(db, [1], { deliveryUrl: { value: "   " } });
  assert.equal(result.success, false);

  const row = db.prepare("SELECT delivery_url FROM video_logs WHERE id = 1").get();
  assert.equal(row.delivery_url, "https://a.example.com", "existing delivery URL must survive a rejected blank patch");
});

test("Bug 1: an enabled-but-blank reviewUrl and batchLabel are also rejected, never silently nulled", () => {
  const db = buildMigratedDb();
  seedVideos(db, [{ id: 1, title: "A", reviewUrl: "https://review.example.com", batchLabel: "Batch 1" }]);

  const reviewResult = updateVideoLogsBulkSql(db, [1], { reviewUrl: { value: "" } });
  assert.equal(reviewResult.success, false);
  const labelResult = updateVideoLogsBulkSql(db, [1], { batchLabel: { value: "" } });
  assert.equal(labelResult.success, false);

  const row = db.prepare("SELECT review_url, batch_label FROM video_logs WHERE id = 1").get();
  assert.equal(row.review_url, "https://review.example.com");
  assert.equal(row.batch_label, "Batch 1");
});

test("Bug 1: explicit Clear still nulls the field (the fix does not disable Clear)", () => {
  const db = buildMigratedDb();
  seedVideos(db, [{ id: 1, title: "A", deliveryUrl: "https://a.example.com" }]);

  const result = updateVideoLogsBulkSql(db, [1], { deliveryUrl: { clear: true } });
  assert.equal(result.success, true);

  const row = db.prepare("SELECT delivery_url FROM video_logs WHERE id = 1").get();
  assert.equal(row.delivery_url, null);
});

test("Bug 1: a real, non-blank value still updates normally", () => {
  const db = buildMigratedDb();
  seedVideos(db, [{ id: 1, title: "A", deliveryUrl: "https://old.example.com" }]);

  const result = updateVideoLogsBulkSql(db, [1], { deliveryUrl: { value: "https://new.example.com" } });
  assert.equal(result.success, true);

  const row = db.prepare("SELECT delivery_url FROM video_logs WHERE id = 1").get();
  assert.equal(row.delivery_url, "https://new.example.com/");
});

test("Bug 2: bulk status change to READY_FOR_REVIEW is rejected for a video with no review URL", () => {
  const db = buildMigratedDb();
  seedVideos(db, [{ id: 1, title: "A", reviewUrl: null }]);

  const result = updateVideoLogsBulkSql(db, [1], { status: { value: "READY_FOR_REVIEW" } });
  assert.equal(result.success, false);

  const row = db.prepare("SELECT status FROM video_logs WHERE id = 1").get();
  assert.equal(row.status, "PLANNED", "status must not change when the invariant is violated");
});

test("Bug 2: rejected if even one of several selected videos lacks a review URL", () => {
  const db = buildMigratedDb();
  seedVideos(db, [
    { id: 1, title: "A", reviewUrl: "https://review.example.com" },
    { id: 2, title: "B", reviewUrl: null },
  ]);

  const result = updateVideoLogsBulkSql(db, [1, 2], { status: { value: "READY_FOR_REVIEW" } });
  assert.equal(result.success, false);

  const rows = db.prepare("SELECT id, status FROM video_logs ORDER BY id").all();
  assert.equal(rows[0].status, "PLANNED");
  assert.equal(rows[1].status, "PLANNED");
});

test("Bug 2: allowed when every selected video already has a review URL", () => {
  const db = buildMigratedDb();
  seedVideos(db, [
    { id: 1, title: "A", reviewUrl: "https://review-a.example.com" },
    { id: 2, title: "B", reviewUrl: "https://review-b.example.com" },
  ]);

  const result = updateVideoLogsBulkSql(db, [1, 2], { status: { value: "READY_FOR_REVIEW" } });
  assert.equal(result.success, true);

  const rows = db.prepare("SELECT status FROM video_logs ORDER BY id").all();
  assert.equal(rows[0].status, "READY_FOR_REVIEW");
  assert.equal(rows[1].status, "READY_FOR_REVIEW");
});

test("Bug 2: allowed when the same patch also sets a valid reviewUrl for every selected video", () => {
  const db = buildMigratedDb();
  seedVideos(db, [{ id: 1, title: "A", reviewUrl: null }]);

  const result = updateVideoLogsBulkSql(db, [1], {
    status: { value: "READY_FOR_REVIEW" },
    reviewUrl: { value: "https://review.example.com" },
  });
  assert.equal(result.success, true);

  const row = db.prepare("SELECT status, review_url FROM video_logs WHERE id = 1").get();
  assert.equal(row.status, "READY_FOR_REVIEW");
  assert.equal(row.review_url, "https://review.example.com/");
});

test("Bug 2: rejected when the patch sets READY_FOR_REVIEW while also clearing the review URL", () => {
  const db = buildMigratedDb();
  seedVideos(db, [{ id: 1, title: "A", reviewUrl: "https://review.example.com" }]);

  const result = updateVideoLogsBulkSql(db, [1], {
    status: { value: "READY_FOR_REVIEW" },
    reviewUrl: { clear: true },
  });
  assert.equal(result.success, false);

  const row = db.prepare("SELECT status FROM video_logs WHERE id = 1").get();
  assert.equal(row.status, "PLANNED");
});

test("a status change to a status other than READY_FOR_REVIEW never triggers the reviewUrl check", () => {
  const db = buildMigratedDb();
  seedVideos(db, [{ id: 1, title: "A", reviewUrl: null }]);

  const result = updateVideoLogsBulkSql(db, [1], { status: { value: "DONE" } });
  assert.equal(result.success, true);

  const row = db.prepare("SELECT status FROM video_logs WHERE id = 1").get();
  assert.equal(row.status, "DONE");
});
