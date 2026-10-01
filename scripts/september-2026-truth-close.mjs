#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_CSV = "/private/tmp/rmedia-sep-recon/wise_transactions.csv";
const DEFAULT_SOURCE = "/Users/emmanueldarosadillenburg/Desktop/_Fechando Setembro";

export const ACCOUNTS = [
  { externalId: "118287732", scope: "BUSINESS", currency: "USD", closing: 1.66, pdf: "business september wise/statement_118287732_USD_2026-09-01_2026-10-01.pdf", sha: "1a9573e2aec370f8c760fa98d25e8e56e6db5018227198498e11c90c051ca44c" },
  { externalId: "171067558", scope: "BUSINESS", currency: "USD", closing: 0, pdf: "business september wise/statement_171067558_USD_2026-09-01_2026-10-01.pdf", sha: "2f03c97c14edaf55106a939cae349193a2440b863adb5c4b0442d22a0ec57ef1" },
  { externalId: "168497359", scope: "BUSINESS", currency: "BRL", closing: 0, pdf: "business september wise/statement_168497359_BRL_2026-09-01_2026-10-01.pdf", sha: "9b1ad6f73ff2d6578e31445061167d6c8e1c166d6cf289c7af5254f25596f4b4" },
  { externalId: "45837980", scope: "PERSONAL", currency: "USD", closing: 27.01, pdf: "personal september wise/statement_45837980_USD_2026-09-01_2026-10-01.pdf", sha: "95dfca21b13340cb4288111ae32aac95a2ea199a01c40fe70132355faeef7f39" },
  { externalId: "95876029", scope: "PERSONAL", currency: "USD", closing: 0, pdf: "personal september wise/statement_95876029_USD_2026-09-01_2026-10-01.pdf", sha: "2344a3b7258aa8cf14b262eda48ac5b13661e15d0d0c1190a18a5f241f039586" },
  { externalId: "44840079", scope: "PERSONAL", currency: "BRL", closing: 159.81, pdf: "personal september wise/statement_44840079_BRL_2026-09-01_2026-10-01.pdf", sha: "55e7d0d5711898341fb94f24f688d4016d7af5e349fd220c2437108430f5c791" },
  { externalId: "171018409", scope: "PERSONAL", currency: "BRL", closing: 2.16, pdf: "personal september wise/statement_171018409_BRL_2026-09-01_2026-10-01.pdf", sha: "23897a026e504acd0d2be4e58c42921d1df59b42ab1254f0c9fd060718cae3c8" },
];

const RESOLVED_BUSINESS_POCKET_IDS = new Set([
  "CARD-4271100938", // Google Workspace
  "CARD-4280413061", // Adobe Creative Cloud
  "CARD-4280410228", // Adobe Firefly
  "CARD-4307034728", // Notion
  "CARD-4327957322", // Slack
  "CARD-4327958760", // Epidemic Sound
  "CARD-4331479295", // Cloudflare
  "CARD-4353637146", // Cloudflare
  "TRANSFER-2394134852", // Health Meeting 12 receipt
  "TRANSFER-2349804943", // operator-confirmed equipment upgrade
  "CARD-4292473562", // operator-confirmed Premiere captions software
  "CARD-4303469528", // operator-confirmed operating meal
  "CARD-4326873397", // operator-confirmed personal draw
  "CARD-4326876305", // operator-confirmed operating meal
  "TRANSFER-2369452438", // operator-confirmed operating meal
  "TRANSFER-2372318694", // operator-confirmed personal draw
]);

const ZERO_NET_EXTERNAL_IDS = new Set([
  "CARD-4305798785", // OpenAI USD 1 authorization + reversal
  "CARD-4331526960", // Anthropic USD 1 authorization + reversal
]);

const SUPPLEMENTS = [
  { scope: "business", account: "168497359", currency: "BRL", date: "2026-09-26", description: "Received money from JEFFERSON BOTTIN BERNARDES with reference Health Meeting 12", incoming: "400.00", outgoing: "", transaction_id: "TRANSFER-2394134852" },
  { scope: "business", account: "168497359", currency: "BRL", date: "2026-09-13", description: "Card transaction of 68.81 BRL issued by Ifd*Adilson Pacheco De Si PORTO ALEGRE", incoming: "", outgoing: "-68.81", transaction_id: "CARD-4326876305" },
  { scope: "business", account: "168497359", currency: "BRL", date: "2026-09-08", description: "Card transaction of 99.55 BRL issued by Ifd*Restaurante Arabe Baa PORTO ALEGRE", incoming: "", outgoing: "-99.55", transaction_id: "CARD-4303469528" },
  { scope: "business", account: "168497359", currency: "BRL", date: "2026-09-05", description: "Card transaction of 74.00 BRL issued by Htm*Hotmart Bruno Adson-T BELO HORIZONTE", incoming: "", outgoing: "-74.00", transaction_id: "CARD-4292473562" },
  { scope: "business", account: "168497359", currency: "BRL", date: "2026-09-01", description: "Card transaction of 79.04 BRL issued by Google Workspace_emmanuel SAO PAULO", incoming: "", outgoing: "-79.04", transaction_id: "CARD-4271100938" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-30", description: "Card transaction of 157.49 BRL issued by Merc Irmaos Constante PORTO ALEGRE", incoming: "", outgoing: "-157.49", transaction_id: "CARD-4406030575" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-26", description: "Card transaction of 167.63 BRL issued by Merc Irmaos Constante PORTO ALEGRE", incoming: "", outgoing: "-167.63", transaction_id: "CARD-4387496259" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-26", description: "Received money from EMMANUEL DA ROSA DILLENBURG 04194565037", incoming: "200.00", outgoing: "", transaction_id: "TRANSFER-2394170941" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-25", description: "Card transaction of 113.94 BRL issued by Ifd*Pizzaria Althaus Ltda PORTO ALEGRE", incoming: "", outgoing: "-113.94", transaction_id: "CARD-4384278811" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-25", description: "Card transaction of 105.93 BRL issued by Mercado Irmaos Constante PORTO ALEGRE", incoming: "", outgoing: "-105.93", transaction_id: "CARD-4383293614" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-17", description: "Card transaction of 39.00 BRL issued by Tabacaria Headshop 38 PORTO ALEGRE", incoming: "", outgoing: "-39.00", transaction_id: "CARD-4346245255" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-17", description: "Received money from EMMANUEL DA ROSA DILLENBURG 04194565037", incoming: "250.00", outgoing: "", transaction_id: "TRANSFER-2377335866" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-16", description: "Received money from EMMANUEL DA ROSA DILLENBURG 04194565037 with reference Filtro de cafe, mercado matinal", incoming: "40.00", outgoing: "", transaction_id: "TRANSFER-2374891980" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-09", description: "Received money from EMMANUEL DA ROSA DILLENBURG 04194565037", incoming: "633.99", outgoing: "", transaction_id: "TRANSFER-2361264293" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-08", description: "Card transaction of 78.89 BRL issued by Merc Irmaos Constante PORTO ALEGRE", incoming: "", outgoing: "-78.89", transaction_id: "CARD-4303933072" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-03", description: "Received money from EMMANUEL DA ROSA DILLENBURG 04194565037", incoming: "110.00", outgoing: "", transaction_id: "TRANSFER-2350149434" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-03", description: "Received money from EMMANUEL DA ROSA DILLENBURG 04194565037", incoming: "300.00", outgoing: "", transaction_id: "TRANSFER-2349407267" },
  { scope: "personal", account: "44840079", currency: "BRL", date: "2026-09-01", description: "Received money from EMMANUEL DA ROSA DILLENBURG 04194565037", incoming: "100.00", outgoing: "", transaction_id: "TRANSFER-2345525287" },
];

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value);
  return cells;
}

export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/u);
  const headers = parseCsvLine(lines.shift());
  return lines.filter(Boolean).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ""])));
}

function movementAmount(row) {
  return Number(row.incoming || 0) + Number(row.outgoing || 0);
}

export function classifyMovement(row) {
  const description = row.description.toLowerCase();
  if (description.startsWith("converted ")) return "FX";
  if (description.startsWith("moved ") || description.includes("emmanuel da rosa dillenburg")) return "INTERNAL_TRANSFER";
  if (row.scope === "personal" && description.includes("payment escrow")) return "AMBIGUOUS";
  if (row.scope === "personal") return "RECONCILED";
  if (RESOLVED_BUSINESS_POCKET_IDS.has(row.transaction_id)) return "RECONCILED";
  return "AMBIGUOUS";
}

export function normalizeStatementRows(csvRows) {
  const all = [...csvRows, ...SUPPLEMENTS];
  const grouped = new Map();
  for (const row of all) {
    assert(ACCOUNTS.some((account) => account.externalId === row.account), `Unknown modeled account ${row.account}`);
    const key = `${row.account}:${row.transaction_id}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push({ ...row, amount: movementAmount(row) });
    grouped.set(key, bucket);
  }
  const represented = [];
  const zeroNetOmissions = [];
  for (const [key, rows] of grouped) {
    if (rows.length === 1) {
      assert.notEqual(rows[0].amount, 0, `${key} cannot be a zero cash movement`);
      represented.push(rows[0]);
      continue;
    }
    const unique = new Map(rows.map((row) => [`${row.date}:${row.amount}:${row.description}`, row]));
    const deduplicated = [...unique.values()];
    if (deduplicated.length === 1) {
      represented.push(deduplicated[0]);
      continue;
    }
    const net = Number(deduplicated.reduce((sum, row) => sum + row.amount, 0).toFixed(2));
    assert(ZERO_NET_EXTERNAL_IDS.has(rows[0].transaction_id) && net === 0, `Unsupported duplicate external identity ${key}`);
    zeroNetOmissions.push({ key, rows: deduplicated.length, net });
  }
  return { represented: represented.sort((a, b) => a.date.localeCompare(b.date) || a.transaction_id.localeCompare(b.transaction_id)), zeroNetOmissions };
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function verifySources(sourceRoot) {
  for (const account of ACCOUNTS) assert.equal(sha256(join(sourceRoot, account.pdf)), account.sha, `Canonical PDF SHA mismatch: ${account.pdf}`);
}

function buildTransactionStatements() {
  const statements = [];
  const receiptRows = [
    ["2026-09-08", 109.51, "USD", "TRANSFER-2359165993"],
    ["2026-09-14", 225.76, "USD", "TRANSFER-2370743937"],
    ["2026-09-22", 147.01, "USD", "TRANSFER-2386078149"],
    ["2026-09-29", 162.01, "USD", "TRANSFER-2399609176"],
  ];
  for (const [date, amount, currency, externalId] of receiptRows) {
    statements.push(`INSERT INTO transactions(type,amount,category,date,notes,currency,created_at,idempotency_key,external_source,external_id) SELECT 'income',${amount},'Unattributed paid receipt',${sql(date)},'Wise Payment Escrow receipt; paid but client and billing evidence remain unproven',${sql(currency)},unixepoch(),${sql(`sep2026:${externalId}`)},'WISE',${sql(externalId)} WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE external_source='WISE' AND external_id=${sql(externalId)})`);
  }
  statements.push("INSERT INTO transactions(type,amount,category,date,notes,currency,client_id,contract_id,created_at,idempotency_key,external_source,external_id) SELECT 'income',400,'Freelance','2026-09-26','Health Meeting 12; payer Jefferson Bottin Bernardes; commercial client Agência Preview','BRL',10,4,unixepoch(),'sep2026:TRANSFER-2394134852','WISE','TRANSFER-2394134852' WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE external_source='WISE' AND external_id='TRANSFER-2394134852')");
  const expenses = [
    ["2026-09-01", 79.04, "BRL", "Software / Workspace", 7, "Google Workspace", "CARD-4271100938"],
    ["2026-09-03", 139, "BRL", "Software / Editing", 3, "Adobe Creative Cloud", "CARD-4280413061"],
    ["2026-09-03", 43, "BRL", "Software / AI", 4, "Adobe Firefly", "CARD-4280410228"],
    ["2026-09-09", 21.69, "USD", "Software / Workspace", null, "Notion", "CARD-4307034728"],
    ["2026-09-13", 59, "BRL", "Software / Production", null, "Epidemic Sound", "CARD-4327958760"],
    ["2026-09-14", 0.81, "USD", "Software / Infrastructure", null, "Cloudflare", "CARD-4331479295"],
    ["2026-09-19", 5, "USD", "Software / Infrastructure", null, "Cloudflare", "CARD-4353637146"],
  ];
  for (const [date, amount, currency, category, subscriptionId, vendor, externalId] of expenses) {
    statements.push(`INSERT INTO transactions(type,amount,category,date,notes,currency,subscription_id,created_at,idempotency_key,external_source,external_id) SELECT 'expense',${amount},${sql(category)},${sql(date)},${sql(`${vendor}; confirmed operating software from canonical Wise statement`)},${sql(currency)},${sql(subscriptionId)},unixepoch(),${sql(`sep2026:${externalId}`)},'WISE',${sql(externalId)} WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE external_source='WISE' AND external_id=${sql(externalId)})`);
  }
  statements.push("UPDATE transactions SET category='Software / Collaboration',subscription_id=11,external_source='WISE',external_id='CARD-4327957322',idempotency_key=COALESCE(idempotency_key,'sep2026:CARD-4327957322'),notes='Slack; confirmed operating software from canonical Wise statement' WHERE id=20 AND type='expense' AND amount=5.25 AND currency='USD' AND date='2026-09-13' AND (external_id IS NULL OR (external_source='WISE' AND external_id='CARD-4327957322')) AND (category!='Software / Collaboration' OR COALESCE(subscription_id,0)!=11 OR COALESCE(external_source,'')!='WISE' OR COALESCE(external_id,'')!='CARD-4327957322' OR COALESCE(idempotency_key,'')!='sep2026:CARD-4327957322' OR COALESCE(notes,'')!='Slack; confirmed operating software from canonical Wise statement')");
  statements.push("UPDATE transactions SET external_source='WISE',external_id='TRANSFER-2361264293',idempotency_key=COALESCE(idempotency_key,'sep2026:TRANSFER-2361264293'),notes='Owner transfer USD 125 from Business USD reserve; Wise converted receipt BRL 633.99 in Personal BRL' WHERE id=19 AND type='owner_pay' AND amount=125 AND currency='USD' AND date='2026-09-09' AND (external_id IS NULL OR (external_source='WISE' AND external_id='TRANSFER-2361264293')) AND (COALESCE(external_source,'')!='WISE' OR COALESCE(external_id,'')!='TRANSFER-2361264293' OR COALESCE(idempotency_key,'')!='sep2026:TRANSFER-2361264293' OR COALESCE(notes,'')!='Owner transfer USD 125 from Business USD reserve; Wise converted receipt BRL 633.99 in Personal BRL')");
  statements.push("INSERT INTO personal_transactions(type,amount,category,currency,date,notes,owner_pay_transaction_id,created_at) SELECT 'owner_pay_receipt',633.99,'Owner Pay Receipt','BRL','2026-09-09','Wise counterpart of business owner pay TRANSFER-2361264293; exact BRL received after Wise conversion',19,unixepoch() WHERE NOT EXISTS (SELECT 1 FROM personal_transactions WHERE owner_pay_transaction_id=19)");
  return statements;
}

export function buildStatements(rows) {
  const statements = ["PRAGMA foreign_keys=ON"];
  for (const row of rows) {
    const state = classifyMovement(row);
    statements.push(`UPDATE cash_movements SET state=${sql(state)},description=${sql(row.description)} WHERE cash_account_id=(SELECT id FROM cash_accounts WHERE external_source='WISE' AND external_account_id=${sql(row.account)}) AND external_source='WISE' AND external_id=${sql(row.transaction_id)} AND (state!=${sql(state)} OR description!=${sql(row.description)})`);
    statements.push(`INSERT INTO cash_movements(cash_account_id,date,occurred_at,amount,state,description,counterparty,external_source,external_id) SELECT account.id,${sql(row.date)},${sql(`${row.date}T00:00:00-03:00`)},${row.amount},${sql(state)},${sql(row.description)},NULL,'WISE',${sql(row.transaction_id)} FROM cash_accounts account WHERE account.external_source='WISE' AND account.external_account_id=${sql(row.account)} AND NOT EXISTS (SELECT 1 FROM cash_movements movement WHERE movement.cash_account_id=account.id AND movement.external_source='WISE' AND movement.external_id=${sql(row.transaction_id)})`);
  }
  for (const account of ACCOUNTS) {
    const externalId = `SEPTEMBER_2026_CLOSE:${account.externalId}:${account.sha}`;
    statements.push(`INSERT INTO cash_account_snapshots(cash_account_id,balance_amount,observed_at,source,external_id,notes) SELECT account.id,${account.closing},'2026-10-01','WISE_PDF',${sql(externalId)},'Canonical Wise statement close after September 2026' FROM cash_accounts account WHERE account.external_source='WISE' AND account.external_account_id=${sql(account.externalId)} AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots snapshot WHERE snapshot.cash_account_id=account.id AND snapshot.observed_at='2026-10-01' AND snapshot.source='WISE_PDF')`);
  }
  statements.push(...buildTransactionStatements());
  statements.push("INSERT INTO reconciliation_notes(contract_id,date,note,video_id,created_at) SELECT 2,'2026-09-30','DAVE_SEPTEMBER_2026_BILLED_REQUESTED_USD_243_25 — five videos USD 216.25 plus two Meta Ads USD 27.00; payment not proven',NULL,unixepoch() WHERE NOT EXISTS (SELECT 1 FROM reconciliation_notes WHERE contract_id=2 AND date='2026-09-30' AND note LIKE 'DAVE_SEPTEMBER_2026_BILLED_REQUESTED_USD_243_25%')");
  statements.push("INSERT INTO reconciliation_notes(contract_id,date,note,video_id,created_at) SELECT 4,'2026-09-23','WORK_SESSION_83_RECONCILIATION_REQUIRED — raw interval 41.0533h is implausible; no supported exact end time found; excluded from September operating-time read model',79,unixepoch() WHERE NOT EXISTS (SELECT 1 FROM reconciliation_notes WHERE contract_id=4 AND date='2026-09-23' AND note LIKE 'WORK_SESSION_83_RECONCILIATION_REQUIRED%')");
  statements.push("INSERT INTO reconciliation_notes(contract_id,date,note,video_id,created_at) SELECT 1,'2026-09-28','TARYN_DFY_ALIAS — client 12 is an operational workaround, not a separate commercial relationship; its admissible sessions roll up to Taryn Dubreuil',NULL,unixepoch() WHERE NOT EXISTS (SELECT 1 FROM reconciliation_notes WHERE contract_id=1 AND date='2026-09-28' AND note LIKE 'TARYN_DFY_ALIAS%')");
  return statements;
}

function createSqliteRunner(path) {
  return {
    query(command) {
      const output = execFileSync("sqlite3", ["-json", path, command], { cwd: ROOT, encoding: "utf8" });
      return output.trim() ? JSON.parse(output) : [];
    },
    execute(statements) {
      const temp = mkdtempSync(join(tmpdir(), "mindbunker-september-close-"));
      const sqlPath = join(temp, "close.sql");
      writeFileSync(sqlPath, `${statements.join(";\n")};\n`);
      try {
        execFileSync("sqlite3", [path, `.read ${sqlPath}`], { cwd: ROOT, encoding: "utf8" });
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    },
  };
}

function assertPreflight(query) {
  assert.equal(query("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1")[0]?.name, "0053_slow_shen.sql");
  assert.equal(query("PRAGMA foreign_key_check").length, 0);
  assert.deepEqual(query("SELECT id,name FROM clients WHERE id IN (2,4,5,10,12) ORDER BY id"), [
    { id: 2, name: "Taryn Dubreuil" },
    { id: 4, name: "Dave DeMink" },
    { id: 5, name: "RMEDIA Capture Release Test" },
    { id: 10, name: "Agência Preview" },
    { id: 12, name: "Taryn DFY" },
  ]);
  assert.equal(query("SELECT COUNT(*) count FROM work_sessions WHERE id=83 AND video_id=79 AND ROUND((ended_at-started_at)/3600.0,4)=41.0533")[0].count, 1);
}

function verifyFinal(query) {
  assert.equal(query("PRAGMA foreign_key_check").length, 0);
  const pockets = query("SELECT ca.external_account_id,ca.label,ca.currency,ROUND(ca.opening_balance+COALESCE(SUM(CASE WHEN cm.date<'2026-10-01' THEN cm.amount ELSE 0 END),0),2) mindbunker,cas.balance_amount wise,ROUND(cas.balance_amount-(ca.opening_balance+COALESCE(SUM(CASE WHEN cm.date<'2026-10-01' THEN cm.amount ELSE 0 END),0)),2) difference FROM cash_accounts ca JOIN cash_account_snapshots cas ON cas.cash_account_id=ca.id AND cas.source='WISE_PDF' AND cas.observed_at='2026-10-01' LEFT JOIN cash_movements cm ON cm.cash_account_id=ca.id GROUP BY ca.id,cas.id ORDER BY ca.scope,ca.currency,ca.pocket");
  assert.equal(pockets.length, 7);
  for (const pocket of pockets) assert.equal(pocket.difference, 0, `${pocket.label} does not reconcile`);
  const finance = query("SELECT currency,SUM(CASE WHEN type='income' AND category='Unattributed paid receipt' THEN amount ELSE 0 END) paid_unattributed,SUM(CASE WHEN type='income' AND client_id IS NOT NULL THEN amount ELSE 0 END) reconciled_paid,SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) confirmed_operating_cost,SUM(CASE WHEN type='owner_pay' THEN amount ELSE 0 END) owner_transfer FROM transactions WHERE date>='2026-09-01' AND date<'2026-10-01' GROUP BY currency ORDER BY currency");
  assert.deepEqual(finance, [
    { currency: "BRL", paid_unattributed: 0, reconciled_paid: 400, confirmed_operating_cost: 923.48, owner_transfer: 234.9 },
    { currency: "USD", paid_unattributed: 644.29, reconciled_paid: 0, confirmed_operating_cost: 32.75, owner_transfer: 125 },
  ]);
  const time = query("SELECT COUNT(*) sessions,ROUND(SUM((ws.ended_at-ws.started_at)/3600.0),4) hours FROM work_sessions ws JOIN video_logs v ON v.id=ws.video_id JOIN clients c ON c.id=v.client_id WHERE ws.started_at>=unixepoch('2026-09-01T03:00:00Z') AND ws.started_at<unixepoch('2026-10-01T03:00:00Z') AND (ws.ended_at-ws.started_at)<=43200 AND COALESCE(c.source,'')!='RELEASE_TEST'")[0];
  assert(time.sessions > 0);
  assert(time.hours > 0);
  assert.equal(query("SELECT COUNT(*) count FROM reconciliation_notes WHERE contract_id=1 AND date='2026-09-28' AND note LIKE 'TARYN_DFY_ALIAS%'")[0].count, 1);
  return { pockets, finance, admissibleOperatingHours: time.hours };
}

function main() {
  const args = process.argv.slice(2);
  const sqliteIndex = args.indexOf("--sqlite");
  const sqlitePath = sqliteIndex >= 0 ? args[sqliteIndex + 1] : null;
  const csvIndex = args.indexOf("--csv");
  const csvPath = csvIndex >= 0 ? args[csvIndex + 1] : DEFAULT_CSV;
  const sourceIndex = args.indexOf("--source-dir");
  const sourceRoot = sourceIndex >= 0 ? args[sourceIndex + 1] : DEFAULT_SOURCE;
  const emitIndex = args.indexOf("--emit-sql");
  const emitPath = emitIndex >= 0 ? args[emitIndex + 1] : null;
  const apply = args.includes("--apply");
  assert(sqlitePath, "--sqlite PATH is required; production application is intentionally delegated to guarded Wrangler execution");
  verifySources(sourceRoot);
  const { represented, zeroNetOmissions } = normalizeStatementRows(parseCsv(readFileSync(csvPath, "utf8")));
  const statements = buildStatements(represented);
  if (emitPath) writeFileSync(emitPath, `${statements.join(";\n")};\n`);
  const runner = createSqliteRunner(sqlitePath);
  assertPreflight(runner.query);
  const before = {
    cashMovements: runner.query("SELECT COUNT(*) count FROM cash_movements")[0].count,
    transactions: runner.query("SELECT COUNT(*) count FROM transactions")[0].count,
    snapshots: runner.query("SELECT COUNT(*) count FROM cash_account_snapshots")[0].count,
  };
  if (!apply) {
    console.log(JSON.stringify({ apply: false, representedCashMovements: represented.length, zeroNetOmissions, statements: statements.length, before }, null, 2));
    return;
  }
  runner.execute(statements);
  const verified = verifyFinal(runner.query);
  const after = {
    cashMovements: runner.query("SELECT COUNT(*) count FROM cash_movements")[0].count,
    transactions: runner.query("SELECT COUNT(*) count FROM transactions")[0].count,
    snapshots: runner.query("SELECT COUNT(*) count FROM cash_account_snapshots")[0].count,
  };
  console.log(JSON.stringify({ apply: true, before, after, zeroNetOmissions, verified }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
