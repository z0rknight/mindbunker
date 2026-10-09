import {
  QUALITY_EVIDENCE_TYPES,
  QUALITY_EVIDENCE_VISIBILITIES,
  type QualityEvidenceType,
  type QualityEvidenceVisibility,
} from "./config.ts";
import { IS_CLIENT_DEPLOY_TARGET, STATIC_BASE_PATH } from "../../lib/auth-core.ts";

export const QUALITY_EVIDENCE_MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const QUALITY_EVIDENCE_MAX_AUDIO_BYTES = 80 * 1024 * 1024;

export const QUALITY_EVIDENCE_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const QUALITY_EVIDENCE_AUDIO_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
] as const;

export type QualityEvidenceSide = "before" | "after";

const OBJECT_KEY = /^quality-evidence\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|webp|mp3|m4a|wav)$/u;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
};

export function isQualityEvidenceType(value: unknown): value is QualityEvidenceType {
  return QUALITY_EVIDENCE_TYPES.includes(value as QualityEvidenceType);
}

export function isQualityEvidenceVisibility(value: unknown): value is QualityEvidenceVisibility {
  return QUALITY_EVIDENCE_VISIBILITIES.includes(value as QualityEvidenceVisibility);
}

export function isQualityEvidenceSide(value: unknown): value is QualityEvidenceSide {
  return value === "before" || value === "after";
}

export function validateQualityEvidenceInput(input: {
  videoId: unknown;
  type: unknown;
  label: unknown;
  beforeReference?: unknown;
  afterReference?: unknown;
  visibility: unknown;
  provenance?: unknown;
}) {
  const videoId = Number(input.videoId);
  if (!Number.isSafeInteger(videoId) || videoId <= 0) {
    return { success: false as const, error: "Choose a valid Video." };
  }
  if (!isQualityEvidenceType(input.type)) {
    return { success: false as const, error: "Choose image or audio evidence." };
  }
  if (!isQualityEvidenceVisibility(input.visibility)) {
    return { success: false as const, error: "Choose a valid visibility." };
  }
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (!label || label.length > 160) {
    return { success: false as const, error: "Label is required and must be 160 characters or fewer." };
  }
  const beforeReference = cleanReference(input.beforeReference);
  const afterReference = cleanReference(input.afterReference);
  if (beforeReference === false || afterReference === false) {
    return { success: false as const, error: "References must be private uploaded objects or HTTPS URLs." };
  }
  if (!beforeReference && !afterReference) {
    return { success: false as const, error: "Add at least one side of the comparison." };
  }
  const provenance = typeof input.provenance === "string" ? input.provenance.trim() : "";
  if (provenance.length > 500) {
    return { success: false as const, error: "Provenance must be 500 characters or fewer." };
  }
  return {
    success: true as const,
    value: {
      videoId,
      type: input.type,
      label,
      beforeReference,
      afterReference,
      visibility: input.visibility,
      provenance: provenance || "operator:mindbunker-web",
    },
  };
}

function cleanReference(value: unknown): string | null | false {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isQualityEvidenceObjectKey(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && trimmed.length <= 2_048 ? trimmed : false;
  } catch {
    return false;
  }
}

export function validateQualityEvidenceUpload(input: {
  type: QualityEvidenceType;
  size: number;
  contentType: string;
}): string | null {
  if (!Number.isSafeInteger(input.size) || input.size <= 0) return "Choose a non-empty file.";
  const allowed = input.type === "IMAGE_COMPARISON"
    ? QUALITY_EVIDENCE_IMAGE_CONTENT_TYPES
    : QUALITY_EVIDENCE_AUDIO_CONTENT_TYPES;
  const max = input.type === "IMAGE_COMPARISON"
    ? QUALITY_EVIDENCE_MAX_IMAGE_BYTES
    : QUALITY_EVIDENCE_MAX_AUDIO_BYTES;
  if (!(allowed as readonly string[]).includes(input.contentType)) {
    return input.type === "IMAGE_COMPARISON"
      ? "Image evidence must be PNG, JPEG, or WEBP."
      : "Audio evidence must be MP3, M4A, or WAV.";
  }
  if (input.size > max) {
    return `File must be ${Math.round(max / 1024 / 1024)} MB or smaller.`;
  }
  return null;
}

export function detectQualityEvidenceContentType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") return "audio/mp4";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE") return "audio/wav";
  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function buildQualityEvidenceObjectKey(contentType: string, objectId: string) {
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType];
  if (!extension) throw new Error("Unsupported quality-evidence content type.");
  return `quality-evidence/${objectId}.${extension}`;
}

export function isQualityEvidenceObjectKey(value: string) {
  return OBJECT_KEY.test(value);
}

export function isCompleteQualityEvidence(row: {
  beforeReference: string | null;
  afterReference: string | null;
}) {
  return Boolean(row.beforeReference && row.afterReference);
}

export function clampPlaybackPosition(position: number, duration: number) {
  if (!Number.isFinite(position) || position < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return position;
  return Math.min(position, Math.max(0, duration - 0.05));
}

export function buildQualityEvidenceMediaUrl(
  evidenceId: number,
  side: QualityEvidenceSide,
  audience: "operator" | "client",
) {
  const clientApiPrefix = IS_CLIENT_DEPLOY_TARGET
    ? `${STATIC_BASE_PATH}/api`
    : `${STATIC_BASE_PATH}/client/api`;
  const prefix = audience === "client" ? clientApiPrefix : `${STATIC_BASE_PATH}/api`;
  return `${prefix}/quality-evidence/${evidenceId}/media/${side}`;
}
