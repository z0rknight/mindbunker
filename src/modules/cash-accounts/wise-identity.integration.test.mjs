import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../db/migrations",
);

function buildMigratedDb() {
  const db = new DatabaseSync(":memory:");
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const migration = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) db.exec(statement.trim());
    }
  }
  return db;
}

test("Wise identity is independent from UI-submit idempotency and dedupes business rows", () => {
  const db = buildMigratedDb();
  db.prepare(`
    INSERT INTO transactions
      (type,amount,category,date,currency,idempotency_key,external_source,external_id)
    VALUES ('expense',19.90,'Software','2026-08-25','USD','ui-submit-key','WISE','CARD-1')
  `).run();
  assert.throws(() => db.prepare(`
    INSERT INTO transactions
      (type,amount,category,date,currency,idempotency_key,external_source,external_id)
    VALUES ('expense',19.90,'Software','2026-08-25','USD','different-submit','WISE','CARD-1')
  `).run(), /unique/i);
  assert.equal(db.prepare("SELECT idempotency_key FROM transactions").get().idempotency_key, "ui-submit-key");
});

test("personal and FX Wise identities are idempotent without requiring client attribution", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO transactions(type,amount,category,date,currency,external_source,external_id)
      VALUES ('income',300,'Upwork cash receipt — attribution pending','2026-08-03','USD','WISE','TRANSFER-1');
    INSERT INTO personal_transactions(type,amount,category,date,currency,external_source,external_id)
      VALUES ('opening_balance',0.25,'Wise opening balance','2026-08-02','USD','WISE','OPENING-1');
    INSERT INTO fx_conversions(date,brl_amount,usd_amount,scope,from_currency,external_source,external_id)
      VALUES ('2026-08-03',503.47,100,'PERSONAL','USD','WISE','BALANCE-1');
  `);
  assert.equal(db.prepare("SELECT client_id FROM transactions WHERE external_id='TRANSFER-1'").get().client_id, null);
  assert.throws(() => db.exec("INSERT INTO personal_transactions(type,amount,category,date,currency,external_source,external_id) VALUES ('expense',1,'x','2026-08-02','USD','WISE','OPENING-1')"), /unique/i);
  assert.throws(() => db.exec("INSERT INTO fx_conversions(date,brl_amount,usd_amount,scope,external_source,external_id) VALUES ('2026-08-03',5,1,'PERSONAL','WISE','BALANCE-1')"), /unique/i);
});

test("reserve and internal transfers remain bank facts, never revenue or expense", () => {
  const db = buildMigratedDb();
  db.exec(`
    INSERT INTO cash_accounts(id,scope,currency,pocket,label,external_account_id,opening_balance,opening_as_of)
      VALUES (1,'BUSINESS','USD','MAIN','Business USD main','main',0,'2026-08-02'),
             (2,'BUSINESS','USD','RESERVE','Business USD reserve','reserve',0,'2026-08-02');
    INSERT INTO cash_movements(cash_account_id,date,occurred_at,amount,state,description,external_id)
      VALUES (1,'2026-08-26','2026-08-26T12:00:00',-100,'INTERNAL_TRANSFER','Moved to reserve','MOVE-1'),
             (2,'2026-08-26','2026-08-26T12:00:00',100,'INTERNAL_TRANSFER','Moved from main','MOVE-1');
  `);
  assert.equal(db.prepare("SELECT COALESCE(SUM(amount),0) total FROM cash_movements WHERE cash_account_id=1").get().total, -100);
  assert.equal(db.prepare("SELECT COALESCE(SUM(amount),0) total FROM cash_movements WHERE cash_account_id=2").get().total, 100);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM transactions").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM personal_transactions").get().count, 0);
});
