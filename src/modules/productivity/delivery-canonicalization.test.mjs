import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDeliveryUrl, planVideoTransition } from "./core.ts";

// Commercial Evidence train -- Dave "Landing Page" delivery truth. The Quick
// Note (event 75) held the exact delivery link while video 25's canonical
// delivery_url was empty. The write is ONE guarded column update; these tests
// pin its semantics and that setting delivery_url is delivery evidence only.

const NOTE = "Download Link:\nhttps://drive.google.com/file/d/1Bv8Dy5MPKITs7VhBiVehTeIWWF0p8yV5/view?usp=share_link\nPayment Link:\nhttps://wise.com/pay/r/WrNMDMEEYGcfkSM";
const DELIVERY = "https://drive.google.com/file/d/1Bv8Dy5MPKITs7VhBiVehTeIWWF0p8yV5/view?usp=share_link";

// The exact statement executed against production (see the report).
const GUARDED_UPDATE = `UPDATE video_logs SET delivery_url = ?1 WHERE id = 25 AND client_id = 4 AND title = 'Landing Page' AND status = 'DONE' AND delivered = 1 AND delivery_url IS NULL`;

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
  db.exec(`INSERT INTO clients (id, name, status) VALUES (4,'Dave DeMink','active'),(5,'Other','active');
    INSERT INTO projects (id, client_id, name, status) VALUES (6,4,'Website Videos','active');
    INSERT INTO video_logs (id, date, title, client_id, project_id, status, delivered, video_kind, review_url, notes)
      VALUES (25,'2026-08-26','Landing Page',4,6,'DONE',1,'CLIENT_WORK','https://f.io/glunWF7s','a note'),
             (26,'2026-08-26','Landing Page',5,NULL,'DONE',1,'CLIENT_WORK',NULL,NULL);`);
  db.prepare("INSERT INTO crm_events (client_id, video_id, type, actor, description) VALUES (NULL, 25, 'video.note_added', 'admin', ?)").run(NOTE);
}
const snap = (db) => JSON.stringify({
  video25: { ...db.prepare("SELECT * FROM video_logs WHERE id=25").get(), delivery_url: undefined },
  others: db.prepare("SELECT * FROM video_logs WHERE id<>25").all(),
  counts: ["transactions", "work_sessions", "sensor_sessions", "billing_evidence", "billing_allocations", "payment_requests", "crm_events", "quotes"].map((t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c),
});

test("the URL comes from a note explicitly labelled as the download link, and is a valid HTTPS delivery URL", () => {
  const [label, link] = NOTE.split("\n");
  assert.equal(label, "Download Link:");
  assert.equal(link, DELIVERY);
  const validated = validateDeliveryUrl(DELIVERY);
  assert.equal(validated.success, true);
  assert.equal(validated.value, DELIVERY, "stored exactly as written");
  assert.notEqual(DELIVERY, NOTE.split("\n")[3], "the payment link is never the delivery link");
});

test("the guarded write sets ONLY delivery_url; status, delivered, notes, review link and every commercial table are unchanged", () => {
  const db = buildDb(); seed(db);
  const before = snap(db);
  const result = db.prepare(GUARDED_UPDATE).run(DELIVERY);
  assert.equal(Number(result.changes), 1);
  assert.equal(db.prepare("SELECT delivery_url FROM video_logs WHERE id=25").get().delivery_url, DELIVERY);
  assert.equal(snap(db), before, "nothing else changed");
  const row = db.prepare("SELECT status, delivered, review_url, published_url FROM video_logs WHERE id=25").get();
  assert.deepEqual([row.status, row.delivered, row.review_url, row.published_url], ["DONE", 1, "https://f.io/glunWF7s", null]);
  // the historical Quick Note is preserved as evidence
  assert.match(db.prepare("SELECT description FROM crm_events WHERE video_id=25 AND type='video.note_added'").get().description, /Download Link:/u);
});

test("the guard makes the write idempotent and never overwrites an existing URL or another client's video", () => {
  const db = buildDb(); seed(db);
  assert.equal(Number(db.prepare(GUARDED_UPDATE).run(DELIVERY).changes), 1);
  assert.equal(Number(db.prepare(GUARDED_UPDATE).run("https://example.com/other").changes), 0, "already set -> no overwrite");
  assert.equal(db.prepare("SELECT delivery_url FROM video_logs WHERE id=25").get().delivery_url, DELIVERY);
  assert.equal(db.prepare("SELECT delivery_url FROM video_logs WHERE id=26").get().delivery_url, null, "the same-titled video of another client is untouched");
  const wrongClient = buildDb(); seed(wrongClient);
  wrongClient.prepare("UPDATE video_logs SET client_id = 5 WHERE id = 25").run();
  assert.equal(Number(wrongClient.prepare(GUARDED_UPDATE).run(DELIVERY).changes), 0, "wrong client -> no write");
});

test("delivery_url is not an input to any status decision: transitions are decided from status and review link only", () => {
  // planVideoTransition has no delivery_url parameter at all
  const done = planVideoTransition({ currentStatus: "READY_FOR_REVIEW", expectedStatus: "READY_FOR_REVIEW", targetStatus: "DONE", reviewUrl: "https://f.io/x" });
  assert.equal(done.success, true);
  const core = readFileSync(new URL("./core.ts", import.meta.url), "utf8");
  const plan = core.slice(core.indexOf("export function planVideoTransition"), core.indexOf("export function", core.indexOf("export function planVideoTransition") + 10));
  assert.doesNotMatch(plan, /deliveryUrl/u);
});

test("delivery_url consumers are display-only: the Client Portal shows a Watch link and nothing derives payment or acceptance from it", () => {
  for (const rel of ["../../app/client/dashboard/VideoCard.tsx", "../../app/client/[token]/page.tsx", "../../app/client/dashboard/videos/[id]/page.tsx"]) {
    const text = readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.match(text, /video\.deliveryUrl/u, rel);
  }
  for (const rel of ["../finance/attribution-actions.ts", "../finance/actions.ts", "../quotes/actions.ts", "../payment-requests/data.ts"]) {
    const text = readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\/\/.*$/gmu, "");
    assert.doesNotMatch(text, /deliveryUrl|delivery_url/u, `${rel} must not depend on delivery_url`);
  }
});
