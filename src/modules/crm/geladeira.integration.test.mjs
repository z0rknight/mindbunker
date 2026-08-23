import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

// Exercises the actual generated Geladeira migration (0013) against a
// SQLite fixture that mirrors the real `clients` schema plus its child
// tables, the same style already used by
// src/modules/work-sessions/integration.test.mjs. This is the only place
// the real migration SQL file is executed as part of the test suite.
const migrationPath = new URL(
  "../../db/migrations/0013_demonic_paper_doll.sql",
  import.meta.url,
);
const migration = readFileSync(migrationPath, "utf8");

const plain = (row) => (row ? { ...row } : row);

function createFixtureDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'lead',
      opportunity_stage TEXT NOT NULL DEFAULT 'new',
      converted INTEGER NOT NULL DEFAULT 0,
      contacted INTEGER NOT NULL DEFAULT 0,
      total_projects INTEGER NOT NULL DEFAULT 0,
      total_revenue REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
    CREATE TABLE video_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      title TEXT
    );
    CREATE TABLE crm_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      type TEXT NOT NULL
    );
    CREATE TABLE gateway_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL
    );
    CREATE TABLE bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE
    );
    -- Pre-migration seed data: two pre-existing clients, exactly the shape
    -- Geladeira has to be additive on top of.
    INSERT INTO clients (id, name, status, opportunity_stage, total_revenue)
    VALUES
      (1, 'Existing Active Client', 'active', 'active', 5000),
      (2, 'Existing Lead', 'lead', 'new', 0);
    INSERT INTO projects (id, client_id, name) VALUES (10, 1, 'Existing Project');
    INSERT INTO video_logs (id, client_id, project_id, title) VALUES (100, 1, 10, 'Existing Video');
    INSERT INTO crm_events (id, client_id, type) VALUES (1000, 1, 'client_created');
  `);
  db.exec(migration);
  return db;
}

test("migration 0013 is purely additive to clients and never touches Historical tables", () => {
  assert.doesNotMatch(migration, /DROP\s+TABLE/iu);
  assert.doesNotMatch(migration, /DROP\s+COLUMN/iu);
  assert.doesNotMatch(migration, /hist_/u);
  assert.match(migration, /ALTER TABLE `clients` ADD `archival_state`/u);
  assert.match(migration, /ALTER TABLE `clients` ADD `archived_at`/u);
});

test("pre-existing clients default to ACTIVE_SURFACE with no archived_at", () => {
  const db = createFixtureDatabase();
  const rows = db.prepare("SELECT id, archival_state, archived_at FROM clients ORDER BY id").all().map(plain);
  assert.deepEqual(rows, [
    { id: 1, archival_state: "ACTIVE_SURFACE", archived_at: null },
    { id: 2, archival_state: "ACTIVE_SURFACE", archived_at: null },
  ]);
  db.close();
});

test("a newly inserted client also defaults to ACTIVE_SURFACE", () => {
  const db = createFixtureDatabase();
  db.exec("INSERT INTO clients (id, name) VALUES (3, 'Brand New Lead')");
  const row = plain(
    db.prepare("SELECT archival_state, archived_at FROM clients WHERE id = 3").get(),
  );
  assert.deepEqual(row, { archival_state: "ACTIVE_SURFACE", archived_at: null });
  db.close();
});

test("archiving preserves status, opportunity_stage, and every other column", () => {
  const db = createFixtureDatabase();
  const before = plain(
    db.prepare("SELECT status, opportunity_stage, converted, contacted, total_projects, total_revenue FROM clients WHERE id = 1").get(),
  );

  db.prepare(
    "UPDATE clients SET archival_state = 'GELADEIRA', archived_at = 1000 WHERE id = 1",
  ).run();

  const after = plain(
    db.prepare("SELECT status, opportunity_stage, converted, contacted, total_projects, total_revenue FROM clients WHERE id = 1").get(),
  );
  assert.deepEqual(after, before);
  assert.deepEqual(
    plain(db.prepare("SELECT archival_state, archived_at FROM clients WHERE id = 1").get()),
    { archival_state: "GELADEIRA", archived_at: 1000 },
  );
  db.close();
});

test("archiving a client leaves every child row untouched", () => {
  const db = createFixtureDatabase();
  const before = {
    projects: db.prepare("SELECT COUNT(*) AS n FROM projects WHERE client_id = 1").get().n,
    videos: db.prepare("SELECT COUNT(*) AS n FROM video_logs WHERE client_id = 1").get().n,
    events: db.prepare("SELECT COUNT(*) AS n FROM crm_events WHERE client_id = 1").get().n,
  };

  db.prepare("UPDATE clients SET archival_state = 'GELADEIRA', archived_at = 1000 WHERE id = 1").run();

  const after = {
    projects: db.prepare("SELECT COUNT(*) AS n FROM projects WHERE client_id = 1").get().n,
    videos: db.prepare("SELECT COUNT(*) AS n FROM video_logs WHERE client_id = 1").get().n,
    events: db.prepare("SELECT COUNT(*) AS n FROM crm_events WHERE client_id = 1").get().n,
  };
  assert.deepEqual(after, before);
  assert.deepEqual(before, { projects: 1, videos: 1, events: 1 });
  db.close();
});

test("reactivating clears archived_at and restores ACTIVE_SURFACE", () => {
  const db = createFixtureDatabase();
  db.prepare("UPDATE clients SET archival_state = 'GELADEIRA', archived_at = 1000 WHERE id = 1").run();
  db.prepare("UPDATE clients SET archival_state = 'ACTIVE_SURFACE', archived_at = NULL WHERE id = 1").run();

  const row = plain(
    db.prepare("SELECT archival_state, archived_at FROM clients WHERE id = 1").get(),
  );
  assert.deepEqual(row, { archival_state: "ACTIVE_SURFACE", archived_at: null });
  db.close();
});

test("archive is idempotent at the storage layer: applying it twice is the same as once", () => {
  const db = createFixtureDatabase();
  db.prepare("UPDATE clients SET archival_state = 'GELADEIRA', archived_at = 1000 WHERE id = 1").run();
  const once = plain(db.prepare("SELECT archival_state, archived_at FROM clients WHERE id = 1").get());

  db.prepare("UPDATE clients SET archival_state = 'GELADEIRA', archived_at = 1000 WHERE id = 1").run();
  const twice = plain(db.prepare("SELECT archival_state, archived_at FROM clients WHERE id = 1").get());

  assert.deepEqual(once, twice);
  db.close();
});

test("FK integrity holds after archive/reactivate and after deleting a genuinely empty client", () => {
  const db = createFixtureDatabase();
  db.prepare("UPDATE clients SET archival_state = 'GELADEIRA', archived_at = 1000 WHERE id = 1").run();
  db.prepare("UPDATE clients SET archival_state = 'ACTIVE_SURFACE', archived_at = NULL WHERE id = 1").run();
  // Client 2 has no Projects/Videos/Events/Bookings/Invitations — this is
  // exactly the "genuinely empty" case deleteClient() still permits.
  db.exec("DELETE FROM clients WHERE id = 2");

  const violations = db.prepare("PRAGMA foreign_key_check").all();
  assert.deepEqual(violations, []);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM clients").get().n, 1);
  db.close();
});

test("deleting a client with real history cascades at the DB layer (the app-level guard is what prevents this from ever running)", () => {
  const db = createFixtureDatabase();
  db.exec("DELETE FROM clients WHERE id = 1");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM projects WHERE client_id = 1").get().n, 0);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM video_logs WHERE id = 100 AND client_id IS NULL").get().n,
    1,
    "video survives the cascade orphaned (client_id set null), exactly as documented in the canonical map",
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("archiving a client never touches its Gateway invitation row", () => {
  const db = createFixtureDatabase();
  db.exec(
    "INSERT INTO gateway_invitations (id, client_id, token_hash) VALUES (1, 1, 'abc123')",
  );
  const before = plain(
    db.prepare("SELECT * FROM gateway_invitations WHERE id = 1").get(),
  );

  db.prepare(
    "UPDATE clients SET archival_state = 'GELADEIRA', archived_at = 1000 WHERE id = 1",
  ).run();

  const after = plain(
    db.prepare("SELECT * FROM gateway_invitations WHERE id = 1").get(),
  );
  assert.deepEqual(after, before);
  db.close();
});

test("dependency counting (the deletion guard's data source) correctly separates a protected client from an empty one", () => {
  const db = createFixtureDatabase();
  db.exec(
    "INSERT INTO gateway_invitations (id, client_id, token_hash) VALUES (1, 1, 'abc123')",
  );

  function countsFor(clientId) {
    return {
      projects: db.prepare("SELECT COUNT(*) AS n FROM projects WHERE client_id = ?").get(clientId).n,
      bookings: db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE client_id = ?").get(clientId).n,
      gatewayInvitations: db.prepare("SELECT COUNT(*) AS n FROM gateway_invitations WHERE client_id = ?").get(clientId).n,
      videos: db.prepare("SELECT COUNT(*) AS n FROM video_logs WHERE client_id = ?").get(clientId).n,
      nonCreationEvents: db
        .prepare("SELECT COUNT(*) AS n FROM crm_events WHERE client_id = ? AND type NOT IN ('lead_created', 'client_created')")
        .get(clientId).n,
    };
  }

  // Client 1: has a project, a video, and a gateway invitation — protected.
  assert.deepEqual(countsFor(1), {
    projects: 1,
    bookings: 0,
    gatewayInvitations: 1,
    videos: 1,
    nonCreationEvents: 0,
  });
  // Client 2: nothing but its own row — genuinely empty, deletable.
  assert.deepEqual(countsFor(2), {
    projects: 0,
    bookings: 0,
    gatewayInvitations: 0,
    videos: 0,
    nonCreationEvents: 0,
  });
  db.close();
});
