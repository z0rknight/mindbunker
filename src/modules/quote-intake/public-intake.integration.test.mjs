import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateQuoteRequestInput } from "./core.ts";

// Client Service Reality Patch (25 Aug 2026) -- /quoteavideo public
// intake, exercised against the real migration chain the same way
// booking/public-intake.integration.test.mjs does (submitQuoteRequest is
// a "use server" action that needs a Next.js/Cloudflare request context
// this test runner doesn't have).
//
// Behavior under test, mirroring submitQuoteRequest exactly (brief
// sections 3 and 19):
//   1. a brand-new email creates exactly one new Lead (clients row,
//      status=lead) plus a lead_created event plus a quote.requested
//      event -- and NEVER a Project or Video (no production entity
//      before Emmanuel approves a quote).
//   2. a known email reuses the existing client id -- never a duplicate
//      lead/client row.
//   3. a repeat submission with the SAME idempotency key is a no-op:
//      only one quote.requested event is ever logged for that key.
//   4. a different idempotency key from the same visitor is a distinct,
//      legitimate second submission.

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

// Mirrors submitQuoteRequest's SQL exactly.
function submitSql(db, formValues) {
  const validation = validateQuoteRequestInput(formValues);
  if (!validation.success) return { success: false, errors: validation.errors };
  const data = validation.data;
  const idempotencyKey = formValues.idempotencyKey ?? null;

  if (idempotencyKey) {
    const already = db
      .prepare("SELECT id FROM crm_events WHERE idempotency_key = ?")
      .get(idempotencyKey);
    if (already) return { success: true, deduped: true };
  }

  const description = `Video quote request from ${data.name} (${data.email})`;

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
        `INSERT INTO clients (name, status, opportunity_stage, email, service_interest, source, contacted, converted)
         VALUES (?, 'lead', 'new', ?, ?, 'quoteavideo', 0, 0)`,
      )
      .run(data.name, data.email, data.contentType);
    clientId = Number(inserted.lastInsertRowid);
    db.prepare(
      `INSERT INTO crm_events (client_id, type, actor, description) VALUES (?, 'lead_created', 'gateway', ?)`,
    ).run(clientId, `Lead created from /quoteavideo: ${data.name}`);
  }

  const result = db
    .prepare(
      `INSERT INTO crm_events (client_id, type, actor, description, idempotency_key)
       VALUES (?, 'quote.requested', 'gateway', ?, ?)
       ON CONFLICT(idempotency_key) DO NOTHING`,
    )
    .run(clientId, description, idempotencyKey);

  return { success: true, clientId, eventInserted: result.changes > 0 };
}

const BASE_INPUT = {
  name: "Dave Client",
  email: "dave@example.com",
  company: "",
  contentType: "short-form",
  whatAreYouCreating: "A launch video for our landing page",
  mainObjective: "Drive signups",
  quantityFrequency: "",
  idealTimeline: "",
  referencesContext: "",
  notes: "",
};

test("a brand-new email creates exactly one Lead and no Project/Video/Quote", () => {
  const db = buildMigratedDb();
  const result = submitSql(db, { ...BASE_INPUT, idempotencyKey: "key-1" });
  assert.equal(result.success, true);

  const clientRows = db.prepare("SELECT * FROM clients").all();
  assert.equal(clientRows.length, 1);
  assert.equal(clientRows[0].status, "lead");
  assert.equal(clientRows[0].source, "quoteavideo");
  assert.equal(clientRows[0].service_interest, "short-form");

  assert.equal(db.prepare("SELECT COUNT(*) c FROM projects").get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM video_logs").get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM quotes").get().c, 0);

  const events = db.prepare("SELECT type FROM crm_events ORDER BY id").all();
  assert.deepEqual(events.map((e) => e.type), ["lead_created", "quote.requested"]);
});

test("a known email is matched and reused, never duplicated", () => {
  const db = buildMigratedDb();
  db.exec(
    `INSERT INTO clients (id, name, status, email) VALUES (1, 'Dave Client', 'active', 'dave@example.com');`,
  );

  const result = submitSql(db, { ...BASE_INPUT, idempotencyKey: "key-2" });
  assert.equal(result.success, true);
  assert.equal(result.clientId, 1);

  const clientRows = db.prepare("SELECT * FROM clients").all();
  assert.equal(clientRows.length, 1, "must not create a second client for an existing email");
  assert.equal(clientRows[0].status, "active", "must not overwrite an existing client's status");

  const events = db.prepare("SELECT type FROM crm_events ORDER BY id").all();
  assert.deepEqual(
    events.map((e) => e.type),
    ["quote.requested"],
    "no lead_created event for an already-existing client",
  );
});

test("a repeat submission with the same idempotency key is a no-op", () => {
  const db = buildMigratedDb();
  const first = submitSql(db, { ...BASE_INPUT, idempotencyKey: "same-key" });
  assert.equal(first.deduped, undefined);

  const second = submitSql(db, { ...BASE_INPUT, idempotencyKey: "same-key" });
  assert.equal(second.success, true);
  assert.equal(second.deduped, true);

  assert.equal(db.prepare("SELECT COUNT(*) c FROM clients").get().c, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) c FROM crm_events WHERE type = 'quote.requested'").get().c,
    1,
  );
});

test("a different idempotency key from the same visitor is a distinct submission", () => {
  const db = buildMigratedDb();
  submitSql(db, { ...BASE_INPUT, idempotencyKey: "key-a" });
  submitSql(db, { ...BASE_INPUT, idempotencyKey: "key-b" });

  assert.equal(db.prepare("SELECT COUNT(*) c FROM clients").get().c, 1, "still the same lead");
  assert.equal(
    db.prepare("SELECT COUNT(*) c FROM crm_events WHERE type = 'quote.requested'").get().c,
    2,
    "two genuinely distinct requests must both be preserved as evidence",
  );
});
