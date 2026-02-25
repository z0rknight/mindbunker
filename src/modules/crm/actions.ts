"use server";

import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq, gte } from "drizzle-orm";
import { startOfMonthISO } from "@/utils/date";
import { revalidatePath } from "next/cache";

export async function addClient(data: {
  name: string;
  status?: "lead" | "active" | "inactive";
  email?: string;
  phone?: string;
  notes?: string;
  source?: string;
}) {
  await db.insert(clients).values({
    name: data.name,
    status: data.status ?? "lead",
    email: data.email ?? null,
    phone: data.phone ?? null,
    notes: data.notes ?? null,
    source: data.source ?? null,
    totalProjects: 0,
    totalRevenue: 0,
    contacted: false,
    converted: false,
  });
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
  await db.update(clients).set(data).where(eq(clients.id, id));
  revalidatePath("/");
  revalidatePath("/crm");
}

export async function convertLeadToClient(id: number) {
  await db
    .update(clients)
    .set({ status: "active", converted: true, contacted: true })
    .where(eq(clients.id, id));
  revalidatePath("/");
  revalidatePath("/crm");
}

export async function deleteClient(id: number) {
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/");
  revalidatePath("/crm");
}

export async function getCRMSummary() {
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
  return db.select().from(clients).orderBy(clients.createdAt);
}

export async function getClientById(id: number) {
  const result = await db.select().from(clients).where(eq(clients.id, id));
  return result[0] ?? null;
}
