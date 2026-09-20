// Truthful batch composition for the client portal (Train M2). Presentation
// only: it counts the statuses it is GIVEN (already canonical and already
// client-visible) and never invents one. READY_FOR_REVIEW is not "done" and
// DONE here means production completed (label "Completed"/"Delivered" stays
// with clientVideoStatusLabel, which knows about delivery URLs).

import type { VideoStatus } from "../productivity/config.ts";

export type BatchSegmentStatus = "done" | "review" | "progress" | "planned";

const SEGMENT_FOR_STATUS: Record<VideoStatus, BatchSegmentStatus> = {
  DONE: "done",
  READY_FOR_REVIEW: "review",
  IN_PROGRESS: "progress",
  CHANGES_REQUESTED: "progress",
  PLANNED: "planned",
};

export type BatchProgressSummary = {
  total: number;
  counts: { done: number; review: number; inProduction: number; updates: number; planned: number };
  segments: Array<{ id: number; status: BatchSegmentStatus }>;
  /** Plain-text composition, e.g. "2 of 5 completed · 1 in review · 1 in production · 1 planned". */
  summary: string;
};

export type BatchProgressOptions = {
  /** "client" (default): "completed"/"in production". "operator": the operator's own words, "done"/"in progress". */
  wording?: "client" | "operator";
  /** Cancelled deliverables are NOT part of the rail; when given they are named in the text so nothing is hidden. */
  cancelled?: number;
};

export function summarizeBatchProgress(
  items: ReadonlyArray<{ id: number; status: VideoStatus }>,
  options: BatchProgressOptions = {},
): BatchProgressSummary {
  const operator = options.wording === "operator";
  const counts = { done: 0, review: 0, inProduction: 0, updates: 0, planned: 0 };
  for (const item of items) {
    if (item.status === "DONE") counts.done += 1;
    else if (item.status === "READY_FOR_REVIEW") counts.review += 1;
    else if (item.status === "IN_PROGRESS") counts.inProduction += 1;
    else if (item.status === "CHANGES_REQUESTED") counts.updates += 1;
    else counts.planned += 1;
  }
  const parts = [`${counts.done} of ${items.length} ${operator ? "done" : "completed"}`];
  if (counts.review) parts.push(`${counts.review} in review`);
  if (counts.inProduction) parts.push(`${counts.inProduction} ${operator ? "in progress" : "in production"}`);
  if (counts.updates) parts.push(`${counts.updates} ${operator ? "changes requested" : "with updates in progress"}`);
  if (counts.planned) parts.push(`${counts.planned} planned`);
  if (options.cancelled && options.cancelled > 0) parts.push(`${options.cancelled} cancelled (not in the rail)`);
  return {
    total: items.length,
    counts,
    segments: items.map((item) => ({ id: item.id, status: SEGMENT_FOR_STATUS[item.status] })),
    summary: parts.join(" · "),
  };
}
