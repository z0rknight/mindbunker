import { getWarRoomData } from "@/modules/analytics/service";
import {
  getActiveSignals,
  getOpenCommitmentsWithContext,
  rankOpenCommitments,
  type Signal,
  type SignalConfidence,
  type SignalSeverity,
} from "@/modules/signals";
import { getDailyLedger, type DailyLedgerRow } from "@/modules/daily-ledger";
import { listOpenDecisions, type OpenDecisionRow } from "@/modules/decisions/actions";
import { getClientHoursForPeriod, getRateEquivalentsForPeriod } from "@/modules/finance/actions";
import { getCRMSummary } from "@/modules/crm/actions";
import { mondayOfWeek } from "@/modules/work-sessions/core";
import { ActiveCommitmentCard } from "@/components/commitments/ActiveCommitmentCard";
import { OpenDecisionCard, RecordDecisionButton } from "./DecisionControls";
import { formatCurrency, startOfMonthISO, todayISO } from "@/utils/date";
import Link from "next/link";
import { WarRoomRefreshControl } from "./WarRoomRefreshControl";
import { getWorkSessionOverview } from "@/modules/work-sessions/data";
import { getLastActiveByClient } from "@/modules/work-sessions/data";
import {
  getAllVideoLogs,
  getOpenBlockersByVideo,
  getSoonestOpenCommitmentByVideo,
} from "@/modules/productivity/actions";
import { selectExecutionQueue, selectNextExecutable } from "@/modules/productivity/queue";
import { getVideoNextAction } from "@/modules/productivity/core";
import { NowFocusPanel } from "@/components/work-sessions/NowFocusPanel";
import { PixelDivider, PixelIcon } from "@/components/ui/PixelVisuals";
import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { getProductionOrders } from "@/modules/production-orders/data";
import { getRestaurantClientCandidates } from "@/modules/war-room/data";
import { getClientProjectCommercialAttribution } from "@/modules/finance/actions";
import { getOpenSensorSessionOverview } from "@/modules/sensor/data";
import { selectRestaurantClients, buildRestaurantViewModel } from "@/modules/war-room/restaurant-core";
import { WarRoomRestaurantStage } from "./restaurant/WarRoomRestaurantStage";

export const dynamic = "force-dynamic";

const WAR_ROOM_COMMITMENT_LIMIT = 5;

export default async function WarRoomPage() {
  const today = todayISO();
  const now = new Date();
  // Incident fix (2026-09-08): getOpenCommitmentsWithContext() used to be
  // requested twice per War Room render -- once here for
  // ActiveCommitmentsSection, once again inside getActiveSignals's own
  // Promise.all. Fetching it once and handing the same resolved rows to
  // both removes the duplicate query without changing either result.
  const openCommitmentsPromise = getOpenCommitmentsWithContext();
  const [
    data,
    signals,
    dailyLedger,
    openDecisions,
    weekEstimates,
    monthHours,
    crmSummary,
    openCommitments,
    workSessionOverview,
    videos,
    blockerMap,
    commitmentMap,
    restaurantClientCandidates,
    productionOrders,
    lastActiveByClient,
    sensorOverview,
  ] = await Promise.all([
    getWarRoomData(),
    openCommitmentsPromise.then((rows) => getActiveSignals(rows)),
    getDailyLedger(7),
    listOpenDecisions(),
    getRateEquivalentsForPeriod(mondayOfWeek(today), today),
    getClientHoursForPeriod(startOfMonthISO(), today),
    getCRMSummary(),
    openCommitmentsPromise,
    getWorkSessionOverview(),
    getAllVideoLogs(),
    getOpenBlockersByVideo(),
    getSoonestOpenCommitmentByVideo(),
    getRestaurantClientCandidates(),
    getProductionOrders(),
    getLastActiveByClient(),
    getOpenSensorSessionOverview(),
  ]);
  const { openSensorSession, openSensorSessionElapsedSeconds } = sensorOverview;

  // Restaurant View (War Room Restaurant View V1): select the bounded
  // 6-8 relevant clients first (pure, from data already fetched above --
  // no extra query), THEN fetch canonical commercial attribution only for
  // those selected clients. This keeps the feature at a fixed, small
  // number of extra queries regardless of total client count instead of
  // an N+1 over every client in the database.
  const selectedRestaurantClients = selectRestaurantClients(
    restaurantClientCandidates,
    videos,
    new Set(blockerMap.keys()),
    lastActiveByClient,
  );
  const restaurantCommercialEntries = await Promise.all(
    selectedRestaurantClients.map(
      async (client) => [client.id, await getClientProjectCommercialAttribution(client.id)] as const,
    ),
  );
  const restaurantViewModel = buildRestaurantViewModel({
    selectedClients: selectedRestaurantClients,
    commercialByClientId: new Map(restaurantCommercialEntries),
    productionOrders,
    openSession: workSessionOverview.openSession,
    openSessionElapsedSeconds: workSessionOverview.openSessionElapsedSeconds,
    openSessionStale: workSessionOverview.openSessionStale,
    openSensorSession,
    openSensorSessionElapsedSeconds,
  });
  const { income, efficiency, biological, momentum } = data;
  // Only overdue + due-soon (next 48h) commitments belong here -- War
  // Room is "exceções / visão situacional" (brief's own surface
  // language), not a full deadline browser.
  const relevantCommitments = rankOpenCommitments(openCommitments, now)
    .filter((c) => c.dueAt.getTime() < now.getTime() + 48 * 60 * 60 * 1_000)
    .slice(0, WAR_ROOM_COMMITMENT_LIMIT);
  const queue = selectExecutionQueue(videos, {
    blockedVideoIds: new Set(blockerMap.keys()),
    blockerCategoryByVideoId: blockerMap,
    soonestCommitmentDueAtByVideoId: commitmentMap,
  });
  const next = selectNextExecutable(queue);
  const recommended = next
    ? {
        id: next.id,
        title: next.title ?? `Video ${next.date}`,
        clientName: next.clientName,
        projectName: next.projectName,
        nextAction: getVideoNextAction(next.status),
      }
    : null;

  return (
    <div className={OPERATOR_WORKSPACE_CLASS}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="pixel-frame mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-cyan-900/40 bg-gradient-to-br from-cyan-950/20 to-zinc-950 p-4 sm:flex-row sm:items-center sm:p-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="grid h-8 w-8 place-items-center border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <PixelIcon name="signal" className="h-4 w-4" />
            </span>
            <h1 className="text-3xl font-black text-white tracking-tight">WAR ROOM</h1>
          </div>
          <p className="text-zinc-500 text-sm">
            Recorded business facts · restrained derived context
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
          {/* RMEDIA LET'S COOK Wave 1: one CTA into the order surface,
              same restrained-CTA treatment as the rest of this header --
              no War Room order list/widget, just the entry point. */}
          <Link
            href="/productivity/orders"
            className="rounded-lg border border-emerald-800/60 bg-black px-3 py-2 font-mono text-xs font-bold text-emerald-400 hover:border-emerald-500"
          >
            🔥 LET&apos;S COOK
          </Link>
          <WarRoomRefreshControl generatedAt={data.generatedAt} />
        </div>
      </header>

      {/* War Room Restaurant View V1: War Room is the live command center
          Emmanuel leaves open while operating -- LEFT is current
          situation/command, CENTER is the 16:9 Restaurant View stage
          (clients as tables, open Production Orders as the comanda rail,
          the canonical Work Session as the editor station), RIGHT is the
          bounded queue/supporting signals. Every side section below is
          the exact same existing component with the exact same props as
          before -- only their position in the grid changed. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)_minmax(300px,0.95fr)]" data-testid="war-room-command-grid">
        <div className="space-y-4">
          <NowFocusPanel
            openSession={workSessionOverview.openSession}
            openSessionElapsedSeconds={workSessionOverview.openSessionElapsedSeconds}
            recommended={recommended}
            variant="dominant"
          />
          <DecisionsSection decisions={openDecisions} />
        </div>

        <WarRoomRestaurantStage viewModel={restaurantViewModel} />

        <div className="space-y-4">
          <ActiveCommitmentsSection commitments={relevantCommitments} nowIso={now.toISOString()} />
          <ActiveSignalsSection signals={signals} />
        </div>
      </div>
      {/* House Cleaning Wave 2 §12: the research found this 7-day, 5-column
          table (each cell often packing 2-4 sub-values) too dense for a
          glanceable, always-open COMANDA screen -- closer to a spreadsheet
          than a kitchen-display ticket. Collapsed by default, exactly the
          same disclosure primitive as the BI layers below; every row is
          still here, nothing was deleted. Sessions stays the real
          detailed time-history surface -- linked below rather than
          duplicated. */}
      <DailyLedgerSection rows={dailyLedger} />

      {/* Global Health Audit — War Room boundary (Section 8-9): War Room's
          job is "what is active now / what needs attention / what just
          changed" -- everything above this point. Layers I-V below are
          descriptive BI/analytics/historical correlation (income
          trajectory, production stats, sleep/caffeine correlation,
          momentum trends, weekly/monthly estimates): real information
          nobody should lose, but none of it is a live operational fact
          that changes what to touch next. No canonical specialist surface
          currently owns all of it, so per the brief it stays accessible
          here rather than being deleted or half-moved -- just collapsed
          by default so it is no longer command-dominant, reusing the same
          <details> disclosure primitive already used on the Productivity
          page rather than inventing a new one. */}
      <details className="group mt-2 rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4 sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-zinc-400">
          <span><span className="mr-2 inline-block transition group-open:rotate-90">▸</span>Business &amp; health analytics (historical · not live ops)</span>
          <span className="font-mono text-xs text-zinc-600">5 sections</span>
        </summary>
        <div className="mt-6 border-t border-zinc-800 pt-6">

      {/* ── LAYER 1: INCOME INTELLIGENCE ──────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="I. INCOME CONTEXT" icon="💰" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Revenue Goal Progress */}
          <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">
                R$20k Trajectory
              </p>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  income.onTrack === true
                    ? "bg-cyan-900/50 text-cyan-400 border border-cyan-700/50"
                    : income.onTrack === false
                      ? "bg-red-900/50 text-red-400 border border-red-700/50"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}
              >
                {income.onTrack === true ? "ON TRACK" : income.onTrack === false ? "BEHIND PACE" : "NO BRL BASIS"}
              </span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-3xl font-black text-white">
                {income.monthlyRevenue === null
                  ? "—"
                  : formatCurrency(income.monthlyRevenue, income.revenueCurrency)}
              </span>
              <span className="text-zinc-500 text-sm mb-1">
                / {formatCurrency(income.revenueGoal, income.revenueCurrency)}
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-700 ease-out ${
                  income.onTrack === true
                    ? "bg-gradient-to-r from-cyan-600 to-cyan-400"
                    : income.onTrack === false
                      ? "bg-gradient-to-r from-red-700 to-red-500"
                      : "bg-zinc-700"
                }`}
                style={{ width: `${income.revenueGoalPct ?? 0}%` }}
              />
            </div>
            <p
              className={`text-sm font-bold mt-2 ${
                income.onTrack === true ? "text-cyan-400" : income.onTrack === false ? "text-red-400" : "text-zinc-500"
              }`}
            >
              {income.revenueGoalPct === null ? "Unavailable without BRL revenue provenance" : `${income.revenueGoalPct}% Complete`}
            </p>
          </div>

          {/* Yield Metrics */}
          <div className="flex flex-col gap-4">
            <MetricCard
              label="Recorded Income / Completed Video"
              sublabel="Current month · context only"
              value={
                income.effectiveFlatRateYield
                  ? formatCurrency(income.effectiveFlatRateYield, income.perVideoCurrency) + "/video"
                  : "—"
              }
              accent="cyan"
              icon="⚡"
            />
            <MetricCard
              label="All-Time Income / Completed Video"
              sublabel="Not per-video attribution"
              value={
                income.revenuePerVideoAllTime
                  ? formatCurrency(income.revenuePerVideoAllTime, income.perVideoCurrency)
                  : "—"
              }
              accent="zinc"
              icon="🐋"
            />
          </div>
        </div>

        {income.monthlyRevenueByCurrency.length > 0 && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              This month by currency
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Separate ledgers; no inferred FX conversion. The R$20k goal uses BRL only.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {income.monthlyRevenueByCurrency.map((row) => (
                <span key={row.currency} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white">
                  {formatCurrency(row.amount, row.currency)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top Clients */}
        {income.topClientsByRevenue.length > 0 && (
          <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-1">
              Top Clients by Revenue
            </p>
            <p className="text-zinc-600 text-xs mb-3">
              Grouped by currency and ranked only within each currency; no inferred FX conversion.
            </p>
            <div className="space-y-2">
              {income.topClientsByRevenue.map((c, i) => (
                <div key={`${c.name}-${c.currency}`} className="flex items-center gap-3">
                  <span className="text-zinc-600 text-xs w-4 font-mono">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium">{c.name}</span>
                      <span className="text-cyan-400 text-sm font-bold">
                        {formatCurrency(c.revenue, c.currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-zinc-500 text-xs">{c.projects} projects</span>
                      {c.effectiveYield && (
                        <span className="text-zinc-400 text-xs">
                          · {formatCurrency(c.effectiveYield, c.currency)}/project
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── LAYER 2: EFFICIENCY & FRICTION ────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="II. PRODUCTION FACTS" icon="⚙️" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
              Rework Evidence
            </p>
            <p className="text-2xl font-black text-zinc-200">
              {efficiency.totalRevisions} revisions
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              {efficiency.videosThisMonth} completed videos
              {efficiency.revisionDragIndex !== null
                ? ` · ${efficiency.revisionDragIndex.toFixed(2)} per video`
                : ""}
            </p>
          </div>

          <MetricCard
            label="Videos This Month"
            value={efficiency.videosThisMonth}
            accent="violet"
            icon="🎬"
          />
          <MetricCard
            label="Revenue / Video"
            value={
              efficiency.revenuePerVideo
                ? formatCurrency(efficiency.revenuePerVideo, income.perVideoCurrency)
                : "—"
            }
            accent="cyan"
            icon="💵"
          />
          <MetricCard
            label="Videos / Active Client"
            value={efficiency.videosPerActiveClient ?? "—"}
            sublabel={`${efficiency.activeClientCount} active clients`}
            accent="zinc"
            icon="👥"
          />
        </div>

      </section>

      {/* ── LAYER 3: BIOLOGICAL CORRELATION ───────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="III. HEALTH CONTEXT" icon="🧬" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Output vs Sleep */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
              Output by recorded sleep
            </p>
            <div className="space-y-3">
              <SleepCorrelationRow
                label="Good Sleep (≥7h)"
                value={biological.avgVideosGoodSleep}
                sampleCount={biological.goodSleepSampleCount}
                color="cyan"
              />
              <SleepCorrelationRow
                label="Recorded sleep <5h"
                value={biological.avgVideosCrashSleep}
                sampleCount={biological.crashSleepSampleCount}
                color="red"
              />
              <SleepCorrelationRow
                label="Recorded sleep <4h"
                value={biological.avgVideosVampireNights}
                sampleCount={biological.vampireSleepSampleCount}
                color="amber"
              />
            </div>
            <p className="text-zinc-600 text-xs mt-3">
              Descriptive averages from recorded days · not causal
            </p>
          </div>

          {/* Caffeine Metrics */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
              Caffeine records
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Total Caffeine This Month</p>
                <p className="text-2xl font-black text-amber-400">
                  {biological.estimatedCaffeineDaysMonth > 0 ? "~" : ""}
                  {biological.totalCaffeineMonth}
                  <span className="text-sm font-normal text-zinc-500 ml-1">mg</span>
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  {biological.estimatedCaffeineDaysMonth > 0
                    ? `${biological.estimatedCaffeineDaysMonth} estimated day${biological.estimatedCaffeineDaysMonth === 1 ? "" : "s"} from quick coffee logs`
                    : biological.manualCaffeineDaysMonth > 0
                      ? `${biological.manualCaffeineDaysMonth} precise manual day${biological.manualCaffeineDaysMonth === 1 ? "" : "s"}`
                      : "No caffeine evidence this month"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Coffees / Video</p>
                <p
                  className={`text-xl font-bold ${
                    biological.coffeesPerVideo === null ? "text-zinc-500" : "text-cyan-400"
                  }`}
                >
                  {biological.coffeesPerVideo !== null
                    ? `${biological.coffeesPerVideo} ☕/video`
                    : "—"}
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  {biological.coffeesPerVideo !== null
                    ? `${biological.totalCoffeesMonth} coffees this month`
                    : "No completed videos this month yet"}
                </p>
              </div>
            </div>
          </div>

          {/* Physical Activity */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
              Recorded activity (7d)
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Cycling (measured-day avg · 7d)</p>
                <p className="text-2xl font-black text-cyan-400">
                  {biological.avgCyclingKm7d !== null
                    ? `${biological.avgCyclingKm7d} km/day`
                    : "—"}
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  N={biological.cyclingSampleCount7d} recorded days
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Walking (measured-day avg · 7d)</p>
                <p className="text-xl font-bold text-cyan-300">
                  {biological.avgWalkingMin7d !== null
                    ? `${biological.avgWalkingMin7d} min/day`
                    : "—"}
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  N={biological.walkingSampleCount7d} recorded days
                </p>
              </div>
            </div>
          </div>

          {/* Physical Activity Timeline */}
          {biological.activityTimeline.length > 0 && (
            <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
                Physical Activity Timeline (Last 7 Days)
              </p>
              <div className="space-y-3">
                {biological.activityTimeline.map((activity) => (
                  <div key={activity.date} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-zinc-500 text-xs font-mono">
                        {new Date(activity.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <p className="text-zinc-400 text-xs">
                        {activity.cyclingKm !== null ? `${activity.cyclingKm}km cycling` : ''}
                        {activity.cyclingKm !== null && activity.walkingMinutes !== null ? ' · ' : ''}
                        {activity.walkingMinutes !== null ? `${activity.walkingMinutes}min walking` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── LAYER 4: MOMENTUM & TRAJECTORY ───────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="IV. MOMENTUM & TRAJECTORY" icon="🔥" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Recorded Income Streak</p>
            <p className="text-3xl font-black text-orange-400">
              {momentum.revenueStreak}
              <span className="text-sm font-normal text-zinc-500 ml-1">days</span>
            </p>
            <p className="text-zinc-600 text-xs mt-1">Consecutive days with recorded income</p>
          </div>

          <TrendCard
            label="Revenue Trend"
            value={
              momentum.revenueGrowthPct !== null
                ? `${momentum.revenueGrowthPct > 0 ? "+" : ""}${momentum.revenueGrowthPct}%`
                : "—"
            }
            trend={momentum.revenueTrend}
            sublabel={
              momentum.revenueGrowthPct === null
                ? `Insufficient comparable sample · N=${momentum.comparableDays} days`
                : `${momentum.revenueGrowthCurrency} MTD vs same ${momentum.comparableDays} days`
            }
          />

          <TrendCard
            label="Output Trend"
            value={
              momentum.outputGrowthPct !== null
                ? `${momentum.outputGrowthPct > 0 ? "+" : ""}${momentum.outputGrowthPct}%`
                : "—"
            }
            trend={momentum.outputTrend}
            sublabel={
              momentum.outputGrowthPct === null
                ? `Insufficient comparable sample · N=${momentum.comparableDays} days`
                : `MTD videos vs same ${momentum.comparableDays} days`
            }
          />

          <MetricCard
            label="Consistency Streak"
            value={`${momentum.consistencyStreak}d`}
            sublabel="Closed Work Session days"
            accent="violet"
            icon="📅"
          />
        </div>
      </section>

      {/* ── LAYER 5: ACTIVE-WINDOW ESTIMATES (Tuesday Patch Priority 5) ─────
          Brief's own worked examples: "O quanto foi gerado nessa semana
          baseando-se em quanto operei em contratos ativos?" / "O que as
          sessions do Dave renderam nessa semana?" / "Quantas horas operei
          para a Taryn no mes?" -- both derived from already-tracked Work
          Sessions, neither ever written to transactions (see
          computeRateEquivalent's invariant): estimates for the still-open
          window, not income. */}
      <section className="mb-8">
        <SectionHeader label="V. THIS WEEK / THIS MONTH" icon="🗓️" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-1">
              Estimated value this week
            </p>
            <p className="text-zinc-600 text-xs mb-3">
              Tracked hours this week × active hourly contract rate. Not billed, not income.
            </p>
            {weekEstimates.length === 0 ? (
              <p className="text-zinc-600 text-sm">No tracked time yet against an active hourly contract this week.</p>
            ) : (
              <div className="space-y-2">
                {weekEstimates.map((row) => (
                  <div key={row.clientId} className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{row.clientName}</span>
                    <span className="text-cyan-400 text-sm font-bold">
                      {formatCurrency(row.rateEquivalent, row.currency)}
                      <span className="ml-1 text-zinc-500 text-xs font-normal">
                        · {(row.attributableSeconds / 3600).toFixed(1)}h
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-1">
              Hours by client this month
            </p>
            <p className="text-zinc-600 text-xs mb-3">
              Distinct tracked coverage, merged across overlapping sessions. Any client, any billing type.
            </p>
            {monthHours.length === 0 ? (
              <p className="text-zinc-600 text-sm">No tracked time recorded this month yet.</p>
            ) : (
              <div className="space-y-2">
                {monthHours.map((row) => (
                  <div key={row.clientId} className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{row.clientName}</span>
                    <span className="text-violet-300 text-sm font-bold">
                      {(row.minutes / 60).toFixed(1)}h
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <MetricCard
            label="Leads This Month"
            value={crmSummary.leadsThisMonth}
            sublabel="New leads created -- lead-generation activity, not current pipeline standing"
            accent="zinc"
            icon="🎯"
          />
        </div>
      </section>

        </div>
      </details>

    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function SectionHeader({ label, icon }: { label: string; icon: string }) {
  void icon;
  return <PixelDivider label={label} icon={label.includes("SIGNAL") ? "signal" : label.includes("COMMITMENT") ? "flag" : undefined} />;
}

function MetricCard({
  label,
  sublabel,
  value,
  accent,
  icon,
}: {
  label: string;
  sublabel?: string;
  value: string | number;
  accent: "cyan" | "violet" | "zinc" | "amber" | "red";
  icon?: string;
}) {
  const colorMap = {
    cyan: "text-cyan-400",
    violet: "text-violet-400",
    zinc: "text-zinc-300",
    amber: "text-amber-400",
    red: "text-red-400",
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-sm">{icon}</span>}
        <p className="text-zinc-500 text-xs uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-black ${colorMap[accent]}`}>{value}</p>
      {sublabel && <p className="text-zinc-600 text-xs mt-0.5">{sublabel}</p>}
    </div>
  );
}

function TrendCard({
  label,
  value,
  trend,
  sublabel,
}: {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  sublabel?: string;
}) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor =
    trend === "up" ? "text-cyan-400" : trend === "down" ? "text-red-400" : "text-zinc-400";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`text-2xl font-black ${trendColor}`}>{value}</p>
        {value !== "—" && <span className={`text-xl font-black ${trendColor}`}>{trendIcon}</span>}
      </div>
      {sublabel && <p className="text-zinc-600 text-xs mt-0.5">{sublabel}</p>}
    </div>
  );
}

function SleepCorrelationRow({
  label,
  value,
  sampleCount,
  color,
}: {
  label: string;
  value: number | null;
  sampleCount: number;
  color: "cyan" | "red" | "amber";
}) {
  const colorMap = {
    cyan: "text-cyan-400",
    red: "text-red-400",
    amber: "text-amber-400",
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400 text-xs">{label}</span>
      <span className={`text-sm font-bold ${colorMap[color]}`}>
        {sampleCount >= 5 && value !== null ? `${value} videos/day · N=${sampleCount}` : `Insufficient · N=${sampleCount}`}
      </span>
    </div>
  );
}

// ─── OPERATOR INTELLIGENCE PATCH: ACTIVE SIGNALS (Phase 2) ─────────────────

function severityClass(severity: SignalSeverity) {
  if (severity === "ACTION") return "border-red-900/60 bg-red-950/15 text-red-300";
  if (severity === "WATCH") return "border-amber-900/60 bg-amber-950/15 text-amber-300";
  return "border-zinc-700 bg-zinc-900 text-zinc-400";
}

function confidenceLabel(confidence: SignalConfidence) {
  if (confidence === "HIGH") return "HIGH CONFIDENCE";
  if (confidence === "MEDIUM") return "MEDIUM CONFIDENCE";
  return "INSUFFICIENT DATA";
}

// Tuesday Patch Completion Round §F: the actual overdue/due-soon
// commitment objects, not just an aggregate count -- same commitments
// row Productivity already manages, rendered via the one shared card
// (ActiveCommitmentCard) so a +2h/Tomorrow/Complete/Cancel here is the
// same mutation as doing it from the video's own workspace.
function ActiveCommitmentsSection({
  commitments,
  nowIso,
}: {
  commitments: Array<{
    id: number;
    title: string;
    dueAt: Date;
    videoId: number;
    videoTitle: string | null;
    clientName: string | null;
    projectName: string | null;
  }>;
  nowIso: string;
}) {
  if (commitments.length === 0) return null;
  return (
    <section className="mb-8">
      <SectionHeader label="ACTIVE COMMITMENTS" icon="⏰" />
      <p className="mb-3 text-xs text-zinc-600">
        Overdue or due within 48h. Same commitment record Productivity uses -- act here or there, both update the same row.
      </p>
      <div className="space-y-2">
        {commitments.map((commitment) => (
          <ActiveCommitmentCard
            key={commitment.id}
            commitment={{ ...commitment, dueAt: commitment.dueAt.toISOString() }}
            nowIso={nowIso}
          />
        ))}
      </div>
    </section>
  );
}

function ActiveSignalsSection({ signals }: { signals: Signal[] }) {
  return (
    <section className="mb-8">
      <SectionHeader label="ACTIVE SIGNALS" icon="📡" />
      <p className="mb-3 text-xs text-zinc-600">
        Patterns MindBunker noticed on its own -- overdue, blocked, or repeating. &ldquo;Record decision&rdquo;
        writes down what you decided to do about one, with an optional date to check back -- it doesn&apos;t take
        any action itself, and skipping it changes nothing.
      </p>
      {signals.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
          No active signals. Nothing overdue, blocked, or repeating right now.
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className={`flex flex-col gap-1 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${severityClass(signal.severity)}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {signal.severity}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {confidenceLabel(signal.confidence)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-bold text-white">{signal.statement}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{signal.evidence}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2">
                {signal.action && (
                  <Link
                    href={signal.action.href}
                    className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-center text-xs font-bold text-zinc-200 hover:border-violet-500 hover:text-violet-200"
                  >
                    {signal.action.label} →
                  </Link>
                )}
                <RecordDecisionButton signalType={signal.kind} context={signal.context} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── OPERATOR INTELLIGENCE PATCH: DECISION LOG (Phase 5) ───────────────────

function DecisionsSection({ decisions }: { decisions: OpenDecisionRow[] }) {
  if (decisions.length === 0) return null;
  return (
    <section className="mb-8">
      <SectionHeader label="OPEN DECISIONS" icon="🧭" />
      <p className="mb-3 text-xs text-zinc-600">
        Decisions you recorded from a signal, still waiting on a result. &ldquo;Record result&rdquo; closes one
        out with what actually happened; &ldquo;Cancel&rdquo; drops it without a result if it turned out moot.
      </p>
      <div className="space-y-2">
        {decisions.map((decision) => (
          <OpenDecisionCard key={decision.id} decision={decision} />
        ))}
      </div>
    </section>
  );
}

// ─── OPERATOR INTELLIGENCE PATCH: DAILY OPERATIONAL LEDGER (Phase 3) ───────

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}` : `${minutes}m`;
}

function formatTimeOfDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function DailyLedgerSection({ rows }: { rows: DailyLedgerRow[] }) {
  const today = rows[0] ?? null;
  return (
    <details className="group mb-8 rounded-2xl border border-zinc-800 bg-zinc-950/30 p-4 sm:p-5">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block transition group-open:rotate-90">▸</span>
            <SectionHeader label="DAILY OPERATIONAL LEDGER · LAST 7 DAYS" icon="📓" />
          </div>
          <Link href="/productivity/sessions" className="text-xs font-bold text-cyan-400 hover:text-cyan-300">
            Full history in Sessions →
          </Link>
        </div>
        {today && (
          <p className="mt-2 text-xs text-zinc-500">
            Today: {formatDuration(today.work.trackedSeconds)} tracked
            {today.work.videosTouched > 0 ? ` · ${today.work.videosTouched} video${today.work.videosTouched === 1 ? "" : "s"}` : ""}
            {" · "}{today.output.videosDelivered} delivered
          </p>
        )}
      </summary>
      <p className="mb-3 mt-3 border-t border-zinc-800 pt-3 text-xs text-zinc-600">
        What actually happened each day, derived from evidence already recorded elsewhere. &ldquo;—&rdquo; means no evidence for that day, not zero.
      </p>
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Date</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Capacity</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Work</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Output</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Quality</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Money</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-b border-zinc-800/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-400">{row.date}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {row.capacity.sleepHours !== null ? `${row.capacity.sleepHours}h sleep` : "— sleep"}
                  {row.capacity.caffeineMg !== null ? ` · ${row.capacity.caffeineMg}mg` : ""}
                  {row.capacity.walkingMinutes !== null ? ` · ${row.capacity.walkingMinutes}m walk` : ""}
                  {row.capacity.cyclingKm !== null ? ` · ${row.capacity.cyclingKm}km cycle` : ""}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {formatDuration(row.work.trackedSeconds)}
                  {row.work.sessionCount > 0 ? ` · ${row.work.sessionCount} session${row.work.sessionCount === 1 ? "" : "s"}` : ""}
                  {row.work.videosTouched > 0 ? ` · ${row.work.videosTouched} video${row.work.videosTouched === 1 ? "" : "s"}` : ""}
                  {row.work.sessionCount > 0 ? ` · ${formatTimeOfDay(row.work.firstSessionAt)}–${formatTimeOfDay(row.work.lastSessionAt)}` : ""}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {row.output.videosDelivered} delivered
                  {row.output.commitmentsDue > 0 ? ` · ${row.output.commitmentsDue} due` : ""}
                  {row.output.commitmentsMissed > 0 ? ` · ${row.output.commitmentsMissed} missed` : ""}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {row.quality.detailedRevisions} revisions
                  {row.quality.ourErrorRevisions > 0 ? ` (${row.quality.ourErrorRevisions} our error)` : ""}
                  {row.quality.reworkMinutes !== null ? ` · ${row.quality.reworkMinutes}m rework` : ""}
                  {row.quality.frictionEvents > 0 ? ` · ${row.quality.frictionEvents} friction` : ""}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {row.economics.revenueByCurrency.length === 0 && row.economics.expenseByCurrency.length === 0
                    ? "—"
                    : [
                        ...row.economics.revenueByCurrency.map((c) => `+${formatCurrency(c.amount, c.currency)}`),
                        ...row.economics.expenseByCurrency.map((c) => `-${formatCurrency(c.amount, c.currency)}`),
                      ].join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
