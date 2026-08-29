import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/d1";
import { tsImport } from "tsx/esm/api";

// Client Portal Reality round, pre-quick-patch A-F -- the Owner Pay
// business/personal bridge, covered against the real migration chain, same
// convention as this repo's other *.integration.test.mjs files (recordOwnerPay/
// linkOwnerPayReceipt/addTransaction/repairOrphanedOwnerPayReceipts are all
// "use server" actions needing a Next.js/Cloudflare request context this
// test runner doesn't have, so the logic is mirrored directly in SQL/JS
// exactly as those functions do it).

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

const plain = (row) => (row ? { ...row } : row);

test("recordOwnerPay builds the exact Drizzle INSERT SELECT shape accepted by D1", async () => {
  const [{ buildOwnerPayStatements }, schema] = await Promise.all([
    tsImport("./owner-pay-query.ts", import.meta.url),
    tsImport("../../db/schema.ts", import.meta.url),
  ]);
  const clientThatMustNeverExecute = {
    prepare() {
      throw new Error("query construction test must not execute");
    },
  };
  const db = drizzle(clientThatMustNeverExecute, { schema });
  const [businessInsert, receiptInsert] = buildOwnerPayStatements(db, {
    amount: 140,
    currency: "USD",
    date: "2026-08-24",
    notes: null,
    idempotencyKey: "owner-pay:query-shape",
  });

  assert.match(businessInsert.toSQL().sql, /on conflict .*idempotency_key.* do nothing/i);
  const receiptSql = receiptInsert.toSQL().sql;
  assert.match(receiptSql, /insert into "personal_transactions"/i);
  assert.match(receiptSql, /select null as "id"/i);
  assert.match(receiptSql, /unixepoch\(\) as "created_at"/i);
  assert.match(receiptSql, /owner_pay_transaction_id/i);
});

test("Owner Pay correction builds two identity-preserving Drizzle updates", async () => {
  const [{ buildOwnerPayCorrectionStatements }, schema] = await Promise.all([
    tsImport("./owner-pay-query.ts", import.meta.url),
    tsImport("../../db/schema.ts", import.meta.url),
  ]);
  const clientThatMustNeverExecute = { prepare() { throw new Error("construction only"); } };
  const db = drizzle(clientThatMustNeverExecute, { schema });
  const [businessUpdate, personalUpdate] = buildOwnerPayCorrectionStatements(db, 3, {
    amount: 175,
    currency: "USD",
    date: "2026-08-25",
    notes: "corrected",
  });
  assert.match(businessUpdate.toSQL().sql, /^update "transactions" set /iu);
  assert.match(businessUpdate.toSQL().sql, /"id" = \? and "transactions"\."type" = \?/iu);
  assert.match(personalUpdate.toSQL().sql, /^update "personal_transactions" set /iu);
  assert.match(personalUpdate.toSQL().sql, /"owner_pay_transaction_id" = \?/iu);
});

// Mirrors linkOwnerPayReceipt (modules/personal-finance/actions.ts).
function linkOwnerPayReceipt(db, { ownerPayTransactionId, amount, currency, date, notes }) {
  db.prepare(`
    INSERT INTO personal_transactions (type, amount, category, currency, date, notes, owner_pay_transaction_id)
    VALUES ('owner_pay_receipt', ?, 'Owner Pay', ?, ?, ?, ?)
  `).run(amount, currency, date, notes ?? null, ownerPayTransactionId);
}

// Mirrors the fixed recordOwnerPay (modules/finance/actions.ts): one
// atomic batch/transaction, keyed by the business row's unique
// idempotency key, with the personal side inserted from that same row.
let generatedKey = 0;
function recordOwnerPay(db, { amount, currency = "USD", date = "2026-08-25", notes = null, idempotencyKey = null }) {
  const key = idempotencyKey ?? `server-generated-${++generatedKey}`;
  try {
    db.exec("BEGIN IMMEDIATE");
    db
      .prepare(`
        INSERT INTO transactions (type, amount, category, date, notes, currency, idempotency_key)
        VALUES ('owner_pay', ?, 'Owner Pay', ?, ?, ?, ?)
        ON CONFLICT(idempotency_key) DO NOTHING
      `)
      .run(amount, date, notes, currency, key);
    db.prepare(`
      INSERT INTO personal_transactions
        (type, amount, category, currency, date, notes, owner_pay_transaction_id)
      SELECT 'owner_pay_receipt', amount, 'Owner Pay', currency, date, notes, id
      FROM transactions
      WHERE idempotency_key = ?
      ON CONFLICT(owner_pay_transaction_id) DO NOTHING
    `).run(key);
    db.exec("COMMIT");
  } catch {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Nothing was open; the failed statement rolled back before BEGIN completed.
    }
    return { success: false, error: "rolled back" };
  }

  return { success: true };
}

function correctOwnerPay(db, transactionId, { amount, currency, date, notes = null }) {
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare(`UPDATE transactions SET amount = ?, currency = ?, date = ?, notes = ?, category = 'Owner Pay' WHERE id = ? AND type = 'owner_pay'`)
      .run(amount, currency, date, notes, transactionId);
    db.prepare(`UPDATE personal_transactions SET amount = ?, currency = ?, date = ?, notes = ?, category = 'Owner Pay' WHERE owner_pay_transaction_id = ? AND type = 'owner_pay_receipt'`)
      .run(amount, currency, date, notes, transactionId);
    db.exec("COMMIT");
    return { success: true };
  } catch {
    try { db.exec("ROLLBACK"); } catch {
      // The failing statement may already have closed the transaction.
    }
    return { success: false };
  }
}

// Mirrors addTransaction's new owner_pay guard.
function addTransactionRejectsOwnerPay(type) {
  return type === "owner_pay"
    ? { success: false, error: "Owner Pay must be recorded via recordOwnerPay, not addTransaction." }
    : { success: true };
}

// Mirrors findOrphanedOwnerPayTransactions / repairOrphanedOwnerPayReceipts.
function findOrphans(db) {
  return db
    .prepare(`
      SELECT t.id, t.amount, t.currency, t.date, t.notes
      FROM transactions t
      LEFT JOIN personal_transactions pt ON pt.owner_pay_transaction_id = t.id
      WHERE t.type = 'owner_pay' AND pt.id IS NULL
    `)
    .all()
    .map(plain);
}

function repairOrphans(db) {
  const orphans = findOrphans(db);
  const repaired = [];
  for (const row of orphans) {
    try {
      linkOwnerPayReceipt(db, {
        ownerPayTransactionId: row.id,
        amount: row.amount,
        currency: row.currency,
        date: row.date,
        notes: row.notes,
      });
      repaired.push(row.id);
    } catch {
      // already linked concurrently -- skip
    }
  }
  return repaired;
}

function personalBalance(db, currency) {
  const rows = db
    .prepare("SELECT type, amount FROM personal_transactions WHERE currency = ?")
    .all(currency);
  let balance = 0;
  let income = 0;
  for (const row of rows) {
    if (row.type === "expense") balance -= row.amount;
    else balance += row.amount;
    if (row.type === "income") income += row.amount;
  }
  return { balance, income };
}

// 1-5: creating Owner Pay creates exactly one business transaction and
// exactly one linked personal receipt, amount/currency/date match.
test("recordOwnerPay creates exactly one business transaction and one linked personal receipt, amount/currency/date preserved", () => {
  const db = buildMigratedDb();
  const result = recordOwnerPay(db, { amount: 140, currency: "USD", date: "2026-08-24", notes: "August pay" });
  assert.equal(result.success, true);

  const businessRows = db.prepare("SELECT * FROM transactions WHERE type = 'owner_pay'").all().map(plain);
  assert.equal(businessRows.length, 1);
  assert.equal(businessRows[0].amount, 140);
  assert.equal(businessRows[0].currency, "USD");
  assert.equal(businessRows[0].date, "2026-08-24");

  const personalRows = db.prepare("SELECT * FROM personal_transactions WHERE type = 'owner_pay_receipt'").all().map(plain);
  assert.equal(personalRows.length, 1);
  assert.equal(personalRows[0].amount, 140);
  assert.equal(personalRows[0].currency, "USD");
  assert.equal(personalRows[0].date, "2026-08-24");
  assert.equal(personalRows[0].owner_pay_transaction_id, businessRows[0].id);
});

// 6-7: receipt increases personal cash but never counts as external income.
test("Owner Pay receipt increases personal cash balance but is never counted as external income", () => {
  const db = buildMigratedDb();
  recordOwnerPay(db, { amount: 140, currency: "USD" });
  const { balance, income } = personalBalance(db, "USD");
  assert.equal(balance, 140);
  assert.equal(income, 0);
});

test("Owner Pay correction preserves both IDs, the pair link, and creation identity", () => {
  const db = buildMigratedDb();
  recordOwnerPay(db, { amount: 140, currency: "USD", date: "2026-08-24", idempotencyKey: "correct-me" });
  const beforeBusiness = plain(db.prepare("SELECT * FROM transactions WHERE idempotency_key = 'correct-me'").get());
  const beforeReceipt = plain(db.prepare("SELECT * FROM personal_transactions WHERE owner_pay_transaction_id = ?").get(beforeBusiness.id));
  assert.equal(correctOwnerPay(db, beforeBusiness.id, {
    amount: 175, currency: "BRL", date: "2026-08-25", notes: "corrected",
  }).success, true);
  const afterBusiness = plain(db.prepare("SELECT * FROM transactions WHERE id = ?").get(beforeBusiness.id));
  const afterReceipt = plain(db.prepare("SELECT * FROM personal_transactions WHERE id = ?").get(beforeReceipt.id));
  assert.equal(afterBusiness.id, beforeBusiness.id);
  assert.equal(afterBusiness.created_at, beforeBusiness.created_at);
  assert.equal(afterBusiness.idempotency_key, beforeBusiness.idempotency_key);
  assert.equal(afterReceipt.id, beforeReceipt.id);
  assert.equal(afterReceipt.created_at, beforeReceipt.created_at);
  assert.equal(afterReceipt.owner_pay_transaction_id, beforeBusiness.id);
  for (const row of [afterBusiness, afterReceipt]) {
    assert.equal(row.amount, 175);
    assert.equal(row.currency, "BRL");
    assert.equal(row.date, "2026-08-25");
    assert.equal(row.notes, "corrected");
  }
});

test("Owner Pay correction rolls back the business side if the personal update fails", () => {
  const db = buildMigratedDb();
  recordOwnerPay(db, { amount: 140, currency: "USD", date: "2026-08-24", idempotencyKey: "atomic-correction" });
  const business = plain(db.prepare("SELECT * FROM transactions WHERE idempotency_key = 'atomic-correction'").get());
  db.exec(`CREATE TRIGGER reject_owner_pay_correction BEFORE UPDATE ON personal_transactions BEGIN SELECT RAISE(ABORT, 'reject correction'); END`);
  assert.equal(correctOwnerPay(db, business.id, {
    amount: 999, currency: "BRL", date: "2026-08-26", notes: "must roll back",
  }).success, false);
  const unchanged = plain(db.prepare("SELECT amount, currency, date, notes FROM transactions WHERE id = ?").get(business.id));
  assert.deepEqual(unchanged, {
    amount: business.amount,
    currency: business.currency,
    date: business.date,
    notes: business.notes,
  });
});

// 8: business Owner Pay is neither expense nor revenue (its own distinct type).
test("business Owner Pay transaction type is neither income nor expense", () => {
  const db = buildMigratedDb();
  recordOwnerPay(db, { amount: 140, currency: "USD" });
  const row = plain(db.prepare("SELECT type FROM transactions WHERE type = \'owner_pay\'").get());
  assert.equal(row.type, "owner_pay");
  assert.notEqual(row.type, "income");
  assert.notEqual(row.type, "expense");
});

// 9: duplicate submit (same idempotency key) does not duplicate either side.
test("duplicate submit with the same idempotency key creates exactly one pair, not two", () => {
  const db = buildMigratedDb();
  const key = "test-key-1";
  recordOwnerPay(db, { amount: 140, currency: "USD", idempotencyKey: key });
  const second = recordOwnerPay(db, { amount: 140, currency: "USD", idempotencyKey: key });
  assert.equal(second.success, true);

  const businessCount = db.prepare("SELECT COUNT(*) AS c FROM transactions WHERE type = \'owner_pay\'").get().c;
  const personalCount = db.prepare("SELECT COUNT(*) AS c FROM personal_transactions WHERE type = \'owner_pay_receipt\'").get().c;
  assert.equal(businessCount, 1);
  assert.equal(personalCount, 1);
});

// addTransaction bypass closed.
test("addTransaction rejects type owner_pay instead of silently creating an orphaned business row", () => {
  const result = addTransactionRejectsOwnerPay("owner_pay");
  assert.equal(result.success, false);
  const incomeResult = addTransactionRejectsOwnerPay("income");
  assert.equal(incomeResult.success, true);
});

// 10: exact missing historical bridge repair is idempotent.
test("repairOrphanedOwnerPayReceipts links exactly the orphans and running it twice creates no duplicate", () => {
  const db = buildMigratedDb();
  // Simulate a pre-bridge historical Owner Pay: a business row with no
  // linked personal receipt (what the old non-atomic code could leave
  // behind on partial failure).
  const inserted = db
    .prepare(`INSERT INTO transactions (type, amount, category, date, currency) VALUES ('owner_pay', 200, 'Owner Pay', '2026-07-01', 'USD')`)
    .run();
  const orphanId = Number(inserted.lastInsertRowid);

  const orphansBefore = findOrphans(db);
  assert.equal(orphansBefore.length, 1);
  assert.equal(orphansBefore[0].id, orphanId);

  const repairedFirstRun = repairOrphans(db);
  assert.deepEqual(repairedFirstRun, [orphanId]);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM personal_transactions WHERE owner_pay_transaction_id = ?").get(orphanId).c, 1);

  const orphansAfter = findOrphans(db);
  assert.equal(orphansAfter.length, 0);

  // Running the repair again must be a no-op -- no second receipt.
  const repairedSecondRun = repairOrphans(db);
  assert.deepEqual(repairedSecondRun, []);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM personal_transactions WHERE owner_pay_transaction_id = ?").get(orphanId).c, 1);
});

test("repair never touches the business transaction itself", () => {
  const db = buildMigratedDb();
  const inserted = db
    .prepare(`INSERT INTO transactions (type, amount, category, date, currency, notes) VALUES ('owner_pay', 200, 'Owner Pay', '2026-07-01', 'USD', 'original note')`)
    .run();
  const orphanId = Number(inserted.lastInsertRowid);
  const before = plain(db.prepare("SELECT * FROM transactions WHERE id = ?").get(orphanId));
  repairOrphans(db);
  const after = plain(db.prepare("SELECT * FROM transactions WHERE id = ?").get(orphanId));
  assert.deepEqual(before, after);
});

// 11: BRL and USD remain isolated -- an Owner Pay in one currency never
// mixes with the other in personal balance.
test("BRL and USD Owner Pay receipts remain completely isolated", () => {
  const db = buildMigratedDb();
  recordOwnerPay(db, { amount: 140, currency: "USD" });
  recordOwnerPay(db, { amount: 700, currency: "BRL" });
  const usd = personalBalance(db, "USD");
  const brl = personalBalance(db, "BRL");
  assert.equal(usd.balance, 140);
  assert.equal(brl.balance, 700);
});

test("currency is preserved exactly, never auto-converted", () => {
  const db = buildMigratedDb();
  recordOwnerPay(db, { amount: 700, currency: "BRL", date: "2026-08-24" });
  const business = plain(db.prepare("SELECT currency FROM transactions WHERE type = \'owner_pay\'").get());
  const personal = plain(db.prepare("SELECT currency FROM personal_transactions WHERE type = \'owner_pay_receipt\'").get());
  assert.equal(business.currency, "BRL");
  assert.equal(personal.currency, "BRL");
});

// Atomic rollback: if the personal-side insert fails, the business row
// from the same transaction must not remain orphaned.
test("atomic rollback removes the business row if the personal link fails", () => {
  const db = buildMigratedDb();
  // Force the personal-side insert to fail deterministically: pre-insert a
  // conflicting row occupying the unique index this owner-pay's future id
  // would need... simpler: directly exercise the rollback path by making
  // the CHECK constraint fail (link a receipt with mismatched type/id pair
  // is hard to trigger via the real function signature, so instead corrupt
  // the FK target: reference a transaction id that doesn't exist yet by
  // pre-deleting note field constraints is not applicable here; use an
  // amount that violates personal_transactions_amount_check instead).
  const result = recordOwnerPay(db, { amount: -5, currency: "USD" });
  assert.equal(result.success, false);
  const businessCount = db.prepare("SELECT COUNT(*) AS c FROM transactions WHERE type = \'owner_pay\'").get().c;
  const personalCount = db.prepare("SELECT COUNT(*) AS c FROM personal_transactions WHERE type = \'owner_pay_receipt\'").get().c;
  assert.equal(businessCount, 0, "orphaned business row must be rolled back, not left behind");
  assert.equal(personalCount, 0);
});
