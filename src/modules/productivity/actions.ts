"use server";

import { db } from "@/db";
import { videoLogs } from "@/db/schema";
import { eq, gte, and, sql } from "drizzle-orm";
import { todayISO, startOfMonthISO } from "@/utils/date";
import { revalidatePath } from "next/cache";

export async function logFinishedVideo(data?: {
  clientId?: number;
  revisionsCount?: number;
  notes?: string;
}) {
  const today = todayISO();
  await db.insert(videoLogs).values({
    date: today,
    clientId: data?.clientId ?? null,
    revisionsCount: data?.revisionsCount ?? 0,
    delivered: true,
    notes: data?.notes ?? null,
  });
  revalidatePath("/");
  revalidatePath("/productivity");
}

export async function getVideoStats() {
  const today = todayISO();
  const monthStart = startOfMonthISO();

  const [todayCount, monthCount, allLogs] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(videoLogs)
      .where(eq(videoLogs.date, today)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(videoLogs)
      .where(gte(videoLogs.date, monthStart)),
    db.select().from(videoLogs).orderBy(videoLogs.createdAt),
  ]);

  // Week count (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekStart = sevenDaysAgo.toISOString().split("T")[0];

  const weekLogs = allLogs.filter((l) => l.date >= weekStart);

  return {
    today: Number(todayCount[0]?.count ?? 0),
    week: weekLogs.length,
    month: Number(monthCount[0]?.count ?? 0),
    total: allLogs.length,
    totalRevisions: allLogs.reduce((sum, l) => sum + l.revisionsCount, 0),
  };
}

export async function getAllVideoLogs() {
  return db.select().from(videoLogs).orderBy(videoLogs.createdAt);
}

export async function deleteVideoLog(id: number) {
  await db.delete(videoLogs).where(eq(videoLogs.id, id));
  revalidatePath("/");
  revalidatePath("/productivity");
}
