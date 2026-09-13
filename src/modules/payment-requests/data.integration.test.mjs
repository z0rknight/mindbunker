import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Dave Monday Release -- mirrors getOpenPaymentRequestForClient's exact
// SQL (modules/payment-requests/data.ts) against the real migration
// chain, matching this repo's established integration-test convention.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
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

// Verbatim mirror of getOpenPaymentRequestForClient's SELECT.
function selectOpenPaymentRequest(db, clientId) {
  return db
    .prepare(
      `SELECT id, client_id as clientId, amount_cents as amountCents, currency,
              payment_url as paymentUrl, status, note
       FROM payment_requests
       WHERE client_id = ? AND status = 'OPEN'
       LIMIT 1`,
    )
    .get(clientId);
}

function seedFixture(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES
      (1, 'Taryn Dubreuil', 'active'),
      (4, 'Dave DeMink', 'active');

    -- Dave's real OPEN request.
    INSERT INTO payment_requests (id, client_id, amount_cents, currency, payment_url, status)
    VALUES (1, 4, 37266, 'USD', 'https://wise.com/pay/r/HO2YUO3U08AXDzo', 'OPEN');

    -- Taryn's own, unrelated OPEN request -- must never leak into Dave's read.
    INSERT INTO payment_requests (id, client_id, amount_cents, currency, payment_url, status)
    VALUES (2, 1, 10000, 'USD', 'https://wise.com/pay/r/other', 'OPEN');
  `);
}

test("an OPEN request is visible to its own client", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const row = selectOpenPaymentRequest(db, 4);
  assert.ok(row);
  assert.equal(row.amountCents, 37266);
  assert.equal(row.currency, "USD");
  assert.equal(row.paymentUrl, "https://wise.com/pay/r/HO2YUO3U08AXDzo");
  db.close();
});

test("client isolation: one client's OPEN request never resolves for another client", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  const daveRow = selectOpenPaymentRequest(db, 4);
  const tarynRow = selectOpenPaymentRequest(db, 1);
  assert.notEqual(daveRow.id, tarynRow.id);
  assert.equal(daveRow.amountCents, 37266);
  assert.equal(tarynRow.amountCents, 10000);
  db.close();
});

test("a PAID request is not returned as the open request -- no stale CTA", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  db.exec(`UPDATE payment_requests SET status = 'PAID' WHERE id = 1;`);
  const row = selectOpenPaymentRequest(db, 4);
  assert.equal(row, undefined);
  db.close();
});

test("a CANCELLED request is not returned as the open request", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  db.exec(`UPDATE payment_requests SET status = 'CANCELLED' WHERE id = 1;`);
  const row = selectOpenPaymentRequest(db, 4);
  assert.equal(row, undefined);
  db.close();
});

test("no payment request for a client returns nothing -- never a fabricated balance", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (99, 'No Requests Client', 'active');`);
  const row = selectOpenPaymentRequest(db, 99);
  assert.equal(row, undefined);
  db.close();
});

test("the partial unique index rejects a second OPEN request for the same client", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  assert.throws(() => {
    db.exec(
      `INSERT INTO payment_requests (client_id, amount_cents, currency, payment_url, status)
       VALUES (4, 5000, 'USD', 'https://wise.com/pay/r/second', 'OPEN');`,
    );
  }, /UNIQUE constraint failed/);
  db.close();
});

test("a second OPEN request IS allowed once the first is no longer OPEN", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  db.exec(`UPDATE payment_requests SET status = 'PAID' WHERE id = 1;`);
  db.exec(
    `INSERT INTO payment_requests (client_id, amount_cents, currency, payment_url, status)
     VALUES (4, 5000, 'USD', 'https://wise.com/pay/r/second', 'OPEN');`,
  );
  const row = selectOpenPaymentRequest(db, 4);
  assert.equal(row.amountCents, 5000);
  db.close();
});

test("a zero or negative amount is rejected at the DB level too", () => {
  const db = buildMigratedDb();
  seedFixture(db);
  assert.throws(() => {
    db.exec(
      `INSERT INTO payment_requests (client_id, amount_cents, currency, payment_url, status)
       VALUES (1, 0, 'USD', 'https://wise.com/pay/r/zero', 'OPEN');`,
    );
  }, /CHECK constraint failed/);
  db.close();
});
