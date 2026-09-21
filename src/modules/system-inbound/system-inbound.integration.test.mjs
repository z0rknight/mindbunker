import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { buildSystemIntakeSeenPayload, systemIntakeSeenIdempotencyKey } from "./core.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const migrations = path.join(root, "src/db/migrations");

function db() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const file of fs.readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync(path.join(migrations, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) database.exec(statement.trim());
  }
  return database;
}

test("seen acknowledgement is idempotent and never mutates the source intake", () => {
  const database = db();
  database.exec("INSERT INTO clients (id, name, email, status) VALUES (101, 'Synthetic', 'synthetic@example.com', 'lead')");
  database.prepare("INSERT INTO crm_events (id, client_id, type, actor, description, payload_json, idempotency_key) VALUES (201, 101, 'guided_intake.submitted', 'gateway', 'original', ?, 'intake-201')").run('{"immutable":true}');
  const insertAck = database.prepare("INSERT OR IGNORE INTO crm_events (client_id, type, actor, description, payload_json, idempotency_key) VALUES (101, 'system_intake.seen', 'admin', 'reviewed', ?, ?)");
  const ackPayload = buildSystemIntakeSeenPayload(201);
  const ackKey = systemIntakeSeenIdempotencyKey(201);
  insertAck.run(ackPayload, ackKey);
  insertAck.run(ackPayload, ackKey);
  assert.equal(database.prepare("SELECT count(*) n FROM crm_events WHERE type='system_intake.seen'").get().n, 1);
  assert.deepEqual({ ...database.prepare("SELECT description, payload_json, idempotency_key FROM crm_events WHERE id=201").get() }, {
    description: "original",
    payload_json: '{"immutable":true}',
    idempotency_key: "intake-201",
  });
});

test("no migration beyond 0053 is introduced", () => {
  const files = fs.readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort();
  assert.equal(files.at(-1), "0053_slow_shen.sql");
});
