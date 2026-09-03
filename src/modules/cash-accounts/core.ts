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

// A Dashboard-safe cash headline: aggregates per-pocket reconciliation rows
// into "available" (MAIN pockets) vs "reserved" (RESERVE pockets) totals per
// currency, preferring a real Wise-observed snapshot over the derived ledger
// figure wherever one exists. `*Observed` is true only when EVERY pocket
// contributing to that total has a real observed snapshot behind it — if any
// pocket is still ledger-only, the aggregate is flagged unverified rather
// than silently presented as confirmed cash. This never merges MAIN and
// RESERVE, and never mixes currencies or scopes (call once per scope).
export type CashHeadlineRow = {
  currency: CashPocketCurrency;
  availableAmount: number;
  availableObserved: boolean;
  availableAsOf: string | null;
  availableSource: string | null;
  reservedAmount: number;
  reservedObserved: boolean;
  reservedAsOf: string | null;
  reservedSource: string | null;
};

export type CashHeadlineSourceRow = {
  currency: CashPocketCurrency;
  pocket: CashPocketKind;
  ledgerAmount: number;
  observed: { amount: number; observedAt: string; source: string } | null;
};

export function computeCashHeadlineByCurrency(
  rows: CashHeadlineSourceRow[],
): CashHeadlineRow[] {
  const byCurrency = new Map<CashPocketCurrency, CashHeadlineRow>();

  const ensure = (currency: CashPocketCurrency): CashHeadlineRow => {
    const existing = byCurrency.get(currency);
    if (existing) return existing;
    const created: CashHeadlineRow = {
      currency,
      availableAmount: 0,
      availableObserved: true,
      availableAsOf: null,
      availableSource: null,
      reservedAmount: 0,
      reservedObserved: true,
      reservedAsOf: null,
      reservedSource: null,
    };
    byCurrency.set(currency, created);
    return created;
  };

  for (const account of rows) {
    const row = ensure(account.currency);
    const amount = account.observed ? account.observed.amount : account.ledgerAmount;
    const isMain = account.pocket === "MAIN";
    const total = isMain ? row.availableAmount : row.reservedAmount;
    const nextTotal = roundCash(total + amount);

    if (isMain) {
      row.availableAmount = nextTotal;
      if (!account.observed) {
        row.availableObserved = false;
      } else if (!row.availableAsOf || account.observed.observedAt > row.availableAsOf) {
        row.availableAsOf = account.observed.observedAt;
        row.availableSource = account.observed.source;
      }
    } else {
      row.reservedAmount = nextTotal;
      if (!account.observed) {
        row.reservedObserved = false;
      } else if (!row.reservedAsOf || account.observed.observedAt > row.reservedAsOf) {
        row.reservedAsOf = account.observed.observedAt;
        row.reservedSource = account.observed.source;
      }
    }
  }

  return Array.from(byCurrency.values()).sort((a, b) => a.currency.localeCompare(b.currency));
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
