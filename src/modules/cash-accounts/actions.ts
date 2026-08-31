"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { cashAccounts, cashAccountSnapshots, cashMovements } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  computeCashPocketBalance,
  computePocketDifference,
  isCashPocketScope,
  validateAccountSnapshotInput,
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
