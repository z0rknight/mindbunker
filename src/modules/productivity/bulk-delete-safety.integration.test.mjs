import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVideoDeletionOutcome } from "./core.ts";

// Tuesday Reality Patch — Bulk Video Delete. Mirrors
// gatherBulkVideoDeletionChecks + deleteVideoLogsBulk from
// productivity/actions.ts exactly, against the real migration chain --
// "use server" actions need a Next.js/Cloudflare request context this
// test runner doesn't have (same constraint bulk-edit-safety.integration
// already documents), so this follows the repo's established raw-SQL
// mirror convention. The decision function itself, resolveVideoDeletionOutcome,
// is imported for real -- only the SQL gathering/deleting is mirrored.

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

function seedBaseClients(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO clients (id, name, status) VALUES (2, 'Dave DeMink', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Taryn Project', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (2, 2, 'Dave Project', 'active');
  `);
}

function seedVideo(db, { id, clientId, projectId, title, isOperationalContainer = 0, visibleToClient = 1 }) {
  db.prepare(
    `INSERT INTO video_logs (id, date, title, client_id, project_id, status, is_operational_container, visible_to_client)
     VALUES (?, '2026-09-01', ?, ?, ?, 'PLANNED', ?, ?)`,
  ).run(id, title, clientId, projectId, isOperationalContainer, visibleToClient);
}

// Mirrors gatherBulkVideoDeletionChecks in actions.ts: one batched query
// per dependency type, resolveVideoDeletionOutcome decides per video.
function previewBulkDeletionSql(db, ids) {
  const placeholders = ids.map(() => "?").join(",");
  const videos = db
    .prepare(`SELECT id, title, date, client_id AS clientId, is_operational_container AS isOperationalContainer FROM video_logs WHERE id IN (${placeholders})`)
    .all(...ids);
  const hasRow = (table, column = "video_id") =>
    new Set(db.prepare(`SELECT DISTINCT ${column} AS videoId FROM ${table} WHERE ${column} IN (${placeholders})`).all(...ids).map((r) => r.videoId));

  const trackedWork = hasRow("work_sessions");
  const billing = hasRow("billing_allocations");

  const eligible = [];
  const protectedItems = [];
  for (const video of videos) {
    const outcome = resolveVideoDeletionOutcome({
      hasTrackedWork: trackedWork.has(video.id),
      operationalMemoryCount: 0,
      hasCommitmentMemory: false,
      hasFrictionMemory: false,
      hasBlockerMemory: false,
      hasDeliveryMemory: false,
      hasChecklistMemory: false,
      hasBillingAllocation: billing.has(video.id),
      isOperationalContainer: Boolean(video.isOperationalContainer),
    });
    if (outcome.allowed) eligible.push(video);
    else protectedItems.push({ ...video, reason: outcome.reason });
  }
  return { eligible, protectedItems };
}

function deleteBulkSql(db, ids) {
  const { eligible, protectedItems } = previewBulkDeletionSql(db, ids);
  if (eligible.length > 0) {
    const placeholders = eligible.map(() => "?").join(",");
    db.prepare(`DELETE FROM video_logs WHERE id IN (${placeholders})`).run(...eligible.map((v) => v.id));
  }
  return { deletedIds: eligible.map((v) => v.id), protectedItems };
}

test("all-safe selection: every video with no history is deleted", () => {
  const db = buildMigratedDb();
  seedBaseClients(db);
  seedVideo(db, { id: 1, clientId: 1, projectId: 1, title: "A" });
  seedVideo(db, { id: 2, clientId: 1, projectId: 1, title: "B" });
  seedVideo(db, { id: 3, clientId: 1, projectId: 1, title: "C" });

  const result = deleteBulkSql(db, [1, 2, 3]);
  assert.deepEqual(result.deletedIds.sort(), [1, 2, 3]);
  assert.equal(result.protectedItems.length, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM video_logs").get().n, 0);
});

test("mixed safe/protected selection: 5 can delete, 2 protected, eligible ones removed and protected ones preserved", () => {
  const db = buildMigratedDb();
  seedBaseClients(db);
  for (let id = 1; id <= 5; id++) seedVideo(db, { id, clientId: 1, projectId: 1, title: `Clean ${id}` });
  seedVideo(db, { id: 6, clientId: 1, projectId: 1, title: "Has work session" });
  seedVideo(db, { id: 7, clientId: 1, projectId: 1, title: "Container", isOperationalContainer: 1 });
  db.prepare(
    `INSERT INTO work_sessions (video_id, started_at, activity_type) VALUES (6, unixepoch(), 'EDITING')`,
  ).run();

  const preview = previewBulkDeletionSql(db, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(preview.eligible.length, 5);
  assert.equal(preview.protectedItems.length, 2);
  assert.deepEqual(preview.protectedItems.map((p) => p.id).sort(), [6, 7]);

  const result = deleteBulkSql(db, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(result.deletedIds.length, 5);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM video_logs WHERE id IN (1,2,3,4,5)").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM video_logs WHERE id IN (6,7)").get().n, 2, "protected videos must survive");
});

test("protected-only selection: nothing is deleted", () => {
  const db = buildMigratedDb();
  seedBaseClients(db);
  seedVideo(db, { id: 1, clientId: 1, projectId: 1, title: "Container", isOperationalContainer: 1 });
  seedVideo(db, { id: 2, clientId: 1, projectId: 1, title: "Has work session" });
  db.prepare(`INSERT INTO work_sessions (video_id, started_at, activity_type) VALUES (2, unixepoch(), 'EDITING')`).run();

  const result = deleteBulkSql(db, [1, 2]);
  assert.equal(result.deletedIds.length, 0);
  assert.equal(result.protectedItems.length, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM video_logs").get().n, 2);
});

test("cross-client independence: deleting one client's eligible videos never touches another client's videos", () => {
  const db = buildMigratedDb();
  seedBaseClients(db);
  seedVideo(db, { id: 1, clientId: 1, projectId: 1, title: "Taryn clean" });
  seedVideo(db, { id: 2, clientId: 2, projectId: 2, title: "Dave protected", isOperationalContainer: 1 });

  const result = deleteBulkSql(db, [1, 2]);
  assert.deepEqual(result.deletedIds, [1]);
  const daveVideo = db.prepare("SELECT client_id AS clientId FROM video_logs WHERE id = 2").get();
  assert.equal(daveVideo.clientId, 2, "Dave's video must remain owned by Dave, untouched");
});

test("unassign != delete: a protected video's client assignment is never cleared as a fallback", () => {
  const db = buildMigratedDb();
  seedBaseClients(db);
  seedVideo(db, { id: 1, clientId: 1, projectId: 1, title: "Container", isOperationalContainer: 1 });

  deleteBulkSql(db, [1]);
  const row = db.prepare("SELECT client_id AS clientId, project_id AS projectId FROM video_logs WHERE id = 1").get();
  assert.equal(row.clientId, 1);
  assert.equal(row.projectId, 1);
});

test("hide-from-client != delete: a protected video's client visibility is never toggled as a fallback", () => {
  const db = buildMigratedDb();
  seedBaseClients(db);
  seedVideo(db, { id: 1, clientId: 1, projectId: 1, title: "Container", isOperationalContainer: 1, visibleToClient: 1 });

  deleteBulkSql(db, [1]);
  const row = db.prepare("SELECT visible_to_client AS visibleToClient FROM video_logs WHERE id = 1").get();
  assert.equal(row.visibleToClient, 1, "visibility must stay exactly as it was, not become a soft-delete");
});

test("operational containers remain protected even with zero other history", () => {
  const db = buildMigratedDb();
  seedBaseClients(db);
  seedVideo(db, { id: 1, clientId: 1, projectId: 1, title: "Container", isOperationalContainer: 1 });

  const preview = previewBulkDeletionSql(db, [1]);
  assert.equal(preview.eligible.length, 0);
  assert.match(preview.protectedItems[0].reason, /container/i);
});

test("billing/history protects evidence: a video with a billing allocation cannot be swept up in a bulk delete", () => {
  const db = buildMigratedDb();
  seedBaseClients(db);
  seedVideo(db, { id: 1, clientId: 1, projectId: 1, title: "Bonnie piece" });
  db.exec(`
    INSERT INTO commercial_contracts (id, client_id, platform, billing_type, hourly_rate, currency, status)
      VALUES (1, 1, 'Upwork', 'HOURLY', 25, 'USD', 'ACTIVE');
    INSERT INTO billing_evidence (id, contract_id, period_start, period_end, billable_minutes, rate, gross_amount, currency, source, idempotency_key)
      VALUES (1, 1, '2026-09-01', '2026-09-07', 90, 25, 37.5, 'USD', 'MANUAL', 'test-key-1');
    INSERT INTO billing_allocations (billing_evidence_id, video_id, method, amount, minutes, currency)
      VALUES (1, 1, 'MANUAL_AMOUNT', 37.5, 90, 'USD');
  `);

  const result = deleteBulkSql(db, [1]);
  assert.equal(result.deletedIds.length, 0);
  assert.match(result.protectedItems[0].reason, /billing/i);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM video_logs WHERE id = 1").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM billing_allocations WHERE video_id = 1").get().n, 1, "allocation must stay pointed at the real video, never silently nulled");
});
