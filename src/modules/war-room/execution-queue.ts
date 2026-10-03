import type { QueueEligibleVideo, QueueEntry } from "@/modules/productivity/queue";

/**
 * The War Room default is a bounded projection of the canonical queue.
 * Recommendation may override queue order, so it is excluded separately
 * instead of being assumed to be queue[0].
 */
export function selectCompactExecutionQueue<T extends QueueEligibleVideo>(
  queue: readonly QueueEntry<T>[],
  options: { currentVideoId?: number | null; recommendedVideoId?: number | null; nextLimit?: number },
) {
  const excluded = new Set(
    [options.currentVideoId, options.recommendedVideoId].filter(
      (id): id is number => typeof id === "number",
    ),
  );
  const remaining = queue.filter((item) => !excluded.has(item.id));
  const next = remaining
    .filter((item) => item.isExecutable)
    .slice(0, options.nextLimit ?? 3);
  const shown = new Set(next.map((item) => item.id));
  return {
    next,
    laterCount: remaining.filter((item) => !shown.has(item.id)).length,
  };
}
