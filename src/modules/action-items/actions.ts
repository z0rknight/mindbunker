"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { actionItems } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sortActionItemsByPriority, type ActionPriority } from "./core";

type Result = { success: true; message: string } | { success: false; error: string };

export async function createActionItem(input: {
  title: string;
  priority?: ActionPriority;
  dueAt?: string | null;
  note?: string;
  ownerType?: "CLIENT" | "PROJECT" | "VIDEO";
  ownerId?: number;
}): Promise<Result> {
  if (!input.title?.trim()) return { success: false, error: "Title required." };
  const db = await getAuthenticatedDb();
  await db.insert(actionItems).values({
    title: input.title.trim(),
    priority: input.priority ?? "P2",
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    note: input.note?.trim() || null,
    ownerType: input.ownerType ?? null,
    ownerId: input.ownerId ?? null,
  });
  revalidatePath("/lab");
  return { success: true, message: "Action item created." };
}

// Wave 4O: Capture Inbox -- zero-friction, always P2, always unowned until
// triaged. A thin, deliberately narrower wrapper over createActionItem.
export async function captureToInbox(title: string): Promise<Result> {
  if (!title?.trim()) return { success: false, error: "Nothing to capture." };
  const db = await getAuthenticatedDb();
  await db.insert(actionItems).values({ title: title.trim(), priority: "P2", source: "INBOX" });
  revalidatePath("/lab");
  return { success: true, message: "Captured." };
}

export async function completeActionItem(id: number): Promise<Result> {
  const db = await getAuthenticatedDb();
  await db.update(actionItems).set({ status: "DONE", completedAt: new Date() }).where(eq(actionItems.id, id));
  revalidatePath("/lab");
  return { success: true, message: "Done." };
}

export async function cancelActionItem(id: number): Promise<Result> {
  const db = await getAuthenticatedDb();
  await db.update(actionItems).set({ status: "CANCELLED" }).where(eq(actionItems.id, id));
  revalidatePath("/lab");
  return { success: true, message: "Cancelled." };
}

export async function setActionItemPriority(id: number, priority: ActionPriority): Promise<Result> {
  const db = await getAuthenticatedDb();
  await db.update(actionItems).set({ priority }).where(eq(actionItems.id, id));
  revalidatePath("/lab");
  return { success: true, message: "Priority updated." };
}

export async function classifyActionItem(id: number, ownerType: "CLIENT" | "PROJECT" | "VIDEO", ownerId: number): Promise<Result> {
  const db = await getAuthenticatedDb();
  await db.update(actionItems).set({ ownerType, ownerId }).where(eq(actionItems.id, id));
  revalidatePath("/lab");
  return { success: true, message: "Linked." };
}

export async function listOpenActionItems(limit = 100) {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.status, "OPEN"))
    .orderBy(desc(actionItems.createdAt))
    .limit(limit);
  return sortActionItemsByPriority(rows);
}

export async function listInboxItems() {
  const db = await getAuthenticatedDb();
  return db
    .select()
    .from(actionItems)
    .where(and(eq(actionItems.status, "OPEN"), eq(actionItems.source, "INBOX"), isNull(actionItems.ownerType)))
    .orderBy(desc(actionItems.createdAt));
}
