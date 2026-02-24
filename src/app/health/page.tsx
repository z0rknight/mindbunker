import { StatCard } from "@/components/ui/StatCard";
import { LogTodayButton } from "@/components/ui/QuickActions";
import { getHealthSummary, getAllHealthLogs } from "@/modules/health/actions";
import { formatDate } from "@/utils/date";

export default async function HealthPage() {
  const [summary, logs] = await Promise.all([
    getHealthSummary(),
    getAllHealthLogs(),
  ]);

  const recentLogs = [...logs].reverse().slice(0, 30);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">🫀 Health</h1>
        <p className="text-zinc-500 text-sm mt-1">Daily habit tracker</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <StatCard
          label="Avg Sleep (7d)"
          value={summary.avgSleep7Days !== null ? `${summary.avgSleep7Days}h` : "—"}
          sub="Last 7 days"
          accent="blue"
          icon="😴"
        />
        <StatCard
          label="Caffeine Today"
          value={summary.caffeineToday !== null ? `${summary.caffeineToday}mg` : "—"}
          accent="amber"
          icon="☕"
        />
        <StatCard
          label="Screen Time Today"
          value={summary.screenTimeToday !== null ? `${summary.screenTimeToday}h` : "—"}
          accent="zinc"
          icon="🖥️"
        />
      </div>

      {/* Today's Log Status */}
      <div className="mb-8 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div>
          <p className="text-white font-medium text-sm">
            {summary.todayLog ? "✅ Today's log is complete" : "⚠️ No log for today yet"}
          </p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {summary.todayLog
              ? `Sleep: ${summary.todayLog.sleepHours ?? "—"}h · Caffeine: ${summary.todayLog.caffeineMg ?? "—"}mg · Screen: ${summary.todayLog.screenTimeHours ?? "—"}h`
              : "Log your daily metrics to track trends"}
          </p>
        </div>
        <div className="w-40">
          <LogTodayButton />
        </div>
      </div>

      {/* Log History */}
      <div>
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Log History ({logs.length} days)
        </h2>
        {recentLogs.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-500 text-sm">No health logs yet. Start tracking today!</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Sleep</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Caffeine</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Screen Time</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log, i) => (
                  <tr key={log.id} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-800/20"}`}>
                    <td className="px-4 py-3 text-white">{formatDate(log.date)}</td>
                    <td className="px-4 py-3">
                      {log.sleepHours !== null ? (
                        <span className={`font-medium ${
                          log.sleepHours >= 7 ? "text-emerald-400" :
                          log.sleepHours >= 6 ? "text-amber-400" : "text-red-400"
                        }`}>
                          {log.sleepHours}h
                        </span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {log.caffeineMg !== null ? `${log.caffeineMg}mg` : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {log.screenTimeHours !== null ? `${log.screenTimeHours}h` : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{log.substancesNotes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
