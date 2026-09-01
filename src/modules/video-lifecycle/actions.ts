"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { videoLifecycleEvents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isLifecycleStage, computeLifecycleState, type LifecycleEventRow, type LifecycleState } from "./core";

type Result = { success: true; message: string } | { success: false; error: string };

export async function advanceLifecycleStage(videoId: number, stage: unknown, note?: string | null): Promise<Result> {
  if (!Number.isInteger(videoId) || videoId <= 0) return { success: false, error: "Invalid video." };
  if (!isLifecycleStage(stage)) return { success: false, error: "Invalid stage." };
  const db = await getAuthenticatedDb();
  await db.insert(videoLifecycleEvents).values({ videoId, stage, note: note?.trim() || null, actor: "admin" });
  revalidatePath("/lab");
  return { success: true, message: `Moved to ${stage}.` };
}

export async function getLifecycleState(videoId: number): Promise<LifecycleState> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(videoLifecycleEvents)
    .where(eq(videoLifecycleEvents.videoId, videoId))
    .orderBy(desc(videoLifecycleEvents.createdAt));
  return computeLifecycleState(rows as LifecycleEventRow[]);
}
