/**
 * Performance Statistics Utility
 * Isolated calculation layer for derived/gamified metrics.
 * All inputs come from module data — no direct DB access here.
 * Future-ready: add correlation metrics, scoring formulas, etc.
 */

import { getAuthenticatedDb } from "@/db";
import { transactions, videoLogs, clients, healthLogs, workSessions } from "@/db/schema";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import {
  previousMonthRangeISO,
  startOfMonthISO,
  daysAgoISO,
  todayISO,
} from "@/utils/date";
import { DEFAULT_CURRENCY } from "@/modules/finance/config";
import {
  consistencyStreakFromSessions,
  growthByCurrency,
  isActiveExternalClient,
  sumIncomeByCurrency,
  type CurrencyAmount,
} from "@/modules/analytics/core";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface PerformanceStats {
  // Revenue per video this month
  revenuePerVideo: number | null;
  revenueCurrency: string;
  revenueThisMonthByCurrency: CurrencyAmount[];

  // Average revisions per video this month
  avgRevisionsPerVideo: number | null;

  // Videos per active client this month
  videosPerActiveClient: number | null;

  // Consecutive operator days with at least one closed Work Session
  consistencyStreak: number;

  // Revenue growth % vs previous month (null if no previous data)
  revenueGrowthPct: number | null;
  revenueGrowthCurrency: string;
  revenueGrowthByCurrency: Array<CurrencyAmount & { growthPct: number | null }>;

  // Videos growth % vs previous month (null if no previous data)
  videosGrowthPct: number | null;

  // Caffeine per video this month (mg / videos)
  caffeinePerVideo: number | null;

  // Composite productivity score (gamified index)
  productivityScore: number;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

export async function getPerformanceStats(): Promise<PerformanceStats> {
  const db = await getAuthenticatedDb();
  const now = new Date();
  const monthStart = startOfMonthISO(now);
  const previousMonth = previousMonthRangeISO(now);
  const prevMonthStart = previousMonth.start;
  const prevMonthEnd = previousMonth.end;
  const today = todayISO(now);
  const thirtyDaysAgo = daysAgoISO(30, now);

  // Fetch all needed data in parallel
  const [
    thisMonthTransactions,
    prevMonthTransactions,
    thisMonthVideos,
    prevMonthVideos,
    activeClients,
    last30DaysHealthLogs,
    closedWorkSessions,
  ] = await Promise.all([
    db.select().from(transactions).where(gte(transactions.date, monthStart)),
    db
      .select()
      .from(transactions)
      .where(gte(transactions.date, prevMonthStart)),
    db
      .select()
      .from(videoLogs)
      .where(
        and(gte(videoLogs.date, monthStart), eq(videoLogs.status, "DONE")),
      ),
    db
      .select()
      .from(videoLogs)
      .where(
        and(
          gte(videoLogs.date, prevMonthStart),
          eq(videoLogs.status, "DONE"),
        ),
      ),
    db.select().from(clients),
    db.select().from(healthLogs).where(gte(healthLogs.date, thirtyDaysAgo)),
    db
      .select({ startedAt: workSessions.startedAt, endedAt: workSessions.endedAt })
      .from(workSessions)
      .where(isNotNull(workSessions.endedAt)),
  ]);

  // ── Revenue per Video ──────────────────────────────────────────────────────
  const revenueThisMonthByCurrency = sumIncomeByCurrency(
    thisMonthTransactions.filter((transaction) => transaction.date <= today),
  );
  const revenueCurrency = DEFAULT_CURRENCY;
  const revenueInDisplayCurrency = revenueThisMonthByCurrency.find(
    (row) => row.currency === revenueCurrency,
  );
  const thisMonthRevenue = revenueInDisplayCurrency?.amount ?? null;

  const thisMonthVideoCount = thisMonthVideos.length;

  const revenuePerVideo =
    thisMonthVideoCount > 0 && thisMonthRevenue !== null
      ? Math.round(thisMonthRevenue / thisMonthVideoCount)
      : null;

  // ── Avg Revisions per Video ────────────────────────────────────────────────
  const totalRevisions = thisMonthVideos.reduce(
    (sum, v) => sum + v.revisionsCount,
    0
  );
  const avgRevisionsPerVideo =
    thisMonthVideoCount > 0
      ? Math.round((totalRevisions / thisMonthVideoCount) * 10) / 10
      : null;

  // ── Videos per Active Client ───────────────────────────────────────────────
  const activeClientCount = activeClients.filter(isActiveExternalClient).length;
  const videosPerActiveClient =
    activeClientCount > 0
      ? Math.round((thisMonthVideoCount / activeClientCount) * 10) / 10
      : null;

  // ── Consistency Streak ────────────────────────────────────────────────────
  const streak = consistencyStreakFromSessions(closedWorkSessions, now);

  // ── Revenue Growth % ──────────────────────────────────────────────────────
  const previousRevenueByCurrency = sumIncomeByCurrency(
    prevMonthTransactions.filter(
      (transaction) => transaction.date >= prevMonthStart && transaction.date <= prevMonthEnd,
    ),
  );
  const revenueGrowthByCurrency = growthByCurrency(
    revenueThisMonthByCurrency,
    previousRevenueByCurrency,
  );
  const revenueGrowthPct =
    revenueGrowthByCurrency.find((row) => row.currency === revenueCurrency)?.growthPct ?? null;

  // ── Videos Growth % ───────────────────────────────────────────────────────
  const prevMonthVideoCount = prevMonthVideos.filter(
    (v) => v.date >= prevMonthStart && v.date <= prevMonthEnd
  ).length;

  const videosGrowthPct = growthPct(thisMonthVideoCount, prevMonthVideoCount);

  // ── Caffeine per Video ────────────────────────────────────────────────────
  const totalCaffeineThisMonth = last30DaysHealthLogs
    .filter((h) => h.date >= monthStart)
    .reduce((sum, h) => sum + (h.caffeineMg ?? 0), 0);

  const caffeinePerVideo =
    thisMonthVideoCount > 0
      ? Math.round(totalCaffeineThisMonth / thisMonthVideoCount)
      : null;

  // ── Productivity Score (Gamified Index) ───────────────────────────────────
  // Formula:
  //   Video Score: videos this month * 10 (capped at 100)
  //   Streak Bonus: streak * 5 (capped at 50)
  //   Revision Penalty: avg revisions > 2 → subtract (avgRevisions - 2) * 5
  const videoScore = Math.min(thisMonthVideoCount * 10, 100);
  const streakBonus = Math.min(streak * 5, 50);
  const revisionPenalty =
    avgRevisionsPerVideo && avgRevisionsPerVideo > 2
      ? Math.round((avgRevisionsPerVideo - 2) * 5)
      : 0;

  const productivityScore = Math.max(
    0,
    Math.round(videoScore + streakBonus - revisionPenalty)
  );

  return {
    revenuePerVideo,
    revenueCurrency,
    revenueThisMonthByCurrency,
    avgRevisionsPerVideo,
    videosPerActiveClient,
    consistencyStreak: streak,
    revenueGrowthPct,
    revenueGrowthCurrency: revenueCurrency,
    revenueGrowthByCurrency,
    videosGrowthPct,
    caffeinePerVideo,
    productivityScore,
  };
}
