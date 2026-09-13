"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { shiftDateKey } from "@/utils/date";
import { distinctFilterOptions, shiftMonthKey, type SessionTimelineItem } from "@/modules/work-sessions/timeline";
import { pixelFont } from "./fonts";

export type SessionViewMode = "timeline" | "week" | "month" | "table";
export type SessionTimelineRangeMode = "day" | "7d" | "30d" | "month";

const WORK_TYPE_LABELS: Record<string, string> = {
  CLIENT_WORK: "Client work",
  SAMPLE: "Sample",
  INTERNAL: "Internal",
};

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatWeekLabel(mondayKey: string): string {
  const [y, m, d] = mondayKey.split("-").map(Number);
  const monday = new Date(Date.UTC(y, m - 1, d));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

export function SessionViewSwitcher({
  view,
  dateKey,
  mondayKey,
  monthKey,
  timelineRange = "day",
  clientFilter,
  sourceFilter,
  workTypeFilter,
  items,
}: {
  view: SessionViewMode;
  dateKey: string;
  mondayKey?: string;
  monthKey?: string;
  timelineRange?: SessionTimelineRangeMode;
  clientFilter?: string | null;
  sourceFilter?: string | null;
  workTypeFilter?: string | null;
  items?: SessionTimelineItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const { clients, sources } = distinctFilterOptions(items ?? []);
  const showNavAndFilters = view !== "table";
  const timelineRangeLabel = timelineRange === "7d"
    ? "7 days"
    : timelineRange === "30d"
      ? "30 days"
      : timelineRange === "month"
        ? formatMonthLabel(monthKey ?? dateKey.slice(0, 7))
        : formatDayLabel(dateKey);

  function shiftedTimelineDate(direction: -1 | 1): string {
    if (timelineRange === "7d") return shiftDateKey(dateKey, 7 * direction);
    if (timelineRange === "30d") return shiftDateKey(dateKey, 30 * direction);
    if (timelineRange === "month") {
      return `${shiftMonthKey(monthKey ?? dateKey.slice(0, 7), direction)}-01`;
    }
    return shiftDateKey(dateKey, direction);
  }

  return (
    <div
      className="mb-5 rounded-lg border border-zinc-800 bg-[#0A0A0A] p-3"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-zinc-800 bg-black/40 p-0.5">
          {(["timeline", "week", "month", "table"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => navigate({ view: mode, date: mode === "table" ? null : dateKey })}
              className={`${pixelFont.className} rounded px-3 py-2 text-[9px] uppercase tracking-wide transition-colors ${
                view === mode
                  ? "bg-zinc-800 text-[#00FF41]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {showNavAndFilters && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous"
              onClick={() =>
                navigate({
                  date: view === "timeline"
                    ? shiftedTimelineDate(-1)
                    : view === "week"
                    ? shiftDateKey(dateKey, -7)
                    : view === "month"
                      ? `${shiftMonthKey(monthKey ?? dateKey.slice(0, 7), -1)}-01`
                      : shiftDateKey(dateKey, -1),
                })
              }
              className="flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-[#00FF41]/40 hover:text-[#00FF41]"
            >
              ‹
            </button>
            <span className="min-w-[150px] text-center text-xs font-bold text-zinc-200">
              {view === "timeline"
                ? timelineRangeLabel
                : view === "week"
                ? formatWeekLabel(mondayKey ?? dateKey)
                : view === "month"
                  ? formatMonthLabel(monthKey ?? dateKey.slice(0, 7))
                  : formatDayLabel(dateKey)}
            </span>
            <button
              type="button"
              aria-label="Next"
              onClick={() =>
                navigate({
                  date: view === "timeline"
                    ? shiftedTimelineDate(1)
                    : view === "week"
                    ? shiftDateKey(dateKey, 7)
                    : view === "month"
                      ? `${shiftMonthKey(monthKey ?? dateKey.slice(0, 7), 1)}-01`
                      : shiftDateKey(dateKey, 1),
                })
              }
              className="flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-[#00FF41]/40 hover:text-[#00FF41]"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {view === "timeline" && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-900 pt-3" aria-label="Timeline range">
          {([
            ["day", "Day"],
            ["7d", "7 days"],
            ["30d", "30 days"],
            ["month", "This month"],
          ] as const).map(([range, label]) => (
            <button
              key={range}
              type="button"
              onClick={() => navigate({ range })}
              className={`min-h-9 rounded-lg border px-3 text-[10px] font-black uppercase tracking-wide transition ${
                timelineRange === range
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {showNavAndFilters && (clients.length > 0 || sources.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-900 pt-3">
          {clients.length > 0 && (
            <select
              value={clientFilter ?? ""}
              onChange={(event) => navigate({ client: event.target.value || null })}
              className="min-h-8 rounded border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-300 outline-none focus:border-[#00FF41]/50"
            >
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          )}
          {sources.length > 0 && (
            <select
              value={sourceFilter ?? ""}
              onChange={(event) => navigate({ source: event.target.value || null })}
              className="min-h-8 rounded border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-300 outline-none focus:border-[#00FF41]/50"
            >
              <option value="">All sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          )}
          <select
            value={workTypeFilter ?? ""}
            onChange={(event) => navigate({ workType: event.target.value || null })}
            className="min-h-8 rounded border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-300 outline-none focus:border-[#00FF41]/50"
          >
            <option value="">All work types</option>
            {Object.entries(WORK_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {(clientFilter || sourceFilter || workTypeFilter) && (
            <button
              type="button"
              onClick={() => navigate({ client: null, source: null, workType: null })}
              className="text-[11px] font-bold text-zinc-500 hover:text-zinc-300"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
