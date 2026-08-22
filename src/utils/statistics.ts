/**
 * Performance Statistics Utility
 * Isolated calculation layer for derived/gamified metrics.
 * All inputs come from module data — no direct DB access here.
 * Future-ready: add correlation metrics, scoring formulas, etc.
 */

import { getAuthenticatedDb } from "@/db";
import { transactions, videoLogs, clients, healthLogs } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { startOfMonthISO, daysAgoISO, todayISO } from "@/utils/date";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface PerformanceStats {
  // Revenue per video this month
  revenuePerVideo: number | null;

  // Average revisions per video this month
  avgRevisionsPerVideo: number | null;

  // Videos per active client this month
  videosPerActiveClient: number | null;

  // Consecutive days with at least one log (video, health, or finance)
  consistencyStreak: number;

  // Revenue growth % vs previous month (null if no previous data)
  revenueGrowthPct: number | null;

  // Videos growth % vs previous month (null if no previous data)
  videosGrowthPct: number | null;

  // Caffeine per video this month (mg / videos)
  caffeinePerVideo: number | null;

  // Composite productivity score (gamified index)
  productivityScore: number;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function startOfPrevMonthISO(): string {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prevMonth.toISOString().split("T")[0];
}

function endOfPrevMonthISO(): string {
  const now = new Date();
  // Last day of previous month = day 0 of current month
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  return lastDay.toISOString().split("T")[0];
}

function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

export async function getPerformanceStats(): Promise<PerformanceStats> {
  const db = await getAuthenticatedDb();
  const monthStart = startOfMonthISO();
  const prevMonthStart = startOfPrevMonthISO();
  const prevMonthEnd = endOfPrevMonthISO();
  const today = todayISO();
  const thirtyDaysAgo = daysAgoISO(30);

  // Fetch all needed data in parallel
  const [
    thisMonthTransactions,
    prevMonthTransactions,
    thisMonthVideos,
    prevMonthVideos,
    activeClients,
    last30DaysHealthLogs,
    last30DaysVideoLogs,
    last30DaysFinanceTransactions,
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
    db.select().from(videoLogs).where(gte(videoLogs.date, thirtyDaysAgo)),
    db
      .select()
      .from(transactions)
      .where(gte(transactions.date, thirtyDaysAgo)),
  ]);

  // ── Revenue per Video ──────────────────────────────────────────────────────
  const thisMonthRevenue = thisMonthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const thisMonthVideoCount = thisMonthVideos.length;

  const revenuePerVideo =
    thisMonthVideoCount > 0
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
  const activeClientCount = activeClients.filter(
    (c) => c.status === "active"
  ).length;
  const videosPerActiveClient =
    activeClientCount > 0
      ? Math.round((thisMonthVideoCount / activeClientCount) * 10) / 10
      : null;

  // ── Consistency Streak ────────────────────────────────────────────────────
  // Build a set of dates that have at least one log (video, health, or finance)
  const loggedDates = new Set<string>();

  last30DaysVideoLogs.forEach((v) => loggedDates.add(v.date));
  last30DaysHealthLogs.forEach((h) => loggedDates.add(h.date));
  last30DaysFinanceTransactions.forEach((t) => loggedDates.add(t.date));

  // Count consecutive days backwards from today
  let streak = 0;
  let checkDate = new Date();
  for (let i = 0; i < 30; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    if (loggedDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // ── Revenue Growth % ──────────────────────────────────────────────────────
  const prevMonthRevenue = prevMonthTransactions
    .filter(
      (t) => t.type === "income" && t.date >= prevMonthStart && t.date <= prevMonthEnd
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const revenueGrowthPct = growthPct(thisMonthRevenue, prevMonthRevenue);

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
  //   Revenue Score: revenue per video / 10 (capped at 100)
  //   Streak Bonus: streak * 5 (capped at 50)
  //   Revision Penalty: avg revisions > 2 → subtract (avgRevisions - 2) * 5
  const videoScore = Math.min(thisMonthVideoCount * 10, 100);
  const revenueScore = revenuePerVideo ? Math.min(revenuePerVideo / 10, 100) : 0;
  const streakBonus = Math.min(streak * 5, 50);
  const revisionPenalty =
    avgRevisionsPerVideo && avgRevisionsPerVideo > 2
      ? Math.round((avgRevisionsPerVideo - 2) * 5)
      : 0;

  const productivityScore = Math.max(
    0,
    Math.round(videoScore + revenueScore + streakBonus - revisionPenalty)
  );

  return {
    revenuePerVideo,
    avgRevisionsPerVideo,
    videosPerActiveClient,
    consistencyStreak: streak,
    revenueGrowthPct,
    videosGrowthPct,
    caffeinePerVideo,
    productivityScore,
  };
}
