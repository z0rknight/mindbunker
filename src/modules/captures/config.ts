// RMEDIA Engine — Operational Capture MVP (Wave 2).
//
// Vocabulary for the `captures` table. Every array here is the single
// source of truth for the TypeScript enum type on each column. Unlike
// most other enum columns in this schema (e.g. `videoKind`,
// `activityType`), these three are deliberately declared with Drizzle's
// `{enum: [...]}` option for compile-time safety only, with NO SQL
// CHECK constraint added in schema.ts -- the exact same pattern
// `crm_events.actor` already uses ("TypeScript-level constraint only,
// same as the other three values already were -- no SQL CHECK exists
// on this column", schema.ts). Wave 1.5 picked small, evidence-tested
// lists for context/eventType/outcome and explicitly rejected larger
// ones to avoid classification bureaucracy, but a *new* value later
// (once real usage proves one is missing) is a one-line change here,
// not a migration -- SQLite cannot ALTER a CHECK constraint in place,
// and Capture's whole reason for existing is to stay cheap to extend.

// LEVEL 1 attribution (Wave 1 §12). What kind of counterparty/domain
// this Capture is about -- the one field that is always required.
export const CAPTURE_CONTEXTS = ["CLIENT", "LEAD", "INTERNAL", "ADMIN"] as const;
export type CaptureContext = (typeof CAPTURE_CONTEXTS)[number];

export const CAPTURE_CONTEXT_LABELS: Record<CaptureContext, string> = {
  CLIENT: "Client",
  LEAD: "Lead",
  INTERNAL: "Internal",
  ADMIN: "Admin",
};

// "What happened" -- deliberately separate from `outcome` ("what was
// the result"). Wave 1.5 Decision E: mixing these two axes into one
// field was explicitly rejected.
export const CAPTURE_EVENT_TYPES = [
  "SAMPLE",
  "PROPOSAL",
  "MEETING",
  "INTERNAL_WORK",
  "ADMIN_TASK",
  "OTHER",
] as const;
export type CaptureEventType = (typeof CAPTURE_EVENT_TYPES)[number];

export const CAPTURE_EVENT_TYPE_LABELS: Record<CaptureEventType, string> = {
  SAMPLE: "Sample",
  PROPOSAL: "Proposal",
  MEETING: "Meeting",
  INTERNAL_WORK: "Internal work",
  ADMIN_TASK: "Admin task",
  OTHER: "Other",
};

// "What was the commercial/operational result." UNRESOLVED is the only
// non-terminal value and is what the Capture Inbox filters on. GHOSTED
// is never inferred from elapsed time (Wave 1.5 Decision E / mission
// §28 "no silent attribution") -- it is only ever set by an explicit
// operator action.
export const CAPTURE_OUTCOMES = [
  "UNRESOLVED",
  "CONVERTED",
  "GHOSTED",
  "REJECTED",
  "NOT_APPLICABLE",
] as const;
export type CaptureOutcome = (typeof CAPTURE_OUTCOMES)[number];

export const CAPTURE_OUTCOME_LABELS: Record<CaptureOutcome, string> = {
  UNRESOLVED: "Unresolved",
  CONVERTED: "Converted",
  GHOSTED: "Ghosted",
  REJECTED: "Rejected",
  NOT_APPLICABLE: "Not applicable",
};

export const CAPTURE_TERMINAL_OUTCOMES: readonly CaptureOutcome[] = [
  "CONVERTED",
  "GHOSTED",
  "REJECTED",
  "NOT_APPLICABLE",
];

// Wave 1.5 Decision D: aging threshold for the one War Room signal.
// Matches the codebase's existing STALE_QUOTE_DAYS/DORMANT_CLIENT_DAYS
// precedent (src/modules/crm/core.ts) rather than inventing a new
// constant shape.
export const CAPTURE_UNRESOLVED_SIGNAL_DAYS = 7;

export const CAPTURE_SOURCES = ["WEB_QUICK_CAPTURE", "MAC_SENSOR", "MANUAL"] as const;
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];
