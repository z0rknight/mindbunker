import { StatCard } from "@/components/ui/StatCard";
import { PerformanceStatsSection } from "@/components/ui/PerformanceStats";
import {
  AddIncomeButton,
  AddExpenseButton,
  LogTodayButton,
  LogBikeRideButton,
  LogWalkButton,
  AddRevisionButton,
} from "@/components/ui/QuickActions";
import { getFinanceSummary } from "@/modules/finance/actions";
import { getVideoStats } from "@/modules/productivity/actions";
import { getWorkSessionOverview } from "@/modules/work-sessions/data";
import { getHealthSummary } from "@/modules/health/actions";
import { getCaffeineSummary } from "@/modules/caffeine/actions";
import { getCRMSummary } from "@/modules/crm/actions";
import { getPerformanceStats } from "@/utils/statistics";
import { getWarRoomData } from "@/modules/analytics/service";
import { formatCurrency, currentMonthName } from "@/utils/date";
import { HomeTrackingPanel } from "./HomeTrackingPanel";
import { CoffeeQuickLogButton } from "@/components/ui/HealthQuickActions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [finance, video, health, crm, perfStats, warRoom, workSessionOverview, caffeineSummary] =
    await Promise.all([
      getFinanceSummary(),
      getVideoStats(),
      getHealthSummary(),
      getCRMSummary(),
      getPerformanceStats(),
      getWarRoomData(),
      getWorkSessionOverview(),
      getCaffeineSummary(),
    ]);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-zinc-500 text-sm">{greeting} 👋</p>
        <h1 className="text-2xl font-bold text-white mt-1">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">{currentMonthName()} {now.getFullYear()}</p>
      </div>

      <HomeTrackingPanel
        openSession={workSessionOverview.openSession}
        openSessionElapsedSeconds={workSessionOverview.openSessionElapsedSeconds}
      />

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
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">💡 Insights & Correlations</h2>
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
              <span className={`text-xl font-black ${
                warRoom.momentum.revenueTrend === "up" ? "text-cyan-400" :
                warRoom.momentum.revenueTrend === "down" ? "text-red-400" : "text-zinc-400"
              }`}>
                {warRoom.momentum.revenueTrend === "up" ? "↑" :
                 warRoom.momentum.revenueTrend === "down" ? "↓" : "→"}
              </span>
            </div>
            <p className="text-zinc-600 text-xs mt-1">vs last month</p>
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
              <span className={`text-xl font-black ${
                warRoom.momentum.outputTrend === "up" ? "text-cyan-400" :
                warRoom.momentum.outputTrend === "down" ? "text-red-400" : "text-zinc-400"
              }`}>
                {warRoom.momentum.outputTrend === "up" ? "↑" :
                 warRoom.momentum.outputTrend === "down" ? "↓" : "→"}
              </span>
            </div>
            <p className="text-zinc-600 text-xs mt-1">videos vs last month</p>
          </div>

          {/* Sleep vs Output */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">😴</span>
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Sleep Impact</p>
            </div>
            <p className="text-2xl font-black text-cyan-400">
              {warRoom.biological.avgVideosGoodSleep !== null
                ? `${warRoom.biological.avgVideosGoodSleep} videos`
                : "—"}
            </p>
            <p className="text-zinc-600 text-xs mt-1">on good sleep days (≥7h)</p>
          </div>

          {/* Caffeine Efficiency */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">☕</span>
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Caffeine Ratio</p>
            </div>
            <p className={`text-2xl font-black ${
              warRoom.biological.caffeinePerRevenue !== null && warRoom.biological.caffeinePerRevenue > 5
                ? "text-red-400"
                : "text-cyan-400"
            }`}>
              {warRoom.biological.caffeinePerRevenue !== null
                ? `${warRoom.biological.caffeinePerRevenue} mg/R$`
                : "—"}
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              {warRoom.biological.caffeinePerRevenue !== null && warRoom.biological.caffeinePerRevenue > 5
                ? "⚠ High caffeine use"
                : "Efficient caffeine use"}
            </p>
          </div>
        </div>

        {/* Additional Insights Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* Revenue Streak */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔥</span>
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Revenue Streak</p>
            </div>
            <p className="text-2xl font-black text-orange-400">
              {warRoom.momentum.revenueStreak}
              <span className="text-sm font-normal text-zinc-500 ml-1">days</span>
            </p>
            <p className="text-zinc-600 text-xs mt-1">Consecutive billable days</p>
          </div>

          {/* Revision Efficiency */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚙️</span>
              <p className="text-zinc-500 text-xs uppercase tracking-wider">Revision Drag</p>
            </div>
            <p className={`text-2xl font-black ${
              warRoom.efficiency.revisionDragTier === "elite" ? "text-cyan-400" :
              warRoom.efficiency.revisionDragTier === "normal" ? "text-amber-400" : "text-red-400"
            }`}>
              {warRoom.efficiency.revisionDragIndex !== null
                ? warRoom.efficiency.revisionDragIndex.toFixed(2)
                : "—"}
            </p>
            <p className={`text-xs font-bold mt-1 uppercase ${
              warRoom.efficiency.revisionDragTier === "elite" ? "text-cyan-500" :
              warRoom.efficiency.revisionDragTier === "normal" ? "text-amber-500" : "text-red-500"
            }`}>
              {warRoom.efficiency.revisionDragTier === "elite" ? "⚡ Elite" :
               warRoom.efficiency.revisionDragTier === "normal" ? "⚠ Normal" : "🔴 Friction"}
            </p>
          </div>

          {/* Leverage Score */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-cyan-900/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💎</span>
              <p className="text-zinc-400 text-xs uppercase tracking-wider">Leverage Score</p>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black text-white">{warRoom.leverage.score}</p>
              <span className="text-zinc-500 text-sm mb-1">XP</span>
            </div>
            <p className="text-cyan-400 text-xs font-bold mt-1">Level {warRoom.leverage.level}: {warRoom.leverage.levelTitle}</p>
          </div>
        </div>
      </div>

      {/* ── DETAILED STATISTICS ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">📊 Detailed Statistics</h2>

        {/* Finance Section */}
        <div className="mb-6">
          <h3 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">💰 Finance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Current Balance"
              value={formatCurrency(finance.currentBalance)}
              accent={finance.currentBalance >= 0 ? "green" : "red"}
              icon="💳"
            />
            <StatCard
              label="Monthly Revenue"
              value={formatCurrency(finance.monthlyRevenue)}
              sub={currentMonthName()}
              accent="green"
              icon="📈"
            />
            <StatCard
              label="Monthly Expenses"
              value={formatCurrency(finance.monthlyExpenses)}
              sub={currentMonthName()}
              accent="red"
              icon="📉"
            />
            <StatCard
              label="Net This Month"
              value={formatCurrency(finance.monthlyNet)}
              accent={finance.monthlyNet >= 0 ? "green" : "red"}
              icon="⚖️"
            />
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
          </div>
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

      {/* Performance Stats — Gamified Section */}
      <PerformanceStatsSection stats={perfStats} />
    </div>
  );
}
