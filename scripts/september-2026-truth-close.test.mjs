import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStatements, classifyMovement, normalizeStatementRows, parseCsv } from "./september-2026-truth-close.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

test("CSV parser preserves quoted descriptions", () => {
  const rows = parseCsv('scope,account,currency,date,description,incoming,outgoing,transaction_id\n"business","1","USD","2026-09-01","Vendor, Inc",,"-5.00","CARD-1"');
  assert.equal(rows[0].description, "Vendor, Inc");
});

test("custody classification separates internal, FX, ambiguous and reconciled", () => {
  assert.equal(classifyMovement({ scope: "business", description: "Converted 5 USD to BRL", transaction_id: "BALANCE-1" }), "FX");
  assert.equal(classifyMovement({ scope: "business", description: "Sent money to Emmanuel da Rosa Dillenburg", transaction_id: "TRANSFER-1" }), "INTERNAL_TRANSFER");
  assert.equal(classifyMovement({ scope: "personal", description: "Received money from Payment Escrow I", transaction_id: "TRANSFER-2" }), "AMBIGUOUS");
  assert.equal(classifyMovement({ scope: "business", description: "Card transaction", transaction_id: "CARD-4353637146" }), "RECONCILED");
});

test("same Wise authorization and reversal are omitted as a zero-net schema gap", () => {
  const base = [
    { scope: "business", account: "118287732", currency: "USD", date: "2026-09-09", description: "OpenAI reversal", incoming: "1.00", outgoing: "", transaction_id: "CARD-4305798785" },
    { scope: "business", account: "118287732", currency: "USD", date: "2026-09-09", description: "OpenAI authorization", incoming: "", outgoing: "-1.00", transaction_id: "CARD-4305798785" },
  ];
  const normalized = normalizeStatementRows(base);
  assert.equal(normalized.represented.some((row) => row.transaction_id === "CARD-4305798785"), false);
  assert.deepEqual(normalized.zeroNetOmissions.find((row) => row.key.endsWith("CARD-4305798785")), { key: "118287732:CARD-4305798785", rows: 2, net: 0 });
});

test("production SQL keeps semantic layers separate", () => {
  const sql = buildStatements([]).join("\n");
  assert.match(sql, /Unattributed paid receipt/u);
  assert.match(sql, /DAVE_SEPTEMBER_2026_BILLED_REQUESTED_USD_243_25/u);
  assert.match(sql, /WORK_SESSION_83_RECONCILIATION_REQUIRED/u);
  assert.match(sql, /TARYN_DFY_ALIAS/u);
  assert.match(sql, /category='Software \/ Collaboration'/u);
  assert.doesNotMatch(sql, /UPDATE work_sessions/u);
  assert.doesNotMatch(sql, /UPDATE clients/u);
  assert.doesNotMatch(sql, /DELETE FROM/u);
});

test("final Taryn/Upwork close is guarded and preserves later operator state", () => {
  const sql = fs.readFileSync(path.join(scriptsDir, "september-2026-taryn-upwork-close.sql"), "utf8");
  assert.match(sql, /UPWORK_SEPTEMBER_2026_RECONCILIATION/u);
  assert.match(sql, /TARYN_UPWORK_SEPTEMBER_2026/u);
  assert.match(sql, /UPWORK_TX_2026-09-25_SERVICE_FEE/u);
  assert.match(sql, /PRIOR_NOTE_PRESERVED/u);
  for (const id of [21, 22, 23, 24]) assert.match(sql, new RegExp(`WHERE id=${id}\\b`, "u"));
  for (const id of [219, 260, 295, 327]) assert.match(sql, new RegExp(`WHERE id=${id}\\b`, "u"));
  assert.doesNotMatch(sql, /UPDATE\s+clients\b/iu);
  assert.doesNotMatch(sql, /UPDATE\s+work_sessions\b/iu);
  assert.doesNotMatch(sql, /DELETE\s+FROM\b/iu);
});
