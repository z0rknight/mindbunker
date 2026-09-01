"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { ingestionEvents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type Result = { success: true; message: string } | { success: false; error: string };

// Critical distinction (brief's own words): machine time != human work time.
// operatorMinutes and machineMinutes are captured separately, never summed
// into one number.
export async function recordIngestionEvent(input: {
  videoId: number;
  source?: string;
  destination?: string;
  operatorMinutes?: number;
  machineMinutes?: number;
  blockedWork?: boolean;
}): Promise<Result> {
  if (!Number.isInteger(input.videoId) || input.videoId <= 0) return { success: false, error: "Invalid video." };
  const db = await getAuthenticatedDb();
  await db.insert(ingestionEvents).values({
    videoId: input.videoId,
    source: input.source?.trim() || null,
    destination: input.destination?.trim() || null,
    completedAt: new Date(),
    operatorMinutes: input.operatorMinutes ?? null,
    machineMinutes: input.machineMinutes ?? null,
    blockedWork: input.blockedWork ?? false,
  });
  revalidatePath("/lab");
  return { success: true, message: "Ingestion event recorded." };
}

export async function listIngestionEventsForVideo(videoId: number) {
  const db = await getAuthenticatedDb();
  return db.select().from(ingestionEvents).where(eq(ingestionEvents.videoId, videoId)).orderBy(desc(ingestionEvents.startedAt));
}

export async function listRecentIngestionEvents(limit = 20) {
  const db = await getAuthenticatedDb();
  return db.select().from(ingestionEvents).orderBy(desc(ingestionEvents.startedAt)).limit(limit);
}
