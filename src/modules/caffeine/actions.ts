"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { caffeineEvents } from "@/db/schema";
import { gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { daysAgoISO } from "@/utils/date";
import {
  caffeineDayKey,
  computeCaffeineSummary,
  type CaffeineDayCounts,
} from "./core";

// Records exactly one coffee-serving event, timestamped now. This is the
// entire write path for the Home "☕ +1 COFFEE" quick action -- no form,
// no fields, one click. Intentionally does NOT touch health_logs.caffeineMg
// (that field stays a separate, coarser, manually-overwritten daily total --
// see the comment on caffeine_events in db/schema.ts).
export async function logCaffeineEvent() {
  const db = await getAuthenticatedDb();
  await db.insert(caffeineEvents).values({
    occurredAt: new Date(),
    servings: 1,
    source: "QUICK_LOG",
  });
  revalidatePath("/");
  revalidatePath("/health");
}

async function fetchCaffeineDayCounts(
  daysBack: number,
): Promise<CaffeineDayCounts> {
  const db = await getAuthenticatedDb();
  const windowStart = daysAgoISO(daysBack);
  const rows = await db
    .select({
      occurredAt: caffeineEvents.occurredAt,
      servings: caffeineEvents.servings,
    })
    .from(caffeineEvents)
    .where(gte(caffeineEvents.occurredAt, new Date(windowStart)));

  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = caffeineDayKey(row.occurredAt.toISOString());
    counts[key] = (counts[key] ?? 0) + row.servings;
  }
  return counts;
}

// 8 days back always covers "this week" (Monday-start) even when today is
// a Sunday.
//
// NIGHT SHIFT REALITY PATCH — P0 bug fix: this used to compute todayKey via
// caffeineDayKey(nowBrazil().toISOString()). nowBrazil() already fakes a
// -3h shift (it returns a Date whose UTC-labeled ISO string reads as
// Brazil's wall clock -- see the comment on nowBrazil() in utils/date.ts),
// but caffeineDayKey() does its OWN correct America/Sao_Paulo conversion
// via Intl on top of whatever real UTC instant it's given. Feeding
// nowBrazil()'s already-shifted value into it double-shifted the day
// boundary by another 3 hours -- so a coffee logged shortly after real
// Brazil midnight (e.g. 00:15) resolved todayKey to the PREVIOUS calendar
// day, and "today's" count silently looked up yesterday's bucket instead.
// The individual events were always bucketed correctly (fetchCaffeineDayCounts
// calls caffeineDayKey on the event's own real timestamp) -- only this
// "what day is today" resolution was wrong. Fix: feed caffeineDayKey the
// real current UTC instant directly; it does the correct conversion itself.
export async function getCaffeineSummary() {
  const counts = await fetchCaffeineDayCounts(8);
  const todayKey = caffeineDayKey(new Date().toISOString());
  return computeCaffeineSummary(counts, todayKey);
}

// Wider window for the activity timeline. Returns a plain
// Record<string, number> (not a Map) so it can be passed straight through a
// server component into a client component as serializable props.
export async function getCaffeineDayCountsForTimeline(
  daysBack: number,
): Promise<CaffeineDayCounts> {
  return fetchCaffeineDayCounts(daysBack);
}
