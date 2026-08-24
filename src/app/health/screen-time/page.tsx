import Link from "next/link";
import { getScreenTimeSnapshots } from "@/modules/screen-time/actions";
import { formatDate } from "@/utils/date";

export const dynamic = "force-dynamic";

function formatHours(totalMinutes: number): string {
  return `${(totalMinutes / 60).toFixed(1)}h`;
}

export default async function ScreenTimePage() {
  const snapshots = await getScreenTimeSnapshots();
  const latest = snapshots[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">🖥️ Screen Time</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manually imported Apple Screen Time snapshots — no morality
            scoring, just totals.
          </p>
        </div>
        <Link
          href="/health/screen-time/import"
          className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
        >
          + Import Snapshot
        </Link>
      </div>

      <p className="mb-6 rounded-md border border-amber-800/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
        MANUAL APPLE SCREEN TIME SNAPSHOT — every number below came from a
        pasted export, not automatic sensing.
      </p>

      {!latest ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-300 text-sm font-medium">No snapshots imported yet.</p>
          <p className="text-zinc-500 text-xs mt-2">
            Use &ldquo;Import Snapshot&rdquo; above to paste in a structured
            Screen Time export.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Most Recent Snapshot ({formatDate(latest.periodStart)} –{" "}
              {formatDate(latest.periodEnd)}, {latest.device})
            </h2>
            <p className="text-3xl font-bold text-white">
              {formatHours(latest.totalMinutes)}
              <span className="ml-2 text-sm font-normal text-zinc-500">total</span>
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Top Apps
                </p>
                {latest.topApps.length === 0 ? (
                  <p className="text-xs text-zinc-600">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {latest.topApps.map((app) => (
                      <li key={app.name} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300">{app.name}</span>
                        <span className="text-zinc-500 tabular-nums">{app.hours.toFixed(1)}h</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Top Categories
                </p>
                {latest.topCategories.length === 0 ? (
                  <p className="text-xs text-zinc-600">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {latest.topCategories.map((cat) => (
                      <li key={cat.name} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300">{cat.name}</span>
                        <span className="text-zinc-500 tabular-nums">{cat.hours.toFixed(1)}h</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Past Snapshots ({snapshots.length})
            </h2>
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="text-white font-medium">
                      {formatDate(snap.periodStart)} – {formatDate(snap.periodEnd)}
                    </p>
                    <p className="text-zinc-500 text-xs">{snap.device}</p>
                  </div>
                  <span className="font-semibold text-zinc-300 tabular-nums">
                    {formatHours(snap.totalMinutes)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
