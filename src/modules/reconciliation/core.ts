// Reality Closure (26 Aug 2026): LEDGER BALANCE vs OBSERVED ACCOUNT
// BALANCE. Pure, deterministic logic only -- no DB, no framework imports,
// same discipline as quotes/core.ts and pricing/core.ts. A snapshot is
// evidence for reconciliation; it is never income, expense, an FX
// conversion, or owner pay, and nothing here ever produces one of those.

export type CashScope = "BUSINESS" | "PERSONAL";
export type CashCurrency = "USD" | "BRL";

export function isCashScope(value: unknown): value is CashScope {
  return value === "BUSINESS" || value === "PERSONAL";
}

export function isCashCurrency(value: unknown): value is CashCurrency {
  return value === "USD" || value === "BRL";
}

export type CashBalanceSnapshotInput = {
  scope: CashScope;
  currency: CashCurrency;
  balanceAmount: number;
  observedAt: string;
  source?: string;
  notes?: string;
};

export type CashBalanceSnapshotValidation =
  | { success: true; data: Required<Omit<CashBalanceSnapshotInput, "notes">> & { notes: string | null } }
  | { success: false; errors: Record<string, string> };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateCashBalanceSnapshotInput(
  values: Record<string, unknown>,
): CashBalanceSnapshotValidation {
  const errors: Record<string, string> = {};

  if (!isCashScope(values.scope)) {
    errors.scope = "Scope must be BUSINESS or PERSONAL.";
  }
  if (!isCashCurrency(values.currency)) {
    errors.currency = "Currency must be USD or BRL.";
  }

  const balanceAmount = Number(values.balanceAmount);
  if (!Number.isFinite(balanceAmount) || balanceAmount < 0) {
    errors.balanceAmount = "Enter a non-negative observed balance.";
  }

  const observedAt = typeof values.observedAt === "string" ? values.observedAt.trim() : "";
  if (!ISO_DATE_RE.test(observedAt)) {
    errors.observedAt = "Enter a valid date.";
  }

  const source = typeof values.source === "string" && values.source.trim() ? values.source.trim() : "WISE_MANUAL";
  const notes = typeof values.notes === "string" && values.notes.trim() ? values.notes.trim().slice(0, 500) : null;

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      scope: values.scope as CashScope,
      currency: values.currency as CashCurrency,
      balanceAmount,
      observedAt,
      source,
      notes,
    },
  };
}

/**
 * Brief's exact convention: Observed - Ledger. A negative difference
 * means the ledger currently claims MORE than what's actually observed in
 * the account (e.g. an unlogged expense, a conversion fee, a fee the
 * ledger never recorded) -- a positive difference means the account holds
 * more than the ledger currently accounts for (e.g. an unlogged deposit).
 */
export function computeReconciliationDifference(ledgerAmount: number, observedAmount: number): number {
  return observedAmount - ledgerAmount;
}
