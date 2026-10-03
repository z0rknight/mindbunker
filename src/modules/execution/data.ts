import "server-only";

import { getAuthenticatedDb } from "@/db";
import { blockers, clients, projects, sensorDevices, videoLogs, workSessions } from "@/db/schema";
import { canonicalClientId, clientWorkMode } from "@/lib/client-identity";
import { entityInspectionHref } from "@/lib/entity-navigation";
import {
  getAllVideoLogs,
  getOpenBlockersByVideo,
  getSoonestOpenCommitmentByVideo,
} from "@/modules/productivity/actions";
import { getVideoNextAction } from "@/modules/productivity/core";
import { selectExecutionQueue } from "@/modules/productivity/queue";
import { isSessionStale } from "@/modules/work-sessions/core";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  explainExecutionRecommendation,
  selectExecutionRecommendation,
  type CurrentExecution,
  type ExecutionClientProjection,
  type ExecutionRecommendation,
} from "./core";

type RecommendationVideos = Awaited<ReturnType<typeof getAllVideoLogs>>;

export type ExecutionRecommendationFacts = {
  videos: RecommendationVideos;
  blockersByVideo: ReadonlyMap<number, string>;
  commitmentsByVideo: ReadonlyMap<number, Date>;
};

async function projectClient(
  operationalId: number | null,
  operationalName: string | null,
): Promise<ExecutionClientProjection | null> {
  if (operationalId === null) return null;
  const canonicalId = canonicalClientId(operationalId);
  let canonicalName = canonicalId === operationalId ? operationalName : null;
  let resolvedOperationalName = operationalName;

  if (!canonicalName || !resolvedOperationalName) {
    const db = await getAuthenticatedDb();
    const ids = canonicalId === operationalId ? [canonicalId] : [operationalId, canonicalId];
    const rows = await Promise.all(ids.map(async (id) => (
      await db.select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(eq(clients.id, id))
        .limit(1)
    )[0] ?? null));
    resolvedOperationalName = resolvedOperationalName ?? rows.find((row) => row?.id === operationalId)?.name ?? `Client ${operationalId}`;
    canonicalName = rows.find((row) => row?.id === canonicalId)?.name ?? resolvedOperationalName;
  }

  return {
    operationalId,
    operationalName: resolvedOperationalName,
    canonicalId,
    canonicalName,
    workMode: clientWorkMode(operationalId),
    href: entityInspectionHref({ type: "client", id: canonicalId }),
  };
}

/** The active Work Session is the only current-execution authority. */
export async function getCurrentExecution(returnTo?: string): Promise<CurrentExecution | null> {
  const db = await getAuthenticatedDb();
  const row = (
    await db
      .select({
        sessionId: workSessions.id,
        startedAt: workSessions.startedAt,
        activityType: workSessions.activityType,
        source: workSessions.source,
        deviceName: sensorDevices.name,
        videoId: videoLogs.id,
        videoTitle: videoLogs.title,
        videoDate: videoLogs.date,
        videoStatus: videoLogs.status,
        videoKind: videoLogs.videoKind,
        videoClientId: videoLogs.clientId,
        videoClientName: clients.name,
        videoProjectId: videoLogs.projectId,
        projectId: projects.id,
        projectName: projects.name,
        projectClientId: projects.clientId,
      })
      .from(workSessions)
      .innerJoin(videoLogs, eq(workSessions.videoId, videoLogs.id))
      .leftJoin(projects, eq(videoLogs.projectId, projects.id))
      .leftJoin(clients, eq(videoLogs.clientId, clients.id))
      .leftJoin(sensorDevices, eq(workSessions.sensorDeviceId, sensorDevices.id))
      .where(isNull(workSessions.endedAt))
      .orderBy(desc(workSessions.id))
      .limit(1)
  )[0] ?? null;

  if (!row) return null;
  const blocker = (
    await db
      .select({ category: blockers.category })
      .from(blockers)
      .where(and(eq(blockers.videoId, row.videoId), isNull(blockers.resolvedAt)))
      .orderBy(asc(blockers.startedAt))
      .limit(1)
  )[0] ?? null;
  const startedAt = row.startedAt.toISOString();
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - row.startedAt.getTime()) / 1_000));
  const operationalClientId = row.videoClientId ?? row.projectClientId ?? null;
  const integrityIssues: string[] = [];
  if (row.videoProjectId !== null && row.projectId === null) integrityIssues.push("Assigned project is missing.");
  if (row.projectId !== null && row.videoClientId !== null && row.projectClientId !== row.videoClientId) {
    integrityIssues.push("Video client does not match project client.");
  }
  if (row.videoKind === "CLIENT_WORK" && (row.projectId === null || operationalClientId === null)) {
    integrityIssues.push("Client work is missing a Project or Client relationship.");
  }

  return {
    sessionId: row.sessionId,
    activityType: row.activityType,
    startedAt,
    elapsedSeconds,
    stale: isSessionStale(elapsedSeconds),
    source: row.source,
    deviceName: row.deviceName,
    sessionHref: entityInspectionHref({ type: "session", id: row.sessionId }),
    nextAction: getVideoNextAction(row.videoStatus),
    blocker,
    video: {
      id: row.videoId,
      title: row.videoTitle ?? `Video ${row.videoDate}`,
      status: row.videoStatus,
      videoKind: row.videoKind,
      href: entityInspectionHref({ type: "video", id: row.videoId }, returnTo),
    },
    project: row.projectId === null
      ? null
      : {
          id: row.projectId,
          name: row.projectName ?? `Project ${row.projectId}`,
          href: entityInspectionHref({ type: "project", id: row.projectId }),
        },
    client: await projectClient(operationalClientId, row.videoClientName),
    ...(integrityIssues.length > 0 ? { integrityIssues } : {}),
  };
}

async function loadRecommendationFacts(): Promise<ExecutionRecommendationFacts> {
  const [videos, blockersByVideo, commitmentsByVideo] = await Promise.all([
    getAllVideoLogs(),
    getOpenBlockersByVideo(),
    getSoonestOpenCommitmentByVideo(),
  ]);
  return { videos, blockersByVideo, commitmentsByVideo };
}

/** One explainable recommendation projection for every operator surface. */
export async function getExecutionRecommendation(
  facts?: ExecutionRecommendationFacts,
  returnTo?: string,
): Promise<ExecutionRecommendation | null> {
  const resolved = facts ?? await loadRecommendationFacts();
  const queue = selectExecutionQueue(resolved.videos, {
    blockedVideoIds: new Set(resolved.blockersByVideo.keys()),
    blockerCategoryByVideoId: resolved.blockersByVideo,
    soonestCommitmentDueAtByVideoId: resolved.commitmentsByVideo,
  });
  const selected = selectExecutionRecommendation(queue);
  if (!selected) return null;
  const deadline = selected.soonestCommitmentDueAt instanceof Date
    ? selected.soonestCommitmentDueAt.toISOString()
    : selected.soonestCommitmentDueAt;

  return {
    videoId: selected.id,
    title: selected.title ?? `Video ${selected.date}`,
    status: selected.status,
    nextAction: getVideoNextAction(selected.status),
    videoHref: entityInspectionHref({ type: "video", id: selected.id }, returnTo),
    project: selected.projectId === null
      ? null
      : {
          id: selected.projectId,
          name: selected.projectName ?? `Project ${selected.projectId}`,
          href: entityInspectionHref({ type: "project", id: selected.projectId }),
        },
    client: await projectClient(selected.clientId, selected.clientName),
    signals: explainExecutionRecommendation(selected),
    deadline,
    blockingState: { isBlocked: false, reason: null },
    provenance: "execution-policy-v1",
  };
}

export async function getExecutionSnapshot(
  returnTo?: string,
  facts?: ExecutionRecommendationFacts,
) {
  const current = await getCurrentExecution(returnTo);
  const recommendation = current
    ? null
    : await getExecutionRecommendation(facts, returnTo);
  return {
    current,
    recommendation,
  };
}
