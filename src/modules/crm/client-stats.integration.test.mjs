import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Sprint 3 P0 (CRM Client Intelligence counts) — exercises the real
// migration chain the same way
// src/modules/productivity/add-video-single-ingest.integration.test.mjs
// does. getClientIntelligence / getClientListStats are "use server"
// actions that need a Next.js/Cloudflare request context this test
// runner doesn't have, so this mirrors their SQL directly and asserts
// against it — the same convention already established in this repo.
//
// Root cause under test: clients.total_projects / clients.total_revenue
// are stale cached columns (total_projects only recomputed inside
// createProject/deleteProject's db.batch(); total_revenue is written
// nowhere in the codebase and stays permanently 0). The fix computes both
// live from projects/transactions instead. Revenue must stay grouped by
// currency — USD and BRL are never summed together.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
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

// Mirrors getClientIntelligence's new fields / getClientListStats exactly.
function liveProjectCount(db, clientId) {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM projects WHERE client_id = ?")
    .get(clientId);
  return row.c;
}

function liveRevenueByCurrency(db, clientId) {
  return db
    .prepare(
      `SELECT currency, SUM(amount) AS amount FROM transactions
       WHERE client_id = ? AND type = 'income'
       GROUP BY currency`,
    )
    .all(clientId)
    .map((r) => ({ currency: r.currency, amount: r.amount ?? 0 }));
}

test("live project count reflects reality even when the stale cached column is wrong (Taryn scenario: '4 active vs 1 total')", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status, total_projects, total_revenue)
    VALUES (1, 'Taryn Dubreuil', 'active', 1, 0);
    INSERT INTO projects (id, client_id, name, status) VALUES
      (10, 1, 'Studio Session Arizona ft C', 'active'),
      (11, 1, 'Second Shoot', 'active'),
      (12, 1, 'Third Shoot', 'review'),
      (13, 1, 'Fourth Shoot', 'active');
  `);
  // The stale column claims 1 project total; reality is 4.
  const staleTotal = db.prepare("SELECT total_projects FROM clients WHERE id = 1").get();
  assert.equal(staleTotal.total_projects, 1);
  assert.equal(liveProjectCount(db, 1), 4);
});

test("revenue is grouped by currency, never summed across currencies", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO transactions (type, amount, category, date, currency, client_id) VALUES
      ('income', 500, 'Freelance', '2026-08-01', 'USD', 1),
      ('income', 300, 'Freelance', '2026-08-05', 'USD', 1),
      ('income', 1000, 'Freelance', '2026-08-10', 'BRL', 1);
  `);
  const revenue = liveRevenueByCurrency(db, 1);
  const byCurrency = Object.fromEntries(revenue.map((r) => [r.currency, r.amount]));
  assert.equal(revenue.length, 2, "USD and BRL must stay separate rows, never merged into one number");
  assert.equal(byCurrency.USD, 800);
  assert.equal(byCurrency.BRL, 1000);
});

test("expense and owner_pay transactions never count as client revenue", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO transactions (type, amount, category, date, currency, client_id) VALUES
      ('income', 500, 'Freelance', '2026-08-01', 'USD', 1),
      ('expense', 9999, 'Gear', '2026-08-02', 'USD', 1),
      ('owner_pay', 9999, 'Owner Pay', '2026-08-03', 'USD', 1);
  `);
  const revenue = liveRevenueByCurrency(db, 1);
  assert.equal(revenue.length, 1);
  assert.equal(revenue[0].amount, 500);
});

test("another client's transactions never leak into this client's revenue", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active'), (2, 'Other Client', 'active');
    INSERT INTO transactions (type, amount, category, date, currency, client_id) VALUES
      ('income', 500, 'Freelance', '2026-08-01', 'USD', 1),
      ('income', 700, 'Freelance', '2026-08-01', 'USD', 2);
  `);
  const revenue = liveRevenueByCurrency(db, 1);
  assert.equal(revenue.length, 1);
  assert.equal(revenue[0].amount, 500);
});

test("a client with zero revenue transactions returns an empty array, not an error or a fabricated zero row", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Fresh Lead', 'lead');`);
  assert.deepEqual(liveRevenueByCurrency(db, 1), []);
  assert.equal(liveProjectCount(db, 1), 0);
});
