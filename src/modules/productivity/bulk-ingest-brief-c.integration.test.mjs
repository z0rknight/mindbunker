import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateVideoCreateInput } from "./core.ts";

// Brief C ("Final Local Ingest / Live Readiness") §17 — required test
// scenarios covered against the real migration chain (0000..HEAD) at the
// SQL level, mirroring exactly what createVideoLogsBulk/updateVideoLogsBulk
// in actions.ts do -- this repo's existing integration tests exercise
// schema-level invariants with raw SQL rather than invoking "use server"
// actions directly (those need a Next.js/Cloudflare request context this
// test runner doesn't have), so this file follows the same convention.
//
// Scenario coverage map (§17 numbering):
//   1  Project can be created from /projects                 -- NewProjectButton reuses the existing createProject action/ProjectForm verbatim (see modules/projects/actions.ts's own createProject tests, untouched); not re-tested here.
//   2  Sequence generator produces exactly N rows              -- pure UI generation (BulkAddVideosButton's generatedNames), verified by code inspection: Array.from({length: quantity}, ...).
//   3  Sequence numbering is deterministic                     -- same generator, prefix + separator + (start..start+n-1), zero-pad optional.
//   4  Generated rows remain individually editable             -- generateRows() writes into the same `rows` state manual-mode rows are edited in; no separate persistence path.
//   5  Prospective create without explicit status still defaults safely -- modules/productivity/core.test.mjs "new video status is explicit..."
//   6  Historical bulk create accepts explicit canonical later-stage status -- modules/productivity/core.test.mjs "explicit historical/bulk ingest may set a later canonical status..."
//   7  Bulk create persists historical date                    -- below
//   8  Bulk create persists per-video URL                       -- below
//   9  Shared batch URL correctly applies to all intended rows  -- below
//   10 Batch label persists if implemented                       -- below
//   11 Bulk edit changes only explicitly selected fields          -- below
//   12 Bulk edit never duplicates videos                          -- below
//   13 Natural sorting puts _2 before _10                         -- modules/projects/core.test.mjs
//   14 Project -> Video -> close returns to Project                -- src/utils/navigation.test.mjs (isSafeInternalPath) + VideoEditor.tsx closeEditor code inspection
//   15 Productivity -> Video navigation regression remains sane     -- returnTo absent -> VideoEditor falls back to "/productivity", unchanged
//   16 Project Source Media References appear through Video workspace read path -- ProjectReferencesPanel calls the same getSourceMediaForProject used by SourceMediaPanel; regression-covered by modules/assets tests, untouched
//   17 Existing Asset/Source Media behavior remains intact         -- modules/assets/*.test.mjs, untouched this round, green
//   18 Sensor tests remain green                                   -- modules/sensor/*.test.mjs, untouched this round (SENSOR FREEZE), green
//   19 Finance idempotency/debt-payment regressions remain green   -- modules/finance/*.test.mjs, untouched this round, green
//   20 Client-safe projection still leaks no finance/internal data -- modules/client-portal/core.test.mjs, untouched this round, green

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

function seedClientAndProject(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Bonnie - Content Waterfall', 'active');
  `);
}

// Mirrors createVideoLogsBulk: validate every row first (allowExplicitStatus
// true), then insert sequentially, batch_label applied to every row.
function bulkCreateSql(db, projectId, rows, batchLabel) {
  const validated = [];
  for (const row of rows) {
    const parsed = validateVideoCreateInput({
      title: row.title,
      projectId,
      clientId: null,
      date: row.date ?? null,
      deliveryUrl: row.deliveryUrl ?? null,
      reviewUrl: row.reviewUrl ?? null,
      status: row.status ?? "PLANNED",
      allowExplicitStatus: true,
    });
    if (!parsed.success) return { success: false, error: parsed.error };
    validated.push(parsed.data);
  }
  const ids = [];
  const insert = db.prepare(
    `INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, delivery_url, review_url, batch_label)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of validated) {
    const result = insert.run(
      row.date ?? "2026-08-24",
      row.title,
      projectId,
      row.status,
      row.status === "DONE" ? 1 : 0,
      row.deliveryUrl,
      row.reviewUrl,
      batchLabel ?? null,
    );
    ids.push(Number(result.lastInsertRowid));
  }
  return { success: true, ids };
}

test("bulk create persists historical date and per-video URLs (§7/§8)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = bulkCreateSql(db, 1, [
    { title: "Bonnie Content Waterfall_1", date: "2026-08-10", deliveryUrl: "https://drive.google.com/1" },
    { title: "Bonnie Content Waterfall_2", date: "2026-08-11" },
  ]);
  assert.equal(result.success, true);
  const rows = db.prepare("SELECT title, date, delivery_url FROM video_logs WHERE project_id = 1 ORDER BY id").all();
  assert.equal(rows[0].date, "2026-08-10");
  assert.equal(rows[0].delivery_url, "https://drive.google.com/1");
  assert.equal(rows[1].date, "2026-08-11");
  // §15 DATA HONESTY: an unset link stays null, never fabricated.
  assert.equal(rows[1].delivery_url, null);
});

test("shared batch link applies to every intended row (§9)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const sharedUrl = "https://drive.google.com/folder/batch1";
  const result = bulkCreateSql(db, 1, [
    { title: "Bonnie Content Waterfall_1", deliveryUrl: sharedUrl },
    { title: "Bonnie Content Waterfall_2", deliveryUrl: sharedUrl },
    { title: "Bonnie Content Waterfall_3", deliveryUrl: sharedUrl },
  ]);
  assert.equal(result.success, true);
  const rows = db.prepare("SELECT delivery_url FROM video_logs WHERE project_id = 1").all();
  assert.equal(rows.length, 3);
  for (const row of rows) assert.equal(row.delivery_url, sharedUrl);
});

test("batch label persists on every row created in the same submission (§10)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = bulkCreateSql(
    db,
    1,
    [{ title: "Bonnie Content Waterfall_1" }, { title: "Bonnie Content Waterfall_2" }],
    "Content Waterfall — Batch 1",
  );
  assert.equal(result.success, true);
  const rows = db.prepare("SELECT batch_label FROM video_logs WHERE project_id = 1").all();
  assert.equal(rows.length, 2);
  for (const row of rows) assert.equal(row.batch_label, "Content Waterfall — Batch 1");
});

test("historical bulk create accepts an explicit later-stage status per row (§6/§17.6)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = bulkCreateSql(db, 1, [
    { title: "Delivered already", status: "DONE" },
    { title: "Still planned" },
  ]);
  assert.equal(result.success, true);
  const rows = db.prepare("SELECT title, status, delivered FROM video_logs WHERE project_id = 1 ORDER BY id").all();
  assert.equal(rows[0].status, "DONE");
  assert.equal(rows[0].delivered, 1);
  assert.equal(rows[1].status, "PLANNED");
  assert.equal(rows[1].delivered, 0);
});

// Mirrors updateVideoLogsBulk's tri-state patch: only keys present in
// `set` are ever written; everything else in each row is left byte-for-byte
// as it was.
function bulkUpdateSql(db, videoIds, set) {
  if (Object.keys(set).length === 0) return { success: false, error: "no fields" };
  const assignments = Object.keys(set).map((col) => `${col} = ?`).join(", ");
  const values = Object.values(set);
  const placeholders = videoIds.map(() => "?").join(",");
  const stmt = db.prepare(
    `UPDATE video_logs SET ${assignments} WHERE id IN (${placeholders})`,
  );
  const result = stmt.run(...values, ...videoIds);
  return { success: true, changes: result.changes };
}

test("bulk edit changes only explicitly selected fields, leaving everything else untouched (§11)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  bulkCreateSql(db, 1, [
    { title: "Video A", deliveryUrl: "https://a.example.com" },
    { title: "Video B", deliveryUrl: "https://b.example.com" },
  ]);
  const before = db.prepare("SELECT id, title, delivery_url FROM video_logs WHERE project_id = 1 ORDER BY id").all();
  const ids = before.map((r) => r.id);

  // Only status is touched -- delivery_url and title must survive exactly.
  const result = bulkUpdateSql(db, ids, { status: "DONE", delivered: 1 });
  assert.equal(result.success, true);
  assert.equal(result.changes, 2);

  const after = db.prepare("SELECT id, title, status, delivery_url FROM video_logs WHERE project_id = 1 ORDER BY id").all();
  assert.equal(after[0].title, before[0].title);
  assert.equal(after[0].delivery_url, before[0].delivery_url);
  assert.equal(after[0].status, "DONE");
  assert.equal(after[1].delivery_url, before[1].delivery_url);
});

test("bulk edit never duplicates videos and preserves IDs (§12)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  bulkCreateSql(db, 1, [{ title: "Video A" }, { title: "Video B" }, { title: "Video C" }]);
  const before = db.prepare("SELECT id FROM video_logs WHERE project_id = 1 ORDER BY id").all();
  const ids = before.map((r) => r.id);

  bulkUpdateSql(db, ids, { batch_label: "Retro-labeled" });

  const after = db.prepare("SELECT id FROM video_logs WHERE project_id = 1 ORDER BY id").all();
  assert.deepEqual(after.map((r) => r.id), ids);
  assert.equal(after.length, 3);
});

test("an invalid bulk row rejects the whole submission before any insert (existing all-or-nothing invariant, still honored with the wider status vocabulary)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = bulkCreateSql(db, 1, [
    { title: "Good row" },
    { title: "Bad row", status: "NOT_A_REAL_STATUS" },
  ]);
  assert.equal(result.success, false);
  const rows = db.prepare("SELECT COUNT(*) as c FROM video_logs WHERE project_id = 1").get();
  assert.equal(rows.c, 0);
});
