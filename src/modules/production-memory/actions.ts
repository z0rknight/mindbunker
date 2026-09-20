"use server";

import { getAuthenticatedDb } from "@/db";
import { clientProductionMemory, clients, videoLogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  checkReferenceVideo,
  isDuplicateMemoryName,
  validateProductionMemoryInput,
  type ProductionMemoryInput,
} from "./core";

// Operator-only CRUD for client production memory. Every action starts with
// getAuthenticatedDb() (requireAuth), and every write is scoped by BOTH the
// row id and its clientId, so a memory can never be edited or deleted through
// another client's page. No version history, no approval workflow.

export type ProductionMemoryActionState = {
  success: boolean;
  id?: number;
  message?: string;
  errors?: Record<string, string>;
};

async function checkReference(
  db: Awaited<ReturnType<typeof getAuthenticatedDb>>,
  clientId: number,
  data: ProductionMemoryInput,
): Promise<string | null> {
  if (data.referenceVideoId === null) return null;
  const video = await db
    .select({ clientId: videoLogs.clientId, isOperationalContainer: videoLogs.isOperationalContainer })
    .from(videoLogs)
    .where(eq(videoLogs.id, data.referenceVideoId))
    .limit(1);
  return checkReferenceVideo(video[0] ?? null, clientId);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(`${error.message} ${String((error as { cause?: unknown }).cause ?? "")}`);
}

export async function createProductionMemory(
  clientId: number,
  values: Record<string, unknown>,
): Promise<ProductionMemoryActionState> {
  if (!Number.isInteger(clientId) || clientId <= 0) return { success: false, message: "Unknown client." };
  const db = await getAuthenticatedDb();

  const client = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client[0]) return { success: false, message: "Unknown client." };

  const validation = validateProductionMemoryInput(values);
  if (!validation.success) return { success: false, errors: validation.errors, message: "Check the highlighted fields." };
  const data = validation.data;

  const existing = await db
    .select({ id: clientProductionMemory.id, name: clientProductionMemory.name })
    .from(clientProductionMemory)
    .where(eq(clientProductionMemory.clientId, clientId));
  if (isDuplicateMemoryName(existing, data.name)) {
    return { success: false, errors: { name: "This client already has a format with that name." } };
  }

  const referenceError = await checkReference(db, clientId, data);
  if (referenceError) return { success: false, errors: { referenceVideoId: referenceError } };

  try {
    const inserted = await db
      .insert(clientProductionMemory)
      .values({ clientId, ...data })
      .returning({ id: clientProductionMemory.id });
    revalidatePath(`/crm/${clientId}`);
    return { success: true, id: inserted[0]?.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, errors: { name: "This client already has a format with that name." } };
    }
    throw error;
  }
}

export async function updateProductionMemory(
  clientId: number,
  id: number,
  values: Record<string, unknown>,
): Promise<ProductionMemoryActionState> {
  if (!Number.isInteger(clientId) || clientId <= 0 || !Number.isInteger(id) || id <= 0) {
    return { success: false, message: "Unknown format." };
  }
  const db = await getAuthenticatedDb();

  const validation = validateProductionMemoryInput(values);
  if (!validation.success) return { success: false, errors: validation.errors, message: "Check the highlighted fields." };
  const data = validation.data;

  const rows = await db
    .select({ id: clientProductionMemory.id, name: clientProductionMemory.name })
    .from(clientProductionMemory)
    .where(eq(clientProductionMemory.clientId, clientId));
  if (!rows.some((row) => row.id === id)) return { success: false, message: "Unknown format." };
  if (isDuplicateMemoryName(rows, data.name, id)) {
    return { success: false, errors: { name: "This client already has a format with that name." } };
  }

  const referenceError = await checkReference(db, clientId, data);
  if (referenceError) return { success: false, errors: { referenceVideoId: referenceError } };

  try {
    await db
      .update(clientProductionMemory)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(clientProductionMemory.id, id), eq(clientProductionMemory.clientId, clientId)));
    revalidatePath(`/crm/${clientId}`);
    return { success: true, id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, errors: { name: "This client already has a format with that name." } };
    }
    throw error;
  }
}

// Safe to delete: nothing references a memory row (it is a leaf), and the
// delete is scoped to (id, clientId).
export async function deleteProductionMemory(clientId: number, id: number): Promise<ProductionMemoryActionState> {
  if (!Number.isInteger(clientId) || clientId <= 0 || !Number.isInteger(id) || id <= 0) {
    return { success: false, message: "Unknown format." };
  }
  const db = await getAuthenticatedDb();
  await db
    .delete(clientProductionMemory)
    .where(and(eq(clientProductionMemory.id, id), eq(clientProductionMemory.clientId, clientId)));
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}
