"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { workSessions, videoLogs, clients, projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { stopWorkSessionAt } from "@/modules/work-sessions/actions";

type Result = { success: true; message: string } | { success: false; error: string };

export async function markSessionInvalid(sessionId: number, reason: string): Promise<Result> {
  if (!Number.isInteger(sessionId) || sessionId <= 0) return { success: false, error: "Invalid session." };
  if (!reason?.trim()) return { success: false, error: "A short reason is required (soft invalidation, not deletion)." };
  const db = await getAuthenticatedDb();
  await db.update(workSessions).set({ integrityState: "INVALID", note: reason.trim(), updatedAt: new Date() }).where(eq(workSessions.id, sessionId));
  revalidatePath("/lab");
  return { success: true, message: "Marked invalid (soft -- row kept, excluded from economics)." };
}

// SPLIT: closes the session at the split point, opens a new one for the
// remainder (same video/activity by default -- the operator corrects
// further via the existing correctWorkSession if the split point wasn't
// exactly right). Deliberately simple, per the "reasonably small" scope note.
export async function splitWorkSession(sessionId: number, splitAtIso: string): Promise<Result> {
  if (!Number.isInteger(sessionId) || sessionId <= 0) return { success: false, error: "Invalid session." };
  const db = await getAuthenticatedDb();
  const existing = await db.select().from(workSessions).where(eq(workSessions.id, sessionId)).limit(1);
  const row = existing[0];
  if (!row) return { success: false, error: "Session not found." };
  if (!row.endedAt) return { success: false, error: "Stop the session before splitting it." };
  const splitAt = new Date(splitAtIso);
  if (Number.isNaN(splitAt.getTime()) || splitAt <= row.startedAt || splitAt >= row.endedAt) {
    return { success: false, error: "Split time must be strictly between the session's start and end." };
  }
  const originalEnd = row.endedAt;
  await db.update(workSessions).set({ endedAt: splitAt, integrityState: "CORRECTED", updatedAt: new Date() }).where(eq(workSessions.id, sessionId));
  await db.insert(workSessions).values({
    videoId: row.videoId,
    startedAt: splitAt,
    endedAt: originalEnd,
    activityType: row.activityType,
    note: "Split from session #" + sessionId,
    source: row.source,
    integrityState: "CORRECTED",
    splitFromSessionId: sessionId,
  });
  revalidatePath("/lab");
  return { success: true, message: "Session split into two." };
}

export async function listRepairableSessions(limit = 40) {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: workSessions.id,
      startedAt: workSessions.startedAt,
      endedAt: workSessions.endedAt,
      activityType: workSessions.activityType,
      source: workSessions.source,
      integrityState: workSessions.integrityState,
      videoId: workSessions.videoId,
      videoTitle: videoLogs.title,
      clientName: clients.name,
      projectName: projects.name,
    })
    .from(workSessions)
    .leftJoin(videoLogs, eq(videoLogs.id, workSessions.videoId))
    .leftJoin(clients, eq(clients.id, videoLogs.clientId))
    .leftJoin(projects, eq(projects.id, videoLogs.projectId))
    .orderBy(desc(workSessions.startedAt))
    .limit(limit);
  return rows;
}

export async function closeStaleSession(sessionId: number, endedAtIso: string) {
  const db = await getAuthenticatedDb();
  const row = (await db.select({ videoId: workSessions.videoId }).from(workSessions).where(eq(workSessions.id, sessionId)).limit(1))[0];
  if (!row) return { success: false, error: "Session not found." };
  const result = await stopWorkSessionAt(row.videoId, endedAtIso);
  if (result.success) {
    await db.update(workSessions).set({ integrityState: "CORRECTED" }).where(eq(workSessions.id, sessionId));
    revalidatePath("/lab");
  }
  return result;
}

