import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkReferenceVideo, isDuplicateMemoryName, validateProductionMemoryInput } from "./core.ts";
import { INITIAL_TARYN_PRODUCTION_MEMORY } from "./initial-taryn.ts";

// Wave 3 -- client production memory, against the REAL generated migration
// chain (0000..0051), same convention as the other module integration tests.
// The "use server" actions need a Next/Cloudflare context this runner lacks,
// so write paths are mirrored in SQL but call the REAL validators/guards;
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
function seedTwoClients(db) {
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active'), (2, 'Dave DeMink', 'active');
           INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Content Waterfall', 'active'), (2, 2, 'Shorts', 'active');
           INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivered, video_kind, is_operational_container)
             VALUES (10, '2026-09-01', 'Taryn clip', 1, 1, 'DONE', 0, 'CLIENT_WORK', 0),
                    (11, '2026-09-01', 'Dave clip', 2, 2, 'DONE', 0, 'CLIENT_WORK', 0),
                    (12, '2026-09-01', '[Container] Batch', 1, 1, 'PLANNED', 0, 'CLIENT_WORK', 1);`);
}

// Mirrors createProductionMemory: real validator + real reference/duplicate guards.
function createSql(db, clientId, values) {
  const validation = validateProductionMemoryInput(values);
  if (!validation.success) return { success: false, errors: validation.errors };
  const d = validation.data;
  const existing = db.prepare("SELECT id, name FROM client_production_memory WHERE client_id = ?").all(clientId);
  if (isDuplicateMemoryName(existing, d.name)) return { success: false, errors: { name: "dup" } };
  if (d.referenceVideoId !== null) {
    const row = db.prepare("SELECT client_id AS clientId, is_operational_container AS c FROM video_logs WHERE id = ?").get(d.referenceVideoId);
    const err = checkReferenceVideo(row ? { clientId: row.clientId, isOperationalContainer: !!row.c } : null, clientId);
    if (err) return { success: false, errors: { referenceVideoId: err } };
  }
  const r = db.prepare(
    `INSERT INTO client_production_memory (client_id, name, use_case, status, approval_evidence, preference_notes, recipe_notes, template_location, reference_video_id, reference_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(clientId, d.name, d.useCase, d.status, d.approvalEvidence, d.preferenceNotes, d.recipeNotes, d.templateLocation, d.referenceVideoId, d.referenceUrl);
  return { success: true, id: Number(r.lastInsertRowid) };
}

// ── migration ───────────────────────────────────────────────────────────────
test("migration 0051 is additive: existing tables and rows are unchanged", () => {
  const files = migrationFiles();
  assert.ok(files.some((f) => f.startsWith("0051_")), "0051 exists");
  const db = new DatabaseSync(":memory:");
  applyFiles(db, files.filter((f) => !f.startsWith("0051_")));
  seedTwoClients(db);
  const tables = () => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
  const before = { tables: tables(), clients: db.prepare("SELECT * FROM clients ORDER BY id").all(), videos: db.prepare("SELECT * FROM video_logs ORDER BY id").all(), schema: db.prepare("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all() };
  applyFiles(db, files.filter((f) => f.startsWith("0051_")));
  const after = tables();
  assert.deepEqual(after.filter((t) => !before.tables.includes(t)), ["client_production_memory"]);
  assert.deepEqual(before.tables.filter((t) => !after.includes(t)), []);
  assert.deepEqual(db.prepare("SELECT * FROM clients ORDER BY id").all(), before.clients);
  assert.deepEqual(db.prepare("SELECT * FROM video_logs ORDER BY id").all(), before.videos);
  // every pre-existing table's DDL is byte-identical
  for (const row of before.schema) {
    assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(row.name).sql, row.sql, `${row.name} unchanged`);
  }
  assert.equal(db.prepare("SELECT COUNT(*) c FROM client_production_memory").get().c, 0, "new table starts empty (no backfill)");
});

test("table shape: only the approved columns exist", () => {
  const db = buildMigratedDb();
  const cols = db.prepare("PRAGMA table_info(client_production_memory)").all().map((c) => c.name);
  assert.deepEqual(cols, ["id", "client_id", "name", "use_case", "status", "approval_evidence", "preference_notes", "recipe_notes", "template_location", "reference_video_id", "reference_url", "created_at", "updated_at"]);
});

test("DB constraint: status is one of the four values or NULL", () => {
  const db = buildMigratedDb();
  seedTwoClients(db);
  const ins = (status) => db.prepare("INSERT INTO client_production_memory (client_id, name, status) VALUES (1, ?, ?)").run(`n-${String(status)}`, status);
  for (const ok of [null, "OBSERVED", "OPERATOR_CONVENTION", "CLIENT_APPROVED", "HISTORICAL"]) assert.doesNotThrow(() => ins(ok));
  for (const bad of ["DRAFT", "ACTIVE", "ARCHIVED", "READY", "DELIVERED", "approved"]) assert.throws(() => ins(bad), /CHECK constraint/u, bad);
});

test("DB constraint: UNIQUE(client_id, name); the same name is fine for another client", () => {
  const db = buildMigratedDb();
  seedTwoClients(db);
  db.prepare("INSERT INTO client_production_memory (client_id, name) VALUES (1, 'Lecture Format')").run();
  assert.throws(() => db.prepare("INSERT INTO client_production_memory (client_id, name) VALUES (1, 'Lecture Format')").run(), /UNIQUE constraint/u);
  assert.doesNotThrow(() => db.prepare("INSERT INTO client_production_memory (client_id, name) VALUES (2, 'Lecture Format')").run());
});

test("FK behaviour: deleting the reference video keeps the memory; deleting the client removes its memories", () => {
  const db = buildMigratedDb();
  db.exec("PRAGMA foreign_keys = ON");
  seedTwoClients(db);
  db.prepare("INSERT INTO client_production_memory (client_id, name, reference_video_id) VALUES (1, 'A', 10)").run();
  db.prepare("DELETE FROM video_logs WHERE id = 10").run();
  const row = db.prepare("SELECT reference_video_id AS v FROM client_production_memory WHERE name = 'A'").get();
  assert.equal(row.v, null, "SET NULL keeps the memory");
  db.prepare("DELETE FROM clients WHERE id = 1").run();
  assert.equal(db.prepare("SELECT COUNT(*) c FROM client_production_memory WHERE client_id = 1").get().c, 0);
});

// ── behaviour ───────────────────────────────────────────────────────────────
test("create with only a name works; unknowns stay NULL", () => {
  const db = buildMigratedDb();
  seedTwoClients(db);
  const out = createSql(db, 1, { name: "Bare Format" });
  assert.equal(out.success, true);
  const row = db.prepare("SELECT * FROM client_production_memory WHERE id = ?").get(out.id);
  for (const col of ["use_case", "status", "approval_evidence", "preference_notes", "recipe_notes", "template_location", "reference_video_id", "reference_url", "updated_at"]) {
    assert.equal(row[col], null, col);
  }
});

test("cross-client reference video is rejected; own video and unknown video handled", () => {
  const db = buildMigratedDb();
  seedTwoClients(db);
  assert.equal(createSql(db, 1, { name: "Own", referenceVideoId: 10 }).success, true);
  const cross = createSql(db, 1, { name: "Cross", referenceVideoId: 11 });
  assert.equal(cross.success, false);
  assert.match(cross.errors.referenceVideoId, /different client/u);
  assert.match(createSql(db, 1, { name: "Ghost", referenceVideoId: 999 }).errors.referenceVideoId, /doesn't exist/u);
  assert.match(createSql(db, 1, { name: "Box", referenceVideoId: 12 }).errors.referenceVideoId, /container/u);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM client_production_memory").get().c, 1, "rejected creates wrote nothing");
});

test("duplicate name for the same client is rejected before the DB; other client may reuse it", () => {
  const db = buildMigratedDb();
  seedTwoClients(db);
  assert.equal(createSql(db, 1, { name: "Lecture Format" }).success, true);
  assert.equal(createSql(db, 1, { name: "lecture format" }).success, false);
  assert.equal(createSql(db, 2, { name: "Lecture Format" }).success, true);
});

test("client isolation: a client's read sees only its own memories", () => {
  const db = buildMigratedDb();
  seedTwoClients(db);
  createSql(db, 1, { name: "Taryn only" });
  createSql(db, 2, { name: "Dave only" });
  const read = (id) => db.prepare("SELECT name FROM client_production_memory WHERE client_id = ? ORDER BY name").all(id).map((r) => r.name);
  assert.deepEqual(read(1), ["Taryn only"]);
  assert.deepEqual(read(2), ["Dave only"]);
});

test("edit (scoped by id AND clientId) and delete change only the intended row", () => {
  const db = buildMigratedDb();
  seedTwoClients(db);
  const a = createSql(db, 1, { name: "A", status: "OBSERVED" });
  const b = createSql(db, 2, { name: "B" });
  // an edit attempted through the wrong client matches nothing
  const wrong = db.prepare("UPDATE client_production_memory SET name = 'HACK' WHERE id = ? AND client_id = ?").run(a.id, 2);
  assert.equal(Number(wrong.changes), 0);
  db.prepare("UPDATE client_production_memory SET status = 'OPERATOR_CONVENTION', updated_at = ? WHERE id = ? AND client_id = ?").run(Date.now(), a.id, 1);
  assert.equal(db.prepare("SELECT status FROM client_production_memory WHERE id = ?").get(a.id).status, "OPERATOR_CONVENTION");
  const wrongDelete = db.prepare("DELETE FROM client_production_memory WHERE id = ? AND client_id = ?").run(a.id, 2);
  assert.equal(Number(wrongDelete.changes), 0);
  db.prepare("DELETE FROM client_production_memory WHERE id = ? AND client_id = ?").run(a.id, 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM client_production_memory").get().c, 1);
  assert.equal(db.prepare("SELECT name FROM client_production_memory WHERE id = ?").get(b.id).name, "B");
});

test("the three Taryn records: exact statuses, evidence, and NOTHING guessed", () => {
  const db = buildMigratedDb();
  seedTwoClients(db);
  assert.equal(INITIAL_TARYN_PRODUCTION_MEMORY.length, 3);
  for (const record of INITIAL_TARYN_PRODUCTION_MEMORY) assert.equal(createSql(db, 1, record).success, true, record.name);
  const rows = Object.fromEntries(db.prepare("SELECT * FROM client_production_memory WHERE client_id = 1").all().map((r) => [r.name, r]));
  assert.deepEqual(Object.keys(rows).sort(), ["Client Success Format", "Content Waterfall", "Lecture Format"]);
  assert.equal(rows["Content Waterfall"].status, "OPERATOR_CONVENTION");
  assert.equal(rows["Lecture Format"].status, "CLIENT_APPROVED");
  assert.equal(rows["Client Success Format"].status, "OBSERVED");
  assert.match(rows["Lecture Format"].approval_evidence, /in the vault as the lecture format/u);
  assert.match(rows["Lecture Format"].preference_notes, /Black.*White text box.*black bold text.*Rounded/isu);
  assert.match(rows["Client Success Format"].preference_notes, /Teal/u);
  for (const row of Object.values(rows)) {
    assert.equal(row.template_location, null, `${row.name}: no guessed template location`);
    assert.equal(row.reference_video_id, null, `${row.name}: no guessed reference video`);
    assert.equal(row.reference_url, null, `${row.name}: no guessed reference url`);
  }
  assert.equal(rows["Content Waterfall"].approval_evidence, null, "operator convention is not claimed as approved");
  assert.equal(rows["Client Success Format"].approval_evidence, null, "no approval evidenced");
  // job-specific project-15 URLs are not copied into the reusable record
  for (const row of Object.values(rows)) assert.doesNotMatch(JSON.stringify(row), /youtube\.com|notion\.com|https?:\/\//iu);
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

test("operator-only: nothing on the Client Portal side can reach production memory", () => {
  const portalFiles = [...walk(path.resolve(__dirname, "../client-portal")), ...walk(path.resolve(__dirname, "../../app/client")), ...walk(path.resolve(__dirname, "../../app/g"))];
  assert.ok(portalFiles.length > 5);
  for (const file of portalFiles) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /production-memory|clientProductionMemory|client_production_memory|FormatsForClient/u, `${file} must not reference production memory`);
  }
});

test("operator-only: reads and writes both require the operator session", () => {
  assert.match(src("./data.ts"), /import "server-only"/u);
  assert.equal((src("./data.ts").match(/getAuthenticatedDb\(\)/gu) ?? []).length >= 2, true);
  const actions = src("./actions.ts");
  assert.match(actions, /^"use server"/u);
  assert.equal((actions.match(/await getAuthenticatedDb\(\)/gu) ?? []).length, 3, "create, update, delete each authenticate");
  assert.doesNotMatch(actions, /getDb\(\)/u, "no unauthenticated DB access");
});

test("real actions scope every write by client and use the shared validators", () => {
  const actions = src("./actions.ts");
  assert.match(actions, /validateProductionMemoryInput\(values\)/u);
  assert.match(actions, /checkReferenceVideo\(/u);
  assert.match(actions, /isDuplicateMemoryName\(/u);
  assert.match(actions, /and\(eq\(clientProductionMemory\.id, id\), eq\(clientProductionMemory\.clientId, clientId\)\)/u);
});

test("hot path: Project and Production Order pages read the client's memory by their own clientId", () => {
  const project = src("../../app/projects/[id]/page.tsx");
  const order = src("../../app/productivity/orders/[id]/page.tsx");
  assert.match(project, /getProductionMemoryForClient\(project\.clientId\)/u);
  assert.match(project, /<FormatsForClient clientId=\{project\.clientId\}/u);
  assert.match(order, /getProductionMemoryForClient\(order\.clientId\)/u);
  assert.match(order, /<FormatsForClient clientId=\{order\.clientId\}/u);
});

test("no duplicated ownership: the hot-path component is read-only and the editor lives only in the CRM dossier", () => {
  const formats = src("../../components/production-memory/FormatsForClient.tsx");
  assert.doesNotMatch(formats, /actions|ProductionMemoryEditor|"use client"/u);
  assert.match(formats, /\/crm\/\$\{clientId\}#production-memory/u);
  const users = walk(path.resolve(__dirname, "../..")).filter((f) => /production-memory\/actions|ProductionMemoryEditor/u.test(fs.readFileSync(f, "utf8")) && !/production-memory[\\/]actions\.ts$/u.test(f));
  for (const file of users) assert.match(file, /crm[\\/]\[id\][\\/]ProductionMemory(Editor|Panel)\.tsx$/u, `${file} must not manage memories`);
  // the batch/video/project/order tables do not grow recipe columns
  const schema = src("../../db/schema.ts");
  assert.doesNotMatch(schema, /recipeNotes[\s\S]{0,40}productionOrders/u);
});

test("no new primary navigation: the sidebar has no Vault / Recipes / Knowledge entry", () => {
  const sidebar = src("../../components/layout/Sidebar.tsx");
  assert.doesNotMatch(sidebar, /production.?memory|recipe|knowledge base|asset library/iu);
  assert.doesNotMatch(sidebar, /["'`]Vault["'`]/u);
});

test("hot path never gates work: no confirmation or redirect is introduced in the pages", () => {
  const formats = src("../../components/production-memory/FormatsForClient.tsx");
  assert.doesNotMatch(formats, /redirect\(|confirm\(|required/u);
  assert.match(formats, /if \(memories\.length === 0\) return null/u);
});
