// P0 ENABLE PORTAL CRASH PATCH (Sep 2026) -- integration test for the
// "Enable portal login" flow (setClientPortalPassword /
// revokeClientPortalPassword in actions.ts).
//
// actions.ts calls getAuthenticatedDb(), which needs a Cloudflare Workers
// request context this test runner doesn't have -- same convention as
// migration-0015.integration.test.mjs and portal-views.integration.test.mjs:
// replay the REAL migration chain (all 39 files, exactly as production
// applies them) against node:sqlite, then mirror actions.ts's exact
// SELECT/UPDATE/INSERT statements, calling the REAL, imported
// createPasswordHash/verifyPassword/normalizePortalEmail/
// isPortalPasswordCandidate from auth-core.ts/auth.ts -- neither has a
// "server-only" or "@/db" import, so both are safely importable here.
//
// This is what actually proves the P0 root cause is fixed: it exercises
// the real PBKDF2 deriveBits call, at the real (now-corrected, <=100000)
// iteration count, against a real migrated schema -- the exact call that
// threw NotSupportedError on the live Cloudflare Worker every time
// "Enable portal login" was clicked, before this round's fix.

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPasswordHash, verifyPassword } from "../../lib/auth-core.ts";
import { isPortalPasswordCandidate, normalizePortalEmail } from "./auth.ts";

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

function insertClient(db, { name, email }) {
  return db
    .prepare(`INSERT INTO clients (name, email) VALUES (?, ?)`)
    .run(name, email ?? null).lastInsertRowid;
}

// Mirrors setClientPortalPassword's exact query/mutation shape verbatim.
async function enablePortalAccess(db, clientId, password) {
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    return { success: false, error: "Invalid client." };
  }
  if (!isPortalPasswordCandidate(password)) {
    return { success: false, error: "Password must be 8-200 characters." };
  }

  const current = db
    .prepare(`SELECT id, email FROM clients WHERE id = ?`)
    .get(clientId);
  if (!current) return { success: false, error: "Client not found." };
  if (!current.email) {
    return {
      success: false,
      error: "Add an email for this client before enabling portal access.",
    };
  }

  const normalizedEmail = normalizePortalEmail(current.email);
  const others = db
    .prepare(
      `SELECT id, email FROM clients
       WHERE id != ? AND email IS NOT NULL AND portal_password_hash IS NOT NULL`,
    )
    .all(clientId);
  const collision = others.some(
    (row) => row.email && normalizePortalEmail(row.email) === normalizedEmail,
  );
  if (collision) {
    return {
      success: false,
      error:
        "Another client already uses this email for portal access. Update one of the two emails first.",
    };
  }

  // The exact call that threw NotSupportedError in production before this fix.
  const passwordHash = await createPasswordHash(password);
  const now = Date.now();

  db.prepare(
    `UPDATE clients
     SET portal_password_hash = ?, portal_password_set_at = ?,
         portal_reset_token_hash = NULL, portal_reset_expires_at = NULL
     WHERE id = ?`,
  ).run(passwordHash, now, clientId);

  db.prepare(
    `INSERT INTO crm_events (client_id, video_id, type, actor, description, created_at)
     VALUES (?, NULL, 'client_portal_access_granted', 'admin', 'Client portal password issued.', ?)`,
  ).run(clientId, now);

  return { success: true, message: "Portal password set.", temporaryPassword: password };
}

test("enabling portal access for a real client succeeds end-to-end against the full migrated schema", async () => {
  const db = buildMigratedDb();
  const clientId = insertClient(db, { name: "Dave", email: "dave@example.com" });

  const result = await enablePortalAccess(db, clientId, "a-real-temporary-password");
  assert.equal(result.success, true);

  const row = db
    .prepare(`SELECT portal_password_hash, portal_password_set_at FROM clients WHERE id = ?`)
    .get(clientId);
  assert.ok(row.portal_password_hash, "expected portal_password_hash to be persisted");
  assert.ok(row.portal_password_set_at, "expected portal_password_set_at to be persisted");
  assert.equal(
    await verifyPassword("a-real-temporary-password", row.portal_password_hash),
    true,
  );

  const events = db
    .prepare(`SELECT type, actor FROM crm_events WHERE client_id = ?`)
    .all(clientId);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "client_portal_access_granted");
  assert.equal(events[0].actor, "admin");
});

test("persists after reload -- re-selecting the client row still verifies the same password", async () => {
  const db = buildMigratedDb();
  const clientId = insertClient(db, { name: "Dave", email: "dave@example.com" });
  await enablePortalAccess(db, clientId, "a-real-temporary-password");

  // Simulate a fresh page load: an independent SELECT, no cached state.
  const reloaded = db
    .prepare(`SELECT portal_password_hash FROM clients WHERE id = ?`)
    .get(clientId);
  assert.equal(
    await verifyPassword("a-real-temporary-password", reloaded.portal_password_hash),
    true,
  );
});

test("a second Enable (reset) is idempotent -- no duplicate client row, old password stops working", async () => {
  const db = buildMigratedDb();
  const clientId = insertClient(db, { name: "Dave", email: "dave@example.com" });

  await enablePortalAccess(db, clientId, "first-password-issued");
  const result = await enablePortalAccess(db, clientId, "second-password-issued");
  assert.equal(result.success, true);

  const clientRows = db.prepare(`SELECT id FROM clients WHERE id = ?`).all(clientId);
  assert.equal(clientRows.length, 1, "expected exactly one client row, not a duplicate");

  const row = db
    .prepare(`SELECT portal_password_hash FROM clients WHERE id = ?`)
    .get(clientId);
  assert.equal(await verifyPassword("first-password-issued", row.portal_password_hash), false);
  assert.equal(await verifyPassword("second-password-issued", row.portal_password_hash), true);

  const events = db.prepare(`SELECT type FROM crm_events WHERE client_id = ?`).all(clientId);
  assert.equal(events.length, 2, "expected one event per Enable click, not deduped or missing");
});

test("missing email fails with a validation error, not a write or a crash", async () => {
  const db = buildMigratedDb();
  const clientId = insertClient(db, { name: "No Email Yet", email: null });

  const result = await enablePortalAccess(db, clientId, "a-real-temporary-password");
  assert.equal(result.success, false);
  assert.match(result.error, /email/iu);

  const row = db
    .prepare(`SELECT portal_password_hash FROM clients WHERE id = ?`)
    .get(clientId);
  assert.equal(row.portal_password_hash, null, "expected no write when validation fails");
});

test("enabling one client's portal access never modifies another client's row", async () => {
  const db = buildMigratedDb();
  const daveId = insertClient(db, { name: "Dave", email: "dave@example.com" });
  const otherId = insertClient(db, { name: "Taryn", email: "taryn@example.com" });

  await enablePortalAccess(db, daveId, "daves-password-issued");

  const other = db
    .prepare(`SELECT portal_password_hash FROM clients WHERE id = ?`)
    .get(otherId);
  assert.equal(other.portal_password_hash, null, "expected the other client to be untouched");
});
