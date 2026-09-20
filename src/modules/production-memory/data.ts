import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clientProductionMemory, videoLogs } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import type { ProductionMemoryStatus } from "./config";

// Operator-only read: getAuthenticatedDb() requires the operator session, and
// nothing under src/modules/client-portal imports this module (pinned by
// production-memory.integration.test.mjs). The client owns these rows; the
// Project and Production Order pages call this with their own clientId, so a
// format is read in place and never copied into batch or video rows.

export type ProductionMemoryRecord = {
  id: number;
  clientId: number;
  name: string;
  useCase: string | null;
  status: ProductionMemoryStatus | null;
  approvalEvidence: string | null;
  preferenceNotes: string | null;
  recipeNotes: string | null;
  templateLocation: string | null;
  referenceUrl: string | null;
  referenceVideo: { id: number; title: string | null; href: string | null } | null;
};

export async function getProductionMemoryForClient(clientId: number): Promise<ProductionMemoryRecord[]> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: clientProductionMemory.id,
      clientId: clientProductionMemory.clientId,
      name: clientProductionMemory.name,
      useCase: clientProductionMemory.useCase,
      status: clientProductionMemory.status,
      approvalEvidence: clientProductionMemory.approvalEvidence,
      preferenceNotes: clientProductionMemory.preferenceNotes,
      recipeNotes: clientProductionMemory.recipeNotes,
      templateLocation: clientProductionMemory.templateLocation,
      referenceUrl: clientProductionMemory.referenceUrl,
      videoId: videoLogs.id,
      videoTitle: videoLogs.title,
      videoPublishedUrl: videoLogs.publishedUrl,
      videoDeliveryUrl: videoLogs.deliveryUrl,
      videoReviewUrl: videoLogs.reviewUrl,
    })
    .from(clientProductionMemory)
    .leftJoin(videoLogs, eq(videoLogs.id, clientProductionMemory.referenceVideoId))
    .where(eq(clientProductionMemory.clientId, clientId))
    .orderBy(asc(clientProductionMemory.name));

  return rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    useCase: row.useCase,
    status: row.status,
    approvalEvidence: row.approvalEvidence,
    preferenceNotes: row.preferenceNotes,
    recipeNotes: row.recipeNotes,
    templateLocation: row.templateLocation,
    referenceUrl: row.referenceUrl,
    // The example's link is DERIVED from the video, never stored twice.
    referenceVideo:
      row.videoId === null
        ? null
        : {
            id: row.videoId,
            title: row.videoTitle,
            href: row.videoPublishedUrl ?? row.videoDeliveryUrl ?? row.videoReviewUrl ?? null,
          },
  }));
}

export type ReferenceVideoOption = { id: number; title: string };

// Candidate example videos for the editor: this client's real deliverables
// only (never operational containers), newest first.
export async function getReferenceVideoOptions(clientId: number): Promise<ReferenceVideoOption[]> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ id: videoLogs.id, title: videoLogs.title, date: videoLogs.date })
    .from(videoLogs)
    .where(and(eq(videoLogs.clientId, clientId), eq(videoLogs.isOperationalContainer, false)))
    .orderBy(desc(videoLogs.date), desc(videoLogs.id))
    .limit(200);
  return rows.map((row) => ({ id: row.id, title: row.title ?? `Video #${row.id}` }));
}
