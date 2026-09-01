"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { qaEvents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { allChecksPassed, type QaCause } from "./core";

type Result = { success: true; message: string } | { success: false; error: string };

export async function submitQaCheck(
  videoId: number,
  checklist: Record<string, boolean>,
  options?: { overrideReason?: string; causedBy?: QaCause },
): Promise<Result> {
  if (!Number.isInteger(videoId) || videoId <= 0) return { success: false, error: "Invalid video." };
  const passed = allChecksPassed(checklist);
  const db = await getAuthenticatedDb();

  if (!passed && !options?.overrideReason) {
    await db.insert(qaEvents).values({
      videoId,
      result: "FAIL",
      checklist: JSON.stringify(checklist),
      causedBy: options?.causedBy ?? "UNKNOWN",
      actor: "admin",
    });
    revalidatePath("/lab");
    return { success: false, error: "QA failed -- override & deliver, or fix and re-check." };
  }

  const result = passed ? "PASS" : "OVERRIDE";
  if (result === "OVERRIDE" && (!options?.overrideReason || options.overrideReason.trim().length === 0)) {
    return { success: false, error: "Override requires a short reason." };
  }

  await db.insert(qaEvents).values({
    videoId,
    result,
    checklist: JSON.stringify(checklist),
    overrideReason: result === "OVERRIDE" ? options!.overrideReason!.trim() : null,
    causedBy: result === "OVERRIDE" ? (options?.causedBy ?? "UNKNOWN") : null,
    actor: "admin",
  });
  revalidatePath("/lab");
  return { success: true, message: result === "PASS" ? "QA passed." : "Delivered with override." };
}

export async function listQaEventsForVideo(videoId: number) {
  const db = await getAuthenticatedDb();
  return db.select().from(qaEvents).where(eq(qaEvents.videoId, videoId)).orderBy(desc(qaEvents.createdAt));
}
