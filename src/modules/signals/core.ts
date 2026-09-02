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
    | "UNATTRIBUTED_REVENUE";
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

// ─── ordering ───────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<SignalSeverity, number> = { ACTION: 0, WATCH: 1, INFO: 2 };

export function rankSignals(signals: readonly Signal[]): Signal[] {
  return signals
    .slice()
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
