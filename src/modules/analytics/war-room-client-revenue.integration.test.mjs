import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Sprint 3 P2 — mirrors getWarRoomAnalytics's clientRevenueEntries logic
// (src/modules/analytics/service.ts) against the real migration chain,
// the same convention used elsewhere in this repo for "use server"-only
// logic a plain unit test can't reach. Root cause: topClientsByRevenue /
// clientDrainRanking read the stale clients.totalRevenue / totalProjects
// columns (same bug as the CRM Client Intelligence P0 fix, different
// surface) and, before this fix, would have silently summed revenue
// across currencies once live-computed naively. This asserts the fix's
// guarantees directly.

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

const DEFAULT_CURRENCY = "USD";

// Mirrors clientRevenueEntries() exactly.
function clientRevenueEntries(db) {
  const activeClients = db
    .prepare("SELECT id, name FROM clients WHERE status = 'active' AND archival_state != 'GELADEIRA'")
    .all();
  const projectRows = db.prepare("SELECT client_id FROM projects").all();
  const projectCountByClientId = new Map();
  for (const row of projectRows) {
    projectCountByClientId.set(row.client_id, (projectCountByClientId.get(row.client_id) ?? 0) + 1);
  }
  const incomeRows = db
    .prepare("SELECT client_id, currency, amount FROM transactions WHERE type = 'income' AND client_id IS NOT NULL")
    .all();
  const incomeByClientCurrency = new Map();
  for (const row of incomeRows) {
    const byCurrency = incomeByClientCurrency.get(row.client_id) ?? new Map();
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row.amount);
    incomeByClientCurrency.set(row.client_id, byCurrency);
  }

  return activeClients.flatMap((c) => {
    const projectsCount = projectCountByClientId.get(c.id) ?? 0;
    const byCurrency = incomeByClientCurrency.get(c.id);
    const currencyRows =
      byCurrency && byCurrency.size > 0
        ? Array.from(byCurrency, ([currency, revenue]) => ({ currency, revenue }))
        : [{ currency: DEFAULT_CURRENCY, revenue: 0 }];
    return currencyRows.map(({ currency, revenue }) => ({
      name: c.name,
      currency,
      revenue,
      projects: projectsCount,
      effectiveYield: projectsCount > 0 ? Math.round(revenue / projectsCount) : null,
    }));
  });
}

test("live project count is used, not the stale clients.total_projects column", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status, total_projects) VALUES (1, 'Taryn Dubreuil', 'active', 1);
    INSERT INTO projects (id, client_id, name, status) VALUES
      (10, 1, 'A', 'active'), (11, 1, 'B', 'active'), (12, 1, 'C', 'active');
  `);
  const [entry] = clientRevenueEntries(db);
  assert.equal(entry.projects, 3, "must not read the stale total_projects=1 column");
});

test("a client with income in two currencies produces two separate entries, never summed", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO transactions (type, amount, category, date, currency, client_id) VALUES
      ('income', 500, 'Freelance', '2026-08-01', 'USD', 1),
      ('income', 2000, 'Freelance', '2026-08-05', 'BRL', 1);
  `);
  const entries = clientRevenueEntries(db);
  assert.equal(entries.length, 2);
  const byCurrency = Object.fromEntries(entries.map((e) => [e.currency, e.revenue]));
  assert.equal(byCurrency.USD, 500);
  assert.equal(byCurrency.BRL, 2000);
});

test("expense and owner_pay transactions never count as client revenue here either", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO transactions (type, amount, category, date, currency, client_id) VALUES
      ('income', 500, 'Freelance', '2026-08-01', 'USD', 1),
      ('expense', 9999, 'Gear', '2026-08-02', 'USD', 1);
  `);
  const [entry] = clientRevenueEntries(db);
  assert.equal(entry.revenue, 500);
});

test("a client with zero recorded income still appears, at revenue 0, not dropped from coverage", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Fresh Client', 'active');`);
  const entries = clientRevenueEntries(db);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].revenue, 0);
  assert.equal(entries[0].effectiveYield, null);
});

test("an inactive or Geladeira client is excluded, matching the pre-existing scope", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status, archival_state) VALUES
      (1, 'Active Client', 'active', 'ACTIVE_SURFACE'),
      (2, 'Inactive Client', 'inactive', 'ACTIVE_SURFACE'),
      (3, 'Archived Client', 'active', 'GELADEIRA');
  `);
  const entries = clientRevenueEntries(db);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "Active Client");
});
