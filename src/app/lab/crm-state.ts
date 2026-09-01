// Wave 3G: experimental CRM state machine, /lab only -- does not touch
// canonical CRM. Maps existing canonical fields (status, opportunityStage,
// archivalState, lastInteractionAt) to a richer lifecycle read-model.
// UNKNOWN whenever the mapping is genuinely ambiguous, never guessed.
//
// Promotion Prep Patch P1 (CRM boundary repair): a Geladeira client used
// to map straight to "DORMANT" -- asserting the *reason* for archival is
// inactivity. The Health Sweep proved this is not true: archivalState is
// explicitly documented (docs/architecture/GELADEIRA_DOMAIN_PROTOTYPE.md)
// as reason-agnostic -- "orthogonal to status/opportunityStage/converted/
// contacted," purely about default surface visibility, not a claim about
// *why* a client was archived. A client can be archived for reasons that
// have nothing to do with going dormant (e.g. a one-off project that
// completed cleanly). "ARCHIVED" asserts only the fact this app already
// knows for certain (archivalState === GELADEIRA); it does not invent an
// inactivity story the data doesn't support. No archivedReason field is
// added this round -- when one exists, ARCHIVED can be split truthfully.
export const CRM_STATES = ["LEAD", "QUALIFIED", "OPPORTUNITY", "WON", "ACTIVE", "AT_RISK", "ARCHIVED", "LOST", "UNKNOWN"] as const;
export type CrmState = (typeof CRM_STATES)[number];

const AT_RISK_DAYS = 30;

export function mapToCrmState(client: {
  status: string;
  opportunityStage: string;
  archivalState: string;
  lastInteractionAt: Date | null;
}, hasOpenWork: boolean, now: Date = new Date()): CrmState {
  if (client.opportunityStage === "lost") return "LOST";
  // Reason-neutral: a Geladeira client is ARCHIVED, full stop -- not
  // presumed DORMANT (inactive) without an archivedReason to prove it.
  if (client.status === "active" && client.archivalState === "GELADEIRA") return "ARCHIVED";

  if (client.status === "lead") {
    if (client.opportunityStage === "new") return "LEAD";
    if (client.opportunityStage === "qualified") return "QUALIFIED";
    if (["invited", "booked", "offer_sent", "payment_pending"].includes(client.opportunityStage)) return "OPPORTUNITY";
    if (["paid", "onboarding"].includes(client.opportunityStage)) return "WON";
    return "UNKNOWN";
  }

  if (client.status === "active") {
    const daysSince = client.lastInteractionAt ? (now.getTime() - client.lastInteractionAt.getTime()) / 86400000 : null;
    if (!hasOpenWork && (daysSince === null || daysSince > AT_RISK_DAYS)) return "AT_RISK";
    return "ACTIVE";
  }

  return "UNKNOWN";
}

export function isFollowUpDue(state: CrmState, lastInteractionAt: Date | null, now: Date = new Date(), thresholdDays = 7): boolean {
  // ACTIVE: no interaction is NOT automatically a problem (per brief).
  if (state !== "OPPORTUNITY" && state !== "LEAD" && state !== "QUALIFIED") return false;
  if (!lastInteractionAt) return true;
  return (now.getTime() - lastInteractionAt.getTime()) / 86400000 > thresholdDays;
}
