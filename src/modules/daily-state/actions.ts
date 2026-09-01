"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { dailyStates } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { todayISO } from "@/utils/date";

type Result = { success: true; message: string } | { success: false; error: string };

export async function logWakeUp(input: { sleepHours?: number; energy?: number; focus?: number; note?: string; caffeineCount?: number; cigarettesCount?: number; movement?: boolean }): Promise<Result> {
  const date = todayISO();
  const db = await getAuthenticatedDb();
  const existing = await db.select({ id: dailyStates.id }).from(dailyStates).where(eq(dailyStates.date, date)).limit(1);
  const values = {
    sleepHours: input.sleepHours ?? null,
    energy: input.energy ?? null,
    focus: input.focus ?? null,
    note: input.note?.trim() || null,
    caffeineCount: input.caffeineCount ?? null,
    cigarettesCount: input.cigarettesCount ?? null,
    movement: input.movement ?? null,
  };
  if (existing[0]) {
    await db.update(dailyStates).set(values).where(eq(dailyStates.id, existing[0].id));
  } else {
    await db.insert(dailyStates).values({ date, ...values });
  }
  revalidatePath("/lab");
  return { success: true, message: "Logged." };
}

export async function logEveningNote(note: string): Promise<Result> {
  const date = todayISO();
  const db = await getAuthenticatedDb();
  const existing = await db.select({ id: dailyStates.id }).from(dailyStates).where(eq(dailyStates.date, date)).limit(1);
  if (existing[0]) {
    await db.update(dailyStates).set({ eveningNote: note.trim() || null }).where(eq(dailyStates.id, existing[0].id));
  } else {
    await db.insert(dailyStates).values({ date, eveningNote: note.trim() || null });
  }
  revalidatePath("/lab");
  return { success: true, message: "Saved." };
}

export async function getTodayState() {
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(dailyStates).where(eq(dailyStates.date, todayISO())).limit(1);
  return rows[0] ?? null;
}

export async function getLastNightState() {
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(dailyStates).orderBy(desc(dailyStates.date)).limit(1);
  return rows[0] ?? null;
}
