import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  clientProductionMemory,
  productionOrders,
  projects,
  sourceMediaReferences,
  videoLogs,
} from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { buildProductionContext, type ContextSourceReference, type ProductionContext } from "./core";

// Operator-only READ. Nothing under src/modules/client-portal imports this
// module (pinned by production-context.integration.test.mjs); no insert /
// update / delete exists here. Batch data is read from the order, video data
// from the video, project data from the project -- never copied between them.

type Db = Awaited<ReturnType<typeof getAuthenticatedDb>>;

async function loadSources(db: Db, projectId: number | null): Promise<ContextSourceReference[]> {
  if (projectId === null) return [];
  return db
    .select({
      id: sourceMediaReferences.id,
      location: sourceMediaReferences.location,
      profile: sourceMediaReferences.profile,
      approxSizeLabel: sourceMediaReferences.approxSizeLabel,
      sourceUrl: sourceMediaReferences.sourceUrl,
      notes: sourceMediaReferences.notes,
    })
    .from(sourceMediaReferences)
    .where(eq(sourceMediaReferences.projectId, projectId))
    .orderBy(asc(sourceMediaReferences.id));
}

async function loadFormatNames(db: Db, clientId: number | null): Promise<string[]> {
  if (clientId === null) return [];
  const rows = await db
    .select({ name: clientProductionMemory.name })
    .from(clientProductionMemory)
    .where(eq(clientProductionMemory.clientId, clientId))
    .orderBy(asc(clientProductionMemory.name));
  return rows.map((row) => row.name);
}

/** Batch-level context for a Production Order page. */
export async function getProductionContextForOrder(orderId: number): Promise<ProductionContext | null> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: productionOrders.id,
      label: productionOrders.label,
      notes: productionOrders.notes,
      clientId: productionOrders.clientId,
      projectId: productionOrders.projectId,
      projectName: projects.name,
      projectNotes: projects.notes,
    })
    .from(productionOrders)
    .innerJoin(projects, eq(projects.id, productionOrders.projectId))
    .where(eq(productionOrders.id, orderId))
    .limit(1);
  const order = rows[0];
  if (!order) return null;
  const [sources, formatNames] = await Promise.all([loadSources(db, order.projectId), loadFormatNames(db, order.clientId)]);
  return buildProductionContext({
    batch: { id: order.id, label: order.label, notes: order.notes },
    project: { id: order.projectId, name: order.projectName, notes: order.projectNotes },
    sources,
    video: null,
    formatNames,
  });
}

export type VideoProductionContext = {
  context: ProductionContext;
  batch: { id: number; label: string } | null;
  project: { id: number; name: string } | null;
};

/** Video-specific facts plus the context it inherits from its batch and project. */
export async function getProductionContextForVideo(videoId: number): Promise<VideoProductionContext | null> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      clientId: videoLogs.clientId,
      projectId: videoLogs.projectId,
      orderId: videoLogs.productionOrderId,
      reviewUrl: videoLogs.reviewUrl,
      deliveryUrl: videoLogs.deliveryUrl,
      publishedUrl: videoLogs.publishedUrl,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  const video = rows[0];
  if (!video) return null;

  const [project, order, sources, formatNames] = await Promise.all([
    video.projectId === null
      ? Promise.resolve(null)
      : db
          .select({ id: projects.id, name: projects.name, notes: projects.notes })
          .from(projects)
          .where(eq(projects.id, video.projectId))
          .limit(1)
          .then((r) => r[0] ?? null),
    video.orderId === null
      ? Promise.resolve(null)
      : db
          .select({ id: productionOrders.id, label: productionOrders.label, notes: productionOrders.notes })
          .from(productionOrders)
          .where(eq(productionOrders.id, video.orderId))
          .limit(1)
          .then((r) => r[0] ?? null),
    loadSources(db, video.projectId),
    loadFormatNames(db, video.clientId),
  ]);

  return {
    context: buildProductionContext({
      batch: order ? { id: order.id, label: order.label, notes: order.notes } : null,
      project,
      sources,
      video: { reviewUrl: video.reviewUrl, deliveryUrl: video.deliveryUrl, publishedUrl: video.publishedUrl },
      formatNames,
    }),
    batch: order ? { id: order.id, label: order.label } : null,
    project: project ? { id: project.id, name: project.name } : null,
  };
}
