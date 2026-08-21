import {
  AddRevisionButton,
  FinishedVideoButton,
} from "@/components/ui/QuickActions";
import { StatCard } from "@/components/ui/StatCard";
import {
  getAllVideoLogs,
  getVideoStats,
} from "@/modules/productivity/actions";
import { currentMonthName, formatDate } from "@/utils/date";
import Link from "next/link";
import { DeleteVideoLogButton } from "./DeleteVideoLogButton";
import { RevisionControls } from "./RevisionControls";

export const dynamic = "force-dynamic";

export default async function ProductivityPage() {
  const [stats, logs] = await Promise.all([
    getVideoStats(),
    getAllVideoLogs(),
  ]);
  const recentLogs = logs.slice(0, 50);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
          Projects → videos → revisions
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">🎬 Productivity</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every revision now belongs to a real video.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Today" value={stats.today} accent="violet" icon="🎬" />
        <StatCard label="This Week" value={stats.week} accent="violet" icon="📅" />
        <StatCard label="This Month" value={stats.month} sub={currentMonthName()} accent="violet" icon="🗓️" />
        <StatCard label="Revisions" value={stats.totalRevisions} accent="zinc" icon="🔄" />
        <StatCard label="All Videos" value={stats.total} accent="zinc" icon="🏆" />
      </div>

      <div className="mb-8 max-w-md">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <FinishedVideoButton />
          <AddRevisionButton />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Videos ({logs.length})
            </h2>
            <p className="mt-1 text-xs text-zinc-600">
              Use − or + to correct the revision count directly.
            </p>
          </div>
          <Link href="/crm" className="text-xs font-bold text-cyan-400 hover:text-cyan-300">
            Manage projects →
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-sm text-zinc-500">
              No videos yet. Log a named video to start.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {recentLogs.map((log) => (
                <article key={log.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-black text-white">
                        {log.title ?? `Video ${formatDate(log.date)}`}
                      </h3>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {log.projectName ?? log.clientName ?? "Standalone"} · {formatDate(log.date)}
                      </p>
                    </div>
                    <DeleteVideoLogButton id={log.id} />
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-zinc-800 pt-3">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                        Revisions
                      </p>
                      <RevisionControls videoId={log.id} initialCount={log.revisionsCount} />
                    </div>
                    <span className="rounded-full bg-emerald-900/40 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-400">
                      Delivered
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Video</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Project / client</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Revisions</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log, index) => (
                      <tr key={log.id} className={`border-b border-zinc-800/50 ${index % 2 === 0 ? "" : "bg-zinc-800/20"}`}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-white">{log.title ?? `Video ${formatDate(log.date)}`}</p>
                          {log.notes && <p className="mt-1 max-w-56 truncate text-xs text-zinc-600">{log.notes}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-zinc-300">{log.projectName ?? "No project"}</p>
                          <p className="mt-0.5 text-xs text-zinc-600">{log.clientName ?? "Standalone"}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(log.date)}</td>
                        <td className="px-4 py-3">
                          <RevisionControls videoId={log.id} initialCount={log.revisionsCount} />
                        </td>
                        <td className="px-4 py-3"><DeleteVideoLogButton id={log.id} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
