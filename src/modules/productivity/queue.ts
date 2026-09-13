import type { VideoKind, VideoOrientation, VideoStatus } from "./config";

// P0.4 (Tuesday Reality & Usability Patch): the solo-operator global
// execution queue. video_logs is already the canonical executable work
// item (Gate 3) -- this file is the ONE shared eligibility/ordering/
// next-executable read model everything else (Productivity's queue
// section, NOW/FOCUS's recommendation) must call instead of re-deriving
// membership or order locally.
//
export function isQueueEligible(video: {
  videoKind: VideoKind;
  status: VideoStatus;
  isOperationalContainer?: boolean;
}): boolean {
  return video.videoKind === "CLIENT_WORK" && video.status !== "DONE" && !video.isOperationalContainer;
}

export type QueueEligibleVideo = {
  id: number;
  title: string | null;
  date: string;
  status: VideoStatus;
  videoKind: VideoKind;
  clientId: number | null;
  clientName: string | null;
  projectId: number | null;
  projectName: string | null;
  projectDeadline: string | null;
  coverUrl: string | null;
  orientation: VideoOrientation | null;
  isOperationalContainer: boolean;
  queuePosition: number | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

export type QueueEntry<T extends QueueEligibleVideo> = T & {
  isBlocked: boolean;
  blockerCategory: string | null;
  // READY_FOR_REVIEW: proven by modules/productivity/config.ts's own
  // transition graph and the client-portal's Approve/Request-changes
  // actions to be a decision waiting on the client (or the operator's own
  // review), never open production work -- see productivity/core.ts's
  // existing "attention" bucket, which already classifies it the same
  // way. Shown in the queue at its position, never hidden, just not
  // offered as the next thing to start a work session on.
  isAwaitingReview: boolean;
  isExecutable: boolean;
  soonestCommitmentDueAt: Date | string | null;
  queueRank: number;
};

function fallbackTimestamp(video: { updatedAt: Date | string | null; createdAt: Date | string | null }) {
  const value = video.updatedAt ?? video.createdAt;
  if (!value) return 0;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export type QueueContext = {
  blockedVideoIds: ReadonlySet<number>;
  blockerCategoryByVideoId?: ReadonlyMap<number, string>;
  soonestCommitmentDueAtByVideoId?: ReadonlyMap<number, Date | string>;
};

// Ordering: manually positioned items first (ascending queuePosition),
// then unpositioned items using the SAME "most recently touched first"
// fallback groupOperationalVideos already uses elsewhere in this module
// for determinism -- not a new ordering preference.
export function selectExecutionQueue<T extends QueueEligibleVideo>(
  videos: readonly T[],
  context: QueueContext,
): Array<QueueEntry<T>> {
  const eligible = videos.filter(isQueueEligible);
  const positioned = eligible
    .filter((video) => video.queuePosition !== null)
    .sort((a, b) => (a.queuePosition as number) - (b.queuePosition as number));
  const unpositioned = eligible
    .filter((video) => video.queuePosition === null)
    .sort((a, b) => fallbackTimestamp(b) - fallbackTimestamp(a));

  return [...positioned, ...unpositioned].map((video, index) => {
    const isBlocked = context.blockedVideoIds.has(video.id);
    const isAwaitingReview = video.status === "READY_FOR_REVIEW";
    return {
      ...video,
      isBlocked,
      blockerCategory: context.blockerCategoryByVideoId?.get(video.id) ?? null,
      isAwaitingReview,
      isExecutable: !isBlocked && !isAwaitingReview,
      soonestCommitmentDueAt: context.soonestCommitmentDueAtByVideoId?.get(video.id) ?? null,
      queueRank: index,
    };
  });
}

// ONE SOURCE FOR NEXT (per the Tuesday Patch): this is the only function
// that may decide what NOW/FOCUS recommends when no work session is open.
// First item in queue order that is neither blocked nor awaiting review.
export function selectNextExecutable<T extends QueueEligibleVideo>(
  queue: readonly QueueEntry<T>[],
): QueueEntry<T> | null {
  return queue.find((item) => item.isExecutable) ?? null;
}

// ─── Reordering ──────────────────────────────────────────────────────────
//
// Correctness over cleverness (explicit instruction): every reorder
// resequences the WHOLE eligible queue in one pass rather than hunting for
// a gap between two neighboring sparse integers. At solo-operator scale
// (tens of items) this is cheap and sidesteps every edge case a
// neighbor-gap scheme has to handle (first/last position, no gap left,
// legacy duplicate positions) by construction -- there is no gap-finding
// logic to get wrong.
export const QUEUE_POSITION_STEP = 1000;

export type QueueMoveDirection = "up" | "down" | "top";

// Pure array reordering: given the current ordered id list and a target
// id + direction, returns the new ordered id list. Moving the first item
// "up" or the last item "down" is a no-op (nothing to change).
export function moveInOrder(
  orderedIds: readonly number[],
  videoId: number,
  direction: QueueMoveDirection,
): number[] {
  const currentIndex = orderedIds.indexOf(videoId);
  if (currentIndex === -1) return [...orderedIds];
  const withoutItem = orderedIds.filter((id) => id !== videoId);

  let targetIndex: number;
  if (direction === "top") {
    targetIndex = 0;
  } else if (direction === "up") {
    targetIndex = Math.max(0, currentIndex - 1);
  } else {
    targetIndex = Math.min(withoutItem.length, currentIndex + 1);
  }

  return [
    ...withoutItem.slice(0, targetIndex),
    videoId,
    ...withoutItem.slice(targetIndex),
  ];
}

// Pointer/drag companion to moveInOrder. The server still reloads the
// canonical queue immediately before applying this operation, so the
// browser supplies intent (move A before B), never the authoritative list.
export function moveBefore(
  orderedIds: readonly number[],
  videoId: number,
  beforeVideoId: number | null,
): number[] {
  if (!orderedIds.includes(videoId)) return [...orderedIds];
  const remaining = orderedIds.filter((id) => id !== videoId);
  if (beforeVideoId === null) return [...remaining, videoId];
  const target = remaining.indexOf(beforeVideoId);
  if (target === -1) return [...orderedIds];
  return [...remaining.slice(0, target), videoId, ...remaining.slice(target)];
}

// Assigns fresh sparse positions (1000, 2000, 3000, ...) to an ordered id
// list -- the single normalization step every reorder writes through.
export function resequencePositions(orderedIds: readonly number[]): Map<number, number> {
  const positions = new Map<number, number>();
  orderedIds.forEach((id, index) => {
    positions.set(id, (index + 1) * QUEUE_POSITION_STEP);
  });
  return positions;
}
