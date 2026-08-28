"use server";

import { getAuthenticatedDb } from "@/db";
import { healthLogs, caffeineEvents } from "@/db/schema";
import { eq, gte } from "drizzle-orm";
import { todayISO, daysAgoISO } from "@/utils/date";
import { revalidatePath } from "next/cache";
import { caffeineDayKey, resolveCaffeineTodayDisplay } from "@/modules/caffeine/core";
import {
  validateHealthLogMutableValues,
  type HealthLogMutableValues,
} from "./core";

export type HealthLogActionResult =
  | { success: true }
  | { success: false; error: string };

function revalidateHealthViews() {
  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/war-room");
}

export async function upsertHealthLog(data: {
  date?: string;
  sleepHours?: number;
  caffeineMg?: number;
  substancesNotes?: string;
  screenTimeHours?: number;
  cyclingKm?: number;
  cyclingMinutes?: number;
  walkingMinutes?: number;
}): Promise<HealthLogActionResult> {
  const date = data.date ?? todayISO();
  const parsed = validateHealthLogMutableValues({
    date,
    sleepHours: data.sleepHours ?? null,
    caffeineMg: data.caffeineMg ?? null,
    substancesNotes: data.substancesNotes ?? null,
    screenTimeHours: data.screenTimeHours ?? null,
    cyclingKm: data.cyclingKm ?? null,
    cyclingMinutes: data.cyclingMinutes ?? null,
    walkingMinutes: data.walkingMinutes ?? null,
  });
  if (!parsed.success) return parsed;
  if (parsed.data.date > todayISO()) {
    return { success: false, error: "Health facts cannot be dated in the future." };
  }

  const db = await getAuthenticatedDb();

  const existing = await db
    .select()
    .from(healthLogs)
    .where(eq(healthLogs.date, date));

  if (existing.length > 0) {
    await db
      .update(healthLogs)
      .set({
        sleepHours:
          data.sleepHours !== undefined
            ? parsed.data.sleepHours
            : existing[0].sleepHours,
        caffeineMg:
          data.caffeineMg !== undefined
            ? parsed.data.caffeineMg
            : existing[0].caffeineMg,
        substancesNotes:
          data.substancesNotes !== undefined
            ? parsed.data.substancesNotes
            : existing[0].substancesNotes,
        screenTimeHours:
          data.screenTimeHours !== undefined
            ? parsed.data.screenTimeHours
            : existing[0].screenTimeHours,
        cyclingKm:
          data.cyclingKm !== undefined
            ? (existing[0].cyclingKm ?? 0) + (parsed.data.cyclingKm ?? 0)
            : existing[0].cyclingKm,
        cyclingMinutes:
          data.cyclingMinutes !== undefined
            ? (existing[0].cyclingMinutes ?? 0) +
              (parsed.data.cyclingMinutes ?? 0)
            : existing[0].cyclingMinutes,
        walkingMinutes:
          data.walkingMinutes !== undefined
            ? (existing[0].walkingMinutes ?? 0) +
              (parsed.data.walkingMinutes ?? 0)
            : existing[0].walkingMinutes,
        updatedAt: new Date(),
      })
      .where(eq(healthLogs.date, date));
  } else {
    await db.insert(healthLogs).values({
      date,
      sleepHours: parsed.data.sleepHours,
      caffeineMg: parsed.data.caffeineMg,
      substancesNotes: parsed.data.substancesNotes,
      screenTimeHours: parsed.data.screenTimeHours,
      cyclingKm: parsed.data.cyclingKm,
      cyclingMinutes: parsed.data.cyclingMinutes,
      walkingMinutes: parsed.data.walkingMinutes,
    });
  }

  revalidateHealthViews();
  return { success: true };
}

/**
 * Corrects an existing daily fact in place. The row id and createdAt are
 * deliberately absent from the update set, so fixing an occurred date or
 * value never becomes delete/recreate history. If the target date already
 * belongs to another row, fail loudly instead of merging two days.
 */
export async function updateHealthLog(
  id: number,
  values: HealthLogMutableValues,
): Promise<HealthLogActionResult> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { success: false, error: "Health log not found." };
  }
  const parsed = validateHealthLogMutableValues(values);
  if (!parsed.success) return parsed;
  if (parsed.data.date > todayISO()) {
    return { success: false, error: "Health facts cannot be dated in the future." };
  }

  const db = await getAuthenticatedDb();
  const existing = await db
    .select({ id: healthLogs.id, date: healthLogs.date })
    .from(healthLogs)
    .where(eq(healthLogs.id, id))
    .limit(1);
  if (!existing[0]) {
    return { success: false, error: "Health log not found." };
  }

  if (parsed.data.date !== existing[0].date) {
    const dateOwner = await db
      .select({ id: healthLogs.id })
      .from(healthLogs)
      .where(eq(healthLogs.date, parsed.data.date))
      .limit(1);
    if (dateOwner[0] && dateOwner[0].id !== id) {
      return {
        success: false,
        error: "That date already has a health log. Edit that day instead.",
      };
    }
  }

  try {
    await db
      .update(healthLogs)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(healthLogs.id, id));
  } catch {
    // A concurrent correction may claim the same unique calendar day
    // after the read above. Preserve both rows and ask the operator to
    // edit the already-existing day instead of collapsing history.
    return {
      success: false,
      error: "That date already has a health log. Edit that day instead.",
    };
  }

  revalidateHealthViews();
  return { success: true };
}

export async function getTodayHealthLog() {
  const db = await getAuthenticatedDb();
  const today = todayISO();
  const logs = await db
    .select()
    .from(healthLogs)
    .where(eq(healthLogs.date, today));
  return logs[0] ?? null;
}

export async function getHealthSummary() {
  const db = await getAuthenticatedDb();
  const sevenDaysAgo = daysAgoISO(7);
  const [logs, recentCaffeineEvents] = await Promise.all([
    db.select().from(healthLogs).where(gte(healthLogs.date, sevenDaysAgo)),
    // Taryn August Ingest Readiness §17: root cause of "caffeine ratio /
    // caffeine today still not registering correctly" -- the Monday
    // Real-Operation Pre-Freeze §14 fix reconciled quick-logged coffee
    // into the War Room's MONTHLY total (analytics/service.ts), but this
    // Dashboard "Caffeine Today" stat -- the number actually checked
    // day-to-day -- was never touched and still read health_logs.caffeineMg
    // alone. A 2-day window covers the America/Sao_Paulo day-bucketing
    // used by caffeineDayKey even right around midnight UTC.
    db
      .select({ occurredAt: caffeineEvents.occurredAt, servings: caffeineEvents.servings })
      .from(caffeineEvents)
      .where(gte(caffeineEvents.occurredAt, new Date(daysAgoISO(2)))),
  ]);

  const today = todayISO();
  const todayLog = logs.find((l) => l.date === today);
  const todayServings = recentCaffeineEvents
    .filter((e) => caffeineDayKey(e.occurredAt.toISOString()) === today)
    .reduce((sum, e) => sum + e.servings, 0);
  const caffeineToday = resolveCaffeineTodayDisplay(todayLog?.caffeineMg ?? null, todayServings);

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
    caffeineToday,
    screenTimeToday: todayLog?.screenTimeHours ?? null,
    cyclingKmToday: todayLog?.cyclingKm ?? null,
    walkingMinutesToday: todayLog?.walkingMinutes ?? null,
    totalCyclingKm7d: Math.round(totalCyclingKm7d * 10) / 10,
    totalWalkingMin7d,
    todayLog,
  };
}

export async function getAllHealthLogs() {
  const db = await getAuthenticatedDb();
  return db.select().from(healthLogs).orderBy(healthLogs.date);
}
