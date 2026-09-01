"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { projects, videoLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isWaitingOn } from "./core";

type Result = { success: true; message: string } | { success: false; error: string };

export async function setProjectNextAction(projectId: number, nextAction: string | null, waitingOn: unknown): Promise<Result> {
  if (!Number.isInteger(projectId) || projectId <= 0) return { success: false, error: "Invalid project." };
  if (waitingOn !== null && waitingOn !== undefined && !isWaitingOn(waitingOn)) return { success: false, error: "Invalid waiting-on value." };
  const db = await getAuthenticatedDb();
  await db.update(projects).set({ nextAction: nextAction?.trim() || null, waitingOn: (waitingOn as string | null) ?? null }).where(eq(projects.id, projectId));
  revalidatePath("/lab");
  return { success: true, message: "Updated." };
}

export async function setVideoNextAction(videoId: number, nextAction: string | null, waitingOn: unknown): Promise<Result> {
  if (!Number.isInteger(videoId) || videoId <= 0) return { success: false, error: "Invalid video." };
  if (waitingOn !== null && waitingOn !== undefined && !isWaitingOn(waitingOn)) return { success: false, error: "Invalid waiting-on value." };
  const db = await getAuthenticatedDb();
  await db.update(videoLogs).set({ nextAction: nextAction?.trim() || null, waitingOn: (waitingOn as string | null) ?? null }).where(eq(videoLogs.id, videoId));
  revalidatePath("/lab");
  return { success: true, message: "Updated." };
}
