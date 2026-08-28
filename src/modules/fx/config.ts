// Sprint C1 -- minimal shared vocabulary for the FX observed-rate ledger.
// No automatic FX API, no multi-currency-pair generalization: this is
// specifically BRL<->USD, matching every other currency-safety decision
// already made in this app.

export type FxRateSource = "OBSERVED" | "MANUAL" | "FALLBACK";

export const FX_RATE_SOURCES: readonly FxRateSource[] = [
  "OBSERVED",
  "MANUAL",
  "FALLBACK",
];
