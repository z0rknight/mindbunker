"use server";

import { db } from "@/db";
import { healthLogs } from "@/db/schema";
import { eq, gte } from "drizzle-orm";
import { todayISO, daysAgoISO } from "@/utils/date";
import { revalidatePath } from "next/cache";

export async function upsertHealthLog(data: {
  date?: string;
  sleepHours?: number;
  caffeineMg?: number;
  substancesNotes?: string;
  screenTimeHours?: number;
  cyclingKm?: number;
  cyclingMinutes?: number;
  walkingMinutes?: number;
}) {
  const date = data.date ?? todayISO();

  const existing = await db
    .select()
    .from(healthLogs)
    .where(eq(healthLogs.date, date));

  if (existing.length > 0) {
    await db
      .update(healthLogs)
      .set({
        sleepHours: data.sleepHours ?? existing[0].sleepHours,
        caffeineMg: data.caffeineMg ?? existing[0].caffeineMg,
        substancesNotes: data.substancesNotes ?? existing[0].substancesNotes,
        screenTimeHours: data.screenTimeHours ?? existing[0].screenTimeHours,
        cyclingKm: data.cyclingKm !== undefined ? data.cyclingKm : existing[0].cyclingKm,
        cyclingMinutes: data.cyclingMinutes !== undefined ? data.cyclingMinutes : existing[0].cyclingMinutes,
        walkingMinutes: data.walkingMinutes !== undefined ? data.walkingMinutes : existing[0].walkingMinutes,
        updatedAt: new Date(),
      })
      .where(eq(healthLogs.date, date));
  } else {
    await db.insert(healthLogs).values({
      date,
      sleepHours: data.sleepHours ?? null,
      caffeineMg: data.caffeineMg ?? null,
      substancesNotes: data.substancesNotes ?? null,
      screenTimeHours: data.screenTimeHours ?? null,
      cyclingKm: data.cyclingKm ?? null,
      cyclingMinutes: data.cyclingMinutes ?? null,
      walkingMinutes: data.walkingMinutes ?? null,
    });
  }

  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/war-room");
}

export async function getTodayHealthLog() {
  const today = todayISO();
  const logs = await db
    .select()
    .from(healthLogs)
    .where(eq(healthLogs.date, today));
  return logs[0] ?? null;
}

export async function getHealthSummary() {
  const sevenDaysAgo = daysAgoISO(7);
  const logs = await db
    .select()
    .from(healthLogs)
    .where(gte(healthLogs.date, sevenDaysAgo));

  const today = todayISO();
  const todayLog = logs.find((l) => l.date === today);

  const sleepLogs = logs.filter((l) => l.sleepHours !== null);
  const avgSleep =
    sleepLogs.length > 0
      ? sleepLogs.reduce((sum, l) => sum + (l.sleepHours ?? 0), 0) / sleepLogs.length
      : null;

  const cyclingLogs = logs.filter((l) => l.cyclingKm !== null && l.cyclingKm > 0);
  const totalCyclingKm7d = cyclingLogs.reduce((sum, l) => sum + (l.cyclingKm ?? 0), 0);

  const walkingLogs = logs.filter((l) => l.walkingMinutes !== null && l.walkingMinutes > 0);
  const totalWalkingMin7d = walkingLogs.reduce((sum, l) => sum + (l.walkingMinutes ?? 0), 0);

  return {
    avgSleep7Days: avgSleep ? Math.round(avgSleep * 10) / 10 : null,
    caffeineToday: todayLog?.caffeineMg ?? null,
    screenTimeToday: todayLog?.screenTimeHours ?? null,
    cyclingKmToday: todayLog?.cyclingKm ?? null,
    walkingMinutesToday: todayLog?.walkingMinutes ?? null,
    totalCyclingKm7d: Math.round(totalCyclingKm7d * 10) / 10,
    totalWalkingMin7d,
    todayLog,
  };
}

export async function getAllHealthLogs() {
  return db.select().from(healthLogs).orderBy(healthLogs.date);
}
