import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GUIDED_INTAKE_EVENT_TYPE } from "./core.ts";
import { buildGuidedIntakeV2Payload, validateGuidedIntakeV2Submission } from "./v2.ts";
import { resolveReferral, sourceForNewLead } from "../referrals/core.ts";
import { buildSystemInboundProjection } from "../system-inbound/core.ts";

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../db/migrations");

function db() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const file of fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) database.exec(statement.trim());
  }
  return database;
}

function request({ key = "startvideo-integration-001", ref = "pdbm", email = "startvideo-integration@example.com" } = {}) {
  return {
    answers: {
      situation: "steady_flow",
      contentShape: "both",
      workload: "ongoing_weekly",
      priority: "consistency",
      formatMaturity: "defined",
      specialistContext: "none",
      contact: { name: "Startvideo Integration", email, company: "RMEDIA QA" },
      freeformContext: "Canonical V2 custody fixture",
    },
    idempotencyKey: key,
    ref,
    company_website: "",
  };
}

function submit(database, raw) {
  if (raw.company_website?.trim()) return { success: true, honeypot: true };
  const validation = validateGuidedIntakeV2Submission(raw);
  if (!validation.success) return { success: false };
  const existing = database.prepare("SELECT id FROM crm_events WHERE idempotency_key = ?").get(validation.data.idempotencyKey);
  if (existing) return { success: true, deduped: true };
  const referral = resolveReferral(validation.data.ref);
  const payload = buildGuidedIntakeV2Payload(validation.data, referral);
  const client = database.prepare("SELECT id FROM clients WHERE lower(email) = ?").get(validation.data.answers.contact.email);
  const clientId = client ? Number(client.id) : Number(database.prepare(`INSERT INTO clients
    (name, status, opportunity_stage, email, service_interest, source, contacted, converted)
    VALUES (?, 'lead', 'new', ?, 'other', ?, 0, 0)`).run(
      validation.data.answers.contact.name,
      validation.data.answers.contact.email,
      sourceForNewLead("startvideo", referral),
    ).lastInsertRowid);
  if (!client) database.prepare("INSERT INTO crm_events (client_id, type, actor, description) VALUES (?, 'lead_created', 'gateway', 'Lead created from /startvideo')").run(clientId);
  database.prepare("INSERT INTO crm_events (client_id, type, actor, description, payload_json, idempotency_key) VALUES (?, ?, 'gateway', 'Guided intake V2 submitted', ?, ?)").run(
    clientId,
    GUIDED_INTAKE_EVENT_TYPE,
    JSON.stringify(payload),
    validation.data.idempotencyKey,
  );
  return { success: true, clientId, payload };
}

function inbound(database) {
  const rows = database.prepare(`SELECT e.id AS eventId, e.client_id AS clientId, e.type AS eventType,
    e.payload_json AS payloadJson, datetime(e.created_at / 1000, 'unixepoch') AS createdAt,
    c.name, c.email, c.status FROM crm_events e JOIN clients c ON c.id=e.client_id
    WHERE e.type IN ('guided_intake.submitted','system_intake.seen') ORDER BY e.id DESC`).all();
  return buildSystemInboundProjection(rows.map((row) => ({ ...row, createdAt: row.createdAt ? new Date(`${row.createdAt}Z`) : null })));
}

test("V2 creates one canonical Lead and one immutable event with zero downstream entities", () => {
  const database = db();
  const result = submit(database, request());
  assert.equal(result.success, true);
  assert.equal(database.prepare("SELECT count(*) n FROM clients").get().n, 1);
  assert.equal(database.prepare("SELECT source FROM clients").get().source, "referral:pdbm");
  assert.equal(database.prepare("SELECT count(*) n FROM crm_events WHERE type=?").get(GUIDED_INTAKE_EVENT_TYPE).n, 1);
  for (const table of ["projects", "video_logs", "production_orders", "quotes", "commercial_contracts", "transactions", "payment_requests"]) {
    assert.equal(database.prepare(`SELECT count(*) n FROM ${table}`).get().n, 0, table);
  }
  const projection = inbound(database);
  assert.equal(projection.groups[0].latestProjection.surface, "STARTVIDEO V2");
  assert.equal(projection.groups[0].latestProjection.relationshipShape, "RECURRING");
  assert.equal(projection.groups[0].latestProjection.startingPath, "Repeatable production");
  assert.equal(projection.groups[0].latestSourceLabel, "Perfect Day Business Mentorship (PDBM)");
  assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
});

test("V2 replay and honeypot remain exact no-ops", () => {
  const database = db();
  submit(database, request());
  assert.equal(submit(database, request()).deduped, true);
  assert.equal(database.prepare("SELECT count(*) n FROM clients").get().n, 1);
  assert.equal(database.prepare("SELECT count(*) n FROM crm_events WHERE type=?").get(GUIDED_INTAKE_EVENT_TYPE).n, 1);
  const before = database.prepare("SELECT count(*) n FROM crm_events").get().n;
  assert.equal(submit(database, { ...request({ key: "startvideo-bot-002" }), company_website: "bot.example" }).honeypot, true);
  assert.equal(database.prepare("SELECT count(*) n FROM crm_events").get().n, before);
});

test("V2's schema owner remains migration 0053; later migrations do not alter Guided Intake", () => {
  const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
  assert.ok(files.includes("0053_slow_shen.sql"));
  for (const file of files.filter((name) => name >= "0054_")) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    assert.doesNotMatch(sql, /guided_intake|intake_submissions|payload_json/iu);
  }
});
