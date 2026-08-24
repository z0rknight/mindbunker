import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Taryn August Ingest Readiness §18 — "Taryn August Reality Test." A more
// detailed fixture than the Look Studios Session case (see
// look-studios-fixture.integration.test.mjs): the SAME client operating
// across THREE differently-shaped projects at once, proving the real
// August 2026 operation fits without inventing fake Videos for every
// intermediate Asset, and without flattening genuinely different Video
// work units into one. Built as a test fixture only (real DB migration
// chain, in-memory), NOT permanent seed data — per §18's explicit "not
// permanent seed pollution unless explicitly necessary."
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

test("Taryn August Reality Test: one client, three differently-shaped projects, no fake Videos", () => {
  const db = buildMigratedDb();

  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');`);

  // ── Project 1: Studio Session Arizona ft C ────────────────────────────
  // Heavy source media + multiple cut-version Assets, most with no Video
  // relation at all — the Look Studios shape, but with a real client
  // source URL this time (§9) instead of only free-text location.
  db.exec(`
    INSERT INTO projects (id, client_id, name, status)
    VALUES (1, 1, 'Studio Session Arizona ft C', 'active');
  `);
  db.prepare(
    `INSERT INTO source_media_references (project_id, approx_size_label, source_url, location, profile, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    1,
    "~800 GB",
    "https://www.dropbox.com/sh/example-arizona-ft-c-log",
    "NAS / Dropbox",
    "LOG",
    "Client-provided Dropbox share, mirrored to RMEDIA NAS",
  );

  db.exec(`
    INSERT INTO video_logs (id, date, title, client_id, project_id, status)
    VALUES (1, '2026-08-14', 'Full Cut', 1, 1, 'IN_PROGRESS');
  `);
  const insertAsset = db.prepare(`
    INSERT INTO assets (project_id, video_id, name, type, status, delivery_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAsset.run(1, null, "Studios Sesh Taryn's cut 1.0", "CLIENT_REVIEW", "DELIVERED", null, null);
  insertAsset.run(1, null, "Studios Sesh Taryn's cut 1.1", "CLIENT_REVIEW", "DELIVERED", null, null);
  insertAsset.run(1, null, "Studios Sesh Taryn's cut 1.2", "CLIENT_REVIEW", "READY", "https://www.dropbox.com/example-cut-1-2", null);
  insertAsset.run(1, null, "Color-corrected support output", "UTILITY_ASSET", "READY", null, "Synchronized to Full Cut timeline");
  insertAsset.run(1, null, "Synchronized multicam reference", "SOURCE_PREP", "DRAFT", null, null);
  insertAsset.run(1, 1, "Full Cut — final delivery", "FINAL_DELIVERABLE", "DELIVERED", "https://www.dropbox.com/example-full-cut", null);

  // ── Project 2: Horizontal Short Form ──────────────────────────────────
  // Several genuinely distinct Video work units, differing in title, date,
  // AND status — this is what "ADD MULTIPLE VIDEOS" (§6) produces, and
  // proves varied real production states coexist correctly in one
  // project without being collapsed into a single row.
  db.exec(`
    INSERT INTO projects (id, client_id, name, status)
    VALUES (2, 1, 'Horizontal Short Form', 'active');
  `);
  const insertVideo = db.prepare(`
    INSERT INTO video_logs (date, title, client_id, project_id, status, delivered)
    VALUES (?, ?, 1, 2, ?, ?)
  `);
  insertVideo.run("2026-08-05", "Short Form Ep 1", "DONE", 1);
  insertVideo.run("2026-08-12", "Short Form Ep 2", "IN_PROGRESS", 0);
  insertVideo.run("2026-08-19", "Short Form Ep 3", "PLANNED", 0);
  insertVideo.run("2026-08-20", "Short Form Ep 4 (bonus cut)", "PLANNED", 0);

  // ── Project 3: Mini Series ─────────────────────────────────────────────
  db.exec(`
    INSERT INTO projects (id, client_id, name, status)
    VALUES (3, 1, 'Mini Series', 'active');
    INSERT INTO video_logs (date, title, client_id, project_id, status)
    VALUES ('2026-08-10', 'Episode 1', 1, 3, 'IN_PROGRESS');
  `);

  // ── Assertions ─────────────────────────────────────────────────────────
  const projects = db.prepare("SELECT * FROM projects WHERE client_id = 1 ORDER BY id").all();
  assert.equal(projects.length, 3, "the same client operates three differently-shaped projects at once");

  // Project 1: assets outnumber videos, most assets are video-independent.
  const arizonaAssets = db.prepare("SELECT * FROM assets WHERE project_id = 1").all();
  const arizonaVideos = db.prepare("SELECT * FROM video_logs WHERE project_id = 1").all();
  assert.equal(arizonaAssets.length, 6, "six real outputs on Arizona ft C");
  assert.equal(arizonaVideos.length, 1, "only ONE of those outputs is a real Video work unit -- no fake Videos per Asset");
  const arizonaAssetsWithoutVideo = arizonaAssets.filter((a) => a.video_id === null);
  assert.equal(arizonaAssetsWithoutVideo.length, 5, "intermediate cuts/utility/source-prep assets need no Video relation");
  const distinctAssetTypes = new Set(arizonaAssets.map((a) => a.type));
  assert.ok(distinctAssetTypes.size >= 4, "asset types are genuinely heterogeneous");

  const arizonaSourceMedia = db.prepare("SELECT * FROM source_media_references WHERE project_id = 1").get();
  assert.equal(arizonaSourceMedia.approx_size_label, "~800 GB", "size stays free text, never a parsed byte count");
  assert.equal(
    arizonaSourceMedia.source_url,
    "https://www.dropbox.com/sh/example-arizona-ft-c-log",
    "the client's own source URL is a first-class field (§9), not buried in notes",
  );

  // Project 2: multiple real Video work units, deliberately varied.
  const shortFormVideos = db.prepare("SELECT * FROM video_logs WHERE project_id = 2 ORDER BY date").all();
  assert.equal(shortFormVideos.length, 4, "Horizontal Short Form has multiple distinct video work units");
  const distinctTitles = new Set(shortFormVideos.map((v) => v.title));
  const distinctDates = new Set(shortFormVideos.map((v) => v.date));
  const distinctStatuses = new Set(shortFormVideos.map((v) => v.status));
  assert.equal(distinctTitles.size, 4, "titles differ per row");
  assert.equal(distinctDates.size, 4, "dates differ per row -- historical dates are honored, not all defaulted to today");
  assert.ok(distinctStatuses.size >= 3, "statuses genuinely differ across the batch (Done/In progress/Planned)");

  // Project 3: the simplest legitimate shape -- one project, one video.
  const miniSeriesVideos = db.prepare("SELECT * FROM video_logs WHERE project_id = 3").all();
  assert.equal(miniSeriesVideos.length, 1);
  assert.equal(miniSeriesVideos[0].title, "Episode 1");

  // Whole-fixture integrity, exactly as required by §19.
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
});
