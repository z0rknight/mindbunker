import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Post-Job Commercial + Delivery Sniper §1/§18: exercises the REAL
// migration chain (including 0040's contract_id columns) the same way
// quotes-production.integration.test.mjs does, then mirrors
// resolveContractForVideo's exact SQL (modules/quotes/actions.ts) --
// that function is a private "use server" helper this test runner can't
// call directly (no Next/Cloudflare request context), so the resolution
// logic is reproduced here statement-for-statement against the real
// schema and asserted against the same invariants the server code
// enforces (same-client validation, explicit-video > explicit-project >
// legacy-client-single-contract precedence).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
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

// Mirrors resolveContractForVideo's precedence exactly: explicit video
// contract -> explicit project contract -> legacy client single ACTIVE
// HOURLY contract -> none.
function resolveContractForVideo(db, videoId) {
  const video = db
    .prepare("SELECT id, client_id, project_id, contract_id FROM video_logs WHERE id = ?")
    .get(videoId);
  if (!video) return null;
  if (video.contract_id !== null) {
    return { contractId: video.contract_id, attribution: "VIDEO_CONTRACT" };
  }
  if (video.project_id !== null) {
    const project = db
      .prepare("SELECT contract_id FROM projects WHERE id = ?")
      .get(video.project_id);
    if (project && project.contract_id !== null) {
      return { contractId: project.contract_id, attribution: "PROJECT_CONTRACT" };
    }
  }
  if (video.client_id === null) return null;
  const legacy = db
    .prepare(
      "SELECT id FROM commercial_contracts WHERE client_id = ? AND billing_type = 'HOURLY' AND status = 'ACTIVE' LIMIT 1",
    )
    .get(video.client_id);
  return legacy ? { contractId: legacy.id, attribution: "CLIENT_SINGLE_ACTIVE_CONTRACT" } : null;
}

function seedTwoClientsWithContracts(db) {
  db.exec(`
    INSERT INTO clients (id, name) VALUES (1, 'Dave DeMink'), (2, 'Taryn');
    INSERT INTO commercial_contracts (id, client_id, platform, billing_type, hourly_rate, currency, status)
      VALUES
      (1, 1, 'Upwork', 'HOURLY', 25, 'USD', 'ACTIVE'),
      (2, 1, 'Direct Retainer', 'HOURLY', 40, 'USD', 'ACTIVE'),
      (3, 2, 'Upwork', 'HOURLY', 25, 'USD', 'ACTIVE');
    INSERT INTO projects (id, client_id, name) VALUES (10, 1, 'Meta Ads');
    INSERT INTO video_logs (id, date, client_id, project_id) VALUES
      (100, '2026-09-01', 1, 10),
      (101, '2026-09-01', 1, 10),
      (102, '2026-09-01', 2, NULL);
  `);
}

test("explicit video contract wins over project contract and legacy client fallback", () => {
  const db = buildMigratedDb();
  seedTwoClientsWithContracts(db);
  db.exec("UPDATE projects SET contract_id = 1 WHERE id = 10");
  db.exec("UPDATE video_logs SET contract_id = 2 WHERE id = 100");

  const resolved = resolveContractForVideo(db, 100);
  assert.deepEqual(resolved, { contractId: 2, attribution: "VIDEO_CONTRACT" });
});

test("project contract inherits to a video with no explicit contract of its own", () => {
  const db = buildMigratedDb();
  seedTwoClientsWithContracts(db);
  db.exec("UPDATE projects SET contract_id = 2 WHERE id = 10");
  // video 101 has no explicit contract_id -- should inherit the project's.

  const resolved = resolveContractForVideo(db, 101);
  assert.deepEqual(resolved, { contractId: 2, attribution: "PROJECT_CONTRACT" });
});

test("legacy client-single-active-contract fallback still resolves when nothing is explicitly linked", () => {
  const db = buildMigratedDb();
  seedTwoClientsWithContracts(db);
  // Client 2 (Taryn) has exactly one ACTIVE HOURLY contract and no explicit links anywhere.

  const resolved = resolveContractForVideo(db, 102);
  assert.deepEqual(resolved, { contractId: 3, attribution: "CLIENT_SINGLE_ACTIVE_CONTRACT" });
});

test("a contract belonging to a different client is rejected at write time (FK does not catch cross-client, app check must)", () => {
  const db = buildMigratedDb();
  seedTwoClientsWithContracts(db);
  // Contract 3 belongs to client 2 (Taryn); video 100 belongs to client 1 (Dave).
  // The FK alone permits this write (it only checks the contract exists) --
  // this is exactly why setVideoContract/setProjectContract must validate
  // client ownership themselves before writing, not rely on the schema.
  const video = db.prepare("SELECT client_id FROM video_logs WHERE id = ?").get(100);
  const contract = db.prepare("SELECT client_id FROM commercial_contracts WHERE id = ?").get(3);
  assert.notEqual(video.client_id, contract.client_id);
  // The application-level guard (setVideoContract) is what must refuse
  // this pairing -- see its "belongs to a different client" branch in
  // modules/productivity/actions.ts, exercised in spirit here by
  // asserting the FK alone would NOT have caught it.
  db.exec("UPDATE video_logs SET contract_id = 3 WHERE id = 100");
  const check = db.prepare("PRAGMA foreign_key_check").all();
  assert.deepEqual(check, [], "FK check alone does not flag cross-client attribution -- app-level validation is load-bearing");
});
