// Shared helper for the RMEDIA LET'S COOK Wave 1 integration tests
// (taryn / dave / mixed-tracking). Mirrors the exact pattern already
// established in modules/productivity/bulk-ingest-brief-c.integration.test.mjs:
// a real node:sqlite in-memory DB replayed through every migration file
// (0000..HEAD, so this new production_orders schema and its constraints
// are tested against the real, generated migration chain, not a hand-
// written approximation of it).

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateVideoCreateInput } from "../productivity/core.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

export function buildMigratedDb() {
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

export function seedClientAndProject(db, { clientId = 1, projectId = 1, clientName = "Taryn Dubreuil", projectName = "Content Waterfall" } = {}) {
  db.prepare(`INSERT INTO clients (id, name, status) VALUES (?, ?, 'active')`).run(clientId, clientName);
  db.prepare(`INSERT INTO projects (id, client_id, name, status) VALUES (?, ?, ?, 'active')`).run(projectId, clientId, projectName);
}

// Mirrors ingestProductionOrder's order-row half exactly: INSERT OR
// IGNORE on the unique ingest_key index, then SELECT the canonical row
// back by that key -- safe to call more than once with the same key.
export function ingestOrderRowSql(db, { clientId, projectId, label, receivedAt, pricingModel = null, expectedValueCents = null, currency = null, ingestKey }) {
  db.prepare(
    `INSERT OR IGNORE INTO production_orders (client_id, project_id, label, state, pricing_model, expected_value_cents, currency, received_at, ingest_key)
     VALUES (?, ?, ?, 'OPEN', ?, ?, ?, ?, ?)`,
  ).run(clientId, projectId, label, pricingModel, expectedValueCents, currency, receivedAt, ingestKey);
  return db.prepare(`SELECT * FROM production_orders WHERE ingest_key = ?`).get(ingestKey);
}

// Mirrors ingestProductionOrder's item half: container + N deliverables,
// all linked via production_order_id. Only runs if the order has no
// items yet (the same idempotency guard actions.ts uses).
export function ingestItemsSql(db, { orderId, clientId, projectId, label, receivedAt, itemTitles }) {
  const existing = db.prepare(`SELECT id FROM video_logs WHERE production_order_id = ?`).get(orderId);
  if (existing) return { skipped: true };

  const insert = db.prepare(
    `INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, batch_label, video_kind, is_operational_container, production_order_id)
     VALUES (?, ?, ?, ?, 'PLANNED', 0, ?, 'CLIENT_WORK', ?, ?)`,
  );
  const containerResult = insert.run(receivedAt, `[Container] ${label}`, clientId, projectId, label, 1, orderId);
  const itemIds = [];
  for (const title of itemTitles) {
    const result = insert.run(receivedAt, title, clientId, projectId, label, 0, orderId);
    itemIds.push(Number(result.lastInsertRowid));
  }
  return { skipped: false, containerVideoId: Number(containerResult.lastInsertRowid), itemIds };
}

// Transactional SQLite equivalent of ingestProductionOrder's D1 db.batch.
// Every child is validated before BEGIN; the order's auto-generated ID is
// then resolved by its unique ingest key inside the transaction, exactly as
// the real Drizzle statements do with their scalar subquery.
export function ingestOrderAtomicallySql(
  db,
  { clientId, projectId, clientName = "Taryn Dubreuil", label, receivedAt, itemTitles, ingestKey },
  { failAtChildIndex = null } = {},
) {
  const prepared = [];
  for (let index = 0; index < itemTitles.length; index++) {
    const parsed = validateVideoCreateInput({
      title: itemTitles[index],
      projectId,
      clientId: null,
      date: receivedAt,
      status: "PLANNED",
      allowExplicitStatus: true,
    });
    if (!parsed.success) {
      return { success: false, error: `Row ${index + 1}: ${parsed.error}` };
    }
    prepared.push({
      ...parsed.data,
      videoKind: clientName.trim().toUpperCase() === "RMEDIA" ? "INTERNAL" : "CLIENT_WORK",
    });
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const order = ingestOrderRowSql(db, {
      clientId,
      projectId,
      label,
      receivedAt,
      ingestKey,
    });
    const existing = db
      .prepare("SELECT id, is_operational_container FROM video_logs WHERE production_order_id = ?")
      .all(order.id);
    if (existing.length > 0) {
      const containers = existing.filter((row) => row.is_operational_container === 1).length;
      if (containers !== 1 || existing.length - containers !== prepared.length) {
        throw new Error("incomplete existing order");
      }
      db.exec("COMMIT");
      return { success: true, orderId: order.id, skipped: true };
    }

    const insert = db.prepare(
      `INSERT INTO video_logs
         (date, title, client_id, project_id, status, started_at,
          revisions_count, delivered, delivery_url, review_url, published_url,
          notes, cover_url, orientation, content_type, batch_label, is_priority,
          video_kind, is_operational_container, production_order_id, cancelled_at,
          created_at, updated_at, visible_to_client)
       VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULL,
               unixepoch(), unixepoch(), 1)`,
    );
    insert.run(
      receivedAt,
      `[Container] ${label.trim()}`,
      clientId,
      projectId,
      "PLANNED",
      0,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      label.trim(),
      "CLIENT_WORK",
      1,
      order.id,
    );
    const itemIds = [];
    for (let index = 0; index < prepared.length; index++) {
      const row = prepared[index];
      const result = insert.run(
        row.date,
        row.title,
        clientId,
        projectId,
        row.status,
        row.status === "DONE" ? 1 : 0,
        row.deliveryUrl,
        row.reviewUrl,
        row.publishedUrl,
        row.notes,
        row.coverUrl,
        row.orientation,
        row.contentType,
        label.trim(),
        row.videoKind,
        0,
        order.id,
      );
      itemIds.push(Number(result.lastInsertRowid));
      if (failAtChildIndex === index) {
        throw new Error("injected child persistence failure");
      }
    }
    db.exec("COMMIT");
    return { success: true, orderId: order.id, skipped: false, itemIds };
  } catch (error) {
    db.exec("ROLLBACK");
    return { success: false, error: error instanceof Error ? error.message : "persistence failure" };
  }
}
