import "server-only";
import { getAuthenticatedDb } from "@/db";
import { workSessions, revisions, videoLogs, projects } from "@/db/schema";
import { and, eq, isNotNull, ne, sql as dsql } from "drizzle-orm";
import { classifyDataCoverage, computeEffectiveRate } from "./core";

export type VideoEconomics = {
  videoId: number;
  totalTrackedSeconds: number;
  closedSessionCount: number;
  staleOrInvalidCount: number;
  activityBreakdown: Record<string, number>;
  revisionsCount: number;
  avoidableQaCount: number;
  dataCoverage: ReturnType<typeof classifyDataCoverage>;
  contractType: "FIXED" | "HOURLY" | null;
  fixedPriceCents: number | null;
  effectiveRatePerHour: number | null;
};

export async function getVideoEconomics(videoId: number): Promise<VideoEconomics> {
  const db = await getAuthenticatedDb();

  const [video, validSessions, allSessions, revisionRows] = await Promise.all([
    db.select({ id: videoLogs.id, projectId: videoLogs.projectId }).from(videoLogs).where(eq(videoLogs.id, videoId)).limit(1),
    db
      .select({
        activityType: workSessions.activityType,
        seconds: dsql<number>`sum(${workSessions.endedAt} - ${workSessions.startedAt})`,
        count: dsql<number>`count(*)`,
      })
      .from(workSessions)
      .where(and(eq(workSessions.videoId, videoId), isNotNull(workSessions.endedAt), ne(workSessions.integrityState, "INVALID")))
      .groupBy(workSessions.activityType),
    // Wave 3D: separately count stale/invalid sessions (any state), which
    // suppress the coverage label even when valid evidence also exists.
    db.select({ id: workSessions.id, endedAt: workSessions.endedAt, integrityState: workSessions.integrityState, startedAt: workSessions.startedAt }).from(workSessions).where(eq(workSessions.videoId, videoId)),
    db.select({ id: revisions.id, causedBy: revisions.causedBy }).from(revisions).where(eq(revisions.videoId, videoId)),
  ]);

  const activityBreakdown: Record<string, number> = {};
  let totalTrackedSeconds = 0;
  let closedSessionCount = 0;
  for (const row of validSessions) {
    activityBreakdown[row.activityType] = row.seconds ?? 0;
    totalTrackedSeconds += row.seconds ?? 0;
    closedSessionCount += row.count ?? 0;
  }

  const staleOrInvalidCount = allSessions.filter((s) => {
    if (s.integrityState === "INVALID") return true;
    if (!s.endedAt) {
      const elapsed = (Date.now() - s.startedAt.getTime()) / 1000;
      return elapsed >= 6 * 60 * 60;
    }
    return s.integrityState === "STALE";
  }).length;

  let contractType: "FIXED" | "HOURLY" | null = null;
  let fixedPriceCents: number | null = null;
  if (video[0]?.projectId) {
    const proj = await db
      .select({ contractType: projects.contractType, fixedPriceCents: projects.fixedPriceCents })
      .from(projects)
      .where(eq(projects.id, video[0].projectId))
      .limit(1);
    contractType = (proj[0]?.contractType as "FIXED" | "HOURLY" | null) ?? null;
    fixedPriceCents = proj[0]?.fixedPriceCents ?? null;
  }

  return {
    videoId,
    totalTrackedSeconds,
    closedSessionCount,
    staleOrInvalidCount,
    activityBreakdown,
    revisionsCount: revisionRows.length,
    avoidableQaCount: revisionRows.filter((r) => r.causedBy === "OUR_ERROR").length,
    dataCoverage: classifyDataCoverage({ validClosedSessionCount: closedSessionCount, totalTrackedSeconds, staleOrInvalidCount }),
    contractType,
    fixedPriceCents,
    effectiveRatePerHour:
      contractType === "FIXED" && fixedPriceCents ? computeEffectiveRate(fixedPriceCents, totalTrackedSeconds) : null,
  };
}
