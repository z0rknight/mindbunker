"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { commitments, clients, projects, videoLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  isCommitmentOwnerType,
  isPositiveInt,
  validateNewCommitment,
  type CommitmentOwnerType,
} from "./core";

type CommitmentActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

async function ownerExists(
  ownerType: CommitmentOwnerType,
  ownerId: number,
): Promise<boolean> {
  const db = await getAuthenticatedDb();
  if (ownerType === "CLIENT") {
    const rows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, ownerId))
      .limit(1);
    return Boolean(rows[0]);
  }
  if (ownerType === "PROJECT") {
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, ownerId))
      .limit(1);
    return Boolean(rows[0]);
  }
  const rows = await db
    .select({ id: videoLogs.id })
    .from(videoLogs)
    .where(eq(videoLogs.id, ownerId))
    .limit(1);
  return Boolean(rows[0]);
}

function revalidateCommitmentViews() {
  revalidatePath("/lab");
  revalidatePath("/war-room");
}

export async function createCommitment(input: {
  ownerType: unknown;
  ownerId: unknown;
  description: unknown;
  dueAtIso?: unknown;
}): Promise<CommitmentActionResult> {
  const validated = validateNewCommitment(input);
  if (!validated.ok) return { success: false, error: validated.error };
  // isCommitmentOwnerType/isPositiveInt already re-checked inside
  // validateNewCommitment; narrow again here for TypeScript.
  if (!isCommitmentOwnerType(input.ownerType) || !isPositiveInt(input.ownerId)) {
    return { success: false, error: "Invalid owner." };
  }
  if (!(await ownerExists(input.ownerType, input.ownerId))) {
    return { success: false, error: "That client/project/video no longer exists." };
  }

  const db = await getAuthenticatedDb();
  await db.insert(commitments).values({
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    description: validated.description,
    dueAt: validated.dueAt,
    status: "OPEN",
    source: "MANUAL",
    actor: "admin",
  });

  revalidateCommitmentViews();
  return { success: true, message: "Commitment logged." };
}

export async function completeCommitment(
  id: number,
): Promise<CommitmentActionResult> {
  if (!isPositiveInt(id)) return { success: false, error: "Invalid commitment." };
  const db = await getAuthenticatedDb();
  const updated = await db
    .update(commitments)
    .set({ status: "DONE", completedAt: new Date() })
    .where(eq(commitments.id, id))
    .returning({ id: commitments.id });
  if (!updated[0]) return { success: false, error: "Commitment not found." };

  revalidateCommitmentViews();
  return { success: true, message: "Marked done." };
}

export async function cancelCommitment(
  id: number,
): Promise<CommitmentActionResult> {
  if (!isPositiveInt(id)) return { success: false, error: "Invalid commitment." };
  const db = await getAuthenticatedDb();
  const updated = await db
    .update(commitments)
    .set({ status: "CANCELLED" })
    .where(eq(commitments.id, id))
    .returning({ id: commitments.id });
  if (!updated[0]) return { success: false, error: "Commitment not found." };

  revalidateCommitmentViews();
  return { success: true, message: "Commitment cancelled." };
}
