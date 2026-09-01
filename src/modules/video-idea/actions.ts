"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { videoLogs } from "@/db/schema";
import { desc, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createVideoLog } from "@/modules/productivity/actions";
import { nextIdeaStage, type IdeaStage } from "./core";

type Result = { success: true; message: string; videoId?: number } | { success: false; error: string };

// Reuses the canonical, validated createVideoLog write path -- per
// instruction ("use existing Video model if possible") -- rather than a
// hand-rolled insert. status stays PLANNED and delivered stays false
// (deliveredForVideoStatus's existing PLANNED behavior), the least
// disruptive representation already available in the canonical status
// vocabulary. ideaStage/pitch/intendedFormat are then attached in a
// follow-up update, since createVideoLog's input type has no idea-specific
// fields.
export async function createVideoIdea(input: {
  title: string;
  clientId: number;
  projectId?: number | null;
  pitch?: string;
  intendedFormat?: string;
}): Promise<Result> {
  const created = await createVideoLog({
    title: input.title,
    clientId: input.clientId,
    projectId: input.projectId ?? null,
    status: "PLANNED",
  } as never);
  if (!created.success || !("videoId" in created) || !created.videoId) {
    return { success: false, error: ("error" in created && created.error) || "Could not create idea." };
  }
  const videoId = created.videoId;

  const db = await getAuthenticatedDb();
  await db
    .update(videoLogs)
    .set({ ideaStage: "IDEA", pitch: input.pitch?.trim() || null, intendedFormat: input.intendedFormat?.trim() || null, updatedAt: new Date() })
    .where(eq(videoLogs.id, videoId));

  revalidatePath("/lab");
  return { success: true, message: "Idea captured.", videoId };
}

export async function advanceIdeaStage(videoId: number): Promise<Result> {
  const db = await getAuthenticatedDb();
  const row = await db.select({ ideaStage: videoLogs.ideaStage }).from(videoLogs).where(eq(videoLogs.id, videoId)).limit(1);
  if (!row[0]?.ideaStage) return { success: false, error: "This video is not an idea in flight." };
  const next = nextIdeaStage(row[0].ideaStage as IdeaStage);
  if (!next) return { success: false, error: "Already APPROVED -- use approveIdea to convert it to a normal production video." };
  await db.update(videoLogs).set({ ideaStage: next, updatedAt: new Date() }).where(eq(videoLogs.id, videoId));
  revalidatePath("/lab");
  return { success: true, message: `Advanced to ${next}.` };
}

// Approving simply clears ideaStage back to null -- the row was already a
// real video_logs row (status PLANNED) the whole time, so "becoming a
// normal production video" needs no conversion step, just dropping the
// idea-tracking flag.
export async function approveIdea(videoId: number): Promise<Result> {
  const db = await getAuthenticatedDb();
  await db.update(videoLogs).set({ ideaStage: null, updatedAt: new Date() }).where(eq(videoLogs.id, videoId));
  revalidatePath("/lab");
  return { success: true, message: "Approved -- now a normal production video." };
}

export async function listVideoIdeas() {
  const db = await getAuthenticatedDb();
  return db.select().from(videoLogs).where(isNotNull(videoLogs.ideaStage)).orderBy(desc(videoLogs.createdAt));
}
