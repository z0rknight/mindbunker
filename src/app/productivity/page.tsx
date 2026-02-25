import { StatCard } from "@/components/ui/StatCard";
import { FinishedVideoButton, AddRevisionButton } from "@/components/ui/QuickActions";
import { getVideoStats, getAllVideoLogs } from "@/modules/productivity/actions";
import { formatDate, currentMonthName } from "@/utils/date";
import { DeleteVideoLogButton } from "./DeleteVideoLogButton";

export default async function ProductivityPage() {
  const [stats, logs] = await Promise.all([
    getVideoStats(),
    getAllVideoLogs(),
  ]);

  const recentLogs = [...logs].reverse().slice(0, 50);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">🎬 Productivity</h1>
        <p className="text-zinc-500 text-sm mt-1">Video editing performance tracker</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Today" value={stats.today} accent="violet" icon="🎬" />
        <StatCard label="This Week" value={stats.week} accent="violet" icon="📅" />
        <StatCard label="This Month" value={stats.month} sub={currentMonthName()} accent="violet" icon="🗓️" />
        <StatCard label="All Time" value={stats.total} accent="zinc" icon="🏆" />
      </div>

      {/* Quick Actions */}
      <div className="mb-8 max-w-xs">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="space-y-3">
          <FinishedVideoButton />
          <AddRevisionButton />
        </div>
      </div>

      {/* Log Table */}
      <div>
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Recent Logs ({logs.length} total)
        </h2>
        {recentLogs.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-500 text-sm">No videos logged yet. Hit &quot;Finished Video&quot; to start!</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Revisions</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log, i) => (
                  <tr key={log.id} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-800/20"}`}>
                    <td className="px-4 py-3 text-white">{formatDate(log.date)}</td>
                    <td className="px-4 py-3 text-zinc-300">{log.revisionsCount}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.delivered ? "bg-emerald-900/50 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                        {log.delivered ? "Delivered" : "In Progress"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{log.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <DeleteVideoLogButton id={log.id} />
                    </td>
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
