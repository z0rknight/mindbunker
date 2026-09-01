// Wave 4G: Video Idea / Pitch, reusing the existing Video model (per
// instruction) rather than a separate object. IDEA -> PROPOSED -> APPROVED;
// approving simply clears ideaStage back to null, since the row was
// already a real video_logs row the whole time.
export const IDEA_STAGES = ["IDEA", "PROPOSED", "APPROVED"] as const;
export type IdeaStage = (typeof IDEA_STAGES)[number];

export function nextIdeaStage(current: IdeaStage): IdeaStage | null {
  const i = IDEA_STAGES.indexOf(current);
  return i >= 0 && i < IDEA_STAGES.length - 1 ? IDEA_STAGES[i + 1] : null;
}
