import { operatorDateKey, shiftDateKey } from "../../utils/date.ts";
import { commitmentChronologyIssue } from "../video-operations/core.ts";

export type AttentionCandidate = {
  source: "COMMITMENT" | "BLOCKER" | "VIDEO";
  sourceId: number;
  videoId: number;
  videoTitle: string;
  clientName: string | null;
  projectName: string | null;
  title: string;
  createdAt: Date | string;
  dueAt?: Date | string | null;
  videoStatus?: "CHANGES_REQUESTED" | "READY_FOR_REVIEW";
  resolvedAt?: Date | string | null;
};

export type AttentionReason =
  | "DATA_ISSUE"
  | "OVERDUE"
  | "BLOCKED"
  | "CHANGES_REQUESTED"
  | "READY_FOR_REVIEW"
  | "DUE_TODAY"
  | "DUE_NEXT_7_DAYS";

export type DashboardAttentionItem = AttentionCandidate & {
  reason: AttentionReason;
  rank: number;
  dueAtIso: string | null;
};

export type DashboardNowTarget = {
  videoId: number;
  status: string;
};

export function selectDashboardNow<T extends DashboardNowTarget>(
  openSession: unknown | null,
  recentTargets: readonly T[],
) {
  if (openSession) return { mode: "OPEN" as const, targets: [] as T[] };
  return {
    mode: "RECENT" as const,
    targets: recentTargets.filter((target) => target.status === "IN_PROGRESS").slice(0, 2),
  };
}

function classifyCandidate(
  candidate: AttentionCandidate,
  now: Date,
): DashboardAttentionItem | null {
  if (candidate.source === "BLOCKER") {
    if (candidate.resolvedAt) return null;
    return { ...candidate, reason: "BLOCKED", rank: 2, dueAtIso: null };
  }
  if (candidate.source === "VIDEO") {
    const reason = candidate.videoStatus;
    if (reason !== "CHANGES_REQUESTED" && reason !== "READY_FOR_REVIEW") return null;
    return {
      ...candidate,
      reason,
      rank: reason === "CHANGES_REQUESTED" ? 3 : 4,
      dueAtIso: null,
    };
  }

  if (!candidate.dueAt) return null;
  const dueAt = new Date(candidate.dueAt);
  const createdAt = new Date(candidate.createdAt);
  if (commitmentChronologyIssue({ createdAt, dueAt })) {
    return {
      ...candidate,
      reason: "DATA_ISSUE",
      rank: 0,
      dueAtIso: Number.isNaN(dueAt.getTime()) ? null : dueAt.toISOString(),
    };
  }
  if (dueAt.getTime() < now.getTime()) {
    return { ...candidate, reason: "OVERDUE", rank: 1, dueAtIso: dueAt.toISOString() };
  }

  const todayKey = operatorDateKey(now);
  const dueKey = operatorDateKey(dueAt);
  if (dueKey === todayKey) {
    return { ...candidate, reason: "DUE_TODAY", rank: 5, dueAtIso: dueAt.toISOString() };
  }
  if (dueKey <= shiftDateKey(todayKey, 7)) {
    return {
      ...candidate,
      reason: "DUE_NEXT_7_DAYS",
      rank: 6,
      dueAtIso: dueAt.toISOString(),
    };
  }
  return null;
}

export function rankDashboardAttention(
  candidates: readonly AttentionCandidate[],
  now: Date = new Date(),
  limit = 5,
): DashboardAttentionItem[] {
  return candidates
    .map((candidate) => classifyCandidate(candidate, now))
    .filter((candidate): candidate is DashboardAttentionItem => candidate !== null)
    .sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank;
      const leftTime = left.dueAtIso
        ? Date.parse(left.dueAtIso)
        : new Date(left.createdAt).getTime();
      const rightTime = right.dueAtIso
        ? Date.parse(right.dueAtIso)
        : new Date(right.createdAt).getTime();
      return leftTime - rightTime || left.sourceId - right.sourceId;
    })
    .slice(0, limit);
}
