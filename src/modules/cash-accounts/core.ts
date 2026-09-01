export type CashPocketKind = "MAIN" | "RESERVE";
export type CashPocketScope = "BUSINESS" | "PERSONAL";
export type CashPocketCurrency = "USD" | "BRL";

export type CashMovementAmount = {
  amount: number;
  date: string;
};

export function roundCash(value: number): number {
  return Math.round(value * 100) / 100;
}

// A pocket balance is a bank-fact derivation only: opening balance plus
// signed source movements. It never reads P&L categories and therefore
// cannot turn FX/transfers/ambiguity into revenue or expense.
export function computeCashPocketBalance(
  openingBalance: number,
  movements: CashMovementAmount[],
  throughDate?: string | null,
): number {
  const movementTotal = movements
    .filter((movement) => !throughDate || movement.date <= throughDate)
    .reduce((sum, movement) => sum + movement.amount, 0);
  return roundCash(openingBalance + movementTotal);
}

export function computePocketDifference(ledger: number, observed: number): number {
  return roundCash(observed - ledger);
}

export function isCashPocketScope(value: unknown): value is CashPocketScope {
  return value === "BUSINESS" || value === "PERSONAL";
}

export function validateAccountSnapshotInput(input: {
  cashAccountId: unknown;
  balanceAmount: unknown;
  observedAt: unknown;
}): string | null {
  const id = Number(input.cashAccountId);
  if (!Number.isSafeInteger(id) || id <= 0) return "Cash pocket is invalid.";
  const amount = Number(input.balanceAmount);
  if (!Number.isFinite(amount) || amount < 0) return "Enter a non-negative observed balance.";
  if (typeof input.observedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.observedAt)) {
    return "Enter a valid date.";
  }
  return null;
}

export function validateInternalPocketTransferInput(input: {
  fromAccountId: unknown;
  toAccountId: unknown;
  amount: unknown;
  date: unknown;
  idempotencyKey: unknown;
}): string | null {
  const from = Number(input.fromAccountId);
  const to = Number(input.toAccountId);
  if (!Number.isSafeInteger(from) || from <= 0 || !Number.isSafeInteger(to) || to <= 0) {
    return "Select valid source and destination pockets.";
  }
  if (from === to) return "Source and destination pockets must be different.";
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Transfer amount must be positive.";
  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return "Enter a valid transfer date.";
  }
  if (
    typeof input.idempotencyKey !== "string" ||
    !/^pocket-transfer:[0-9a-f-]{36}$/i.test(input.idempotencyKey)
  ) {
    return "Transfer request is invalid. Reopen the form and try again.";
  }
  return null;
}

export function validateInternalPocketPair(
  from: { id: number; scope: string; currency: string } | null,
  to: { id: number; scope: string; currency: string } | null,
  expectedScope: string,
): string | null {
  if (!from || !to || from.scope !== expectedScope || to.scope !== expectedScope) {
    return "Both pockets must belong to this Finance scope.";
  }
  if (from.id === to.id) return "Source and destination pockets must be different.";
  if (from.currency !== to.currency) {
    return "Pocket transfers must keep the same currency. Use FX for conversions.";
  }
  return null;
}
