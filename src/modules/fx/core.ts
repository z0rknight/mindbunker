// Sprint C1 -- pure logic only. No DB access here (that lives in
// actions.ts); everything below is unit-testable in isolation and is what
// core.test.mjs exercises directly.

import { EFFECTIVE_USD_TO_BRL_RATE } from "../finance/config.ts";
import type { FxRateSource } from "./config.ts";

// FX + Business Operating Cash Patch §2/§3: every conversion belongs to
// BUSINESS or PERSONAL money, never mixed by default. UNCLASSIFIED exists
// only for historical rows recorded before this column existed (the
// migration's honest default) -- never a value a new conversion can be
// created with. purpose describes INTENT for a BUSINESS conversion only
// (never an expense itself -- see fx_conversions in src/db/schema.ts).
export const FX_SCOPES = ["BUSINESS", "PERSONAL", "UNCLASSIFIED"] as const;
export type FxScope = (typeof FX_SCOPES)[number];

export const FX_PURPOSES = ["OPERATING_COST", "TAX_RESERVE", "OWNER_TRANSFER", "OTHER"] as const;
export type FxPurpose = (typeof FX_PURPOSES)[number];

export const FX_CURRENCIES = ["BRL", "USD"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export type FxConversionLike = {
  brlAmount: number;
  usdAmount: number;
};

export type FxRateEligibleLike = FxConversionLike & {
  countsTowardObservedRate?: boolean;
};

export function filterRateEligibleConversions<T extends FxRateEligibleLike>(
  conversions: T[],
): T[] {
  return conversions.filter((conversion) => conversion.countsTowardObservedRate !== false);
}

// Implied rate of a single conversion: how many BRL it took to get one USD.
export function computeImpliedRate(input: FxConversionLike): number {
  return round4(input.brlAmount / input.usdAmount);
}

// Volume-weighted average rate across any number of conversions: total BRL
// moved divided by total USD moved. This is deliberately NOT a simple
// average of implied rates -- a R$5,000 conversion should influence the
// month's rate more than a R$50 one. Returns null for an empty/degenerate
// input rather than pretending a rate exists.
export function computeVolumeWeightedRate(
  conversions: FxConversionLike[],
): number | null {
  if (conversions.length === 0) return null;
  const totalBrl = conversions.reduce((sum, c) => sum + c.brlAmount, 0);
  const totalUsd = conversions.reduce((sum, c) => sum + c.usdAmount, 0);
  if (totalUsd <= 0) return null;
  return round4(totalBrl / totalUsd);
}

export type FxRateResolution = {
  rate: number;
  source: FxRateSource;
  observedConversionCount: number;
};

// Provenance hierarchy for "what BRL<->USD rate applies to month X":
//   1. OBSERVED -- volume-weighted average of real fx_conversions rows
//      dated within that month. Most trustworthy: it's what actually
//      happened.
//   2. MANUAL -- a rate Emmanuel explicitly declared for that month (no
//      conversions recorded yet, but he knows/remembers the rate).
//   3. FALLBACK -- the app-wide EFFECTIVE_USD_TO_BRL_RATE constant.
// Never fetches a live rate and never rewrites a past month's resolved
// rate based on today's data -- each month's resolution only ever looks
// at that month's own conversions/manual rate.
export function resolveFxRateForMonth(input: {
  monthConversions: FxConversionLike[];
  manualRate: number | null;
  fallbackRate?: number;
}): FxRateResolution {
  const observed = computeVolumeWeightedRate(input.monthConversions);
  if (observed !== null) {
    return {
      rate: observed,
      source: "OBSERVED",
      observedConversionCount: input.monthConversions.length,
    };
  }
  if (
    input.manualRate !== null &&
    Number.isFinite(input.manualRate) &&
    input.manualRate > 0
  ) {
    return { rate: input.manualRate, source: "MANUAL", observedConversionCount: 0 };
  }
  return {
    rate: input.fallbackRate ?? EFFECTIVE_USD_TO_BRL_RATE,
    source: "FALLBACK",
    observedConversionCount: 0,
  };
}

export function validateFxConversionInput(input: {
  date: string;
  brlAmount: number;
  usdAmount: number;
  scope: string;
  fromCurrency?: string | null;
  purpose?: string | null;
}, options: { allowUnclassified?: boolean } = {}): string | null {
  if (!input.date || !input.date.trim()) return "Date is required.";
  if (!Number.isFinite(input.brlAmount) || input.brlAmount <= 0) {
    return "BRL amount must be positive.";
  }
  if (!Number.isFinite(input.usdAmount) || input.usdAmount <= 0) {
    return "USD amount must be positive.";
  }
  if (!FX_SCOPES.includes(input.scope as FxScope)) {
    return "Scope must be BUSINESS or PERSONAL.";
  }
  if (input.scope === "UNCLASSIFIED" && !options.allowUnclassified) {
    return "New conversions must be BUSINESS or PERSONAL.";
  }
  if (
    input.fromCurrency !== null &&
    input.fromCurrency !== undefined &&
    !FX_CURRENCIES.includes(input.fromCurrency as FxCurrency)
  ) {
    return "From currency must be BRL or USD.";
  }
  if (
    input.purpose !== null &&
    input.purpose !== undefined &&
    !FX_PURPOSES.includes(input.purpose as FxPurpose)
  ) {
    return "Purpose must be OPERATING_COST, TAX_RESERVE, OWNER_TRANSFER, or OTHER.";
  }
  return null;
}

export function validateFxManualRateInput(input: {
  month: string;
  rate: number;
}): string | null {
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    return "Month must be in YYYY-MM format.";
  }
  if (!Number.isFinite(input.rate) || input.rate <= 0) {
    return "Rate must be positive.";
  }
  return null;
}

// Extracts "YYYY-MM" from an ISO "YYYY-MM-DD" date string.
export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export type FxCashMovement = { currency: FxCurrency; amount: number };

// FX + Business Operating Cash Patch §5/§6: converts one conversion row
// into its two cash movements -- one currency decreases, the other
// increases by exactly the amounts Emmanuel actually converted. Returns an
// empty array when fromCurrency is unknown (a legacy row recorded before
// this field existed, or an UNCLASSIFIED/PERSONAL row a caller chose not
// to resolve a direction for) -- an unrecorded direction is never guessed.
// This is the one place cash-movement direction logic lives; callers
// (finance/core.ts's computeFinanceSummaryByCurrency and
// finance/actions.ts's getEconomicLedgerPlanning) just fold the result into
// their own per-currency buckets, they never re-derive direction.
export function computeFxCashMovements(conversion: {
  brlAmount: number;
  usdAmount: number;
  fromCurrency: FxCurrency | null;
}): FxCashMovement[] {
  if (conversion.fromCurrency === "USD") {
    return [
      { currency: "USD", amount: -conversion.usdAmount },
      { currency: "BRL", amount: conversion.brlAmount },
    ];
  }
  if (conversion.fromCurrency === "BRL") {
    return [
      { currency: "BRL", amount: -conversion.brlAmount },
      { currency: "USD", amount: conversion.usdAmount },
    ];
  }
  return [];
}
