import { isActiveExternalClient } from "../../lib/client-identity.ts";
import { operatorDateKey, shiftDateKey } from "../../utils/date.ts";

export type CurrencyAmount = { currency: string; amount: number };

export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/u.test(currency) ? currency : null;
}

export function sumIncomeByCurrency(
  rows: readonly { type: string; amount: number; currency: unknown }[],
): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== "income") continue;
    const currency = normalizeCurrency(row.currency);
    if (!currency || !Number.isFinite(row.amount)) continue;
    totals.set(currency, (totals.get(currency) ?? 0) + row.amount);
  }
  return Array.from(totals, ([currency, amount]) => ({ currency, amount }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

export function amountForCurrency(
  totals: readonly CurrencyAmount[],
  currency: string,
): number {
  return totals.find((row) => row.currency === currency)?.amount ?? 0;
}

export function computeGoalProgress(input: {
  revenueByCurrency: readonly CurrencyAmount[];
  goalAmount: number;
  goalCurrency: string;
  dayOfMonth: number;
  daysInMonth: number;
}) {
  const currency = normalizeCurrency(input.goalCurrency);
  if (
    !currency ||
    !Number.isFinite(input.goalAmount) ||
    input.goalAmount <= 0 ||
    input.dayOfMonth < 1 ||
    input.daysInMonth < input.dayOfMonth
  ) {
    return { comparisonAvailable: false as const, revenue: null, pct: null, onTrack: null };
  }
  const matchingRevenue = input.revenueByCurrency.find(
    (row) => normalizeCurrency(row.currency) === currency,
  );
  if (!matchingRevenue) {
    return { comparisonAvailable: false as const, revenue: null, pct: null, onTrack: null };
  }
  const revenue = matchingRevenue.amount;
  const expected = input.goalAmount * (input.dayOfMonth / input.daysInMonth);
  return {
    comparisonAvailable: true as const,
    revenue,
    pct: Math.min(Math.round((revenue / input.goalAmount) * 100), 100),
    onTrack: revenue >= expected,
  };
}

export type CurrencyGrowth = CurrencyAmount & { previousAmount: number; growthPct: number | null };

export function growthByCurrency(
  current: readonly CurrencyAmount[],
  previous: readonly CurrencyAmount[],
): CurrencyGrowth[] {
  const currencies = new Set([...current.map((row) => row.currency), ...previous.map((row) => row.currency)]);
  return Array.from(currencies)
    .sort()
    .map((currency) => {
      const amount = amountForCurrency(current, currency);
      const previousAmount = amountForCurrency(previous, currency);
      const growthPct = previousAmount === 0
        ? null
        : Math.round(((amount - previousAmount) / previousAmount) * 100);
      return { currency, amount, previousAmount, growthPct };
    });
}

/** A one- or two-day month comparison is too weak for an authoritative % card. */
export function hasComparableTrendSample(elapsedDays: number, minimumDays = 3) {
  return Number.isSafeInteger(elapsedDays) && elapsedDays >= minimumDays;
}

/**
 * Consecutive local calendar days with a closed canonical Work Session.
 * The sequence may end today or yesterday; an empty today does not erase a
 * still-current streak, while a two-day gap does.
 */
export function computeConsistencyStreak(
  qualifyingDateKeys: Iterable<string>,
  todayKey: string,
): number {
  const dates = new Set(qualifyingDateKeys);
  let cursor = dates.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  if (!dates.has(cursor)) return 0;
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function consistencyStreakFromSessions(
  sessions: readonly { startedAt: Date | string; endedAt: Date | string | null }[],
  now: Date = new Date(),
): number {
  return computeConsistencyStreak(
    sessions
      .filter((session) => session.endedAt !== null)
      .map((session) => operatorDateKey(session.startedAt)),
    operatorDateKey(now),
  );
}

export { isActiveExternalClient };
