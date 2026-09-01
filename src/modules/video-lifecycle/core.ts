// Wave 2B: Video Lifecycle prototype. Deliberately SEPARATE from
// video_logs.status/VIDEO_STATUSES (the canonical, production status
// model used everywhere else in the app) -- this is an additive,
// event-sourced overlay for experimenting with a richer stage vocabulary
// without touching the canonical status field, its transitions, or any
// existing UI that reads it.
export const LIFECYCLE_STAGES = [
  "INGEST", "READY", "ROUGH_CUT", "EDITING", "INTERNAL_QA",
  "CLIENT_REVIEW", "REVISION", "APPROVED", "DELIVERED",
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export function isLifecycleStage(v: unknown): v is LifecycleStage {
  return typeof v === "string" && (LIFECYCLE_STAGES as readonly string[]).includes(v);
}

export type LifecycleEventRow = { id: number; videoId: number; stage: LifecycleStage; note: string | null; createdAt: Date };

export type LifecycleState = {
  currentStage: LifecycleStage | null;
  previousStage: LifecycleStage | null;
  currentStageSince: Date | null;
  secondsInCurrentStage: number | null;
  history: LifecycleEventRow[];
};

export function computeLifecycleState(events: LifecycleEventRow[], now: Date = new Date()): LifecycleState {
  // events expected newest-first
  const [current, previous] = events;
  return {
    currentStage: current?.stage ?? null,
    previousStage: previous?.stage ?? null,
    currentStageSince: current?.createdAt ?? null,
    secondsInCurrentStage: current ? Math.max(0, Math.floor((now.getTime() - current.createdAt.getTime()) / 1000)) : null,
    history: events,
  };
}

// Rough derived durations. LOW-DATA CAVEAT: with n=1 these are single
// samples, not statistics -- callers must show the sample count alongside
// any of these, never a bare number (see labelDataCoverage in
// modules/economics/core.ts for the same discipline applied elsewhere).
export type StageDuration = { fromStage: LifecycleStage; toStage: LifecycleStage; seconds: number };

export function deriveStageDurations(eventsOldestFirst: LifecycleEventRow[]): StageDuration[] {
  const durations: StageDuration[] = [];
  for (let i = 1; i < eventsOldestFirst.length; i++) {
    const prev = eventsOldestFirst[i - 1];
    const curr = eventsOldestFirst[i];
    durations.push({
      fromStage: prev.stage,
      toStage: curr.stage,
      seconds: Math.max(0, Math.floor((curr.createdAt.getTime() - prev.createdAt.getTime()) / 1000)),
    });
  }
  return durations;
}

export function timeToFirstCut(eventsOldestFirst: LifecycleEventRow[]): number | null {
  const ingest = eventsOldestFirst.find((e) => e.stage === "INGEST" || e.stage === "READY");
  const roughCut = eventsOldestFirst.find((e) => e.stage === "ROUGH_CUT");
  if (!ingest || !roughCut || roughCut.createdAt <= ingest.createdAt) return null;
  return Math.floor((roughCut.createdAt.getTime() - ingest.createdAt.getTime()) / 1000);
}
