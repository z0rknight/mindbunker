// Monday Real-Operation Pre-Freeze §3/§4 — pure validation logic for Assets
// and Source Media references. No DB or framework imports (see actions.ts
// for the write path) -- same split as every other module in this repo.

import { isAssetType, isAssetStatus, type AssetType, type AssetStatus } from "./config.ts";

export type ValidationResult<T> =
  | { success: true; value: T }
  | { success: false; error: string };

// Self-contained HTTPS-URL validator (deliberately not imported from
// modules/productivity/core.ts -- assets is its own small module, same
// "no cross-module coupling for a handful of lines" reasoning as
// modules/caffeine/core.ts).
function validateOptionalHttpsUrl(value: unknown, label: string): ValidationResult<string | null> {
  if (value === null || value === undefined || value === "") {
    return { success: true, value: null };
  }
  if (typeof value !== "string") {
    return { success: false, error: `Enter a valid HTTPS ${label}.` };
  }
  const candidate = value.trim();
  if (!candidate) return { success: true, value: null };
  if (candidate.length > 2_048) {
    return { success: false, error: `${label} is too long.` };
  }
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      return { success: false, error: `${label} must use HTTPS.` };
    }
    return { success: true, value: url.toString() };
  } catch {
    return { success: false, error: `Enter a valid HTTPS ${label}.` };
  }
}

export type AssetInput = {
  projectId: number;
  videoId?: number | null;
  name: string;
  type: AssetType;
  status?: AssetStatus;
  reviewUrl?: string | null;
  deliveryUrl?: string | null;
  publishedUrl?: string | null;
  thumbnailUrl?: string | null;
  deliveredAt?: string | null;
  notes?: string | null;
  source?: string | null;
};

// §3 acceptance criterion D ("Asset independence"): videoId is genuinely
// optional here -- the ONLY required relation is projectId. Do not add a
// videoId requirement even for FINAL_DELIVERABLE/CLIENT_REVIEW types; the
// Look Studios ~800GB source ingest is a real, valid asset with no video
// relation at all.
export function validateAssetInput(input: {
  projectId: unknown;
  videoId?: unknown;
  name: unknown;
  type: unknown;
  status?: unknown;
  reviewUrl?: unknown;
  deliveryUrl?: unknown;
  publishedUrl?: unknown;
  thumbnailUrl?: unknown;
  deliveredAt?: unknown;
  notes?: unknown;
  source?: unknown;
}): ValidationResult<AssetInput> {
  if (!Number.isSafeInteger(input.projectId) || (input.projectId as number) <= 0) {
    return { success: false, error: "A project is required for every asset." };
  }
  if (
    input.videoId !== undefined &&
    input.videoId !== null &&
    (!Number.isSafeInteger(input.videoId) || (input.videoId as number) <= 0)
  ) {
    return { success: false, error: "Invalid video reference." };
  }
  if (typeof input.name !== "string" || !input.name.trim()) {
    return { success: false, error: "Asset name is required." };
  }
  if (input.name.trim().length > 200) {
    return { success: false, error: "Asset name is too long." };
  }
  if (!isAssetType(input.type)) {
    return { success: false, error: "Invalid asset type." };
  }
  const status = input.status === undefined ? "DRAFT" : input.status;
  if (!isAssetStatus(status)) {
    return { success: false, error: "Invalid asset status." };
  }

  const reviewUrl = validateOptionalHttpsUrl(input.reviewUrl, "review URL");
  if (!reviewUrl.success) return reviewUrl;
  const deliveryUrl = validateOptionalHttpsUrl(input.deliveryUrl, "delivery URL");
  if (!deliveryUrl.success) return deliveryUrl;
  const publishedUrl = validateOptionalHttpsUrl(input.publishedUrl, "published URL");
  if (!publishedUrl.success) return publishedUrl;
  const thumbnailUrl = validateOptionalHttpsUrl(input.thumbnailUrl, "thumbnail URL");
  if (!thumbnailUrl.success) return thumbnailUrl;

  return {
    success: true,
    value: {
      projectId: input.projectId as number,
      videoId: (input.videoId as number | null | undefined) ?? null,
      name: input.name.trim(),
      type: input.type,
      status,
      reviewUrl: reviewUrl.value,
      deliveryUrl: deliveryUrl.value,
      publishedUrl: publishedUrl.value,
      thumbnailUrl: thumbnailUrl.value,
      deliveredAt:
        typeof input.deliveredAt === "string" && input.deliveredAt.trim()
          ? input.deliveredAt.trim()
          : null,
      notes: typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : null,
      source: typeof input.source === "string" && input.source.trim() ? input.source.trim() : null,
    },
  };
}

export type SourceMediaReferenceInput = {
  projectId: number;
  approxSizeLabel: string | null;
  sourceUrl: string | null;
  location: string | null;
  profile: string | null;
  notes: string | null;
};

// §4: approxSizeLabel is ALWAYS a free-text label ("~800 GB"), never
// coerced into a number -- an estimate must not silently become false
// precision. This function does not even attempt to parse it as a
// quantity.
export function validateSourceMediaReferenceInput(input: {
  projectId: unknown;
  approxSizeLabel?: unknown;
  sourceUrl?: unknown;
  location?: unknown;
  profile?: unknown;
  notes?: unknown;
}): ValidationResult<SourceMediaReferenceInput> {
  if (!Number.isSafeInteger(input.projectId) || (input.projectId as number) <= 0) {
    return { success: false, error: "A project is required for a source media reference." };
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  // §9: the actual client-provided source link (e.g. the Dropbox share
  // Taryn sent for the ~800GB LOG originals) -- same HTTPS-only
  // discipline as asset URLs, provider-agnostic.
  const sourceUrl = validateOptionalHttpsUrl(input.sourceUrl, "source URL");
  if (!sourceUrl.success) return sourceUrl;

  return {
    success: true,
    value: {
      projectId: input.projectId as number,
      approxSizeLabel: str(input.approxSizeLabel),
      sourceUrl: sourceUrl.value,
      location: str(input.location),
      profile: str(input.profile),
      notes: str(input.notes),
    },
  };
}
