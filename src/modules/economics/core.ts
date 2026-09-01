// Wave 2G: Video Economics prototype. FIXED PRICE and HOURLY stay
// separate concepts throughout -- never blended into one "rate".
export type DataCoverage = "HIGH" | "MEDIUM" | "LOW";

// Wave 3D patch: coverage now considers closed+valid session COUNT,
// total attributed DURATION, and the presence of stale/invalid sessions
// -- not count alone (Wave 2's crude heuristic treated "1 session, 4
// hours" the same as "1 session, 4 minutes", which was the flagged
// weakness). Still explicitly NOT a statistical confidence interval --
// callers must never present it as one, and the raw inputs must always be
// shown alongside the label (see the Evidence Drawer).
export type CoverageInput = {
  validClosedSessionCount: number; // closed, integrityState NOT IN (INVALID)
  totalTrackedSeconds: number; // sum of valid closed session durations
  staleOrInvalidCount: number; // sessions currently stale or marked invalid
};

export function classifyDataCoverage(input: CoverageInput): DataCoverage {
  if (input.validClosedSessionCount === 0) return "LOW";
  const hours = input.totalTrackedSeconds / 3600;
  const hasIntegrityFlags = input.staleOrInvalidCount > 0;

  if (input.validClosedSessionCount >= 3 && hours >= 3 && !hasIntegrityFlags) return "HIGH";
  if (hours >= 0.5) return "MEDIUM"; // some valid attributed evidence but incomplete, or integrity-flagged
  return "LOW";
}

// Effective rate only makes sense for FIXED price work (agreed value
// divided by tracked hours). For HOURLY work the "rate" is just the
// contract rate itself -- computing an "effective rate" there would be
// circular, so this function is fixed-price only by design.
export function computeEffectiveRate(fixedPriceCents: number, trackedSeconds: number): number | null {
  const hours = trackedSeconds / 3600;
  if (hours <= 0) return null;
  return fixedPriceCents / 100 / hours;
}
