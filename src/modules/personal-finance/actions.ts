"use server";

import { getAuthenticatedDb } from "@/db";
import { personalTransactions, transactions, fxConversions } from "@/db/schema";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { todayISO } from "@/utils/date";
import { DEFAULT_CURRENCY } from "../finance/config";
import { computeFxCashMovements } from "../fx/core";
import {
  computePersonalBalanceByCurrency,
  computePersonalFlowByCurrency,
  validatePersonalTransactionInput,
  validatePersonalTransactionCorrectionInput,
  isDeletablePersonalTransactionType,
} from "./core";

export type PersonalActionResult = { success: true } | { success: false; error: string };

async function insertPersonalTransaction(data: {
  type: "opening_balance" | "owner_pay_receipt" | "income" | "expense";
  amount: number;
  category: string;
  currency: string;
  date?: string;
  notes?: string;
  ownerPayTransactionId?: number | null;
}) {
  const db = await getAuthenticatedDb();
  await db.insert(personalTransactions).values({
    type: data.type,
    amount: data.amount,
    category: data.category,
    currency: data.currency,
    date: data.date ?? todayISO(),
    notes: data.notes ?? null,
    ownerPayTransactionId: data.ownerPayTransactionId ?? null,
  });
}

// An explicit starting-point fact, distinct from income -- see the
// personal_transactions table comment in src/db/schema.ts.
export async function recordPersonalOpeningBalance(data: {
  amount: number;
  currency?: string;
  date?: string;
  notes?: string;
}): Promise<PersonalActionResult> {
  const currency = data.currency?.trim() || DEFAULT_CURRENCY;
  const date = data.date ?? todayISO();
  const error = validatePersonalTransactionInput({
    type: "opening_balance",
    amount: data.amount,
    category: "Opening Balance",
    currency,
    date,
  });
  if (error) return { success: false, error };
  await insertPersonalTransaction({
    type: "opening_balance",
    amount: data.amount,
    category: "Opening Balance",
    currency,
    date,
    notes: data.notes,
  });
  revalidatePath("/finance/personal");
  return { success: true };
}

// Genuine external personal income -- deliberately separate from Owner Pay
// receipts (see validatePersonalTransactionInput).
export async function recordPersonalIncome(data: {
  amount: number;
  category: string;
  currency?: string;
  date?: string;
  notes?: string;
}): Promise<PersonalActionResult> {
  const currency = data.currency?.trim() || DEFAULT_CURRENCY;
  const date = data.date ?? todayISO();
  const error = validatePersonalTransactionInput({
    type: "income",
    amount: data.amount,
    category: data.category,
    currency,
    date,
  });
  if (error) return { success: false, error };
  await insertPersonalTransaction({
    type: "income",
    amount: data.amount,
    category: data.category,
    currency,
    date,
    notes: data.notes,
  });
  revalidatePath("/finance/personal");
  return { success: true };
}

export async function recordPersonalExpense(data: {
  amount: number;
  category: string;
  currency?: string;
  date?: string;
  notes?: string;
}): Promise<PersonalActionResult> {
  const currency = data.currency?.trim() || DEFAULT_CURRENCY;
  const date = data.date ?? todayISO();
  const error = validatePersonalTransactionInput({
    type: "expense",
    amount: data.amount,
    category: data.category,
    currency,
    date,
  });
  if (error) return { success: false, error };
  await insertPersonalTransaction({
    type: "expense",
    amount: data.amount,
    category: data.category,
    currency,
    date,
    notes: data.notes,
  });
  revalidatePath("/finance/personal");
  return { success: true };
}

// Called only from finance/actions.ts's recordOwnerPay -- the one and only
// writer of `owner_pay_receipt` rows, always paired 1:1 with the business
// `transactions` row that triggered it (enforced by the unique index on
// personal_transactions.owner_pay_transaction_id and the DB-level
// personal_transactions_owner_pay_link_check). This is what makes RMEDIA
// CASH -> OWNER PAY -> PERSONAL MONEY a real, reconciled bridge instead of
// two independently-typed ledgers that can silently drift apart.
export async function linkOwnerPayReceipt(data: {
  ownerPayTransactionId: number;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
}) {
  await insertPersonalTransaction({
    type: "owner_pay_receipt",
    amount: data.amount,
    category: "Owner Pay",
    currency: data.currency,
    date: data.date,
    notes: data.notes,
    ownerPayTransactionId: data.ownerPayTransactionId,
  });
  revalidatePath("/finance/personal");
}

// Personal Finance Correction Patch -- a compact correction path for
// ordinary manually-created rows. Always UPDATEs the existing row in
// place (preserves id, never deletes+recreates -- so a simple type
// correction like "this was actually an expense, not income" never
// duplicates history). Only reachable for rows that are ALREADY
// income/expense and stay income/expense -- opening_balance and
// owner_pay_receipt are rejected before any write, both on the way in
// (current row) and the way out (requested type), so neither can be
// casually converted into or out of its protected meaning.
export async function updatePersonalTransaction(
  id: number,
  data: {
    type: "income" | "expense";
    amount: number;
    currency: string;
    date: string;
    notes?: string;
    // Optional -- category has no canonical enum in this table (free
    // text, same as the create flow), so a blank/omitted value leaves
    // the row's existing category untouched rather than being coerced
    // to some default.
    category?: string;
  },
): Promise<PersonalActionResult> {
  const db = await getAuthenticatedDb();
  const current = await db
    .select({
      id: personalTransactions.id,
      type: personalTransactions.type,
      category: personalTransactions.category,
    })
    .from(personalTransactions)
    .where(eq(personalTransactions.id, id))
    .limit(1);
  if (!current[0]) {
    return { success: false, error: "Transaction not found." };
  }

  const currency = data.currency.trim() || DEFAULT_CURRENCY;
  const error = validatePersonalTransactionCorrectionInput({
    currentType: current[0].type,
    nextType: data.type,
    amount: data.amount,
    currency,
    date: data.date,
  });
  if (error) return { success: false, error };

  const category = data.category?.trim() || current[0].category;

  await db
    .update(personalTransactions)
    .set({
      type: data.type,
      amount: data.amount,
      currency,
      date: data.date,
      notes: data.notes ?? null,
      category,
    })
    .where(eq(personalTransactions.id, id));

  revalidatePath("/finance/personal");
  return { success: true };
}

// Delete is only reachable for ordinary income/expense rows -- see
// isDeletablePersonalTransactionType's comment in core.ts for why
// opening_balance/owner_pay_receipt are rejected outright rather than
// conditionally, and the WHERE clause below repeats the same type guard
// as a second, DB-level line of defense (defense in depth, not because
// the app-level check above is trusted any less).
export async function deletePersonalTransaction(id: number): Promise<PersonalActionResult> {
  const db = await getAuthenticatedDb();
  const current = await db
    .select({ id: personalTransactions.id, type: personalTransactions.type })
    .from(personalTransactions)
    .where(eq(personalTransactions.id, id))
    .limit(1);
  if (!current[0]) {
    return { success: false, error: "Transaction not found." };
  }
  if (!isDeletablePersonalTransactionType(current[0].type)) {
    return {
      success: false,
      error:
        current[0].type === "owner_pay_receipt"
          ? "Owner Pay receipts can't be deleted here -- they're the record of a real transfer from the business."
          : "Opening Balance can't be deleted here.",
    };
  }

  const deleted = await db
    .delete(personalTransactions)
    .where(
      and(
        eq(personalTransactions.id, id),
        or(eq(personalTransactions.type, "income"), eq(personalTransactions.type, "expense")),
      ),
    )
    .returning({ id: personalTransactions.id });
  if (deleted.length === 0) {
    return { success: false, error: "Transaction not found." };
  }

  revalidatePath("/finance/personal");
  return { success: true };
}

export async function getPersonalTransactions() {
  const db = await getAuthenticatedDb();
  return db.select().from(personalTransactions).orderBy(asc(personalTransactions.date));
}

// Lunch Reality Patch §5: folds PERSONAL-scope fx_conversions into the
// balance the exact same read-time way Business Cash already folds
// BUSINESS-scope ones (getRmediaCashSummary in finance/actions.ts) -- one
// pure computeFxCashMovements function, no synthetic transaction row, no
// separately-maintained balance column. BUSINESS and UNCLASSIFIED rows are
// filtered out here, before computePersonalBalanceByCurrency ever sees
// them, so a business conversion can never silently touch Personal Finance.
export async function getPersonalBalanceSummary() {
  const db = await getAuthenticatedDb();
  const [rows, personalFx] = await Promise.all([
    db.select().from(personalTransactions),
    db.select().from(fxConversions).where(eq(fxConversions.scope, "PERSONAL")),
  ]);
  const fxMovements = personalFx.flatMap((fx) =>
    computeFxCashMovements({ brlAmount: fx.brlAmount, usdAmount: fx.usdAmount, fromCurrency: fx.fromCurrency }),
  );
  return computePersonalBalanceByCurrency(rows, fxMovements);
}

export async function getPersonalFlowSummary(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const db = await getAuthenticatedDb();
  const [rows, personalFx] = await Promise.all([
    db.select().from(personalTransactions),
    db.select().from(fxConversions).where(eq(fxConversions.scope, "PERSONAL")),
  ]);
  const fxMovements = personalFx.flatMap((fx) =>
    computeFxCashMovements({
      brlAmount: fx.brlAmount,
      usdAmount: fx.usdAmount,
      fromCurrency: fx.fromCurrency,
    }).map((movement) => ({ ...movement, date: fx.date })),
  );
  return computePersonalFlowByCurrency(rows, fxMovements, month);
}


// ─── Client Portal Reality round §F: existing Owner Pay reconciliation ────
// Read-only detection + deterministic, idempotent repair of a business
// Owner Pay row that has no linked personal receipt. This round explicitly
// authorizes repairing this ONE exact, unambiguous relationship -- it
// never touches the business transaction, never guesses, and never
// bulk-rewrites history. A row this doesn't find (e.g. because it's
// genuinely ambiguous, or already linked) is left untouched.
export type OrphanedOwnerPayRow = {
  transactionId: number;
  amount: number;
  currency: string;
  date: string;
  notes: string | null;
};

export async function findOrphanedOwnerPayTransactions(): Promise<OrphanedOwnerPayRow[]> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      currency: transactions.currency,
      date: transactions.date,
      notes: transactions.notes,
    })
    .from(transactions)
    .leftJoin(
      personalTransactions,
      eq(personalTransactions.ownerPayTransactionId, transactions.id),
    )
    .where(and(eq(transactions.type, "owner_pay"), isNull(personalTransactions.id)));

  return rows.map((row) => ({
    transactionId: row.id,
    amount: row.amount,
    currency: row.currency,
    date: row.date,
    notes: row.notes,
  }));
}

export type RepairOrphanedOwnerPayResult = {
  repairedTransactionIds: number[];
};

// Idempotent by construction: each iteration re-derives from
// findOrphanedOwnerPayTransactions (a fresh orphan re-check would find
// nothing left to repair on a second run), and the unique index on
// personal_transactions.owner_pay_transaction_id makes a concurrent
// double-repair of the same row fail safely (caught and skipped, not
// duplicated) rather than create a second receipt.
export async function repairOrphanedOwnerPayReceipts(): Promise<RepairOrphanedOwnerPayResult> {
  const orphans = await findOrphanedOwnerPayTransactions();
  const repairedTransactionIds: number[] = [];
  for (const row of orphans) {
    try {
      await linkOwnerPayReceipt({
        ownerPayTransactionId: row.transactionId,
        amount: row.amount,
        currency: row.currency,
        date: row.date,
        notes: row.notes ?? undefined,
      });
      repairedTransactionIds.push(row.transactionId);
    } catch {
      // Already linked by a concurrent repair/write -- not actually
      // orphaned anymore; skip silently rather than error the whole run.
    }
  }
  if (repairedTransactionIds.length > 0) {
    revalidatePath("/finance/personal");
  }
  return { repairedTransactionIds };
}


// ─── Client Portal Reality round §E: Business <-> Personal traceability ───
// One tiny reverse lookup so a Business Finance Owner Pay row can link to
// its personal receipt. Keyed by the business transaction id (not the
// receipt id) since that's what the Finance page already has on hand.
export async function getOwnerPayReceiptIdsByTransaction(): Promise<Map<number, number>> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ id: personalTransactions.id, ownerPayTransactionId: personalTransactions.ownerPayTransactionId })
    .from(personalTransactions)
    .where(eq(personalTransactions.type, "owner_pay_receipt"));

  const map = new Map<number, number>();
  for (const row of rows) {
    if (row.ownerPayTransactionId !== null) {
      map.set(row.ownerPayTransactionId, row.id);
    }
  }
  return map;
}
