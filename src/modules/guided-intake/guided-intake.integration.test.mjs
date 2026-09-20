import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildGuidedIntakePayload,
  GUIDED_INTAKE_EVENT_TYPE,
  validateGuidedIntakeSubmission,
} from "./core.ts";
import { resolveReferral, shouldAdoptReferralSource, sourceForNewLead } from "../referrals/core.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

function migrationFiles() {
  return fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
}

function applyFile(db, file) {
  const contents = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  for (const statement of contents.split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement.trim());
  }
}

function migratedDb(stopBefore = null) {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const file of migrationFiles()) {
    if (file === stopBefore) break;
    applyFile(db, file);
  }
  return db;
}

function rawSubmission({ email = "qa-guided@example.com", key = "guided-request-001", ref = null, overrides = {} } = {}) {
  return {
    answers: {
      contentType: "short",
      durationBand: "under_90s",
      deliverableCountBand: "one",
      recurrence: "one_off",
      formatMaturity: "established",
      sourceReadiness: "ready",
      editorialReadiness: "defined",
      creativeFlexibility: "formula",
      technicalComplexityFlags: [],
      reviewComplexity: "one",
      deadlineType: "window",
      dependencyFlags: ["none"],
      contact: { name: "Guided QA", email, company: "QA" },
      freeformContext: "Synthetic integration evidence",
      ...overrides,
    },
    idempotencyKey: key,
    ref,
    company_website: "",
  };
}

// SQLite equivalent of the public server action. This intentionally mirrors
// its lookup/create/source precedence/idempotency boundaries against the real
// migration chain without requiring a Next/Cloudflare request context.
function submitSql(db, raw) {
  if (typeof raw?.company_website === "string" && raw.company_website.trim()) return { success: true, honeypot: true };
  const validation = validateGuidedIntakeSubmission(raw);
  if (!validation.success) return { success: false };
  const data = validation.data;
  const duplicate = db.prepare("SELECT id, payload_json FROM crm_events WHERE idempotency_key = ?").get(data.idempotencyKey);
  if (duplicate) return { success: true, deduped: true };

  const referral = resolveReferral(data.ref);
  const payload = buildGuidedIntakePayload(data, referral);
  const existing = db.prepare("SELECT id, source FROM clients WHERE lower(email) = ? LIMIT 1").get(data.answers.contact.email);
  let clientId;
  if (existing) {
    clientId = Number(existing.id);
    if (referral && shouldAdoptReferralSource(existing.source)) {
      db.prepare("UPDATE clients SET source = ? WHERE id = ?").run(referral.source, clientId);
    }
  } else {
    const result = db.prepare(`INSERT INTO clients
      (name, status, opportunity_stage, email, service_interest, source, contacted, converted)
      VALUES (?, 'lead', 'new', ?, ?, ?, 0, 0)`).run(
      data.answers.contact.name,
      data.answers.contact.email,
      "short-form",
      sourceForNewLead("start", referral),
    );
    clientId = Number(result.lastInsertRowid);
    db.prepare("INSERT INTO crm_events (client_id, type, actor, description) VALUES (?, 'lead_created', 'gateway', 'Lead created from /start')").run(clientId);
  }
  db.prepare(`INSERT INTO crm_events
    (client_id, type, actor, description, payload_json, idempotency_key)
    VALUES (?, ?, 'gateway', 'Guided intake submitted', ?, ?)
    ON CONFLICT(idempotency_key) DO NOTHING`).run(
    clientId,
    GUIDED_INTAKE_EVENT_TYPE,
    JSON.stringify(payload),
    data.idempotencyKey,
  );
  return { success: true, clientId, payload };
}

test("0053 is additive: legacy events survive with NULL and structured evidence round-trips", () => {
  const db = migratedDb("0053_slow_shen.sql");
  db.exec("INSERT INTO clients (id, name, status) VALUES (9001, 'Legacy lead', 'lead')");
  db.exec("INSERT INTO crm_events (id, client_id, type, actor, description) VALUES (9002, 9001, 'legacy', 'system', 'Before 0053')");
  applyFile(db, "0053_slow_shen.sql");
  const legacy = db.prepare("SELECT id, description, payload_json FROM crm_events WHERE id = 9002").get();
  assert.equal(legacy.id, 9002);
  assert.equal(legacy.description, "Before 0053");
  assert.equal(legacy.payload_json, null);
  db.prepare("UPDATE crm_events SET payload_json = ? WHERE id = 9002").run(JSON.stringify({ schemaVersion: 1 }));
  assert.deepEqual(JSON.parse(db.prepare("SELECT payload_json FROM crm_events WHERE id = 9002").get().payload_json), { schemaVersion: 1 });
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("generic and PDBM submissions create one Lead + immutable event and no downstream records", () => {
  for (const ref of [null, "pdbm"]) {
    const db = migratedDb();
    const result = submitSql(db, rawSubmission({ ref }));
    assert.equal(result.success, true);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM clients").get().c, 1);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM crm_events WHERE type = ?").get(GUIDED_INTAKE_EVENT_TYPE).c, 1);
    const lead = db.prepare("SELECT status, source FROM clients").get();
    assert.equal(lead.status, "lead");
    assert.equal(lead.source, ref ? "referral:pdbm" : "start");
    for (const table of ["projects", "video_logs", "work_sessions", "billing_evidence", "transactions", "payment_requests"]) {
      assert.equal(db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c, 0, table);
    }
  }
});

test("same-request replay is idempotent while a later inquiry remains distinct", () => {
  const db = migratedDb();
  submitSql(db, rawSubmission({ key: "guided-same-001" }));
  assert.equal(submitSql(db, rawSubmission({ key: "guided-same-001" })).deduped, true);
  submitSql(db, rawSubmission({ key: "guided-future-002" }));
  assert.equal(db.prepare("SELECT COUNT(*) c FROM clients").get().c, 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM crm_events WHERE type = ?").get(GUIDED_INTAKE_EVENT_TYPE).c, 2);
  const payloads = db.prepare("SELECT payload_json FROM crm_events WHERE type = ? ORDER BY id").all(GUIDED_INTAKE_EVENT_TYPE);
  assert.equal(payloads.length, 2);
  assert.equal(JSON.parse(payloads[0].payload_json).schemaVersion, 1);
});

test("source precedence never downgrades acquisition truth", () => {
  const db = migratedDb();
  db.exec("INSERT INTO clients (id, name, status, email, source) VALUES (42, 'Existing', 'lead', 'existing@example.com', 'instagram dm')");
  submitSql(db, rawSubmission({ email: "existing@example.com", key: "existing-pdbm-01", ref: "pdbm" }));
  assert.equal(db.prepare("SELECT source FROM clients WHERE id = 42").get().source, "instagram dm");
  const payload = JSON.parse(db.prepare("SELECT payload_json FROM crm_events WHERE type = ?").get(GUIDED_INTAKE_EVENT_TYPE).payload_json);
  assert.equal(payload.referralContext.source, "referral:pdbm");

  const referred = migratedDb();
  submitSql(referred, rawSubmission({ email: "pdbm@example.com", key: "pdbm-first-01", ref: "pdbm" }));
  submitSql(referred, rawSubmission({ email: "pdbm@example.com", key: "generic-later-02", ref: null }));
  assert.equal(referred.prepare("SELECT source FROM clients").get().source, "referral:pdbm");
});

test("honeypot returns ordinary success with exactly zero writes", () => {
  const db = migratedDb();
  const result = submitSql(db, { ...rawSubmission(), company_website: "bot.example" });
  assert.equal(result.success, true);
  assert.equal(result.honeypot, true);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM clients").get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM crm_events").get().c, 0);
});
