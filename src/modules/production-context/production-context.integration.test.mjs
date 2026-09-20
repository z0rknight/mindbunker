import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductionContext } from "./core.ts";
import { REVISION_CAUSES } from "../video-operations/config.ts";
import { REVISION_CAUSE_LABELS } from "../video-operations/config.ts";
import { isRevisionCause } from "../video-operations/core.ts";

// Production Operations Consolidation -- the read-only Production Context,
// against the REAL migrated schema. The server reads mirror the SQL in
// production-context/data.ts (each fact read from its own canonical table)
// and feed the REAL pure builder; source pins verify the real pages/actions.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");
function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const statement of fs.readFileSync(path.join(migrationsDir, file), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) db.exec(statement.trim());
    }
  }
  return db;
}
function seed(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active'), (2, 'Dave DeMink', 'active');
    INSERT INTO projects (id, client_id, name, status, notes) VALUES
      (1, 1, 'September Content Waterfall', 'active', 'Source: https://youtube.com/watch?v=abc\nClips: https://notion.so/cutsheet'),
      (2, 2, 'Shorts', 'active', NULL);
    INSERT INTO source_media_references (project_id, approx_size_label, source_url, location, profile) VALUES (1, '~800 GB', 'https://dropbox.com/s/src', 'NAS', 'LOG');
    INSERT INTO production_orders (id, client_id, project_id, label, state, received_at, ingest_key, notes) VALUES
      (1, 1, 1, '17SEP Content Waterfall', 'OPEN', '2026-09-17', 'k1', 'Clip 4: punch in on her face where the sheet flags.');
    INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivered, video_kind, is_operational_container, production_order_id, review_url, delivery_url)
      VALUES (10, '2026-09-17', 'CW clip 1', 1, 1, 'IN_PROGRESS', 0, 'CLIENT_WORK', 0, 1, 'https://frame.io/r/10', NULL),
             (11, '2026-09-17', 'CW clip 2', 1, 1, 'PLANNED', 0, 'CLIENT_WORK', 0, 1, NULL, NULL),
             (12, '2026-09-17', '[Container] 17SEP', 1, 1, 'PLANNED', 0, 'CLIENT_WORK', 1, 1, NULL, NULL),
             (20, '2026-09-01', 'Dave clip', 2, 2, 'IN_PROGRESS', 0, 'CLIENT_WORK', 0, NULL, NULL, NULL);
    INSERT INTO client_production_memory (client_id, name) VALUES (1, 'Lecture Format'), (1, 'Content Waterfall');
  `);
}
// Mirrors getProductionContextForVideo / ForOrder: each fact from its own table.
function contextForVideo(db, videoId) {
  const v = db.prepare("SELECT client_id AS clientId, project_id AS projectId, production_order_id AS orderId, review_url AS reviewUrl, delivery_url AS deliveryUrl, published_url AS publishedUrl FROM video_logs WHERE id = ?").get(videoId);
  if (!v) return null;
  const project = v.projectId === null ? null : db.prepare("SELECT id, name, notes FROM projects WHERE id = ?").get(v.projectId);
  const batch = v.orderId === null ? null : db.prepare("SELECT id, label, notes FROM production_orders WHERE id = ?").get(v.orderId);
  const sources = v.projectId === null ? [] : db.prepare("SELECT id, location, profile, approx_size_label AS approxSizeLabel, source_url AS sourceUrl, notes FROM source_media_references WHERE project_id = ? ORDER BY id").all(v.projectId);
  const formatNames = v.clientId === null ? [] : db.prepare("SELECT name FROM client_production_memory WHERE client_id = ? ORDER BY name").all(v.clientId).map((r) => r.name);
  return buildProductionContext({ batch, project, sources, video: { reviewUrl: v.reviewUrl, deliveryUrl: v.deliveryUrl, publishedUrl: v.publishedUrl }, formatNames });
}
function contextForOrder(db, orderId) {
  const o = db.prepare("SELECT id, label, notes, client_id AS clientId, project_id AS projectId FROM production_orders WHERE id = ?").get(orderId);
  if (!o) return null;
  const project = db.prepare("SELECT id, name, notes FROM projects WHERE id = ?").get(o.projectId);
  const sources = db.prepare("SELECT id, location, profile, approx_size_label AS approxSizeLabel, source_url AS sourceUrl, notes FROM source_media_references WHERE project_id = ?").all(o.projectId);
  const formatNames = db.prepare("SELECT name FROM client_production_memory WHERE client_id = ? ORDER BY name").all(o.clientId).map((r) => r.name);
  return buildProductionContext({ batch: { id: o.id, label: o.label, notes: o.notes }, project, sources, video: null, formatNames });
}

test("Content Waterfall order: batch notes, project notes (source + cut-sheet links), source media and formats in one view", () => {
  const db = buildMigratedDb();
  seed(db);
  const ctx = contextForOrder(db, 1);
  assert.deepEqual(ctx.rows.map((r) => r.key), ["batch-notes", "project-notes", "source", "formats"]);
  assert.match(ctx.rows[0].text, /punch in on her face/u);
  assert.match(ctx.rows[1].text, /notion\.so\/cutsheet/u);
  assert.deepEqual(ctx.rows.find((r) => r.key === "formats").names, ["Content Waterfall", "Lecture Format"]);
  assert.equal(ctx.noSourceContext, false);
});

test("child video: its OWN review link plus the inherited batch/project context; nothing copied between levels", () => {
  const db = buildMigratedDb();
  seed(db);
  const video = contextForVideo(db, 10);
  assert.deepEqual(video.rows.map((r) => r.key), ["batch-notes", "project-notes", "source", "review", "formats"]);
  assert.equal(video.rows.find((r) => r.key === "review").url, "https://frame.io/r/10");
  // the order view never grows a video's review/delivery, and the video row never stores batch notes
  assert.equal(contextForOrder(db, 1).rows.some((r) => r.key === "review" || r.key === "delivery"), false);
  const cols = db.prepare("PRAGMA table_info(video_logs)").all().map((c) => c.name);
  assert.equal(cols.includes("batch_notes"), false);
  // a sibling with no review link simply has no review row (no empty placeholder)
  assert.equal(contextForVideo(db, 11).rows.some((r) => r.key === "review"), false);
});

test("a video with no batch, project notes or source shows the honest single 'not recorded' state", () => {
  const db = buildMigratedDb();
  seed(db);
  const ctx = contextForVideo(db, 20);
  assert.deepEqual(ctx.rows, []);
  assert.equal(ctx.noSourceContext, true);
});

test("client isolation: another client's video/order never shows Taryn's notes, sources or formats", () => {
  const db = buildMigratedDb();
  seed(db);
  const dave = JSON.stringify(contextForVideo(db, 20));
  for (const leak of ["punch in", "notion.so", "dropbox.com", "Lecture Format", "Content Waterfall", "frame.io"]) assert.doesNotMatch(dave, new RegExp(leak, "u"), leak);
  assert.equal(contextForVideo(db, 999), null);
  assert.equal(contextForOrder(db, 999), null);
});

test("reading the context has zero side effects on statuses, sessions, sensor, billing, money or events", () => {
  const db = buildMigratedDb();
  seed(db);
  const snap = () => JSON.stringify({
    videos: db.prepare("SELECT * FROM video_logs ORDER BY id").all(),
    orders: db.prepare("SELECT * FROM production_orders ORDER BY id").all(),
    projects: db.prepare("SELECT * FROM projects ORDER BY id").all(),
    counts: ["work_sessions", "sensor_sessions", "billing_evidence", "billing_allocations", "transactions", "crm_events", "revisions"].map((t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c),
  });
  const before = snap();
  for (const id of [10, 11, 12, 20, 999]) contextForVideo(db, id);
  for (const id of [1, 999]) contextForOrder(db, id);
  assert.equal(snap(), before);
});

// ── source-level pins ───────────────────────────────────────────────────────
const src = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/u.test(entry) && !/\.test\./u.test(entry)) out.push(full);
  }
  return out;
}

test("operator-only and read-only: authenticated reads, no writes, no client-portal reach", () => {
  const data = src("./data.ts");
  assert.match(data, /import "server-only"/u);
  assert.equal((data.match(/getAuthenticatedDb\(\)/gu) ?? []).length, 2);
  assert.doesNotMatch(data, /\.(insert|update|delete)\(/u);
  assert.doesNotMatch(src("./core.ts") + src("./actions.ts"), /\.(insert|update|delete)\(|workSessions|sensorSessions|billing|transactions|transitionVideoStatus/u);
  const files = [...walk(path.resolve(__dirname, "../client-portal")), ...walk(path.resolve(__dirname, "../../app/client")), ...walk(path.resolve(__dirname, "../../app/g"))];
  for (const file of files) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /production-context|ProductionContextBlock|VideoProductionContext/u, file);
});

test("Production Order page shows the context block, links up to client/project, and no longer buries notes at the bottom", () => {
  const page = src("../../app/productivity/orders/[id]/page.tsx");
  assert.match(page, /getProductionContextForOrder\(orderId\)/u);
  assert.match(page, /<ProductionContextBlock context=\{productionContext\}/u);
  assert.match(page, /href=\{`\/crm\/\$\{order\.clientId\}`\}/u);
  assert.match(page, /href=\{`\/projects\/\$\{order\.projectId\}`\}/u);
  assert.doesNotMatch(page, /order\.notes/u, "batch notes are shown once, in the context block");
  assert.match(page, /item\.reviewUrl/u);
  assert.match(page, /item\.deliveryUrl/u);
});

test("Video Workspace: context panel mounted, old duplicate source panel removed, origin-preserving batch link", () => {
  const editor = src("../../app/productivity/VideoEditor.tsx");
  assert.match(editor, /<VideoProductionContext videoId=\{video\.id\} active=\{open\} returnTo=\{returnTo\} \/>/u);
  assert.doesNotMatch(editor, /ProjectReferencesPanel/u);
  const panel = src("../../components/production-context/VideoProductionContext.tsx");
  assert.match(panel, /batchLinkFromVideo\(batch\.id, videoWorkspaceHref\(videoId, returnTo\)\)/u);
  // read-only: it never touches status actions
  assert.doesNotMatch(panel, /transitionVideoStatus|<button|<form|onChange/u);
});

test("the surface never gates or writes: lifecycle controls are still driven only by allowedTransitions/isPending", () => {
  const editor = src("../../app/productivity/VideoEditor.tsx");
  assert.match(editor, /onClick=\{\(\) => moveTo\(targetStatus\)\}\s*disabled=\{isPending\}/u);
});

// ── revision provenance (existing column, optional control) ─────────────────
test("revision cause: every existing value has a label, UNKNOWN stays the default, and the action still validates", () => {
  assert.deepEqual(Object.keys(REVISION_CAUSE_LABELS).sort(), [...REVISION_CAUSES].sort());
  assert.equal(REVISION_CAUSE_LABELS.UNKNOWN, "Not sure");
  for (const cause of REVISION_CAUSES) assert.equal(isRevisionCause(cause), true);
  assert.equal(isRevisionCause("NORMAL_ITERATION"), false, "no invented categories");
});

test("revision cause UI: optional, defaults to UNKNOWN, no new category/minutes controls, no schema change", () => {
  const panel = src("../../app/productivity/VideoEssentialsPanel.tsx");
  assert.match(panel, /useState<RevisionCause>\("UNKNOWN"\)/u);
  assert.match(panel, /causedBy: revisionCause, category: "", minutesRework: ""/u);
  assert.match(panel, /Revision cause \(optional\)/u);
  assert.doesNotMatch(panel, /REVISION_CATEGORIES/u);
  // Record stays enabled by the note alone -- the cause never blocks saving
  assert.match(panel, /disabled=\{pending \|\| !revisionNote\.trim\(\)\}/u);
  // This feature still adds no revision schema. A later, unrelated Guided
  // Intake release legitimately adds 0053 for crm_events.payload_json, so a
  // global migration-count assertion would make this regression test reject
  // every future additive migration.
  const latestMigration = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort().at(-1);
  assert.equal(latestMigration, "0053_slow_shen.sql");
  assert.doesNotMatch(
    fs.readFileSync(path.join(migrationsDir, latestMigration), "utf8"),
    /revision|caused_by|minutes_rework/iu,
  );
});
