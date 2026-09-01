import type { getFactoryState } from "./data";
import type { OpenWorkSession } from "@/modules/work-sessions/core";
import type { CommitmentWithOwnerLabel } from "@/modules/commitments/data";

type FactoryState = Awaited<ReturnType<typeof getFactoryState>>;

// Wave 2F: facts surface, no scores. Server component -- purely
// presentational composition of data already fetched on the page.
export function FactoryStatePanel({
  openSession,
  nextCommitment,
  overdueCommitments,
  stale,
  avoidableQaCount,
  factory,
}: {
  openSession: OpenWorkSession | null;
  nextCommitment: CommitmentWithOwnerLabel | null;
  overdueCommitments: CommitmentWithOwnerLabel[];
  stale: boolean;
  avoidableQaCount: number;
  factory: FactoryState;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Factory State</p>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Now</p>
        <p className="text-xs text-zinc-300">{openSession ? `${openSession.videoTitle} — ${openSession.activityType}${stale ? " (stale)" : ""}` : "Nothing active"}</p>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Next</p>
        <p className="text-xs text-zinc-300">{nextCommitment ? nextCommitment.description : "No open commitments"}</p>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Attention</p>
        <ul className="text-xs text-zinc-300 space-y-0.5">
          <li className={overdueCommitments.length ? "text-red-400" : ""}>{overdueCommitments.length} overdue commitment(s)</li>
          <li className={stale ? "text-amber-400" : ""}>{stale ? "1 stale session" : "0 stale sessions"}</li>
          <li className={factory.blockedVideos.length ? "text-amber-400" : ""}>{factory.blockedVideos.length} blocked video(s)</li>
          <li className={avoidableQaCount ? "text-red-400" : ""}>{avoidableQaCount} avoidable QA failure(s) (30d)</li>
        </ul>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Waiting</p>
        {Object.keys(factory.waitingGroups).length === 0 ? (
          <p className="text-xs text-zinc-500">Nothing waiting.</p>
        ) : (
          <ul className="text-xs text-zinc-300 space-y-0.5">
            {Object.entries(factory.waitingGroups).map(([who, items]) => (
              <li key={who}>
                <span className="text-zinc-500">{who}:</span> {items.map((i) => i.label).join(", ")}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Factory (WIP)</p>
        <p className="text-xs text-zinc-300">{factory.activeProjectCount} project(s)</p>
        <ul className="text-xs text-zinc-500 space-y-0.5 mt-1">
          {Object.entries(factory.videosByStatus).map(([status, count]) => (
            <li key={status}>{status}: {count}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
