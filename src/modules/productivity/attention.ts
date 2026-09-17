import type { Signal, SignalSeverity } from "@/modules/signals/core";

// P0.2 (Tuesday Reality & Usability Patch): Productivity's "Needs Attention"
// is a PROJECTION over the canonical modules/signals engine -- it adds no
// new computation, no stored alerts, and no second ranking model. It exists
// because War Room's Active Signals mixes execution-relevant facts
// (an overdue promise, a blocked video) with financial/accounting facts
// (cash reconciliation, unattributed revenue) that have nothing to do with
// "what should I work on right now." This file answers exactly one
// question: of the signals modules/signals already computed, which ones
// would change what the operator does next at the keyboard?
const PRODUCTIVITY_SIGNAL_KINDS = [
  "OVERDUE_PROMISE",
  "OPEN_BLOCKER",
  "REPEATED_FRICTION",
  "REVISION_DRAG",
  // Sep 16 Operational Reality Patch: a client's priority request is
  // exactly "what should change what I work on next" -- the one thing
  // this whitelist exists to surface.
  "CLIENT_PRIORITY_REQUEST",
] as const;

type ProductivitySignalKind = (typeof PRODUCTIVITY_SIGNAL_KINDS)[number];

// Human-facing group labels -- the signal engine's own kind/severity/
// confidence vocabulary (see modules/signals/core.ts) is deliberately never
// printed on this page; War Room is where that instrumented language
// belongs.
const KIND_LABEL: Record<ProductivitySignalKind, string> = {
  OVERDUE_PROMISE: "Overdue promises",
  OPEN_BLOCKER: "Blocked",
  REPEATED_FRICTION: "Recurring friction",
  REVISION_DRAG: "Revision rate climbing",
  CLIENT_PRIORITY_REQUEST: "Client priority requests",
};

export type ProductivityAttentionGroup = {
  kind: ProductivitySignalKind;
  label: string;
  severity: SignalSeverity;
  signals: Signal[];
};

function isProductivitySignalKind(
  kind: Signal["kind"],
): kind is ProductivitySignalKind {
  return (PRODUCTIVITY_SIGNAL_KINDS as readonly string[]).includes(kind);
}

const SEVERITY_RANK: Record<SignalSeverity, number> = { ACTION: 0, WATCH: 1, INFO: 2 };

// INFO is excluded on purpose, not just deprioritized: for these kinds
// INFO always means "nothing to act on" -- REVISION_DRAG reports INFO both
// when the sample is too small to responsibly claim a rate AND when the
// rate is fine (<30%); OVERDUE_PROMISE/OPEN_BLOCKER/CLIENT_PRIORITY_REQUEST
// never emit INFO at all. A genuine execution exception is never hiding
// behind INFO here.
export function selectProductivityAttention(
  signals: readonly Signal[],
): ProductivityAttentionGroup[] {
  const groups = new Map<ProductivitySignalKind, Signal[]>();
  for (const signal of signals) {
    if (!isProductivitySignalKind(signal.kind)) continue;
    if (signal.severity === "INFO") continue;
    const list = groups.get(signal.kind) ?? [];
    list.push(signal);
    groups.set(signal.kind, list);
  }

  return PRODUCTIVITY_SIGNAL_KINDS.filter((kind) => groups.has(kind))
    .map((kind) => {
      const list = groups.get(kind)!;
      return { kind, label: KIND_LABEL[kind], severity: list[0].severity, signals: list };
    })
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
