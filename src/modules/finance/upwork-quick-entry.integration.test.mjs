import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Sep 16 Operational Reality Patch: getTodayUpworkRegisteredMinutes
// (modules/finance/actions.ts) must sum only the quick-registered rows a
// same-day "Register Upwork time" entry produces (periodStart = periodEnd
// = today), never a multi-day CSV/report import that merely overlaps
// today -- that distinction is what keeps this daily figure honest.
// Mirrors the real SELECT against the real migration chain, matching this
// repo's established integration-test convention (see
// today-income.integration.test.mjs).

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

// Verbatim mirror of getTodayUpworkRegisteredMinutes's SELECT.
function selectTodayUpworkRegisteredMinutes(db, today) {
  const row = db
    .prepare(
      `SELECT SUM(billable_minutes) as total
       FROM billing_evidence
       WHERE period_start = ? AND period_end = ?`,
    )
    .get(today, today);
  return Number(row?.total ?? 0);
}

function seedContractAndClient(db, { clientId = 1, clientName = "Taryn Dubreuil", contractId = 1 } = {}) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (${clientId}, '${clientName}', 'active');
    INSERT INTO commercial_contracts (id, client_id, platform, billing_type, hourly_rate, currency, status)
    VALUES (${contractId}, ${clientId}, 'Upwork', 'HOURLY', 25, 'USD', 'ACTIVE');
  `);
}

test("a day with no quick-registered Upwork evidence returns zero, not a fabricated figure", () => {
  const db = buildMigratedDb();
  seedContractAndClient(db);
  const result = selectTodayUpworkRegisteredMinutes(db, "2026-09-16");
  assert.equal(result, 0);
  db.close();
});

test("one same-day entry is returned as its own real minute total", () => {
  const db = buildMigratedDb();
  seedContractAndClient(db);
  db.exec(`
    INSERT INTO billing_evidence
      (contract_id, period_start, period_end, billable_minutes, rate, gross_amount, currency, source, idempotency_key)
    VALUES (1, '2026-09-16', '2026-09-16', 130, 25, 54.17, 'USD', 'MANUAL', 'key-1');
  `);
  const result = selectTodayUpworkRegisteredMinutes(db, "2026-09-16");
  assert.equal(result, 130);
  db.close();
});

test("same-day entries across different clients/contracts are summed together", () => {
  const db = buildMigratedDb();
  seedContractAndClient(db, { clientId: 1, clientName: "Taryn Dubreuil", contractId: 1 });
  seedContractAndClient(db, { clientId: 2, clientName: "Dave DeMink", contractId: 2 });
  db.exec(`
    INSERT INTO billing_evidence
      (contract_id, period_start, period_end, billable_minutes, rate, gross_amount, currency, source, idempotency_key)
    VALUES
      (1, '2026-09-16', '2026-09-16', 130, 25, 54.17, 'USD', 'MANUAL', 'key-1'),
      (2, '2026-09-16', '2026-09-16', 60, 25, 25, 'USD', 'MANUAL', 'key-2');
  `);
  const result = selectTodayUpworkRegisteredMinutes(db, "2026-09-16");
  assert.equal(result, 190);
  db.close();
});

test("a multi-day report that merely overlaps today is excluded -- only an exact-today period counts", () => {
  const db = buildMigratedDb();
  seedContractAndClient(db);
  db.exec(`
    INSERT INTO billing_evidence
      (contract_id, period_start, period_end, billable_minutes, rate, gross_amount, currency, source, idempotency_key)
    VALUES (1, '2026-09-14', '2026-09-20', 2400, 25, 1000, 'USD', 'UPWORK_REPORT', 'week-report');
  `);
  const result = selectTodayUpworkRegisteredMinutes(db, "2026-09-16");
  assert.equal(result, 0, "a weekly UPWORK_REPORT import must not be counted as if it were today's quick entry");
  db.close();
});

test("an entry registered on a different day never leaks into today's total", () => {
  const db = buildMigratedDb();
  seedContractAndClient(db);
  db.exec(`
    INSERT INTO billing_evidence
      (contract_id, period_start, period_end, billable_minutes, rate, gross_amount, currency, source, idempotency_key)
    VALUES (1, '2026-09-15', '2026-09-15', 90, 25, 37.5, 'USD', 'MANUAL', 'key-yesterday');
  `);
  const result = selectTodayUpworkRegisteredMinutes(db, "2026-09-16");
  assert.equal(result, 0);
  db.close();
});
