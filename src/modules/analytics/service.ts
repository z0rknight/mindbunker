/**
 * War Room Analytics Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Isolated business logic for all War Room derived metrics.
 * Reads from DB directly — no cross-module coupling.
 * Future-ready: designed for ActivityWatch API webhook integration.
 */

import { getAuthenticatedDb } from "@/db";
import { transactions, videoLogs, clients, healthLogs } from "@/db/schema";
import { gte } from "drizzle-orm";
import { startOfMonthISO, daysAgoISO } from "@/utils/date";
import { completedVideoLogs } from "@/modules/productivity/core";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface IncomeIntelligence {
  /** Total income this month */
  monthlyRevenue: number;
  /** Revenue goal (R$20k) */
  revenueGoal: number;
  /** Progress % toward goal */
  revenueGoalPct: number;
  /** On track? (pacing check based on day of month) */
  onTrack: boolean;
  /** Revenue per video this month (flat-rate leverage metric) */
  effectiveFlatRateYield: number | null;
  /** Top 5 clients by revenue */
  topClientsByRevenue: Array<{ name: string; revenue: number; projects: number; effectiveYield: number | null }>;
  /** Revenue per video (all time) */
  revenuePerVideoAllTime: number | null;
}

export interface EfficiencyMetrics {
  /** Total revisions / videos delivered this month */
  revisionDragIndex: number | null;
  /** Revision drag tier */
  revisionDragTier: "elite" | "normal" | "friction";
  /** Videos delivered this month */
  videosThisMonth: number;
  /** Revenue per video this month */
  revenuePerVideo: number | null;
  /** Videos per active client this month */
  videosPerActiveClient: number | null;
  /** Active client count */
  activeClientCount: number;
  /** Client drain ranking: top 5 clients sorted by lowest effective yield */
  clientDrainRanking: Array<{ name: string; revenue: number; projects: number; effectiveYield: number | null }>;
}

export interface BiologicalCorrelation {
  /** Avg videos on days with sleep >= 7h (good sleep) */
  avgVideosGoodSleep: number | null;
  /** Avg videos on days with sleep < 5h (crash nights) */
  avgVideosCrashSleep: number | null;
  /** Avg videos on vampire nights (sleep after 4AM proxy: sleep < 4h) */
  avgVideosVampireNights: number | null;
  /** Total caffeine this month (mg) */
  totalCaffeineMonth: number;
  /** Caffeine per revenue ratio (mg / R$) */
  caffeinePerRevenue: number | null;
  /** Crash detector: true if 2+ nights <5h sleep AND output declining */
  crashDetected: boolean;
  /** Crash detector details */
  crashReason: string | null;
  /** Physical activity score (cycling + walking reduces crash penalty) */
  physicalActivityScore: number;
  /** Avg cycling km last 7 days */
  avgCyclingKm7d: number | null;
  /** Avg walking minutes last 7 days */
  avgWalkingMin7d: number | null;
  /** Physical activity timeline for last 7 days */
  activityTimeline: Array<{
    date: string;
    cyclingKm: number | null;
    walkingMinutes: number | null;
    totalActivity: number;
  }>;
}

export interface MomentumMetrics {
  /** Consecutive days with billable delivery */
  revenueStreak: number;
  /** Revenue growth % vs last month */
  revenueGrowthPct: number | null;
  /** Output (videos) growth % vs last month */
  outputGrowthPct: number | null;
  /** Revenue slope direction */
  revenueTrend: "up" | "down" | "flat";
  /** Output slope direction */
  outputTrend: "up" | "down" | "flat";
  /** Consistency streak (any log) */
  consistencyStreak: number;
}

export interface LeverageScore {
  /** Raw composite score */
  score: number;
  /** Level number (1-10) */
  level: number;
  /** Level title */
  levelTitle: string;
  /** Score breakdown for transparency */
  breakdown: {
    effectiveYieldBonus: number;
    revenueGrowthBonus: number;
    deepWorkBonus: number;
    revisionDragPenalty: number;
    crashPenalty: number;
    physicalActivityBonus: number;
    streakBonus: number;
  };
  /** XP to next level */
  xpToNextLevel: number;
  /** Max XP for current level */
  levelMaxXp: number;
}

export interface WarRoomData {
  income: IncomeIntelligence;
  efficiency: EfficiencyMetrics;
  biological: BiologicalCorrelation;
  momentum: MomentumMetrics;
  leverage: LeverageScore;
  generatedAt: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function startOfPrevMonthISO(): string {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prevMonth.toISOString().split("T")[0];
}

function endOfPrevMonthISO(): string {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  return lastDay.toISOString().split("T")[0];
}

function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function trendDirection(growthPct: number | null): "up" | "down" | "flat" {
  if (growthPct === null) return "flat";
  if (growthPct > 5) return "up";
  if (growthPct < -5) return "down";
  return "flat";
}

const LEVEL_THRESHOLDS = [0, 50, 120, 220, 350, 500, 680, 880, 1100, 1350, 1650];
const LEVEL_TITLES = [
  "Rookie",
  "Operator",
  "Grinder",
  "Specialist",
  "Tactician",
  "Strategist",
  "Enforcer",
  "Weaponized",
  "Apex",
  "Elite",
  "LEGEND",
];

function calculateLevel(score: number): { level: number; title: string; xpToNext: number; levelMax: number } {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  level = Math.min(level, 10);
  const xpToNext = level < 10 ? LEVEL_THRESHOLDS[level] - score : 0;
  const levelMax = level < 10 ? LEVEL_THRESHOLDS[level] - LEVEL_THRESHOLDS[level - 1] : LEVEL_THRESHOLDS[10] - LEVEL_THRESHOLDS[9];
  return {
    level,
    title: LEVEL_TITLES[level - 1] ?? "Elite",
    xpToNext: Math.max(0, xpToNext),
    levelMax,
  };
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

export async function getWarRoomData(): Promise<WarRoomData> {
  const db = await getAuthenticatedDb();
  const monthStart = startOfMonthISO();
  const prevMonthStart = startOfPrevMonthISO();
  const prevMonthEnd = endOfPrevMonthISO();
  const sevenDaysAgo = daysAgoISO(7);
  const thirtyDaysAgo = daysAgoISO(30);

  // ── Fetch all data in parallel ─────────────────────────────────────────────
  const [
    allTransactions,
    allVideoLogs,
    allClients,
    last30HealthLogs,
    last7HealthLogs,
  ] = await Promise.all([
    db.select().from(transactions),
    db.select().from(videoLogs),
    db.select().from(clients),
    db.select().from(healthLogs).where(gte(healthLogs.date, thirtyDaysAgo)),
    db.select().from(healthLogs).where(gte(healthLogs.date, sevenDaysAgo)),
  ]);

  // Partition data
  const thisMonthTransactions = allTransactions.filter((t) => t.date >= monthStart);
  const prevMonthTransactions = allTransactions.filter(
    (t) => t.date >= prevMonthStart && t.date <= prevMonthEnd
  );
  const allCompletedVideos = completedVideoLogs(allVideoLogs);
  const thisMonthVideos = allCompletedVideos.filter((v) => v.date >= monthStart);
  const prevMonthVideos = allCompletedVideos.filter(
    (v) => v.date >= prevMonthStart && v.date <= prevMonthEnd
  );
  const activeClients = allClients.filter((c) => c.status === "active");

  // ── INCOME INTELLIGENCE ───────────────────────────────────────────────────

  const REVENUE_GOAL = 20000;

  const monthlyRevenue = thisMonthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  // Pacing: what % of month has passed?
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthPacingPct = dayOfMonth / daysInMonth;
  const expectedRevenue = REVENUE_GOAL * monthPacingPct;
  const onTrack = monthlyRevenue >= expectedRevenue;

  const revenueGoalPct = Math.min(Math.round((monthlyRevenue / REVENUE_GOAL) * 100), 100);

  const thisMonthVideoCount = thisMonthVideos.length;
  const effectiveFlatRateYield =
    thisMonthVideoCount > 0
      ? Math.round(monthlyRevenue / thisMonthVideoCount)
      : null;

  // All-time revenue per video
  const allTimeRevenue = allTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const revenuePerVideoAllTime =
    allCompletedVideos.length > 0
      ? Math.round(allTimeRevenue / allCompletedVideos.length)
      : null;

  // Top clients by revenue (from CRM totalRevenue field)
  const topClientsByRevenue = [...activeClients]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5)
    .map((c) => ({
      name: c.name,
      revenue: c.totalRevenue,
      projects: c.totalProjects,
      effectiveYield:
        c.totalProjects > 0 ? Math.round(c.totalRevenue / c.totalProjects) : null,
    }));

  // ── EFFICIENCY METRICS ────────────────────────────────────────────────────

  const totalRevisions = thisMonthVideos.reduce((sum, v) => sum + v.revisionsCount, 0);
  const revisionDragIndex =
    thisMonthVideoCount > 0
      ? Math.round((totalRevisions / thisMonthVideoCount) * 100) / 100
      : null;

  const revisionDragTier: "elite" | "normal" | "friction" =
    revisionDragIndex === null
      ? "normal"
      : revisionDragIndex < 0.5
      ? "elite"
      : revisionDragIndex <= 1.2
      ? "normal"
      : "friction";

  const revenuePerVideo =
    thisMonthVideoCount > 0
      ? Math.round(monthlyRevenue / thisMonthVideoCount)
      : null;

  const videosPerActiveClient =
    activeClients.length > 0
      ? Math.round((thisMonthVideoCount / activeClients.length) * 10) / 10
      : null;

  // Client drain ranking: sorted by lowest effective yield (most draining first)
  const clientDrainRanking = [...activeClients]
    .map((c) => ({
      name: c.name,
      revenue: c.totalRevenue,
      projects: c.totalProjects,
      effectiveYield:
        c.totalProjects > 0 ? Math.round(c.totalRevenue / c.totalProjects) : null,
    }))
    .sort((a, b) => {
      if (a.effectiveYield === null) return -1;
      if (b.effectiveYield === null) return 1;
      return a.effectiveYield - b.effectiveYield;
    })
    .slice(0, 5);

  // ── BIOLOGICAL CORRELATION ────────────────────────────────────────────────

  // Map health logs by date for correlation
  const healthByDate = new Map(last30HealthLogs.map((h) => [h.date, h]));

  // Group completed output by date. Inventory states must not inflate output.
  const videoCountByDate = new Map<string, number>();
  allCompletedVideos.forEach((v) => {
    videoCountByDate.set(v.date, (videoCountByDate.get(v.date) ?? 0) + 1);
  });

  // Correlate sleep with output (last 30 days)
  const goodSleepDays: number[] = [];
  const crashSleepDays: number[] = [];
  const vampireNightDays: number[] = [];

  last30HealthLogs.forEach((h) => {
    const videosOnDay = videoCountByDate.get(h.date) ?? 0;
    if (h.sleepHours !== null) {
      if (h.sleepHours >= 7) goodSleepDays.push(videosOnDay);
      if (h.sleepHours < 5) crashSleepDays.push(videosOnDay);
      if (h.sleepHours < 4) vampireNightDays.push(videosOnDay);
    }
  });

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;

  const avgVideosGoodSleep = avg(goodSleepDays);
  const avgVideosCrashSleep = avg(crashSleepDays);
  const avgVideosVampireNights = avg(vampireNightDays);

  // Caffeine metrics
  const thisMonthHealthLogs = last30HealthLogs.filter((h) => h.date >= monthStart);
  const totalCaffeineMonth = thisMonthHealthLogs.reduce(
    (sum, h) => sum + (h.caffeineMg ?? 0),
    0
  );
  const caffeinePerRevenue =
    monthlyRevenue > 0
      ? Math.round((totalCaffeineMonth / monthlyRevenue) * 100) / 100
      : null;

  // Crash detector: 2+ nights <5h sleep in last 7 days AND output declining
  const recentSleepLogs = last7HealthLogs.filter(
    (h) => h.sleepHours !== null && h.sleepHours < 5
  );
  const crashSleepCount = recentSleepLogs.length;

  // Output declining: compare last 7 days vs previous 7 days
  const last7Videos = allCompletedVideos.filter(
    (v) => v.date >= sevenDaysAgo,
  ).length;
  const prev7Start = daysAgoISO(14);
  const prev7Videos = allCompletedVideos.filter(
    (v) => v.date >= prev7Start && v.date < sevenDaysAgo
  ).length;
  const outputDeclining = last7Videos < prev7Videos;

  const crashDetected = crashSleepCount >= 2 && outputDeclining;
  const crashReason = crashDetected
    ? `${crashSleepCount} nights <5h sleep in last 7 days + output declining (${last7Videos} vs ${prev7Videos} videos)`
    : crashSleepCount >= 2
    ? `${crashSleepCount} nights <5h sleep detected — monitor output`
    : null;

  // Physical activity score (reduces crash penalty)
  const totalCyclingKm7d = last7HealthLogs.reduce((sum, h) => sum + (h.cyclingKm ?? 0), 0);
  const totalWalkingMin7d = last7HealthLogs.reduce((sum, h) => sum + (h.walkingMinutes ?? 0), 0);
  const physicalActivityScore = Math.min(
    Math.round(totalCyclingKm7d * 2 + totalWalkingMin7d * 0.5),
    50
  );

  const avgCyclingKm7d =
    last7HealthLogs.filter((h) => h.cyclingKm !== null && h.cyclingKm > 0).length > 0
      ? Math.round((totalCyclingKm7d / 7) * 10) / 10
      : null;
  const avgWalkingMin7d =
    last7HealthLogs.filter((h) => h.walkingMinutes !== null && h.walkingMinutes > 0).length > 0
      ? Math.round(totalWalkingMin7d / 7)
      : null;

  // Physical activity timeline for last 7 days
  const activityTimeline = last7HealthLogs
    .map((h) => ({
      date: h.date,
      cyclingKm: h.cyclingKm,
      walkingMinutes: h.walkingMinutes,
      totalActivity: (h.cyclingKm ?? 0) * 2 + (h.walkingMinutes ?? 0) * 0.5,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── MOMENTUM METRICS ──────────────────────────────────────────────────────

  // Revenue streak: consecutive days with at least one income transaction
  let revenueStreak = 0;
  const checkDate = new Date();
  for (let i = 0; i < 60; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    const hasIncome = allTransactions.some(
      (t) => t.type === "income" && t.date === dateStr
    );
    if (hasIncome) {
      revenueStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Consistency streak (any log)
  const loggedDates = new Set<string>();
  allVideoLogs.forEach((v) => loggedDates.add(v.date));
  last30HealthLogs.forEach((h) => loggedDates.add(h.date));
  allTransactions.forEach((t) => loggedDates.add(t.date));

  let consistencyStreak = 0;
  const streakCheck = new Date();
  for (let i = 0; i < 30; i++) {
    const dateStr = streakCheck.toISOString().split("T")[0];
    if (loggedDates.has(dateStr)) {
      consistencyStreak++;
      streakCheck.setDate(streakCheck.getDate() - 1);
    } else {
      break;
    }
  }

  // Revenue growth
  const prevMonthRevenue = prevMonthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const revenueGrowthPct = growthPct(monthlyRevenue, prevMonthRevenue);
  const revenueTrend = trendDirection(revenueGrowthPct);

  // Output growth
  const outputGrowthPct = growthPct(thisMonthVideoCount, prevMonthVideos.length);
  const outputTrend = trendDirection(outputGrowthPct);

  // ── LEVERAGE SCORE ────────────────────────────────────────────────────────

  // Effective yield bonus: +5 per R$100 effective yield (capped at 200)
  const effectiveYieldBonus = effectiveFlatRateYield
    ? Math.min(Math.round((effectiveFlatRateYield / 100) * 5), 200)
    : 0;

  // Revenue growth bonus: +3 per % growth (capped at 150)
  const revenueGrowthBonus = revenueGrowthPct
    ? Math.min(Math.max(revenueGrowthPct * 3, 0), 150)
    : 0;

  // Deep work bonus: placeholder (ActivityWatch integration future)
  // For now: +2 per video this month (capped at 100)
  const deepWorkBonus = Math.min(thisMonthVideoCount * 2, 100);

  // Revision drag penalty: -4 per 0.1 above 0.5 threshold
  const revisionDragPenalty =
    revisionDragIndex !== null && revisionDragIndex > 0.5
      ? Math.round((revisionDragIndex - 0.5) * 40)
      : 0;

  // Crash penalty: -50 if crash detected, -20 if warning
  const crashPenalty = crashDetected ? 50 : crashSleepCount >= 2 ? 20 : 0;

  // Physical activity bonus: up to +50
  const physicalActivityBonus = physicalActivityScore;

  // Streak bonus: +5 per day (capped at 50)
  const streakBonus = Math.min(consistencyStreak * 5, 50);

  const rawScore =
    effectiveYieldBonus +
    revenueGrowthBonus +
    deepWorkBonus +
    physicalActivityBonus +
    streakBonus -
    revisionDragPenalty -
    crashPenalty;

  const finalScore = Math.max(0, Math.round(rawScore));
  const { level, title, xpToNext, levelMax } = calculateLevel(finalScore);

  return {
    income: {
      monthlyRevenue,
      revenueGoal: REVENUE_GOAL,
      revenueGoalPct,
      onTrack,
      effectiveFlatRateYield,
      topClientsByRevenue,
      revenuePerVideoAllTime,
    },
    efficiency: {
      revisionDragIndex,
      revisionDragTier,
      videosThisMonth: thisMonthVideoCount,
      revenuePerVideo,
      videosPerActiveClient,
      activeClientCount: activeClients.length,
      clientDrainRanking,
    },
    biological: {
      avgVideosGoodSleep,
      avgVideosCrashSleep,
      avgVideosVampireNights,
      totalCaffeineMonth,
      caffeinePerRevenue,
      crashDetected,
      crashReason,
      physicalActivityScore,
      avgCyclingKm7d,
      avgWalkingMin7d,
      activityTimeline,
    },
    momentum: {
      revenueStreak,
      revenueGrowthPct,
      outputGrowthPct,
      revenueTrend,
      outputTrend,
      consistencyStreak,
    },
    leverage: {
      score: finalScore,
      level,
      levelTitle: title,
      breakdown: {
        effectiveYieldBonus,
        revenueGrowthBonus,
        deepWorkBonus,
        revisionDragPenalty,
        crashPenalty,
        physicalActivityBonus,
        streakBonus,
      },
      xpToNextLevel: xpToNext,
      levelMaxXp: levelMax,
    },
    generatedAt: new Date().toISOString(),
  };
}
