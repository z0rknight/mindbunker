import { getActiveHistBatch, getAllHistorySummary } from "@/modules/historical/data";
import { AllHistoryVisuals } from "./AllHistoryVisuals";
import { HistoricalReviewReminder } from "./HistoricalReviewReminder";

export const dynamic = "force-dynamic";

function formatUsd(value: number | null): string {
  if (value === null) return "—";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatHours(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(2)}h`;
}

const COVERAGE_SOURCE_LABELS: Record<string, string> = {
  upwork_weekly_summary: "Upwork",
  clockify_detailed_export: "Clockify",
  activitywatch_afk: "AFK",
};

export default async function AllHistoryPage() {
  const [activeBatch, rows] = await Promise.all([
    getActiveHistBatch(),
    getAllHistorySummary(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">🗄️ All History</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Reconstructed historical reference data · 2023–2026
          </p>
        </div>
        {/* Pre-Operation Reality Hardening — ActivityWatch Import round:
            the operator should never need to know a secret URL to reach
            /all-history/import -- this is the one visible, discoverable
            entry point into it. */}
        <a
          href="/mindbunker/all-history/import"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          Import history →
        </a>
      </div>

      <div className="mb-8 p-4 rounded-xl border border-amber-800/40 bg-amber-950/20">
        <p className="text-amber-300 text-sm font-medium">
          ⚠️ This is historical reconstructed evidence, not live MindBunker data
        </p>
        <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
          Every figure below is derived from external exports (Upwork, Clockify,
          ActivityWatch) by a documented, re-runnable procedure — it is not a
          native MindBunker Client, Project, Video, or Work Session, and no
          figure here has been written into those tables. Where a source has
          no data for a given month, that month is shown as unknown, never as
          zero. See ARTIFACT_CONTRACT.md for the full three-tier data model.
        </p>
      </div>

      {!activeBatch ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-300 text-sm font-medium">
            No historical batch has been imported and activated yet.
          </p>
          <p className="text-zinc-500 text-xs mt-2">
            The Sprint 1.2 P0 artifact and importer are in place
            (src/modules/historical/), but running the import against this
            database is a deliberate, out-of-band step gated by the Data
            Safety protocol — it has not been run automatically as part of
            shipping this page.
          </p>
        </div>
      ) : (
        <>
          <HistoricalReviewReminder />

          <AllHistoryVisuals rows={rows} />

          <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Year</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Revenue</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Billed Hours</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Tracked Hours</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.year}
                    className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-800/20"}`}
                  >
                    <td className="px-4 py-3 text-white font-semibold">{row.year}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">
                      {formatUsd(row.revenueUsd)}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {formatHours(row.billedHours)}
                    </td>
                    <td className="px-4 py-3">
                      {row.trackedHours !== null ? (
                        <span className="text-cyan-400 font-medium">
                          {row.trackedHours.toFixed(2)}h
                          <span className="text-zinc-500 text-xs ml-1">
                            · {row.trackedHoursMonthsKnown}/{row.trackedHoursMonthsTotal} mo. known
                          </span>
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {row.coverage
                        .map(
                          (c) =>
                            `${COVERAGE_SOURCE_LABELS[c.source] ?? c.source} ${c.monthsPresent}/${c.monthsTotal}`,
                        )
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-zinc-600 text-xs">
            Active batch #{activeBatch.id} · artifact contract v{activeBatch.artifactVersion} ·{" "}
            {activeBatch.factCount} facts · {activeBatch.identityCount} identities
          </p>
        </>
      )}
    </div>
  );
}
