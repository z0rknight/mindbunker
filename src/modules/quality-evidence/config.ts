export const QUALITY_EVIDENCE_TYPES = [
  "IMAGE_COMPARISON",
  "AUDIO_COMPARISON",
] as const;

export type QualityEvidenceType = (typeof QUALITY_EVIDENCE_TYPES)[number];

export const QUALITY_EVIDENCE_VISIBILITIES = [
  "INTERNAL_ONLY",
  "CLIENT_SAFE",
] as const;

export type QualityEvidenceVisibility = (typeof QUALITY_EVIDENCE_VISIBILITIES)[number];

export const QUALITY_EVIDENCE_TYPE_LABELS: Record<QualityEvidenceType, string> = {
  IMAGE_COMPARISON: "Image before / after",
  AUDIO_COMPARISON: "Audio A / B",
};

export const QUALITY_EVIDENCE_VISIBILITY_LABELS: Record<QualityEvidenceVisibility, string> = {
  INTERNAL_ONLY: "Internal only",
  CLIENT_SAFE: "Client safe",
};
