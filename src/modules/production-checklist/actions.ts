"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { productionChecklistItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isProductionStep, isChecklistStatus } from "./guards";

type Result = { success: true; message: string } | { success: false; error: string };

export async function toggleChecklistStep(videoId: number, step: unknown, status: unknown): Promise<Result> {
  if (!isProductionStep(step) || !isChecklistStatus(status)) return { success: false, error: "Invalid step." };
  const db = await getAuthenticatedDb();
  const existing = await db
    .select({ id: productionChecklistItems.id })
    .from(productionChecklistItems)
    .where(and(eq(productionChecklistItems.videoId, videoId), eq(productionChecklistItems.step, step)))
    .limit(1);
  if (existing[0]) {
    await db.update(productionChecklistItems).set({ status, toggledAt: new Date() }).where(eq(productionChecklistItems.id, existing[0].id));
  } else {
    await db.insert(productionChecklistItems).values({ videoId, step, status, toggledAt: new Date() });
  }
  revalidatePath("/lab");
  return { success: true, message: "Saved." };
}

export async function listChecklistForVideo(videoId: number) {
  const db = await getAuthenticatedDb();
  return db.select().from(productionChecklistItems).where(eq(productionChecklistItems.videoId, videoId));
}
