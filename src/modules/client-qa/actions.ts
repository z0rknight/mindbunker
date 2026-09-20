"use server";

import { getAuthenticatedDb } from "@/db";
import { clientExportReminders, clientProtectedTerms, clients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  canAddReminder,
  isDuplicateReminder,
  isDuplicateTerm,
  validateExportReminderInput,
  validateProtectedTermInput,
} from "./core";
import { getPreExportContext, type PreExportContext } from "./data";

// Operator-only. Every action starts with getAuthenticatedDb() (requireAuth);
// every edit/delete is scoped by BOTH row id and clientId, so a term or
// reminder can never be changed through another client's page. Nothing here
// touches a video's status, work sessions, or any money table.

export type ClientQaActionState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const positive = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(`${error.message} ${String((error as { cause?: unknown }).cause ?? "")}`);
}

// Read for the Video Workspace "Before you export" surface.
export async function getPreExportContextForVideo(
  videoId: number,
): Promise<{ success: true; data: PreExportContext } | { success: false }> {
  if (!positive(videoId)) return { success: false };
  const context = await getPreExportContext(videoId);
  return context ? { success: true, data: context } : { success: false };
}

async function requireClient(db: Awaited<ReturnType<typeof getAuthenticatedDb>>, clientId: number) {
  if (!positive(clientId)) return false;
  const row = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
  return Boolean(row[0]);
}

// ── protected terms ─────────────────────────────────────────────────────────
export async function createProtectedTerm(clientId: number, values: Record<string, unknown>): Promise<ClientQaActionState> {
  const db = await getAuthenticatedDb();
  if (!(await requireClient(db, clientId))) return { success: false, message: "Unknown client." };
  const validation = validateProtectedTermInput(values);
  if (!validation.success) return { success: false, errors: validation.errors };
  const existing = await db
    .select({ id: clientProtectedTerms.id, term: clientProtectedTerms.term })
    .from(clientProtectedTerms)
    .where(eq(clientProtectedTerms.clientId, clientId));
  if (isDuplicateTerm(existing, validation.data.term)) {
    return { success: false, errors: { term: "This client already has that term." } };
  }
  try {
    await db.insert(clientProtectedTerms).values({ clientId, ...validation.data });
  } catch (error) {
    if (isUniqueViolation(error)) return { success: false, errors: { term: "This client already has that term." } };
    throw error;
  }
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}

export async function updateProtectedTerm(clientId: number, id: number, values: Record<string, unknown>): Promise<ClientQaActionState> {
  if (!positive(id)) return { success: false, message: "Unknown term." };
  const db = await getAuthenticatedDb();
  const validation = validateProtectedTermInput(values);
  if (!validation.success) return { success: false, errors: validation.errors };
  const rows = await db
    .select({ id: clientProtectedTerms.id, term: clientProtectedTerms.term })
    .from(clientProtectedTerms)
    .where(eq(clientProtectedTerms.clientId, clientId));
  if (!rows.some((row) => row.id === id)) return { success: false, message: "Unknown term." };
  if (isDuplicateTerm(rows, validation.data.term, id)) {
    return { success: false, errors: { term: "This client already has that term." } };
  }
  try {
    await db
      .update(clientProtectedTerms)
      .set({ ...validation.data, updatedAt: new Date() })
      .where(and(eq(clientProtectedTerms.id, id), eq(clientProtectedTerms.clientId, clientId)));
  } catch (error) {
    if (isUniqueViolation(error)) return { success: false, errors: { term: "This client already has that term." } };
    throw error;
  }
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}

export async function deleteProtectedTerm(clientId: number, id: number): Promise<ClientQaActionState> {
  if (!positive(clientId) || !positive(id)) return { success: false, message: "Unknown term." };
  const db = await getAuthenticatedDb();
  await db
    .delete(clientProtectedTerms)
    .where(and(eq(clientProtectedTerms.id, id), eq(clientProtectedTerms.clientId, clientId)));
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}

// ── export reminders ────────────────────────────────────────────────────────
export async function createExportReminder(clientId: number, values: Record<string, unknown>): Promise<ClientQaActionState> {
  const db = await getAuthenticatedDb();
  if (!(await requireClient(db, clientId))) return { success: false, message: "Unknown client." };
  const validation = validateExportReminderInput(values);
  if (!validation.success) return { success: false, errors: validation.errors };
  const existing = await db
    .select({ id: clientExportReminders.id, text: clientExportReminders.text })
    .from(clientExportReminders)
    .where(eq(clientExportReminders.clientId, clientId));
  if (!canAddReminder(existing.length)) {
    return { success: false, errors: { text: "Keep this short: delete one reminder before adding another." } };
  }
  if (isDuplicateReminder(existing, validation.data.text)) {
    return { success: false, errors: { text: "This client already has that reminder." } };
  }
  try {
    await db.insert(clientExportReminders).values({ clientId, ...validation.data });
  } catch (error) {
    if (isUniqueViolation(error)) return { success: false, errors: { text: "This client already has that reminder." } };
    throw error;
  }
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}

export async function updateExportReminder(clientId: number, id: number, values: Record<string, unknown>): Promise<ClientQaActionState> {
  if (!positive(id)) return { success: false, message: "Unknown reminder." };
  const db = await getAuthenticatedDb();
  const validation = validateExportReminderInput(values);
  if (!validation.success) return { success: false, errors: validation.errors };
  const rows = await db
    .select({ id: clientExportReminders.id, text: clientExportReminders.text })
    .from(clientExportReminders)
    .where(eq(clientExportReminders.clientId, clientId));
  if (!rows.some((row) => row.id === id)) return { success: false, message: "Unknown reminder." };
  if (isDuplicateReminder(rows, validation.data.text, id)) {
    return { success: false, errors: { text: "This client already has that reminder." } };
  }
  try {
    await db
      .update(clientExportReminders)
      .set({ ...validation.data, updatedAt: new Date() })
      .where(and(eq(clientExportReminders.id, id), eq(clientExportReminders.clientId, clientId)));
  } catch (error) {
    if (isUniqueViolation(error)) return { success: false, errors: { text: "This client already has that reminder." } };
    throw error;
  }
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}

export async function deleteExportReminder(clientId: number, id: number): Promise<ClientQaActionState> {
  if (!positive(clientId) || !positive(id)) return { success: false, message: "Unknown reminder." };
  const db = await getAuthenticatedDb();
  await db
    .delete(clientExportReminders)
    .where(and(eq(clientExportReminders.id, id), eq(clientExportReminders.clientId, clientId)));
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}
