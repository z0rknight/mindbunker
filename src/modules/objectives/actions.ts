"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { objectives } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type Result = { success: true; message: string } | { success: false; error: string };

export async function createObjective(input: {
  title: string;
  period?: string;
  targetText?: string;
  linkedCommitmentId?: number;
  linkedProjectId?: number;
  linkedClientId?: number;
}): Promise<Result> {
  if (!input.title?.trim()) return { success: false, error: "Title required." };
  const db = await getAuthenticatedDb();
  await db.insert(objectives).values({
    title: input.title.trim(),
    period: input.period?.trim() || null,
    targetText: input.targetText?.trim() || null,
    linkedCommitmentId: input.linkedCommitmentId ?? null,
    linkedProjectId: input.linkedProjectId ?? null,
    linkedClientId: input.linkedClientId ?? null,
  });
  revalidatePath("/lab");
  return { success: true, message: "Objective created." };
}

export async function updateObjectiveCurrentText(id: number, currentText: string): Promise<Result> {
  const db = await getAuthenticatedDb();
  await db.update(objectives).set({ currentText: currentText.trim() || null }).where(eq(objectives.id, id));
  revalidatePath("/lab");
  return { success: true, message: "Updated." };
}

export async function setObjectiveStatus(id: number, status: "ACTIVE" | "DONE" | "DROPPED"): Promise<Result> {
  const db = await getAuthenticatedDb();
  await db.update(objectives).set({ status }).where(eq(objectives.id, id));
  revalidatePath("/lab");
  return { success: true, message: "Status updated." };
}

export async function listObjectives() {
  const db = await getAuthenticatedDb();
  return db.select().from(objectives).orderBy(desc(objectives.createdAt));
}
