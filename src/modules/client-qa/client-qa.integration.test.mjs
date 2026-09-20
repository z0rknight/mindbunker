import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPreExportView,
  canAddReminder,
  isDuplicateReminder,
  isDuplicateTerm,
  validateExportReminderInput,
  validateProtectedTermInput,
} from "./core.ts";
import { INITIAL_TARYN_EXPORT_REMINDERS, INITIAL_TARYN_PROTECTED_TERMS } from "./initial-taryn.ts";
import { planVideoTransition } from "../productivity/core.ts";

// Wave 4 -- against the REAL generated migration chain (0000..0052). The
// "use server" actions need a Next/Cloudflare context this runner lacks, so
// write paths mirror the SQL but call the REAL validators/guards, and
// source-level pins verify the real actions/pages use them.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");
const migrationFiles = () => fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

function applyFiles(db, files) {
  for (const file of files) {
    for (const statement of fs.readFileSync(path.join(migrationsDir, file), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) db.exec(statement.trim());
    }
  }
}
function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
  applyFiles(db, migrationFiles());
  return db;
}
function seedWorld(db) {
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active'), (2, 'Dave DeMink', 'active');
           INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Mini Series', 'active'), (2, 2, 'Shorts', 'active');
           INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivered, video_kind, is_operational_container, review_url)
             VALUES (10, '2026-09-01', 'Taryn clip', 1, 1, 'IN_PROGRESS', 0, 'CLIENT_WORK', 0, 'https://frame.io/x'),
                    (11, '2026-09-01', 'Dave clip', 2, 2, 'IN_PROGRESS', 0, 'CLIENT_WORK', 0, NULL),
                    (12, '2026-09-01', 'Orphan clip', NULL, NULL, 'PLANNED', 0, 'CLIENT_WORK', 0, NULL);`);
}
function seedTaryn(db, clientId = 1) {
  for (const t of INITIAL_TARYN_PROTECTED_TERMS) db.prepare("INSERT INTO client_protected_terms (client_id, term, kind, note) VALUES (?, ?, ?, ?)").run(clientId, t.term, t.kind, t.note);
  for (const r of INITIAL_TARYN_EXPORT_REMINDERS) db.prepare("INSERT INTO client_export_reminders (client_id, text) VALUES (?, ?)").run(clientId, r.text);
}

// Mirrors getPreExportContext: the client is derived from the VIDEO ROW.
function preExportForVideo(db, videoId) {
  const row = db.prepare("SELECT client_id AS clientId FROM video_logs WHERE id = ?").get(videoId);
  if (!row) return null;
  if (row.clientId === null) return buildPreExportView({});
  return buildPreExportView({
    terms: db.prepare("SELECT id, term, kind, note FROM client_protected_terms WHERE client_id = ? ORDER BY id").all(row.clientId),
    reminders: db.prepare("SELECT id, text FROM client_export_reminders WHERE client_id = ? ORDER BY id").all(row.clientId),
    memories: db.prepare("SELECT id, name FROM client_production_memory WHERE client_id = ? ORDER BY name").all(row.clientId),
  });
}

// ── migration 0052 ──────────────────────────────────────────────────────────
test("migration 0052 is additive: only the two new tables; no existing DDL or row changes; no backfill", () => {
  const files = migrationFiles();
  const m = files.find((f) => f.startsWith("0052_"));
  assert.ok(m, "0052 exists");
  const sqlText = fs.readFileSync(path.join(migrationsDir, m), "utf8");
  // every statement is a CREATE TABLE / CREATE [UNIQUE] INDEX -- nothing else
  // (FK clauses like "ON DELETE cascade" live inside a CREATE TABLE).
  const statements = sqlText.split("--> statement-breakpoint").map((x) => x.trim()).filter(Boolean);
  assert.ok(statements.length >= 2);
  for (const statement of statements) assert.match(statement, /^CREATE (TABLE|UNIQUE INDEX|INDEX) /u, "additive only");
  const db = new DatabaseSync(":memory:");
  applyFiles(db, files.filter((f) => !f.startsWith("0052_")));
  seedWorld(db);
  const tables = () => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
  const before = { tables: tables(), clients: db.prepare("SELECT * FROM clients ORDER BY id").all(), videos: db.prepare("SELECT * FROM video_logs ORDER BY id").all(), ddl: db.prepare("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all() };
  applyFiles(db, files.filter((f) => f.startsWith("0052_")));
  assert.deepEqual(tables().filter((t) => !before.tables.includes(t)), ["client_export_reminders", "client_protected_terms"]);
  assert.deepEqual(db.prepare("SELECT * FROM clients ORDER BY id").all(), before.clients);
  assert.deepEqual(db.prepare("SELECT * FROM video_logs ORDER BY id").all(), before.videos);
  for (const row of before.ddl) assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(row.name).sql, row.sql, `${row.name} unchanged`);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM client_protected_terms").get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM client_export_reminders").get().c, 0);
});

test("table shapes: only the approved columns; reminders have NO completion/required/severity state", () => {
  const db = buildMigratedDb();
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  assert.deepEqual(cols("client_protected_terms"), ["id", "client_id", "term", "kind", "note", "created_at", "updated_at"]);
  assert.deepEqual(cols("client_export_reminders"), ["id", "client_id", "text", "created_at", "updated_at"]);
});

test("DB constraint: term kind is one of four values or NULL", () => {
  const db = buildMigratedDb();
  seedWorld(db);
  const ins = (kind) => db.prepare("INSERT INTO client_protected_terms (client_id, term, kind) VALUES (1, ?, ?)").run(`t-${String(kind)}`, kind);
  for (const ok of [null, "PERSON", "PROGRAM", "BRAND", "PHRASE"]) assert.doesNotThrow(() => ins(ok));
  for (const bad of ["COMPANY", "person", "DRAFT", "ACTIVE"]) assert.throws(() => ins(bad), /CHECK constraint/u, bad);
});

test("DB constraint: UNIQUE(client_id, term) and UNIQUE(client_id, text); other clients may reuse them", () => {
  const db = buildMigratedDb();
  seedWorld(db);
  db.prepare("INSERT INTO client_protected_terms (client_id, term) VALUES (1, 'CEO Clubhouse')").run();
  assert.throws(() => db.prepare("INSERT INTO client_protected_terms (client_id, term) VALUES (1, 'CEO Clubhouse')").run(), /UNIQUE constraint/u);
  assert.doesNotThrow(() => db.prepare("INSERT INTO client_protected_terms (client_id, term) VALUES (2, 'CEO Clubhouse')").run());
  db.prepare("INSERT INTO client_export_reminders (client_id, text) VALUES (1, 'B-roll shows the correct person.')").run();
  assert.throws(() => db.prepare("INSERT INTO client_export_reminders (client_id, text) VALUES (1, 'B-roll shows the correct person.')").run(), /UNIQUE constraint/u);
  assert.doesNotThrow(() => db.prepare("INSERT INTO client_export_reminders (client_id, text) VALUES (2, 'B-roll shows the correct person.')").run());
});

test("FK: deleting a client removes only that client's terms and reminders", () => {
  const db = buildMigratedDb();
  db.exec("PRAGMA foreign_keys = ON");
  seedWorld(db);
  seedTaryn(db, 1);
  db.prepare("INSERT INTO client_protected_terms (client_id, term) VALUES (2, 'Dave Term')").run();
  db.prepare("DELETE FROM clients WHERE id = 1").run();
  assert.equal(db.prepare("SELECT COUNT(*) c FROM client_protected_terms WHERE client_id = 1").get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM client_export_reminders WHERE client_id = 1").get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM client_protected_terms WHERE client_id = 2").get().c, 1);
});

// ── retrieval + isolation ───────────────────────────────────────────────────
test("Taryn video: sees Taryn's terms, reminders and production formats", () => {
  const db = buildMigratedDb();
  seedWorld(db);
  seedTaryn(db, 1);
  db.prepare("INSERT INTO client_production_memory (client_id, name) VALUES (1, 'Lecture Format')").run();
  const view = preExportForVideo(db, 10);
  assert.deepEqual(view.terms.map((t) => t.term), ["CEO Clubhouse", "Perfect Day Business Mentorship", "PDBM"]);
  assert.equal(view.reminders.length, 3);
  assert.deepEqual(view.memories.map((m) => m.name), ["Lecture Format"]);
  assert.equal(view.generic.length, 2);
});

test("another client's video: NO Taryn terms, reminders or production memory -- only the generic baseline", () => {
  const db = buildMigratedDb();
  seedWorld(db);
  seedTaryn(db, 1);
  db.prepare("INSERT INTO client_production_memory (client_id, name) VALUES (1, 'Lecture Format')").run();
  const view = preExportForVideo(db, 11);
  assert.deepEqual(view.terms, []);
  assert.deepEqual(view.reminders, []);
  assert.deepEqual(view.memories, []);
  assert.deepEqual(view.generic.map((g) => g.label), ["Captions / text", "Clean cut"]);
});

test("a video with no client, or a missing video, leaks nothing", () => {
  const db = buildMigratedDb();
  seedWorld(db);
  seedTaryn(db, 1);
  const orphan = preExportForVideo(db, 12);
  assert.deepEqual([orphan.terms, orphan.reminders, orphan.memories], [[], [], []]);
  assert.equal(preExportForVideo(db, 999), null);
});

test("missing vocabulary / reminders / memory for a client degrade gracefully", () => {
  const db = buildMigratedDb();
  seedWorld(db);
  db.prepare("INSERT INTO client_protected_terms (client_id, term) VALUES (1, 'Only Term')").run();
  const view = preExportForVideo(db, 10);
  assert.equal(view.terms.length, 1);
  assert.deepEqual(view.reminders, []);
  assert.deepEqual(view.memories, []);
});

// ── CRUD (real validators + guards) ────────────────────────────────────────
function createTerm(db, clientId, values) {
  const v = validateProtectedTermInput(values);
  if (!v.success) return { success: false, errors: v.errors };
  const existing = db.prepare("SELECT id, term FROM client_protected_terms WHERE client_id = ?").all(clientId);
  if (isDuplicateTerm(existing, v.data.term)) return { success: false, errors: { term: "dup" } };
  const r = db.prepare("INSERT INTO client_protected_terms (client_id, term, kind, note) VALUES (?, ?, ?, ?)").run(clientId, v.data.term, v.data.kind, v.data.note);
  return { success: true, id: Number(r.lastInsertRowid) };
}
function createReminder(db, clientId, values) {
  const v = validateExportReminderInput(values);
  if (!v.success) return { success: false, errors: v.errors };
  const existing = db.prepare("SELECT id, text FROM client_export_reminders WHERE client_id = ?").all(clientId);
  if (!canAddReminder(existing.length)) return { success: false, errors: { text: "cap" } };
  if (isDuplicateReminder(existing, v.data.text)) return { success: false, errors: { text: "dup" } };
  const r = db.prepare("INSERT INTO client_export_reminders (client_id, text) VALUES (?, ?)").run(clientId, v.data.text);
  return { success: true, id: Number(r.lastInsertRowid) };
}

test("CRUD validation: invalid input writes nothing; duplicates and the cap are rejected", () => {
  const db = buildMigratedDb();
  seedWorld(db);
  assert.equal(createTerm(db, 1, { term: "" }).success, false);
  assert.equal(createTerm(db, 1, { term: "X", kind: "COMPANY" }).success, false);
  assert.equal(createTerm(db, 1, { term: "CEO Clubhouse", kind: "PROGRAM" }).success, true);
  assert.equal(createTerm(db, 1, { term: "ceo clubhouse" }).success, false);
  for (let i = 0; i < 6; i++) assert.equal(createReminder(db, 1, { text: `r${i}` }).success, true);
  assert.equal(createReminder(db, 1, { text: "one too many" }).success, false, "cap");
  assert.equal(createReminder(db, 2, { text: "r0" }).success, true, "other client unaffected by the cap");
  assert.equal(db.prepare("SELECT COUNT(*) c FROM client_protected_terms").get().c, 1);
});

test("edit/delete are scoped by id AND client: another client's page changes nothing", () => {
  const db = buildMigratedDb();
  seedWorld(db);
  const term = createTerm(db, 1, { term: "CEO Clubhouse" });
  const rem = createReminder(db, 1, { text: "r" });
  assert.equal(Number(db.prepare("UPDATE client_protected_terms SET term = 'HACK' WHERE id = ? AND client_id = ?").run(term.id, 2).changes), 0);
  assert.equal(Number(db.prepare("DELETE FROM client_protected_terms WHERE id = ? AND client_id = ?").run(term.id, 2).changes), 0);
  assert.equal(Number(db.prepare("UPDATE client_export_reminders SET text = 'HACK' WHERE id = ? AND client_id = ?").run(rem.id, 2).changes), 0);
  assert.equal(Number(db.prepare("DELETE FROM client_export_reminders WHERE id = ? AND client_id = ?").run(rem.id, 2).changes), 0);
  assert.equal(Number(db.prepare("UPDATE client_protected_terms SET term = 'CEO Clubhouse ', updated_at = ? WHERE id = ? AND client_id = ?").run(Date.now(), term.id, 1).changes), 1);
  assert.equal(Number(db.prepare("DELETE FROM client_export_reminders WHERE id = ? AND client_id = ?").run(rem.id, 1).changes), 1);
});

// ── side effects ────────────────────────────────────────────────────────────
test("reading the pre-export view has zero side effects on statuses, sessions, sensor, billing or money", () => {
  const db = buildMigratedDb();
  seedWorld(db);
  seedTaryn(db, 1);
  const snapshot = () => JSON.stringify({
    videos: db.prepare("SELECT * FROM video_logs ORDER BY id").all(),
    ws: db.prepare("SELECT COUNT(*) c FROM work_sessions").get(),
    ss: db.prepare("SELECT COUNT(*) c FROM sensor_sessions").get(),
    be: db.prepare("SELECT COUNT(*) c FROM billing_evidence").get(),
    ba: db.prepare("SELECT COUNT(*) c FROM billing_allocations").get(),
    tx: db.prepare("SELECT COUNT(*) c FROM transactions").get(),
    pr: db.prepare("SELECT COUNT(*) c FROM payment_requests").get(),
    ev: db.prepare("SELECT COUNT(*) c FROM crm_events").get(),
    terms: db.prepare("SELECT * FROM client_protected_terms").all(),
    reminders: db.prepare("SELECT * FROM client_export_reminders").all(),
  });
  const before = snapshot();
  for (const id of [10, 11, 12, 999]) preExportForVideo(db, id);
  assert.equal(snapshot(), before);
});

test("READY_FOR_REVIEW and DONE transitions are decided without any QA input", () => {
  // planVideoTransition takes no QA data at all; a Taryn video with a full set
  // of terms/reminders and untouched reminders moves exactly as before.
  const ready = planVideoTransition({ currentStatus: "IN_PROGRESS", expectedStatus: "IN_PROGRESS", targetStatus: "READY_FOR_REVIEW", reviewUrl: "https://frame.io/x" });
  assert.equal(ready.success, true);
  assert.equal(ready.status, "READY_FOR_REVIEW");
  const done = planVideoTransition({ currentStatus: "READY_FOR_REVIEW", expectedStatus: "READY_FOR_REVIEW", targetStatus: "DONE", reviewUrl: "https://frame.io/x" });
  assert.equal(done.success, true);
  assert.equal(done.status, "DONE");
  // the pre-existing review-link rule is the ONLY gate, and it is unchanged
  const noLink = planVideoTransition({ currentStatus: "IN_PROGRESS", expectedStatus: "IN_PROGRESS", targetStatus: "READY_FOR_REVIEW", reviewUrl: null });
  assert.equal(noLink.success, false);
  assert.match(noLink.error, /review link is required/iu);
});

// ── source-level pins on the REAL code ─────────────────────────────────────
const src = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/u.test(entry) && !/\.test\./u.test(entry)) out.push(full);
  }
  return out;
}

test("operator-only: nothing on the Client Portal / gateway side references vocabulary, reminders or the surface", () => {
  const files = [...walk(path.resolve(__dirname, "../client-portal")), ...walk(path.resolve(__dirname, "../../app/client")), ...walk(path.resolve(__dirname, "../../app/g"))];
  assert.ok(files.length > 5);
  for (const file of files) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /client-qa|clientProtectedTerms|clientExportReminders|client_protected_terms|client_export_reminders|BeforeYouExport/u, file);
  }
});

test("operator-only: reads and every write authenticate", () => {
  assert.match(src("./data.ts"), /import "server-only"/u);
  assert.equal((src("./data.ts").match(/getAuthenticatedDb\(\)/gu) ?? []).length >= 2, true);
  const actions = src("./actions.ts");
  assert.match(actions, /^"use server"/u);
  assert.equal((actions.match(/await getAuthenticatedDb\(\)/gu) ?? []).length, 6, "create/update/delete x2 each authenticate");
  assert.doesNotMatch(actions, /getDb\(\)/u);
});

test("client is derived from the video row, not from a caller-supplied client id", () => {
  const data = src("./data.ts");
  assert.match(data, /getPreExportContext\(videoId: number\)/u);
  assert.match(data, /\.from\(videoLogs\)[\s\S]{0,200}\.where\(eq\(videoLogs\.id, videoId\)\)/u);
  assert.match(src("../../components/client-qa/BeforeYouExport.tsx"), /getPreExportContextForVideo\(videoId\)/u);
});

test("real actions scope edits/deletes by client and use the shared validators", () => {
  const actions = src("./actions.ts");
  assert.match(actions, /validateProtectedTermInput\(values\)/u);
  assert.match(actions, /validateExportReminderInput\(values\)/u);
  assert.match(actions, /isDuplicateTerm\(/u);
  assert.match(actions, /isDuplicateReminder\(/u);
  assert.match(actions, /canAddReminder\(/u);
  assert.match(actions, /and\(eq\(clientProtectedTerms\.id, id\), eq\(clientProtectedTerms\.clientId, clientId\)\)/u);
  assert.match(actions, /and\(eq\(clientExportReminders\.id, id\), eq\(clientExportReminders\.clientId, clientId\)\)/u);
});

test("no side-effect surface: the module never touches video status, sessions, sensor, billing or money", () => {
  for (const file of ["./data.ts", "./actions.ts", "./core.ts", "../../components/client-qa/BeforeYouExport.tsx"]) {
    const text = src(file);
    assert.doesNotMatch(text, /workSessions|sensorSessions|billingEvidence|billingAllocations|transactions|paymentRequests|crmEvents|transitionVideoStatus|planVideoTransition/u, file);
    assert.doesNotMatch(text, /\.(update|insert|delete)\(videoLogs\)/u, file);
  }
  // and the status/transition code does not know about this feature
  for (const file of ["../productivity/core.ts", "../productivity/actions.ts"]) {
    assert.doesNotMatch(src(file), /client-qa|BeforeYouExport|clientExportReminders|clientProtectedTerms/u, file);
  }
});

test("the surface is read-only and ephemeral: no checkboxes, no persistent checklist, no client storage", () => {
  const ui = src("../../components/client-qa/BeforeYouExport.tsx");
  assert.doesNotMatch(ui, /type="checkbox"|checked|onChange|<form|<button|localStorage|sessionStorage|productionChecklist|setProductionChecklistStep/u);
  assert.doesNotMatch(ui, /disabled=/u, "never disables anything");
});

test("READY_FOR_REVIEW / DONE controls are not conditioned on the surface", () => {
  const editor = src("../../app/productivity/VideoEditor.tsx");
  assert.match(editor, /<BeforeYouExport videoId=\{video\.id\} active=\{open\} \/>/u);
  // the lifecycle buttons are still driven only by allowedTransitions + isPending
  assert.match(editor, /onClick=\{\(\) => moveTo\(targetStatus\)\}\s*disabled=\{isPending\}/u);
});

test("generic baseline is static product copy: not stored in D1, not seeded, not in the migration", () => {
  const migration = fs.readFileSync(path.join(migrationsDir, migrationFiles().find((f) => f.startsWith("0052_"))), "utf8");
  assert.doesNotMatch(migration, /spelling|scuff|Captions/iu);
  const seedCode = src("./initial-taryn.ts").replace(/\/\/.*$/gmu, "");
  assert.doesNotMatch(seedCode, /spelling|scuff|Captions \/ text|Clean cut/u);
});

test("management lives in the CRM dossier only; no new page or primary navigation", () => {
  const users = walk(path.resolve(__dirname, "../..")).filter((f) => /client-qa\/actions/u.test(fs.readFileSync(f, "utf8")) && !/client-qa[\\/]actions\.ts$/u.test(f));
  for (const file of users) assert.match(file, /(crm[\\/]\[id\][\\/]ClientQaPanel|components[\\/]client-qa[\\/]BeforeYouExport)\.tsx$/u, file);
  assert.doesNotMatch(src("../../components/layout/Sidebar.tsx"), /export reminder|protected term|pre.?export/iu);
});

test("Production Memory is reused read-only: no copying into reminders, no video->format FK", () => {
  const actions = src("./actions.ts");
  assert.doesNotMatch(actions, /clientProductionMemory|production-memory\/actions/u);
  assert.doesNotMatch(fs.readFileSync(path.join(migrationsDir, migrationFiles().find((f) => f.startsWith("0052_"))), "utf8"), /production_memory|video_logs/u);
  assert.match(src("../../components/client-qa/BeforeYouExport.tsx"), /ProductionMemoryDetails/u);
});
