// Wave 3E: Input Readiness. Not a DAM -- one checklist row per required
// asset type, per Project or Video.
export const ASSET_ITEM_TYPES = ["A_ROLL", "B_ROLL", "LOGO", "MUSIC", "BRAND_GUIDE", "TRANSCRIPT", "OTHER"] as const;
export type AssetItemType = (typeof ASSET_ITEM_TYPES)[number];
export const ASSET_STATUSES = ["MISSING", "ARRIVING", "READY", "NOT_REQUIRED"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export function isAssetItemType(v: unknown): v is AssetItemType {
  return typeof v === "string" && (ASSET_ITEM_TYPES as readonly string[]).includes(v);
}
export function isAssetStatus(v: unknown): v is AssetStatus {
  return typeof v === "string" && (ASSET_STATUSES as readonly string[]).includes(v);
}

export function isReadyToProduce(items: { status: AssetStatus }[]): boolean {
  if (items.length === 0) return false; // no checklist yet -- honestly unknown, not "ready"
  return items.every((i) => i.status === "READY" || i.status === "NOT_REQUIRED");
}
