"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import {
  monthDayKeys,
  rawDurationSeconds,
  sessionsByDayKey,
  type SessionTimelineItem,
} from "@/modules/work-sessions/timeline";
import { pixelFont } from "./fonts";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function SessionMonthCalendar({ items, monthKey }: {
  items: SessionTimelineItem[];
  monthKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const byDay = sessionsByDayKey(items);
  const days = monthDayKeys(monthKey);
  const firstDay = days[0];
  const leadingBlanks = firstDay
    ? (new Date(`${firstDay}T12:00:00Z`).getUTCDay() + 6) % 7
    : 0;
  const activeDays = days.filter((day) => (byDay.get(day)?.length ?? 0) > 0);

  function goToDay(dateKey: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "timeline");
    params.set("date", dateKey);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-[#0A0A0A] p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Tracked</p>
          <p className="mt-1 text-lg font-black text-cyan-300">{formatClosedDuration(rawDurationSeconds(items))}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#0A0A0A] p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Sessions</p>
          <p className="mt-1 text-lg font-black text-white">{items.length}</p>
        </div>
        <div className="hidden rounded-lg border border-zinc-800 bg-[#0A0A0A] p-3 sm:block">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Active days</p>
          <p className="mt-1 text-lg font-black text-violet-300">{activeDays.length}</p>
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="mb-2 grid grid-cols-7 gap-2">
          {DAY_LABELS.map((label) => (
            <span key={label} className={`${pixelFont.className} text-center text-[8px] uppercase text-zinc-600`}>{label}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: leadingBlanks }, (_, index) => <div key={`blank-${index}`} />)}
          {days.map((day) => {
            const sessions = byDay.get(day) ?? [];
            const total = rawDurationSeconds(sessions);
            return (
              <button
                key={day}
                type="button"
                onClick={() => goToDay(day)}
                className={`min-h-24 rounded-lg border p-2 text-left transition ${
                  sessions.length > 0
                    ? "border-zinc-700 bg-zinc-900 hover:border-cyan-600/60"
                    : "border-zinc-900 bg-zinc-950/40 text-zinc-700 hover:border-zinc-800"
                }`}
              >
                <span className="text-xs font-bold text-zinc-400">{Number(day.slice(-2))}</span>
                {sessions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-black text-cyan-300">{formatClosedDuration(total)}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{sessions.length} session{sessions.length === 1 ? "" : "s"}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 sm:hidden">
        {activeDays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-600">
            No canonical Work Sessions in this month.
          </div>
        ) : activeDays.map((day) => {
          const sessions = byDay.get(day) ?? [];
          const total = rawDurationSeconds(sessions);
          return (
            <button key={day} type="button" onClick={() => goToDay(day)} className="flex min-h-14 w-full items-center justify-between rounded-lg border border-zinc-800 bg-[#0A0A0A] px-3 text-left">
              <div>
                <p className="text-sm font-bold text-white">{new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })}</p>
                <p className="text-[11px] text-zinc-600">{sessions.length} session{sessions.length === 1 ? "" : "s"}</p>
              </div>
              <span className="text-sm font-black text-cyan-300">{formatClosedDuration(total)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
