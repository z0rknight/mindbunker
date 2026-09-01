// Wave 4H: explicit classification, separate from canonical status.
export const VIDEO_KINDS = ["CLIENT_WORK", "SAMPLE_VIDEO", "INTERNAL", "OTHER"] as const;
export type VideoKind = (typeof VIDEO_KINDS)[number];

export function isVideoKind(v: unknown): v is VideoKind {
  return typeof v === "string" && (VIDEO_KINDS as readonly string[]).includes(v);
}

// Economics must never count a Sample Video (or Internal) as realized
// revenue -- this is the one predicate every economics aggregation this
// round checks before summing a video into revenue-adjacent totals.
export function countsTowardRevenue(kind: string): boolean {
  return kind === "CLIENT_WORK" || kind === "OTHER";
}
