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
