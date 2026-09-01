"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { videoLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isVideoKind } from "./core";

type Result = { success: true; message: string } | { success: false; error: string };

export async function setVideoKind(videoId: number, kind: unknown): Promise<Result> {
  if (!isVideoKind(kind)) return { success: false, error: "Invalid classification." };
  const db = await getAuthenticatedDb();
  await db.update(videoLogs).set({ videoKind: kind, updatedAt: new Date() }).where(eq(videoLogs.id, videoId));
  revalidatePath("/lab");
  return { success: true, message: "Classification saved." };
}

// Wave 4S support: mark a Sample Video as converted once its lead becomes
// a paying client -- pure record-keeping, no automatic scoring.
export async function markSampleConverted(videoId: number, conversionDateIso: string): Promise<Result> {
  const db = await getAuthenticatedDb();
  await db.update(videoLogs).set({ notes: `Sample converted ${conversionDateIso}`, updatedAt: new Date() }).where(eq(videoLogs.id, videoId));
  revalidatePath("/lab");
  return { success: true, message: "Marked converted." };
}
