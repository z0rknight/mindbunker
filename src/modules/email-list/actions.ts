"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { emailContacts } from "@/db/schema";
import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isEmailContactClientType,
  isEmailContactOrigin,
  isEmailContactStatus,
  isValidEmail,
  normalizeEmail,
} from "./config";

function clean(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readContactInput(formData: FormData) {
  const name = clean(formData.get("name"), 120);
  const email = normalizeEmail(formData.get("email"));
  const clientType = formData.get("clientType");
  const status = formData.get("status");
  const relationshipOrigin = formData.get("relationshipOrigin");
  const notes = clean(formData.get("notes"), 2_000) || null;

  if (!name) return { success: false as const, error: "Name is required." };
  if (!isValidEmail(email)) return { success: false as const, error: "Enter a valid email address." };
  if (!isEmailContactClientType(clientType)) return { success: false as const, error: "Choose a valid client type." };
  if (!isEmailContactStatus(status)) return { success: false as const, error: "Choose a valid status." };
  if (!isEmailContactOrigin(relationshipOrigin)) return { success: false as const, error: "Choose a valid relationship origin." };

  return {
    success: true as const,
    value: { name, email, clientType, status, relationshipOrigin, notes },
  };
}

export async function createEmailContact(formData: FormData) {
  const parsed = readContactInput(formData);
  if (!parsed.success) return parsed;
  const db = await getAuthenticatedDb();
  const existing = await db.select({ id: emailContacts.id })
    .from(emailContacts)
    .where(eq(emailContacts.email, parsed.value.email))
    .limit(1);
  if (existing.length > 0) return { success: false as const, error: "This email is already in the list." };

  await db.insert(emailContacts).values({
    ...parsed.value,
    source: "mindbunker:manual",
  });
  revalidatePath("/crm/email-list");
  return { success: true as const };
}

export async function createEmailContactForm(formData: FormData): Promise<void> {
  const result = await createEmailContact(formData);
  const params = new URLSearchParams(result.success ? { notice: "Contact saved." } : { error: result.error });
  redirect(`/crm/email-list?${params.toString()}`);
}

export async function updateEmailContact(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return { success: false as const, error: "Contact identity is invalid." };
  const parsed = readContactInput(formData);
  if (!parsed.success) return parsed;
  const db = await getAuthenticatedDb();
  const duplicate = await db.select({ id: emailContacts.id })
    .from(emailContacts)
    .where(and(eq(emailContacts.email, parsed.value.email), sql`${emailContacts.id} <> ${id}`))
    .limit(1);
  if (duplicate.length > 0) return { success: false as const, error: "This email is already in the list." };

  await db.update(emailContacts).set({
    ...parsed.value,
    updatedAt: new Date(),
  }).where(eq(emailContacts.id, id));
  revalidatePath("/crm/email-list");
  return { success: true as const };
}

export async function updateEmailContactForm(formData: FormData): Promise<void> {
  const result = await updateEmailContact(formData);
  const params = new URLSearchParams(result.success ? { notice: "Contact updated." } : { error: result.error });
  redirect(`/crm/email-list?${params.toString()}`);
}

export async function getEmailContacts(filters: { query?: string; clientType?: string; status?: string }) {
  const db = await getAuthenticatedDb();
  const predicates = [];
  const query = filters.query?.trim().toLocaleLowerCase("en-US") ?? "";
  if (query) {
    const pattern = `%${query}%`;
    predicates.push(or(
      like(sql`lower(${emailContacts.name})`, pattern),
      like(sql`lower(${emailContacts.email})`, pattern),
    )!);
  }
  if (isEmailContactClientType(filters.clientType)) predicates.push(eq(emailContacts.clientType, filters.clientType));
  if (isEmailContactStatus(filters.status)) predicates.push(eq(emailContacts.status, filters.status));
  else if (filters.status !== "ALL") predicates.push(eq(emailContacts.status, "ACTIVE"));

  return db.select().from(emailContacts)
    .where(predicates.length > 0 ? and(...predicates) : undefined)
    .orderBy(asc(emailContacts.name), asc(emailContacts.id));
}
