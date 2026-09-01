import { StatCard } from "@/components/ui/StatCard";
import {
  AddIncomeButton,
  AddExpenseButton,
  LogTodayButton,
  LogBikeRideButton,
  LogWalkButton,
  AddRevisionButton,
} from "@/components/ui/QuickActions";
import { getFinanceSummary, getTodayRateEquivalents } from "@/modules/finance/actions";
import { getVideoStats } from "@/modules/productivity/actions";
import {
  getProjectStreaks,
  getTodayWorkSessionStats,
  getWorkSessionOverview,
} from "@/modules/work-sessions/data";
import { formatClosedDuration, formatLastActive } from "@/modules/work-sessions/core";
import { getHealthSummary } from "@/modules/health/actions";
import { getCaffeineSummary } from "@/modules/caffeine/actions";
import { getCRMSummary, getRecentBookRequests } from "@/modules/crm/actions";
import { getSalesThisMonth, getMostRecentSaleThisMonth, getClosedSales } from "@/modules/quotes/actions";
import { formatQuoteAmount } from "@/modules/quotes/core";
import { getWarRoomData } from "@/modules/analytics/service";
import { formatCurrency, currentMonthKey, currentMonthName } from "@/utils/date";
import Link from "next/link";
import { HomeTrackingPanel } from "./HomeTrackingPanel";
import { CoffeeQuickLogButton } from "@/components/ui/HealthQuickActions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    finance,
    video,
    health,
    crm,
    warRoom,
    workSessionOverview,
    caffeineSummary,
    projectStreaks,
    todayWorkStats,
    todayRateEquivalents,
    recentBookRequests,
    salesThisMonth,
    mostRecentSale,
    closedSales,
  ] = await Promise.all([
    getFinanceSummary(),
    getVideoStats(),
    getHealthSummary(),
    getCRMSummary(),
    getWarRoomData(),
    getWorkSessionOverview(),
    getCaffeineSummary(),
    getProjectStreaks(3),
    getTodayWorkSessionStats(),
    getTodayRateEquivalents(),
    getRecentBookRequests(),
    getSalesThisMonth(),
    getMostRecentSaleThisMonth(),
    getClosedSales(),
  ]);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-sm">{greeting} 👋</p>
          <h1 className="text-2xl font-bold text-white mt-1">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">{currentMonthName()} {currentMonthKey().slice(0, 4)}</p>
        </div>
        <Link
          href="/projects"
          className="hidden rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-cyan-700/60 hover:text-cyan-300 sm:inline-flex"
        >
          Open current projects →
        </Link>
      </div>

      <HomeTrackingPanel
        openSession={workSessionOverview.openSession}
        openSessionElapsedSeconds={workSessionOverview.openSessionElapsedSeconds}
      />

      {/* MICRO PATCH §4 (/book highlight), broadened by Client Service
          Reality Patch §18: intake already persists (see
          getRecentBookRequests), but email notification is deferred --
          this is the only place new activity becomes visible, so it
          needs to be noticeable. Now unions both the legacy /book call
          form's events and /quoteavideo's primary "Request a video"
          events (see getRecentBookRequests), so the panel doesn't go
          silent for the new default intake path. No reviewed/unreviewed
          state exists without a schema change, so per the brief this
          deliberately doesn't invent one: newest-first, direct Open Lead
          action, nothing more. */}
      {recentBookRequests.length > 0 && (
        <section className="mb-8 rounded-2xl border border-violet-500/30 bg-violet-500/[0.05] p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
            Recent intake requests
          </p>
          <div className="mt-3 space-y-2">
            {recentBookRequests.map((request) => (
              <div
                key={request.eventId}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{request.clientName}</p>
                  <p className="text-[11px] text-zinc-500">
                    {formatLastActive(request.createdAt, now.toISOString())}
                  </p>
                </div>
                <Link
                  href={`/crm/${request.clientId}`}
                  className="shrink-0 rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs font-black text-violet-200 hover:bg-violet-500/10"
                >
                  Open lead
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* NIGHT SHIFT REALITY PATCH §9: compact daily-operating layer.
          TODAY and MOMENTUM sit right under NOW (the tracking panel
          above) -- three useful rows instead of scrolling to lifetime
          totals below. Both are pure derivations over canonical Work
          Session history (no persisted counters, no new schema); every
          number is omitted rather than shown as zero/fabricated when
          there's genuinely nothing to report yet. */}
      {(todayWorkStats.sessionCount > 0 || projectStreaks.length > 0) && (
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {todayWorkStats.sessionCount > 0 && (
            <div>
              <h2 className="mb-3 text-zinc-400 text-xs font-semibold uppercase tracking-widest">Today</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Work Today"
                  value={formatClosedDuration(todayWorkStats.totalSeconds)}
                  accent="green"
                  icon="⏱️"
                />
                <StatCard
                  label="Sessions Today"
                  value={todayWorkStats.sessionCount}
                  accent="zinc"
                  icon="🎬"
                />
              </div>
              {todayRateEquivalents.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {todayRateEquivalents.map((row) => (
                    <span
                      key={row.clientId}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400"
                    >
                      {row.clientName}: <span className="font-semibold text-white">{formatCurrency(row.rateEquivalent, row.currency)}</span>{" "}
                      rate-equivalent{" "}
                      {/* MICRO PATCH §3: this is a derivation (attributable Work
                          Session time x contract rate), never actual revenue --
                          see computeRateEquivalent's own invariant comment. */}
                      <span className="rounded border border-zinc-700 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-zinc-600">
                        Derived
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {projectStreaks.length > 0 && (
            <div>
              <h2 className="mb-3 text-zinc-400 text-xs font-semibold uppercase tracking-widest">Momentum</h2>
              <div className="space-y-2">
                {projectStreaks.map((streak) => (
                  <div
                    key={streak.projectId}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                  >
                    <p className="truncate text-sm font-bold text-white">{streak.projectName}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
                        streak.isActiveToday
                          ? "bg-orange-500/15 text-orange-300"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      🔥 {streak.currentStreak}d{streak.isActiveToday ? "" : " · since yesterday"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monday Money Lab P0 §12: +1 Coffee moved back into the Quick
          Actions grid (former secondary quick-action position) rather than
          floating beside the primary Start Work/Finished Video controls
          above. The coffee *count* stays in its metric/stat surface
          (Health section of Detailed Statistics below, "Caffeine Today"),
          not here -- this row is only the sleep readout now. */}
      {health.todayLog?.sleepHours != null && (
        <div className="mb-8">
          <span className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
            😴 Last night: <span className="font-semibold text-white">{health.todayLog.sleepHours}h</span>
          </span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
          <CoffeeQuickLogButton todayCount={caffeineSummary.todayCount} />
          <AddIncomeButton />
          <AddExpenseButton />
          <LogTodayButton />
          <LogBikeRideButton />
          <LogWalkButton />
          <AddRevisionButton />
        </div>
      </div>

      {/* ── INSIGHTS & CORRELATIONS ───────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Operational context</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue Trend */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📈</span>
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Revenue Trend</p>
            </div>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-black ${
                warRoom.momentum.revenueGrowthPct !== null && warRoom.momentum.revenueGrowthPct > 0
                  ? "text-cyan-400"
                  : warRoom.momentum.revenueGrowthPct !== null && warRoom.momentum.revenueGrowthPct < 0
                  ? "text-red-400"
                  : "text-zinc-400"
              }`}>
                {warRoom.momentum.revenueGrowthPct !== null
                  ? `${warRoom.momentum.revenueGrowthPct > 0 ? "+" : ""}${warRoom.momentum.revenueGrowthPct}%`
                  : "—"}
              </p>
              {warRoom.momentum.revenueGrowthPct !== null && (
                <span className={`text-xl font-black ${
                  warRoom.momentum.revenueTrend === "up" ? "text-cyan-400" :
                  warRoom.momentum.revenueTrend === "down" ? "text-red-400" : "text-zinc-400"
                }`}>
                  {warRoom.momentum.revenueTrend === "up" ? "↑" :
                   warRoom.momentum.revenueTrend === "down" ? "↓" : "→"}
                </span>
              )}
            </div>
            <p className="text-zinc-600 text-xs mt-1">
              {warRoom.momentum.revenueGrowthPct === null ? "No prior-month baseline" : "vs last month"}
            </p>
          </div>

          {/* Output Trend */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎬</span>
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Output Trend</p>
            </div>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-black ${
                warRoom.momentum.outputGrowthPct !== null && warRoom.momentum.outputGrowthPct > 0
                  ? "text-cyan-400"
                  : warRoom.momentum.outputGrowthPct !== null && warRoom.momentum.outputGrowthPct < 0
                  ? "text-red-400"
                  : "text-zinc-400"
              }`}>
                {warRoom.momentum.outputGrowthPct !== null
                  ? `${warRoom.momentum.outputGrowthPct > 0 ? "+" : ""}${warRoom.momentum.outputGrowthPct}%`
                  : "—"}
              </p>
              {warRoom.momentum.outputGrowthPct !== null && (
                <span className={`text-xl font-black ${
                  warRoom.momentum.outputTrend === "up" ? "text-cyan-400" :
                  warRoom.momentum.outputTrend === "down" ? "text-red-400" : "text-zinc-400"
                }`}>
                  {warRoom.momentum.outputTrend === "up" ? "↑" :
                   warRoom.momentum.outputTrend === "down" ? "↓" : "→"}
                </span>
              )}
            </div>
            <p className="text-zinc-600 text-xs mt-1">
              {warRoom.momentum.outputGrowthPct === null ? "No prior-month baseline" : "videos vs last month"}
            </p>
          </div>

          {/* Sleep vs Output */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">😴</span>
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Output on ≥7h sleep days</p>
            </div>
            <p className="text-2xl font-black text-cyan-400">
              {warRoom.biological.avgVideosGoodSleep !== null
                ? `${warRoom.biological.avgVideosGoodSleep} videos`
                : "—"}
            </p>
            <p className="text-zinc-600 text-xs mt-1">Descriptive average · not causal</p>
          </div>

          {/* Coffees / Video */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">☕</span>
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Coffees / Video</p>
            </div>
            <p className={`text-2xl font-black ${
              warRoom.biological.coffeesPerVideo !== null ? "text-cyan-400" : "text-zinc-500"
            }`}>
              {warRoom.biological.coffeesPerVideo !== null
                ? `${warRoom.biological.coffeesPerVideo}`
                : "—"}
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              {warRoom.biological.coffeesPerVideo !== null
                ? `${warRoom.biological.totalCoffeesMonth} coffees · ${warRoom.efficiency.videosThisMonth} completed videos`
                : "No completed videos this month yet"}
            </p>
          </div>
        </div>

        {/* Additional Insights Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Revenue Streak */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔥</span>
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Recorded Income Streak</p>
            </div>
            <p className="text-2xl font-black text-orange-400">
              {warRoom.momentum.revenueStreak}
              <span className="text-sm font-normal text-zinc-500 ml-1">days</span>
            </p>
            <p className="text-zinc-600 text-xs mt-1">Consecutive days with recorded income</p>
          </div>

          {/* Revision Efficiency */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚙️</span>
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Rework Evidence</p>
            </div>
            <p className="text-2xl font-black text-zinc-200">
              {warRoom.efficiency.totalRevisions} revisions
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {warRoom.efficiency.videosThisMonth} completed videos
            </p>
          </div>
        </div>
      </div>

      {/* ── DETAILED STATISTICS ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">📊 Detailed Statistics</h2>

        {/* Finance Section */}
        <div className="mb-6">
          <h3 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">💰 Finance</h3>
          <div className="space-y-4">
            {finance.map((row) => (
              <div key={row.currency}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-600">{row.currency}</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatCard
                    label="Economic Ledger Net"
                    value={formatCurrency(row.currentBalance, row.currency)}
                    sub="Recorded history · not Wise cash"
                    accent={row.currentBalance >= 0 ? "green" : "red"}
                    icon="💳"
                  />
                  <StatCard
                    label="Monthly Revenue"
                    value={formatCurrency(row.monthlyRevenue, row.currency)}
                    sub={currentMonthName()}
                    accent="green"
                    icon="📈"
                  />
                  <StatCard
                    label="Monthly Expenses"
                    value={formatCurrency(row.monthlyExpenses, row.currency)}
                    sub={currentMonthName()}
                    accent="red"
                    icon="📉"
                  />
                  <StatCard
                    label="Net This Month"
                    value={formatCurrency(row.monthlyNet, row.currency)}
                    accent={row.monthlyNet >= 0 ? "green" : "red"}
                    icon="⚖️"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Productivity Section */}
        <div className="mb-6">
          <h3 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">🎬 Productivity</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Videos Today"
              value={video.today}
              accent="violet"
              icon="🎬"
            />
            <StatCard
              label="Videos This Week"
              value={video.week}
              accent="violet"
              icon="📅"
            />
            <StatCard
              label="Videos This Month"
              value={video.month}
              sub={currentMonthName()}
              accent="violet"
              icon="🗓️"
            />
            <StatCard
              label="Total Revisions"
              value={video.totalRevisions}
              accent="zinc"
              icon="🔄"
            />
          </div>
        </div>

        {/* CRM Section */}
        <div className="mb-6">
          <h3 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">👥 CRM</h3>

          {/* Quick Morning Reality Patch §14: small, modest positive
              feedback -- derived straight from the same canonical
              approved-quote event §11's Sales stat reads, not a new
              notification system. Only shows when there's a real sale
              this month; disappears on its own otherwise. */}
          {mostRecentSale && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-3">
              <span className="text-xl" aria-hidden="true">🎉</span>
              <div>
                <p className="text-sm font-bold text-emerald-200">
                  Sale: {mostRecentSale.clientName}
                  {mostRecentSale.videoTitle ? ` — ${mostRecentSale.videoTitle}` : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatQuoteAmount(mostRecentSale.amountCents, mostRecentSale.currency)} accepted · not cash by itself
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Active Clients"
              value={crm.activeClientsCount}
              accent="blue"
              icon="✅"
            />
            <StatCard
              label="Leads This Month"
              value={crm.leadsThisMonth}
              sub={currentMonthName()}
              accent="blue"
              icon="🎯"
            />
            <StatCard
              label="Total Contacts"
              value={crm.totalClients}
              accent="zinc"
              icon="📋"
            />
            {/* Quick Morning Reality Patch §11: SALE = approved quote,
                never cash received -- see computeSalesThisMonth. Grouped
                by currency, never mixed. */}
            <StatCard
              label="Sales This Month"
              value={salesThisMonth.totalCount}
              sub={currentMonthName()}
              accent="green"
              icon="🤝"
            />
            {/* First Sale Economics (26 Aug 2026) §2: an all-time
                counterpart to Sales This Month -- APPROVED QUOTE = SALE
                with no time window, so a real closed deal doesn't
                silently disappear from the dashboard once the month
                rolls over. Same source (computeClosedSales reuses
                computeSalesThisMonth's own grouping), never called
                Revenue or Received, never mutates Finance. */}
            <StatCard
              label="Closed Sales"
              value={closedSales.totalCount}
              sub="all time"
              accent="green"
              icon="🎯"
            />
          </div>

          {salesThisMonth.byCurrency.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {salesThisMonth.byCurrency.map((entry) => (
                <span
                  key={entry.currency}
                  className="rounded-full border border-emerald-700/40 bg-emerald-950/20 px-3 py-1.5 text-xs font-bold text-emerald-300"
                >
                  Accepted this month ({entry.currency}): {formatQuoteAmount(entry.totalAmountCents, entry.currency)}
                </span>
              ))}
            </div>
          )}

          {closedSales.byCurrency.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {closedSales.byCurrency.map((entry) => (
                <span
                  key={entry.currency}
                  className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300"
                >
                  Value closed · all time ({entry.currency}): {formatQuoteAmount(entry.totalAmountCents, entry.currency)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Health Section */}
        <div className="mb-6">
          <h3 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">🫀 Health</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Avg Sleep (7d)"
              value={health.avgSleep7Days !== null ? `${health.avgSleep7Days}h` : "—"}
              accent="blue"
              icon="😴"
            />
            <StatCard
              label="Caffeine Today"
              value={health.caffeineToday !== null ? `${health.caffeineToday}mg` : "—"}
              accent="amber"
              icon="☕"
            />
            <StatCard
              label="Screen Time Today"
              value={health.screenTimeToday !== null ? `${health.screenTimeToday}h` : "—"}
              accent="zinc"
              icon="🖥️"
            />
            <StatCard
              label="Cycling Today"
              value={health.cyclingKmToday !== null ? `${health.cyclingKmToday}km` : "—"}
              accent="blue"
              icon="🚴\u200d♂️"
            />
            <StatCard
              label="Walking Today"
              value={health.walkingMinutesToday !== null ? `${health.walkingMinutesToday}min` : "—"}
              accent="blue"
              icon="🚶\u200d♂️"
            />
            <StatCard
              label="Cycling (7d)"
              value={health.totalCyclingKm7d > 0 ? `${health.totalCyclingKm7d}km` : "—"}
              sub="Total last 7 days"
              accent="zinc"
              icon="📊"
            />
          </div>
        </div>
      </div>

    </div>
  );
}
