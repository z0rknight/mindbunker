"use server";
import { getAuthenticatedDb } from "@/db";
import { videoLogs, projects, revisions, deliveries } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getVideoEconomics, type VideoEconomics } from "./data";
import { countsTowardRevenue } from "@/modules/video-classification/core";

export type AggregateEconomics = {
  videoCount: number;
  revenueEligibleVideoCount: number;
  sampleOrInternalVideoCount: number;
  deliveredCount: number;
  totalTrackedSeconds: number;
  activityBreakdown: Record<string, number>;
  ourErrorCount: number;
  clientChangeCount: number;
  perVideo: (VideoEconomics & { videoKind: string; title: string | null })[];
};

async function aggregate(videoRows: { id: number; videoKind: string; title: string | null }[]): Promise<AggregateEconomics> {
  const perVideoRaw = await Promise.all(videoRows.map((v) => getVideoEconomics(v.id)));
  const perVideo = perVideoRaw.map((e, i) => ({ ...e, videoKind: videoRows[i].videoKind, title: videoRows[i].title }));

  const videoIds = videoRows.map((v) => v.id);
  const revisionRows = videoIds.length
    ? await (await getAuthenticatedDb()).select({ causedBy: revisions.causedBy }).from(revisions).where(inArray(revisions.videoId, videoIds))
    : [];
  const deliveryRows = videoIds.length
    ? await (await getAuthenticatedDb()).select({ videoId: deliveries.videoId }).from(deliveries).where(inArray(deliveries.videoId, videoIds))
    : [];

  const activityBreakdown: Record<string, number> = {};
  let totalTrackedSeconds = 0;
  let revenueEligible = 0;
  for (const v of perVideo) {
    if (countsTowardRevenue(v.videoKind)) {
      revenueEligible += 1;
      totalTrackedSeconds += v.totalTrackedSeconds;
      for (const [act, secs] of Object.entries(v.activityBreakdown)) {
        activityBreakdown[act] = (activityBreakdown[act] ?? 0) + secs;
      }
    }
  }

  return {
    videoCount: videoRows.length,
    revenueEligibleVideoCount: revenueEligible,
    sampleOrInternalVideoCount: videoRows.length - revenueEligible,
    deliveredCount: new Set(deliveryRows.map((d) => d.videoId)).size,
    totalTrackedSeconds,
    activityBreakdown,
    ourErrorCount: revisionRows.filter((r) => r.causedBy === "OUR_ERROR").length,
    clientChangeCount: revisionRows.filter((r) => r.causedBy === "CLIENT_CHANGE").length,
    perVideo,
  };
}

export async function getProjectEconomics(projectId: number): Promise<AggregateEconomics & { contractType: string | null; fixedPriceCents: number | null }> {
  const db = await getAuthenticatedDb();
  const [proj, videoRows] = await Promise.all([
    db.select({ contractType: projects.contractType, fixedPriceCents: projects.fixedPriceCents }).from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select({ id: videoLogs.id, videoKind: videoLogs.videoKind, title: videoLogs.title }).from(videoLogs).where(eq(videoLogs.projectId, projectId)),
  ]);
  const agg = await aggregate(videoRows);
  return { ...agg, contractType: proj[0]?.contractType ?? null, fixedPriceCents: proj[0]?.fixedPriceCents ?? null };
}

export async function getClientEconomics(clientId: number): Promise<AggregateEconomics> {
  const db = await getAuthenticatedDb();
  const videoRows = await db.select({ id: videoLogs.id, videoKind: videoLogs.videoKind, title: videoLogs.title }).from(videoLogs).where(eq(videoLogs.clientId, clientId));
  return aggregate(videoRows);
}
