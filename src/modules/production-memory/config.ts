// Client Production Memory V1 (Wave 3, 2026-09-19): "what should I remember
// when producing this kind of work for this client?" -- a named, reusable,
// client-scoped format. NOT a job brief, not source media, not a delivery or
// review record, and not client-facing (operator-only in V1).
//
// STATUS answers one question only: how well-founded is this memory? It is
// deliberately not a workflow (no DRAFT/ACTIVE/ARCHIVED/READY/DELIVERED --
// those belong to other domains). NULL means "not recorded".
export const PRODUCTION_MEMORY_STATUSES = [
  "OBSERVED", // seen in past work; nobody decided it
  "OPERATOR_CONVENTION", // how the operator does it; not a client decision
  "CLIENT_APPROVED", // the client explicitly approved/asked to keep it
  "HISTORICAL", // no longer the current direction, kept for reference
] as const;

export type ProductionMemoryStatus = (typeof PRODUCTION_MEMORY_STATUSES)[number];

export const PRODUCTION_MEMORY_STATUS_LABELS: Record<ProductionMemoryStatus, string> = {
  OBSERVED: "Observed",
  OPERATOR_CONVENTION: "Operator convention",
  CLIENT_APPROVED: "Client approved",
  HISTORICAL: "Historical",
};
