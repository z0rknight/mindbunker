import { StatCard } from "@/components/ui/StatCard";
import {
  AddIncomeButton,
  AddExpenseButton,
  LogTodayButton,
  LogBikeRideButton,
  LogWalkButton,
} from "@/components/ui/QuickActions";
import { getTodayIncomeByCurrency, getTodayRateEquivalents } from "@/modules/finance/actions";
import {
  getProjectStreaks,
  getTodayWorkSessionStats,
  getWorkSessionOverview,
} from "@/modules/work-sessions/data";
import { formatClosedDuration, formatLastActive } from "@/modules/work-sessions/core";
import { getHealthSummary } from "@/modules/health/actions";
import { getCaffeineSummary } from "@/modules/caffeine/actions";
import { getRecentBookRequests } from "@/modules/crm/actions";
import { formatCurrency, currentMonthKey, currentMonthName } from "@/utils/date";
import Link from "next/link";
import { HomeTrackingPanel } from "./HomeTrackingPanel";
import { CoffeeQuickLogButton } from "@/components/ui/HealthQuickActions";
import { getDashboardOperatorIntelligence } from "@/modules/operator-intelligence/data";
import { selectDashboardNow, type AttentionReason } from "@/modules/operator-intelligence/core";
import { isInternalClientName, splitIntentionalWork } from "@/lib/client-identity";
import { getOpenCommitmentsWithContext, rankOpenCommitments } from "@/modules/signals";
import { ActiveCommitmentCard } from "@/components/commitments/ActiveCommitmentCard";
import { PixelDivider, PixelIcon } from "@/components/ui/PixelVisuals";

export const dynamic = "force-dynamic";

// House Cleaning Wave 2 §11 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
// the two collapsed disclosures this page used to end with (a baseline/
// trend block and a detailed per-domain stats block) were removed
// outright, not just left collapsed -- every figure in them (Finance
// monthly totals, Productivity video counts, CRM sales/leads, Health 7-day
// averages, War Room's momentum/biological correlation) already renders
// canonically on its own specialist page. The server calls that only fed
// those two blocks are gone from the query list below too -- removing the
// fetch, not just the markup, per the mission's explicit "do not keep
// fetching statistics that no longer render" instruction. Dashboard now
// fetches only what it still shows: what's active now, the day's
// attention items, and today's own numbers.
export default async function DashboardPage() {
  const [
    health,
    workSessionOverview,
    caffeineSummary,
    projectStreaks,
    todayWorkStats,
    todayRateEquivalents,
    recentBookRequests,
    operatorIntelligence,
    openCommitments,
    todayIncome,
  ] = await Promise.all([
    getHealthSummary(),
    getWorkSessionOverview(),
    getCaffeineSummary(),
    getProjectStreaks(3),
    getTodayWorkSessionStats(),
    getTodayRateEquivalents(),
    getRecentBookRequests(),
    getDashboardOperatorIntelligence(),
    getOpenCommitmentsWithContext(),
    getTodayIncomeByCurrency(),
  ]);

  const now = new Date();
  // Tuesday Patch Completion Round §F: "Dashboard should remain an
  // overview: do not dump every deadline there... show only the most
  // relevant/current commitment(s)." One card, the single most urgent
  // (overdue first, else soonest) -- same commitments row Productivity
  // and War Room read, never a second deadline record.
  const mostUrgentCommitment = rankOpenCommitments(openCommitments, now)[0] ?? null;
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dashboardNow = selectDashboardNow(
    workSessionOverview.openSession,
    operatorIntelligence.recentCurrentTargets,
  );
  const todayWorkSplit = splitIntentionalWork(todayWorkStats);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-system-label flex items-center gap-2 text-zinc-500">
            <PixelIcon name="shield" className="h-3.5 w-3.5" /> Operator system
          </p>
          <h1 className="text-2xl font-bold text-white mt-2">{greeting} · Dashboard</h1>
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

      {/* Operator Flow round: capture belongs beside the command surface,
          before secondary evidence and history. These are the existing
          actions, only repositioned; their mutations are unchanged. */}
      <section className="mb-6" aria-labelledby="dashboard-quick-actions">
        <div className="flex items-center justify-between gap-3">
          <h2 id="dashboard-quick-actions" className="sr-only">Quick Actions</h2>
          <div className="min-w-0 flex-1"><PixelDivider label="Quick actions" icon="stack" /></div>
          <Link href="/projects" className="text-xs font-bold text-cyan-400 hover:text-cyan-300 sm:hidden">
            Current projects →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          <CoffeeQuickLogButton todayCount={caffeineSummary.todayCount} />
          <AddIncomeButton />
          <AddExpenseButton />
          <LogTodayButton />
          <LogBikeRideButton />
          <LogWalkButton />
          <Link
            href="/productivity/orders/new"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-emerald-800/60 bg-black px-6 py-5 font-mono text-sm font-bold text-emerald-400 transition-all hover:border-emerald-500 hover:bg-zinc-950 active:scale-95"
          >
            <span className="text-lg">🔥</span>
            LET&apos;S COOK
          </Link>
        </div>
      </section>

      {mostUrgentCommitment && (
        <div className="mb-6" data-testid="dashboard-commitment">
          <ActiveCommitmentCard
            commitment={{ ...mostUrgentCommitment, dueAt: mostUrgentCommitment.dueAt.toISOString() }}
            nowIso={now.toISOString()}
          />
        </div>
      )}

      {dashboardNow.mode === "RECENT" && dashboardNow.targets.length > 0 && (
        <section className="mb-6" data-testid="dashboard-now">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Now</h2>
            <span className="text-[11px] text-zinc-600">Recent in-progress work</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {dashboardNow.targets.map((target) => (
              <Link
                key={target.videoId}
                href={`/productivity?video=${target.videoId}`}
                className="pixel-frame rounded-xl border border-cyan-900/50 bg-cyan-950/10 p-4 transition hover:border-cyan-600/60"
              >
                <p className="truncate text-sm font-black text-white">{target.videoTitle}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {[target.clientName, target.projectName].filter(Boolean).join(" / ") || "Unattributed video"}
                </p>
                <p className="mt-2 text-[11px] font-bold text-cyan-300">
                  Last worked {formatLastActive(target.lastWorkedAt, now.toISOString())} · Continue →
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {operatorIntelligence.attentionGroups.length > 0 && (
        <section className="mb-8" data-testid="dashboard-attention">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Attention</h2>
            <span className="text-[11px] text-zinc-600">Highest-priority operational facts</span>
          </div>
          <div className="space-y-2">
            {operatorIntelligence.attentionGroups.map((group) => {
              const first = group.items[0];
              const isSingle = group.items.length === 1;
              return (
                <Link
                  key={group.key}
                  href={`/productivity?video=${first.videoId}`}
                  className={`pixel-frame pixel-frame-attention flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${attentionClass(group.reason)}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider">{group.reasonLabel}</span>
                      {!isSingle && (
                        <span className="rounded-full bg-black/25 px-1.5 py-0.5 font-mono text-[10px] text-inherit">
                          {group.items.length}
                        </span>
                      )}
                      <p className="truncate text-sm font-bold text-white">
                        {isSingle ? first.videoTitle : `${group.items.length} videos`}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-zinc-500">
                      {[group.clientName, group.projectName].filter(Boolean).join(" / ")}
                    </p>
                    {group.reason === "DATA_ISSUE" && (
                      <p className="mt-1 text-[11px] text-red-300">Deadline precedes promise creation · edit the deadline in Video Workspace</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-black">Open →</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
      <div className={`mb-8 ${projectStreaks.length > 0 ? "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]" : ""}`}>
          <div>
              <h2 className="mb-3 text-zinc-400 text-xs font-semibold uppercase tracking-widest">Today</h2>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard
                  label="Faturado hoje"
                  value={todayIncome.length > 0 ? todayIncome.map((row) => formatCurrency(row.amount, row.currency)).join(" · ") : "—"}
                  sub="Recorded income · currency-safe"
                  accent="green"
                  icon="💵"
                />
                <StatCard
                  label="Client Production"
                  value={formatClosedDuration(todayWorkSplit.clientProductionSeconds)}
                  accent="blue"
                  icon="🎬"
                />
                <StatCard
                  label="Internal Operations"
                  value={formatClosedDuration(todayWorkSplit.internalOperationsSeconds)}
                  accent="zinc"
                  icon="🛠️"
                />
                <StatCard
                  label="Total Intentional"
                  value={formatClosedDuration(todayWorkSplit.totalIntentionalSeconds)}
                  sub={`${todayWorkStats.sessionCount} ${todayWorkStats.sessionCount === 1 ? "session" : "sessions"}`}
                  accent="green"
                  icon="⏱️"
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

          {projectStreaks.length > 0 && (
            <div>
              <h2 className="mb-3 text-zinc-400 text-xs font-semibold uppercase tracking-widest">Momentum</h2>
              <div className="space-y-2">
                {projectStreaks.map((streak) => (
                  <div
                    key={streak.projectId}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{streak.projectName}</p>
                      <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-zinc-600">
                        {isInternalClientName(streak.clientName) ? "Internal operations" : "Client production"}
                      </p>
                    </div>
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

      {/* Monday Money Lab P0 §12: +1 Coffee moved back into the Quick
          Actions grid (former secondary quick-action position) rather than
          floating beside the primary Start Work/Finished Video controls
          above. Health's own page owns the full caffeine breakdown --
          this row is only the sleep readout. */}
      {health.todayLog?.sleepHours != null && (
        <div className="mb-8">
          <span className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
            😴 Last night: <span className="font-semibold text-white">{health.todayLog.sleepHours}h</span>
          </span>
        </div>
      )}


    </div>
  );
}

function attentionClass(reason: AttentionReason) {
  if (reason === "DATA_ISSUE" || reason === "OVERDUE" || reason === "BLOCKED") {
    return "border-red-900/60 bg-red-950/15 text-red-300 hover:border-red-700";
  }
  if (reason === "CHANGES_REQUESTED") {
    return "border-orange-900/60 bg-orange-950/15 text-orange-300 hover:border-orange-700";
  }
  return "border-violet-900/60 bg-violet-950/10 text-violet-300 hover:border-violet-700";
}
