"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { frictionEvents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isFrictionCategory, type FrictionEventRow } from "./core";

type Result = { success: true; message: string } | { success: false; error: string };

export async function logFrictionEvent(input: {
  category: unknown;
  clientId?: number | null;
  projectId?: number | null;
  videoId?: number | null;
  workSessionId?: number | null;
  note?: string | null;
  minutesLost?: number | null;
}): Promise<Result> {
  if (!isFrictionCategory(input.category)) return { success: false, error: "Invalid category." };
  const db = await getAuthenticatedDb();
  await db.insert(frictionEvents).values({
    category: input.category,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    videoId: input.videoId ?? null,
    workSessionId: input.workSessionId ?? null,
    note: input.note?.trim() || null,
    minutesLost: input.minutesLost ?? null,
    actor: "admin",
  });
  revalidatePath("/lab");
  return { success: true, message: "Friction logged." };
}

export async function listRecentFrictionEvents(limit = 30): Promise<FrictionEventRow[]> {
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(frictionEvents).orderBy(desc(frictionEvents.createdAt)).limit(limit);
  return rows as FrictionEventRow[];
}

export async function listFrictionForVideo(videoId: number): Promise<FrictionEventRow[]> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(frictionEvents)
    .where(eq(frictionEvents.videoId, videoId))
    .orderBy(desc(frictionEvents.createdAt));
  return rows as FrictionEventRow[];
}
