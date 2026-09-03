"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { cashBalanceSnapshots } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  computeReconciliationDifference,
  validateCashBalanceSnapshotInput,
  type CashScope,
} from "./core";
import { getEconomicLedgerPlanning } from "@/modules/finance/actions";
import { getPersonalBalanceSummary } from "@/modules/personal-finance/actions";

export type CashSnapshotActionResult =
  | { success: true }
  | { success: false; error: string; errors?: Record<string, string> };

// "Do NOT automatically create an adjustment transaction. Show the
// difference so Emmanuel can find/log the missing movement." This action
// does exactly one thing: append one evidence row. It never touches
// transactions, personal_transactions, or fx_conversions.
export async function recordCashBalanceSnapshot(
  input: Record<string, unknown>,
): Promise<CashSnapshotActionResult> {
  const validation = validateCashBalanceSnapshotInput(input);
  if (!validation.success) {
    return { success: false, error: "Check the highlighted fields.", errors: validation.errors };
  }
  const data = validation.data;

  const db = await getAuthenticatedDb();
  await db.insert(cashBalanceSnapshots).values({
    scope: data.scope,
    currency: data.currency,
    balanceAmount: data.balanceAmount,
    observedAt: data.observedAt,
    source: data.source,
    notes: data.notes,
  });

  revalidatePath("/finance");
  revalidatePath("/finance/personal");
  return { success: true };
}

export type ReconciliationRow = {
  currency: "USD" | "BRL";
  ledgerAmount: number;
  observed: { amount: number; observedAt: string; source: string } | null;
  difference: number | null;
};

async function getLatestSnapshots(scope: CashScope) {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(cashBalanceSnapshots)
    .where(eq(cashBalanceSnapshots.scope, scope))
    .orderBy(desc(cashBalanceSnapshots.observedAt), desc(cashBalanceSnapshots.createdAt));

  // Latest row per currency -- rows are already newest-first, so the
  // first one seen per currency wins.
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.currency)) latest.set(row.currency, row);
  }
  return latest;
}

// "RECONCILE WITH WISE" (Reality Closure brief): ledger vs observed, for
// both USD and BRL, for one scope. The ledger side reuses the EXACT same
// derivations /finance and /finance/personal already display (never a
// parallel calculation) -- this only adds the observed-balance evidence
// and the subtraction.
export async function getReconciliation(scope: CashScope): Promise<ReconciliationRow[]> {
  const [snapshots, ledgerByCurrency] = await Promise.all([
    getLatestSnapshots(scope),
    scope === "BUSINESS"
      ? getEconomicLedgerPlanning().then(
          (rows) => new Map(rows.map((r) => [r.currency, r.economicLedgerNet])),
        )
      : getPersonalBalanceSummary().then(
          (rows) => new Map(rows.map((r) => [r.currency, r.balance])),
        ),
  ]);

  const currencies: Array<"USD" | "BRL"> = ["USD", "BRL"];
  return currencies.map((currency) => {
    const ledgerAmount = ledgerByCurrency.get(currency) ?? 0;
    const snapshot = snapshots.get(currency);
    const observed = snapshot
      ? { amount: snapshot.balanceAmount, observedAt: snapshot.observedAt, source: snapshot.source }
      : null;
    return {
      currency,
      ledgerAmount,
      observed,
      difference: observed ? computeReconciliationDifference(ledgerAmount, observed.amount) : null,
    };
  });
}
