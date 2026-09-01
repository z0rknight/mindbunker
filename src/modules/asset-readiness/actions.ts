"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { assetChecklistItems } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isAssetItemType, isAssetStatus } from "./core";
import { logFrictionEvent } from "@/modules/friction/actions";

type Result = { success: true; message: string } | { success: false; error: string };

export async function upsertAssetItem(ownerType: "PROJECT" | "VIDEO", ownerId: number, itemType: unknown, status: unknown, note?: string): Promise<Result> {
  if (!isAssetItemType(itemType) || !isAssetStatus(status)) return { success: false, error: "Invalid item." };
  const db = await getAuthenticatedDb();
  const existing = await db.select({ id: assetChecklistItems.id }).from(assetChecklistItems).where(and(eq(assetChecklistItems.ownerType, ownerType), eq(assetChecklistItems.ownerId, ownerId), eq(assetChecklistItems.itemType, itemType))).limit(1);
  if (existing[0]) {
    await db.update(assetChecklistItems).set({ status, note: note?.trim() || null, updatedAt: new Date() }).where(eq(assetChecklistItems.id, existing[0].id));
  } else {
    await db.insert(assetChecklistItems).values({ ownerType, ownerId, itemType, status, note: note?.trim() || null });
  }
  revalidatePath("/lab");
  return { success: true, message: "Saved." };
}

export async function flagMissingAsset(ownerType: "PROJECT" | "VIDEO", ownerId: number, itemType: unknown): Promise<Result> {
  const result = await upsertAssetItem(ownerType, ownerId, itemType, "MISSING");
  if (!result.success) return result;
  await logFrictionEvent({
    category: "FILES",
    projectId: ownerType === "PROJECT" ? ownerId : undefined,
    videoId: ownerType === "VIDEO" ? ownerId : undefined,
    note: `Missing asset: ${itemType}`,
  });
  return { success: true, message: "Flagged missing, friction logged." };
}

export async function listAssetChecklist(ownerType: "PROJECT" | "VIDEO", ownerId: number) {
  const db = await getAuthenticatedDb();
  return db.select().from(assetChecklistItems).where(and(eq(assetChecklistItems.ownerType, ownerType), eq(assetChecklistItems.ownerId, ownerId))).orderBy(desc(assetChecklistItems.updatedAt));
}
