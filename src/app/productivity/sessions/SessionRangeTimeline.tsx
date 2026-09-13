import Link from "next/link";
import {
  WORK_SESSION_ACTIVITY_LABELS,
  formatClosedDuration,
} from "@/modules/work-sessions/core";
import {
  rawDurationSeconds,
  sessionsByDayKey,
  type SessionTimelineItem,
} from "@/modules/work-sessions/timeline";

function formatDay(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionRangeTimeline({
  items,
  totalCountBeforeFilters,
}: {
  items: SessionTimelineItem[];
  totalCountBeforeFilters: number;
}) {
  const byDay = sessionsByDayKey(items);
  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a));

  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-14 text-center text-sm text-zinc-600">
        {totalCountBeforeFilters > 0
          ? "No sessions match the current filters in this range."
          : "No canonical Work Sessions in this range."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-[#0A0A0A] p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Tracked</p>
          <p className="mt-1 text-lg font-black text-cyan-300">
            {formatClosedDuration(rawDurationSeconds(items))}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#0A0A0A] p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Sessions</p>
          <p className="mt-1 text-lg font-black text-white">{items.length}</p>
        </div>
        <div className="hidden rounded-lg border border-zinc-800 bg-[#0A0A0A] p-3 sm:block">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Active days</p>
          <p className="mt-1 text-lg font-black text-violet-300">{days.length}</p>
        </div>
      </div>

      {days.map((day) => {
        const sessions = byDay.get(day) ?? [];
        return (
          <section key={day} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/35">
            <Link
              href={`/productivity/sessions?view=timeline&range=day&date=${day}`}
              className="flex min-h-14 items-center justify-between gap-3 border-b border-zinc-800 px-4 transition hover:bg-zinc-900/70"
            >
              <div>
                <h2 className="text-sm font-black text-white">{formatDay(day)}</h2>
                <p className="mt-0.5 text-[11px] text-zinc-600">Open detailed day timeline →</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-cyan-300">{formatClosedDuration(rawDurationSeconds(sessions))}</p>
                <p className="text-[10px] text-zinc-600">{sessions.length} session{sessions.length === 1 ? "" : "s"}</p>
              </div>
            </Link>

            <ol className="divide-y divide-zinc-900">
              {sessions.map((session) => (
                <li key={session.id} className="flex min-w-0 items-center gap-3 px-4 py-2.5">
                  <time dateTime={session.startedAt} className="w-12 shrink-0 font-mono text-[11px] text-zinc-600">
                    {formatTime(session.startedAt)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-zinc-200">
                      {session.clientName ?? "Internal"}
                      {session.projectName ? ` · ${session.projectName}` : ""}
                    </p>
                    <p className="truncate text-[11px] text-zinc-600">
                      {session.videoTitle} · {WORK_SESSION_ACTIVITY_LABELS[session.activityType]}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-bold ${session.status === "OPEN" ? "text-[#00FF41]" : "text-zinc-400"}`}>
                    {session.status === "OPEN" ? "Running" : formatClosedDuration(session.durationSeconds)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
