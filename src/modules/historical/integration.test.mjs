import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDir = new URL("../../db/migrations/", import.meta.url);

function allMigrationFiles() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function createFixtureDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of allMigrationFiles()) {
    const sql = readFileSync(new URL(file, migrationsDir), "utf8");
    db.exec(sql);
  }
  return db;
}

test("all migrations 0000-0012 apply cleanly in order, including the new hist_* tables", () => {
  const db = createFixtureDatabase();
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'hist_%' ORDER BY name",
    )
    .all()
    .map((r) => r.name);
  assert.deepEqual(tables, [
    "hist_facts",
    "hist_identities",
    "hist_identity_source_labels",
    "hist_import_batches",
    "hist_source_coverage",
  ]);
});

function insertBatch(db, { fingerprint, status = "PENDING" }) {
  return db
    .prepare(
      `INSERT INTO hist_import_batches (artifact_version, fingerprint, status, fact_count, identity_count, coverage_month_count)
       VALUES ('0.1.0', ?, ?, 0, 0, 0) RETURNING id`,
    )
    .get(fingerprint, status).id;
}

test("only one ACTIVE batch is allowed at a time (partial unique index)", () => {
  const db = createFixtureDatabase();
  const batchA = insertBatch(db, { fingerprint: "fp-a", status: "ACTIVE" });
  assert.ok(batchA);

  assert.throws(() => {
    insertBatch(db, { fingerprint: "fp-b", status: "ACTIVE" });
  }, /UNIQUE constraint failed|hist_import_batches_one_active_idx/);

  // Superseding the first and activating a second is fine.
  db.prepare(
    "UPDATE hist_import_batches SET status = 'SUPERSEDED', superseded_at = unixepoch() WHERE id = ?",
  ).run(batchA);
  const batchB = insertBatch(db, { fingerprint: "fp-b", status: "ACTIVE" });
  assert.ok(batchB);
});

test("fingerprint has a unique index for idempotency detection", () => {
  const db = createFixtureDatabase();
  insertBatch(db, { fingerprint: "fp-dup", status: "PENDING" });
  assert.throws(() => {
    insertBatch(db, { fingerprint: "fp-dup", status: "PENDING" });
  }, /UNIQUE constraint failed/);
});

test("hist_facts and hist_identity_source_labels join hist_identities by (batch_id, canonical_id), not an internal id", () => {
  const db = createFixtureDatabase();
  const batchId = insertBatch(db, { fingerprint: "fp-join", status: "ACTIVE" });

  db.prepare(
    `INSERT INTO hist_identities (batch_id, canonical_id, canonical_label, identity_type, resolution_status)
     VALUES (?, 'client:sean_go', 'Sean Go', 'client', 'HUMAN_CONFIRMED')`,
  ).run(batchId);

  db.prepare(
    `INSERT INTO hist_identity_source_labels (batch_id, identity_canonical_id, source, label, occurrences)
     VALUES (?, 'client:sean_go', 'upwork_lifetime_billings', 'Sean Go', NULL)`,
  ).run(batchId);

  db.prepare(
    `INSERT INTO hist_facts (batch_id, period_granularity, period_year, identity_canonical_id, source, metric, value, unit, confidence, canonical, provenance)
     VALUES (?, 'lifetime', NULL, 'client:sean_go', 'upwork_lifetime_billings', 'client_lifetime_billed', 20.0, 'usd', 'HIGH', 1, 'test')`,
  ).run(batchId);

  // A fact referencing an identity that does not exist in this batch is
  // rejected by the composite foreign key.
  assert.throws(() => {
    db.prepare(
      `INSERT INTO hist_facts (batch_id, period_granularity, identity_canonical_id, source, metric, unit, confidence, canonical, provenance)
       VALUES (?, 'lifetime', 'client:does_not_exist', 'upwork_lifetime_billings', 'client_lifetime_billed', 'usd', 'HIGH', 1, 'test')`,
    ).run(batchId);
  }, /FOREIGN KEY constraint failed/);

  const factCount = db
    .prepare("SELECT count(*) as n FROM hist_facts WHERE batch_id = ?")
    .get(batchId).n;
  assert.equal(factCount, 1);

  // Deleting the batch cascades to identities, source labels, and facts --
  // confirming the additive layer can be fully rolled back without a manual
  // multi-table cleanup script.
  db.prepare("DELETE FROM hist_import_batches WHERE id = ?").run(batchId);
  assert.equal(
    db.prepare("SELECT count(*) as n FROM hist_identities").get().n,
    0,
  );
  assert.equal(
    db.prepare("SELECT count(*) as n FROM hist_identity_source_labels").get().n,
    0,
  );
  assert.equal(db.prepare("SELECT count(*) as n FROM hist_facts").get().n, 0);
});

test("canonical=false facts (EXPERIMENTAL / upper-bound) are stored but distinguishable from canonical facts", () => {
  const db = createFixtureDatabase();
  const batchId = insertBatch(db, { fingerprint: "fp-canon", status: "ACTIVE" });

  db.prepare(
    `INSERT INTO hist_facts (batch_id, period_granularity, period_start, period_end, source, metric, value, unit, confidence, canonical, provenance)
     VALUES (?, 'window', '2025-11-02', '2026-08-22', 'activitywatch_afk', 'experimental_merged_not_afk_hours', 16233.54, 'hours', 'EXPERIMENTAL', 0, 'test')`,
  ).run(batchId);

  db.prepare(
    `INSERT INTO hist_facts (batch_id, period_granularity, period_year, period_month, source, metric, value, unit, confidence, canonical, provenance)
     VALUES (?, 'month', 2025, 11, 'activitywatch_afk', 'raw_event_count', 12616, 'events', 'HIGH', 1, 'test')`,
  ).run(batchId);

  const canonicalCount = db
    .prepare(
      "SELECT count(*) as n FROM hist_facts WHERE batch_id = ? AND canonical = 1",
    )
    .get(batchId).n;
  const nonCanonicalCount = db
    .prepare(
      "SELECT count(*) as n FROM hist_facts WHERE batch_id = ? AND canonical = 0",
    )
    .get(batchId).n;

  assert.equal(canonicalCount, 1);
  assert.equal(nonCanonicalCount, 1);
});

test("UNKNOWN / NO SOURCE DATA coverage months are never queried as zero-valued facts", () => {
  const db = createFixtureDatabase();
  const batchId = insertBatch(db, { fingerprint: "fp-cov", status: "ACTIVE" });

  db.prepare(
    `INSERT INTO hist_source_coverage (batch_id, year, month, source, status)
     VALUES (?, 2023, 1, 'clockify_detailed_export', 'UNKNOWN_NO_SOURCE_DATA')`,
  ).run(batchId);

  // No corresponding hist_facts row exists for this (year, month, source) --
  // a reader summing hist_facts for tracked_hours in Jan 2023 correctly gets
  // nothing to sum, rather than a fabricated 0.
  const factCount = db
    .prepare(
      `SELECT count(*) as n FROM hist_facts
       WHERE batch_id = ? AND period_year = 2023 AND period_month = 1 AND source = 'clockify_detailed_export'`,
    )
    .get(batchId).n;
  assert.equal(factCount, 0);

  const coverageStatus = db
    .prepare(
      "SELECT status FROM hist_source_coverage WHERE batch_id = ? AND year = 2023 AND month = 1",
    )
    .get(batchId).status;
  assert.equal(coverageStatus, "UNKNOWN_NO_SOURCE_DATA");
});
