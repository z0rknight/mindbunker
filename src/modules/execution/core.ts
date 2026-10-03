import type { ClientWorkMode } from "@/lib/client-identity";
import type { VideoKind, VideoStatus } from "@/modules/productivity/config";
import type { QueueEligibleVideo, QueueEntry } from "@/modules/productivity/queue";
import type { WorkSessionActivityType } from "@/modules/work-sessions/core";

export type ExecutionSignalKind =
  | "MANUAL_PRIORITY"
  | "CHANGES_REQUESTED"
  | "RESUMABLE"
  | "COMMITMENT_DUE"
  | "QUEUE_POSITION"
  | "STABLE_FALLBACK";

/** A small reusable explanation unit, not an event-sourcing abstraction. */
export type ExecutionSignal = {
  kind: ExecutionSignalKind;
  subject: { type: "video"; id: number };
  type: "ACTION" | "DEADLINE" | "INFO";
  message: string;
  source: string;
  actionable: boolean;
  relevantAt: string | null;
};

export type ExecutionClientProjection = {
  operationalId: number;
  operationalName: string;
  canonicalId: number;
  canonicalName: string;
  workMode: ClientWorkMode;
  href: string;
};

export type CurrentExecution = {
  sessionId: number;
  activityType: WorkSessionActivityType;
  startedAt: string;
  elapsedSeconds: number;
  stale: boolean;
  source: string;
  deviceName: string | null;
  sessionHref: string;
  integrityIssues?: string[];
  nextAction: string;
  blocker: { category: string } | null;
  video: {
    id: number;
    title: string;
    status: VideoStatus;
    videoKind: VideoKind;
    href: string;
  };
  project: { id: number; name: string; href: string } | null;
  client: ExecutionClientProjection | null;
};

export type ExecutionRecommendation = {
  videoId: number;
  title: string;
  status: VideoStatus;
  nextAction: string;
  videoHref: string;
  project: { id: number; name: string; href: string } | null;
  client: ExecutionClientProjection | null;
  signals: ExecutionSignal[];
  deadline: string | null;
  blockingState: { isBlocked: false; reason: null };
  provenance: "execution-policy-v1";
};

function dateValue(value: Date | string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function productionStageRank(status: VideoStatus): number {
  if (status === "CHANGES_REQUESTED") return 0;
  if (status === "IN_PROGRESS") return 1;
  return 2;
}

/**
 * Deterministic recommendation policy. Each comparison corresponds to a
 * visible reason; there is deliberately no hidden or learned score.
 */
export function selectExecutionRecommendation<T extends QueueEligibleVideo>(
  queue: readonly QueueEntry<T>[],
): QueueEntry<T> | null {
  return [...queue]
    .filter((item) => item.isExecutable)
    .sort((a, b) => {
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      const stageDelta = productionStageRank(a.status) - productionStageRank(b.status);
      if (stageDelta !== 0) return stageDelta;
      const dueDelta = dateValue(a.soonestCommitmentDueAt) - dateValue(b.soonestCommitmentDueAt);
      if (dueDelta !== 0) return dueDelta;
      const queueDelta = a.queueRank - b.queueRank;
      if (queueDelta !== 0) return queueDelta;
      return a.id - b.id;
    })[0] ?? null;
}

export function explainExecutionRecommendation<T extends QueueEligibleVideo>(
  item: QueueEntry<T>,
): ExecutionSignal[] {
  const signals: ExecutionSignal[] = [];
  if (item.isPriority) {
    signals.push({
      kind: "MANUAL_PRIORITY",
      subject: { type: "video", id: item.id },
      type: "ACTION",
      message: "Marked as the project's explicit priority.",
      source: "video_logs.is_priority",
      actionable: true,
      relevantAt: null,
    });
  }
  if (item.status === "CHANGES_REQUESTED") {
    signals.push({
      kind: "CHANGES_REQUESTED",
      subject: { type: "video", id: item.id },
      type: "ACTION",
      message: "Client changes are requested and ready for production.",
      source: "video_logs.status",
      actionable: true,
      relevantAt: null,
    });
  } else if (item.status === "IN_PROGRESS") {
    signals.push({
      kind: "RESUMABLE",
      subject: { type: "video", id: item.id },
      type: "ACTION",
      message: "Production has already started, so this work is resumable.",
      source: "video_logs.status",
      actionable: true,
      relevantAt: null,
    });
  }
  if (item.soonestCommitmentDueAt) {
    const iso = item.soonestCommitmentDueAt instanceof Date
      ? item.soonestCommitmentDueAt.toISOString()
      : item.soonestCommitmentDueAt;
    signals.push({
      kind: "COMMITMENT_DUE",
      subject: { type: "video", id: item.id },
      type: "DEADLINE",
      message: `Open commitment due ${iso}.`,
      source: "commitments.due_at",
      actionable: true,
      relevantAt: iso,
    });
  }
  if (item.queuePosition !== null) {
    signals.push({
      kind: "QUEUE_POSITION",
      subject: { type: "video", id: item.id },
      type: "INFO",
      message: `Manual execution queue position ${item.queuePosition}.`,
      source: "video_logs.queue_position",
      actionable: true,
      relevantAt: null,
    });
  }
  if (signals.length === 0) {
    signals.push({
      kind: "STABLE_FALLBACK",
      subject: { type: "video", id: item.id },
      type: "INFO",
      message: "Selected by the stable queue fallback.",
      source: "video_logs.updated_at,id",
      actionable: true,
      relevantAt: null,
    });
  }
  return signals;
}
