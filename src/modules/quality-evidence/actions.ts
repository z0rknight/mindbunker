"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { qualityEvidence } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { buildQualityEvidenceMediaUrl } from "./core";

export type QualityEvidenceView = {
  id: number;
  type: "IMAGE_COMPARISON" | "AUDIO_COMPARISON";
  label: string;
  visibility: "INTERNAL_ONLY" | "CLIENT_SAFE";
  provenance: string;
  createdAt: string;
  complete: boolean;
  beforeUrl: string | null;
  afterUrl: string | null;
};

export async function getQualityEvidenceForVideo(videoId: number) {
  if (!Number.isSafeInteger(videoId) || videoId <= 0) {
    return { success: false as const, error: "Invalid Video." };
  }
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(qualityEvidence)
    .where(eq(qualityEvidence.videoId, videoId))
    .orderBy(desc(qualityEvidence.createdAt), desc(qualityEvidence.id));
  return {
    success: true as const,
    data: rows.map((row): QualityEvidenceView => ({
      id: row.id,
      type: row.type,
      label: row.label,
      visibility: row.visibility,
      provenance: row.provenance,
      createdAt: row.createdAt.toISOString(),
      complete: Boolean(row.beforeReference && row.afterReference),
      beforeUrl: row.beforeReference
        ? buildQualityEvidenceMediaUrl(row.id, "before", "operator")
        : null,
      afterUrl: row.afterReference
        ? buildQualityEvidenceMediaUrl(row.id, "after", "operator")
        : null,
    })),
  };
}
