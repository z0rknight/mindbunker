"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { blockers } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isBlockerCategory } from "./core";

type Result = { success: true; message: string } | { success: false; error: string };

export async function openBlocker(input: { category: unknown; ownerType: "CLIENT" | "PROJECT" | "VIDEO"; ownerId: number; note?: string }): Promise<Result> {
  if (!isBlockerCategory(input.category)) return { success: false, error: "Invalid category." };
  if (!Number.isInteger(input.ownerId) || input.ownerId <= 0) return { success: false, error: "Invalid owner." };
  const db = await getAuthenticatedDb();
  await db.insert(blockers).values({ category: input.category, ownerType: input.ownerType, ownerId: input.ownerId, note: input.note?.trim() || null, actor: "admin" });
  revalidatePath("/lab");
  return { success: true, message: "Blocker opened." };
}

export async function resolveBlocker(id: number): Promise<Result> {
  if (!Number.isInteger(id) || id <= 0) return { success: false, error: "Invalid blocker." };
  const db = await getAuthenticatedDb();
  await db.update(blockers).set({ resolvedAt: new Date() }).where(eq(blockers.id, id));
  revalidatePath("/lab");
  return { success: true, message: "Blocker resolved." };
}

export async function listBlockers(limit = 40) {
  const db = await getAuthenticatedDb();
  return db.select().from(blockers).orderBy(desc(blockers.startedAt)).limit(limit);
}

export async function listOpenBlockers() {
  const db = await getAuthenticatedDb();
  return db.select().from(blockers).where(isNull(blockers.resolvedAt)).orderBy(desc(blockers.startedAt));
}
