import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computePersonalBalanceByCurrency } from "./core.ts";

// Personal Finance Correction Patch -- updatePersonalTransaction/
// deletePersonalTransaction (actions.ts) are "use server" actions needing
// a Next.js/Cloudflare request context this test runner doesn't have, so
// (same convention as fx-personal-ledger.integration.test.mjs) this file
// mirrors their exact SQL/logic against the real migration chain instead
// of invoking them directly.

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

// Mirrors updatePersonalTransaction verbatim: fetch current type, validate,
// UPDATE the existing row in place (never delete+insert).
function updateRow(db, id, data) {
  const current = db
    .prepare("SELECT id, type, category FROM personal_transactions WHERE id = ?")
    .get(id);
  if (!current) return { success: false, error: "Transaction not found." };
  if (current.type !== "income" && current.type !== "expense") {
    return { success: false, error: "Only Income and Expense rows can be edited here." };
  }
  if (data.type !== "income" && data.type !== "expense") {
    return { success: false, error: "Type must be Income or Expense." };
  }
  const category = data.category?.trim() || current.category;
  db.prepare(
    "UPDATE personal_transactions SET type = ?, amount = ?, currency = ?, date = ?, notes = ?, category = ? WHERE id = ?",
  ).run(data.type, data.amount, data.currency, data.date, data.notes ?? null, category, id);
  return { success: true };
}

// Mirrors deletePersonalTransaction verbatim: reject anything that isn't
// income/expense before ever attempting the DELETE.
function deleteRow(db, id) {
  const current = db
    .prepare("SELECT id, type FROM personal_transactions WHERE id = ?")
    .get(id);
  if (!current) return { success: false, error: "Transaction not found." };
  if (current.type !== "income" && current.type !== "expense") {
    return {
      success: false,
      error:
        current.type === "owner_pay_receipt"
          ? "Owner Pay receipts can't be deleted here -- they're the record of a real transfer from the business."
          : "Opening Balance can't be deleted here.",
    };
  }
  db.prepare(
    "DELETE FROM personal_transactions WHERE id = ? AND type IN ('income', 'expense')",
  ).run(id);
  return { success: true };
}

function allRows(db) {
  return db.prepare("SELECT type, amount, currency FROM personal_transactions").all();
}

// ─── The exact production QA case ──────────────────────────────────────────
// current row: Income +R$38.99, Aug 25 2026 -> corrected to: Expense
// -R$38.99. Same row id preserved, BRL balance moves by the full swing
// (from a starting R$38.99 net-income position to a -R$38.99 net-expense
// position -- a R$77.98 swing), and no row is duplicated.
test("QA case: correcting Income +R$38.99 to Expense -R$38.99 preserves the row id and updates the balance correctly", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO personal_transactions (id, type, amount, category, currency, date)
    VALUES (1, 'income', 38.99, 'Misc', 'BRL', '2026-08-25');
  `);

  const before = computePersonalBalanceByCurrency(allRows(db));
  assert.equal(before.find((r) => r.currency === "BRL").balance, 38.99);

  const result = updateRow(db, 1, {
    type: "expense",
    amount: 38.99,
    currency: "BRL",
    date: "2026-08-25",
    notes: undefined,
  });
  assert.equal(result.success, true);

  // Row id preserved, no duplicate created.
  const rows = db.prepare("SELECT id, type, amount FROM personal_transactions").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 1);
  assert.equal(rows[0].type, "expense");
  assert.equal(rows[0].amount, 38.99);

  const after = computePersonalBalanceByCurrency(allRows(db));
  assert.equal(after.find((r) => r.currency === "BRL").balance, -38.99);
});

test("editing amount/date/currency/notes on an income row preserves its id and type", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO personal_transactions (id, type, amount, category, currency, date, notes)
    VALUES (5, 'income', 100, 'Gift', 'USD', '2026-08-01', 'old note');
  `);
  const result = updateRow(db, 5, {
    type: "income",
    amount: 150,
    currency: "USD",
    date: "2026-08-10",
    notes: "corrected amount",
  });
  assert.equal(result.success, true);
  const row = db.prepare("SELECT * FROM personal_transactions WHERE id = 5").get();
  assert.equal(row.id, 5);
  assert.equal(row.type, "income");
  assert.equal(row.amount, 150);
  assert.equal(row.date, "2026-08-10");
  assert.equal(row.notes, "corrected amount");
});

test("opening_balance cannot be edited or converted through the correction path", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO personal_transactions (id, type, amount, category, currency, date)
    VALUES (1, 'opening_balance', 500, 'Opening Balance', 'BRL', '2026-08-01');
  `);
  const result = updateRow(db, 1, { type: "income", amount: 500, currency: "BRL", date: "2026-08-01" });
  assert.equal(result.success, false);
  assert.match(result.error, /only income and expense/i);
  const row = db.prepare("SELECT type, amount FROM personal_transactions WHERE id = 1").get();
  assert.equal(row.type, "opening_balance"); // untouched
  assert.equal(row.amount, 500);
});

test("opening_balance cannot be deleted through the correction path", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO personal_transactions (id, type, amount, category, currency, date)
    VALUES (1, 'opening_balance', 500, 'Opening Balance', 'BRL', '2026-08-01');
  `);
  const result = deleteRow(db, 1);
  assert.equal(result.success, false);
  assert.match(result.error, /Opening Balance/);
  const row = db.prepare("SELECT id FROM personal_transactions WHERE id = 1").get();
  assert.ok(row); // still there
});

test("owner_pay_receipt cannot be edited, deleted, or converted -- the business<->personal bridge stays intact", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Client A', 'active');
    INSERT INTO transactions (id, type, amount, category, date, currency)
    VALUES (1, 'owner_pay', 300, 'Owner Pay', '2026-08-24', 'BRL');
    INSERT INTO personal_transactions (id, type, amount, category, currency, date, owner_pay_transaction_id)
    VALUES (1, 'owner_pay_receipt', 300, 'Owner Pay', 'BRL', '2026-08-24', 1);
  `);

  const editResult = updateRow(db, 1, { type: "income", amount: 300, currency: "BRL", date: "2026-08-24" });
  assert.equal(editResult.success, false);
  assert.match(editResult.error, /only income and expense/i);

  const deleteResult = deleteRow(db, 1);
  assert.equal(deleteResult.success, false);
  assert.match(deleteResult.error, /can't be deleted/i);

  // The bridge is still fully intact: the receipt still exists and still
  // links to the same business transaction.
  const row = db
    .prepare("SELECT type, owner_pay_transaction_id AS ownerPayTransactionId FROM personal_transactions WHERE id = 1")
    .get();
  assert.equal(row.type, "owner_pay_receipt");
  assert.equal(row.ownerPayTransactionId, 1);
});

test("a correction never touches sibling rows -- only the targeted id changes", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO personal_transactions (id, type, amount, category, currency, date) VALUES
      (1, 'income', 38.99, 'Misc', 'BRL', '2026-08-25'),
      (2, 'expense', 20, 'Food', 'BRL', '2026-08-20');
  `);
  updateRow(db, 1, { type: "expense", amount: 38.99, currency: "BRL", date: "2026-08-25" });
  const untouched = db.prepare("SELECT type, amount FROM personal_transactions WHERE id = 2").get();
  assert.equal(untouched.type, "expense");
  assert.equal(untouched.amount, 20);
});

test("deleting an ordinary expense row removes exactly that row and no other", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO personal_transactions (id, type, amount, category, currency, date) VALUES
      (1, 'expense', 20, 'Food', 'BRL', '2026-08-20'),
      (2, 'income', 100, 'Gift', 'BRL', '2026-08-21');
  `);
  const result = deleteRow(db, 1);
  assert.equal(result.success, true);
  const remaining = db.prepare("SELECT id FROM personal_transactions").all().map((row) => ({ ...row }));
  assert.deepEqual(remaining, [{ id: 2 }]);
});

// ─── Brief B's numbered test list, items #3-#5 ─────────────────────────────

test("#3: a manual expense can be corrected to income (reverse direction of the QA case)", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO personal_transactions (id, type, amount, category, currency, date)
    VALUES (7, 'expense', 60, 'Food', 'BRL', '2026-08-15');
  `);

  const before = computePersonalBalanceByCurrency(allRows(db));
  assert.equal(before.find((r) => r.currency === "BRL").balance, -60);

  const result = updateRow(db, 7, {
    type: "income",
    amount: 60,
    currency: "BRL",
    date: "2026-08-15",
  });
  assert.equal(result.success, true);

  const row = db.prepare("SELECT id, type, amount FROM personal_transactions WHERE id = 7").get();
  assert.equal(row.id, 7);
  assert.equal(row.type, "income");
  assert.equal(row.amount, 60);

  const after = computePersonalBalanceByCurrency(allRows(db));
  assert.equal(after.find((r) => r.currency === "BRL").balance, 60);
});

test("#4: editing only the amount on an existing row recomputes the balance by the delta", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO personal_transactions (id, type, amount, category, currency, date) VALUES
      (1, 'income', 100, 'Gift', 'BRL', '2026-08-01'),
      (2, 'expense', 20, 'Food', 'BRL', '2026-08-02');
  `);

  const before = computePersonalBalanceByCurrency(allRows(db));
  assert.equal(before.find((r) => r.currency === "BRL").balance, 80);

  // Correct the income amount from 100 to 175 -- type/currency/date unchanged.
  const result = updateRow(db, 1, {
    type: "income",
    amount: 175,
    currency: "BRL",
    date: "2026-08-01",
  });
  assert.equal(result.success, true);

  const row = db.prepare("SELECT amount FROM personal_transactions WHERE id = 1").get();
  assert.equal(row.amount, 175);

  const after = computePersonalBalanceByCurrency(allRows(db));
  assert.equal(after.find((r) => r.currency === "BRL").balance, 155);
});

test("#5: editing the currency of a row moves its amount into the correct currency's balance bucket", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO personal_transactions (id, type, amount, category, currency, date) VALUES
      (1, 'income', 100, 'Gift', 'BRL', '2026-08-01'),
      (2, 'income', 50, 'Gift', 'USD', '2026-08-01');
  `);

  const before = computePersonalBalanceByCurrency(allRows(db));
  assert.equal(before.find((r) => r.currency === "BRL").balance, 100);
  assert.equal(before.find((r) => r.currency === "USD").balance, 50);

  // Correct row 1's currency from BRL to USD -- amount/type/date unchanged.
  const result = updateRow(db, 1, {
    type: "income",
    amount: 100,
    currency: "USD",
    date: "2026-08-01",
  });
  assert.equal(result.success, true);

  const after = computePersonalBalanceByCurrency(allRows(db));
  const brlAfter = after.find((r) => r.currency === "BRL");
  // The BRL bucket now has no rows in it -- either absent entirely or zero,
  // depending on how computePersonalBalanceByCurrency treats empty buckets.
  assert.ok(!brlAfter || brlAfter.balance === 0);
  assert.equal(after.find((r) => r.currency === "USD").balance, 150);
});
