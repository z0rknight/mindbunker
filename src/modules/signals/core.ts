import { isStaleProductionOrder, type StaleProductionOrderRow } from "../production-orders/core.ts";

// Operator Intelligence Patch Phase 2: WAR ROOM ACTIVE SIGNALS.
//
// This is a deterministic read model, not a notification system. No ML,
// no LLM inference, no background jobs, no stored alerts -- every signal
// here is computed on read from facts already captured elsewhere
// (commitments, blockers, friction_events, revisions, Finance
// reconciliation, transactions). See the Operator Intelligence Patch
// report for the full rule set this file implements.
//
// Confidence is exactly three states -- never invent a fourth:
//   HIGH         direct facts or fact-preserving sums with adequate coverage
//   MEDIUM       real evidence exists, but sample/coverage limits matter
//   INSUFFICIENT the system cannot responsibly make the claim
//
// Severity is separate from confidence and maps to what the operator
// should actually do, never to how "bad" the number looks:
//   ACTION  something concrete to do right now
//   WATCH   a pattern worth noticing, not (yet) urgent
//   INFO    context, including "not enough data yet" -- INSUFFICIENT DATA
//           is itself a valid signal state, not a failure to compute one.

export type SignalSeverity = "ACTION" | "WATCH" | "INFO";
export type SignalConfidence = "HIGH" | "MEDIUM" | "INSUFFICIENT";

export type SignalAction = {
  label: string;
  href: string;
};

export type Signal = {
  id: string;
  kind:
    | "OVERDUE_PROMISE"
    | "OPEN_BLOCKER"
    | "REPEATED_FRICTION"
    | "REVISION_DRAG"
    | "CASH_RECONCILIATION"
    | "UNATTRIBUTED_REVENUE"
    | "UNRESOLVED_CAPTURES"
    | "STALE_PRODUCTION_ORDER"
    | "CLIENT_PRIORITY_REQUEST";
  severity: SignalSeverity;
  confidence: SignalConfidence;
  statement: string;
  evidence: string;
  action: SignalAction | null;
  // Present when this signal is anchored to one concrete record --
  // "Record decision" (Phase 5) pre-fills context from this.
  context: { videoId?: number; clientId?: number; projectId?: number } | null;
};

// ─── A. OVERDUE PROMISE ─────────────────────────────────────────────────────

export type CommitmentRow = {
  id: number;
  title: string;
  dueAt: Date;
  videoId: number;
  videoTitle: string | null;
  clientName: string | null;
  projectName: string | null;
};

function formatOverdueBy(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

// Tuesday Patch Completion Round §F: ranks OPEN commitments for the
// cross-surface commitment card -- overdue first (most overdue first, same
// ordering the Active Signals list already uses), then upcoming (soonest
// first). Dashboard slices this to 1 ("do not dump every deadline
// there"); War Room shows a few real ones instead of only an aggregate
// count.
export function rankOpenCommitments(
  rows: readonly CommitmentRow[],
  now: Date,
): CommitmentRow[] {
  return [...rows].sort((a, b) => {
    const aOverdue = a.dueAt.getTime() < now.getTime();
    const bOverdue = b.dueAt.getTime() < now.getTime();
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    // Both overdue or both upcoming: ascending due date puts the most
    // overdue (earliest) first within the overdue group, and the soonest
    // upcoming first within the upcoming group -- same comparator serves
    // both, since "most urgent" is always "earliest dueAt" either way.
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
}

export function computeOverduePromiseSignals(
  rows: readonly CommitmentRow[],
  now: Date,
): Signal[] {
  return rows
    .filter((row) => row.dueAt.getTime() < now.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .map((row) => ({
      id: `overdue-promise-${row.id}`,
      kind: "OVERDUE_PROMISE" as const,
      severity: "ACTION" as const,
      confidence: "HIGH" as const,
      statement: `"${row.title}" is overdue by ${formatOverdueBy(now.getTime() - row.dueAt.getTime())}`,
      evidence: `${row.videoTitle ?? `Video #${row.videoId}`}${row.clientName ? ` · ${row.clientName}` : ""}${row.projectName ? ` · ${row.projectName}` : ""}`,
      action: { label: "Open video", href: `/productivity?video=${row.videoId}` },
      context: { videoId: row.videoId },
    }));
}

// ─── B. OPEN BLOCKER ────────────────────────────────────────────────────────

export type BlockerRow = {
  id: number;
  category: string;
  note: string | null;
  startedAt: Date;
  videoId: number;
  videoTitle: string | null;
  clientName: string | null;
};

export function computeOpenBlockerSignals(
  rows: readonly BlockerRow[],
  now: Date,
): Signal[] {
  return rows
    .slice()
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .map((row) => {
      const openMs = now.getTime() - row.startedAt.getTime();
      const openDays = Math.floor(openMs / (1000 * 60 * 60 * 24));
      return {
        id: `open-blocker-${row.id}`,
        kind: "OPEN_BLOCKER" as const,
        // An open blocker is already actionable by construction -- no
        // arbitrary duration threshold decides whether it "counts."
        severity: "ACTION" as const,
        confidence: "HIGH" as const,
        statement: `${row.category} blocker open ${openDays >= 1 ? `${openDays}d` : "today"}`,
        evidence: `${row.videoTitle ?? `Video #${row.videoId}`}${row.clientName ? ` · ${row.clientName}` : ""}${row.note ? ` · ${row.note}` : ""}`,
        action: { label: "Open video", href: `/productivity?video=${row.videoId}` },
        context: { videoId: row.videoId },
      };
    });
}

// ─── C. REPEATED FRICTION ───────────────────────────────────────────────────

export type FrictionRow = {
  category: string;
  videoId: number;
};

// Operator rule, not scientific truth: 3+ occurrences of the same friction
// category across 2+ distinct videos in the recent window is worth a
// glance. Explicitly labeled as a rule, not a discovered threshold.
const REPEATED_FRICTION_MIN_OCCURRENCES = 3;
const REPEATED_FRICTION_MIN_VIDEOS = 2;

export function computeRepeatedFrictionSignals(
  rows: readonly FrictionRow[],
): Signal[] {
  const byCategory = new Map<string, { count: number; videoIds: Set<number> }>();
  for (const row of rows) {
    const entry = byCategory.get(row.category) ?? { count: 0, videoIds: new Set<number>() };
    entry.count += 1;
    entry.videoIds.add(row.videoId);
    byCategory.set(row.category, entry);
  }

  const signals: Signal[] = [];
  for (const [category, entry] of byCategory) {
    if (
      entry.count >= REPEATED_FRICTION_MIN_OCCURRENCES &&
      entry.videoIds.size >= REPEATED_FRICTION_MIN_VIDEOS
    ) {
      signals.push({
        id: `repeated-friction-${category}`,
        kind: "REPEATED_FRICTION",
        severity: "WATCH",
        confidence: "MEDIUM",
        statement: `${category} friction repeated recently`,
        evidence: `${category} · ${entry.count} occurrences · ${entry.videoIds.size} videos · operator rule (≥${REPEATED_FRICTION_MIN_OCCURRENCES} occurrences / ≥${REPEATED_FRICTION_MIN_VIDEOS} videos), not a statistical threshold`,
        action: null,
        context: null,
      });
    }
  }
  return signals.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── D. OUR_ERROR / REVISION DRAG ──────────────────────────────────────────

export type RevisionRow = {
  causedBy: string;
  videoId: number;
};

// Below this many detailed-provenance revisions, a rate is not
// responsibly reportable -- see hasComparableTrendSample precedent
// elsewhere in this codebase for the same discipline.
const REVISION_DRAG_MIN_SAMPLE = 5;

export function computeRevisionDragSignal(
  rows: readonly RevisionRow[],
): Signal {
  const total = rows.length;
  if (total < REVISION_DRAG_MIN_SAMPLE) {
    return {
      id: "revision-drag",
      kind: "REVISION_DRAG",
      severity: "INFO",
      confidence: "INSUFFICIENT",
      statement: "Not enough detailed revision records to report an OUR_ERROR rate",
      evidence: `Since detailed revision logging began · N=${total} recorded revisions (need ${REVISION_DRAG_MIN_SAMPLE}+)`,
      action: null,
      context: null,
    };
  }
  const ourErrorCount = rows.filter((row) => row.causedBy === "OUR_ERROR").length;
  const pct = Math.round((ourErrorCount / total) * 100);
  return {
    id: "revision-drag",
    kind: "REVISION_DRAG",
    severity: pct >= 30 ? "WATCH" : "INFO",
    confidence: "MEDIUM",
    statement: `${pct}% of recorded revisions are OUR_ERROR`,
    evidence: `Since detailed revision logging began · ${ourErrorCount} of ${total} recorded revisions · legacy videos without detailed provenance are not included`,
    action: null,
    context: null,
  };
}

// ─── E. CASH RECONCILIATION ─────────────────────────────────────────────────

export type ReconciliationRowInput = {
  currency: string;
  difference: number | null;
};

export function computeCashReconciliationSignals(
  rows: readonly ReconciliationRowInput[],
): Signal[] {
  return rows
    .filter((row) => row.difference !== null && Math.abs(row.difference) >= 0.01)
    .map((row) => ({
      id: `cash-reconciliation-${row.currency}`,
      kind: "CASH_RECONCILIATION" as const,
      severity: "WATCH" as const,
      confidence: "HIGH" as const,
      statement: `${row.currency} observed balance differs from the ledger by ${row.difference! > 0 ? "+" : ""}${row.difference!.toFixed(2)}`,
      evidence: "Canonical Finance reconciliation (observed − ledger)",
      action: { label: "Open Finance", href: "/finance" },
      context: null,
    }));
}

// ─── F. UNATTRIBUTED REVENUE ────────────────────────────────────────────────

export type UnattributedRevenueRow = {
  currency: string;
  amount: number;
};

export function computeUnattributedRevenueSignals(
  rows: readonly UnattributedRevenueRow[],
): Signal[] {
  return rows
    .filter((row) => row.amount > 0)
    .map((row) => ({
      id: `unattributed-revenue-${row.currency}`,
      kind: "UNATTRIBUTED_REVENUE" as const,
      severity: "INFO" as const,
      confidence: "HIGH" as const,
      statement: `${row.currency} ${row.amount.toFixed(2)} recorded this month with no client attribution`,
      evidence: "Income transactions this month with no linked client",
      action: { label: "Open Finance", href: "/finance" },
      context: null,
    }));
}

// ─── G. UNRESOLVED CAPTURES (RMEDIA Engine Operational Capture, Wave 2) ─────
//
// Wave 1.5 Decision D: purely informational aging visibility for the
// Capture Inbox (src/app/productivity/captures). It must NEVER mutate
// Capture outcome -- the count is computed on read here, exactly like
// every other signal in this file, and this function has no write
// access to the captures table at all.

export function computeUnresolvedCapturesSignal(staleCount: number): Signal[] {
  if (staleCount <= 0) return [];
  return [
    {
      id: "unresolved-captures",
      kind: "UNRESOLVED_CAPTURES" as const,
      severity: "WATCH" as const,
      confidence: "HIGH" as const,
      statement: `${staleCount} Capture${staleCount === 1 ? "" : "s"} unresolved for over a week`,
      evidence: "Leads, samples, and internal work waiting on a Promote/Ghosted/Rejected/Dismiss decision",
      action: { label: "Open Capture Inbox", href: "/productivity/captures" },
      context: null,
    },
  ];
}

// ─── H. STALE PRODUCTION ORDER (RMEDIA LET'S COOK Wave 1) ──────────────────
//
// Reuses the exact Signal shape and severity vocabulary above -- no new
// alerting system, no new UI. isStaleProductionOrder (the age threshold
// itself) lives in modules/production-orders/core.ts as a pure function;
// this only shapes that pure result into the Signal type, matching how
// computeUnresolvedCapturesSignal (§G) shapes a pre-computed count.

export function computeStaleProductionOrdersSignals(
  rows: readonly StaleProductionOrderRow[],
  now: Date,
): Signal[] {
  return rows
    .filter((row) => isStaleProductionOrder(row, now))
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    .map((row) => {
      const days = Math.floor(
        (now.getTime() - row.receivedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: `stale-production-order-${row.id}`,
        kind: "STALE_PRODUCTION_ORDER" as const,
        severity: "WATCH" as const,
        confidence: "HIGH" as const,
        statement: `"${row.label}" has been open ${days}d with no delivery`,
        evidence: `${row.clientName ?? "Unknown client"}${row.projectName ? ` · ${row.projectName}` : ""}`,
        action: { label: "Open order", href: `/productivity/orders/${row.id}` },
        context: null,
      };
    });
}

// ─── I. CLIENT PRIORITY REQUEST (Sep 16 Operational Reality Patch) ─────────
//
// videoLogs.isPriority is a client-settable "priority now" flag (Lunch
// Reality Patch P1 §7) with no operator-facing surface at all -- a client
// could mark a video priority and the operator would only ever discover it
// by opening that exact video. This is explicitly a REQUEST, never an
// override: it never touches queuePosition or execution order (see
// modules/productivity/queue.ts), it only makes the request visible where
// the operator already looks for exceptions. Locked decision (Sept 16
// brief §4/§11): client priority must never silently reorder the real
// execution queue -- this signal is the entire fix, not a first step
// toward auto-reordering.

export type ClientPriorityRequestRow = {
  videoId: number;
  title: string | null;
  clientName: string | null;
  projectName: string | null;
};

export function computeClientPriorityRequestSignals(
  rows: readonly ClientPriorityRequestRow[],
): Signal[] {
  return rows.map((row) => ({
    id: `client-priority-request-${row.videoId}`,
    kind: "CLIENT_PRIORITY_REQUEST" as const,
    severity: "WATCH" as const,
    confidence: "HIGH" as const,
    statement: `${row.clientName ?? "A client"} marked "${row.title ?? `Video ${row.videoId}`}" as priority`,
    evidence: "Client-set request, not an operator schedule change -- your execution queue order is unchanged.",
    action: { label: "Open video", href: `/productivity?video=${row.videoId}` },
    context: { videoId: row.videoId },
  }));
}

// ─── ordering ───────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<SignalSeverity, number> = { ACTION: 0, WATCH: 1, INFO: 2 };

export function rankSignals(signals: readonly Signal[]): Signal[] {
  return signals
    .slice()
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
