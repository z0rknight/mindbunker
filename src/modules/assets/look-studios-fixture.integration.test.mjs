import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Monday Real-Operation Pre-Freeze §16/§21 acceptance criterion O: "The
// real operational shape fits without schema lies." This test builds the
// full local migration chain (0000..HEAD) against a fresh in-memory DB,
// then reproduces the Look Studios Session reference case end-to-end at
// the real SQL level -- not just app-layer validation -- and asserts the
// shape the brief requires: one project, one ~800GB LOG source media
// reference (never coerced to a byte count), several assets of DIFFERENT
// TYPES (final deliverable, client review cuts, utility asset, bonus
// extra), most with NO video relation at all, and NOT flattened into fake
// separately-contracted videos.

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

test("Look Studios Session fixture: project with source media + multiple asset types, mostly video-independent", () => {
  const db = buildMigratedDb();

  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Look Studios Session', 'active');
  `);

  // §4: source media reference -- free-text estimate, never a byte count.
  db.prepare(
    `INSERT INTO source_media_references (project_id, approx_size_label, location, profile, notes)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(1, "~800 GB", "NAS / Dropbox", "LOG", "downloaded via shell to RMEDIA NAS");

  // Only ONE of the outputs below is modeled as a video_logs row (a real,
  // separately-tracked production unit) -- everything else is an Asset.
  // This is the crux of §3: VIDEO != DELIVERABLE != ASSET.
  db.exec(`
    INSERT INTO video_logs (id, date, title, client_id, project_id, status)
    VALUES (1, '2026-08-14', 'Full Cut', 1, 1, 'IN_PROGRESS');
  `);

  const insertAsset = db.prepare(`
    INSERT INTO assets (project_id, video_id, name, type, status, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  // Project-level assets -- NO video relation (§3 acceptance criterion D).
  insertAsset.run(1, null, "Taryn's Cut 1.0", "CLIENT_REVIEW", "DELIVERED", null);
  insertAsset.run(1, null, "Taryn's Cut 1.1", "CLIENT_REVIEW", "DELIVERED", null);
  insertAsset.run(1, null, "Taryn's Cut 1.2", "CLIENT_REVIEW", "READY", null);
  insertAsset.run(1, null, "Color Correction Previews", "UTILITY_ASSET", "READY", null);
  insertAsset.run(1, null, "AI Processing / Utility Cuts", "AI_INPUT", "DRAFT", null);
  // One asset IS linked to the Full Cut video -- the final deliverable.
  insertAsset.run(1, 1, "Full Cut — final delivery", "FINAL_DELIVERABLE", "DELIVERED", null);

  const assets = db.prepare("SELECT * FROM assets WHERE project_id = 1").all();
  assert.equal(assets.length, 6, "multiple assets on one project (acceptance criterion C)");

  const withoutVideo = assets.filter((a) => a.video_id === null);
  assert.equal(withoutVideo.length, 5, "most assets have NO video relation (criterion D)");

  const distinctTypes = new Set(assets.map((a) => a.type));
  assert.ok(distinctTypes.size >= 3, "asset types are genuinely heterogeneous, not one type repeated");

  const videos = db.prepare("SELECT * FROM video_logs WHERE project_id = 1").all();
  assert.equal(videos.length, 1, "outputs are NOT flattened into fake separately-contracted videos");

  const sourceMedia = db.prepare("SELECT * FROM source_media_references WHERE project_id = 1").get();
  assert.equal(sourceMedia.approx_size_label, "~800 GB", "size stays a free-text estimate, never a parsed byte count");
  assert.equal(typeof sourceMedia.approx_size_label, "string");

  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
});
