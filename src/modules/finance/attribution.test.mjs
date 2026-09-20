import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  attributedAmount,
  checkAttributionTarget,
  describeEvidenceForOrder,
  summarizeEvidenceAttribution,
  toMinutes,
  validateAttributionMinutes,
} from "./attribution.ts";
import { computeBatchEvidence } from "../production-orders/evidence.ts";

// ── pure semantics ──────────────────────────────────────────────────────────
test("with no allocations, ALL registered time is unallocated -- a valid state, not an error", () => {
  const s = summarizeEvidenceAttribution(360, []);
  assert.deepEqual(s, { registeredMinutes: 360, explicitMinutes: 0, historicalDerivedMinutes: 0, unallocatedMinutes: 360, amountOnlyRows: 0 });
});

test("explicit attribution preserves the exact duration; historical derived rows are reported separately", () => {
  const s = summarizeEvidenceAttribution(320, [
    { id: 1, method: "MANUAL_MINUTES", minutes: 75 },
    ...Array.from({ length: 9 }, (_, i) => ({ id: 10 + i, method: "DERIVED_PROPORTION", minutes: 10 })),
  ]);
  assert.equal(s.explicitMinutes, 75);
  assert.equal(s.historicalDerivedMinutes, 90);
  assert.equal(s.unallocatedMinutes, 155);
});

test("amount-only allocations never reduce unallocated minutes (unknown beats invented precision)", () => {
  const s = summarizeEvidenceAttribution(100, [{ id: 1, method: "MANUAL_AMOUNT", minutes: null }]);
  assert.equal(s.unallocatedMinutes, 100);
  assert.equal(s.amountOnlyRows, 1);
});

test("durations: hours + minutes to whole positive minutes, otherwise rejected", () => {
  assert.equal(toMinutes("4", "0"), 240);
  assert.equal(toMinutes("", "45"), 45);
  assert.equal(toMinutes(1, 30), 90);
  for (const bad of [["0", "0"], ["-1", "0"], ["1.5", ""], ["abc", ""], [null, null]]) assert.equal(toMinutes(...bad), null, JSON.stringify(bad));
});

test("cannot attribute more than the time still unallocated", () => {
  assert.equal(validateAttributionMinutes(240, 360), null);
  assert.match(validateAttributionMinutes(240, 120), /more than the time still unallocated/u);
  assert.match(validateAttributionMinutes(10, 0), /already attributed/u);
  assert.match(validateAttributionMinutes(null, 100), /greater than zero/u);
});

test("ownership: cross-client targets are rejected; containers/videos are used correctly", () => {
  const own = { videoId: 5, clientId: 2, isOperationalContainer: false };
  assert.equal(checkAttributionTarget(2, "VIDEO", own), null);
  assert.match(checkAttributionTarget(2, "VIDEO", { ...own, clientId: 4 }), /different client/u);
  assert.match(checkAttributionTarget(2, "VIDEO", { ...own, isOperationalContainer: true }), /Production Order instead/u);
  assert.equal(checkAttributionTarget(2, "PRODUCTION_ORDER", { videoId: 8, clientId: 2, isOperationalContainer: true, orderClientId: 2 }), null);
  assert.match(checkAttributionTarget(2, "PRODUCTION_ORDER", { videoId: 8, clientId: 2, isOperationalContainer: true, orderClientId: 4 }), /different client/u);
  assert.match(checkAttributionTarget(2, "PRODUCTION_ORDER", { videoId: 0, clientId: 2, isOperationalContainer: false, orderClientId: 2 }), /no operational container/u);
  assert.match(checkAttributionTarget(2, "VIDEO", null), /not found/u);
  assert.match(checkAttributionTarget(2, "PRODUCTION_ORDER", null), /not found/u);
});

test("the attributed amount is the exact share of THIS evidence's gross (never spread across videos)", () => {
  assert.equal(attributedAmount(150, 360, 240), 100);
  assert.equal(attributedAmount(133.33, 320, 10), 4.17);
  assert.equal(attributedAmount(100, 0, 10), 0);
});

test("the 6h example: 4h attributed to the batch, 2h unallocated, and the four figures reconcile", () => {
  const d = describeEvidenceForOrder({
    evidenceId: 1, periodStart: "2026-09-07", periodEnd: "2026-09-13", registeredMinutes: 360,
    allocations: [{ id: 1, method: "MANUAL_MINUTES", minutes: 240, onThisOrder: true }],
  });
  assert.equal(d.registeredMinutes, 360);
  assert.equal(d.explicitHereMinutes, 240);
  assert.equal(d.elsewhereMinutes, 0);
  assert.equal(d.unallocatedMinutes, 120);
  assert.equal(d.explicitHereMinutes + d.derivedHereMinutes + d.elsewhereMinutes + d.unallocatedMinutes, d.registeredMinutes);
});

test("time attributed to another target is 'elsewhere', not here", () => {
  const d = describeEvidenceForOrder({
    evidenceId: 1, periodStart: "a", periodEnd: "b", registeredMinutes: 600,
    allocations: [{ id: 1, method: "MANUAL_MINUTES", minutes: 200, onThisOrder: true }, { id: 2, method: "MANUAL_MINUTES", minutes: 100, onThisOrder: false }],
  });
  assert.deepEqual([d.explicitHereMinutes, d.elsewhereMinutes, d.unallocatedMinutes], [200, 100, 300]);
});

test("batch evidence carries the attribution; with none it says NONE; zero rows are dropped", () => {
  const base = { activeDeliverables: 4, doneDeliverables: 0, containerSeconds: 0, itemSeconds: 0, containerSensorSeconds: 0, itemSensorSeconds: 0, billedByCurrency: [] };
  assert.equal(computeBatchEvidence(base).externalRegisteredTime.attribution, "NONE");
  const week = describeEvidenceForOrder({ evidenceId: 1, periodStart: "a", periodEnd: "b", registeredMinutes: 360, allocations: [{ id: 1, method: "MANUAL_MINUTES", minutes: 240, onThisOrder: true }] });
  const empty = describeEvidenceForOrder({ evidenceId: 2, periodStart: "a", periodEnd: "b", registeredMinutes: 60, allocations: [{ id: 2, method: "MANUAL_MINUTES", minutes: 30, onThisOrder: false }] });
  const e = computeBatchEvidence({ ...base, externalTime: [week, empty] });
  assert.equal(e.externalRegisteredTime.attribution, "ATTRIBUTED");
  assert.equal(e.externalRegisteredTime.weeks.length, 1);
  assert.equal(e.externalRegisteredTime.explicitHereMinutes, 240);
  assert.equal(Object.keys(e).some((k) => /profit|margin|rate|revenue/iu.test(k)), false);
});

// ── against the real migrated schema (mirrors the action SQL) ───────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");
function buildDb() {
  const db = new DatabaseSync(":memory:");
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const st of fs.readFileSync(path.join(migrationsDir, file), "utf8").split("--> statement-breakpoint")) if (st.trim()) db.exec(st.trim());
  }
  return db;
}
function seed(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1,'Taryn','active'),(2,'Dave','active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1,1,'CW','active'),(2,2,'Shorts','active');
    INSERT INTO commercial_contracts (id, client_id, platform, billing_type, hourly_rate, currency, status) VALUES (1,1,'Upwork','HOURLY',25,'USD','ACTIVE');
    INSERT INTO billing_evidence (id, contract_id, period_start, period_end, billable_minutes, rate, gross_amount, currency, source, idempotency_key) VALUES (1,1,'2026-09-07','2026-09-13',360,25,150,'USD','UPWORK_REPORT','k1');
    INSERT INTO production_orders (id, client_id, project_id, label, state, received_at, ingest_key) VALUES (1,1,1,'17SEP CW','OPEN','2026-09-17','o1'),(2,2,2,'Dave batch','OPEN','2026-09-17','o2');
    INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivered, video_kind, is_operational_container, production_order_id) VALUES
      (10,'2026-09-17','[Container] 17SEP',1,1,'PLANNED',0,'CLIENT_WORK',1,1),(11,'2026-09-17','clip 1',1,1,'IN_PROGRESS',0,'CLIENT_WORK',0,1),
      (12,'2026-09-17','clip 2',1,1,'DONE',1,'CLIENT_WORK',0,1),(13,'2026-09-17','clip 3',1,1,'PLANNED',0,'CLIENT_WORK',0,1),
      (20,'2026-09-17','[Container] Dave',2,2,'PLANNED',0,'CLIENT_WORK',1,2),(21,'2026-09-17','Dave clip',2,2,'PLANNED',0,'CLIENT_WORK',0,2);
  `);
}
// Mirrors attributeRegisteredTime with the REAL pure guards.
function attribute(db, { evidenceId, type, targetId, hours, minutes }) {
  const ev = db.prepare("SELECT e.id, e.billable_minutes bm, e.gross_amount g, e.currency cur, c.client_id cid FROM billing_evidence e JOIN commercial_contracts c ON c.id=e.contract_id WHERE e.id=?").get(evidenceId);
  let target = null;
  if (type === "PRODUCTION_ORDER") {
    const o = db.prepare("SELECT id, client_id cid FROM production_orders WHERE id=?").get(targetId);
    if (o) { const c = db.prepare("SELECT id, client_id cid, is_operational_container ic FROM video_logs WHERE production_order_id=? AND is_operational_container=1").get(o.id); target = c ? { videoId: c.id, clientId: c.cid, isOperationalContainer: true, orderClientId: o.cid } : { videoId: 0, clientId: o.cid, isOperationalContainer: false, orderClientId: o.cid }; }
  } else {
    const v = db.prepare("SELECT id, client_id cid, is_operational_container ic FROM video_logs WHERE id=?").get(targetId);
    if (v) target = { videoId: v.id, clientId: v.cid, isOperationalContainer: !!v.ic };
  }
  const targetError = checkAttributionTarget(ev.cid, type, target);
  if (targetError) return { success: false, error: targetError };
  const existing = db.prepare("SELECT id, method, minutes FROM billing_allocations WHERE billing_evidence_id=?").all(evidenceId);
  const summary = summarizeEvidenceAttribution(ev.bm, existing);
  const mins = toMinutes(hours, minutes);
  const minsError = validateAttributionMinutes(mins, summary.unallocatedMinutes);
  if (minsError) return { success: false, error: minsError };
  db.prepare("INSERT INTO billing_allocations (billing_evidence_id, video_id, method, amount, minutes, currency) VALUES (?,?,?,?,?,?)").run(evidenceId, target.videoId, "MANUAL_MINUTES", attributedAmount(ev.g, ev.bm, mins), mins, ev.cur);
  return { success: true };
}
const snapshot = (db) => JSON.stringify({
  videos: db.prepare("SELECT * FROM video_logs ORDER BY id").all(),
  counts: ["transactions", "work_sessions", "sensor_sessions", "crm_events", "payment_requests"].map((t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c),
  evidence: db.prepare("SELECT * FROM billing_evidence").all(),
});

test("6h registered: 4h attributed to ONE order (container only), 2h stays unallocated, children untouched", () => {
  const db = buildDb(); seed(db);
  const before = snapshot(db);
  assert.equal(attribute(db, { evidenceId: 1, type: "PRODUCTION_ORDER", targetId: 1, hours: 4, minutes: 0 }).success, true);
  const rows = db.prepare("SELECT video_id, method, minutes, amount FROM billing_allocations").all();
  assert.deepEqual(rows.map((r) => [r.video_id, r.method, r.minutes, r.amount]), [[10, "MANUAL_MINUTES", 240, 100]]);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM billing_allocations WHERE video_id IN (11,12,13)").get().c, 0, "no automatic child-video distribution");
  const s = summarizeEvidenceAttribution(360, db.prepare("SELECT id, method, minutes FROM billing_allocations").all());
  assert.deepEqual([s.registeredMinutes, s.explicitMinutes, s.unallocatedMinutes], [360, 240, 120]);
  // no payment/status/session/evidence side effects
  assert.equal(snapshot(db), before);
});

test("over-allocation, cross-client orders/videos and container-as-video are all rejected without writing", () => {
  const db = buildDb(); seed(db);
  assert.equal(attribute(db, { evidenceId: 1, type: "PRODUCTION_ORDER", targetId: 1, hours: 4 }).success, true);
  assert.match(attribute(db, { evidenceId: 1, type: "PRODUCTION_ORDER", targetId: 1, hours: 3 }).error, /more than/u);
  assert.match(attribute(db, { evidenceId: 1, type: "PRODUCTION_ORDER", targetId: 2, hours: 1 }).error, /different client/u);
  assert.match(attribute(db, { evidenceId: 1, type: "VIDEO", targetId: 21, hours: 1 }).error, /different client/u);
  assert.match(attribute(db, { evidenceId: 1, type: "VIDEO", targetId: 10, hours: 1 }).error, /Production Order instead/u);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM billing_allocations").get().c, 1);
});

test("a single video can be attributed when the operator really knows; the rest stays unallocated", () => {
  const db = buildDb(); seed(db);
  assert.equal(attribute(db, { evidenceId: 1, type: "VIDEO", targetId: 12, hours: 1, minutes: 30 }).success, true);
  const s = summarizeEvidenceAttribution(360, db.prepare("SELECT id, method, minutes FROM billing_allocations").all());
  assert.deepEqual([s.explicitMinutes, s.unallocatedMinutes], [90, 270]);
});

test("historical DERIVED_PROPORTION allocations stay readable and are not counted as explicit attribution", () => {
  const db = buildDb(); seed(db);
  db.prepare("INSERT INTO billing_allocations (billing_evidence_id, video_id, method, amount, minutes, currency) VALUES (1,11,'DERIVED_PROPORTION',4.17,10,'USD'),(1,12,'DERIVED_PROPORTION',4.17,10,'USD')").run();
  const rows = db.prepare("SELECT id, method, minutes FROM billing_allocations").all();
  const s = summarizeEvidenceAttribution(360, rows);
  assert.deepEqual([s.explicitMinutes, s.historicalDerivedMinutes, s.unallocatedMinutes], [0, 20, 340]);
  assert.equal(attribute(db, { evidenceId: 1, type: "PRODUCTION_ORDER", targetId: 1, hours: 1 }).success, true);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM billing_allocations WHERE method='DERIVED_PROPORTION'").get().c, 2, "history untouched");
});

// ── source pins ─────────────────────────────────────────────────────────────
const src = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const code = (text) => text.replace(/\/\/.*$/gmu, "");
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/u.test(entry) && !/\.test\./u.test(entry)) out.push(full);
  }
  return out;
}

test("no proportional auto-allocation exists in the attribution code", () => {
  for (const file of ["./attribution.ts", "./attribution-actions.ts", "./attribution-data.ts", "../../app/finance/contracts/[id]/AttributionPanel.tsx"]) {
    assert.doesNotMatch(code(src(file)), /computeDerivedProportionAllocation|previewDerivedBillingAllocation|videoMinutes|\/ *(videos?|items?|deliverables?)\.length|Sensor.*minutes|workSessions/iu, file);
  }
  // the action only ever writes MANUAL_MINUTES
  assert.match(src("./attribution-actions.ts"), /method: "MANUAL_MINUTES"/u);
  assert.doesNotMatch(code(src("./attribution-actions.ts")), /method: "DERIVED_PROPORTION"/u);
});

test("attribution writes only billing_allocations: no payment, status, session or evidence mutation", () => {
  const actions = code(src("./attribution-actions.ts"));
  assert.match(actions, /^"use server"/mu);
  assert.equal((actions.match(/await getAuthenticatedDb\(\)/gu) ?? []).length, 2);
  assert.match(actions, /db\.insert\(billingAllocations\)/u);
  assert.doesNotMatch(actions, /\.update\(|transactions|paymentRequests|workSessions|sensorSessions|crmEvents/u);
  assert.equal((actions.match(/\.delete\(/gu) ?? []).length, 1);
  assert.match(actions, /eq\(billingAllocations\.method, "MANUAL_MINUTES"\)/u, "history can't be deleted");
  assert.doesNotMatch(code(src("./attribution-data.ts")), /\.(insert|update|delete)\(/u);
});

test("legacy recordBillingAllocation now rejects cross-client videos too", () => {
  assert.match(src("./actions.ts"), /evidenceClientId !== owner\[0\]\.videoClientId/u);
});

test("operator-only: the Client Portal / gateway cannot reach attribution", () => {
  const files = [...walk(path.resolve(__dirname, "../client-portal")), ...walk(path.resolve(__dirname, "../../app/client")), ...walk(path.resolve(__dirname, "../../app/g"))];
  for (const file of files) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /finance\/attribution|AttributionPanel|getOrderExternalTimeEvidence/u, file);
});

test("UI copy keeps the semantics: not an invoice/payment/revenue; unallocated is fine; nothing auto-spread", () => {
  const panel = src("../../app/finance/contracts/[id]/AttributionPanel.tsx");
  assert.match(panel, /not an invoice or a payment/u);
  assert.match(panel, /leaving it unallocated is fine/u);
  assert.match(panel, /Nothing is spread across videos automatically/u);
  const block = src("../../components/production-orders/BatchEvidenceBlock.tsx");
  assert.match(block, /not billed revenue, not paid/u);
  assert.doesNotMatch(code(block), /profit\s*[:=]|margin|effective rate|per hour/iu);
});

test("the order page feeds the evidence block from the attribution read (no second derivation)", () => {
  const page = src("../../app/productivity/orders/[id]/page.tsx");
  assert.match(page, /getOrderExternalTimeEvidence\(orderId\)/u);
  assert.match(page, /externalTime,\n  \}\);/u);
});

// ── backlog closure: ONE definition of "unallocated" across Finance and CRM ─
import { unallocatedShareOfEvidence } from "./attribution.ts";

test("CRM unallocated evidence: no allocations -> the whole gross is unallocated", () => {
  assert.deepEqual(unallocatedShareOfEvidence({ billableMinutes: 180, grossAmount: 75, allocations: [] }), { fullyAllocated: false, unallocatedAmount: 75 });
});

test("CRM unallocated evidence: a PARTLY attributed row still shows, with only the remaining share", () => {
  const share = unallocatedShareOfEvidence({ billableMinutes: 180, grossAmount: 75, allocations: [{ id: 1, method: "MANUAL_MINUTES", minutes: 60 }] });
  assert.equal(share.fullyAllocated, false);
  assert.equal(share.unallocatedAmount, 50);
});

test("CRM unallocated evidence: a fully attributed row drops out; a legacy amount-only allocation still counts as allocated", () => {
  assert.equal(unallocatedShareOfEvidence({ billableMinutes: 180, grossAmount: 75, allocations: [{ id: 1, method: "MANUAL_MINUTES", minutes: 180 }] }).fullyAllocated, true);
  assert.equal(unallocatedShareOfEvidence({ billableMinutes: 180, grossAmount: 75, allocations: [{ id: 1, method: "MANUAL_AMOUNT", minutes: null }] }).fullyAllocated, true);
});

test("the Finance panel and the CRM surface agree on what is unallocated (same summary, same minutes)", () => {
  const allocations = [{ id: 1, method: "MANUAL_MINUTES", minutes: 45 }, { id: 2, method: "DERIVED_PROPORTION", minutes: 15 }];
  const summary = summarizeEvidenceAttribution(180, allocations);
  const share = unallocatedShareOfEvidence({ billableMinutes: 180, grossAmount: 90, allocations });
  assert.equal(summary.unallocatedMinutes, 120);
  assert.equal(share.unallocatedAmount, 60, "120 of 180 minutes of a $90 row");
});

test("getClientProjectCommercialAttribution uses the shared helper instead of a row-level 'any allocation' check", () => {
  const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  assert.match(actions, /unallocatedShareOfEvidence\(\{/u);
  assert.doesNotMatch(actions, /new Set\(allocationRows\.map\(\(row\) => row\.billingEvidenceId\)\)/u);
});
