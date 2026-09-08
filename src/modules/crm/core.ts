// Geladeira (Sprint 1.2 P0): pure domain logic for Client archival, kept
// separate from crm/actions.ts so it is testable without a live D1
// connection. See docs/architecture/GELADEIRA_DOMAIN_PROTOTYPE.md for the
// approved domain model this implements (Model B — an archival state
// orthogonal to `status`/`opportunityStage`/`converted`/`contacted`).

export const ACTIVE_SURFACE = "ACTIVE_SURFACE" as const;
export const GELADEIRA = "GELADEIRA" as const;

export type ArchivalState = typeof ACTIVE_SURFACE | typeof GELADEIRA;

/**
 * The single predicate for "does this Client belong on a default
 * operational surface." Centralized here so every query-layer filter
 * (CRM list, Projects overview, Productivity overview, active-client
 * analytics) references the same definition instead of re-deriving it.
 */
export function isActiveSurface(archivalState: ArchivalState): boolean {
  return archivalState !== GELADEIRA;
}

export function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

// The CRM stores one ordinary contact email, which is also the identity
// used by the existing client-portal login. Keep validation conservative
// and shared by the UI and server action.
export function isValidClientEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

export interface ArchivalTransitionPlan {
  changed: boolean;
  nextState: ArchivalState;
}

/**
 * Both archive and reactivate are no-ops when the Client is already in the
 * requested state — this is what makes repeated archive/reactivate
 * requests safe: no duplicate `crm_events` row, no `archivedAt` timestamp
 * drift, no error.
 */
export function planArchivalTransition(
  currentState: ArchivalState,
  targetState: ArchivalState,
): ArchivalTransitionPlan {
  return { changed: currentState !== targetState, nextState: targetState };
}

export interface ClientDependencyCounts {
  projects: number;
  bookings: number;
  gatewayInvitations: number;
  intakeSubmissions: number;
  videos: number;
  /**
   * CRM Events beyond the single `lead_created` / `client_created` row
   * every Client receives on creation. A brand-new, untouched Client has
   * exactly one CRM Event and zero everything else; anything more means
   * real history has accumulated.
   */
  nonCreationEvents: number;
}

export const EMPTY_CLIENT_DEPENDENCY_COUNTS: ClientDependencyCounts = {
  projects: 0,
  bookings: 0,
  gatewayInvitations: 0,
  intakeSubmissions: 0,
  videos: 0,
  nonCreationEvents: 0,
};

/**
 * Permanent-deletion guard (canonical map P0 / Geladeira prototype §6).
 * A Client is protected the moment it has accumulated any real history —
 * a Project, a Booking, a Gateway invitation, an Intake submission, a
 * Video, or any CRM Event beyond its own creation. Geladeira is the
 * correct action for a protected Client; `deleteClient()` is reserved for
 * genuinely empty rows (duplicates, mistakes, immediately-corrected
 * misspellings).
 */
export function clientHasProtectedHistory(
  counts: ClientDependencyCounts,
): boolean {
  return (
    counts.projects > 0 ||
    counts.bookings > 0 ||
    counts.gatewayInvitations > 0 ||
    counts.intakeSubmissions > 0 ||
    counts.videos > 0 ||
    counts.nonCreationEvents > 0
  );
}

/**
 * Human-readable summary of what would be lost, for the confirmation/error
 * message shown before a destructive action. Never invents a reason —
 * only lists dependencies that are actually present.
 */
export function describeProtectedHistory(
  counts: ClientDependencyCounts,
): string {
  const parts: string[] = [];
  if (counts.projects > 0) {
    parts.push(`${counts.projects} project${counts.projects === 1 ? "" : "s"}`);
  }
  if (counts.videos > 0) {
    parts.push(`${counts.videos} video${counts.videos === 1 ? "" : "s"}`);
  }
  if (counts.bookings > 0) {
    parts.push(`${counts.bookings} booking${counts.bookings === 1 ? "" : "s"}`);
  }
  if (counts.gatewayInvitations > 0) {
    parts.push(
      `${counts.gatewayInvitations} Gateway invitation${counts.gatewayInvitations === 1 ? "" : "s"}`,
    );
  }
  if (counts.intakeSubmissions > 0) {
    parts.push(
      `${counts.intakeSubmissions} intake submission${counts.intakeSubmissions === 1 ? "" : "s"}`,
    );
  }
  if (counts.nonCreationEvents > 0) {
    parts.push(
      `${counts.nonCreationEvents} CRM event${counts.nonCreationEvents === 1 ? "" : "s"}`,
    );
  }
  return parts.join(", ");
}
// Sprint 3 (CRM Lead Workspace — fast activity quick-log): a small fixed
// vocabulary, not a generalized workflow/event framework. Reuses the
// existing free-text crm_events.type column (no migration) the same way
// booking_created/stage_changed/briefing_submitted already do -- this
// just gives the operator a fast way to add to that same column instead
// of only ever reading it.
export const CRM_ACTIVITY_TYPES = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "message", label: "Message" },
  { value: "note", label: "Note" },
] as const;

export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number]["value"];

export function isCrmActivityType(value: unknown): value is CrmActivityType {
  return CRM_ACTIVITY_TYPES.some((option) => option.value === value);
}

export type LogCrmActivityValidation =
  | { success: true; data: { type: CrmActivityType; description: string } }
  | { success: false; error: string };

export function validateLogCrmActivityInput(values: {
  type?: unknown;
  description?: unknown;
}): LogCrmActivityValidation {
  const description =
    typeof values.description === "string"
      ? values.description.trim().slice(0, 2_000)
      : "";
  if (!description) {
    return { success: false, error: "Enter a note before logging this activity." };
  }
  const type = isCrmActivityType(values.type) ? values.type : "note";
  return { success: true, data: { type, description } };
}

// Tuesday Patch Priority 3: "CRM = relacionamentos" -- the list must read
// as relationship/commercial-advance state, not a passive contact book.
// These pure functions all work off facts the schema already owns
// (status, archivalState, opportunityStage, nextAction/nextActionDate,
// lastInteractionAt, quotes.status/sentAt) -- no new tracking table.

export type ClientRelationshipStatus = "lead" | "active" | "inactive";

export const RELATIONSHIP_STATUS_LABELS: Record<ClientRelationshipStatus, string> = {
  lead: "Lead",
  active: "Active client",
  inactive: "Inactive",
};

export type WorkbenchClient = {
  id: number;
  name: string;
  status: ClientRelationshipStatus;
  archivalState: ArchivalState;
  opportunityStage: string;
  nextAction: string | null;
  nextActionDate: string | null;
  lastInteractionAt: string | null;
  createdAt: string | null;
};

export type WorkbenchQuote = {
  id: number;
  clientId: number;
  status: "DRAFT" | "SENT" | "APPROVED" | "DECLINED";
  sentAt: string | null;
  amountCents: number;
  currency: string;
};

export type CRMAttentionKind =
  | "FOLLOW_UP_OVERDUE"
  | "QUOTE_AWAITING_RESPONSE"
  | "DORMANT";

export type CRMAttentionItem = {
  kind: CRMAttentionKind;
  clientId: number;
  clientName: string;
  detail: string;
};

// Both thresholds match the brief's own worked examples verbatim ("1
// quote without response for 5 days", "Shelley -- no activity for 18
// days" as an instance of a stale-relationship bucket).
export const STALE_QUOTE_DAYS = 5;
export const DORMANT_CLIENT_DAYS = 14;

function daysBetween(fromISO: string, toISO: string): number {
  return Math.max(
    0,
    Math.floor((Date.parse(toISO) - Date.parse(fromISO)) / (24 * 60 * 60 * 1000)),
  );
}

/**
 * "Needs Attention" (brief §Priority 3.5): overdue follow-ups, quotes gone
 * quiet, and relationships that have gone dark -- the only things this
 * surface should spend strong color on. Everything else renders as a
 * quiet table underneath.
 */
export function getCRMNeedsAttention(
  clients: readonly WorkbenchClient[],
  quotes: readonly WorkbenchQuote[],
  todayISO: string,
): CRMAttentionItem[] {
  const activeClients = clients.filter((c) => isActiveSurface(c.archivalState));
  const activeById = new Map(activeClients.map((c) => [c.id, c]));
  const items: CRMAttentionItem[] = [];

  for (const client of activeClients) {
    if (!client.nextActionDate || client.nextActionDate >= todayISO) continue;
    const days = daysBetween(client.nextActionDate, todayISO);
    items.push({
      kind: "FOLLOW_UP_OVERDUE",
      clientId: client.id,
      clientName: client.name,
      detail: `Follow-up overdue by ${days} day${days === 1 ? "" : "s"}`,
    });
  }

  for (const quote of quotes) {
    if (quote.status !== "SENT" || !quote.sentAt) continue;
    const client = activeById.get(quote.clientId);
    if (!client) continue;
    const days = daysBetween(quote.sentAt, todayISO);
    if (days < STALE_QUOTE_DAYS) continue;
    items.push({
      kind: "QUOTE_AWAITING_RESPONSE",
      clientId: quote.clientId,
      clientName: client.name,
      detail: `Quote without response for ${days} days`,
    });
  }

  for (const client of activeClients) {
    if (client.status !== "active") continue;
    const lastSignal = client.lastInteractionAt ?? client.createdAt;
    if (!lastSignal) continue;
    const days = daysBetween(lastSignal, todayISO);
    if (days < DORMANT_CLIENT_DAYS) continue;
    items.push({
      kind: "DORMANT",
      clientId: client.id,
      clientName: client.name,
      detail: `No activity for ${days} days`,
    });
  }

  return items;
}

export type CRMActionableKPIs = {
  followUpsDue: number;
  leadsAwaitingReply: number;
  openQuotes: number;
  pipelineValueByCurrency: Array<{ currency: string; amount: number }>;
  clientsAtRisk: number;
};

/**
 * Replaces the old generic KPI row (brief §Priority 3.4): "Total
 * Contacts: 4" barely changes behavior. These five all answer "what
 * needs me to act."
 */
export function computeCRMActionableKPIs(
  clients: readonly WorkbenchClient[],
  quotes: readonly WorkbenchQuote[],
  todayISO: string,
): CRMActionableKPIs {
  const activeClients = clients.filter((c) => isActiveSurface(c.archivalState));
  const activeIds = new Set(activeClients.map((c) => c.id));

  const followUpsDue = activeClients.filter(
    (c) => c.nextActionDate !== null && c.nextActionDate <= todayISO,
  ).length;

  // A lead whose opportunityStage has moved past "new" but hasn't
  // reached a terminal state has been engaged by us and the ball is in
  // their court -- that's the "awaiting reply" moment, distinct from a
  // fresh, never-contacted lead.
  const leadsAwaitingReply = activeClients.filter(
    (c) => c.status === "lead" && c.opportunityStage !== "new" && c.opportunityStage !== "lost",
  ).length;

  const openQuotes = quotes.filter(
    (q) => q.status === "SENT" && activeIds.has(q.clientId),
  ).length;

  const pipelineTotals = new Map<string, number>();
  for (const quote of quotes) {
    if (quote.status !== "DRAFT" && quote.status !== "SENT") continue;
    if (!activeIds.has(quote.clientId)) continue;
    pipelineTotals.set(
      quote.currency,
      (pipelineTotals.get(quote.currency) ?? 0) + quote.amountCents,
    );
  }
  const pipelineValueByCurrency = Array.from(pipelineTotals.entries()).map(
    ([currency, amountCents]) => ({ currency, amount: amountCents / 100 }),
  );

  const clientsAtRisk = getCRMNeedsAttention(clients, quotes, todayISO).filter(
    (item) => item.kind === "DORMANT",
  ).length;

  return { followUpsDue, leadsAwaitingReply, openQuotes, pipelineValueByCurrency, clientsAtRisk };
}
