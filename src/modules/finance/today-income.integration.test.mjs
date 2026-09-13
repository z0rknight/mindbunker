import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Sunday QA Patch — Bug 2 regression coverage: "Faturado hoje" on the
// Dashboard must render "—" on a day with no recorded income, never a
// fabricated "$0.00" (which would falsely imply a real zero-valued
// transaction) and never infer a value from tracked Work Session time.
// Mirrors getTodayIncomeByCurrency's exact SQL (modules/finance/actions.ts)
// against the real migration chain, matching this repo's existing
// integration-test convention (see taryn-ingest-readiness.integration.test.mjs).

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

// Verbatim mirror of getTodayIncomeByCurrency's SELECT.
function selectTodayIncomeByCurrency(db, today) {
  return db
    .prepare(
      `SELECT currency, SUM(amount) as amount
       FROM transactions
       WHERE type = 'income' AND date = ?
       GROUP BY currency
       ORDER BY currency`,
    )
    .all(today)
    .map((row) => ({ currency: row.currency, amount: Number(row.amount ?? 0) }));
}

test("a day with zero recorded income transactions returns an empty array, not a fabricated zero row", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    -- income recorded on a DIFFERENT day only -- today itself has nothing.
    INSERT INTO transactions (id, type, amount, currency, date, client_id, category)
    VALUES (1, 'income', 200, 'USD', '2026-09-10', 1, 'client_payment');
  `);

  const result = selectTodayIncomeByCurrency(db, "2026-09-13");
  assert.deepEqual(result, [], "must be empty -- the Dashboard's `.length > 0 ? ... : \"—\"` guard depends on this, not on amount === 0");
  db.close();
});

test("a real income transaction today is returned with its real amount, never omitted or zeroed", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Dave DeMink', 'active');
    INSERT INTO transactions (id, type, amount, currency, date, client_id, category)
    VALUES (1, 'income', 450, 'USD', '2026-09-13', 1, 'client_payment');
  `);

  const result = selectTodayIncomeByCurrency(db, "2026-09-13");
  assert.deepEqual(result, [{ currency: "USD", amount: 450 }]);
  db.close();
});

test("multiple currencies on the same day are grouped separately, never summed together", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active'), (2, 'Dave DeMink', 'active');
    INSERT INTO transactions (id, type, amount, currency, date, client_id, category) VALUES
      (1, 'income', 100, 'USD', '2026-09-13', 1, 'client_payment'),
      (2, 'income', 50, 'BRL', '2026-09-13', 2, 'client_payment');
  `);

  const result = selectTodayIncomeByCurrency(db, "2026-09-13");
  assert.deepEqual(result, [
    { currency: "BRL", amount: 50 },
    { currency: "USD", amount: 100 },
  ]);
  db.close();
});

test("expense transactions today never count as income", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO transactions (id, type, amount, currency, date, client_id, category)
    VALUES (1, 'expense', 75, 'USD', '2026-09-13', 1, 'software');
  `);

  const result = selectTodayIncomeByCurrency(db, "2026-09-13");
  assert.deepEqual(result, []);
  db.close();
});
