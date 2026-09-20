// External registered time -> work attribution (Commercial Evidence train,
// Sep 19). Pure rules: no DB, no framework.
//
// What this models, and what it refuses to model:
//  - A billing_evidence row (in practice an Upwork weekly report) is EXTERNAL
//    REGISTERED TIME: minutes the external platform recorded. It is not an
//    invoice, not a payment, not revenue.
//  - The operator may ATTRIBUTE some of those minutes to a real work target:
//    a Production Order (via its operational container video -- the same
//    convention the order's "billed" figure already uses) or a single video.
//    Only when the operator actually knows. The least precise TRUE level is
//    preferred: "this week's 4h were for that batch" is stored as an order
//    attribution, never spread across its videos.
//  - Whatever is not attributed is UNALLOCATED, which is a first-class valid
//    state. Nothing here ever divides time by video count, Sensor time, Work
//    Session duration or deliveries -- there is deliberately no such function.
//  - Historical DERIVED_PROPORTION rows remain readable evidence, reported
//    separately from explicit attribution; they are not a method to reuse.
//  - An attribution never touches payment, status, sessions or any
//    transaction: it only records which work an amount of registered time
//    belongs to.

export type AllocationMethod = "MANUAL_AMOUNT" | "MANUAL_MINUTES" | "DERIVED_PROPORTION";

export type AllocationRow = { id: number; method: AllocationMethod; minutes: number | null };

export type AttributionSummary = {
  registeredMinutes: number;
  /** Minutes the operator explicitly attributed (MANUAL_* with minutes). */
  explicitMinutes: number;
  /** Minutes from historical DERIVED_PROPORTION rows (evidence-specific, kept as history). */
  historicalDerivedMinutes: number;
  /** Registered minutes with no attribution at all. Valid; never a problem to fix. */
  unallocatedMinutes: number;
  /** Allocation rows that carry an amount but no minutes, so they cannot reduce the unallocated figure. */
  amountOnlyRows: number;
};

export function summarizeEvidenceAttribution(
  registeredMinutes: number,
  allocations: readonly AllocationRow[],
): AttributionSummary {
  const registered = Math.max(0, Math.round(registeredMinutes));
  let explicit = 0;
  let derived = 0;
  let amountOnly = 0;
  for (const row of allocations) {
    if (row.minutes === null || row.minutes === undefined) {
      amountOnly += 1;
      continue;
    }
    if (row.method === "DERIVED_PROPORTION") derived += Math.max(0, row.minutes);
    else explicit += Math.max(0, row.minutes);
  }
  return {
    registeredMinutes: registered,
    explicitMinutes: explicit,
    historicalDerivedMinutes: derived,
    unallocatedMinutes: Math.max(0, registered - explicit - derived),
    amountOnlyRows: amountOnly,
  };
}

/** Whole minutes from an hours + minutes pair of inputs; null when not a valid positive duration. */
export function toMinutes(hours: unknown, minutes: unknown): number | null {
  const parse = (value: unknown): number | null => {
    if (value === undefined || value === null || value === "") return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };
  const h = parse(hours);
  const m = parse(minutes);
  if (h === null || m === null) return null;
  const total = h * 60 + m;
  return total > 0 ? total : null;
}

export function validateAttributionMinutes(minutes: number | null, remainingMinutes: number): string | null {
  if (minutes === null) return "Enter a duration greater than zero (whole minutes).";
  if (minutes > remainingMinutes) {
    return remainingMinutes <= 0
      ? "All of this evidence's registered time is already attributed."
      : "That is more than the time still unallocated for this evidence.";
  }
  return null;
}

export type AttributionTargetType = "PRODUCTION_ORDER" | "VIDEO";

export type ResolvedTarget = {
  /** The video_logs row the allocation will point at (an order's container, or the video itself). */
  videoId: number;
  clientId: number | null;
  isOperationalContainer: boolean;
  /** For PRODUCTION_ORDER targets: the order's own client (must also match). */
  orderClientId?: number | null;
};

/**
 * Ownership rules: the target must belong to the SAME client as the evidence's
 * contract; a VIDEO target must be a real deliverable (not an order's
 * container); a PRODUCTION_ORDER target must resolve to its container.
 */
export function checkAttributionTarget(
  evidenceClientId: number,
  type: AttributionTargetType,
  target: ResolvedTarget | null,
): string | null {
  if (!target) return type === "PRODUCTION_ORDER" ? "That Production Order was not found." : "That video was not found.";
  if (type === "PRODUCTION_ORDER") {
    if (!target.isOperationalContainer) return "That Production Order has no operational container to attribute to.";
    if (target.orderClientId !== undefined && target.orderClientId !== evidenceClientId) {
      return "That Production Order belongs to a different client.";
    }
  } else if (target.isOperationalContainer) {
    return "Attribute to the Production Order instead of its container.";
  }
  if (target.clientId !== evidenceClientId) return "That work belongs to a different client than this evidence.";
  return null;
}

/**
 * The billing amount attached to an attribution: the EXACT linear share of
 * THIS evidence's own gross for the minutes attributed (for an hourly report
 * this equals minutes x rate). It is a share of billing evidence -- not
 * revenue and not a payment -- and it is never derived across other videos.
 */
export function attributedAmount(grossAmount: number, billableMinutes: number, minutes: number): number {
  if (!(billableMinutes > 0) || !(minutes > 0)) return 0;
  return Math.round(((grossAmount * minutes) / billableMinutes) * 100) / 100;
}

export type EvidenceAllocationForOrder = {
  evidenceId: number;
  periodStart: string;
  periodEnd: string;
  registeredMinutes: number;
  /** Explicit minutes attributed to THIS order (its container and/or its deliverables). */
  explicitHereMinutes: number;
  /** Historical derived minutes that landed on this order's videos. */
  derivedHereMinutes: number;
  /** All explicit + derived minutes on this evidence attributed elsewhere. */
  elsewhereMinutes: number;
  unallocatedMinutes: number;
};

/**
 * One evidence row's picture from the point of view of one batch. Everything
 * is registered / attributed here / attributed elsewhere / unallocated; the
 * four always reconcile to the registered figure (unallocated absorbs
 * nothing invented).
 */
export function describeEvidenceForOrder(input: {
  evidenceId: number;
  periodStart: string;
  periodEnd: string;
  registeredMinutes: number;
  allocations: ReadonlyArray<AllocationRow & { onThisOrder: boolean }>;
}): EvidenceAllocationForOrder {
  const overall = summarizeEvidenceAttribution(input.registeredMinutes, input.allocations);
  const here = summarizeEvidenceAttribution(
    input.registeredMinutes,
    input.allocations.filter((row) => row.onThisOrder),
  );
  const allocatedMinutes = overall.explicitMinutes + overall.historicalDerivedMinutes;
  const hereMinutes = here.explicitMinutes + here.historicalDerivedMinutes;
  return {
    evidenceId: input.evidenceId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    registeredMinutes: overall.registeredMinutes,
    explicitHereMinutes: here.explicitMinutes,
    derivedHereMinutes: here.historicalDerivedMinutes,
    elsewhereMinutes: Math.max(0, allocatedMinutes - hereMinutes),
    unallocatedMinutes: overall.unallocatedMinutes,
  };
}
