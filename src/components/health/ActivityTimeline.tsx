"use client";

// Monday Local Intelligence Lab §K — Strava/GitHub-activity-calendar
// inspired (not branded) visual timeline answering "when did I walk or
// bike," with a compact day-detail drawer. Pure CSS grid, no chart
// dependency. Receives pre-computed, already-honest data from the server
// (src/app/health/page.tsx via buildActivityTimelineDays) -- this
// component only renders it and manages which day's drawer is open.

import { useState } from "react";
import { formatDate } from "@/utils/date";
import {
  groupTimelineDaysIntoWeekColumns,
  type ActivityTimelineDay,
} from "@/modules/health/core";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function cellColorClass(day: ActivityTimelineDay): string {
  if (day.walked && day.cycled) return "bg-gradient-to-br from-teal-500 to-cyan-500";
  if (day.walked) return "bg-teal-600";
  if (day.cycled) return "bg-cyan-600";
  return "bg-zinc-800";
}

export function ActivityTimeline({ days }: { days: ActivityTimelineDay[] }) {
  const [selected, setSelected] = useState<ActivityTimelineDay | null>(null);
  const weeks = groupTimelineDaysIntoWeekColumns(days);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Activity Timeline — walk / bike
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-600" /> walk
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-cyan-600" /> bike
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1" style={{ minWidth: `${weeks.length * 16}px` }}>
          <div className="flex flex-col gap-1 pr-1">
            {WEEKDAY_LABELS.map((label, i) => (
              <span
                key={label}
                className="flex h-3 items-center text-[9px] text-zinc-600"
                style={{ visibility: i % 2 === 0 ? "visible" : "hidden" }}
              >
                {label}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelected(day)}
                  title={day.date}
                  className={`h-3 w-3 rounded-sm transition-transform hover:scale-125 ${cellColorClass(day)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-zinc-600">
        Tap a day for details. Only real recorded log entries are shown — no
        fabricated duration or distance.
      </p>

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="safe-sheet max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-bold text-base">
                {formatDate(selected.date)}
              </h4>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">🚶 Walk</dt>
                <dd className="text-white tabular-nums">
                  {selected.walkingMinutes !== null ? `${selected.walkingMinutes} min` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">🚴 Bike</dt>
                <dd className="text-white tabular-nums">
                  {selected.cyclingKm !== null ? `${selected.cyclingKm} km` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">😴 Sleep</dt>
                <dd className="text-white tabular-nums">
                  {selected.sleepHours !== null ? `${selected.sleepHours}h` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">☕ Coffees</dt>
                <dd className="text-white tabular-nums">
                  {selected.caffeineCount !== null ? selected.caffeineCount : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
