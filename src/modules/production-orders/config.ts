// RMEDIA LET'S COOK — Wave 1: Production Order constants.
//
// See src/db/schema.ts (productionOrders table comment) for why `state`
// (OPEN/CLOSED/CANCELLED, persisted) and `phase` (RECEIVED/IN_PRODUCTION/
// REVIEW/DELIVERED, derived here) are two different, deliberately
// separate concepts. Phase is never stored -- it is recomputed on every
// read from each active item's existing VIDEO_STATUSES value (see
// deriveProductionOrderPhase in ./core.ts), so it can never drift.

export const PRODUCTION_ORDER_PHASES = [
  "RECEIVED",
  "IN_PRODUCTION",
  "REVIEW",
  "DELIVERED",
] as const;
export type ProductionOrderPhase = (typeof PRODUCTION_ORDER_PHASES)[number];

export const PRODUCTION_ORDER_PHASE_LABELS: Record<ProductionOrderPhase, string> = {
  RECEIVED: "Received",
  IN_PRODUCTION: "In production",
  REVIEW: "In review",
  // Key stays DELIVERED (every consumer switches on it), but the *label*
  // must not claim more than the derivation knows: every active child
  // being DONE is production-complete, not proof anything was delivered --
  // delivery is separate evidence on each video (DONE != delivered).
  DELIVERED: "All done",
};

// Matches production_orders.state in src/db/schema.ts exactly.
export const PRODUCTION_ORDER_STATE_LABELS: Record<string, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const PRODUCTION_ORDER_LABEL_MAX_LENGTH = 160;
export const PRODUCTION_ORDER_ITEM_TITLE_MAX_LENGTH = 200;
export const PRODUCTION_ORDER_NOTES_MAX_LENGTH = 4000;

// A ceiling only -- the same "don't let one bad paste wedge the form"
// discipline createVideoLogsBulk already applies (see
// modules/productivity/actions.ts), not a real-world batch-size opinion.
export const PRODUCTION_ORDER_MAX_ITEMS_PER_INGEST = 50;

// How long a production order can sit OPEN with no active item having
// moved past PLANNED before the War Room "stale order" signal fires. A
// week mirrors the existing Unresolved Captures aging threshold
// (modules/signals/core.ts) -- this repo's established "worth a nudge,
// not an emergency" window.
export const STALE_PRODUCTION_ORDER_DAYS = 7;

// Badge classes for describeProductionOrderStatus tones (core.ts), shared by
// the LET'S COOK list and detail pages so the two cannot drift.
export const PRODUCTION_ORDER_TONE_CLASSES: Record<string, string> = {
  neutral: "border-zinc-700 bg-zinc-900 text-zinc-400",
  active: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  review: "border-cyan-800/60 bg-cyan-950/30 text-cyan-300",
  complete: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
  closed: "border-zinc-700 bg-zinc-900 text-zinc-300",
  cancelled: "border-red-900/60 bg-red-950/30 text-red-400",
};
