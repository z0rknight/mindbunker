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

// Promotion Prep Patch P0: a *separate* predicate for "does this video
// count as real client production output" -- used by War Room,
// Productivity, CRM, and Project-list aggregates that count *completed
// videos*, not money. Today this happens to be identical to
// countsTowardRevenue (a Sample Video or Internal video is neither
// revenue nor a production-completion metric), but the two are kept as
// distinct named predicates on purpose: if production-count semantics
// and revenue semantics ever diverge (e.g. a comped OTHER video that
// should count as delivered output but never as revenue), only one of
// the two predicates should change, not both silently together.
export const PRODUCTION_COUNT_KINDS = ["CLIENT_WORK", "OTHER"] as const;

export function countsTowardProduction(kind: string): boolean {
  return kind === "CLIENT_WORK" || kind === "OTHER";
}
