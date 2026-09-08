"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { cashAccounts, cashAccountSnapshots, cashMovements } from "@/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  computeCashPocketBalance,
  computePocketDifference,
  isCashPocketScope,
  validateAccountSnapshotInput,
  validateInternalPocketTransferInput,
  validateInternalPocketPair,
  type CashPocketScope,
} from "./core";

export type CashPocketReconciliationRow = {
  accountId: number;
  scope: CashPocketScope;
  currency: "USD" | "BRL";
  pocket: "MAIN" | "RESERVE";
  label: string;
  openingBalance: number;
  openingAsOf: string;
  ledgerAmount: number;
  observed: { amount: number; observedAt: string; source: string } | null;
  difference: number | null;
};

export async function getCashPocketReconciliation(
  scope: CashPocketScope,
): Promise<CashPocketReconciliationRow[]> {
  const db = await getAuthenticatedDb();
  const [accounts, movements, snapshots] = await Promise.all([
    db
      .select()
      .from(cashAccounts)
      .where(eq(cashAccounts.scope, scope))
      .orderBy(asc(cashAccounts.currency), asc(cashAccounts.pocket)),
    db.select().from(cashMovements).orderBy(asc(cashMovements.date)),
    db
      .select()
      .from(cashAccountSnapshots)
      .orderBy(desc(cashAccountSnapshots.observedAt), desc(cashAccountSnapshots.createdAt)),
  ]);

  return accounts.map((account) => {
    const accountMovements = movements.filter((movement) => movement.cashAccountId === account.id);
    const snapshot = snapshots.find((candidate) => candidate.cashAccountId === account.id) ?? null;
    const ledgerAmount = computeCashPocketBalance(
      account.openingBalance,
      accountMovements,
      snapshot?.observedAt ?? null,
    );
    const observed = snapshot
      ? {
          amount: snapshot.balanceAmount,
          observedAt: snapshot.observedAt,
          source: snapshot.source,
        }
      : null;

    return {
      accountId: account.id,
      scope: account.scope,
      currency: account.currency,
      pocket: account.pocket,
      label: account.label,
      openingBalance: account.openingBalance,
      openingAsOf: account.openingAsOf,
      ledgerAmount,
      observed,
      difference: observed ? computePocketDifference(ledgerAmount, observed.amount) : null,
    };
  });
}

export async function recordInternalPocketTransfer(input: {
  scope: string;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  date: string;
  notes?: string;
  idempotencyKey: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!isCashPocketScope(input.scope)) return { success: false, error: "Cash scope is invalid." };
  const error = validateInternalPocketTransferInput(input);
  if (error) return { success: false, error };

  const db = await getAuthenticatedDb();
  const accounts = await db
    .select()
    .from(cashAccounts)
    .where(inArray(cashAccounts.id, [input.fromAccountId, input.toAccountId]));
  const from = accounts.find((row) => row.id === input.fromAccountId);
  const to = accounts.find((row) => row.id === input.toAccountId);
  if (!from || !to) return { success: false, error: "Both pockets must belong to this Finance scope." };
  const pairError = validateInternalPocketPair(from, to, input.scope);
  if (pairError) return { success: false, error: pairError };

  const existing = await db
    .select({ id: cashMovements.id })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.externalSource, "MINDBUNKER"),
        eq(cashMovements.externalId, input.idempotencyKey),
      ),
    );
  if (existing.length === 2) return { success: true };
  if (existing.length !== 0) {
    return { success: false, error: "This transfer is incomplete. Nothing new was recorded." };
  }

  const occurredAt = input.date;
  const noteSuffix = input.notes?.trim() ? ` · ${input.notes.trim()}` : "";
  try {
    await db.batch([
      db.insert(cashMovements).values({
        cashAccountId: from.id,
        date: input.date,
        occurredAt,
        amount: -input.amount,
        state: "INTERNAL_TRANSFER",
        description: `Moved ${input.amount.toFixed(2)} ${from.currency} to ${to.label}${noteSuffix}`,
        counterparty: to.label,
        externalSource: "MINDBUNKER",
        externalId: input.idempotencyKey,
      }),
      db.insert(cashMovements).values({
        cashAccountId: to.id,
        date: input.date,
        occurredAt,
        amount: input.amount,
        state: "INTERNAL_TRANSFER",
        description: `Moved ${input.amount.toFixed(2)} ${to.currency} from ${from.label}${noteSuffix}`,
        counterparty: from.label,
        externalSource: "MINDBUNKER",
        externalId: input.idempotencyKey,
      }),
    ]);
  } catch {
    const replay = await db
      .select({ id: cashMovements.id })
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.externalSource, "MINDBUNKER"),
          eq(cashMovements.externalId, input.idempotencyKey),
        ),
      );
    if (replay.length !== 2) {
      return { success: false, error: "Pocket transfer was not recorded. Please try again." };
    }
  }
  revalidatePath("/finance");
  revalidatePath("/finance/personal");
  return { success: true };
}

// ─── AMBIGUOUS MOVEMENT CLASSIFICATION (Completion Round §A) ───────────────
// FACT: whether an imported cash movement has been classified.
// CANONICAL OWNER: cash_movements.state (already a real enum column:
// RECONCILED / AMBIGUOUS / EXTERNAL_TRANSFER / INTERNAL_TRANSFER / FX /
// IGNORE) -- it had a read side (getFinanceHealth's ambiguousEvidence
// count) but no UPDATE mutation anywhere in the codebase; every row was
// insert-only. This adds the missing write path to the same column,
// not a new parallel flag.
// OTHER SURFACES THAT READ IT: getFinanceHealth's ambiguousEvidence
// count already reads state === "AMBIGUOUS" directly, so it reflects
// this mutation with no further change needed.
export type AmbiguousCashMovement = {
  id: number;
  accountLabel: string;
  currency: "USD" | "BRL";
  date: string;
  amount: number;
  description: string;
  counterparty: string | null;
};

export async function getAmbiguousCashMovements(): Promise<AmbiguousCashMovement[]> {
  const db = await getAuthenticatedDb();
  return db
    .select({
      id: cashMovements.id,
      accountLabel: cashAccounts.label,
      currency: cashAccounts.currency,
      date: cashMovements.date,
      amount: cashMovements.amount,
      description: cashMovements.description,
      counterparty: cashMovements.counterparty,
    })
    .from(cashMovements)
    .innerJoin(cashAccounts, eq(cashAccounts.id, cashMovements.cashAccountId))
    .where(eq(cashMovements.state, "AMBIGUOUS"))
    .orderBy(desc(cashMovements.date));
}

const MOVEMENT_RESOLUTION_STATES = ["INTERNAL_TRANSFER", "EXTERNAL_TRANSFER", "IGNORE"] as const;
type MovementResolutionState = (typeof MOVEMENT_RESOLUTION_STATES)[number];

function isMovementResolutionState(value: unknown): value is MovementResolutionState {
  return typeof value === "string" && (MOVEMENT_RESOLUTION_STATES as readonly string[]).includes(value);
}

export async function classifyCashMovement(
  movementId: number,
  newState: unknown,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!Number.isSafeInteger(movementId) || movementId <= 0) {
    return { success: false, error: "Invalid movement." };
  }
  if (!isMovementResolutionState(newState)) {
    return { success: false, error: "Choose a valid classification." };
  }
  const db = await getAuthenticatedDb();
  const updated = await db
    .update(cashMovements)
    .set({ state: newState })
    .where(and(eq(cashMovements.id, movementId), eq(cashMovements.state, "AMBIGUOUS")))
    .returning({ id: cashMovements.id });
  if (!updated[0]) return { success: false, error: "Movement not found or already classified." };

  revalidatePath("/finance");
  revalidatePath("/finance/personal");
  return { success: true };
}

export async function recordCashAccountSnapshot(input: {
  scope: string;
  cashAccountId: number;
  balanceAmount: number;
  observedAt: string;
  notes?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!isCashPocketScope(input.scope)) return { success: false, error: "Cash scope is invalid." };
  const error = validateAccountSnapshotInput(input);
  if (error) return { success: false, error };

  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ id: cashAccounts.id, scope: cashAccounts.scope })
    .from(cashAccounts)
    .where(eq(cashAccounts.id, input.cashAccountId))
    .limit(1);
  if (!rows[0] || rows[0].scope !== input.scope) {
    return { success: false, error: "Cash pocket not found for this Finance scope." };
  }

  await db
    .insert(cashAccountSnapshots)
    .values({
      cashAccountId: input.cashAccountId,
      balanceAmount: input.balanceAmount,
      observedAt: input.observedAt,
      source: "WISE_MANUAL",
      notes: input.notes?.trim() || null,
    })
    .onConflictDoUpdate({
      target: [
        cashAccountSnapshots.cashAccountId,
        cashAccountSnapshots.observedAt,
        cashAccountSnapshots.source,
      ],
      set: {
        balanceAmount: input.balanceAmount,
        notes: input.notes?.trim() || null,
      },
    });
  revalidatePath("/finance");
  revalidatePath("/finance/personal");
  return { success: true };
}
