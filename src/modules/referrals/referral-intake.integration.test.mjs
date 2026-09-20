import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateQuoteRequestInput, buildQuoteRequestDescription } from "../quote-intake/core.ts";
import {
  referralDescriptionPrefix,
  resolveReferral,
  shouldAdoptReferralSource,
  sourceForNewLead,
} from "./core.ts";

// Wave 2 (Sep 20) -- PDBM referral intake. Same convention as
// quote-intake/public-intake.integration.test.mjs: submitQuoteRequest is a
// "use server" action needing a Next/Cloudflare context this runner lacks,
// so submitSql mirrors its SQL against the REAL migration chain but calls
// the REAL shared helpers (resolveReferral / sourceForNewLead /
// shouldAdoptReferralSource / description builders) -- and separate
// source-level tests pin that the real actions and pages actually use them.
// The true end-to-end proof (real action, real form, real D1) is the
// synthetic submission recorded in the release report.

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

function submitSql(db, formValues) {
  // honeypot first: nothing written, generic success
  if (typeof formValues.company_website === "string" && formValues.company_website.trim() !== "") {
    return { success: true, honeypot: true };
  }
  const validation = validateQuoteRequestInput(formValues);
  if (!validation.success) return { success: false, errors: validation.errors };
  const data = validation.data;
  const key = formValues.idempotencyKey ?? null;
  const referral = resolveReferral(formValues.ref);

  if (key && db.prepare("SELECT id FROM crm_events WHERE idempotency_key = ?").get(key)) {
    return { success: true, deduped: true };
  }
  const existing = db.prepare("SELECT id, source FROM clients WHERE lower(email) = ?").get(data.email);
  let clientId;
  if (existing) {
    clientId = existing.id;
    db.prepare("UPDATE clients SET last_interaction_at = ? WHERE id = ?").run(Date.now(), clientId);
    if (referral && shouldAdoptReferralSource(existing.source)) {
      db.prepare("UPDATE clients SET source = ? WHERE id = ?").run(referral.source, clientId);
    }
  } else {
    clientId = Number(
      db.prepare(
        `INSERT INTO clients (name, status, opportunity_stage, email, service_interest, source, contacted, converted)
         VALUES (?, 'lead', 'new', ?, ?, ?, 0, 0)`,
      ).run(data.name, data.email, data.contentType, sourceForNewLead("quoteavideo", referral)).lastInsertRowid,
    );
    db.prepare(`INSERT INTO crm_events (client_id, type, actor, description) VALUES (?, 'lead_created', 'gateway', ?)`)
      .run(clientId, `${referralDescriptionPrefix(referral)}Lead created from /quoteavideo: ${data.name}`);
  }
  db.prepare(
    `INSERT INTO crm_events (client_id, type, actor, description, idempotency_key)
     VALUES (?, 'quote.requested', 'gateway', ?, ?) ON CONFLICT(idempotency_key) DO NOTHING`,
  ).run(clientId, buildQuoteRequestDescription(data, referral), key);
  return { success: true, clientId };
}

const INPUT = {
  name: "PDBM QA Referral", email: "qa-pdbm@example.com", company: "", contentType: "short-form",
  whatAreYouCreating: "Weekly reels for my coaching brand", mainObjective: "Consistency",
  quantityFrequency: "4 per month", idealTimeline: "", referencesContext: "", notes: "",
};
const count = (db, table) => db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c;

test("PDBM submission creates exactly one Lead with canonical origin and inquiry preserved", () => {
  const db = buildMigratedDb();
  assert.equal(submitSql(db, { ...INPUT, ref: "pdbm", idempotencyKey: "k1" }).success, true);
  const rows = db.prepare("SELECT * FROM clients").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "lead");
  assert.equal(rows[0].source, "referral:pdbm");
  assert.equal(rows[0].service_interest, "short-form");
  const events = db.prepare("SELECT type, description FROM crm_events ORDER BY id").all();
  assert.deepEqual(events.map((e) => e.type), ["lead_created", "quote.requested"]);
  assert.match(events[0].description, /Perfect Day Business Mentorship.*Taryn.*CEO Clubhouse/u);
  assert.match(events[1].description, /Weekly reels for my coaching brand/u);
  assert.match(events[1].description, /Quantity\/frequency: 4 per month/u);
});

test("no downstream entities are fabricated (project/video/quote/session/billing/payment)", () => {
  const db = buildMigratedDb();
  submitSql(db, { ...INPUT, ref: "pdbm", idempotencyKey: "k1" });
  for (const table of ["projects", "video_logs", "quotes", "work_sessions", "billing_evidence", "billing_allocations"]) {
    assert.equal(count(db, table), 0, `${table} must stay empty`);
  }
});

test("unknown or hostile ref is ignored: lead falls back to the plain channel source", () => {
  const db = buildMigratedDb();
  submitSql(db, { ...INPUT, ref: "<img src=x onerror=alert(1)>", idempotencyKey: "k1" });
  assert.equal(db.prepare("SELECT source FROM clients").get().source, "quoteavideo");
  assert.doesNotMatch(db.prepare("SELECT group_concat(description) d FROM crm_events").get().d, /img src/u);
});

test("dedup: same idempotency key twice = one lead, one quote event", () => {
  const db = buildMigratedDb();
  submitSql(db, { ...INPUT, ref: "pdbm", idempotencyKey: "same" });
  const second = submitSql(db, { ...INPUT, ref: "pdbm", idempotencyKey: "same" });
  assert.equal(second.deduped, true);
  assert.equal(count(db, "clients"), 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM crm_events WHERE type='quote.requested'").get().c, 1);
});

test("dedup: same email, new key = same lead, second (legitimate) inquiry event", () => {
  const db = buildMigratedDb();
  submitSql(db, { ...INPUT, ref: "pdbm", idempotencyKey: "a" });
  submitSql(db, { ...INPUT, ref: "pdbm", idempotencyKey: "b" });
  assert.equal(count(db, "clients"), 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM crm_events WHERE type='quote.requested'").get().c, 2);
});

test("precedence: PDBM origin survives a later generic visit with no ref", () => {
  const db = buildMigratedDb();
  submitSql(db, { ...INPUT, ref: "pdbm", idempotencyKey: "a" });
  submitSql(db, { ...INPUT, idempotencyKey: "b" });
  assert.equal(db.prepare("SELECT source FROM clients").get().source, "referral:pdbm");
  assert.equal(count(db, "clients"), 1);
});

test("precedence: an existing generic origin is not rewritten by a later PDBM visit, but the referral is recorded", () => {
  const db = buildMigratedDb();
  submitSql(db, { ...INPUT, idempotencyKey: "a" });
  submitSql(db, { ...INPUT, ref: "pdbm", idempotencyKey: "b" });
  assert.equal(db.prepare("SELECT source FROM clients").get().source, "quoteavideo");
  const last = db.prepare("SELECT description FROM crm_events WHERE type='quote.requested' ORDER BY id DESC").get();
  assert.match(last.description, /Referred through Perfect Day Business Mentorship/u);
});

test("precedence: an existing client with NO recorded origin adopts the referral", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status, email) VALUES (1, 'Existing', 'lead', 'qa-pdbm@example.com')`);
  submitSql(db, { ...INPUT, ref: "pdbm", idempotencyKey: "a" });
  assert.equal(db.prepare("SELECT source FROM clients WHERE id = 1").get().source, "referral:pdbm");
  assert.equal(count(db, "clients"), 1);
});

test("honeypot still blocks: nothing written even with a valid PDBM ref", () => {
  const db = buildMigratedDb();
  const out = submitSql(db, { ...INPUT, ref: "pdbm", company_website: "http://spam", idempotencyKey: "h" });
  assert.equal(out.honeypot, true);
  assert.equal(count(db, "clients"), 0);
  assert.equal(count(db, "crm_events"), 0);
});

test("lead isolation: two different referred people never merge", () => {
  const db = buildMigratedDb();
  submitSql(db, { ...INPUT, ref: "pdbm", idempotencyKey: "a" });
  submitSql(db, { ...INPUT, email: "other@example.com", name: "Other Person", ref: "pdbm", idempotencyKey: "b" });
  assert.equal(count(db, "clients"), 2);
});

// ── source-level pins on the REAL code ─────────────────────────────────────
const src = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("real actions: honeypot precedes referral resolution and DB; existing source is guarded", () => {
  for (const [rel, fn] of [
    ["../quote-intake/actions.ts", "submitQuoteRequest"],
    ["../booking/actions.ts", "submitPublicBookingRequest"],
  ]) {
    const body = src(rel).split(`export async function ${fn}`)[1];
    assert.ok(body.indexOf("company_website") < body.indexOf("resolveReferral("), `${rel}: honeypot before referral`);
    assert.ok(body.indexOf("resolveReferral(") < body.indexOf("await getDb()"), `${rel}: resolve before DB`);
    assert.match(body, /resolveReferral\(formData\.get\("ref"\)\)/u);
    assert.match(body, /shouldAdoptReferralSource\(existingClient\[0\]\.source\)/u);
    assert.match(body, /sourceForNewLead\(/u);
  }
});

test("page view creates nothing: the intake pages import no DB and no server action", () => {
  for (const rel of ["../../app/quoteavideo/page.tsx", "../../app/book/page.tsx"]) {
    const page = src(rel);
    assert.doesNotMatch(page, /@\/db|getDb|insert\(|\/actions"/u, `${rel} must not write on GET`);
  }
  // The only writers are the two submit actions, reachable solely from a form action.
  assert.match(src("../../app/quoteavideo/QuoteRequestForm.tsx"), /useActionState\(submitQuoteRequest/u);
});

test("no tracking: referral intake adds no analytics, pixels, UTM or third-party scripts", () => {
  for (const rel of ["./core.ts", "../../app/quoteavideo/page.tsx", "../../app/quoteavideo/QuoteRequestForm.tsx"]) {
    assert.doesNotMatch(src(rel), /utm_|gtag|fbq|analytics|pixel|<script|localStorage|document\.cookie/iu, rel);
  }
});

test("/book redirect only forwards a resolved referral key, never an arbitrary value", () => {
  const book = src("../../app/book/page.tsx");
  assert.match(book, /resolveReferral\(/u);
  assert.match(book, /`\/quoteavideo\?ref=\$\{referral\.key\}`/u);
});
