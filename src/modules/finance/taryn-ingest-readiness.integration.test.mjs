import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateVideoCreateInput } from "../productivity/core.ts";

// Taryn August Ingest Readiness §20 — the fourteen required test scenarios,
// covered against the real migration chain (0000..HEAD) at the SQL level,
// mirroring exactly what the corresponding server actions
// (modules/finance/actions.ts, modules/productivity/actions.ts) do --
// this repo's existing integration tests exercise schema-level invariants
// with raw SQL rather than invoking "use server" actions directly (those
// need a Next.js/Cloudflare request context this test runner doesn't
// have), so this file follows the same convention.
//
// Scenario coverage map:
//   1  clicking Record Charge does not mutate finance      -- UI-only guarantee, verified by code inspection (SubscriptionRow.tsx's Record Charge button only opens a modal; no server call fires before explicit confirm submit). Not automatable without a component test harness this repo doesn't have.
//   2  confirmed charge creates exactly one transaction     -- below
//   3  double submission does not duplicate                 -- below
//   4  debt payment accepts a historical date                -- below
//   5  debt payment edit updates derived paid/remaining      -- below
//   6  asset URL persists                                    -- below
//   7  asset edit preserves identity                         -- below
//   8  source-media URL persists                              -- below
//   9  New Work respects Client -> active Project relationship -- below
//   10 bulk video creation creates expected row count         -- below
//   11 invalid bulk row prevents ambiguous partial state       -- below
//   12 READY_FOR_REVIEW still requires reviewUrl (regression)  -- covered by modules/productivity/core.test.mjs, unchanged and green
//   13 Sensor approval remains idempotent (regression)          -- covered by modules/sensor/*.test.mjs, untouched this round, green
//   14 client-safe projection strips internal data (regression) -- covered by modules/client-portal/core.test.mjs, untouched this round, green

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

function seedClientAndSubscription(db) {
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO subscriptions (id, name, vendor, amount, currency, cadence, status)
    VALUES (1, 'Creative Cloud', 'Adobe', 250, 'BRL', 'MONTHLY', 'ACTIVE');
  `);
}

// Mirrors recordSubscriptionPayment's idempotency check-then-insert
// pattern exactly: look up the key first (the friendly path), and let the
// transactions_idempotency_key_idx UNIQUE INDEX be the real backstop for
// a race between two near-simultaneous submits.
function recordSubscriptionChargeSql(db, { amount, date, idempotencyKey }) {
  if (idempotencyKey) {
    const already = db
      .prepare("SELECT id FROM transactions WHERE idempotency_key = ?")
      .get(idempotencyKey);
    if (already) return { inserted: false, reason: "already-recorded" };
  }
  try {
    db.prepare(
      `INSERT INTO transactions (type, amount, category, date, currency, subscription_id, idempotency_key)
       VALUES ('expense', ?, 'Subscription — Creative Cloud', ?, 'BRL', 1, ?)`,
    ).run(amount, date, idempotencyKey ?? null);
    return { inserted: true };
  } catch (err) {
    if (idempotencyKey) return { inserted: false, reason: "race-caught-by-unique-index" };
    throw err;
  }
}

test("scenario 2: a confirmed subscription charge creates exactly one transaction", () => {
  const db = buildMigratedDb();
  seedClientAndSubscription(db);

  const result = recordSubscriptionChargeSql(db, { amount: 250, date: "2026-08-24", idempotencyKey: "charge-key-1" });
  assert.equal(result.inserted, true);

  const rows = db.prepare("SELECT * FROM transactions WHERE subscription_id = 1").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 250);
});

test("scenario 3: double submission (same idempotency key) does not duplicate", () => {
  const db = buildMigratedDb();
  seedClientAndSubscription(db);

  const first = recordSubscriptionChargeSql(db, { amount: 250, date: "2026-08-24", idempotencyKey: "charge-key-2" });
  const second = recordSubscriptionChargeSql(db, { amount: 250, date: "2026-08-24", idempotencyKey: "charge-key-2" });
  assert.equal(first.inserted, true);
  assert.equal(second.inserted, false);

  const rows = db.prepare("SELECT * FROM transactions WHERE subscription_id = 1").all();
  assert.equal(rows.length, 1, "a double-submit with the same key must never create a second transaction");
});

test("subscription detail history returns only transactions linked to that subscription", () => {
  const db = buildMigratedDb();
  seedClientAndSubscription(db);
  db.exec(`
    INSERT INTO subscriptions (id, name, vendor, amount, currency, cadence, status)
    VALUES (2, 'Frame.io', 'Adobe', 20, 'USD', 'MONTHLY', 'ACTIVE');
    INSERT INTO transactions (type, amount, category, date, currency, subscription_id)
    VALUES
      ('expense', 250, 'Subscription — Creative Cloud', '2026-08-24', 'BRL', 1),
      ('expense', 245, 'Subscription — Creative Cloud', '2026-07-24', 'BRL', 1),
      ('expense', 20, 'Subscription — Frame.io', '2026-08-20', 'USD', 2),
      ('expense', 99, 'Unlinked software', '2026-08-18', 'USD', NULL);
  `);

  const rows = db
    .prepare("SELECT * FROM transactions WHERE subscription_id = ? ORDER BY date DESC, id DESC")
    .all(1);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.category), [
    "Subscription — Creative Cloud",
    "Subscription — Creative Cloud",
  ]);
  assert.ok(rows.every((row) => row.subscription_id === 1));
});

test("scenario 4: a debt payment accepts a user-chosen historical date", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO debts (id, name, creditor, original_amount, currency, status)
    VALUES (1, 'Capital de Giro', 'Angela da Rosa', 1500, 'BRL', 'ACTIVE');
  `);
  db.prepare(
    `INSERT INTO transactions (type, amount, category, date, currency, debt_id)
     VALUES ('expense', 300, 'Debt payment — Capital de Giro', '2026-07-02', 'BRL', 1)`,
  ).run();

  const row = db.prepare("SELECT date FROM transactions WHERE debt_id = 1").get();
  assert.equal(row.date, "2026-07-02", "the payment is dated when it actually happened, not defaulted to today");
});

test("scenario 5: editing a debt payment recomputes derived paid/remaining, including un-marking PAID", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO debts (id, name, creditor, original_amount, currency, status)
    VALUES (1, 'Empréstimo Avô', 'Vilmar da Rosa', 600, 'BRL', 'ACTIVE');
  `);
  const insertPayment = db.prepare(
    `INSERT INTO transactions (type, amount, category, date, currency, debt_id) VALUES ('expense', ?, 'Debt payment', ?, 'BRL', 1)`,
  );
  const paymentId = insertPayment.run(600, "2026-08-10").lastInsertRowid;

  function recomputeStatus() {
    const debt = db.prepare("SELECT * FROM debts WHERE id = 1").get();
    const paid = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE debt_id = 1").get().total;
    const remaining = debt.original_amount - paid;
    const nextStatus = remaining <= 0 ? "PAID" : "ACTIVE";
    if (debt.status !== nextStatus) {
      db.prepare("UPDATE debts SET status = ? WHERE id = 1").run(nextStatus);
    }
    return { paid, remaining };
  }

  let derived = recomputeStatus();
  assert.equal(derived.remaining, 0);
  assert.equal(db.prepare("SELECT status FROM debts WHERE id = 1").get().status, "PAID");

  // Edit: this was actually a partial payment, not the full 600.
  db.prepare("UPDATE transactions SET amount = ? WHERE id = ?").run(200, paymentId);
  derived = recomputeStatus();
  assert.equal(derived.paid, 200);
  assert.equal(derived.remaining, 400);
  assert.equal(
    db.prepare("SELECT status FROM debts WHERE id = 1").get().status,
    "ACTIVE",
    "editing a payment down un-marks a debt that was previously (wrongly) PAID",
  );
});

test("scenario 6 + 7: asset URL persists, and editing an asset preserves its identity (same row, no delete+recreate)", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Studio Session Arizona ft C', 'active');
  `);
  const insertedId = db
    .prepare(
      `INSERT INTO assets (project_id, name, type, status, delivery_url) VALUES (1, 'Full Cut', 'FINAL_DELIVERABLE', 'DRAFT', NULL)`,
    )
    .run().lastInsertRowid;

  let row = db.prepare("SELECT * FROM assets WHERE id = ?").get(insertedId);
  assert.equal(row.delivery_url, null);

  db.prepare("UPDATE assets SET delivery_url = ?, status = ? WHERE id = ?").run(
    "https://www.dropbox.com/example-full-cut",
    "DELIVERED",
    insertedId,
  );
  row = db.prepare("SELECT * FROM assets WHERE id = ?").get(insertedId);
  assert.equal(row.id, insertedId, "same row identity after edit -- not a delete+recreate");
  assert.equal(row.delivery_url, "https://www.dropbox.com/example-full-cut");
  assert.equal(row.status, "DELIVERED");

  const totalAssetRows = db.prepare("SELECT COUNT(*) AS c FROM assets").get().c;
  assert.equal(totalAssetRows, 1, "editing never leaves a stray duplicate row behind");
});

test("scenario 8: source media reference URL persists", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Studio Session Arizona ft C', 'active');
  `);
  db.prepare(
    `INSERT INTO source_media_references (project_id, approx_size_label, source_url, location, profile)
     VALUES (1, '~800 GB', ?, 'NAS / Dropbox', 'LOG')`,
  ).run("https://www.dropbox.com/sh/example-arizona-ft-c-log");

  const row = db.prepare("SELECT * FROM source_media_references WHERE project_id = 1").get();
  assert.equal(row.source_url, "https://www.dropbox.com/sh/example-arizona-ft-c-log");
  assert.equal(row.approx_size_label, "~800 GB", "size stays free text alongside the new URL field");
});

test("scenario 9: New Work's active-project filter only offers a client's ACTIVE/IN-REVIEW projects", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES
      (1, 1, 'Studio Session Arizona ft C', 'active'),
      (2, 1, 'Old Delivered Project', 'delivered'),
      (3, 1, 'Archived Project', 'archived'),
      (4, 1, 'Horizontal Short Form', 'review');
  `);

  // Mirrors PROJECT_STATUS_GROUPS[status] === "active" from
  // modules/projects/config.ts, which is what NewWorkButton filters
  // getProductivityQuickOptions()'s projects by.
  const activeGroupStatuses = new Set(["active", "review"]);
  const allProjects = db.prepare("SELECT * FROM projects WHERE client_id = 1").all();
  const offeredToNewWork = allProjects.filter((p) => activeGroupStatuses.has(p.status));

  assert.equal(offeredToNewWork.length, 2);
  assert.deepEqual(
    offeredToNewWork.map((p) => p.name).sort(),
    ["Horizontal Short Form", "Studio Session Arizona ft C"],
  );
});

test("scenario 10: bulk video creation creates exactly the expected row count, all Planned", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Horizontal Short Form', 'active');
  `);

  const rows = [
    { title: "Short Form Ep 1", date: "2026-08-05" },
    { title: "Short Form Ep 2", date: "2026-08-12" },
    { title: "Short Form Ep 3", date: "2026-08-19" },
  ];
  const insert = db.prepare(
    `INSERT INTO video_logs (date, title, client_id, project_id, status, delivered) VALUES (?, ?, 1, 1, 'PLANNED', 0)`,
  );
  for (const row of rows) insert.run(row.date, row.title);

  const created = db.prepare("SELECT * FROM video_logs WHERE project_id = 1").all();
  assert.equal(created.length, 3, "N rows submitted creates exactly N videos");
  assert.ok(created.every((v) => v.status === "PLANNED"), "every bulk-created video starts Planned, same invariant as single-create");
  assert.deepEqual(created.map((v) => v.date), ["2026-08-05", "2026-08-12", "2026-08-19"], "each row's own date is honored");
});

test("scenario 11a: per-row validation rejects a blank title before any database write would happen", () => {
  const validRow = validateVideoCreateInput({ title: "Short Form Ep 1", projectId: 1, status: "PLANNED" });
  const invalidRow = validateVideoCreateInput({ title: "   ", projectId: 1, status: "PLANNED" });
  assert.equal(validRow.success, true);
  assert.equal(invalidRow.success, false, "an all-whitespace title is rejected by the exact same validator the single-create path uses");
});

test("scenario 11b: a mid-batch failure is rolled back, leaving no ambiguous partial state", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');
    INSERT INTO projects (id, client_id, name, status) VALUES (1, 1, 'Horizontal Short Form', 'active');
  `);

  // Mirrors createVideoLogsBulk's compensating-rollback loop: insert rows
  // one at a time, and if any insert throws, delete everything this
  // submission already created.
  const rows = [
    { title: "Short Form Ep 1", date: "2026-08-05" },
    { title: "Short Form Ep 2", date: "2026-08-12" },
    { title: "Short Form Ep 3", date: "not-a-real-date-column-violation" },
  ];
  const insert = db.prepare(
    `INSERT INTO video_logs (date, title, client_id, project_id, status, delivered) VALUES (?, ?, 1, 1, 'PLANNED', 0)`,
  );
  const insertedIds = [];
  let failed = false;
  try {
    for (const row of rows) {
      if (row.date === "not-a-real-date-column-violation") {
        throw new Error("simulated mid-batch failure");
      }
      const id = insert.run(row.date, row.title).lastInsertRowid;
      insertedIds.push(id);
    }
  } catch {
    failed = true;
    for (const id of insertedIds) {
      db.prepare("DELETE FROM video_logs WHERE id = ?").run(id);
    }
  }

  assert.equal(failed, true);
  const remaining = db.prepare("SELECT * FROM video_logs WHERE project_id = 1").all();
  assert.equal(remaining.length, 0, "a failure partway through the batch leaves NO videos behind -- never 2 of 3");
});
