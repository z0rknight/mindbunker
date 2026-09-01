"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { videoLogs, revisions, workSessions } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getLifecycleState } from "@/modules/video-lifecycle/actions";
import { listQaEventsForVideo } from "@/modules/qa-gate/actions";
import { listFrictionForVideo } from "@/modules/friction/actions";
import { listDeliveriesForVideo } from "@/modules/deliveries/actions";
import { getVideoEconomics } from "@/modules/economics/data";
import { listCommitmentsForOwner } from "@/modules/commitments/data";
import { listAssetChecklist } from "@/modules/asset-readiness/actions";
import { isReadyToProduce } from "@/modules/asset-readiness/core";
import { blockers as blockersTable, projects } from "@/db/schema";
import { getActivityOverlayForRange } from "@/modules/activity-overlay/data";
import { listChecklistForVideo } from "@/modules/production-checklist/actions";
import { resolveVideoTags } from "@/modules/tags/core";
import { resolveCoverUrl } from "@/modules/media/core";

export async function getVideoWorkbenchData(videoId: number) {
  const db = await getAuthenticatedDb();
  const [video, lifecycle, qa, friction, deliveries, economics, commitmentsForVideo, revisionRows, assetChecklist, videoBlockers, checklist] = await Promise.all([
    db.select().from(videoLogs).where(eq(videoLogs.id, videoId)).limit(1),
    getLifecycleState(videoId),
    listQaEventsForVideo(videoId),
    listFrictionForVideo(videoId),
    listDeliveriesForVideo(videoId),
    getVideoEconomics(videoId),
    listCommitmentsForOwner("VIDEO", videoId),
    db.select().from(revisions).where(eq(revisions.videoId, videoId)).orderBy(desc(revisions.createdAt)),
    listAssetChecklist("VIDEO", videoId),
    // Wave 4A fix: this was fetching every VIDEO-owned blocker in the
    // table and filtering client-side -- correct, but wasteful. Filtered
    // at the SQL level now.
    db.select().from(blockersTable).where(and(eq(blockersTable.ownerType, "VIDEO"), eq(blockersTable.ownerId, videoId))),
    listChecklistForVideo(videoId),
  ]);

  // Wave 3B: activity overlay for the video's most recent CLOSED work
  // session range, when one exists -- fixture-derived observations only,
  // never authoritative.
  const allSessions = await db
    .select({ id: workSessions.id, startedAt: workSessions.startedAt, endedAt: workSessions.endedAt, activityType: workSessions.activityType, integrityState: workSessions.integrityState })
    .from(workSessions)
    .where(eq(workSessions.videoId, videoId))
    .orderBy(desc(workSessions.startedAt));
  const lastClosed = allSessions.filter((s) => s.endedAt).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  const activityOverlay = lastClosed?.endedAt ? await getActivityOverlayForRange(lastClosed.startedAt, lastClosed.endedAt) : null;

  const project = video[0]?.projectId
    ? (await db.select({ tags: projects.tags, coverUrl: projects.coverUrl }).from(projects).where(eq(projects.id, video[0].projectId)).limit(1))[0]
    : null;

  return {
    video: video[0] ?? null,
    lifecycle,
    qa,
    friction,
    deliveries,
    economics,
    commitments: commitmentsForVideo,
    revisions: revisionRows,
    assetChecklist,
    readyToProduce: isReadyToProduce(assetChecklist),
    blockers: videoBlockers,
    activityOverlay,
    checklist,
    recentSessions: allSessions.slice(0, 5),
    tags: video[0] ? resolveVideoTags(project?.tags ?? null, video[0].tagsOverride) : [],
    coverUrl: video[0] ? resolveCoverUrl(video[0].coverUrl, project?.coverUrl, null) : null,
  };
}
