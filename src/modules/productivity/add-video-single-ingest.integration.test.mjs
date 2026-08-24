import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateVideoCreateInput } from "./core.ts";

// "MindBunker — Final Single Video Ingest Gap" round §10 — required test
// scenarios, covered against the real migration chain (0000..HEAD) at the
// SQL level, mirroring exactly what createVideoLogsBulk does when called
// with a single-row array (which is what the new AddVideoButton does --
// this is not a second implementation to test, it's the existing bulk
// action called with rows.length === 1). Same raw-SQL convention as the
// prior round's integration tests (server actions need a Next.js/
// Cloudflare request context this test runner doesn't have).
//
// Scenario coverage map (§10 numbering):
//   1  historical single Video can be created                -- below
//   2  explicit DONE historical Video can be created           -- below
//   3  Plan Video still defaults to PLANNED                     -- modules/productivity/core.test.mjs "new video status is explicit..." (unchanged, regression-green)
//   4  Add Multiple Videos still behaves exactly as before      -- modules/productivity/bulk-ingest-brief-c.integration.test.mjs (unchanged, regression-green)
//   5  READY_FOR_REVIEW still requires review URL                -- modules/productivity/core.test.mjs "explicit historical create into READY_FOR_REVIEW still requires a review URL" (new invariant, applies identically to Add Video and Add Multiple Videos since both share validateVideoCreateInput)
//   6  optional URLs remain optional for statuses where valid   -- modules/productivity/core.test.mjs "optional URLs remain optional..."
//   7  project/client ownership validation remains enforced      -- below
//   8  returnTo cannot become an open redirect                    -- src/utils/navigation.test.mjs (unchanged, regression-green); AddVideoButton performs no navigation at all (stays on the Project workspace and calls router.refresh()), so it introduces no new returnTo surface
//   9  existing videos are not modified                           -- below
//   10 single Add Video creation does not require sequence/batch generation -- by construction: AddVideoButton's form has no prefix/quantity/start/separator/preview controls at all, and calls createVideoLogsBulk with a plain one-item array; below confirms that one-item array path persists a single row correctly

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
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Studio Session Arizona ft C', 'active');
    INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivered, delivery_url)
    VALUES
      (101, '2026-08-01', 'Studios Sesh Taryn''s-1', 1, 1, 'DONE', 1, 'https://www.youtube.com/watch?v=1'),
      (102, '2026-08-02', 'Studios Sesh Taryn''s-2', 1, 1, 'DONE', 1, 'https://www.youtube.com/watch?v=2'),
      (103, '2026-08-03', 'Studios Sesh Taryn''s-3', 1, 1, 'DONE', 1, 'https://www.youtube.com/watch?v=3');
  `);
}

// Mirrors createVideoLogsBulk exactly, including its all-or-nothing
// validate-everything-first loop -- called here with a one-item array,
// exactly as AddVideoButton does.
function addVideoSql(db, projectId, row) {
  const parsed = validateVideoCreateInput({
    title: row.title,
    projectId,
    clientId: null,
    date: row.date ?? null,
    deliveryUrl: row.deliveryUrl ?? null,
    reviewUrl: row.reviewUrl ?? null,
    publishedUrl: row.publishedUrl ?? null,
    status: row.status ?? "PLANNED",
    allowExplicitStatus: true,
  });
  if (!parsed.success) return { success: false, error: parsed.error };

  const projectRow = db.prepare("SELECT client_id FROM projects WHERE id = ?").get(projectId);
  if (!projectRow) return { success: false, error: "Choose an existing project." };

  const insert = db.prepare(
    `INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, delivery_url, review_url, published_url, batch_label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const result = insert.run(
    parsed.data.date ?? "2026-08-24",
    parsed.data.title,
    projectRow.client_id,
    projectId,
    parsed.data.status,
    parsed.data.status === "DONE" ? 1 : 0,
    parsed.data.deliveryUrl,
    parsed.data.reviewUrl,
    parsed.data.publishedUrl,
    null,
  );
  return { success: true, id: Number(result.lastInsertRowid) };
}

test("a historical single Video can be created (§1)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = addVideoSql(db, 1, { title: "Full Cut", date: "2026-08-20" });
  assert.equal(result.success, true);
  const row = db.prepare("SELECT title, status, date FROM video_logs WHERE id = ?").get(result.id);
  assert.equal(row.title, "Full Cut");
  assert.equal(row.status, "PLANNED");
  assert.equal(row.date, "2026-08-20");
});

test("an explicit DONE historical Video can be created with its real delivery link (§2)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = addVideoSql(db, 1, {
    title: "Full Cut",
    date: "2026-08-20",
    status: "DONE",
    deliveryUrl: "https://www.youtube.com/watch?v=fullcut",
  });
  assert.equal(result.success, true);
  const row = db.prepare("SELECT status, delivered, delivery_url FROM video_logs WHERE id = ?").get(result.id);
  assert.equal(row.status, "DONE");
  assert.equal(row.delivered, 1);
  assert.equal(row.delivery_url, "https://www.youtube.com/watch?v=fullcut");
});

test("Add Video enforces project ownership exactly like bulk create (§7)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = addVideoSql(db, 999, { title: "Orphan video" });
  assert.equal(result.success, false);
  const count = db.prepare("SELECT COUNT(*) as c FROM video_logs").get().c;
  assert.equal(count, 3); // only the three seeded videos -- nothing inserted
});

test("adding one historical Video does not modify the project's existing videos (§9)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const before = db.prepare("SELECT id, title, status, delivery_url FROM video_logs WHERE project_id = 1 ORDER BY id").all();

  const result = addVideoSql(db, 1, {
    title: "Full Cut",
    date: "2026-08-20",
    status: "DONE",
    deliveryUrl: "https://www.youtube.com/watch?v=fullcut",
  });
  assert.equal(result.success, true);

  const after = db.prepare("SELECT id, title, status, delivery_url FROM video_logs WHERE project_id = 1 AND id != ? ORDER BY id").all(result.id);
  assert.deepEqual(after, before);

  const all = db.prepare("SELECT COUNT(*) as c FROM video_logs WHERE project_id = 1").get().c;
  assert.equal(all, 4); // exactly one new row alongside the three untouched originals
});

test("Add Video's one-item array persists exactly one row, no generation/batch machinery required (§10)", () => {
  const db = buildMigratedDb();
  seedClientAndProject(db);
  const result = addVideoSql(db, 1, { title: "Full Cut", status: "DONE" });
  assert.equal(result.success, true);
  const count = db.prepare("SELECT COUNT(*) as c FROM video_logs WHERE project_id = 1").get().c;
  assert.equal(count, 4);
});
