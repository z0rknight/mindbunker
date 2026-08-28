// Client Service Reality Patch (25 Aug 2026) -- Quote Approval.
//
// A quote is Emmanuel's commercial offer to a client, produced by hand
// from the Pricing Lab calculation (see modules/pricing) and logged here
// so it can be tracked, approved, and linked to the production work it
// authorizes. This is NOT a second pricing engine -- the amount/turnaround
// /revisions/scope on a quote are always numbers Emmanuel already
// calculated elsewhere and is choosing to record, never recomputed here.
//
// V1 approval is manual (Emmanuel marks it Approved) -- no e-signature,
// no client-facing approve button, matching the brief's explicit "Do not
// build proposal-signature infrastructure."

export const QUOTE_STATUSES = ["DRAFT", "SENT", "APPROVED", "DECLINED"] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  APPROVED: "Approved",
  DECLINED: "Declined",
};

// A quote can only move forward (never backward, never skip), except
// DECLINED is reachable from DRAFT or SENT (a client can say no before or
// after formally receiving it), and APPROVED is only reachable from SENT
// (Emmanuel should have actually sent it before marking it accepted).
export const QUOTE_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT", "DECLINED"],
  SENT: ["APPROVED", "DECLINED"],
  APPROVED: [],
  DECLINED: [],
};

export const DEFAULT_QUOTE_CURRENCY = "USD";
