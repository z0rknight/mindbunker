import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePublicBookingRequestInput } from "./core.ts";

// Sprint 3 — /book public intake, exercised against the real migration
// chain the same way
// src/modules/productivity/add-video-single-ingest.integration.test.mjs
// does (submitPublicBookingRequest is a "use server" action that needs a
// Next.js/Cloudflare request context this test runner doesn't have).
//
// Behavior under test, mirroring submitPublicBookingRequest exactly:
//   1. a brand-new email creates exactly one new Lead (clients row,
//      status=lead) plus a lead_created event plus a book_request_submitted
//      event -- never a Project, Contract, Meeting, or Gateway invitation.
//   2. a known email reuses the existing client id -- never a duplicate
//      lead/client row.
//   3. a repeat submission with the SAME idempotency key is a no-op: only
//      one book_request_submitted event is ever logged for that key.
//   4. a DIFFERENT idempotency key from the same visitor is a distinct,
//      legitimate second submission (not silently swallowed).

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

// Mirrors submitPublicBookingRequest's SQL exactly.
function submitSql(db, formValues) {
  const validation = validatePublicBookingRequestInput(formValues);
  if (!validation.success) return { success: false, errors: validation.errors };
  const data = validation.data;
  const idempotencyKey = formValues.idempotencyKey ?? null;

  if (idempotencyKey) {
    const already = db
      .prepare("SELECT id FROM crm_events WHERE idempotency_key = ?")
      .get(idempotencyKey);
    if (already) return { success: true, deduped: true };
  }

  const description = `Booking request from ${data.name} (${data.email})`;

  const existing = db
    .prepare("SELECT id FROM clients WHERE lower(email) = ?")
    .get(data.email);

  let clientId;
  if (existing) {
    clientId = existing.id;
    db.prepare("UPDATE clients SET last_interaction_at = ? WHERE id = ?").run(
      Date.now(),
      clientId,
    );
  } else {
    const inserted = db
      .prepare(
        `INSERT INTO clients (name, status, opportunity_stage, email, phone, source, contacted, converted)
         VALUES (?, 'lead', 'new', ?, ?, 'book', 0, 0)`,
      )
      .run(data.name, data.email, data.phone);
    clientId = Number(inserted.lastInsertRowid);
    db.prepare(
      `INSERT INTO crm_events (client_id, type, actor, description) VALUES (?, 'lead_created', 'gateway', ?)`,
    ).run(clientId, `Lead created from /book: ${data.name}`);
  }

  const result = db
    .prepare(
      `INSERT INTO crm_events (client_id, type, actor, description, idempotency_key)
       VALUES (?, 'book_request_submitted', 'gateway', ?, ?)
       ON CONFLICT(idempotency_key) DO NOTHING`,
    )
    .run(clientId, description, idempotencyKey);

  return { success: true, clientId, eventInserted: result.changes > 0 };
}

test("a brand-new email creates exactly one Lead and no Project/Contract/Meeting/Gateway", () => {
  const db = buildMigratedDb();
  const result = submitSql(db, {
    name: "Shelley Riutta",
    email: "shelley@example.com",
    idempotencyKey: "key-1",
  });
  assert.equal(result.success, true);

  const clientRows = db.prepare("SELECT * FROM clients").all();
  assert.equal(clientRows.length, 1);
  assert.equal(clientRows[0].status, "lead");
  assert.equal(clientRows[0].source, "book");

  assert.equal(db.prepare("SELECT COUNT(*) c FROM projects").get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM commercial_contracts").get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM bookings").get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM gateway_invitations").get().c, 0);

  const events = db.prepare("SELECT type FROM crm_events ORDER BY id").all();
  assert.deepEqual(events.map((e) => e.type), ["lead_created", "book_request_submitted"]);
});

test("a known email is matched and reused, never duplicated", () => {
  const db = buildMigratedDb();
  db.exec(
    `INSERT INTO clients (id, name, status, email) VALUES (1, 'Taryn Dubreuil', 'active', 'taryn@example.com');`,
  );

  const result = submitSql(db, {
    name: "Taryn Dubreuil",
    email: "Taryn@Example.com",
    idempotencyKey: "key-2",
  });
  assert.equal(result.success, true);
  assert.equal(result.clientId, 1);

  const clientRows = db.prepare("SELECT * FROM clients").all();
  assert.equal(clientRows.length, 1, "must not create a second client for an existing email");
  assert.equal(clientRows[0].status, "active", "must not overwrite an existing client's status");

  const events = db.prepare("SELECT type FROM crm_events ORDER BY id").all();
  assert.deepEqual(
    events.map((e) => e.type),
    ["book_request_submitted"],
    "no lead_created event for an already-existing client",
  );
});

test("a repeat submission with the same idempotency key is a no-op", () => {
  const db = buildMigratedDb();
  const first = submitSql(db, {
    name: "Jane Doe",
    email: "jane@example.com",
    idempotencyKey: "same-key",
  });
  assert.equal(first.deduped, undefined);

  const second = submitSql(db, {
    name: "Jane Doe",
    email: "jane@example.com",
    idempotencyKey: "same-key",
  });
  assert.equal(second.success, true);
  assert.equal(second.deduped, true);

  assert.equal(db.prepare("SELECT COUNT(*) c FROM clients").get().c, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) c FROM crm_events WHERE type = 'book_request_submitted'").get().c,
    1,
  );
});

test("a different idempotency key from the same visitor is a distinct submission", () => {
  const db = buildMigratedDb();
  submitSql(db, { name: "Jane Doe", email: "jane@example.com", idempotencyKey: "key-a" });
  submitSql(db, { name: "Jane Doe", email: "jane@example.com", idempotencyKey: "key-b" });

  assert.equal(db.prepare("SELECT COUNT(*) c FROM clients").get().c, 1, "still the same lead");
  assert.equal(
    db.prepare("SELECT COUNT(*) c FROM crm_events WHERE type = 'book_request_submitted'").get().c,
    2,
    "two genuinely distinct requests must both be preserved as evidence",
  );
});
