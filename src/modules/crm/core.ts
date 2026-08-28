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
