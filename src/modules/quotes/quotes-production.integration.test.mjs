import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canTransitionQuoteStatus, isQuoteStatus, validateQuoteInput } from "./core.ts";

// Client Service Reality Patch (25 Aug 2026) -- Quote -> Approval ->
// Production, exercised against the real migration chain the same way
// booking/public-intake.integration.test.mjs does (createQuote/
// updateQuoteStatus/createProductionFromQuote are "use server" actions
// that need a Next.js/Cloudflare request context this test runner
// doesn't have -- this test mirrors their SQL exactly instead, the same
// "quotient" pattern fx-personal-ledger.integration.test.mjs and
// correction.integration.test.mjs already establish).
//
// Behavior under test (brief sections 6, 7, 15, 19):
//   1. an approved quote can link to a real Project + Video.
//   2. that link never creates a duplicate client -- a Lead becomes an
//      active Client via the same row (status change), not a second row.
//   3. production work cannot be created twice for the same quote.
//   4. production work cannot be created from a non-APPROVED quote.

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

// Mirrors createQuote's SQL exactly.
function createQuoteSql(db, input) {
  const validation = validateQuoteInput(input);
  if (!validation.success) return { success: false, errors: validation.errors };
  const data = validation.data;
  const result = db
    .prepare(
      `INSERT INTO quotes (client_id, status, currency, amount_cents, content_type_label, turnaround_label, revisions_included, summary, scope_text)
       VALUES (?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.clientId,
      data.currency,
      data.amountCents,
      data.contentTypeLabel,
      data.turnaroundLabel,
      data.revisionsIncluded,
      data.summary || null,
      data.scopeText,
    );
  const quoteId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT INTO crm_events (client_id, type, actor, description) VALUES (?, 'quote.logged', 'admin', ?)`,
  ).run(data.clientId, `Quote logged: ${data.contentTypeLabel}`);
  return { success: true, quoteId };
}

// Mirrors updateQuoteStatus's SQL exactly.
function updateQuoteStatusSql(db, quoteId, nextStatus) {
  if (!isQuoteStatus(nextStatus)) return { success: false, error: "Invalid request." };
  const quote = db.prepare("SELECT id, client_id, status FROM quotes WHERE id = ?").get(quoteId);
  if (!quote) return { success: false, error: "Quote not found." };
  if (!canTransitionQuoteStatus(quote.status, nextStatus)) {
    return { success: false, error: "Invalid transition." };
  }
  const column =
    nextStatus === "SENT" ? "sent_at" : nextStatus === "APPROVED" ? "approved_at" : "declined_at";
  db.prepare(`UPDATE quotes SET status = ?, ${column} = ? WHERE id = ?`).run(
    nextStatus,
    Date.now(),
    quoteId,
  );
  db.prepare(
    `INSERT INTO crm_events (client_id, type, actor, description) VALUES (?, 'quote.status_changed', 'admin', ?)`,
  ).run(quote.client_id, `Quote ${quoteId} moved from ${quote.status} to ${nextStatus}`);
  return { success: true };
}

// Mirrors createProductionFromQuote's SQL exactly, including reusing
// convertLeadToClient's own SQL for the Lead -> Client step.
function createProductionFromQuoteSql(db, quoteId, { projectName, videoTitle }) {
  const quote = db
    .prepare("SELECT id, client_id, status, project_id, video_id, content_type_label FROM quotes WHERE id = ?")
    .get(quoteId);
  if (!quote) return { success: false, error: "Quote not found." };
  if (quote.status !== "APPROVED") {
    return { success: false, error: "Only an approved quote can become production work." };
  }
  if (quote.project_id !== null || quote.video_id !== null) {
    return { success: false, error: "Production work already exists for this quote." };
  }

  const client = db.prepare("SELECT id, status FROM clients WHERE id = ?").get(quote.client_id);
  if (!client) return { success: false, error: "Client not found." };

  const projectResult = db
    .prepare(`INSERT INTO projects (client_id, name, status) VALUES (?, ?, 'active')`)
    .run(quote.client_id, projectName);
  const projectId = Number(projectResult.lastInsertRowid);

  const today = new Date().toISOString().slice(0, 10);
  const videoResult = db
    .prepare(
      `INSERT INTO video_logs (date, title, client_id, project_id, status) VALUES (?, ?, ?, ?, 'PLANNED')`,
    )
    .run(today, videoTitle, quote.client_id, projectId);
  const videoId = Number(videoResult.lastInsertRowid);

  db.prepare("UPDATE quotes SET project_id = ?, video_id = ? WHERE id = ?").run(
    projectId,
    videoId,
    quoteId,
  );

  if (client.status === "lead") {
    db.prepare(
      `UPDATE clients SET status = 'active', opportunity_stage = 'active', converted = 1, contacted = 1 WHERE id = ?`,
    ).run(client.id);
    db.prepare(
      `INSERT INTO crm_events (client_id, type, actor, description) VALUES (?, 'client_activated', 'admin', 'Lead converted to active client')`,
    ).run(client.id);
  }

  db.prepare(
    `INSERT INTO crm_events (client_id, video_id, type, actor, description) VALUES (?, ?, 'quote.production_created', 'admin', ?)`,
  ).run(quote.client_id, videoId, `Production work created from approved quote: ${quote.content_type_label}`);

  return { success: true, projectId, videoId };
}

const QUOTE_INPUT = {
  clientId: null, // filled per-test
  amountCents: 10_000,
  currency: "USD",
  contentTypeLabel: "Short-form video for landing page",
  turnaroundLabel: "24h",
  revisionsIncluded: 3,
  summary: "",
  scopeText: "Color correction\nAudio adjustment\nCaptions",
};

// Mirrors createManualApprovedQuoteForVideo's SQL exactly (Reality
// Closure, 26 Aug 2026): records a `quotes` row directly in APPROVED
// status, origin='MANUAL', for a video/project that already exist --
// Dave's fixed $100 shape, agreed outside the quote flow entirely.
function createManualApprovedQuoteForVideoSql(db, videoId, input) {
  const video = db
    .prepare("SELECT id, client_id, project_id FROM video_logs WHERE id = ?")
    .get(videoId);
  if (!video) return { success: false, error: "Video not found." };
  if (video.client_id === null) {
    return { success: false, error: "This video has no client attached yet." };
  }
  const existing = db.prepare("SELECT id FROM quotes WHERE video_id = ?").get(videoId);
  if (existing) {
    return { success: false, error: "This video already has commercial terms recorded." };
  }
  const validation = validateQuoteInput({ ...input, clientId: video.client_id });
  if (!validation.success) return { success: false, errors: validation.errors };
  const data = validation.data;
  const result = db
    .prepare(
      `INSERT INTO quotes (client_id, status, currency, amount_cents, content_type_label, turnaround_label, revisions_included, summary, scope_text, approved_at, project_id, video_id, origin)
       VALUES (?, 'APPROVED', ?, ?, ?, ?, ?, ?, ?, unixepoch(), ?, ?, 'MANUAL')`,
    )
    .run(
      data.clientId,
      data.currency,
      data.amountCents,
      data.contentTypeLabel,
      data.turnaroundLabel,
      data.revisionsIncluded,
      data.summary || null,
      data.scopeText,
      video.project_id,
      video.id,
    );

  // Quick Morning Reality Patch §13: mirrors the real action's Lead ->
  // Client promotion, added this round -- same-row status change, only
  // when still a Lead.
  const clientRow = db.prepare("SELECT status FROM clients WHERE id = ?").get(video.client_id);
  if (clientRow?.status === "lead") {
    db.prepare("UPDATE clients SET status = 'active' WHERE id = ?").run(video.client_id);
  }

  return { success: true, quoteId: Number(result.lastInsertRowid) };
}

test("an approved quote links to a real Project + Video", () => {
  const db = buildMigratedDb();
  const clientId = Number(
    db
      .prepare(`INSERT INTO clients (name, status, email) VALUES ('Dave Client', 'lead', 'dave@example.com')`)
      .run().lastInsertRowid,
  );

  const created = createQuoteSql(db, { ...QUOTE_INPUT, clientId });
  assert.equal(created.success, true);
  assert.equal(updateQuoteStatusSql(db, created.quoteId, "SENT").success, true);
  assert.equal(updateQuoteStatusSql(db, created.quoteId, "APPROVED").success, true);

  const production = createProductionFromQuoteSql(db, created.quoteId, {
    projectName: "Dave — Landing Page Video",
    videoTitle: "Landing page short-form",
  });
  assert.equal(production.success, true);
  assert.ok(production.projectId);
  assert.ok(production.videoId);

  const quoteRow = db.prepare("SELECT project_id, video_id FROM quotes WHERE id = ?").get(created.quoteId);
  assert.equal(quoteRow.project_id, production.projectId);
  assert.equal(quoteRow.video_id, production.videoId);

  const project = db.prepare("SELECT client_id FROM projects WHERE id = ?").get(production.projectId);
  assert.equal(project.client_id, clientId);
  const video = db.prepare("SELECT client_id, project_id FROM video_logs WHERE id = ?").get(production.videoId);
  assert.equal(video.client_id, clientId);
  assert.equal(video.project_id, production.projectId);
});

test("Lead -> Client happens on the SAME row, never a duplicate", () => {
  const db = buildMigratedDb();
  const clientId = Number(
    db
      .prepare(`INSERT INTO clients (name, status, email) VALUES ('Dave Client', 'lead', 'dave@example.com')`)
      .run().lastInsertRowid,
  );
  const created = createQuoteSql(db, { ...QUOTE_INPUT, clientId });
  updateQuoteStatusSql(db, created.quoteId, "SENT");
  updateQuoteStatusSql(db, created.quoteId, "APPROVED");
  createProductionFromQuoteSql(db, created.quoteId, {
    projectName: "Dave — Landing Page Video",
    videoTitle: "Landing page short-form",
  });

  const clientRows = db.prepare("SELECT * FROM clients").all();
  assert.equal(clientRows.length, 1, "must still be exactly one client row");
  assert.equal(clientRows[0].id, clientId, "same row, not a new one");
  assert.equal(clientRows[0].status, "active", "Lead promoted to active Client");
  assert.equal(clientRows[0].converted, 1);
});

test("an already-active client's status is left untouched by production creation", () => {
  const db = buildMigratedDb();
  const clientId = Number(
    db
      .prepare(`INSERT INTO clients (name, status, email) VALUES ('Taryn', 'active', 'taryn@example.com')`)
      .run().lastInsertRowid,
  );
  const created = createQuoteSql(db, { ...QUOTE_INPUT, clientId });
  updateQuoteStatusSql(db, created.quoteId, "SENT");
  updateQuoteStatusSql(db, created.quoteId, "APPROVED");
  createProductionFromQuoteSql(db, created.quoteId, {
    projectName: "Taryn Project",
    videoTitle: "Taryn Video",
  });

  const events = db.prepare("SELECT type FROM crm_events WHERE type = 'client_activated'").all();
  assert.equal(events.length, 0, "no client_activated event for an already-active client");
});

test("production work cannot be created twice for the same quote", () => {
  const db = buildMigratedDb();
  const clientId = Number(
    db
      .prepare(`INSERT INTO clients (name, status, email) VALUES ('Dave Client', 'lead', 'dave@example.com')`)
      .run().lastInsertRowid,
  );
  const created = createQuoteSql(db, { ...QUOTE_INPUT, clientId });
  updateQuoteStatusSql(db, created.quoteId, "SENT");
  updateQuoteStatusSql(db, created.quoteId, "APPROVED");

  const first = createProductionFromQuoteSql(db, created.quoteId, {
    projectName: "First",
    videoTitle: "First Video",
  });
  assert.equal(first.success, true);

  const second = createProductionFromQuoteSql(db, created.quoteId, {
    projectName: "Second",
    videoTitle: "Second Video",
  });
  assert.equal(second.success, false);

  assert.equal(db.prepare("SELECT COUNT(*) c FROM projects").get().c, 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM video_logs").get().c, 1);
});

test("production work cannot be created from a DRAFT or SENT (non-approved) quote", () => {
  const db = buildMigratedDb();
  const clientId = Number(
    db
      .prepare(`INSERT INTO clients (name, status, email) VALUES ('Dave Client', 'lead', 'dave@example.com')`)
      .run().lastInsertRowid,
  );
  const created = createQuoteSql(db, { ...QUOTE_INPUT, clientId });

  const fromDraft = createProductionFromQuoteSql(db, created.quoteId, {
    projectName: "Nope",
    videoTitle: "Nope",
  });
  assert.equal(fromDraft.success, false);

  updateQuoteStatusSql(db, created.quoteId, "SENT");
  const fromSent = createProductionFromQuoteSql(db, created.quoteId, {
    projectName: "Nope",
    videoTitle: "Nope",
  });
  assert.equal(fromSent.success, false);

  assert.equal(db.prepare("SELECT COUNT(*) c FROM projects").get().c, 0);
});

test("DRAFT cannot skip straight to APPROVED", () => {
  const db = buildMigratedDb();
  const clientId = Number(
    db
      .prepare(`INSERT INTO clients (name, status, email) VALUES ('Dave Client', 'lead', 'dave@example.com')`)
      .run().lastInsertRowid,
  );
  const created = createQuoteSql(db, { ...QUOTE_INPUT, clientId });
  const result = updateQuoteStatusSql(db, created.quoteId, "APPROVED");
  assert.equal(result.success, false);
  const quote = db.prepare("SELECT status FROM quotes WHERE id = ?").get(created.quoteId);
  assert.equal(quote.status, "DRAFT");
});

test("manual commercial terms: creates an APPROVED, origin=MANUAL quote linked to an existing video/project (Dave's fixed $100 shape)", () => {
  const db = buildMigratedDb();
  const clientId = Number(
    db
      .prepare(`INSERT INTO clients (name, status, email) VALUES ('Dave Client', 'active', 'dave2@example.com')`)
      .run().lastInsertRowid,
  );
  const projectId = Number(
    db
      .prepare(`INSERT INTO projects (client_id, name, status) VALUES (?, 'Dave Landing Page', 'active')`)
      .run(clientId).lastInsertRowid,
  );
  const videoId = Number(
    db
      .prepare(
        `INSERT INTO video_logs (date, title, client_id, project_id, status) VALUES ('2026-08-20', 'Dave Landing Page Video', ?, ?, 'DONE')`,
      )
      .run(clientId, projectId).lastInsertRowid,
  );

  const result = createManualApprovedQuoteForVideoSql(db, videoId, {
    amountCents: 10_000,
    currency: "USD",
    contentTypeLabel: "Short-form video for landing page",
    turnaroundLabel: "24h",
    revisionsIncluded: 3,
    scopeText: "Color correction\nAudio adjustment\nCaptions",
  });
  assert.equal(result.success, true);

  const quote = db
    .prepare("SELECT status, origin, project_id, video_id, amount_cents FROM quotes WHERE id = ?")
    .get(result.quoteId);
  assert.equal(quote.status, "APPROVED");
  assert.equal(quote.origin, "MANUAL");
  assert.equal(quote.project_id, projectId);
  assert.equal(quote.video_id, videoId);
  assert.equal(quote.amount_cents, 10_000);
});

// Quick Morning Reality Patch §13: Dave's REAL shape -- his video predates
// the quote flow, so his commercial terms were recorded manually, not via
// createProductionFromQuote (which already promoted leads). Without this,
// a client stays visually "Lead" forever if this was their only path to a
// sale.
test("manual commercial terms promotes a Lead to an active Client on the same row", () => {
  const db = buildMigratedDb();
  const clientId = Number(
    db
      .prepare(`INSERT INTO clients (name, status, email) VALUES ('Dave DeMink', 'lead', 'dave3@example.com')`)
      .run().lastInsertRowid,
  );
  const videoId = Number(
    db
      .prepare(
        `INSERT INTO video_logs (date, title, client_id, status) VALUES ('2026-08-20', 'Landing Page', ?, 'DONE')`,
      )
      .run(clientId).lastInsertRowid,
  );

  const before = db.prepare("SELECT status FROM clients WHERE id = ?").get(clientId);
  assert.equal(before.status, "lead");

  const result = createManualApprovedQuoteForVideoSql(db, videoId, { ...QUOTE_INPUT, clientId: undefined });
  assert.equal(result.success, true);

  const after = db.prepare("SELECT id, status FROM clients WHERE id = ?").get(clientId);
  assert.equal(after.status, "active");
  assert.equal(after.id, clientId, "same row, not a duplicate client");
  assert.equal(db.prepare("SELECT COUNT(*) c FROM clients WHERE name = 'Dave DeMink'").get().c, 1);
});

test("manual commercial terms: a video that already has a quote linked cannot get a second one", () => {
  const db = buildMigratedDb();
  const clientId = Number(
    db
      .prepare(`INSERT INTO clients (name, status, email) VALUES ('Client', 'active', 'client@example.com')`)
      .run().lastInsertRowid,
  );
  const videoId = Number(
    db
      .prepare(
        `INSERT INTO video_logs (date, title, client_id, status) VALUES ('2026-08-20', 'Some Video', ?, 'DONE')`,
      )
      .run(clientId).lastInsertRowid,
  );

  const first = createManualApprovedQuoteForVideoSql(db, videoId, { ...QUOTE_INPUT, clientId: undefined });
  assert.equal(first.success, true);

  const second = createManualApprovedQuoteForVideoSql(db, videoId, { ...QUOTE_INPUT, clientId: undefined });
  assert.equal(second.success, false);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM quotes WHERE video_id = ?").get(videoId).c, 1);
});

test("every pre-existing quote row defaults to origin=INTAKE (the real public-intake path)", () => {
  const db = buildMigratedDb();
  const clientId = Number(
    db
      .prepare(`INSERT INTO clients (name, status, email) VALUES ('Client', 'lead', 'lead@example.com')`)
      .run().lastInsertRowid,
  );
  const created = createQuoteSql(db, { ...QUOTE_INPUT, clientId });
  const quote = db.prepare("SELECT origin FROM quotes WHERE id = ?").get(created.quoteId);
  assert.equal(quote.origin, "INTAKE");
});
