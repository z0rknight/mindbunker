"use server";

import { getAuthenticatedDb } from "@/db";
import { clients, crmEvents } from "@/db/schema";
import { eq, gte } from "drizzle-orm";
import { startOfMonthISO } from "@/utils/date";
import { revalidatePath } from "next/cache";
import {
  normalizeInstagramUsername,
  validateInstagramProfileInput,
} from "@/modules/instagram/core";
import {
  getInstagramProvider,
  isInstagramImportConfigured,
} from "@/modules/instagram/provider";

export async function addClient(data: {
  name: string;
  status?: "lead" | "active" | "inactive";
  email?: string;
  phone?: string;
  notes?: string;
  source?: string;
  instagramUsername?: string;
}) {
  const name = data.name.trim().slice(0, 160);
  if (!name) {
    throw new Error("Contact name is required.");
  }

  const db = await getAuthenticatedDb();
  const status = data.status ?? "lead";
  const instagramUsername = data.instagramUsername
    ? normalizeInstagramUsername(data.instagramUsername)
    : null;
  if (data.instagramUsername && !instagramUsername) {
    throw new Error("Enter a valid Instagram username.");
  }
  const inserted = await db
    .insert(clients)
    .values({
      name,
      status,
      opportunityStage: status === "active" ? "active" : "new",
      email: data.email?.trim().slice(0, 320) || null,
      phone: data.phone?.trim().slice(0, 80) || null,
      instagramUsername,
      notes: data.notes?.trim().slice(0, 5_000) || null,
      source: data.source?.trim().slice(0, 160) || null,
      totalProjects: 0,
      totalRevenue: 0,
      contacted: false,
      converted: false,
    })
    .returning({ id: clients.id });

  if (inserted[0]) {
    await db.insert(crmEvents).values({
      clientId: inserted[0].id,
      type: status === "lead" ? "lead_created" : "client_created",
      actor: "admin",
      description: status === "lead" ? "Lead created" : "Client created",
    });
  }
  revalidatePath("/");
  revalidatePath("/crm");
}

export async function updateClient(
  id: number,
  data: Partial<{
    name: string;
    status: "lead" | "active" | "inactive";
    email: string;
    phone: string;
    notes: string;
    source: string;
    totalProjects: number;
    totalRevenue: number;
    contacted: boolean;
    converted: boolean;
  }>
) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid contact.");
  }
  const db = await getAuthenticatedDb();
  await db.update(clients).set(data).where(eq(clients.id, id));
  revalidatePath("/");
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
}

export async function convertLeadToClient(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid contact.");
  }
  const db = await getAuthenticatedDb();
  await db
    .update(clients)
    .set({
      status: "active",
      opportunityStage: "active",
      converted: true,
      contacted: true,
    })
    .where(eq(clients.id, id));
  await db.insert(crmEvents).values({
    clientId: id,
    type: "client_activated",
    actor: "admin",
    description: "Lead converted to active client",
  });
  revalidatePath("/");
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
}

export async function deleteClient(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid contact.");
  }
  const db = await getAuthenticatedDb();
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/");
  revalidatePath("/crm");
}

export async function getCRMSummary() {
  const db = await getAuthenticatedDb();
  const monthStart = startOfMonthISO();
  const allClients = await db.select().from(clients);

  const activeClients = allClients.filter((c) => c.status === "active");
  const leadsThisMonth = allClients.filter(
    (c) =>
      c.status === "lead" &&
      c.createdAt !== null &&
      c.createdAt >= new Date(monthStart)
  );

  return {
    activeClientsCount: activeClients.length,
    leadsThisMonth: leadsThisMonth.length,
    totalClients: allClients.length,
  };
}

export async function getAllClients() {
  const db = await getAuthenticatedDb();
  return db.select().from(clients).orderBy(clients.createdAt);
}

export async function getClientById(id: number) {
  const db = await getAuthenticatedDb();
  const result = await db.select().from(clients).where(eq(clients.id, id));
  return result[0] ?? null;
}

type InstagramActionResult =
  | {
      success: true;
      profile: {
        username: string;
        biography: string | null;
        profilePictureUrl: string | null;
      };
    }
  | { success: false; error: string };

function revalidateInstagramViews(clientId: number) {
  revalidatePath("/crm");
  revalidatePath(`/crm/${clientId}`);
}

export async function getInstagramImportStatus() {
  await getAuthenticatedDb();
  return { configured: await isInstagramImportConfigured() };
}

export async function saveInstagramProfile(
  clientId: number,
  input: {
    username: string;
    biography?: string;
    profilePictureUrl?: string;
  },
): Promise<InstagramActionResult> {
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    return { success: false, error: "Invalid contact." };
  }
  const parsed = validateInstagramProfileInput(input);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  const owner = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!owner[0]) return { success: false, error: "Contact not found." };

  await db.batch([
    db
      .update(clients)
      .set({
        instagramUsername: parsed.data.username,
        instagramBio: parsed.data.biography,
        instagramProfilePictureUrl: parsed.data.profilePictureUrl,
        instagramProfileUpdatedAt: new Date(),
      })
      .where(eq(clients.id, clientId)),
    db.insert(crmEvents).values({
      clientId,
      type: "instagram_profile_updated",
      actor: "admin",
      description: `Instagram profile saved: @${parsed.data.username}`,
    }),
  ]);

  revalidateInstagramViews(clientId);
  return { success: true, profile: parsed.data };
}

export async function importInstagramProfile(
  clientId: number,
  rawUsername: string,
): Promise<InstagramActionResult> {
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    return { success: false, error: "Invalid contact." };
  }
  const username = normalizeInstagramUsername(rawUsername);
  if (!username) {
    return { success: false, error: "Enter a valid Instagram username." };
  }

  const db = await getAuthenticatedDb();
  const owner = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!owner[0]) return { success: false, error: "Contact not found." };

  const provider = await getInstagramProvider();
  if (!provider) {
    return {
      success: false,
      error: "Meta Business Discovery is not connected yet. You can still save the profile manually.",
    };
  }

  try {
    const profile = await provider.getProfile(username);
    await db.batch([
      db
        .update(clients)
        .set({
          instagramUsername: profile.username,
          instagramBio: profile.biography,
          instagramProfilePictureUrl: profile.profilePictureUrl,
          instagramProfileUpdatedAt: new Date(),
        })
        .where(eq(clients.id, clientId)),
      db.insert(crmEvents).values({
        clientId,
        type: "instagram_profile_imported",
        actor: "admin",
        description: `Instagram bio and photo imported: @${profile.username}`,
      }),
    ]);
    revalidateInstagramViews(clientId);
    return { success: true, profile };
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Instagram")
      ? error.message
      : "Instagram import failed. Check the handle and Meta connection.";
    return { success: false, error: message };
  }
}
