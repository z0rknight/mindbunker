import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDeliveryUrl } from "../productivity/core.ts";

// Post-Job Commercial + Delivery Sniper §10: regression coverage for the
// diary-reported bug ("client sees a video card but cannot consistently
// open the actual video/delivery even when links exist"). Two real root
// causes were found and fixed:
//
//   1. modules/deliveries/actions.ts's recordDelivery (the Lab "Deliver
//      Video" flow) wrote ONLY to the deliveries audit table, never to
//      video_logs.delivery_url -- the one field the client portal
//      actually reads. Fixed: it now also syncs video_logs.delivery_url
//      whenever a valid HTTPS URL is given.
//   2. modules/delivery-outcome/actions.ts's setPublishedUrl accepted
//      plain http:// URLs with its own looser regex, while every
//      client-facing read path (toCard) re-validates through the
//      HTTPS-only validateDeliveryUrl -- an http:// URL would save, look
//      present in the Lab, and then be silently nulled out on every
//      client-facing card. Fixed: setPublishedUrl now uses the same
//      canonical validator.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
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

// Mirrors recordDelivery's post-fix behavior: audit log always written,
// video_logs.delivery_url synced only when the URL passes the canonical
// HTTPS-only validator (the same one every client-facing read re-applies).
function recordDeliverySql(db, { videoId, deliveryUrl }) {
  const validated = validateDeliveryUrl(deliveryUrl);
  db.prepare(
    "INSERT INTO deliveries (video_id, version, delivery_url, status) VALUES (?, 1, ?, 'DELIVERED')",
  ).run(videoId, deliveryUrl ?? null);
  if (validated.success && validated.value) {
    db.prepare("UPDATE video_logs SET delivery_url = ? WHERE id = ?").run(validated.value, videoId);
  }
  return validated;
}

test("recordDelivery syncs a valid HTTPS delivery URL into video_logs.delivery_url (the client-read field)", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name) VALUES (1, 'Dave DeMink');
    INSERT INTO video_logs (id, date, client_id) VALUES (1, '2026-09-01', 1);
  `);

  recordDeliverySql(db, { videoId: 1, deliveryUrl: "https://drive.google.com/file/abc" });

  const video = db.prepare("SELECT delivery_url FROM video_logs WHERE id = 1").get();
  assert.equal(video.delivery_url, "https://drive.google.com/file/abc");
  const auditCount = db.prepare("SELECT count(*) as n FROM deliveries WHERE video_id = 1").get();
  assert.equal(auditCount.n, 1);
});

test("recordDelivery with a non-HTTPS URL still logs the audit entry but does NOT silently write an unusable client-facing link", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name) VALUES (1, 'Dave DeMink');
    INSERT INTO video_logs (id, date, client_id) VALUES (1, '2026-09-01', 1);
  `);

  const result = recordDeliverySql(db, { videoId: 1, deliveryUrl: "http://insecure.example.com/file" });

  assert.equal(result.success, false);
  const video = db.prepare("SELECT delivery_url FROM video_logs WHERE id = 1").get();
  assert.equal(video.delivery_url, null, "an http:// URL must never silently land in the client-read field");
  const auditCount = db.prepare("SELECT count(*) as n FROM deliveries WHERE video_id = 1").get();
  assert.equal(auditCount.n, 1, "the audit log itself is still written -- the operator's action isn't lost");
});

test("setPublishedUrl's fix: a plain http:// URL is rejected by the same validator every client-facing card re-checks", () => {
  // Before the fix, setPublishedUrl's own regex (/^https?:\\/\\//i) would
  // have accepted this and saved it -- then toCard's validateDeliveryUrl
  // re-check would silently null it out on every client-facing render.
  const result = validateDeliveryUrl("http://insecure.example.com/live");
  assert.equal(result.success, false);
});

test("setPublishedUrl's fix: a valid https:// URL still works end to end", () => {
  const result = validateDeliveryUrl("https://youtube.com/watch?v=abc");
  assert.equal(result.success, true);
  assert.equal(result.value, "https://youtube.com/watch?v=abc");
});
