import "server-only";

import { getDb } from "@/db";
import { projects, qualityEvidence, videoLogs } from "@/db/schema";
import { canonicalClientId, operationalClientIdsForCanonical } from "@/lib/client-identity";
import { and, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { buildQualityEvidenceMediaUrl } from "./core";
import type { QualityEvidenceView } from "./actions";

export async function getClientQualityEvidenceForVideo(
  authenticatedClientId: number,
  videoId: number,
): Promise<QualityEvidenceView[]> {
  const canonicalId = canonicalClientId(authenticatedClientId);
  const clientScope = operationalClientIdsForCanonical(canonicalId);
  const db = await getDb();
  const rows = await db
    .select({
      id: qualityEvidence.id,
      type: qualityEvidence.type,
      label: qualityEvidence.label,
      visibility: qualityEvidence.visibility,
      provenance: qualityEvidence.provenance,
      createdAt: qualityEvidence.createdAt,
      beforeReference: qualityEvidence.beforeReference,
      afterReference: qualityEvidence.afterReference,
    })
    .from(qualityEvidence)
    .innerJoin(videoLogs, eq(qualityEvidence.videoId, videoLogs.id))
    .innerJoin(projects, eq(videoLogs.projectId, projects.id))
    .where(and(
      eq(qualityEvidence.videoId, videoId),
      eq(qualityEvidence.visibility, "CLIENT_SAFE"),
      isNotNull(qualityEvidence.beforeReference),
      isNotNull(qualityEvidence.afterReference),
      inArray(videoLogs.clientId, clientScope),
      inArray(projects.clientId, clientScope),
      eq(videoLogs.visibleToClient, true),
      eq(projects.visibleToClient, true),
      ne(projects.status, "archived"),
      eq(videoLogs.isOperationalContainer, false),
      isNull(videoLogs.cancelledAt),
    ))
    .orderBy(desc(qualityEvidence.createdAt), desc(qualityEvidence.id));

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    label: row.label,
    visibility: row.visibility,
    provenance: "client-safe",
    createdAt: row.createdAt.toISOString(),
    complete: true,
    beforeUrl: buildQualityEvidenceMediaUrl(row.id, "before", "client"),
    afterUrl: buildQualityEvidenceMediaUrl(row.id, "after", "client"),
  }));
}
