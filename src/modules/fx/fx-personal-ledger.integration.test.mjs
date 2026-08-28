import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeVolumeWeightedRate, computeFxCashMovements } from "./core.ts";
import { computePersonalBalanceByCurrency } from "../personal-finance/core.ts";

// Sprint C1 — FX observed-rate ledger + Personal Finance foundation +
// Owner Pay bridge, covered against the real migration chain (0000..HEAD)
// at the SQL level, same convention as
// finance/taryn-ingest-readiness.integration.test.mjs: these tables are
// only ever written through "use server" actions (modules/fx/actions.ts,
// modules/personal-finance/actions.ts, modules/finance/actions.ts's
// recordOwnerPay), which need a Next.js/Cloudflare request context this
// test runner doesn't have, so this file mirrors their exact SQL/logic
// instead of invoking them directly.

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

test("full migration chain replays clean with FK and integrity checks passing", () => {
  const db = buildMigratedDb();
  const fkViolations = db.prepare("PRAGMA foreign_key_check").all();
  assert.deepEqual(fkViolations, []);
  const integrity = db.prepare("PRAGMA integrity_check").all();
  assert.equal(integrity.length, 1);
  assert.equal(integrity[0].integrity_check, "ok");
});

// Sprint C1 required human-QA fixture, reproduced exactly against the real
// fx_conversions table:
//   Aug 05: R$510 -> $100, Aug 15: R$1,050 -> $200
//     -> cumulative volume-weighted average = R$5.20/USD
//   + Aug 20: R$530 -> $100
//     -> cumulative volume-weighted average = R$5.225/USD
test("fx_conversions rows reproduce the exact worked cumulative-average fixture", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO fx_conversions (date, brl_amount, usd_amount) VALUES
      ('2026-08-05', 510, 100),
      ('2026-08-15', 1050, 200);
  `);
  const firstTwo = db.prepare("SELECT brl_amount as brlAmount, usd_amount as usdAmount FROM fx_conversions").all();
  assert.equal(computeVolumeWeightedRate(firstTwo), 5.2);

  db.exec(`INSERT INTO fx_conversions (date, brl_amount, usd_amount) VALUES ('2026-08-20', 530, 100);`);
  const allThree = db.prepare("SELECT brl_amount as brlAmount, usd_amount as usdAmount FROM fx_conversions").all();
  assert.equal(computeVolumeWeightedRate(allThree), 5.225);
});

test("fx_conversions rejects zero/negative amounts at the DB level", () => {
  const db = buildMigratedDb();
  assert.throws(() => {
    db.exec(`INSERT INTO fx_conversions (date, brl_amount, usd_amount) VALUES ('2026-08-05', 0, 100);`);
  }, /CHECK constraint failed/);
  assert.throws(() => {
    db.exec(`INSERT INTO fx_conversions (date, brl_amount, usd_amount) VALUES ('2026-08-05', 510, -1);`);
  }, /CHECK constraint failed/);
});

test("fx_manual_rates enforces one rate per month", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO fx_manual_rates (month, rate) VALUES ('2026-07', 5.0);`);
  assert.throws(() => {
    db.exec(`INSERT INTO fx_manual_rates (month, rate) VALUES ('2026-07', 5.5);`);
  }, /UNIQUE constraint failed/);
});

function seedClientAndOwnerPayTransaction(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO transactions (id, type, amount, category, date, currency)
    VALUES (1, 'owner_pay', 300, 'Owner Pay', '2026-08-24', 'BRL');
  `);
}

// Sprint C1 required human-QA fixture, reproduced exactly against the real
// personal_transactions table:
//   Opening BRL R$500, Owner Pay +R$300, Food -R$80, Transport -R$40
//   -> expected personal BRL cash balance = R$680.
test("personal_transactions rows reproduce the exact worked balance fixture", () => {
  const db = buildMigratedDb();
  seedClientAndOwnerPayTransaction(db);
  db.exec(`
    INSERT INTO personal_transactions (type, amount, category, currency, date)
    VALUES ('opening_balance', 500, 'Opening Balance', 'BRL', '2026-08-01');
    INSERT INTO personal_transactions (type, amount, category, currency, date, owner_pay_transaction_id)
    VALUES ('owner_pay_receipt', 300, 'Owner Pay', 'BRL', '2026-08-24', 1);
    INSERT INTO personal_transactions (type, amount, category, currency, date)
    VALUES ('expense', 80, 'Food', 'BRL', '2026-08-24');
    INSERT INTO personal_transactions (type, amount, category, currency, date)
    VALUES ('expense', 40, 'Transport', 'BRL', '2026-08-24');
  `);
  const rows = db.prepare("SELECT type, amount, currency FROM personal_transactions").all();
  const result = computePersonalBalanceByCurrency(rows);
  assert.deepEqual(result, [
    { currency: "BRL", openingBalance: 500, ownerPayReceipts: 300, income: 0, expenses: 120, fxNet: 0, balance: 680 },
  ]);
});

test("the owner-pay link CHECK constraint is enforced both directions", () => {
  const db = buildMigratedDb();
  seedClientAndOwnerPayTransaction(db);

  // owner_pay_receipt without a linked transaction id -> rejected.
  assert.throws(() => {
    db.exec(`
      INSERT INTO personal_transactions (type, amount, category, currency, date)
      VALUES ('owner_pay_receipt', 300, 'Owner Pay', 'BRL', '2026-08-24');
    `);
  }, /CHECK constraint failed/);

  // A non-owner_pay_receipt row carrying a linked transaction id -> rejected.
  assert.throws(() => {
    db.exec(`
      INSERT INTO personal_transactions (type, amount, category, currency, date, owner_pay_transaction_id)
      VALUES ('expense', 50, 'Food', 'BRL', '2026-08-24', 1);
    `);
  }, /CHECK constraint failed/);
});

test("one business owner_pay transaction can only ever bridge to one personal receipt", () => {
  const db = buildMigratedDb();
  seedClientAndOwnerPayTransaction(db);
  db.exec(`
    INSERT INTO personal_transactions (type, amount, category, currency, date, owner_pay_transaction_id)
    VALUES ('owner_pay_receipt', 300, 'Owner Pay', 'BRL', '2026-08-24', 1);
  `);
  assert.throws(() => {
    db.exec(`
      INSERT INTO personal_transactions (type, amount, category, currency, date, owner_pay_transaction_id)
      VALUES ('owner_pay_receipt', 300, 'Owner Pay', 'BRL', '2026-08-24', 1);
    `);
  }, /UNIQUE constraint failed/);
});

test("deleting a bridged business transaction is blocked while its personal receipt exists (ON DELETE RESTRICT)", () => {
  const db = buildMigratedDb();
  seedClientAndOwnerPayTransaction(db);
  db.exec(`
    INSERT INTO personal_transactions (type, amount, category, currency, date, owner_pay_transaction_id)
    VALUES ('owner_pay_receipt', 300, 'Owner Pay', 'BRL', '2026-08-24', 1);
  `);
  assert.throws(() => {
    db.exec(`DELETE FROM transactions WHERE id = 1;`);
  }, /FOREIGN KEY constraint failed/);
});

test("personal balance stays entirely separate from Business Cash -- no shared table, no shared total", () => {
  const db = buildMigratedDb();
  seedClientAndOwnerPayTransaction(db);
  db.exec(`
    INSERT INTO transactions (type, amount, category, date, currency) VALUES ('income', 1000, 'Consulting', '2026-08-01', 'BRL');
    INSERT INTO personal_transactions (type, amount, category, currency, date, owner_pay_transaction_id)
    VALUES ('owner_pay_receipt', 300, 'Owner Pay', 'BRL', '2026-08-24', 1);
  `);
  const businessIncome = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'income'").get();
  const personalRows = db.prepare("SELECT type, amount, currency FROM personal_transactions").all();
  const personalBalance = computePersonalBalanceByCurrency(personalRows);
  assert.equal(businessIncome.total, 1000);
  assert.equal(personalBalance[0].balance, 300);
});

// ─── Client Portal Reality round §H: FX conversion edit/delete ────────────
// updateFxConversion/deleteFxConversion (modules/fx/actions.ts) are "use
// server" actions, so mirrored here at the SQL level like every other test
// in this file. No FK references fx_conversions, and neither action ever
// touches `transactions` -- verified directly below.

test("editing a conversion preserves its row id and the monthly rate recomputes from the edited value", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO fx_conversions (id, date, brl_amount, usd_amount) VALUES
      (1, '2026-08-05', 510, 100),
      (2, '2026-08-15', 1050, 200);
  `);
  const before = db.prepare("SELECT brl_amount as brlAmount, usd_amount as usdAmount FROM fx_conversions").all();
  assert.equal(computeVolumeWeightedRate(before), 5.2);

  // Correct a typo on row 1: 510 -> 500 BRL, same USD side.
  db.exec(`UPDATE fx_conversions SET brl_amount = 500 WHERE id = 1;`);

  const row1 = db.prepare("SELECT id, brl_amount as brlAmount, usd_amount as usdAmount FROM fx_conversions WHERE id = 1").get();
  assert.equal(row1.id, 1);
  assert.equal(row1.brlAmount, 500);

  const after = db.prepare("SELECT brl_amount as brlAmount, usd_amount as usdAmount FROM fx_conversions").all();
  // (500 + 1050) / (100 + 200) = 5.1667 (rounded to 4dp)
  assert.equal(computeVolumeWeightedRate(after), 5.1667);
});

test("editing a conversion to a zero/negative amount is rejected at the DB level", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO fx_conversions (id, date, brl_amount, usd_amount) VALUES (1, '2026-08-05', 510, 100);`);
  assert.throws(() => {
    db.exec(`UPDATE fx_conversions SET usd_amount = 0 WHERE id = 1;`);
  }, /CHECK constraint failed/);
  const row = db.prepare("SELECT usd_amount as usdAmount FROM fx_conversions WHERE id = 1").get();
  assert.equal(row.usdAmount, 100, "the rejected update must not have partially applied");
});

test("deleting a conversion removes only that row and the monthly rate recomputes over what remains", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO fx_conversions (id, date, brl_amount, usd_amount) VALUES
      (1, '2026-08-05', 510, 100),
      (2, '2026-08-15', 1050, 200),
      (3, '2026-08-20', 530, 100);
  `);
  db.exec(`DELETE FROM fx_conversions WHERE id = 2;`);

  const remaining = db.prepare("SELECT id FROM fx_conversions ORDER BY id").all();
  assert.deepEqual(remaining.map((r) => r.id), [1, 3]);

  const rows = db.prepare("SELECT brl_amount as brlAmount, usd_amount as usdAmount FROM fx_conversions").all();
  // (510 + 530) / (100 + 100) = 5.2
  assert.equal(computeVolumeWeightedRate(rows), 5.2);
});

test("editing and deleting a conversion never touches the transactions table", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO transactions (id, type, amount, category, date, currency)
    VALUES (1, 'income', 1000, 'Consulting', '2026-08-01', 'BRL');
    INSERT INTO fx_conversions (id, date, brl_amount, usd_amount) VALUES (1, '2026-08-05', 510, 100);
  `);
  db.exec(`UPDATE fx_conversions SET brl_amount = 505 WHERE id = 1;`);
  db.exec(`DELETE FROM fx_conversions WHERE id = 1;`);

  const txn = db.prepare("SELECT id, amount FROM transactions WHERE id = 1").get();
  assert.equal(txn.amount, 1000, "the unrelated business transaction must be untouched");
  const remainingConversions = db.prepare("SELECT id FROM fx_conversions").all();
  assert.deepEqual(remainingConversions, []);
});

test("business, personal, and unclassified observed rates stay disjoint", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO fx_conversions (date, brl_amount, usd_amount, scope, from_currency)
    VALUES ('2026-08-01', 510, 100, 'BUSINESS', 'USD');
    INSERT INTO fx_conversions (date, brl_amount, usd_amount, scope, from_currency)
    VALUES ('2026-08-02', 540, 100, 'PERSONAL', 'USD');
    INSERT INTO fx_conversions (date, brl_amount, usd_amount)
    VALUES ('2026-08-03', 900, 100);
  `);

  const business = db.prepare("SELECT brl_amount AS brlAmount, usd_amount AS usdAmount FROM fx_conversions WHERE scope = 'BUSINESS'").all();
  const personal = db.prepare("SELECT brl_amount AS brlAmount, usd_amount AS usdAmount FROM fx_conversions WHERE scope = 'PERSONAL'").all();
  const legacy = db.prepare("SELECT scope, from_currency AS fromCurrency FROM fx_conversions WHERE scope = 'UNCLASSIFIED'").get();

  assert.equal(computeVolumeWeightedRate(business), 5.1);
  assert.equal(computeVolumeWeightedRate(personal), 5.4);
  assert.equal(legacy.scope, "UNCLASSIFIED");
  assert.equal(legacy.fromCurrency, null);
});

// Lunch Reality Patch P1 §5: getPersonalBalanceSummary (modules/personal-finance/actions.ts)
// selects only scope = 'PERSONAL' fx_conversions rows, maps them through the
// existing computeFxCashMovements pure function, and folds the result into
// computePersonalBalanceByCurrency. Mirrored here at the SQL level (same
// "use server" limitation noted at the top of this file) to prove a
// BUSINESS-scope conversion never reaches personal cash, and a PERSONAL one
// never touches transactions/Business Cash.
test("PERSONAL-scope fx_conversions fold into personal balance; BUSINESS-scope never does", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO personal_transactions (type, amount, category, currency, date)
    VALUES ('opening_balance', 0, 'Opening Balance', 'USD', '2026-08-01');
    INSERT INTO fx_conversions (date, brl_amount, usd_amount, scope, from_currency)
    VALUES ('2026-08-05', 510, 100, 'PERSONAL', 'USD');
    INSERT INTO fx_conversions (date, brl_amount, usd_amount, scope, from_currency)
    VALUES ('2026-08-06', 1000, 200, 'BUSINESS', 'USD');
  `);

  const personalTransactionRows = db.prepare("SELECT type, amount, currency FROM personal_transactions").all();
  const personalFxRows = db
    .prepare("SELECT brl_amount AS brlAmount, usd_amount AS usdAmount, from_currency AS fromCurrency FROM fx_conversions WHERE scope = 'PERSONAL'")
    .all();
  const fxMovements = personalFxRows.flatMap((fx) => computeFxCashMovements(fx));

  const result = computePersonalBalanceByCurrency(personalTransactionRows, fxMovements);
  const usd = result.find((r) => r.currency === "USD");
  const brl = result.find((r) => r.currency === "BRL");

  // Only the PERSONAL $100->R$510 conversion folded in -- the BUSINESS
  // $200->R$1000 row is invisible here entirely.
  assert.equal(usd.fxNet, -100);
  assert.equal(usd.balance, -100);
  assert.equal(brl.fxNet, 510);
  assert.equal(brl.balance, 510);
  assert.equal(usd.income, 0);
  assert.equal(usd.expenses, 0);
  assert.equal(brl.income, 0);
  assert.equal(brl.expenses, 0);
});

test("the final migration chain leaves no rebuild tables behind", () => {
  const db = buildMigratedDb();
  const temporaryTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '__new_%'")
    .all();
  assert.deepEqual(temporaryTables, []);
});
