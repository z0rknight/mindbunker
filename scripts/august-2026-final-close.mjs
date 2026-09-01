#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_SOURCE = "/Users/emmanueldarosadillenburg/Desktop/Finance Update 31 Aug";
const CLOSE_DATE = "2026-08-31";

const ACCOUNTS = [
  { externalId: "118287732", scope: "BUSINESS", currency: "USD", pocket: "MAIN", label: "Business USD main", opening: 0, closing: 128.85, pdf: "(business)statement_2026-08-01_2026-08-31_pdf/business-statement_118287732_USD_2026-08-01_2026-08-31.pdf", sha: "23e78ba58502ae64a41a6f2e94920c353b787504e7c9abc228c0b2f9df34c74b" },
  { externalId: "171067558", scope: "BUSINESS", currency: "USD", pocket: "RESERVE", label: "Business USD savings", opening: 0, closing: 300, pdf: "(business)statement_2026-08-01_2026-08-31_pdf/business-statement_171067558_USD_2026-08-01_2026-08-31.pdf", sha: "9bc152ce6086c095d0a6d53083baa09574d1831302a449d17866a2c129091061" },
  { externalId: "168497359", scope: "BUSINESS", currency: "BRL", pocket: "MAIN", label: "Business BRL main", opening: 0, closing: 95.5, pdf: "(business)statement_2026-08-01_2026-08-31_pdf/business-statement_168497359_BRL_2026-08-01_2026-08-31.pdf", sha: "79ca45da769f63363169ddc4183e58de309eb60d78c6f2bedeec76d151d29088" },
  { externalId: "45837980", scope: "PERSONAL", currency: "USD", pocket: "MAIN", label: "Personal USD main", opening: 0.25, closing: 60.75, pdf: "statement_2026-08-01_2026-08-31_pdf/statement_45837980_USD_2026-08-01_2026-08-31.pdf", sha: "d82995cc9f99ad54bba51944b607aa72b84db97e3994943281020e935afa9826" },
  { externalId: "95876029", scope: "PERSONAL", currency: "USD", pocket: "RESERVE", label: "Personal USD Dolarize", opening: 0, closing: 50, pdf: "statement_2026-08-01_2026-08-31_pdf/statement_95876029_USD_2026-08-01_2026-08-31.pdf", sha: "5abf6498da7ec6963e5f8b72d605e3ba571facb909402e5ad528e1521e8ab969" },
  { externalId: "44840079", scope: "PERSONAL", currency: "BRL", pocket: "MAIN", label: "Personal BRL main", opening: 3.88, closing: 52.78, pdf: "statement_2026-08-01_2026-08-31_pdf/statement_44840079_BRL_2026-08-01_2026-08-31.pdf", sha: "ed504d79866f13f0cbea7e2caeeb25d72e940cf9b956a64e32a67cd6fdeff9de" },
  { externalId: "171018409", scope: "PERSONAL", currency: "BRL", pocket: "RESERVE", label: "Personal BRL Dolarize", opening: 0, closing: 33.16, pdf: "statement_2026-08-01_2026-08-31_pdf/statement_171018409_BRL_2026-08-01_2026-08-31.pdf", sha: "92d8a8024c2828e54fb5eae94fc9a338c2adcf2bcb11f3eef6498891698eaa2f" },
];

const MOVEMENTS = [
  ["45837980", "TRANSFER-2342095355", 438.75, "RECONCILED", "Received money from Payment Escrow I", "Payment Escrow I"],
  ["45837980", "TRANSFER-2342754137", -300, "INTERNAL_TRANSFER", "Sent money to Business USD main", "Business USD main"],
  ["118287732", "TRANSFER-2342754137", 300, "INTERNAL_TRANSFER", "Received money from Personal USD main", "Personal USD main"],
  ["118287732", "BALANCE-5979406784", -200, "INTERNAL_TRANSFER", "Moved 200.00 USD to Savings", "Business USD savings"],
  ["171067558", "BALANCE-5979406784", 200, "INTERNAL_TRANSFER", "Moved 200.00 USD from Main", "Business USD main"],
  ["118287732", "BALANCE-5979548477", -40, "FX", "Converted 40.00 USD to 205.54 BRL", "Business BRL main"],
  ["168497359", "BALANCE-5979548477", 205.54, "FX", "Converted 40.00 USD to 205.54 BRL", "Business USD main"],
  ["168497359", "TRANSFER-2342808042", -170, "INTERNAL_TRANSFER", "Sent money to Personal BRL main", "Personal BRL main"],
  ["44840079", "TRANSFER-2342808042", 170, "INTERNAL_TRANSFER", "Received money from Business BRL main", "Business BRL main"],
  ["45837980", "BALANCE-5979973783", -28, "FX", "Converted 28.00 USD to 143.94 BRL", "Personal BRL main"],
  ["44840079", "BALANCE-5979973783", 143.94, "FX", "Converted 28.00 USD to 143.94 BRL", "Personal USD main"],
  ["45837980", "BALANCE-5980329437", -50, "INTERNAL_TRANSFER", "Moved 50.00 USD to Dolarize", "Personal USD Dolarize"],
  ["95876029", "BALANCE-5980329437", 50, "INTERNAL_TRANSFER", "Moved 50.00 USD from Main", "Personal USD main"],
  ["44840079", "CARD-4268244663", -167.88, "RECONCILED", "Card transaction issued by Box138", "Box138"],
  ["44840079", "TRANSFER-2342959735", -20, "RECONCILED", "Sent money to Darlan", "Darlan"],
  ["44840079", "TRANSFER-2342976086", -111, "RECONCILED", "Sent money to Darlan", "Darlan"],
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseWranglerJson(output) {
  const start = output.indexOf("[");
  if (start < 0) throw new Error(`Wrangler did not return JSON: ${output}`);
  return JSON.parse(output.slice(start));
}

function createRunner({ mode, sqlitePath }) {
  if (mode === "sqlite") {
    return {
      query(command) {
        const output = execFileSync("sqlite3", ["-json", sqlitePath, command], { cwd: ROOT, encoding: "utf8" });
        return output.trim() ? JSON.parse(output) : [];
      },
      executeFile(path) {
        return execFileSync("sqlite3", [sqlitePath, `.read ${path}`], { cwd: ROOT, encoding: "utf8" });
      },
    };
  }
  const target = mode === "remote" ? "--remote" : "--local";
  const invoke = (args) => execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "mindbunker", target, "--config", "wrangler.jsonc", ...args],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return {
    query(command) {
      return parseWranglerJson(invoke(["--command", command, "--json"])).flatMap((entry) => entry.results ?? []);
    },
    executeFile(path) {
      return invoke(["--file", path]);
    },
  };
}

function verifySources(sourceRoot) {
  for (const account of ACCOUNTS) {
    const path = join(sourceRoot, account.pdf);
    assert.equal(sha256(path), account.sha, `Canonical PDF SHA mismatch: ${account.pdf}`);
  }
}

function assertPreflight(query) {
  const accounts = query("SELECT external_account_id FROM cash_accounts WHERE external_source='WISE'");
  for (const id of ["118287732", "171067558", "168497359", "45837980", "44840079", "171018409"]) {
    assert(accounts.some((row) => row.external_account_id === id), `Missing existing cash account ${id}`);
  }
  const contract = query("SELECT id,client_id,platform,billing_type,hourly_rate,currency,status FROM commercial_contracts WHERE id=1")[0];
  assert.deepEqual(contract, { id: 1, client_id: 2, platform: "Upwork", billing_type: "HOURLY", hourly_rate: 25, currency: "USD", status: "ACTIVE" });
  const business = query("SELECT id,type,amount,currency,date,client_id,external_source,external_id FROM transactions WHERE id IN (16,17,18) ORDER BY id");
  assert.deepEqual(business.map((row) => [row.id,row.type,row.amount,row.currency,row.date]), [
    [16,"income",438.75,"USD",CLOSE_DATE],
    [17,"owner_pay",138.75,"USD",CLOSE_DATE],
    [18,"expense",170,"BRL",CLOSE_DATE],
  ].map((expected, index) => business[index]?.external_id ? [expected[0],expected[1], index === 2 ? 167.88 : expected[2],expected[3],expected[4]] : expected));
  const receipt = query("SELECT id,amount,currency,date,owner_pay_transaction_id FROM personal_transactions WHERE id=40")[0];
  assert.deepEqual(receipt, { id: 40, amount: 138.75, currency: "USD", date: CLOSE_DATE, owner_pay_transaction_id: 17 });
}

function buildSql() {
  const statements = ["PRAGMA foreign_keys = ON"];
  const usdDolarize = ACCOUNTS.find((account) => account.externalId === "95876029");
  statements.push(`INSERT INTO cash_accounts(scope,currency,pocket,label,external_source,external_account_id,opening_balance,opening_as_of) SELECT ${sql(usdDolarize.scope)},${sql(usdDolarize.currency)},${sql(usdDolarize.pocket)},${sql(usdDolarize.label)},'WISE',${sql(usdDolarize.externalId)},0,'2026-08-31' WHERE NOT EXISTS (SELECT 1 FROM cash_accounts WHERE external_source='WISE' AND external_account_id=${sql(usdDolarize.externalId)})`);
  for (const [accountId, externalId, amount, state, description, counterparty] of MOVEMENTS) {
    statements.push(`INSERT INTO cash_movements(cash_account_id,date,occurred_at,amount,state,description,counterparty,external_source,external_id) SELECT id,'2026-08-31','2026-08-31',${sql(amount)},${sql(state)},${sql(description)},${sql(counterparty)},'WISE',${sql(externalId)} FROM cash_accounts account WHERE external_source='WISE' AND external_account_id=${sql(accountId)} AND NOT EXISTS (SELECT 1 FROM cash_movements movement WHERE movement.cash_account_id=account.id AND movement.external_source='WISE' AND movement.external_id=${sql(externalId)})`);
  }
  for (const account of ACCOUNTS) {
    const snapshotId = sql(`AUGUST_2026_FINAL:${account.sha}`);
    statements.push(`UPDATE cash_account_snapshots SET balance_amount=${account.closing},external_id=${snapshotId},notes='Canonical Wise statement close through 31 August 2026' WHERE cash_account_id=(SELECT id FROM cash_accounts WHERE external_source='WISE' AND external_account_id=${sql(account.externalId)}) AND observed_at='2026-08-31' AND source='WISE_PDF' AND (balance_amount!=${account.closing} OR COALESCE(external_id,'')!=${snapshotId} OR COALESCE(notes,'')!='Canonical Wise statement close through 31 August 2026')`);
    statements.push(`INSERT INTO cash_account_snapshots(cash_account_id,balance_amount,observed_at,source,external_id,notes) SELECT id,${account.closing},'2026-08-31','WISE_PDF',${snapshotId},'Canonical Wise statement close through 31 August 2026' FROM cash_accounts account WHERE external_source='WISE' AND external_account_id=${sql(account.externalId)} AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots snapshot WHERE snapshot.cash_account_id=account.id AND snapshot.observed_at='2026-08-31' AND snapshot.source='WISE_PDF')`);
  }
  statements.push("UPDATE transactions SET category='Upwork cash receipt',client_id=2,contract_id=1,external_source='WISE',external_id='TRANSFER-2342095355',notes='Wise Payment Escrow receipt TRANSFER-2342095355; attributed to Taryn active Upwork contract' WHERE id=16 AND type='income' AND amount=438.75 AND currency='USD' AND date='2026-08-31' AND (external_id IS NULL OR (external_source='WISE' AND external_id='TRANSFER-2342095355'))");
  statements.push("UPDATE transactions SET amount=167.88,category='Meals / Production',external_source='WISE',external_id='CARD-4268244663',notes=CASE WHEN TRIM(COALESCE(notes,''))='' THEN 'Corrected to canonical Box138 card charge; Wise CARD-4268244663' ELSE TRIM(notes) || '; corrected to canonical Box138 card charge; Wise CARD-4268244663' END WHERE id=18 AND type='expense' AND currency='BRL' AND date='2026-08-31' AND amount IN (170,167.88) AND (external_id IS NULL OR (external_source='WISE' AND external_id='CARD-4268244663')) AND INSTR(COALESCE(notes,''),'Wise CARD-4268244663')=0");
  statements.push("UPDATE personal_transactions SET category='Substances',external_source='WISE',external_id='TRANSFER-2342959735',notes='Darlan; Wise TRANSFER-2342959735' WHERE id=41 AND type='expense' AND amount=20 AND currency='BRL' AND date='2026-08-31' AND (external_id IS NULL OR (external_source='WISE' AND external_id='TRANSFER-2342959735'))");
  statements.push("UPDATE personal_transactions SET category='Substances',external_source='WISE',external_id='TRANSFER-2342976086',notes='Operator-classified personal expense; Wise TRANSFER-2342976086' WHERE id=42 AND type='expense' AND amount=111 AND currency='BRL' AND date='2026-08-31' AND (external_id IS NULL OR (external_source='WISE' AND external_id='TRANSFER-2342976086'))");
  statements.push("UPDATE fx_conversions SET purpose='OTHER',external_source='WISE',external_id='BALANCE-5979548477',notes='Wise internal Business USD to BRL conversion; BALANCE-5979548477' WHERE id=25 AND date='2026-08-31' AND brl_amount=205.54 AND usd_amount=40 AND scope='BUSINESS' AND from_currency='USD' AND (external_id IS NULL OR (external_source='WISE' AND external_id='BALANCE-5979548477'))");
  statements.push("UPDATE fx_conversions SET external_source='WISE',external_id='BALANCE-5979973783',notes='Wise Personal USD to BRL conversion; BALANCE-5979973783' WHERE id=26 AND date='2026-08-31' AND brl_amount=143.94 AND usd_amount=28 AND scope='PERSONAL' AND from_currency='USD' AND (external_id IS NULL OR (external_source='WISE' AND external_id='BALANCE-5979973783'))");
  return statements;
}

function reconcile(query) {
  const rows = query("SELECT ca.external_account_id,ca.label,ca.currency,ROUND(ca.opening_balance+COALESCE(SUM(CASE WHEN cm.date<=cas.observed_at THEN cm.amount ELSE 0 END),0),2) mindbunker,cas.balance_amount wise,ROUND(cas.balance_amount-(ca.opening_balance+COALESCE(SUM(CASE WHEN cm.date<=cas.observed_at THEN cm.amount ELSE 0 END),0)),2) difference FROM cash_accounts ca JOIN cash_account_snapshots cas ON cas.cash_account_id=ca.id AND cas.source='WISE_PDF' LEFT JOIN cash_movements cm ON cm.cash_account_id=ca.id GROUP BY ca.id,cas.id ORDER BY ca.scope,ca.currency,ca.pocket");
  assert.equal(rows.length, 7, "Seven final Wise pockets required");
  for (const row of rows) assert.equal(row.difference, 0, `${row.label} does not reconcile`);
  return rows;
}

function verifyFinal(query) {
  const counts = query("SELECT (SELECT COUNT(*) FROM cash_accounts) cash_accounts,(SELECT COUNT(*) FROM cash_movements) cash_movements,(SELECT COUNT(*) FROM cash_account_snapshots WHERE source='WISE_PDF') final_snapshots,(SELECT COUNT(*) FROM cash_movements WHERE date='2026-08-31') aug31_movements")[0];
  assert.deepEqual(counts, { cash_accounts: 7, cash_movements: 169, final_snapshots: 7, aug31_movements: 16 });
  assert.equal(query("SELECT COUNT(*) count FROM transactions WHERE external_source='WISE' AND external_id='TRANSFER-2342095355'")[0].count, 1);
  assert.equal(query("SELECT COUNT(*) count FROM transactions WHERE type='owner_pay' AND date='2026-08-31' AND amount=138.75 AND currency='USD'")[0].count, 1);
  assert.equal(query("SELECT COUNT(*) count FROM personal_transactions WHERE type='owner_pay_receipt' AND owner_pay_transaction_id=17")[0].count, 1);
  const duplicates = query("SELECT external_source,external_id,COUNT(*) count FROM (SELECT external_source,external_id FROM transactions UNION ALL SELECT external_source,external_id FROM personal_transactions UNION ALL SELECT external_source,external_id FROM fx_conversions) WHERE external_source IS NOT NULL AND external_id IS NOT NULL GROUP BY external_source,external_id HAVING COUNT(*)>1");
  assert.equal(duplicates.length, 0, "Economic external identities must remain unique");
  assert.equal(query("PRAGMA foreign_key_check").length, 0, "Foreign-key check must stay clean");
  return { counts, pockets: reconcile(query) };
}

function main() {
  const args = process.argv.slice(2);
  const remote = args.includes("--remote");
  const local = args.includes("--local");
  const sqliteIndex = args.indexOf("--sqlite");
  const sqlitePath = sqliteIndex >= 0 ? args[sqliteIndex + 1] : null;
  const selected = Number(remote) + Number(local) + Number(Boolean(sqlitePath));
  assert.equal(selected, 1, "Choose exactly one of --remote, --local, or --sqlite PATH");
  const sourceIndex = args.indexOf("--source-dir");
  const sourceRoot = sourceIndex >= 0 ? args[sourceIndex + 1] : DEFAULT_SOURCE;
  const apply = args.includes("--apply");
  verifySources(sourceRoot);
  const runner = createRunner({ mode: remote ? "remote" : local ? "local" : "sqlite", sqlitePath });
  assertPreflight(runner.query);
  const statements = buildSql();
  if (!apply) {
    console.log(JSON.stringify({ mode: remote ? "remote" : local ? "local" : "sqlite", apply: false, sourcePdfs: 7, canonicalMovements: 16, statements: statements.length }, null, 2));
    return;
  }
  const temp = mkdtempSync(join(tmpdir(), "mindbunker-august-final-close-"));
  const sqlPath = join(temp, "close.sql");
  writeFileSync(sqlPath, `${statements.join(";\n")};\n`);
  try {
    runner.executeFile(sqlPath);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  console.log(JSON.stringify(verifyFinal(runner.query), null, 2));
}

main();
