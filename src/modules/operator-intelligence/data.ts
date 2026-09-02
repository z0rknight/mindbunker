import "server-only";

import { getAuthenticatedDb } from "@/db";
import { blockers, clients, commitments, projects, videoLogs, workSessions } from "@/db/schema";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { rankDashboardAttention, type AttentionCandidate } from "./core";

export type RecentCurrentTarget = {
  videoId: number;
  status: "IN_PROGRESS";
  videoTitle: string;
  clientName: string | null;
  projectName: string | null;
  lastWorkedAt: string;
};

export async function getDashboardOperatorIntelligence() {
  const db = await getAuthenticatedDb();
  const [commitmentRows, blockerRows, lifecycleRows, recentRows] = await Promise.all([
    db
      .select({
        sourceId: commitments.id,
        videoId: commitments.videoId,
        title: commitments.title,
        dueAt: commitments.dueAt,
        createdAt: commitments.createdAt,
        videoTitle: videoLogs.title,
        videoDate: videoLogs.date,
        clientName: clients.name,
        projectName: projects.name,
      })
      .from(commitments)
      .innerJoin(videoLogs, eq(videoLogs.id, commitments.videoId))
      .leftJoin(projects, eq(projects.id, videoLogs.projectId))
      .leftJoin(clients, eq(clients.id, videoLogs.clientId))
      .where(eq(commitments.status, "OPEN")),
    db
      .select({
        sourceId: blockers.id,
        videoId: blockers.videoId,
        note: blockers.note,
        category: blockers.category,
        createdAt: blockers.startedAt,
        videoTitle: videoLogs.title,
        videoDate: videoLogs.date,
        clientName: clients.name,
        projectName: projects.name,
      })
      .from(blockers)
      .innerJoin(videoLogs, eq(videoLogs.id, blockers.videoId))
      .leftJoin(projects, eq(projects.id, videoLogs.projectId))
      .leftJoin(clients, eq(clients.id, videoLogs.clientId))
      .where(isNull(blockers.resolvedAt)),
    db
      .select({
        sourceId: videoLogs.id,
        videoId: videoLogs.id,
        status: videoLogs.status,
        title: videoLogs.title,
        date: videoLogs.date,
        createdAt: videoLogs.updatedAt,
        fallbackCreatedAt: videoLogs.createdAt,
        clientName: clients.name,
        projectName: projects.name,
      })
      .from(videoLogs)
      .leftJoin(projects, eq(projects.id, videoLogs.projectId))
      .leftJoin(clients, eq(clients.id, videoLogs.clientId))
      .where(inArray(videoLogs.status, ["CHANGES_REQUESTED", "READY_FOR_REVIEW"])),
    db
      .select({
        videoId: videoLogs.id,
        videoTitle: videoLogs.title,
        videoDate: videoLogs.date,
        status: videoLogs.status,
        clientName: clients.name,
        projectName: projects.name,
        startedAt: workSessions.startedAt,
      })
      .from(workSessions)
      .innerJoin(videoLogs, eq(videoLogs.id, workSessions.videoId))
      .leftJoin(projects, eq(projects.id, videoLogs.projectId))
      .leftJoin(clients, eq(clients.id, videoLogs.clientId))
      .where(and(isNotNull(workSessions.endedAt), eq(videoLogs.status, "IN_PROGRESS")))
      .orderBy(desc(workSessions.startedAt))
      .limit(30),
  ]);

  const candidates: AttentionCandidate[] = [
    ...commitmentRows.map((row) => ({
      source: "COMMITMENT" as const,
      sourceId: row.sourceId,
      videoId: row.videoId,
      videoTitle: row.videoTitle ?? `Video ${row.videoDate}`,
      clientName: row.clientName,
      projectName: row.projectName,
      title: row.title,
      createdAt: row.createdAt,
      dueAt: row.dueAt,
    })),
    ...blockerRows.map((row) => ({
      source: "BLOCKER" as const,
      sourceId: row.sourceId,
      videoId: row.videoId,
      videoTitle: row.videoTitle ?? `Video ${row.videoDate}`,
      clientName: row.clientName,
      projectName: row.projectName,
      title: row.note?.trim() || `${row.category} blocker`,
      createdAt: row.createdAt,
    })),
    ...lifecycleRows.map((row) => ({
      source: "VIDEO" as const,
      sourceId: row.sourceId,
      videoId: row.videoId,
      videoTitle: row.title ?? `Video ${row.date}`,
      clientName: row.clientName,
      projectName: row.projectName,
      title: row.status === "CHANGES_REQUESTED" ? "Changes requested" : "Ready for review",
      createdAt: row.createdAt ?? row.fallbackCreatedAt ?? new Date(0),
      videoStatus: row.status as "CHANGES_REQUESTED" | "READY_FOR_REVIEW",
    })),
  ];

  const seen = new Set<number>();
  const recentCurrentTargets: RecentCurrentTarget[] = [];
  for (const row of recentRows) {
    if (seen.has(row.videoId)) continue;
    seen.add(row.videoId);
    recentCurrentTargets.push({
      videoId: row.videoId,
      status: "IN_PROGRESS",
      videoTitle: row.videoTitle ?? `Video ${row.videoDate}`,
      clientName: row.clientName,
      projectName: row.projectName,
      lastWorkedAt: row.startedAt.toISOString(),
    });
    if (recentCurrentTargets.length === 2) break;
  }

  return {
    attention: rankDashboardAttention(candidates),
    recentCurrentTargets,
  };
}
