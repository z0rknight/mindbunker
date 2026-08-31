#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const AUDIT = join(ROOT, "docs/audits/AUGUST_2026_FINANCE_BASELINE.md");
const DEFAULT_PERSONAL = "/Users/emmanueldarosadillenburg/Downloads/statement_2026-08-02_2026-08-30_csv";
const DEFAULT_BUSINESS = "/Users/emmanueldarosadillenburg/Downloads/statement_2026-08-02_2026-08-30_csv -maybe company";

const ACCOUNT_SPECS = [
  { id: "118287732", scope: "BUSINESS", currency: "USD", pocket: "MAIN", label: "Business USD main", opening: 0, closing: 68.85, closingDate: "2026-08-29", sha: "5062246fba894f0105a064a06f3ce26269254a88122144834aa4ee94fd1a23eb", dir: "business" },
  { id: "171067558", scope: "BUSINESS", currency: "USD", pocket: "RESERVE", label: "Business USD reserve", opening: 0, closing: 100, closingDate: "2026-08-26", sha: "10db3012494a29627bdaf0af52578fbd16027e9f253e189dd5af5528431dbc9e", dir: "business" },
  { id: "168497359", scope: "BUSINESS", currency: "BRL", pocket: "MAIN", label: "Business BRL main", opening: 0, closing: 59.96, closingDate: "2026-08-29", sha: "ed9c2ea558fe3aa27cb7d8be752e397697974feb9afe51e870604446b3ae5337", dir: "business" },
  { id: "45837980", scope: "PERSONAL", currency: "USD", pocket: "MAIN", label: "Personal USD main", opening: 0.25, closing: 0, closingDate: "2026-08-26", sha: "3ab48582a2f91805c8df9845445f42e6282ac28ce7530ee97a307e2d6d68696f", dir: "personal" },
  { id: "44840079", scope: "PERSONAL", currency: "BRL", pocket: "MAIN", label: "Personal BRL main", opening: 3.88, closing: 37.72, closingDate: "2026-08-29", sha: "f76275d88936fec698a2bf4c5d1d12f6848ae34d056c0d80a56efe69c9ca6525", dir: "personal" },
  { id: "171018409", scope: "PERSONAL", currency: "BRL", pocket: "RESERVE", label: "Personal BRL reserve", opening: 0, closing: 33.16, closingDate: "2026-08-26", sha: "5e9b80880f26889125a6acaa80d2baac63089bf7854f8d4b6837e6f0b63a30c1", dir: "personal" },
];

const BUSINESS_EXPENSES = new Map([
  ["BANK_DETAILS_ORDER_CHECKOUT-invoice-16947135", { category: "Banking / Wise setup", existingId: null }],
  ["CARD-4157512742", { category: "Software", existingId: null }],
  ["CARD-4157487310", { category: "Software", existingId: null }],
  ["CARD-4176371528", { category: "Software", existingId: null }],
  ["CARD-4213634062", { category: "Software", existingId: null }],
  ["CARD-4239902941", { category: "Software", existingId: 4 }],
]);

const EXISTING_FX = new Map([
  ["BALANCE-5934593169", 1],
  ["BALANCE-5942390276", 2],
  ["TRANSFER-2335040967", 3],
  ["TRANSFER-2337399899", 4],
  ["BALANCE-5967532552", 5],
]);

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const header = rows.shift();
  return rows.filter((values) => values.some(Boolean)).map((values) =>
    Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])),
  );
}

function isoDate(ddmmyyyy) {
  const [day, month, year] = ddmmyyyy.split("-");
  return `${year}-${month}-${day}`;
}

function isoTimestamp(value) {
  const [date, time] = value.split(" ");
  return `${isoDate(date)}T${time}`;
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Non-finite SQL number: ${value}`);
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function stateRegister(markdown) {
  const sectionToAccount = new Map(ACCOUNT_SPECS.map((spec) => [spec.label, spec.id]));
  const result = new Map();
  const sectionPattern = /\*\*(Business|Personal) (USD|BRL) (main|reserve) `([0-9]+)`\*\*([\s\S]*?)(?=\n\*\*|\n## |\n### |$)/g;
  for (const match of markdown.matchAll(sectionPattern)) {
    const label = `${match[1]} ${match[2]} ${match[3]}`;
    const accountId = sectionToAccount.get(label);
    assert.equal(accountId, match[4], `Audit heading/account mismatch for ${label}`);
    const states = new Map();
    for (const line of match[5].split("\n")) {
      const stateMatch = line.match(/^- `([A-Z_]+)`: (.+)$/);
      if (!stateMatch) continue;
      for (const idMatch of stateMatch[2].matchAll(/`([^`]+)`/g)) {
        assert(!states.has(idMatch[1]), `Duplicate audit ID ${accountId}/${idMatch[1]}`);
        states.set(idMatch[1], stateMatch[1]);
      }
    }
    result.set(accountId, states);
  }
  assert.equal(result.size, 6, "Audit must contain six pocket state registers");
  return result;
}

function loadEvidence(personalDir, businessDir) {
  const states = stateRegister(readFileSync(AUDIT, "utf8"));
  const accounts = [];
  let totalRows = 0;
  for (const spec of ACCOUNT_SPECS) {
    const dir = spec.dir === "personal" ? personalDir : businessDir;
    const path = join(dir, `statement_${spec.id}_${spec.currency}_2026-08-02_2026-08-30.csv`);
    assert.equal(sha256(path), spec.sha, `SHA-256 mismatch: ${basename(path)}`);
    const rows = parseCsv(readFileSync(path, "utf8"));
    const accountStates = states.get(spec.id);
    assert.equal(rows.length, accountStates.size, `CSV/audit row count mismatch for ${spec.id}`);
    for (const row of rows) {
      const id = row["TransferWise ID"];
      assert(accountStates.has(id), `CSV ID absent from allow-list: ${spec.id}/${id}`);
      row.__state = accountStates.get(id);
      row.__date = isoDate(row.Date);
      row.__occurredAt = isoTimestamp(row["Date Time"]);
      row.__amount = Number(row.Amount);
      assert.equal(row.Currency, spec.currency, `Currency mismatch for ${id}`);
      assert(Number.isFinite(row.__amount) && row.__amount !== 0, `Invalid amount for ${id}`);
    }
    const chronological = [...rows].sort((a, b) => a.__occurredAt.localeCompare(b.__occurredAt));
    const oldest = chronological[0];
    const newest = chronological.at(-1);
    assert.equal(round2(Number(oldest["Running Balance"]) - oldest.__amount), spec.opening, `Opening mismatch ${spec.id}`);
    assert.equal(round2(Number(newest["Running Balance"])), spec.closing, `Closing mismatch ${spec.id}`);
    assert.equal(newest.__date, spec.closingDate, `Closing date mismatch ${spec.id}`);
    totalRows += rows.length;
    accounts.push({ spec, path, rows });
  }
  assert.equal(totalRows, 153, "Audited source must contain exactly 153 pocket rows");
  return accounts;
}

function parseWranglerJson(output) {
  const start = output.indexOf("[");
  if (start < 0) throw new Error(`Wrangler did not return JSON: ${output}`);
  return JSON.parse(output.slice(start));
}

function createRunner(mode, persistTo, sqlitePath) {
  if (mode === "sqlite") {
    return {
      query(command) {
        const output = execFileSync("sqlite3", ["-json", sqlitePath, command], {
          cwd: ROOT,
          encoding: "utf8",
        });
        return output.trim() ? JSON.parse(output) : [];
      },
      executeFile(path) {
        return execFileSync("sqlite3", [sqlitePath, `.read ${path}`], {
          cwd: ROOT,
          encoding: "utf8",
        });
      },
    };
  }
  const targetFlag = mode === "remote" ? "--remote" : "--local";
  function invoke(args) {
    const persistence = mode === "local" && persistTo ? ["--persist-to", persistTo] : [];
    return execFileSync("npx", ["wrangler", "d1", "execute", "mindbunker", targetFlag, ...persistence, "--config", "wrangler.jsonc", ...args], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  return {
    query(command) {
      const payload = parseWranglerJson(invoke(["--command", command, "--json"]));
      return payload.flatMap((entry) => entry.results ?? []);
    },
    executeFile(path) {
      return invoke(["--file", path]);
    },
  };
}

function assertCanonicalPreflight(query) {
  const transactions = query("SELECT id,type,amount,category,date,currency,client_id,subscription_id,external_source,external_id FROM transactions WHERE id IN (2,4,6) ORDER BY id");
  assert.equal(transactions.length, 3, "Canonical transactions 2, 4, 6 must exist");
  assert.deepEqual(transactions.map((row) => [row.id, row.type, row.amount, row.currency]), [
    [2, "income", 343.75, "USD"],
    [4, "expense", 19.9, "USD"],
    [6, "income", 100, "USD"],
  ]);
  assert(transactions[0].client_id !== null, "Taryn receipt must retain its existing client link");
  assert.equal(transactions[1].subscription_id, 2, "MisterHorse must retain subscription 2");

  const personal = query("SELECT id,type,amount,category,date,currency,external_source,external_id FROM personal_transactions WHERE id IN (3,4,5) ORDER BY id");
  assert.equal(personal.length, 3, "Canonical personal rows 3, 4, 5 must exist");
  assert.deepEqual(personal.map((row) => [row.id, row.type, row.amount, row.currency]), [
    [3, "expense", 203.78, "BRL"],
    [4, "expense", 38.99, "BRL"],
    [5, "expense", 12.9, "BRL"],
  ]);

  const fx = query("SELECT id,date,brl_amount,usd_amount,scope,from_currency,external_source,external_id FROM fx_conversions WHERE id BETWEEN 1 AND 5 ORDER BY id");
  assert.equal(fx.length, 5, "Canonical FX rows 1-5 must exist");
  const acceptable = [
    [["2026-08-25", 510.21, 100], ["2026-08-24", 510.21, 100]],
    [["2026-08-25", 120, 20], ["2026-08-25", 102.02, 20]],
    [["2026-08-27", 25, 153.58], ["2026-08-27", 153.58, 30]],
    [["2026-08-28", 232, 45], ["2026-08-28", 232.02, 45]],
    [["2026-08-29", 102.96, 20]],
  ];
  fx.forEach((row, index) => {
    assert(acceptable[index].some(([date, brl, usd]) => row.date === date && row.brl_amount === brl && row.usd_amount === usd), `Unexpected FX row ${row.id}`);
  });
}

function buildBackfillSql(accounts) {
  const statements = ["PRAGMA foreign_keys = ON"];
  const rowByAccountAndId = new Map();
  for (const { spec, rows } of accounts) {
    statements.push(`INSERT INTO cash_accounts(scope,currency,pocket,label,external_source,external_account_id,opening_balance,opening_as_of) VALUES (${sql(spec.scope)},${sql(spec.currency)},${sql(spec.pocket)},${sql(spec.label)},'WISE',${sql(spec.id)},${sql(spec.opening)},'2026-08-02') ON CONFLICT(external_source,external_account_id) DO NOTHING`);
    for (const row of rows) {
      rowByAccountAndId.set(`${spec.id}:${row["TransferWise ID"]}`, row);
      const counterparty = row.Merchant || row["Payer Name"] || row["Payee Name"] || null;
      statements.push(`INSERT INTO cash_movements(cash_account_id,date,occurred_at,amount,state,description,counterparty,external_source,external_id) SELECT id,${sql(row.__date)},${sql(row.__occurredAt)},${sql(row.__amount)},${sql(row.__state)},${sql(row.Description)},${sql(counterparty)},'WISE',${sql(row["TransferWise ID"])} FROM cash_accounts WHERE external_source='WISE' AND external_account_id=${sql(spec.id)} ON CONFLICT(cash_account_id,external_source,external_id) DO NOTHING`);
    }
    statements.push(`INSERT INTO cash_account_snapshots(cash_account_id,balance_amount,observed_at,source,external_id,notes) SELECT id,${sql(spec.closing)},${sql(spec.closingDate)},'WISE_CSV',${sql(`AUGUST_2026:${spec.sha}`)},'Audited statement close through latest supplied row' FROM cash_accounts WHERE external_source='WISE' AND external_account_id=${sql(spec.id)} ON CONFLICT(cash_account_id,observed_at,source) DO UPDATE SET balance_amount=excluded.balance_amount,external_id=excluded.external_id,notes=excluded.notes`);
  }

  const personalUsdRows = accounts.find(({ spec }) => spec.id === "45837980").rows;
  const businessUsdRows = accounts.find(({ spec }) => spec.id === "118287732").rows;
  const personalBrlRows = accounts.find(({ spec }) => spec.id === "44840079").rows;
  const businessBrlRows = accounts.find(({ spec }) => spec.id === "168497359").rows;

  for (const row of personalUsdRows.filter((candidate) => ["TRANSFER-2288098808", "TRANSFER-2302130238", "TRANSFER-2315340752"].includes(candidate["TransferWise ID"]))) {
    statements.push(`INSERT INTO transactions(type,amount,category,date,notes,currency,external_source,external_id) VALUES ('income',${sql(row.__amount)},'Upwork cash receipt — attribution pending',${sql(row.__date)},${sql(`Wise Payment Escrow receipt ${row["TransferWise ID"]}; commercial client/contract/earning period unresolved`)},'USD','WISE',${sql(row["TransferWise ID"])}) ON CONFLICT(external_source,external_id) DO NOTHING`);
  }
  statements.push("UPDATE transactions SET external_source='WISE',external_id='TRANSFER-2328142012' WHERE id=2 AND (external_id IS NULL OR (external_source='WISE' AND external_id='TRANSFER-2328142012'))");
  statements.push("UPDATE transactions SET external_source='WISE',external_id='TRANSFER-2335182410' WHERE id=6 AND (external_id IS NULL OR (external_source='WISE' AND external_id='TRANSFER-2335182410'))");

  for (const [externalId, meta] of BUSINESS_EXPENSES) {
    const accountId = externalId.startsWith("BANK_DETAILS") || externalId === "CARD-4157512742" ? "168497359" : "118287732";
    const row = rowByAccountAndId.get(`${accountId}:${externalId}`);
    assert(row, `Missing business expense evidence ${externalId}`);
    if (meta.existingId) {
      statements.push(`UPDATE transactions SET external_source='WISE',external_id=${sql(externalId)} WHERE id=${meta.existingId} AND (external_id IS NULL OR (external_source='WISE' AND external_id=${sql(externalId)}))`);
    } else {
      statements.push(`INSERT INTO transactions(type,amount,category,date,notes,currency,external_source,external_id) VALUES ('expense',${sql(Math.abs(row.__amount))},${sql(meta.category)},${sql(row.__date)},${sql(`${row.Description}; Wise ${externalId}`)},${sql(row.Currency)},'WISE',${sql(externalId)}) ON CONFLICT(external_source,external_id) DO NOTHING`);
    }
  }

  statements.push("INSERT INTO personal_transactions(type,amount,category,currency,date,notes,external_source,external_id) VALUES ('opening_balance',0.25,'Wise opening balance','USD','2026-08-02','Opening before oldest supplied August movement','WISE','OPENING:45837980:2026-08-02') ON CONFLICT(external_source,external_id) DO NOTHING");
  statements.push("INSERT INTO personal_transactions(type,amount,category,currency,date,notes,external_source,external_id) VALUES ('opening_balance',3.88,'Wise opening balance','BRL','2026-08-02','Opening before oldest supplied August movement','WISE','OPENING:44840079:2026-08-02') ON CONFLICT(external_source,external_id) DO NOTHING");
  for (const row of personalBrlRows.filter((candidate) => candidate.__state === "RECONCILED")) {
    const externalId = row["TransferWise ID"];
    if (externalId === "CARD-4240908881") {
      statements.push("UPDATE personal_transactions SET date='2026-08-25',external_source='WISE',external_id='CARD-4240908881' WHERE id=3 AND (external_id IS NULL OR (external_source='WISE' AND external_id='CARD-4240908881'))");
    } else if (externalId === "CARD-4236951296") {
      statements.push("UPDATE personal_transactions SET date='2026-08-24',external_source='WISE',external_id='CARD-4236951296' WHERE id=4 AND (external_id IS NULL OR (external_source='WISE' AND external_id='CARD-4236951296'))");
    } else {
      statements.push(`INSERT INTO personal_transactions(type,amount,category,currency,date,notes,external_source,external_id) VALUES ('expense',${sql(Math.abs(row.__amount))},'Wise card purchase','BRL',${sql(row.__date)},${sql(`${row.Description}; Wise ${externalId}`)},'WISE',${sql(externalId)}) ON CONFLICT(external_source,external_id) DO NOTHING`);
    }
  }
  statements.push("UPDATE personal_transactions SET date='2026-08-24',external_source='WISE',external_id='TRANSFER-2328479994' WHERE id=5 AND (external_id IS NULL OR (external_source='WISE' AND external_id='TRANSFER-2328479994'))");

  const ordinaryFx = [...personalUsdRows.map((row) => ({ row, scope: "PERSONAL" })), ...businessUsdRows.map((row) => ({ row, scope: "BUSINESS" }))]
    .filter(({ row }) => row.__state === "FX");
  assert.equal(ordinaryFx.length, 22, "Expected 22 ordinary audited FX operations");
  const ownerFx = [
    { row: businessUsdRows.find((row) => row["TransferWise ID"] === "TRANSFER-2335040967"), scope: "PERSONAL" },
    { row: businessUsdRows.find((row) => row["TransferWise ID"] === "TRANSFER-2337399899"), scope: "PERSONAL" },
  ];
  for (const { row, scope } of [...ordinaryFx, ...ownerFx]) {
    assert(row, "Missing owner FX evidence");
    const externalId = row["TransferWise ID"];
    const brl = Number(row["Exchange To Amount"]);
    const usd = Math.abs(row.__amount);
    const fee = Number(row["Total fees"] || 0);
    assert(brl > 0 && usd > 0 && fee >= 0, `Invalid FX evidence ${externalId}`);
    const existingId = EXISTING_FX.get(externalId);
    const counts = ordinaryFx.some((candidate) => candidate.row === row) ? 1 : 0;
    const purpose = counts ? null : "OWNER_TRANSFER";
    const notes = `${counts ? "Wise observed conversion" : "Wise Owner Pay cross-account conversion"}; ${externalId}`;
    if (existingId) {
      statements.push(`UPDATE fx_conversions SET date=${sql(row.__date)},brl_amount=${sql(brl)},usd_amount=${sql(usd)},scope=${sql(scope)},from_currency='USD',purpose=${sql(purpose)},external_source='WISE',external_id=${sql(externalId)},fee_amount=${sql(fee)},fee_currency='USD',counts_toward_observed_rate=${counts},notes=${sql(notes)} WHERE id=${existingId}`);
    } else {
      statements.push(`INSERT INTO fx_conversions(date,brl_amount,usd_amount,notes,scope,from_currency,purpose,external_source,external_id,fee_amount,fee_currency,counts_toward_observed_rate) VALUES (${sql(row.__date)},${sql(brl)},${sql(usd)},${sql(notes)},${sql(scope)},'USD',${sql(purpose)},'WISE',${sql(externalId)},${sql(fee)},'USD',${counts}) ON CONFLICT(external_source,external_id) DO NOTHING`);
    }
  }

  return statements.map((statement) => `${statement};`).join("\n");
}

function reconcile(query) {
  const rows = query(`SELECT ca.external_account_id,ca.label,ca.currency,ca.opening_balance,ROUND(ca.opening_balance+COALESCE(SUM(CASE WHEN cm.date<=cas.observed_at THEN cm.amount ELSE 0 END),0),2) AS mindbunker,cas.balance_amount AS wise,ROUND(cas.balance_amount-(ca.opening_balance+COALESCE(SUM(CASE WHEN cm.date<=cas.observed_at THEN cm.amount ELSE 0 END),0)),2) AS difference FROM cash_accounts ca JOIN cash_account_snapshots cas ON cas.cash_account_id=ca.id AND cas.source='WISE_CSV' LEFT JOIN cash_movements cm ON cm.cash_account_id=ca.id GROUP BY ca.id,cas.id ORDER BY ca.scope,ca.currency,ca.pocket`);
  assert.equal(rows.length, 6, "Six pocket reconciliation rows required");
  for (const row of rows) assert.equal(row.difference, 0, `${row.label} does not reconcile`);
  return rows;
}

function postflight(query) {
  const counts = query("SELECT (SELECT COUNT(*) FROM cash_accounts) cash_accounts,(SELECT COUNT(*) FROM cash_movements) cash_movements,(SELECT COUNT(*) FROM cash_account_snapshots WHERE source='WISE_CSV') cash_snapshots,(SELECT COUNT(*) FROM cash_movements WHERE state='AMBIGUOUS') ambiguous,(SELECT COUNT(*) FROM fx_conversions WHERE external_source='WISE') wise_fx,(SELECT COUNT(*) FROM transactions WHERE external_source='WISE') wise_business,(SELECT COUNT(*) FROM personal_transactions WHERE external_source='WISE') wise_personal")[0];
  assert.deepEqual([counts.cash_accounts, counts.cash_movements, counts.cash_snapshots, counts.ambiguous], [6, 153, 6, 5]);
  assert.equal(counts.wise_fx, 24, "Exactly 24 represented FX operations expected");
  assert.equal(counts.wise_business, 11, "Three known + eight inserted idempotent business Finance rows expected");
  assert.equal(counts.wise_personal, 35, "Two openings + 32 card expenses + one existing iFood transfer expected");
  const duplicates = query("SELECT external_source,external_id,COUNT(*) count FROM (SELECT external_source,external_id FROM transactions UNION ALL SELECT external_source,external_id FROM personal_transactions UNION ALL SELECT external_source,external_id FROM fx_conversions) WHERE external_source IS NOT NULL AND external_id IS NOT NULL GROUP BY external_source,external_id HAVING COUNT(*)>1");
  assert.equal(duplicates.length, 0, "Duplicate cross-ledger external identity found");
  const foreignKeys = query("PRAGMA foreign_key_check");
  assert.equal(foreignKeys.length, 0, "Foreign key violations found");
  return { counts, pockets: reconcile(query) };
}

const args = new Set(process.argv.slice(2));
const sqliteArg = process.argv.find((arg) => arg.startsWith("--sqlite="));
const mode = sqliteArg ? "sqlite" : args.has("--remote") ? "remote" : "local";
const apply = args.has("--apply");
const personalDirArg = process.argv.find((arg) => arg.startsWith("--personal-dir="));
const businessDirArg = process.argv.find((arg) => arg.startsWith("--business-dir="));
const persistToArg = process.argv.find((arg) => arg.startsWith("--persist-to="));
const accounts = loadEvidence(
  personalDirArg?.slice("--personal-dir=".length) ?? DEFAULT_PERSONAL,
  businessDirArg?.slice("--business-dir=".length) ?? DEFAULT_BUSINESS,
);
const runner = createRunner(
  mode,
  persistToArg?.slice("--persist-to=".length),
  sqliteArg?.slice("--sqlite=".length),
);
assertCanonicalPreflight(runner.query);
const backfillSql = buildBackfillSql(accounts);

if (!apply) {
  console.log(JSON.stringify({ mode, apply: false, sourceRows: 153, sourceHashesVerified: true, sqlStatements: backfillSql.split("\n").length }, null, 2));
  process.exit(0);
}

const temp = mkdtempSync(join(tmpdir(), "mindbunker-august-finance-"));
const sqlPath = join(temp, "backfill.sql");
try {
  writeFileSync(sqlPath, backfillSql, { mode: 0o600 });
  runner.executeFile(sqlPath);
  const result = postflight(runner.query);
  console.log(JSON.stringify({ mode, apply: true, sourceRows: 153, sourceHashesVerified: true, ...result }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
