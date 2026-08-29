import { personalTransactions, transactions } from "../../db/schema.ts";
import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema.ts";

type OwnerPayDb = DrizzleD1Database<typeof schema>;

export type OwnerPayStatementInput = {
  amount: number;
  currency: string;
  date: string;
  notes: string | null;
  idempotencyKey: string;
};

/**
 * Builds the one atomic D1 batch used by recordOwnerPay. Kept outside the
 * Server Action so the exact Drizzle query shape can be regression-tested:
 * INSERT ... SELECT requires every target key in schema order.
 */
export function buildOwnerPayStatements(
  db: OwnerPayDb,
  input: OwnerPayStatementInput,
) {
  const businessInsert = db
    .insert(transactions)
    .values({
      type: "owner_pay",
      amount: input.amount,
      category: "Owner Pay",
      date: input.date,
      notes: input.notes,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
    })
    .onConflictDoNothing({ target: transactions.idempotencyKey });

  const receiptSource = db
    .select({
      id: sql<number | null>`null`.as("id"),
      type: sql<"owner_pay_receipt">`'owner_pay_receipt'`.as("type"),
      amount: transactions.amount,
      category: sql<string>`'Owner Pay'`.as("category"),
      currency: transactions.currency,
      date: transactions.date,
      notes: transactions.notes,
      ownerPayTransactionId: transactions.id,
      createdAt: sql<Date>`unixepoch()`.as("created_at"),
    })
    .from(transactions)
    .where(eq(transactions.idempotencyKey, input.idempotencyKey));

  const personalInsert = db
    .insert(personalTransactions)
    .select(receiptSource)
    .onConflictDoNothing({ target: personalTransactions.ownerPayTransactionId });

  return [businessInsert, personalInsert] as const;
}

/**
 * Corrects the two sides of one Owner Pay transfer in a single D1 batch.
 * Both rows keep their original IDs and 1:1 foreign-key relationship.
 */
export function buildOwnerPayCorrectionStatements(
  db: OwnerPayDb,
  transactionId: number,
  input: Omit<OwnerPayStatementInput, "idempotencyKey">,
) {
  const normalized = {
    amount: input.amount,
    currency: input.currency,
    date: input.date,
    notes: input.notes,
  };
  const businessUpdate = db
    .update(transactions)
    .set({ ...normalized, category: "Owner Pay" })
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.type, "owner_pay"),
      ),
    );
  const personalUpdate = db
    .update(personalTransactions)
    .set({ ...normalized, category: "Owner Pay" })
    .where(
      and(
        eq(personalTransactions.ownerPayTransactionId, transactionId),
        eq(personalTransactions.type, "owner_pay_receipt"),
      ),
    );
  return [businessUpdate, personalUpdate] as const;
}
