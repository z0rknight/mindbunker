import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const closeSql = fs.readFileSync(
  path.resolve(__dirname, "../../../scripts/september-2026-human-input-close.sql"),
  "utf8",
);

const movements = [
  ["2026-09-03", -150, "TRANSFER-2349804943"],
  ["2026-09-05", -74, "CARD-4292473562"],
  ["2026-09-08", -99.55, "CARD-4303469528"],
  ["2026-09-13", -12.9, "CARD-4326873397"],
  ["2026-09-13", -68.81, "CARD-4326876305"],
  ["2026-09-13", -211.08, "TRANSFER-2369452438"],
  ["2026-09-15", -222, "TRANSFER-2372318694"],
];

function buildDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE cash_accounts (
      id INTEGER PRIMARY KEY, scope TEXT NOT NULL, currency TEXT NOT NULL
    );
    CREATE TABLE cash_movements (
      id INTEGER PRIMARY KEY, cash_account_id INTEGER NOT NULL, date TEXT NOT NULL,
      amount REAL NOT NULL, state TEXT NOT NULL, description TEXT NOT NULL,
      external_source TEXT NOT NULL, external_id TEXT NOT NULL,
      FOREIGN KEY (cash_account_id) REFERENCES cash_accounts(id)
    );
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, amount REAL NOT NULL,
      category TEXT NOT NULL, date TEXT NOT NULL, notes TEXT, currency TEXT NOT NULL,
      client_id INTEGER, contract_id INTEGER, created_at INTEGER,
      idempotency_key TEXT, external_source TEXT, external_id TEXT
    );
    CREATE TABLE billing_evidence (
      id INTEGER PRIMARY KEY, contract_id INTEGER NOT NULL, gross_amount REAL NOT NULL,
      currency TEXT NOT NULL
    );
    CREATE TABLE platform_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT, billing_evidence_id INTEGER NOT NULL,
      amount REAL NOT NULL, currency TEXT NOT NULL, source TEXT NOT NULL,
      occurred_at TEXT, notes TEXT, created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (billing_evidence_id) REFERENCES billing_evidence(id),
      CHECK (source IN ('MANUAL','CSV_IMPORT','UPWORK_REPORT'))
    );
    CREATE TABLE reconciliation_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, contract_id INTEGER, date TEXT NOT NULL,
      note TEXT NOT NULL, video_id INTEGER, created_at INTEGER
    );
    INSERT INTO cash_accounts(id,scope,currency) VALUES (1,'BUSINESS','BRL');
    INSERT INTO billing_evidence(id,contract_id,gross_amount,currency) VALUES
      (6,1,125.00,'USD'),(7,1,254.17,'USD'),(8,1,166.67,'USD'),(10,1,183.33,'USD');
    INSERT INTO platform_fees(billing_evidence_id,amount,currency,source,occurred_at,notes) VALUES
      (6,12.50,'USD','UPWORK_REPORT','2026-09-04','SERVICE_FEE'),
      (7,25.42,'USD','UPWORK_REPORT','2026-09-11','SERVICE_FEE'),
      (8,16.67,'USD','UPWORK_REPORT','2026-09-18','SERVICE_FEE'),
      (10,18.33,'USD','UPWORK_REPORT','2026-09-25','SERVICE_FEE');
    INSERT INTO transactions(type,amount,category,date,currency,client_id,contract_id) VALUES
      ('expense',320.04,'Existing operating cost','2026-09-01','BRL',NULL,NULL),
      ('expense',32.75,'Existing operating cost','2026-09-01','USD',NULL,NULL),
      ('income',400.00,'Freelance','2026-09-26','BRL',10,4),
      ('income',109.51,'Upwork settlement','2026-09-08','USD',2,1),
      ('income',225.76,'Upwork settlement','2026-09-14','USD',2,1),
      ('income',147.01,'Upwork settlement','2026-09-22','USD',2,1),
      ('income',162.01,'Upwork settlement','2026-09-29','USD',2,1);
  `);
  const insertMovement = db.prepare(`
    INSERT INTO cash_movements(
      cash_account_id,date,amount,state,description,external_source,external_id
    ) VALUES (1,?,?,'AMBIGUOUS','preserved Wise description','WISE',?)
  `);
  for (const row of movements) insertMovement.run(...row);
  return db;
}

function applyClose(db) {
  db.exec(closeSql);
}

test("human BRL classifications include business costs and exclude personal draws", () => {
  const db = buildDb();
  applyClose(db);
  const row = db.prepare(`
    SELECT
      ROUND(SUM(CASE WHEN type='expense' AND currency='BRL' THEN amount ELSE 0 END),2) operating,
      ROUND(SUM(CASE WHEN type='owner_pay' AND currency='BRL' THEN amount ELSE 0 END),2) personal
    FROM transactions WHERE date BETWEEN '2026-09-01' AND '2026-09-30'
  `).get();
  assert.deepEqual({ ...row }, { operating: 923.48, personal: 234.9 });
});

test("all seven source movements reconcile without overwriting their Wise descriptions", () => {
  const db = buildDb();
  applyClose(db);
  const rows = db.prepare(`
    SELECT state,description FROM cash_movements ORDER BY id
  `).all();
  assert.equal(rows.length, 7);
  assert.equal(rows.every((row) => row.state === "RECONCILED"), true);
  assert.equal(rows.every((row) => row.description === "preserved Wise description"), true);
  const notes = db.prepare(`
    SELECT notes FROM transactions WHERE idempotency_key LIKE 'sep2026-human:%'
  `).all();
  assert.equal(notes.length, 7);
  assert.equal(notes.every((row) => row.notes.includes("actor=operator")), true);
  assert.equal(notes.every((row) => row.notes.includes("prior cash classification=AMBIGUOUS")), true);
});

test("service and withdrawal fees remain separate and withdrawal fees classify once", () => {
  const db = buildDb();
  applyClose(db);
  applyClose(db);
  const fees = db.prepare(`
    SELECT
      ROUND(SUM(CASE WHEN notes='SERVICE_FEE' THEN amount ELSE 0 END),2) service,
      ROUND(SUM(CASE WHEN notes LIKE 'UPWORK_WITHDRAWAL_FEE_%' THEN amount ELSE 0 END),2) withdrawal,
      SUM(CASE WHEN notes LIKE 'UPWORK_WITHDRAWAL_FEE_%' THEN 1 ELSE 0 END) withdrawal_rows
    FROM platform_fees
  `).get();
  assert.deepEqual({ ...fees }, { service: 72.92, withdrawal: 11.96, withdrawal_rows: 4 });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM transactions WHERE idempotency_key LIKE 'sep2026-human:%'").get().n, 7);
});

test("posted-gross bridge reaches Wise cash and cash-basis result avoids double-counting fees", () => {
  const db = buildDb();
  applyClose(db);
  const postedGross = db.prepare("SELECT ROUND(SUM(gross_amount),2) amount FROM billing_evidence").get().amount;
  const serviceFees = db.prepare("SELECT ROUND(SUM(amount),2) amount FROM platform_fees WHERE notes='SERVICE_FEE'").get().amount;
  const withdrawalFees = db.prepare("SELECT ROUND(SUM(amount),2) amount FROM platform_fees WHERE notes LIKE 'UPWORK_WITHDRAWAL_FEE_%'").get().amount;
  const wiseCash = db.prepare("SELECT ROUND(SUM(amount),2) amount FROM transactions WHERE type='income' AND category='Upwork settlement'").get().amount;
  const usdOperating = db.prepare("SELECT ROUND(SUM(amount),2) amount FROM transactions WHERE type='expense' AND currency='USD'").get().amount;
  assert.equal(postedGross, 729.17);
  assert.equal(serviceFees, 72.92);
  assert.equal(withdrawalFees, 11.96);
  assert.equal(wiseCash, 644.29);
  assert.notEqual(wiseCash, postedGross);
  assert.equal(Math.round((postedGross - serviceFees - withdrawalFees - usdOperating) * 100) / 100, 611.54);
  assert.equal(Math.round((wiseCash - usdOperating) * 100) / 100, 611.54);
});

test("closure SQL never mutates client lifecycle or replays the prior reconciliation wave", () => {
  assert.doesNotMatch(closeSql, /UPDATE\s+clients\b/iu);
  assert.doesNotMatch(closeSql, /INSERT\s+INTO\s+clients\b/iu);
  assert.doesNotMatch(closeSql, /DELETE\s+FROM\b/iu);
  assert.doesNotMatch(closeSql, /UPDATE\s+work_sessions\b/iu);
});
