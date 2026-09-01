// Wave 4F: restaurant-ticket-style per-video production steps. Parallel to
// (not a replacement for) the Wave 2 Lifecycle overlay -- lifecycle is
// "where in the pipeline", this is "which steps are actually done".
export const PRODUCTION_STEPS = ["ASSEMBLY", "COLOR", "AUDIO", "MOTION", "CAPTIONS", "QA", "EXPORT", "DELIVERY"] as const;
export type ProductionStep = (typeof PRODUCTION_STEPS)[number];
export const CHECKLIST_STATUSES = ["NOT_STARTED", "DONE", "NOT_REQUIRED"] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export function computeChecklistProgress(items: { step: string; status: string }[]): { done: number; applicable: number; complete: boolean } {
  const applicable = items.filter((i) => i.status !== "NOT_REQUIRED");
  const done = applicable.filter((i) => i.status === "DONE").length;
  // No checklist rows at all is honestly "unknown", not "complete" -- same
  // convention as Wave 3's isReadyToProduce.
  const complete = items.length > 0 && applicable.every((i) => i.status === "DONE");
  return { done, applicable: applicable.length, complete };
}
