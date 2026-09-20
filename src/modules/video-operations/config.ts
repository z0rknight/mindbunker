export const COMMITMENT_STATUSES = ["OPEN", "DONE", "CANCELLED"] as const;
export type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];

export const FRICTION_CATEGORIES = [
  "FILES",
  "SOFTWARE",
  "CLIENT",
  "DECISION",
  "QA",
  "HARDWARE",
  "PROCESS",
  "INGEST",
  "OTHER",
] as const;
export type FrictionCategory = (typeof FRICTION_CATEGORIES)[number];

export const BLOCKER_CATEGORIES = [
  "CLIENT",
  "FILES",
  "HARDWARE",
  "SOFTWARE",
  "DECISION",
  "PAYMENT",
  "INGEST",
  "OTHER",
] as const;
export type BlockerCategory = (typeof BLOCKER_CATEGORIES)[number];

export const PRODUCTION_STEPS = [
  "ASSEMBLY",
  "COLOR",
  "AUDIO",
  "MOTION",
  "CAPTIONS",
  "QA",
  "EXPORT",
  "DELIVERY",
] as const;
export type ProductionStep = (typeof PRODUCTION_STEPS)[number];

export const CHECKLIST_STATUSES = ["NOT_STARTED", "DONE", "NOT_REQUIRED"] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export const REVISION_CAUSES = [
  "UNKNOWN",
  "OUR_ERROR",
  "CLIENT_CHANGE",
  "SCOPE_CHANGE",
] as const;
export type RevisionCause = (typeof REVISION_CAUSES)[number];

// Optional provenance shown where a revision is recorded. UNKNOWN is the
// default and means "not classified" -- never a required choice. (OUR_ERROR
// feeds the existing REVISION_DRAG signal in modules/signals.)
export const REVISION_CAUSE_LABELS: Record<RevisionCause, string> = {
  UNKNOWN: "Not sure",
  CLIENT_CHANGE: "Client changed something",
  SCOPE_CHANGE: "Scope changed",
  OUR_ERROR: "Our error",
};

export const REVISION_CATEGORIES = [
  "CONTENT",
  "PACING",
  "VISUAL",
  "AUDIO",
  "BRAND",
  "TECHNICAL",
  "OTHER",
] as const;
export type RevisionCategory = (typeof REVISION_CATEGORIES)[number];

export const DELIVERY_STATUSES = ["DELIVERED", "REDELIVERED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
