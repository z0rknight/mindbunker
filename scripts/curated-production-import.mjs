#!/usr/bin/env node

/**
 * MindBunker curated production importer.
 *
 * This is intentionally NOT a general database copier. It only reads the
 * explicit 2026-08-24 allow-list and never updates, deletes, truncates, fuzzy
 * matches, or silently remaps an ID.
 *
 * Safe checkpoint validation (no network, no writes):
 *   node scripts/curated-production-import.mjs --local-db /absolute/local.sqlite --local-only-validate
 *
 * Later production preparation (remote reads only, SQL emitted outside repo):
 *   node scripts/curated-production-import.mjs --local-db /absolute/local.sqlite \
 *     --prepare-sql /tmp/mindbunker-curated-import.sql
 *
 * Later application (NOT authorized by the checkpoint that created this file):
 *   node scripts/curated-production-import.mjs --local-db /absolute/local.sqlite \
 *     --apply --confirm-production a2511426086f83bc2d6031478dbf2e69/d6ada5db-1f36-4ee9-9a05-01d131abf219/0023
 */

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const MANIFEST_PATH = resolve(REPO_ROOT, "ops/curated-import-2026-08-24.manifest.json");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

const TABLE_SPECS = {
  projects: {
    columns: ["id", "client_id", "name", "status", "deadline", "notes", "created_at", "updated_at"],
    transform(row, entry) {
      return { ...row, id: entry.targetId, client_id: mapClient(row.client_id) };
    },
  },
  video_logs: {
    columns: [
      "id", "date", "title", "client_id", "project_id", "status", "started_at",
      "revisions_count", "delivered", "delivery_url", "notes", "cover_url",
      "orientation", "content_type", "created_at", "updated_at", "review_url",
      "published_url", "batch_label",
    ],
    transform(row, entry) {
      return {
        ...row,
        id: entry.targetId,
        client_id: mapClient(row.client_id),
        project_id: mapProject(row.project_id),
      };
    },
  },
  assets: {
    columns: [
      "id", "project_id", "video_id", "name", "type", "status", "review_url",
      "delivery_url", "published_url", "thumbnail_url", "delivered_at", "notes",
      "source", "created_at", "updated_at",
    ],
    transform(row, entry) {
      return {
        ...row,
        id: entry.targetId,
        project_id: mapProject(row.project_id),
        video_id: row.video_id == null ? null : mapVideo(row.video_id),
      };
    },
  },
  source_media_references: {
    columns: ["id", "project_id", "approx_size_label", "location", "profile", "notes", "created_at", "source_url"],
    transform(row, entry) {
      return { ...row, id: entry.targetId, project_id: mapProject(row.project_id) };
    },
  },
  commercial_contracts: {
    columns: [
      "id", "client_id", "platform", "external_reference", "billing_type",
      "hourly_rate", "currency", "status", "notes", "created_at", "updated_at",
    ],
    transform(row, entry) {
      return { ...row, id: entry.targetId, client_id: mapClient(row.client_id) };
    },
  },
  debts: {
    columns: ["id", "name", "creditor", "original_amount", "currency", "notes", "status", "created_at"],
    transform(row, entry) { return { ...row, id: entry.targetId }; },
  },
  subscriptions: {
    columns: [
      "id", "name", "vendor", "amount", "currency", "cadence", "renewal_date",
      "status", "category", "notes", "created_at",
    ],
    transform(row, entry) { return { ...row, id: entry.targetId }; },
  },
  transactions: {
    columns: [
      "id", "type", "amount", "category", "date", "notes", "currency",
      "billing_evidence_id", "client_id", "contract_id", "debt_id",
      "subscription_id", "created_at", "idempotency_key",
    ],
    transform(row, entry) {
      return {
        ...row,
        id: entry.targetId,
        client_id: row.client_id == null ? null : mapClient(row.client_id),
        contract_id: row.contract_id == null ? null : mapSimple("commercial_contracts", row.contract_id),
        debt_id: row.debt_id == null ? null : mapSimple("debts", row.debt_id),
        subscription_id: row.subscription_id == null ? null : mapSimple("subscriptions", row.subscription_id),
        idempotency_key: entry.idempotencyKey,
      };
    },
  },
};

const args = parseArgs(process.argv.slice(2));

function fail(message) {
  throw new Error(`CURATED IMPORT ABORTED: ${message}`);
}

function parseArgs(argv) {
  const parsed = { localOnly: false, apply: false, printHashes: false, localDb: null, prepareSql: null, confirmation: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--local-only-validate") parsed.localOnly = true;
    else if (arg === "--apply") parsed.apply = true;
    else if (arg === "--print-source-hashes") parsed.printHashes = true;
    else if (arg === "--local-db") parsed.localDb = argv[++index];
    else if (arg === "--prepare-sql") parsed.prepareSql = argv[++index];
    else if (arg === "--confirm-production") parsed.confirmation = argv[++index];
    else fail(`unknown argument ${arg}`);
  }
  if (!parsed.localDb) fail("--local-db with an absolute SQLite path is required");
  if (!isAbsolute(parsed.localDb)) fail("--local-db must be absolute");
  if (!parsed.localOnly && !parsed.prepareSql && !parsed.apply && !parsed.printHashes) {
    fail("choose --local-only-validate, --print-source-hashes, --prepare-sql, or --apply");
  }
  if (parsed.apply && parsed.prepareSql) fail("--apply and --prepare-sql are mutually exclusive");
  return parsed;
}

function sourceEntries(table) {
  const entries = manifest.imports[table];
  if (!Array.isArray(entries) || entries.length === 0) fail(`manifest has no allow-list for ${table}`);
  return entries;
}

function mapSimple(table, sourceId) {
  const entry = manifest.imports[table]?.find((candidate) => candidate.sourceId === sourceId);
  if (!entry) fail(`no approved ${table} mapping for local id ${sourceId}`);
  return entry.targetId;
}

function mapClient(sourceId) {
  const mapping = manifest.alreadyExistsProduction.find(
    (entry) => entry.table === "clients" && entry.localId === sourceId,
  );
  if (!mapping) fail(`no approved client mapping for local id ${sourceId}`);
  return mapping.productionId;
}

function mapProject(sourceId) {
  const existing = manifest.alreadyExistsProduction.find(
    (entry) => entry.table === "projects" && entry.localId === sourceId,
  );
  return existing?.productionId ?? mapSimple("projects", sourceId);
}

function mapVideo(sourceId) {
  const existing = manifest.alreadyExistsProduction.find(
    (entry) => entry.table === "video_logs" && entry.localId === sourceId,
  );
  return existing?.productionId ?? mapSimple("video_logs", sourceId);
}

function openLocalDatabase() {
  if (!existsSync(args.localDb)) fail(`local database does not exist: ${args.localDb}`);
  return new DatabaseSync(realpathSync(args.localDb), { readOnly: true });
}

function selectAllowListedRows(db, table) {
  const spec = TABLE_SPECS[table];
  if (!spec) fail(`no table spec for ${table}`);
  const entries = sourceEntries(table);
  const ids = entries.map((entry) => entry.sourceId);
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT ${spec.columns.map(quoteIdentifier).join(",")} FROM ${quoteIdentifier(table)} WHERE id IN (${placeholders}) ORDER BY id`,
  ).all(...ids);
  if (rows.length !== entries.length) fail(`${table}: expected ${entries.length} allow-listed rows, found ${rows.length}`);
  for (const entry of entries) {
    if (!rows.some((row) => row.id === entry.sourceId)) fail(`${table}: missing allow-listed local id ${entry.sourceId}`);
  }
  return rows;
}

function sourceFingerprint(rows) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function validateLocalSource() {
  const db = openLocalDatabase();
  const sourceRows = {};
  try {
    for (const table of Object.keys(TABLE_SPECS)) {
      const rows = selectAllowListedRows(db, table);
      const fingerprint = sourceFingerprint(rows);
      sourceRows[table] = rows;
      if (args.printHashes) continue;
      const expected = manifest.sourceFingerprints[table];
      if (!expected || expected === "PENDING") fail(`${table}: source fingerprint has not been frozen`);
      if (fingerprint !== expected) fail(`${table}: local allow-listed data changed (${fingerprint} != ${expected})`);
    }
  } finally {
    db.close();
  }
  return sourceRows;
}

function expectedProductionRows(sourceRows) {
  const expected = {};
  for (const [table, spec] of Object.entries(TABLE_SPECS)) {
    expected[table] = sourceEntries(table).map((entry) => {
      const source = sourceRows[table].find((row) => row.id === entry.sourceId);
      if (!source) fail(`${table}: source row ${entry.sourceId} disappeared`);
      return spec.transform(source, entry);
    });
  }
  return expected;
}

function runWranglerQuery(sql) {
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", manifest.production.databaseName, "--remote", "--config", "wrangler.jsonc", "--json", "--command", sql],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.status !== 0) fail(`remote read failed: ${result.stderr || result.stdout}`);
  let payload;
  try { payload = JSON.parse(result.stdout); } catch { fail(`could not parse Wrangler JSON: ${result.stdout}`); }
  const records = Array.isArray(payload) ? payload : [payload];
  if (records.some((record) => record.success === false || record.error)) fail(`remote query failed: ${result.stdout}`);
  return records.flatMap((record) => record.results ?? []);
}

function assertSubset(actual, expected, context) {
  if (!actual) fail(`${context}: required production row is absent`);
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) fail(`${context}: ${key} changed (${JSON.stringify(actual[key])} != ${JSON.stringify(value)})`);
  }
}

function rowsEqual(actual, expected, columns) {
  return columns.every((column) => actual[column] === expected[column]);
}

function validateRemote(expectedRows) {
  const ledger = runWranglerQuery("SELECT name FROM d1_migrations ORDER BY id;").map((row) => row.name);
  if (JSON.stringify(ledger) !== JSON.stringify(manifest.production.requiredMigrations)) {
    fail(`remote migration ledger is not exactly 0000-0023: ${ledger.join(",")}`);
  }

  for (const entry of manifest.alreadyExistsProduction) {
    const columns = ["id", ...Object.keys(entry.expected)];
    const row = runWranglerQuery(
      `SELECT ${columns.map(quoteIdentifier).join(",")} FROM ${quoteIdentifier(entry.table)} WHERE id=${sqlLiteral(entry.productionId)};`,
    )[0];
    assertSubset(row, { id: entry.productionId, ...entry.expected }, `${entry.table} ${entry.productionId}`);
  }

  const state = {};
  for (const [table, expected] of Object.entries(expectedRows)) {
    const columns = TABLE_SPECS[table].columns;
    const targetIds = expected.map((row) => row.id);
    const found = runWranglerQuery(
      `SELECT ${columns.map(quoteIdentifier).join(",")} FROM ${quoteIdentifier(table)} WHERE id IN (${targetIds.map(sqlLiteral).join(",")}) ORDER BY id;`,
    );
    for (const row of found) {
      const intended = expected.find((candidate) => candidate.id === row.id);
      if (!intended || !rowsEqual(row, intended, columns)) fail(`${table} id ${row.id} is occupied by conflicting data`);
    }
    state[table] = { found, missing: expected.filter((row) => !found.some((candidate) => candidate.id === row.id)) };
  }

  const sequences = Object.fromEntries(
    runWranglerQuery("SELECT name,seq FROM sqlite_sequence ORDER BY name;").map((row) => [row.name, row.seq]),
  );
  for (const [table, tableState] of Object.entries(state)) {
    const sequence = sequences[table] ?? 0;
    for (const row of tableState.missing) {
      if (sequence >= row.id) fail(`${table} target id ${row.id} was previously issued (sqlite_sequence=${sequence})`);
    }
  }

  const exactProjectNames = expectedRows.projects.map((row) => row.name);
  const projectNameRows = runWranglerQuery(
    `SELECT id,name FROM projects WHERE client_id=2 AND name IN (${exactProjectNames.map(sqlLiteral).join(",")});`,
  );
  for (const row of projectNameRows) {
    if (!expectedRows.projects.some((candidate) => candidate.id === row.id && candidate.name === row.name)) {
      fail(`project exact-name duplicate exists at unexpected id ${row.id}: ${row.name}`);
    }
  }

  for (const projectId of [...new Set(expectedRows.video_logs.map((row) => row.project_id))]) {
    const intended = expectedRows.video_logs.filter((row) => row.project_id === projectId);
    const matches = runWranglerQuery(
      `SELECT id,title FROM video_logs WHERE project_id=${sqlLiteral(projectId)} AND title IN (${intended.map((row) => sqlLiteral(row.title)).join(",")});`,
    );
    for (const row of matches) {
      if (!intended.some((candidate) => candidate.id === row.id && candidate.title === row.title)) {
        fail(`video exact-title duplicate exists at unexpected id ${row.id}: ${row.title}`);
      }
    }
  }

  const transactionKey = expectedRows.transactions[0].idempotency_key;
  const transactionKeyRows = runWranglerQuery(
    `SELECT id,idempotency_key FROM transactions WHERE idempotency_key=${sqlLiteral(transactionKey)};`,
  );
  for (const row of transactionKeyRows) {
    if (row.id !== expectedRows.transactions[0].id) fail(`transaction idempotency key already belongs to id ${row.id}`);
  }

  for (const [table, baseline] of Object.entries(manifest.production.expectedBefore)) {
    const count = runWranglerQuery(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)};`)[0]?.count;
    const alreadyImported = state[table]?.found.length ?? 0;
    if (count !== baseline + alreadyImported) {
      fail(`${table}: unexpected count ${count}; expected ${baseline + alreadyImported}`);
    }
  }

  return state;
}

function buildSql(expectedRows, state) {
  const statements = [
    "-- Generated by scripts/curated-production-import.mjs",
    "-- Inserts only. No UPDATE, DELETE, TRUNCATE, fuzzy match, or implicit remap.",
  ];
  for (const [table, rows] of Object.entries(expectedRows)) {
    const columns = TABLE_SPECS[table].columns;
    const missingIds = new Set(state[table].missing.map((row) => row.id));
    for (const row of rows) {
      if (!missingIds.has(row.id)) continue;
      statements.push(
        `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(",")}) ` +
        `SELECT ${columns.map((column) => sqlLiteral(row[column])).join(",")} ` +
        `WHERE NOT EXISTS (SELECT 1 FROM ${quoteIdentifier(table)} WHERE id=${sqlLiteral(row.id)});`,
      );
    }
  }
  return `${statements.join("\n")}\n`;
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) fail(`unsafe SQL identifier ${value}`);
  return `\"${value}\"`;
}

function sqlLiteral(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("non-finite numeric SQL value");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function ensureOutputOutsideRepository(path) {
  const absolute = resolve(path);
  const relation = relative(REPO_ROOT, absolute);
  if (!isAbsolute(path)) fail("--prepare-sql path must be absolute");
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) {
    fail("generated production SQL must be written outside the repository");
  }
  return absolute;
}

function applySql(sql) {
  const requiredConfirmation = `${manifest.production.accountId}/${manifest.production.databaseId}/0023`;
  if (args.confirmation !== requiredConfirmation) fail(`--confirm-production must equal ${requiredConfirmation}`);
  const directory = mkdtempSync(join(tmpdir(), "mindbunker-curated-import-"));
  const sqlPath = join(directory, "curated-import.sql");
  try {
    writeFileSync(sqlPath, sql, { encoding: "utf8", flag: "wx", mode: 0o600 });
    const result = spawnSync(
      "npx",
      ["wrangler", "d1", "execute", manifest.production.databaseName, "--remote", "--config", "wrangler.jsonc", "--file", sqlPath],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: "inherit" },
    );
    if (result.status !== 0) fail(`Wrangler import exited with status ${result.status}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function main() {
  const sourceRows = validateLocalSource();
  if (args.printHashes) {
    const hashes = Object.fromEntries(Object.entries(sourceRows).map(([table, rows]) => [table, sourceFingerprint(rows)]));
    console.log(JSON.stringify(hashes, null, 2));
    return;
  }

  const expectedRows = expectedProductionRows(sourceRows);
  console.log(`Local allow-list validated: ${Object.values(expectedRows).reduce((sum, rows) => sum + rows.length, 0)} rows.`);
  if (args.localOnly) {
    console.log("LOCAL-ONLY validation complete. No network or database write was attempted.");
    return;
  }

  const state = validateRemote(expectedRows);
  const sql = buildSql(expectedRows, state);
  const inserts = Object.values(state).reduce((sum, table) => sum + table.missing.length, 0);
  console.log(`Remote preflight green. ${inserts} allow-listed rows require insertion.`);

  if (args.prepareSql) {
    const output = ensureOutputOutsideRepository(args.prepareSql);
    writeFileSync(output, sql, { encoding: "utf8", flag: "wx", mode: 0o600 });
    console.log(`Prepared SQL outside repository: ${output}`);
    return;
  }

  if (args.apply) {
    applySql(sql);
    validateRemote(expectedRows);
    console.log("Curated import applied and verified. Re-run is idempotent.");
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
