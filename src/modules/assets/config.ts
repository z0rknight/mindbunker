// Monday Real-Operation Pre-Freeze §3 — Asset type/status vocabulary.
// Lives here (not in db/schema.ts) so it follows the same convention as
// modules/productivity/config.ts (VIDEO_STATUSES) and modules/projects/config.ts
// (PROJECT_STATUSES): schema.ts imports the const arrays, it does not own them.
//
// This vocabulary is DELIBERATELY provisional (see the brief's own §3 note:
// "It is intentionally provisional and will be tested against Taryn
// August"). Do not expand it speculatively -- extend only against real
// evidence from an actual ingest.
export const ASSET_TYPES = [
  "FINAL_DELIVERABLE",
  "CLIENT_REVIEW",
  "UTILITY_ASSET",
  "AI_INPUT",
  "SOURCE_PREP",
  "BONUS_EXTRA",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  FINAL_DELIVERABLE: "Final deliverable",
  CLIENT_REVIEW: "Client review cut",
  UTILITY_ASSET: "Utility asset",
  AI_INPUT: "AI processing input/output",
  SOURCE_PREP: "Source prep",
  BONUS_EXTRA: "Bonus / extra",
};

export function isAssetType(value: unknown): value is AssetType {
  return typeof value === "string" && (ASSET_TYPES as readonly string[]).includes(value);
}

export const ASSET_STATUSES = ["DRAFT", "READY", "DELIVERED"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  DELIVERED: "Delivered",
};

export function isAssetStatus(value: unknown): value is AssetStatus {
  return typeof value === "string" && (ASSET_STATUSES as readonly string[]).includes(value);
}
