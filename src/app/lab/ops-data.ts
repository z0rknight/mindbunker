import "server-only";
import { getAuthenticatedDb } from "@/db";
import { commitments, workSessions, videoLogs, projects, deliveries, qaEvents, revisions, blockers } from "@/db/schema";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { getLastNightState } from "@/modules/daily-state/actions";
import { listOpenBlockers } from "@/modules/blockers/actions";
import { isCommitmentOverdue } from "@/modules/commitments/core";
import { STALE_SESSION_WARNING_SECONDS } from "@/modules/work-sessions/core";

// Wave 3M: Morning Brief. Facts only, no motivational text, no score.
export async function getMorningBrief() {
  const db = await getAuthenticatedDb();
  const now = new Date();
  const [openCommitments, openBlockers, lastNight, openSessionRows] = await Promise.all([
    db.select().from(commitments).where(eq(commitments.status, "OPEN")),
    listOpenBlockers(),
    getLastNightState(),
    db.select().from(workSessions).where(isNull(workSessions.endedAt)),
  ]);
  const overdue = openCommitments.filter((c) => isCommitmentOverdue(c, now));
  const staleSessions = openSessionRows.filter((s) => (now.getTime() - s.startedAt.getTime()) / 1000 >= STALE_SESSION_WARNING_SECONDS);

  return {
    dueOrOverdueCommitments: openCommitments.filter((c) => c.dueAt !== null),
    overdueCount: overdue.length,
    openBlockers,
    staleSessionCount: staleSessions.length,
    lastNightSleepHours: lastNight?.sleepHours ?? null,
    lastNightEnergy: lastNight?.energy ?? null,
  };
}

// Wave 3N: End of Day Close.
export async function getEndOfDayClose() {
  const db = await getAuthenticatedDb();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [sessionsToday, deliveriesToday, qaToday, frictionRevisionsToday, commitmentsCompletedToday, openSessionRows] = await Promise.all([
    db.select().from(workSessions).where(gte(workSessions.startedAt, todayStart)),
    db.select().from(deliveries).where(gte(deliveries.deliveredAt, todayStart)),
    db.select().from(qaEvents).where(gte(qaEvents.createdAt, todayStart)),
    db.select().from(revisions).where(gte(revisions.createdAt, todayStart)),
    db.select().from(commitments).where(and(eq(commitments.status, "DONE"), gte(commitments.completedAt, todayStart))),
    db.select().from(workSessions).where(isNull(workSessions.endedAt)),
  ]);
  const trackedSeconds = sessionsToday.filter((s) => s.endedAt).reduce((acc, s) => acc + (s.endedAt!.getTime() - s.startedAt.getTime()) / 1000, 0);
  const videosProgressed = new Set(sessionsToday.map((s) => s.videoId)).size;

  return {
    trackedSeconds,
    videosProgressed,
    deliveriesToday: deliveriesToday.length,
    qaEventsToday: qaToday.length,
    frictionOrRevisionsToday: frictionRevisionsToday.length,
    commitmentsCompletedToday: commitmentsCompletedToday.length,
    openStaleSession: openSessionRows.length > 0,
  };
}

// Wave 3O: Weekly Factory Report.
export async function getWeeklyFactoryReport() {
  const db = await getAuthenticatedDb();
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [deliveredVideos, sessionsWeek, revisionsWeek, commitmentsWeek, blockersWeek] = await Promise.all([
    db.select().from(videoLogs).where(eq(videoLogs.status, "DONE")),
    db.select().from(workSessions).where(gte(workSessions.startedAt, weekAgo)),
    db.select().from(revisions).where(gte(revisions.createdAt, weekAgo)),
    db.select().from(commitments).where(gte(commitments.createdAt, weekAgo)),
    db.select().from(blockers).where(gte(blockers.startedAt, weekAgo)),
  ]);
  const closedWeek = sessionsWeek.filter((s) => s.endedAt);
  const trackedSeconds = closedWeek.reduce((acc, s) => acc + (s.endedAt!.getTime() - s.startedAt.getTime()) / 1000, 0);
  const ourError = revisionsWeek.filter((r) => r.causedBy === "OUR_ERROR").length;
  const clientChange = revisionsWeek.filter((r) => r.causedBy === "CLIENT_CHANGE").length;
  const met = commitmentsWeek.filter((c) => c.status === "DONE").length;
  const missed = commitmentsWeek.filter((c) => c.status === "OPEN" && isCommitmentOverdue(c as never)).length;

  return {
    deliveredVideoCount: deliveredVideos.length,
    trackedSeconds,
    sessionSampleCount: closedWeek.length,
    ourError,
    clientChange,
    commitmentsMet: met,
    commitmentsMissed: missed,
    commitmentSampleCount: commitmentsWeek.length,
    blockerCount: blockersWeek.length,
  };
}

// Wave 3P: Capacity Pressure -- transparent rule, not prediction.
export async function getCapacityPressure() {
  const db = await getAuthenticatedDb();
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);
  const [dueSoon, waitingOnMeVideos, waitingOnMeProjects, openSessionRows] = await Promise.all([
    db.select().from(commitments).where(and(eq(commitments.status, "OPEN"), lt(commitments.dueAt, in48h))),
    db.select({ id: videoLogs.id }).from(videoLogs).where(eq(videoLogs.waitingOn, "ME")),
    db.select({ id: projects.id }).from(projects).where(eq(projects.waitingOn, "ME")),
    db.select().from(workSessions).where(isNull(workSessions.endedAt)),
  ]);
  const waitingOnMeCount = waitingOnMeVideos.length + waitingOnMeProjects.length;
  const staleOpen = openSessionRows.filter((s) => (now.getTime() - s.startedAt.getTime()) / 1000 >= STALE_SESSION_WARNING_SECONDS);
  const reasons: string[] = [];
  let score = 0;
  if (dueSoon.length >= 3) { score += 2; reasons.push(`${dueSoon.length} commitments due in 48h`); }
  else if (dueSoon.length >= 1) { score += 1; reasons.push(`${dueSoon.length} commitment(s) due in 48h`); }
  if (waitingOnMeCount >= 2) { score += 2; reasons.push(`${waitingOnMeCount} item(s) waiting on ME`); }
  else if (waitingOnMeCount >= 1) { score += 1; reasons.push(`${waitingOnMeCount} item waiting on ME`); }
  if (staleOpen.length >= 1) { score += 1; reasons.push(`${staleOpen.length} stale work session`); }

  const level = score >= 4 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";
  return { level, score, reasons };
}

