/**
 * War Room Analytics Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Isolated business logic for all War Room derived metrics.
 * Reads from DB directly — no cross-module coupling.
 * Future-ready: designed for ActivityWatch API webhook integration.
 */

import { getAuthenticatedDb } from "@/db";
import { transactions, videoLogs, clients, healthLogs, caffeineEvents, projects, workSessions } from "@/db/schema";
import { DEFAULT_CURRENCY } from "@/modules/finance/config";
import { gte, isNotNull } from "drizzle-orm";
import {
  inclusiveWindowStartISO,
  operatorDateKey,
  operatorMonthProgress,
  previousMonthComparableRangeISO,
  shiftDateKey,
  startOfMonthISO,
} from "@/utils/date";
import { completedVideoLogs } from "@/modules/productivity/core";
import { caffeineDayKey, reconcileDailyCaffeineMg, computeCoffeesPerVideo } from "@/modules/caffeine/core";
import {
  amountForCurrency,
  computeConsistencyStreak,
  consistencyStreakFromSessions,
  computeGoalProgress,
  growthByCurrency,
  hasComparableTrendSample,
  isActiveExternalClient,
  sumIncomeByCurrency,
  type CurrencyAmount,
} from "./core";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface IncomeIntelligence {
  /** Income in the explicit goal currency only. */
  monthlyRevenue: number | null;
  monthlyRevenueByCurrency: CurrencyAmount[];
  revenueCurrency: string;
  /** Revenue goal (R$20k) */
  revenueGoal: number;
  /** Progress % toward goal */
  revenueGoalPct: number | null;
  /** On track? (pacing check based on day of month) */
  onTrack: boolean | null;
  /** Revenue per video this month (flat-rate leverage metric) */
  effectiveFlatRateYield: number | null;
  /** Top 5 (client, currency) entries by revenue -- never summed across
   * currencies for one client; see getWarRoomAnalytics for the note. */
  topClientsByRevenue: Array<{
    name: string;
    currency: string;
    revenue: number;
    projects: number;
    effectiveYield: number | null;
  }>;
  /** Revenue per video (all time) */
  revenuePerVideoAllTime: number | null;
}

export interface EfficiencyMetrics {
  /** Raw revisions attached to completed videos this month */
  totalRevisions: number;
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
  /** Client drain ranking: top 5 (client, currency) entries sorted by
   * lowest effective yield -- see topClientsByRevenue's note above. */
  clientDrainRanking: Array<{
    name: string;
    currency: string;
    revenue: number;
    projects: number;
    effectiveYield: number | null;
  }>;
}

export interface BiologicalCorrelation {
  /** Avg videos on days with sleep >= 7h (good sleep) */
  avgVideosGoodSleep: number | null;
  goodSleepSampleCount: number;
  /** Avg videos on days with sleep < 5h (crash nights) */
  avgVideosCrashSleep: number | null;
  crashSleepSampleCount: number;
  /** Avg videos on vampire nights (sleep after 4AM proxy: sleep < 4h) */
  avgVideosVampireNights: number | null;
  vampireSleepSampleCount: number;
  /** Total caffeine this month (mg) */
  totalCaffeineMonth: number;
  /** Days whose caffeine total came from a precise manual entry. */
  manualCaffeineDaysMonth: number;
  /** Days whose caffeine total was estimated from quick coffee events. */
  estimatedCaffeineDaysMonth: number;
  /** Total quick-logged coffees (servings) this month -- no mg inference,
   *  same honest source as "Coffees Today/This Week". */
  totalCoffeesMonth: number;
  /** Coffees per completed video this month. Lunch Reality Patch P1 §6:
   *  replaces the old mg/R$ "Caffeine Ratio". Null when no videos
   *  completed this month yet, never a fake 0. */
  coffeesPerVideo: number | null;
  /** Crash detector: true if 2+ nights <5h sleep AND output declining */
  crashDetected: boolean;
  /** Crash detector details */
  crashReason: string | null;
  /** Physical activity score (cycling + walking reduces crash penalty) */
  physicalActivityScore: number;
  /** Avg cycling km last 7 days */
  avgCyclingKm7d: number | null;
  cyclingSampleCount7d: number;
  /** Avg walking minutes last 7 days */
  avgWalkingMin7d: number | null;
  walkingSampleCount7d: number;
  /** Physical activity timeline for last 7 days */
  activityTimeline: Array<{
    date: string;
    cyclingKm: number | null;
    walkingMinutes: number | null;
    totalActivity: number;
  }>;
}

export interface MomentumMetrics {
  /** Consecutive days with a recorded income transaction */
  revenueStreak: number;
  /** Revenue growth % vs last month */
  revenueGrowthPct: number | null;
  revenueGrowthCurrency: string;
  /** Output (videos) growth % vs last month */
  outputGrowthPct: number | null;
  /** Revenue slope direction */
  revenueTrend: "up" | "down" | "flat";
  /** Output slope direction */
  outputTrend: "up" | "down" | "flat";
  /** Consistency streak (any log) */
  consistencyStreak: number;
  /** Number of elapsed calendar days used by the MTD comparison. */
  comparableDays: number;
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
    outputVolumeBonus: number;
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

function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
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
  const now = new Date();
  const monthStart = startOfMonthISO(now);
  const previousMonth = previousMonthComparableRangeISO(now);
  const prevMonthStart = previousMonth.start;
  const prevMonthEnd = previousMonth.end;
  const today = operatorDateKey(now);
  const sevenDaysAgo = inclusiveWindowStartISO(7, now);
  const thirtyDaysAgo = inclusiveWindowStartISO(30, now);

  // ── Fetch all data in parallel ─────────────────────────────────────────────
  const [
    allTransactions,
    allVideoLogs,
    allClients,
    allProjectRows,
    last30HealthLogs,
    last7HealthLogs,
    thisMonthCaffeineEvents,
    closedWorkSessions,
  ] = await Promise.all([
    db.select().from(transactions),
    db.select().from(videoLogs),
    db.select().from(clients),
    // Sprint 3 P2 (fixes the confirmed stale clients.totalProjects /
    // totalRevenue usage below -- same root cause as the CRM Client
    // Intelligence P0 fix).
    db.select({ id: projects.id, clientId: projects.clientId }).from(projects),
    db.select().from(healthLogs).where(gte(healthLogs.date, thirtyDaysAgo)),
    db.select().from(healthLogs).where(gte(healthLogs.date, sevenDaysAgo)),
    db
      .select({ occurredAt: caffeineEvents.occurredAt, servings: caffeineEvents.servings })
      .from(caffeineEvents)
      .where(gte(caffeineEvents.occurredAt, new Date(`${monthStart}T00:00:00-03:00`))),
    db
      .select({ startedAt: workSessions.startedAt, endedAt: workSessions.endedAt })
      .from(workSessions)
      .where(isNotNull(workSessions.endedAt)),
  ]);

  // Partition data
  const thisMonthTransactions = allTransactions.filter((t) => t.date >= monthStart && t.date <= today);
  const prevMonthTransactions = allTransactions.filter(
    (t) => t.date >= prevMonthStart && t.date <= prevMonthEnd
  );
  const allCompletedVideos = completedVideoLogs(allVideoLogs);
  const thisMonthVideos = allCompletedVideos.filter((v) => v.date >= monthStart && v.date <= today);
  const prevMonthVideos = allCompletedVideos.filter(
    (v) => v.date >= prevMonthStart && v.date <= prevMonthEnd
  );
  // Geladeira (Sprint 1.2 P0): War Room already scoped "active" to
  // status === "active"; now also excludes Geladeira clients so an
  // archived-but-still-status-active client stops appearing in top-client
  // revenue rankings and client-drain ranking once archived.
  // Quick Morning Reality Patch §6: RMEDIA's own internal `clients` row
  // (used to log internal Operations/Marketing/Administration/Product
  // work) is not a real client relationship -- excluded the same way
  // Geladeira clients are, so it never appears in "Top Clients by
  // Revenue" or the client-drain ranking below. Name-based, presentation
  // scoped to this War Room read model only; no schema change.
  const activeClients = allClients.filter(isActiveExternalClient);

  // Sprint 3 P2: live project counts and per-currency income, replacing
  // the stale clients.totalProjects / clients.totalRevenue columns (see
  // getClientIntelligence in modules/crm/actions.ts for the full
  // root-cause note -- same bug, different surface). Both maps are
  // built once here from data already fetched above, no extra queries.
  const projectCountByClientId = new Map<number, number>();
  for (const row of allProjectRows) {
    projectCountByClientId.set(
      row.clientId,
      (projectCountByClientId.get(row.clientId) ?? 0) + 1,
    );
  }
  const incomeByClientCurrency = new Map<number, Map<string, number>>();
  for (const t of allTransactions) {
    if (t.type !== "income" || t.clientId === null) continue;
    const byCurrency = incomeByClientCurrency.get(t.clientId) ?? new Map<string, number>();
    byCurrency.set(t.currency, (byCurrency.get(t.currency) ?? 0) + t.amount);
    incomeByClientCurrency.set(t.clientId, byCurrency);
  }
  // One entry per (active client, currency they actually have income in) --
  // never merged across currencies. A client with zero recorded income
  // still gets exactly one entry at revenue 0 (DEFAULT_CURRENCY is just a
  // label here since zero is zero in any currency), so clients aren't
  // silently dropped from ranking coverage.
  function clientRevenueEntries() {
    return activeClients.flatMap((c) => {
      const projectsCount = projectCountByClientId.get(c.id) ?? 0;
      const byCurrency = incomeByClientCurrency.get(c.id);
      const currencyRows =
        byCurrency && byCurrency.size > 0
          ? Array.from(byCurrency, ([currency, revenue]) => ({ currency, revenue }))
          : [{ currency: DEFAULT_CURRENCY, revenue: 0 }];
      return currencyRows.map(({ currency, revenue }) => ({
        name: c.name,
        currency,
        revenue,
        projects: projectsCount,
        effectiveYield: projectsCount > 0 ? Math.round(revenue / projectsCount) : null,
      }));
    });
  }

  // ── INCOME INTELLIGENCE ───────────────────────────────────────────────────

  const REVENUE_GOAL = 20000;
  const REVENUE_CURRENCY = "BRL";
  const monthlyRevenueByCurrency = sumIncomeByCurrency(thisMonthTransactions);
  const monthProgress = operatorMonthProgress(now);
  const goalProgress = computeGoalProgress({
    revenueByCurrency: monthlyRevenueByCurrency,
    goalAmount: REVENUE_GOAL,
    goalCurrency: REVENUE_CURRENCY,
    ...monthProgress,
  });
  const monthlyRevenue = goalProgress.revenue;
  const onTrack = goalProgress.onTrack;
  const revenueGoalPct = goalProgress.pct;

  const thisMonthVideoCount = thisMonthVideos.length;
  const effectiveFlatRateYield =
    thisMonthVideoCount > 0 && monthlyRevenue !== null
      ? Math.round(monthlyRevenue / thisMonthVideoCount)
      : null;

  // All-time revenue per video
  const allTimeRevenue = amountForCurrency(
    sumIncomeByCurrency(allTransactions),
    REVENUE_CURRENCY,
  );
  const revenuePerVideoAllTime =
    allCompletedVideos.length > 0
      ? Math.round(allTimeRevenue / allCompletedVideos.length)
      : null;

  // Top (client, currency) entries by revenue -- see clientRevenueEntries
  // above. Sorting mixed currencies together by raw amount is a known,
  // narrow simplification (a $500 entry outranks a R$2000 entry) rather
  // than an invented FX conversion -- Sprint C's FX ledger is the correct
  // place to make these comparable; not fabricated here.
  const topClientsByRevenue = clientRevenueEntries()
    .filter((entry) => entry.revenue > 0)
    .sort((a, b) => a.currency.localeCompare(b.currency) || b.revenue - a.revenue);

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
    thisMonthVideoCount > 0 && monthlyRevenue !== null
      ? Math.round(monthlyRevenue / thisMonthVideoCount)
      : null;

  const videosPerActiveClient =
    activeClients.length > 0
      ? Math.round((thisMonthVideoCount / activeClients.length) * 10) / 10
      : null;

  // Client drain ranking: sorted by lowest effective yield (most draining
  // first) -- see clientRevenueEntries above and the currency-mixing note
  // on topClientsByRevenue, which applies here too.
  const clientDrainRanking = clientRevenueEntries()
    .sort((a, b) => {
      const currencyOrder = a.currency.localeCompare(b.currency);
      if (currencyOrder !== 0) return currencyOrder;
      if (a.effectiveYield === null) return -1;
      if (b.effectiveYield === null) return 1;
      return a.effectiveYield - b.effectiveYield;
    });

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

  // Caffeine metrics — reconciled across BOTH tracking paths (manual
  // health_logs.caffeineMg entries and "+1 Coffee" quick-log events), see
  // reconcileDailyCaffeineMg for why these are max()'d per day rather than
  // summed. Monday Real-Operation Pre-Freeze §14 fix: previously this only
  // read health_logs.caffeineMg, so quick-logged coffee never moved this
  // number even though it was visible elsewhere (Health page "Coffees
  // Today").
  const thisMonthHealthLogs = last30HealthLogs.filter((h) => h.date >= monthStart);
  const manualCaffeineMgByDay = new Map(
    thisMonthHealthLogs.map((h) => [h.date, h.caffeineMg]),
  );
  const quickLogServingsByDay = new Map<string, number>();
  for (const event of thisMonthCaffeineEvents) {
    const dayKey = caffeineDayKey(event.occurredAt.toISOString());
    if (dayKey < monthStart || dayKey > today) continue;
    quickLogServingsByDay.set(
      dayKey,
      (quickLogServingsByDay.get(dayKey) ?? 0) + event.servings,
    );
  }
  const caffeineDayKeys = new Set([
    ...manualCaffeineMgByDay.keys(),
    ...quickLogServingsByDay.keys(),
  ]);
  const totalCaffeineMonth = Array.from(caffeineDayKeys).reduce(
    (sum, day) =>
      sum +
      reconcileDailyCaffeineMg(
        manualCaffeineMgByDay.get(day) ?? null,
        quickLogServingsByDay.get(day) ?? 0,
      ),
    0,
  );
  const manualCaffeineDaysMonth = Array.from(caffeineDayKeys).filter(
    (day) => manualCaffeineMgByDay.get(day) !== null && manualCaffeineMgByDay.get(day) !== undefined,
  ).length;
  const estimatedCaffeineDaysMonth = Array.from(caffeineDayKeys).filter(
    (day) =>
      (manualCaffeineMgByDay.get(day) === null || manualCaffeineMgByDay.get(day) === undefined) &&
      (quickLogServingsByDay.get(day) ?? 0) > 0,
  ).length;
  const totalCoffeesMonth = Array.from(quickLogServingsByDay.values()).reduce(
    (sum, servings) => sum + servings,
    0,
  );
  const coffeesPerVideo = computeCoffeesPerVideo(totalCoffeesMonth, thisMonthVideos.length);

  // Crash detector: 2+ nights <5h sleep in last 7 days AND output declining
  const recentSleepLogs = last7HealthLogs.filter(
    (h) => h.sleepHours !== null && h.sleepHours < 5
  );
  const crashSleepCount = recentSleepLogs.length;

  // Output declining: compare last 7 days vs previous 7 days
  const last7Videos = allCompletedVideos.filter(
    (v) => v.date >= sevenDaysAgo,
  ).length;
  const prev7Start = shiftDateKey(sevenDaysAgo, -7);
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

  const cyclingSampleCount7d = last7HealthLogs.filter((h) => h.cyclingKm !== null).length;
  const walkingSampleCount7d = last7HealthLogs.filter((h) => h.walkingMinutes !== null).length;
  const avgCyclingKm7d = cyclingSampleCount7d > 0
    ? Math.round((totalCyclingKm7d / cyclingSampleCount7d) * 10) / 10
    : null;
  const avgWalkingMin7d = walkingSampleCount7d > 0
    ? Math.round(totalWalkingMin7d / walkingSampleCount7d)
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

  const revenueStreak = computeConsistencyStreak(
    allTransactions
      .filter((transaction) => transaction.type === "income")
      .map((transaction) => transaction.date),
    operatorDateKey(now),
  );

  const consistencyStreak = consistencyStreakFromSessions(closedWorkSessions, now);

  // Revenue growth
  const previousRevenueByCurrency = sumIncomeByCurrency(prevMonthTransactions);
  const rawRevenueGrowthPct = growthByCurrency(
    monthlyRevenueByCurrency,
    previousRevenueByCurrency,
  ).find((row) => row.currency === REVENUE_CURRENCY)?.growthPct ?? null;
  const comparableDays = monthProgress.dayOfMonth;
  const revenueGrowthPct = hasComparableTrendSample(comparableDays)
    ? rawRevenueGrowthPct
    : null;
  const revenueTrend = trendDirection(revenueGrowthPct);

  // Output growth
  const outputGrowthPct = hasComparableTrendSample(comparableDays)
    ? growthPct(thisMonthVideoCount, prevMonthVideos.length)
    : null;
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

  // Output volume bonus: +2 per video delivered this month (capped at
  // 100). Renamed from "deepWorkBonus" (Sunday Systems Round, Phase F,
  // RMEDIA_OPERATIONAL_INVARIANTS.md rule on honest metric naming) --
  // this has only ever counted completed videos, never time or effort, so
  // it must not carry a name that implies a future time-based signal. If
  // a real deep-work/focus-time metric is ever built from work_sessions or
  // a sensor, it is a separate, honestly-named metric alongside this one,
  // never a silent redefinition of it.
  const outputVolumeBonus = Math.min(thisMonthVideoCount * 2, 100);

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
    outputVolumeBonus +
    physicalActivityBonus +
    streakBonus -
    revisionDragPenalty -
    crashPenalty;

  const finalScore = Math.max(0, Math.round(rawScore));
  const { level, title, xpToNext, levelMax } = calculateLevel(finalScore);

  return {
    income: {
      monthlyRevenue,
      monthlyRevenueByCurrency,
      revenueCurrency: REVENUE_CURRENCY,
      revenueGoal: REVENUE_GOAL,
      revenueGoalPct,
      onTrack,
      effectiveFlatRateYield,
      topClientsByRevenue,
      revenuePerVideoAllTime,
    },
    efficiency: {
      totalRevisions,
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
      goodSleepSampleCount: goodSleepDays.length,
      avgVideosCrashSleep,
      crashSleepSampleCount: crashSleepDays.length,
      avgVideosVampireNights,
      vampireSleepSampleCount: vampireNightDays.length,
      totalCaffeineMonth,
      manualCaffeineDaysMonth,
      estimatedCaffeineDaysMonth,
      totalCoffeesMonth,
      coffeesPerVideo,
      crashDetected,
      crashReason,
      physicalActivityScore,
      avgCyclingKm7d,
      cyclingSampleCount7d,
      avgWalkingMin7d,
      walkingSampleCount7d,
      activityTimeline,
    },
    momentum: {
      revenueStreak,
      revenueGrowthPct,
      revenueGrowthCurrency: REVENUE_CURRENCY,
      outputGrowthPct,
      revenueTrend,
      outputTrend,
      consistencyStreak,
      comparableDays,
    },
    leverage: {
      score: finalScore,
      level,
      levelTitle: title,
      breakdown: {
        effectiveYieldBonus,
        revenueGrowthBonus,
        outputVolumeBonus,
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
