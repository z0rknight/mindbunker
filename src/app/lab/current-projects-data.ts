import "server-only";
import { getAuthenticatedDb } from "@/db";
import { clients, projects, videoLogs, workSessions, blockers as blockersTable, frictionEvents } from "@/db/schema";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { getLifecycleState } from "@/modules/video-lifecycle/actions";
import { listQaEventsForVideo } from "@/modules/qa-gate/actions";
import { listDeliveriesForVideo } from "@/modules/deliveries/actions";
import { listCommitmentsForOwner } from "@/modules/commitments/data";
import { resolveCoverUrl } from "@/modules/media/core";
import { resolveVideoTags } from "@/modules/tags/core";

// Wave 4C: Current Projects desktop board -- Client -> Project -> Videos,
// each video annotated with just enough state to answer "what needs
// attention" without opening the Workbench. Reuses every underlying read
// (lifecycle, QA, deliveries, commitments, cover fallback chain) rather
// than re-deriving any of it.
export async function getCurrentProjectsBoard() {
  const db = await getAuthenticatedDb();

  const clientRows = await db.select().from(clients).where(eq(clients.status, "active")).orderBy(clients.name);
  const projectRows = await db.select().from(projects);
  const videoRows = await db.select().from(videoLogs).where(isNull(videoLogs.ideaStage)).orderBy(desc(videoLogs.createdAt));

  const videosByProject = new Map<number, typeof videoRows>();
  for (const v of videoRows) {
    if (!v.projectId) continue;
    const arr = videosByProject.get(v.projectId) ?? [];
    arr.push(v);
    videosByProject.set(v.projectId, arr);
  }

  const enrichedVideos = await Promise.all(
    videoRows.map(async (v) => {
      const [lifecycle, qa, deliveries, commitments, trackedSecondsRow, openBlockerRow, frictionCountRow] = await Promise.all([
        getLifecycleState(v.id),
        listQaEventsForVideo(v.id),
        listDeliveriesForVideo(v.id),
        listCommitmentsForOwner("VIDEO", v.id),
        db.select({ videoId: workSessions.videoId }).from(workSessions).where(and(eq(workSessions.videoId, v.id), ne(workSessions.integrityState, "INVALID"))),
        db.select({ id: blockersTable.id }).from(blockersTable).where(and(eq(blockersTable.ownerType, "VIDEO"), eq(blockersTable.ownerId, v.id), isNull(blockersTable.resolvedAt))).limit(1),
        db.select({ id: frictionEvents.id }).from(frictionEvents).where(eq(frictionEvents.videoId, v.id)),
      ]);
      const project = v.projectId ? projectRows.find((p) => p.id === v.projectId) : null;
      const client = clientRows.find((c) => c.id === v.clientId);
      return {
        id: v.id,
        title: v.title ?? `Untitled video #${v.id}`,
        projectId: v.projectId,
        clientId: v.clientId,
        coverUrl: resolveCoverUrl(v.coverUrl, project?.coverUrl, null),
        tags: resolveVideoTags(project?.tags ?? null, v.tagsOverride),
        videoKind: v.videoKind,
        lifecycleStage: lifecycle.currentStage ?? null,
        nextAction: v.nextAction,
        waitingOn: v.waitingOn,
        openCommitment: commitments.find((c) => c.status === "OPEN") ?? null,
        trackedSessionCount: trackedSecondsRow.length,
        lastQaResult: qa[0]?.result ?? null,
        lastDelivery: deliveries[0] ?? null,
        hasOpenBlocker: openBlockerRow.length > 0,
        frictionCount: frictionCountRow.length,
        publishedUrl: v.publishedUrl,
      };
    }),
  );

  const board = clientRows.map((c) => ({
    client: c,
    projects: projectRows
      .filter((p) => p.clientId === c.id)
      .map((p) => ({
        project: p,
        videos: enrichedVideos.filter((v) => v.projectId === p.id),
      })),
  }));

  return board;
}
