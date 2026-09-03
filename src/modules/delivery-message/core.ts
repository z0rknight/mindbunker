// Post-Job Commercial + Delivery Sniper §11: DELIVER VIDEO / GENERATE
// DELIVERY MESSAGE. Pure formatting only -- no DB, no framework imports,
// same discipline as quotes/core.ts and pricing/core.ts. Every field on
// DeliveryMessagePayload is either a client-safe fact already resolved
// elsewhere (getCommercialTermsForVideo, toCard's client-safe URL
// validation) or explicitly nullable when that fact isn't deterministic
// -- this module never invents a turnaround, a price, or a work item.
// The payload shape is deliberately provider-independent (plain strings/
// numbers, no HTML) so a future Slack or email integration can reuse it
// without a rewrite -- see the brief's explicit "do not integrate
// Slack/email this wave, but architect for it" instruction.

export type DeliveryMessageDeliverable = {
  label: string;
  url: string;
};

export type DeliveryMessagePayload = {
  clientName: string;
  videoTitle: string;
  contentTypeLabel: string | null;
  // Days between the video's own startedAt and "now" (message generation
  // time) -- null when startedAt was never recorded, never a guess.
  turnaroundDays: number | null;
  // Distinct work-session activity types actually tracked against this
  // video (see WORK_SESSION_ACTIVITY_LABELS) -- real evidence, not a
  // free-text description of work that may not have happened.
  workDone: string[];
  deliverables: DeliveryMessageDeliverable[];
  // Exactly one of these is non-null, matching CommercialTerms'
  // billingModel -- never both, never invented when billingModel is NONE.
  estimatedAccrued: { amount: number; currency: string } | null;
  agreedAmount: { amountCents: number; currency: string } | null;
  revisionsCount: number;
};

function formatCurrencyAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDeliveryMessage(payload: DeliveryMessagePayload): string {
  const lines: string[] = [];

  lines.push(`Hi ${payload.clientName.trim() || "there"},`);
  lines.push("");
  lines.push(`Your video "${payload.videoTitle}" is ready.`);
  lines.push("");

  if (payload.contentTypeLabel) {
    lines.push(`Content type: ${payload.contentTypeLabel}`);
  }
  if (payload.turnaroundDays !== null) {
    lines.push(`Turnaround: ${payload.turnaroundDays} day${payload.turnaroundDays === 1 ? "" : "s"}`);
  }
  if (payload.contentTypeLabel || payload.turnaroundDays !== null) {
    lines.push("");
  }

  if (payload.workDone.length > 0) {
    lines.push("What I've done:");
    for (const item of payload.workDone) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (payload.deliverables.length > 0) {
    lines.push("Deliverables:");
    for (const deliverable of payload.deliverables) {
      lines.push(`- ${deliverable.label}: ${deliverable.url}`);
    }
    lines.push("");
  }

  if (payload.agreedAmount) {
    lines.push(`Agreed price: ${formatCurrencyAmount(payload.agreedAmount.amountCents / 100, payload.agreedAmount.currency)}`);
    lines.push("");
  } else if (payload.estimatedAccrued) {
    lines.push(
      `Estimated accrued: ${formatCurrencyAmount(payload.estimatedAccrued.amount, payload.estimatedAccrued.currency)}`,
    );
    lines.push("");
  }

  lines.push(
    `Let me know if you'd like any revisions${payload.revisionsCount > 0 ? ` (${payload.revisionsCount} revision${payload.revisionsCount === 1 ? "" : "s"} so far)` : ""} -- happy to adjust.`,
  );

  return lines.join("\n");
}
