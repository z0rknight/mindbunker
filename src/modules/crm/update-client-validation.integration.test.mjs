import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Sprint 3 P2 — updateClient (src/modules/crm/actions.ts) had zero
// server-side validation, unlike addClient which trims/caps the exact
// same fields. Mirrors the fixed validation logic exactly, against the
// real migration chain, following this repo's established convention for
// "use server" actions a plain unit test can't reach.

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

const CLIENT_STATUSES = ["lead", "active", "inactive"];
const isValidClientEmail = (value) => value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);

// Mirrors updateClient's fixed validation exactly.
function updateClientSql(db, id, data) {
  const set = { ...data };
  if (set.name !== undefined) {
    const name = set.name.trim().slice(0, 160);
    if (!name) throw new Error("Contact name is required.");
    set.name = name;
  }
  if (set.status !== undefined && !CLIENT_STATUSES.includes(set.status)) {
    throw new Error("Invalid status.");
  }
  if (set.email !== undefined) {
    const email = set.email.trim().slice(0, 320);
    if (email && !isValidClientEmail(email)) throw new Error("Enter a valid email address.");
    set.email = email || undefined;
  }
  if (set.phone !== undefined) set.phone = set.phone.trim().slice(0, 80) || undefined;
  if (set.notes !== undefined) set.notes = set.notes.trim().slice(0, 5_000) || undefined;
  if (set.source !== undefined) set.source = set.source.trim().slice(0, 160) || undefined;

  const columns = { name: "name", status: "status", email: "email", phone: "phone", notes: "notes", source: "source" };
  const keys = Object.keys(set).filter((k) => set[k] !== undefined && columns[k]);
  if (keys.length === 0) return;
  const assignments = keys.map((k) => `${columns[k]} = ?`).join(", ");
  db.prepare(`UPDATE clients SET ${assignments} WHERE id = ?`).run(...keys.map((k) => set[k]), id);
}

test("an invalid status is rejected before any write", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');`);

  assert.throws(() => updateClientSql(db, 1, { status: "deleted" }), /Invalid status/);

  const row = db.prepare("SELECT status FROM clients WHERE id = 1").get();
  assert.equal(row.status, "active");
});

test("a client can be set to inactive -- the one status transition with no UI path before this round", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');`);

  updateClientSql(db, 1, { status: "inactive" });

  const row = db.prepare("SELECT status FROM clients WHERE id = 1").get();
  assert.equal(row.status, "inactive");
});

test("an empty name is rejected, and a name is trimmed and capped the same way addClient does", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');`);

  assert.throws(() => updateClientSql(db, 1, { name: "   " }), /Contact name is required/);

  updateClientSql(db, 1, { name: `  ${"x".repeat(200)}  ` });
  const row = db.prepare("SELECT name FROM clients WHERE id = 1").get();
  assert.equal(row.name.length, 160);
});

test("an empty email/phone/notes/source leaves the existing value untouched, not cleared", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status, email, phone) VALUES (1, 'Taryn Dubreuil', 'active', 'taryn@example.com', '555-0100');`);

  updateClientSql(db, 1, { email: "   ", phone: "" });

  const row = db.prepare("SELECT email, phone FROM clients WHERE id = 1").get();
  assert.equal(row.email, "taryn@example.com");
  assert.equal(row.phone, "555-0100");
});

test("a valid email/phone update still writes normally", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status) VALUES (1, 'Taryn Dubreuil', 'active');`);

  updateClientSql(db, 1, { email: "  Taryn@Example.com  ", phone: "  555-0100  " });

  const row = db.prepare("SELECT name, email, phone FROM clients WHERE id = 1").get();
  assert.equal(row.name, "Taryn Dubreuil", "editing contact fields must preserve the client identity");
  assert.equal(row.email, "Taryn@Example.com");
  assert.equal(row.phone, "555-0100");
});

test("a malformed client email is rejected server-side before any write", () => {
  const db = buildMigratedDb();
  db.exec(`INSERT INTO clients (id, name, status, email) VALUES (1, 'Taryn Dubreuil', 'active', 'old@example.com');`);

  assert.throws(
    () => updateClientSql(db, 1, { email: "not-an-email" }),
    /valid email address/,
  );
  assert.equal(db.prepare("SELECT email FROM clients WHERE id = 1").get().email, "old@example.com");
});
