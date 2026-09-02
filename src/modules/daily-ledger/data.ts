import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  blockers,
  caffeineEvents,
  commitments,
  deliveries,
  frictionEvents,
  healthLogs,
  revisions,
  transactions,
  workSessions,
} from "@/db/schema";
import { gte } from "drizzle-orm";
import { operatorDateKey, shiftDateKey, todayISO } from "@/utils/date";
import { resolveCaffeineTodayDisplay } from "@/modules/caffeine/core";
import { buildDailyLedger, type DailyLedgerRow } from "./core";

function lastNDayKeys(n: number, today: string): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    keys.push(shiftDateKey(today, -i));
  }
  return keys;
}

// Operator Intelligence Patch Phase 3: gathers the raw facts for the last
// `days` operator-local calendar days and derives one ledger row per day.
// Every query reads an existing table directly -- no new schema, no
// persistence. A day with zero rows across every fact source still gets a
// row (all null/zero fields), so a quiet day is visible, not silently
// dropped.
export async function getDailyLedger(days: number): Promise<DailyLedgerRow[]> {
  const db = await getAuthenticatedDb();
  const today = todayISO();
  const dateKeys = lastNDayKeys(days, today);
  const windowStart = dateKeys[0];
  const windowStartInstant = new Date(`${windowStart}T00:00:00-03:00`);

  const [
    healthRows,
    caffeineEventRows,
    workSessionRows,
    deliveryRows,
    commitmentRows,
    revisionRows,
    frictionRows,
    blockerRows,
    transactionRows,
  ] = await Promise.all([
    db
      .select({
        date: healthLogs.date,
        sleepHours: healthLogs.sleepHours,
        caffeineMg: healthLogs.caffeineMg,
        walkingMinutes: healthLogs.walkingMinutes,
        cyclingKm: healthLogs.cyclingKm,
      })
      .from(healthLogs)
      .where(gte(healthLogs.date, windowStart)),
    db
      .select({ occurredAt: caffeineEvents.occurredAt, servings: caffeineEvents.servings })
      .from(caffeineEvents)
      .where(gte(caffeineEvents.occurredAt, windowStartInstant)),
    db
      .select({
        videoId: workSessions.videoId,
        startedAt: workSessions.startedAt,
        endedAt: workSessions.endedAt,
      })
      .from(workSessions)
      .where(gte(workSessions.startedAt, windowStartInstant)),
    db
      .select({ deliveredAt: deliveries.deliveredAt })
      .from(deliveries)
      .where(gte(deliveries.deliveredAt, windowStartInstant)),
    // Commitments due in the window -- fetched by dueAt, not filtered by
    // status, so a still-open overdue promise still shows up on the day
    // it was due (and computeMissed can see it).
    db
      .select({
        dueAt: commitments.dueAt,
        status: commitments.status,
        completedAt: commitments.completedAt,
      })
      .from(commitments)
      .where(gte(commitments.dueAt, windowStartInstant)),
    db
      .select({
        createdAt: revisions.createdAt,
        causedBy: revisions.causedBy,
        minutesRework: revisions.minutesRework,
      })
      .from(revisions)
      .where(gte(revisions.createdAt, windowStartInstant)),
    db
      .select({ createdAt: frictionEvents.createdAt, minutesLost: frictionEvents.minutesLost })
      .from(frictionEvents)
      .where(gte(frictionEvents.createdAt, windowStartInstant)),
    db
      .select({ startedAt: blockers.startedAt, resolvedAt: blockers.resolvedAt })
      .from(blockers)
      .where(gte(blockers.startedAt, windowStartInstant)),
    db
      .select({ date: transactions.date, type: transactions.type, currency: transactions.currency, amount: transactions.amount })
      .from(transactions)
      .where(gte(transactions.date, windowStart)),
  ]);

  return buildDailyLedger(
    dateKeys,
    {
      health: healthRows,
      caffeineEvents: caffeineEventRows.map((row) => ({
        date: operatorDateKey(row.occurredAt),
        servings: row.servings,
      })),
      workSessions: workSessionRows.map((row) => ({
        date: operatorDateKey(row.startedAt),
        videoId: row.videoId,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        seconds: row.endedAt
          ? Math.max(0, Math.floor((row.endedAt.getTime() - row.startedAt.getTime()) / 1000))
          : 0,
      })),
      deliveries: deliveryRows.map((row) => ({ date: operatorDateKey(row.deliveredAt) })),
      commitments: commitmentRows.map((row) => ({
        dueDate: operatorDateKey(row.dueAt),
        status: row.status,
        completedAt: row.completedAt,
        dueAt: row.dueAt,
      })),
      revisions: revisionRows.map((row) => ({
        date: operatorDateKey(row.createdAt),
        causedBy: row.causedBy,
        minutesRework: row.minutesRework,
      })),
      friction: frictionRows.map((row) => ({
        date: operatorDateKey(row.createdAt),
        minutesLost: row.minutesLost,
      })),
      blockers: blockerRows.map((row) => ({
        date: operatorDateKey(row.startedAt),
        durationMinutes: row.resolvedAt
          ? Math.max(0, Math.round((row.resolvedAt.getTime() - row.startedAt.getTime()) / 60000))
          : null,
      })),
      transactions: transactionRows,
    },
    resolveCaffeineTodayDisplay,
  );
}
