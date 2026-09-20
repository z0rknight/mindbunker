// RMEDIA OS evidence visualisation math (Train M4). Pure, React-free.
// A visualisation must not create precision: these helpers only scale numbers
// they are GIVEN, keep UNKNOWN as its own visible segment (never folded into
// zero or into a "full" bar), and report over-allocation instead of hiding it.

/** Provenance of a value. Drawn as solid / hatched+labelled / dashed-empty, so it survives greyscale. */
export type EvidenceSource = "fact" | "derived" | "unknown";

export type RailSegmentInput = {
  key: string;
  label: string;
  /** Non-negative amount in one consistent unit (seconds or minutes). */
  value: number;
  source: EvidenceSource;
  /** The segment the surrounding surface is ABOUT (e.g. time attributed to THIS batch): violet emphasis. */
  emphasis?: boolean;
  /** "muted": a quieter solid fill for a known-but-secondary fact (e.g. idle time inside a session). */
  tone?: "muted";
  /** Pre-formatted exact value for labels/aria (units included), e.g. "4h00". */
  display: string;
};

export type RailSegment = RailSegmentInput & { pct: number };

export type Rail = {
  total: number;
  segments: RailSegment[];
  /** The parts add up to MORE than the stated total (data problem): shown, never clipped silently. */
  overAllocated: boolean;
  /** Plain-text equivalent for assistive tech: "6h00 registered: 4h00 attributed, 2h00 unallocated". */
  summary: string;
};

/**
 * Builds a composition rail. `total` is the whole the parts belong to (registered
 * time, session time). Widths are % of max(total, sum of parts): when parts are
 * incomplete the rail is NOT stretched to 100% -- the caller must pass the
 * unknown remainder as an explicit `unknown` segment (see remainderAsUnknown).
 */
export function buildRail(
  parts: readonly RailSegmentInput[],
  total: number,
  totalLabel: string,
  totalDisplay: string,
): Rail {
  const safe = parts.map((part) => ({ ...part, value: Math.max(0, Number.isFinite(part.value) ? part.value : 0) }));
  const sum = safe.reduce((acc, part) => acc + part.value, 0);
  const denominator = Math.max(total, sum);
  const segments = safe.map((part) => ({
    ...part,
    pct: denominator > 0 ? (part.value / denominator) * 100 : 0,
  }));
  const shown = safe.filter((part) => part.value > 0).map((part) => `${part.display} ${part.label.toLowerCase()}`);
  return {
    total,
    segments,
    overAllocated: sum > total + 1e-9,
    summary: `${totalDisplay} ${totalLabel}${shown.length > 0 ? `: ${shown.join(", ")}` : ""}`,
  };
}

/** Bar length as a 0-100 percentage of `max` (unit-free; never exceeds 100, 0 when max is not positive). */
export function barPercent(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(100, (value / max) * 100);
}

/** Seconds of a session window with NO telemetry, given the reconciled coverage numbers. */
export function coverageParts(coverage: {
  sessionSeconds: number;
  telemetrySeconds: number;
  activeSeconds: number;
  idleSeconds: number;
  uncoveredSeconds: number;
}): { active: number; idle: number; unknown: number } {
  return {
    active: coverage.activeSeconds,
    idle: coverage.idleSeconds,
    unknown: coverage.uncoveredSeconds,
  };
}

/** Attribution parts of one registered-time total: explicit, historical derived, and what is still unallocated. */
export function attributionParts(summary: {
  registeredMinutes: number;
  explicitMinutes: number;
  historicalDerivedMinutes: number;
  unallocatedMinutes: number;
}): { explicit: number; derived: number; unallocated: number } {
  return {
    explicit: summary.explicitMinutes,
    derived: summary.historicalDerivedMinutes,
    unallocated: summary.unallocatedMinutes,
  };
}
