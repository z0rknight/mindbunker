"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import {
  computeOverlaps,
  rawDurationSeconds,
  sessionsByDayKey,
  type SessionTimelineItem,
} from "@/modules/work-sessions/timeline";
import { pixelFont } from "./fonts";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function SessionWeekCalendar({
  items,
  mondayKey,
  nowIso,
}: {
  items: SessionTimelineItem[];
  mondayKey: string;
  nowIso: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToDay(dateKey: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "timeline");
    params.set("date", dateKey);
    router.push(`${pathname}?${params.toString()}`);
  }

  const byDay = sessionsByDayKey(items);
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDays(mondayKey, i));

  // Dynamic time-of-day window for the compact mini-tracks -- derived from
  // the actual sessions in view (padded by an hour on each side), rather
  // than a hardcoded window that could clip real, early or late-running
  // sessions.
  let minHour = 9;
  let maxHour = 18;
  for (const session of items) {
    const start = new Date(session.startedAt);
    const end = new Date(session.endedAt ?? nowIso);
    minHour = Math.min(minHour, start.getHours());
    maxHour = Math.max(maxHour, end.getHours() + (end.getMinutes() > 0 ? 1 : 0));
  }
  minHour = Math.max(0, minHour - 1);
  maxHour = Math.min(24, maxHour + 1);
  const span = Math.max(1, maxHour - minHour);

  return (
    <div>
      {/* Desktop / iPad landscape: 7-column grid */}
      <div className="hidden gap-2 sm:grid" style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}>
        {dayKeys.map((dayKey, i) => {
          const sessions = (byDay.get(dayKey) ?? []).sort(
            (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt),
          );
          const overlaps = computeOverlaps(sessions, nowIso);
          const total = rawDurationSeconds(sessions);
          const [, , dNum] = dayKey.split("-");

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => goToDay(dayKey)}
              className={`flex min-h-[300px] flex-col rounded-md border p-2 text-left ${
                sessions.length === 0 ? "border-zinc-900 opacity-50" : "border-zinc-800 hover:border-cyan-800/60"
              } bg-[#0A0A0A]`}
            >
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className={`${pixelFont.className} text-[8px] uppercase tracking-wide text-zinc-500`}>
                  {DAY_LABELS[i]} {Number(dNum)}
                </span>
                {total > 0 && <span className="text-[9px] font-bold text-cyan-400">{formatClosedDuration(total)}</span>}
              </div>
              <div className="relative flex-1 overflow-hidden rounded bg-black/40">
                {sessions.length === 0 ? (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-700">—</span>
                ) : (
                  sessions.map((session) => {
                    const start = new Date(session.startedAt);
                    const end = new Date(session.endedAt ?? nowIso);
                    const startPct = Math.max(0, ((start.getHours() + start.getMinutes() / 60 - minHour) / span) * 100);
                    const endPct = Math.min(100, ((end.getHours() + end.getMinutes() / 60 - minHour) / span) * 100);
                    const height = Math.max(3, endPct - startPct);
                    const isOverlap = (overlaps.get(session.id)?.length ?? 0) > 0;
                    const isOpen = session.status === "OPEN";
                    return (
                      <div
                        key={session.id}
                        title={`${session.clientName ?? "—"} · ${session.projectName ?? ""}`}
                        style={{ top: `${startPct}%`, height: `${height}%` }}
                        className={`absolute inset-x-0.5 overflow-hidden rounded-sm border px-1 text-[8px] leading-tight ${
                          isOpen
                            ? "border-[#00FF41]/50 bg-[#00FF41]/10 text-[#00FF41]"
                            : isOverlap
                              ? "border-[#FF0000]/45 bg-[#FF0000]/10 text-red-300"
                              : session.videoKind === "INTERNAL"
                                ? "border-violet-700/50 bg-violet-500/10 text-violet-300"
                                : "border-zinc-700 bg-zinc-800/70 text-zinc-300"
                        }`}
                      >
                        {session.clientName ? session.clientName.split(" ")[0] : "RMEDIA"}
                      </div>
                    );
                  })
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Phone: compact agenda list, never a squeezed 7-column grid */}
      <div className="flex flex-col gap-2 sm:hidden">
        {dayKeys.map((dayKey, i) => {
          const sessions = byDay.get(dayKey) ?? [];
          const total = rawDurationSeconds(sessions);
          const barPct = Math.min(100, (total / (8 * 3600)) * 100);
          const [, , dNum] = dayKey.split("-");
          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => goToDay(dayKey)}
              className="flex items-center gap-3 rounded-md border border-zinc-800 bg-[#0A0A0A] px-3 py-2.5"
            >
              <span className="w-14 flex-shrink-0 text-left text-xs font-bold text-zinc-200">
                {DAY_LABELS[i]} {Number(dNum)}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-900">
                <span className="block h-full rounded-full bg-cyan-700" style={{ width: `${barPct}%` }} />
              </span>
              <span className="w-14 flex-shrink-0 text-right text-[11px] font-bold text-zinc-400">
                {total > 0 ? formatClosedDuration(total) : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
