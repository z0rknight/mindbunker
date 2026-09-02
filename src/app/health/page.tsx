import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { LogTodayButton, LogBikeRideButton, LogWalkButton } from "@/components/ui/QuickActions";
import { LastNightSleepButton, CoffeeQuickLogButton } from "@/components/ui/HealthQuickActions";
import { ActivityTimeline } from "@/components/health/ActivityTimeline";
import { getHealthPageData } from "@/modules/health/actions";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import { formatDate } from "@/utils/date";
import { HealthLogEditor } from "./HealthLogEditor";

export const dynamic = "force-dynamic";

const ACTIVITY_TIMELINE_DAYS = 84; // 12 weeks

export default async function HealthPage() {
  const { summary, caffeineSummary, timelineDays, ledger, today } =
    await getHealthPageData({ timelineDays: ACTIVITY_TIMELINE_DAYS, ledgerDays: 30 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">🫀 Health</h1>
          <p className="text-zinc-500 text-sm mt-1">Daily habit tracker · Sleep · Caffeine · Movement</p>
        </div>
        <Link
          href="/health/screen-time"
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-400 hover:border-zinc-600 hover:text-white"
        >
          🖥️ Screen Time
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard
          label="Avg Sleep (7d)"
          value={summary.avgSleep7Days !== null ? `${summary.avgSleep7Days}h` : "—"}
          sub="Last 7 days"
          accent="blue"
          icon="😴"
        />
        <StatCard
          label="Caffeine Today"
          value={
            summary.caffeineToday === null
              ? "—"
              : summary.caffeineTodaySource === "ESTIMATED"
                ? `~${summary.caffeineToday}mg`
                : `${summary.caffeineToday}mg`
          }
          sub={summary.caffeineTodaySource === "ESTIMATED" ? "Estimated from servings" : summary.caffeineTodaySource === "MANUAL" ? "Manual precise entry" : "Not measured"}
          accent="amber"
          icon="☕"
        />
        <StatCard
          label="Coffees Today"
          value={caffeineSummary.todayCount ?? "—"}
          sub={caffeineSummary.weekCount === null ? "Not measured" : `${caffeineSummary.weekCount} this week`}
          accent="amber"
          icon="☕"
        />
        <StatCard
          label="Screen Time Today"
          value={summary.screenTimeToday !== null ? `${summary.screenTimeToday}h` : "—"}
          accent="zinc"
          icon="🖥️"
        />
        <StatCard
          label="Cycling (7d)"
          value={summary.totalCyclingKm7d !== null ? `${summary.totalCyclingKm7d}km` : "—"}
          sub="Total last 7 days"
          accent="blue"
          icon="🚴‍♂️"
        />
        <StatCard
          label="Walking (7d)"
          value={summary.totalWalkingMin7d !== null ? `${summary.totalWalkingMin7d}min` : "—"}
          sub="Total last 7 days"
          accent="blue"
          icon="🚶‍♂️"
        />
      </div>

      {/* Today's Log Status */}
      <div className="mb-8 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white font-medium text-sm">
              {summary.todayLog || summary.coffeeServingsToday !== null
                ? "✅ Today's health evidence is active"
                : "⚠️ No health evidence for today yet"}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">
              {summary.todayLog
                ? `Sleep: ${summary.todayLog.sleepHours ?? "—"}h · Coffee: ${summary.coffeeServingsToday ?? "—"} · Caffeine: ${summary.caffeineToday === null ? "—" : summary.caffeineTodaySource === "ESTIMATED" ? `~${summary.caffeineToday}mg estimated` : `${summary.caffeineToday}mg manual`} · Screen: ${summary.todayLog.screenTimeHours ?? "—"}h · Cycling: ${summary.todayLog.cyclingKm ?? "—"}km · Walk: ${summary.todayLog.walkingMinutes ?? "—"}min`
                : summary.coffeeServingsToday !== null
                  ? `Coffee: ${summary.coffeeServingsToday} servings · ~${summary.caffeineToday}mg estimated · other health fields not measured`
                  : "Log your daily metrics to track trends"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <LastNightSleepButton todayISODate={today} />
          <CoffeeQuickLogButton todayCount={caffeineSummary.todayCount} />
          <LogTodayButton todayISODate={today} />
          <LogBikeRideButton todayISODate={today} />
          <LogWalkButton todayISODate={today} />
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="mb-8">
        <ActivityTimeline days={timelineDays} />
      </div>

      {/* Log History */}
      <div>
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Daily Health Ledger · last 30 days
        </h2>
        {ledger.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-500 text-sm">No health logs yet. Start tracking today!</p>
          </div>
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            {ledger.map((day) => (
              <article key={day.date} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-white">{formatDate(day.date)}</p>
                  {day.healthLogId !== null && (
                    <HealthLogEditor todayISODate={today} log={{
                      id: day.healthLogId,
                      date: day.date,
                      sleepHours: day.sleepHours,
                      caffeineMg: day.caffeineSource === "MANUAL" ? day.caffeineMg : null,
                      substancesNotes: day.substancesNotes,
                      screenTimeHours: day.screenTimeHours,
                      cyclingKm: day.cyclingKm,
                      cyclingMinutes: day.cyclingMinutes,
                      walkingMinutes: day.walkingMinutes,
                    }} />
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <LedgerFact label="Sleep" value={day.sleepHours !== null ? `${day.sleepHours}h` : "—"} />
                  <LedgerFact label="Coffee" value={day.coffeeServings !== null ? `${day.coffeeServings} servings` : "—"} />
                  <LedgerFact label="Caffeine" value={formatLedgerCaffeine(day.caffeineMg, day.caffeineSource)} />
                  <LedgerFact label="Walk" value={day.walkingMinutes !== null ? `${day.walkingMinutes}min` : "—"} />
                  <LedgerFact label="Cycling" value={day.cyclingKm !== null ? `${day.cyclingKm}km` : "—"} />
                  <LedgerFact label="Intentional work" value={day.workSeconds !== null ? `${formatClosedDuration(day.workSeconds)} · ${day.workSessionCount} sessions` : "—"} />
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Sleep</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Coffee / caffeine</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">🚴 Cycling</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">🚶 Walk</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Intentional work</th>
                  <th className="text-right text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Correct</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((day, i) => (
                  <tr key={day.date} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-800/20"}`}>
                    <td className="px-4 py-3 text-white">{formatDate(day.date)}</td>
                    <td className="px-4 py-3">
                      {day.sleepHours !== null ? (
                        <span className={`font-medium ${
                          day.sleepHours >= 7 ? "text-emerald-400" :
                          day.sleepHours >= 6 ? "text-amber-400" : "text-red-400"
                        }`}>
                          {day.sleepHours}h
                        </span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      <span className="block">{day.coffeeServings !== null ? `${day.coffeeServings} servings` : "—"}</span>
                      <span className="text-[11px] text-zinc-500">{formatLedgerCaffeine(day.caffeineMg, day.caffeineSource)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {day.cyclingKm !== null ? (
                        <span className="text-cyan-400 font-medium">
                          {day.cyclingKm}km
                          {day.cyclingMinutes !== null ? <span className="text-zinc-500 text-xs ml-1">({day.cyclingMinutes}min)</span> : null}
                        </span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {day.walkingMinutes !== null ? (
                        <span className="text-teal-400 font-medium">{day.walkingMinutes}min</span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {day.workSeconds !== null ? `${formatClosedDuration(day.workSeconds)} · ${day.workSessionCount} sessions` : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {day.healthLogId !== null && <HealthLogEditor
                        todayISODate={today}
                        log={{
                          id: day.healthLogId,
                          date: day.date,
                          sleepHours: day.sleepHours,
                          caffeineMg: day.caffeineSource === "MANUAL" ? day.caffeineMg : null,
                          substancesNotes: day.substancesNotes,
                          screenTimeHours: day.screenTimeHours,
                          cyclingKm: day.cyclingKm,
                          cyclingMinutes: day.cyclingMinutes,
                          walkingMinutes: day.walkingMinutes,
                        }}
                      />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatLedgerCaffeine(
  caffeineMg: number | null,
  source: "MANUAL" | "ESTIMATED" | "NOT_MEASURED",
) {
  if (caffeineMg === null) return "—";
  return source === "ESTIMATED" ? `~${caffeineMg}mg estimated` : `${caffeineMg}mg manual`;
}

function LedgerFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{label}</dt>
      <dd className="mt-0.5 text-zinc-200">{value}</dd>
    </div>
  );
}
