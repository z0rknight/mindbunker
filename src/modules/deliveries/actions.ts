"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { deliveries, commitments } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type Result = { success: true; message: string } | { success: false; error: string };

export async function recordDelivery(input: {
  videoId: number;
  deliveryUrl?: string | null;
  note?: string | null;
  commitmentId?: number | null;
}): Promise<Result> {
  if (!Number.isInteger(input.videoId) || input.videoId <= 0) return { success: false, error: "Invalid video." };
  const db = await getAuthenticatedDb();

  const prior = await db.select({ version: deliveries.version }).from(deliveries).where(eq(deliveries.videoId, input.videoId)).orderBy(desc(deliveries.version)).limit(1);
  const nextVersion = (prior[0]?.version ?? 0) + 1;

  await db.insert(deliveries).values({
    videoId: input.videoId,
    commitmentId: input.commitmentId ?? null,
    version: nextVersion,
    deliveryUrl: input.deliveryUrl?.trim() || null,
    note: input.note?.trim() || null,
    status: nextVersion > 1 ? "REDELIVERED" : "DELIVERED",
    actor: "admin",
  });

  if (input.commitmentId) {
    await db.update(commitments).set({ status: "DONE", completedAt: new Date() }).where(eq(commitments.id, input.commitmentId));
  }

  revalidatePath("/lab");
  return { success: true, message: `Delivery v${nextVersion} recorded.` };
}

export async function listDeliveriesForVideo(videoId: number) {
  const db = await getAuthenticatedDb();
  return db.select().from(deliveries).where(eq(deliveries.videoId, videoId)).orderBy(desc(deliveries.version));
}
