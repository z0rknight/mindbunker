// RMEDIA LET'S COOK — Wave 1: pure domain logic for Production Orders.
//
// Every function here is a pure computation over plain data -- no DB
// access (see ./data.ts for queries and ./actions.ts for writes),
// mirroring the modules/finance/core.ts and modules/signals/core.ts
// convention already established in this repo. This is what the
// required test fixtures (Taryn / Dave / Mixed Tracking) exercise
// directly, with no DB or server needed.

import type { VideoStatus } from "@/modules/productivity/config";
import {
  PRODUCTION_ORDER_PHASE_LABELS,
  PRODUCTION_ORDER_ITEM_TITLE_MAX_LENGTH,
  PRODUCTION_ORDER_LABEL_MAX_LENGTH,
  PRODUCTION_ORDER_MAX_ITEMS_PER_INGEST,
  PRODUCTION_ORDER_NOTES_MAX_LENGTH,
  PRODUCTION_ORDER_PHASES,
  STALE_PRODUCTION_ORDER_DAYS,
  type ProductionOrderPhase,
} from "./config.ts";

// ─── Active-item filtering ──────────────────────────────────────────────────
//
// Locked decision (brief §1B): a cancelled order item is never deleted
// and stays visible in its order, but is excluded from every "active"
// computation -- phase derivation, active counts, and the equivalent-
// per-active-item denominator. This is the one place that exclusion
// rule lives; every caller below filters through this first.

export type ProductionOrderItem = {
  videoId: number;
  status: VideoStatus;
  cancelledAt: Date | null;
  isOperationalContainer: boolean;
};

export function isActiveProductionOrderItem(item: {
  cancelledAt: Date | null;
}): boolean {
  return item.cancelledAt === null;
}

// The operational container row is never itself a "deliverable" -- it
// represents the batch/pre-flight work context, not a video the client
// receives. Every deliverable-count / phase computation below excludes
// it explicitly, the same way isOperationalContainer already excludes
// it from Client Portal video listings and completion counts.
export function activeDeliverableItems(
  items: readonly ProductionOrderItem[],
): ProductionOrderItem[] {
  return items.filter(
    (item) => isActiveProductionOrderItem(item) && !item.isOperationalContainer,
  );
}

// ─── Phase derivation (brief §4/§5, locked decision) ────────────────────────
//
// `production_orders.state` (OPEN/CLOSED/CANCELLED) is the only
// persisted lifecycle column -- operator-set, coarse, and rare to
// change. `phase` below is a richer read-model recomputed on every read
// from each active deliverable's own, already-canonical VIDEO_STATUSES
// value (modules/productivity/config.ts) -- it can never drift out of
// sync with the one real source of truth the way a second, independently
// -settable status column could.
//
//   RECEIVED       no active deliverables yet, or every active
//                  deliverable is still PLANNED -- nothing started.
//   IN_PRODUCTION  at least one active deliverable is being worked
//                  (IN_PROGRESS or CHANGES_REQUESTED), or the batch is a
//                  mix of PLANNED and started items.
//   REVIEW         every active deliverable has reached
//                  READY_FOR_REVIEW or DONE, and at least one is still
//                  waiting in READY_FOR_REVIEW.
//   DELIVERED      every active deliverable is DONE.
export function deriveProductionOrderPhase(
  items: readonly ProductionOrderItem[],
): ProductionOrderPhase {
  const active = activeDeliverableItems(items);

  if (active.length === 0) return "RECEIVED";
  if (active.every((item) => item.status === "DONE")) return "DELIVERED";
  if (
    active.some((item) => item.status === "READY_FOR_REVIEW") &&
    active.every(
      (item) => item.status === "READY_FOR_REVIEW" || item.status === "DONE",
    )
  ) {
    return "REVIEW";
  }
  if (active.every((item) => item.status === "PLANNED")) return "RECEIVED";
  return "IN_PRODUCTION";
}

// ─── Headline status (Sep 19 Final-State Truth) ─────────────────────────────
//
// Model: HYBRID by design. `state` (OPEN/CLOSED/CANCELLED) is the operator's
// one real container-level fact -- "this order's scope is finalized" -- and
// `phase` is derived from active children. They answer different questions,
// so neither may be merged into the other. The bug this fixes was purely
// presentational: both surfaces printed the derived phase next to the
// state, so a CLOSED order with one unfinished child read "IN PRODUCTION ·
// CLOSED" -- production "in progress" on scope the operator had already
// finalized. The headline now follows the state first; the derived phase
// is only the headline while the order is still OPEN. A closed order never
// claims production is complete unless every active child actually is
// (closed != children done), and never hides an unfinished child either.
export type ProductionOrderHeadlineTone =
  | "neutral"
  | "active"
  | "review"
  | "complete"
  | "closed"
  | "cancelled";

export function describeProductionOrderStatus(input: {
  state: "OPEN" | "CLOSED" | "CANCELLED";
  phase: ProductionOrderPhase;
  activeCount: number;
  doneCount: number;
}): { headline: string; tone: ProductionOrderHeadlineTone; detail: string | null } {
  const { state, phase, activeCount, doneCount } = input;
  const remaining = Math.max(0, activeCount - doneCount);
  const tally =
    activeCount === 0
      ? null
      : remaining === 0
        ? `All ${activeCount} deliverable${activeCount === 1 ? "" : "s"} done`
        : `${doneCount} of ${activeCount} deliverables done · ${remaining} not finished`;

  if (state === "CANCELLED") return { headline: "Cancelled", tone: "cancelled", detail: tally };
  if (state === "CLOSED") {
    return { headline: "Closed", tone: remaining === 0 && activeCount > 0 ? "complete" : "closed", detail: tally };
  }
  const tone: ProductionOrderHeadlineTone =
    phase === "DELIVERED" ? "complete" : phase === "REVIEW" ? "review" : phase === "IN_PRODUCTION" ? "active" : "neutral";
  return { headline: PRODUCTION_ORDER_PHASE_LABELS[phase], tone, detail: tally };
}

export function isProductionOrderPhase(
  value: unknown,
): value is ProductionOrderPhase {
  return (
    typeof value === "string" &&
    (PRODUCTION_ORDER_PHASES as readonly string[]).includes(value)
  );
}

// ─── Active item counts ─────────────────────────────────────────────────────

export function countActiveDeliverables(
  items: readonly ProductionOrderItem[],
): number {
  return activeDeliverableItems(items).length;
}

export function countCancelledDeliverables(
  items: readonly ProductionOrderItem[],
): number {
  return items.filter(
    (item) => !isActiveProductionOrderItem(item) && !item.isOperationalContainer,
  ).length;
}

export function countDoneDeliverables(
  items: readonly ProductionOrderItem[],
): number {
  return activeDeliverableItems(items).filter((item) => item.status === "DONE")
    .length;
}

// ─── Mixed-tracking time breakdown (brief §3, corrected/locked) ────────────
//
// Corrected semantics (this supersedes the exercise document's original
// mixed-tracking section): batch-equivalent time (Work Sessions logged
// directly against the operational container) and precise item time
// (Work Sessions logged against a specific deliverable video_id) are
// NEVER combined into one number. They are always surfaced separately.
// This function does not attempt to detect or merge overlapping
// intervals ACROSS different video_ids either -- the brief is explicit
// that two different video_ids can legitimately have temporally
// overlapping Work Sessions (e.g. the operator ran Sensor against the
// container for pre-flight review while a second concurrent session was
// already open against one specific deliverable) and that is real,
// simultaneous, non-erroneous operator time, not a bug to collapse away.
//
// Per-video_id summation below is a plain sum of closed-session
// durations, deliberately matching the existing convention on this
// branch (see VIDEO_WORK_SESSION_SUMMARY_SQL in
// modules/work-sessions/core.ts) rather than inventing a new,
// inconsistent calculation. This branch does not carry an overlap-merge
// fix for sessions on the SAME video_id (unlike a fix present on a
// different, unreconciled branch of this repo -- see this mission's
// required report §0/§ discovery notes) -- that is a pre-existing,
// disclosed gap this Wave does not introduce and does not silently fix,
// since fixing it is outside this mission's scope.

export type WorkSessionInterval = {
  videoId: number;
  startedAt: Date;
  endedAt: Date | null;
};

function sumClosedSeconds(sessions: readonly WorkSessionInterval[]): number {
  let total = 0;
  for (const session of sessions) {
    if (session.endedAt === null) continue;
    const seconds = (session.endedAt.getTime() - session.startedAt.getTime()) / 1000;
    if (seconds > 0) total += seconds;
  }
  return total;
}

export type ProductionOrderTimeBreakdown = {
  // "Batch-equivalent" time: worked against the container row itself,
  // not attributable to any one deliverable.
  containerSeconds: number;
  // Precise, per-deliverable time -- one entry per deliverable video_id
  // that has at least one closed Work Session.
  items: Array<{ videoId: number; seconds: number }>;
  // Sum of `items[].seconds` ONLY. Deliberately named distinctly from
  // (and never added to) containerSeconds -- see the module comment
  // above. Rendered as a clearly separate figure in the UI, never
  // combined into a single "total order time."
  itemSecondsTotal: number;
};

export function computeProductionOrderTimeBreakdown(input: {
  containerVideoId: number | null;
  sessions: readonly WorkSessionInterval[];
}): ProductionOrderTimeBreakdown {
  const containerSessions = input.containerVideoId
    ? input.sessions.filter((s) => s.videoId === input.containerVideoId)
    : [];
  const containerSeconds = sumClosedSeconds(containerSessions);

  const byVideo = new Map<number, WorkSessionInterval[]>();
  for (const session of input.sessions) {
    if (session.videoId === input.containerVideoId) continue;
    const list = byVideo.get(session.videoId) ?? [];
    list.push(session);
    byVideo.set(session.videoId, list);
  }

  const items = Array.from(byVideo.entries())
    .map(([videoId, sessions]) => ({ videoId, seconds: sumClosedSeconds(sessions) }))
    .filter((row) => row.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);

  const itemSecondsTotal = items.reduce((sum, row) => sum + row.seconds, 0);

  return { containerSeconds, items, itemSecondsTotal };
}

// ─── Commercial: billed value derived from container allocations ──────────
//
// Locked correction (brief §2): no production_order_id column exists on
// billing_evidence. One billing_evidence row can legitimately span
// multiple Production Orders (e.g. one Upwork hourly period covering two
// batches), so a singular FK there would misrepresent a real
// many-to-many relationship. Realized billed value for an order is
// instead derived at read time from confirmed billing_allocations rows
// that target this order's container video -- the container is the one
// video_logs row Sensor/manual time and billing evidence naturally
// attach to for order-level (rather than per-deliverable) billing.
//
// expectedValueCents (production_orders.expectedValueCents) is a stated
// commercial EXPECTATION only -- it is never mutated by this function or
// by more tracked time; see computeProductionOrderVariance below for the
// one place expectation and reality are compared, always read-only.

export type BilledAllocationRow = {
  amount: number; // billing_allocations.amount (real, decimal currency units)
  currency: string;
};

export function sumBilledByCurrency(
  allocations: readonly BilledAllocationRow[],
): Array<{ currency: string; amount: number }> {
  const byCurrency = new Map<string, number>();
  for (const row of allocations) {
    if (!(row.amount > 0)) continue;
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row.amount);
  }
  return Array.from(byCurrency, ([currency, amount]) => ({
    currency,
    amount: Math.round(amount * 100) / 100,
  })).sort((a, b) => a.currency.localeCompare(b.currency));
}

// Dave fixture (fixed-price): expectedValueCents must never change just
// because more time got tracked -- this function is read-only and has
// no write path; nothing in ./actions.ts ever recomputes or overwrites
// expectedValueCents from tracked time or from billing_allocations.
export function computeProductionOrderVariance(input: {
  expectedValueCents: number | null;
  currency: string | null;
  billedByCurrency: readonly { currency: string; amount: number }[];
}): { billedCents: number | null; varianceCents: number | null } {
  if (input.expectedValueCents === null || !input.currency) {
    return { billedCents: null, varianceCents: null };
  }
  const match = input.billedByCurrency.find((row) => row.currency === input.currency);
  if (!match) return { billedCents: null, varianceCents: null };
  const billedCents = Math.round(match.amount * 100);
  return { billedCents, varianceCents: billedCents - input.expectedValueCents };
}

// ─── Ingest validation ──────────────────────────────────────────────────────

export type ProductionOrderIngestItemInput = {
  title: string;
};

export type ProductionOrderIngestInput = {
  clientId: number;
  projectId: number;
  contractId?: number | null;
  label: string;
  channel?: string | null;
  pricingModel?: "HOURLY" | "FIXED" | "OTHER" | null;
  expectedValueCents?: number | null;
  currency?: string | null;
  notes?: string | null;
  receivedAt: string; // ISO date
  ingestKey: string;
  items: ProductionOrderIngestItemInput[];
};

export function formatProductionOrderContractLabel(contract: {
  platform: string | null;
  billingType: "HOURLY" | "FIXED" | null;
  hourlyRate: number | null;
  currency: string | null;
}): string {
  const platform = contract.platform?.trim() || "Contract";
  if (contract.billingType === "HOURLY" && contract.hourlyRate != null && contract.currency) {
    return `${platform} · ${contract.currency} ${contract.hourlyRate.toFixed(2)}/hour`;
  }
  return `${platform} · ${contract.billingType === "FIXED" ? "Fixed price" : "Commercial contract"}`;
}

export function validateProductionOrderContract(
  clientId: number,
  contract: { clientId: number; status: "ACTIVE" | "PAUSED" | "ENDED" } | null,
): string | null {
  if (!contract || contract.status !== "ACTIVE") return "Choose an active contract.";
  if (contract.clientId !== clientId) return "That contract does not belong to the selected client.";
  return null;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateProductionOrderIngestInput(
  input: ProductionOrderIngestInput,
): string | null {
  if (!isPositiveInt(input.clientId)) return "Choose a client.";
  if (!isPositiveInt(input.projectId)) return "Choose a project.";
  if (input.contractId != null && !isPositiveInt(input.contractId)) {
    return "Choose a valid active contract.";
  }
  if (!input.label || !input.label.trim()) return "Give this order a label.";
  if (input.label.trim().length > PRODUCTION_ORDER_LABEL_MAX_LENGTH) {
    return `Label must be ${PRODUCTION_ORDER_LABEL_MAX_LENGTH} characters or fewer.`;
  }
  if (!isIsoDate(input.receivedAt)) return "Received date must be a valid date.";
  if (!input.ingestKey || !input.ingestKey.trim()) {
    return "Missing ingest key (internal error -- please reload and try again).";
  }
  if (
    input.expectedValueCents != null &&
    (!Number.isFinite(input.expectedValueCents) || input.expectedValueCents < 0)
  ) {
    return "Expected value must be zero or positive.";
  }
  if (
    input.pricingModel != null &&
    !["HOURLY", "FIXED", "OTHER"].includes(input.pricingModel)
  ) {
    return "Invalid pricing model.";
  }
  if (input.notes != null && input.notes.length > PRODUCTION_ORDER_NOTES_MAX_LENGTH) {
    return `Notes must be ${PRODUCTION_ORDER_NOTES_MAX_LENGTH} characters or fewer.`;
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return "Add at least one video to this order.";
  }
  if (input.items.length > PRODUCTION_ORDER_MAX_ITEMS_PER_INGEST) {
    return `Add at most ${PRODUCTION_ORDER_MAX_ITEMS_PER_INGEST} videos at a time.`;
  }
  for (let i = 0; i < input.items.length; i++) {
    const title = input.items[i]?.title;
    if (!title || !title.trim()) {
      return `Video ${i + 1}: title is required.`;
    }
    if (title.trim().length > PRODUCTION_ORDER_ITEM_TITLE_MAX_LENGTH) {
      return `Video ${i + 1}: title must be ${PRODUCTION_ORDER_ITEM_TITLE_MAX_LENGTH} characters or fewer.`;
    }
  }
  return null;
}

// ─── Order-level lifecycle guards ──────────────────────────────────────────

export type ProductionOrderStateRow = {
  state: "OPEN" | "CLOSED" | "CANCELLED";
};

export function isProductionOrderMutable(order: ProductionOrderStateRow): boolean {
  return order.state === "OPEN";
}

export function canCancelProductionOrderItem(item: {
  cancelledAt: Date | null;
  isOperationalContainer: boolean;
}): boolean {
  // The container itself is not a deliverable and is never individually
  // cancelled -- cancelling the whole order (cancelProductionOrder in
  // ./actions.ts) is the corresponding order-level action.
  return item.cancelledAt === null && !item.isOperationalContainer;
}

// ─── War Room signal: stale open order ─────────────────────────────────────
//
// Reuses the existing Signal shape/severity vocabulary from
// modules/signals/core.ts exactly (see ./data.ts, which wires this into
// getActiveSignals) -- no new UI framework, no new alert system.

export type StaleProductionOrderRow = {
  id: number;
  label: string;
  clientName: string | null;
  projectName: string | null;
  receivedAt: Date;
};

export function isStaleProductionOrder(
  row: StaleProductionOrderRow,
  now: Date,
): boolean {
  const days = (now.getTime() - row.receivedAt.getTime()) / (1000 * 60 * 60 * 24);
  return days >= STALE_PRODUCTION_ORDER_DAYS;
}
