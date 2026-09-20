import Link from "next/link";
import { videoWorkspaceHref } from "@/modules/productivity/core";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import { formatCurrency } from "@/utils/date";
import type { ClientIntelligenceSummary } from "@/modules/crm/actions";
import type { RateEquivalent } from "@/modules/finance/core";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

// Internal-only (Sunday Systems Round, Phase H). Every number here is
// derived from data the operator already captures for other reasons --
// Projects, Video lifecycle, Work Sessions, Video Memory, Revisions --
// zero new manual input. Do not render this component, or forward any of
// its data, on a client-facing surface (/client/[token], /g/[token]). See
// the PRIVATE OPERATOR INTELLIGENCE vs CLIENT-SAFE INTELLIGENCE boundary
// in docs/architecture/SUNDAY_SYSTEMS_ROUND.md.
export function ClientIntelligencePanel({
  summary,
  weekEstimate,
  returnTo,
}: {
  summary: ClientIntelligenceSummary;
  // The page this panel is shown on, so a video opened from a note returns here.
  returnTo?: string;
  // Tuesday Patch Completion Round §H: "the weekly contract-rate estimate
  // exists in War Room. The original complaint was made while looking at
  // CRM/client context." Same RateEquivalent shape War Room's Section V
  // renders -- CRM is a read-only projection of it, never a second
  // monetary calculation. Null when this client has no active hourly
  // contract or no tracked time this week.
  weekEstimate: RateEquivalent | null;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            Internal only
          </p>
          <h3 className="mt-1 font-black text-white">Client Intelligence</h3>
        </div>
        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
          Never shown to client
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-zinc-950/50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">Active projects</p>
          <p className="mt-1 text-xl font-black text-white">{summary.activeProjectsCount}</p>
        </div>
        <div className="rounded-xl bg-zinc-950/50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">In production</p>
          <p className="mt-1 text-xl font-black text-white">{summary.videosInProgressCount}</p>
        </div>
        <div className="rounded-xl bg-zinc-950/50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">Completed videos</p>
          <p className="mt-1 text-xl font-black text-white">{summary.completedVideosCount}</p>
        </div>
        <div className="rounded-xl bg-zinc-950/50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">Revisions (delivered)</p>
          <p className="mt-1 text-xl font-black text-white">{summary.revisionCount}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-zinc-950/50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">Tracked production time</p>
          <p className="mt-1 text-lg font-black text-cyan-300">
            {summary.trackedProductionSeconds > 0
              ? formatClosedDuration(summary.trackedProductionSeconds)
              : "No time tracked yet"}
          </p>
        </div>
        <div className="rounded-xl bg-zinc-950/50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">Last worked on</p>
          <p className="mt-1 text-lg font-black text-zinc-200">
            {summary.lastWorkedOnIso ? formatTimestamp(summary.lastWorkedOnIso) : "Never"}
          </p>
        </div>
      </div>

      {weekEstimate && (
        <div className="mt-3 rounded-xl bg-zinc-950/50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">This week</p>
          <p className="mt-1 text-sm text-zinc-300">
            Tracked: <span className="font-black text-white">{(weekEstimate.attributableSeconds / 3600).toFixed(1)}h</span>
            <span className="mx-1.5 text-zinc-700">·</span>
            Estimated value:{" "}
            <span className="font-black text-emerald-300">
              {formatCurrency(weekEstimate.rateEquivalent, weekEstimate.currency)}
            </span>
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            Active hourly contract rate × tracked hours -- not billed, not income. Finance is the financial authority.
          </p>
        </div>
      )}

      {summary.recentMemoryNotes.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
            Recent operational memory
          </p>
          <ol className="space-y-2">
            {summary.recentMemoryNotes.map((note) => (
              <li key={note.id} className="rounded-lg bg-zinc-950/50 p-3">
                <p className="text-xs leading-5 text-zinc-300">{note.body}</p>
                <p className="mt-1 text-[10px] font-semibold text-zinc-600">
                  <Link
                    href={videoWorkspaceHref(note.videoId, returnTo)}
                    className="text-cyan-500 hover:text-cyan-400"
                  >
                    {note.videoTitle}
                  </Link>{" "}
                  · {formatTimestamp(note.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="mt-4 text-[10px] leading-4 text-zinc-700">
        Derived from existing Projects, Video lifecycle, Work Sessions, and
        Video Memory data. No new manual input. Internal-only -- never
        exposed on the client Vault or Gateway.
      </p>
    </section>
  );
}
