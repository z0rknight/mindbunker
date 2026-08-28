// Sprint 3 P1 (Project + Video visual covers): a deliberately tiny helper,
// not an asset pipeline. The three-tier fallback chain is: a Video's own
// coverUrl -> its Project's coverUrl -> the Client's avatar
// (instagramProfilePictureUrl) -> a neutral placeholder rendered locally
// by each surface (an icon, or initials -- e.g. LeadAvatar in
// src/app/crm/page.tsx already does the initials case; this module does
// not reimplement that, it only picks which image URL wins, if any).
//
// No giant image is ever stored here -- every candidate is already just a
// URL column (videoLogs.coverUrl, projects.coverUrl,
// clients.instagramProfilePictureUrl), each already HTTPS-validated at
// its own write path.
export function resolveCoverUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return null;
}

export const COVER_MAX_BYTES = 5 * 1024 * 1024;

export const COVER_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type CoverContentType = (typeof COVER_CONTENT_TYPES)[number];
export type CoverTargetType = "video" | "project";

const EXTENSION_BY_CONTENT_TYPE: Record<CoverContentType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const COVER_OBJECT_KEY = /^covers\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|webp)$/u;
const COVER_ROUTE_PREFIX = "/mindbunker/media/";

export function validateCoverUploadMetadata(input: {
  size: number;
  contentType: string;
}): string | null {
  if (!Number.isSafeInteger(input.size) || input.size <= 0) {
    return "Choose a non-empty image file.";
  }
  if (input.size > COVER_MAX_BYTES) {
    return "Cover image must be 5 MB or smaller.";
  }
  if (!COVER_CONTENT_TYPES.includes(input.contentType as CoverContentType)) {
    return "Cover image must be PNG, JPEG, or WEBP.";
  }
  return null;
}

export function detectCoverContentType(bytes: Uint8Array): CoverContentType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function buildCoverObjectKey(
  contentType: CoverContentType,
  objectId: string,
): string {
  return `covers/${objectId}.${EXTENSION_BY_CONTENT_TYPE[contentType]}`;
}

export function isSafeCoverObjectKey(value: string): boolean {
  return COVER_OBJECT_KEY.test(value);
}

export function buildCoverRoute(objectKey: string): string {
  if (!isSafeCoverObjectKey(objectKey)) {
    throw new Error("Invalid cover object key.");
  }
  return `${COVER_ROUTE_PREFIX}${objectKey}`;
}

export function coverObjectKeyFromRoute(value: string | null): string | null {
  if (!value?.startsWith(COVER_ROUTE_PREFIX)) return null;
  const objectKey = value.slice(COVER_ROUTE_PREFIX.length);
  return isSafeCoverObjectKey(objectKey) ? objectKey : null;
}

export function isInternalCoverRoute(value: string): boolean {
  return coverObjectKeyFromRoute(value) !== null;
}
