import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeBatchEvidence } from "./evidence.ts";

const base = { activeDeliverables: 4, doneDeliverables: 3, containerSeconds: 0, itemSeconds: 0, containerSensorSeconds: 0, itemSensorSeconds: 0, billedByCurrency: [] };

test("nothing tracked: NONE, no average, everything external stays unattributed", () => {
  const e = computeBatchEvidence(base);
  assert.equal(e.tracking, "NONE");
  assert.equal(e.batchLevel, null);
  assert.equal(e.perVideo, null);
  assert.equal(e.batchEquivalentAverageSeconds, null);
  assert.equal(e.externalRegisteredTime.attribution, "NONE");
  assert.deepEqual(e.externalRegisteredTime.weeks, []);
  assert.equal(e.paid, "NOT_TRACKED_PER_BATCH");
});

test("batch-level time only: a batch-equivalent AVERAGE per active deliverable (the 17SEP shape: 3.1h / 4)", () => {
  const e = computeBatchEvidence({ ...base, containerSeconds: 11_160, containerSensorSeconds: 11_160 });
  assert.equal(e.tracking, "BATCH_LEVEL");
  assert.equal(e.batchEquivalentAverageSeconds, 2_790);
  assert.deepEqual(e.batchLevel, { seconds: 11_160, sensorSeconds: 11_160 });
});

test("mixed tracking: both records kept separate, NO average offered", () => {
  const e = computeBatchEvidence({ ...base, containerSeconds: 3_600, itemSeconds: 1_800 });
  assert.equal(e.tracking, "MIXED");
  assert.equal(e.batchEquivalentAverageSeconds, null);
  assert.equal(e.batchLevel.seconds, 3_600);
  assert.equal(e.perVideo.seconds, 1_800);
});

test("per-video only: no average (the times are already actual)", () => {
  const e = computeBatchEvidence({ ...base, itemSeconds: 7_200 });
  assert.equal(e.tracking, "PER_VIDEO");
  assert.equal(e.batchEquivalentAverageSeconds, null);
});

test("Sensor share is part OF tracked time: clamped, never additive, never negative", () => {
  const e = computeBatchEvidence({ ...base, containerSeconds: 1_000, containerSensorSeconds: 5_000, itemSeconds: 500, itemSensorSeconds: -3 });
  assert.equal(e.batchLevel.sensorSeconds, 1_000);
  assert.equal(e.perVideo.sensorSeconds, 0);
});

test("zero deliverables: no divide-by-zero average", () => {
  assert.equal(computeBatchEvidence({ ...base, activeDeliverables: 0, containerSeconds: 3_600 }).batchEquivalentAverageSeconds, null);
});

test("billing evidence allocated shows only positive amounts; there is no profit/margin/rate field at all", () => {
  const e = computeBatchEvidence({ ...base, billedByCurrency: [{ currency: "USD", amount: 90 }, { currency: "EUR", amount: 0 }] });
  assert.deepEqual(e.billingAllocated, [{ currency: "USD", amount: 90 }]);
  assert.deepEqual(Object.keys(e).sort(), ["batchEquivalentAverageSeconds", "batchLevel", "billingAllocated", "deliverables", "externalRegisteredTime", "paid", "perVideo", "tracking"]);
});

// ── sensor-share semantics against the real migrated schema ────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");
function buildDb() {
  const db = new DatabaseSync(":memory:");
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const st of fs.readFileSync(path.join(migrationsDir, file), "utf8").split("--> statement-breakpoint")) if (st.trim()) db.exec(st.trim());
  }
  return db;
}
// Mirrors getProductionOrderSensorSeconds exactly.
function sensorSeconds(db, orderId) {
  const rows = db.prepare(
    `SELECT w.started_at AS s, w.ended_at AS e, v.is_operational_container AS c
     FROM work_sessions w JOIN video_logs v ON v.id = w.video_id JOIN sensor_sessions ss ON ss.approved_work_session_id = w.id
     WHERE v.production_order_id = ? AND w.ended_at IS NOT NULL`,
  ).all(orderId);
  let container = 0, item = 0;
  for (const r of rows) { const sec = Math.max(0, r.e - r.s); if (r.c) container += sec; else item += sec; }
  return { container, item };
}

test("Sensor-originated share counts only Work Sessions promoted from an APPROVED Sensor session; manual time stays manual", () => {
  const db = buildDb();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1,'T','active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1,1,'P','active');
    INSERT INTO production_orders (id, client_id, project_id, label, state, received_at, ingest_key) VALUES (1,1,1,'B','OPEN','2026-09-17','k');
    INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivered, video_kind, is_operational_container, production_order_id) VALUES
      (10,'2026-09-17','[Container]',1,1,'PLANNED',0,'CLIENT_WORK',1,1), (11,'2026-09-17','clip',1,1,'PLANNED',0,'CLIENT_WORK',0,1), (99,'2026-09-17','other order video',1,1,'PLANNED',0,'CLIENT_WORK',0,NULL);
    INSERT INTO work_sessions (id, video_id, started_at, ended_at) VALUES (1,10,1000,4600),(2,10,5000,6000),(3,11,7000,7600),(4,99,1000,9000);
    INSERT INTO sensor_devices (id, public_id, name, token_hash, scopes) VALUES (1,'d','Mac','h','x');
    INSERT INTO sensor_sessions (sensor_device_id, local_session_id, video_id, started_at, ended_at, activity_type, approval_state, approved_work_session_id, context_type) VALUES
      (1,'a',10,1000,4600,'EDITING','APPROVED',1,'CLIENT'), (1,'b',11,7000,7600,'EDITING','APPROVED',3,'CLIENT'), (1,'c',99,1000,9000,'EDITING','APPROVED',4,'CLIENT');`);
  // WS 2 (container, 1000s) has no Sensor origin -> manual; WS 4 belongs to another order.
  assert.deepEqual(sensorSeconds(db, 1), { container: 3600, item: 600 });
  const e = computeBatchEvidence({ activeDeliverables: 1, doneDeliverables: 0, containerSeconds: 4600, itemSeconds: 600, containerSensorSeconds: 3600, itemSensorSeconds: 600, billedByCurrency: [] });
  assert.equal(e.batchLevel.sensorSeconds, 3600);
  assert.ok(e.batchLevel.sensorSeconds < e.batchLevel.seconds, "manual container time is not claimed as Sensor-observed");
});

// ── source pins ─────────────────────────────────────────────────────────────
const src = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/u.test(entry) && !/\.test\./u.test(entry)) out.push(full);
  }
  return out;
}

test("the evidence block is read-only, labels the average, and never shows a profit/rate figure", () => {
  const ui = src("../../components/production-orders/BatchEvidenceBlock.tsx");
  assert.match(ui, /Batch-equivalent average/u);
  assert.match(ui, /Not the time spent on any one video; never written to a video/u);
  assert.match(ui, /No profit figure is shown/u);
  assert.match(ui, /None attributed to this batch/u);
  assert.match(ui, /Not tracked per batch/u);
  const code = (text) => text.replace(/\/\/.*$/gmu, "");
  assert.doesNotMatch(code(ui), /<button|<form|onChange|profit\s*[:=]|margin|per hour|\/h\b|hourly/iu);
  assert.doesNotMatch(code(src("./evidence.ts")), /profit\w*\s*[:=]|margin\w*\s*[:=]|hourlyRate/iu);
});

test("evidence reads are operator-only and write nothing; the Client Portal cannot reach them", () => {
  const data = src("./evidence-data.ts");
  assert.match(data, /import "server-only"/u);
  assert.match(data, /getAuthenticatedDb\(\)/u);
  assert.doesNotMatch(data, /\.(insert|update|delete)\(/u);
  const files = [...walk(path.resolve(__dirname, "../client-portal")), ...walk(path.resolve(__dirname, "../../app/client")), ...walk(path.resolve(__dirname, "../../app/g"))];
  for (const file of files) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /BatchEvidenceBlock|production-orders\/evidence/u, file);
});

test("the Production Order page renders the evidence block from the existing canonical breakdown (no second time derivation)", () => {
  const page = src("../../app/productivity/orders/[id]/page.tsx");
  assert.match(page, /<BatchEvidenceBlock evidence=\{batchEvidence\} \/>/u);
  assert.match(page, /containerSeconds: order\.timeBreakdown\.containerSeconds/u);
  assert.match(page, /itemSeconds: order\.timeBreakdown\.itemSecondsTotal/u);
});

test("running-timer display re-syncs on focus/visibility (throttled) and only reads", () => {
  const panel = src("../../components/work-sessions/NowFocusPanel.tsx");
  assert.match(panel, /addEventListener\("visibilitychange", resync\)/u);
  assert.match(panel, /addEventListener\("focus", resync\)/u);
  assert.match(panel, /now - lastResyncMs\.current < 15_000/u);
  assert.match(panel, /document\.visibilityState === "hidden"/u);
});
