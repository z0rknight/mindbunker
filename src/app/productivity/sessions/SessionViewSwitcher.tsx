"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { shiftDateKey } from "@/utils/date";
import { distinctFilterOptions, type SessionTimelineItem } from "@/modules/work-sessions/timeline";
import { pixelFont } from "./fonts";

export type SessionViewMode = "timeline" | "week" | "table";

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

export function SessionViewSwitcher({
  view,
  dateKey,
  mondayKey,
  clientFilter,
  sourceFilter,
  workTypeFilter,
  items,
}: {
  view: SessionViewMode;
  dateKey: string;
  mondayKey?: string;
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
          {(["timeline", "week", "table"] as const).map((mode) => (
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
                  date: view === "week" ? shiftDateKey(dateKey, -7) : shiftDateKey(dateKey, -1),
                })
              }
              className="flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-[#00FF41]/40 hover:text-[#00FF41]"
            >
              ‹
            </button>
            <span className="min-w-[150px] text-center text-xs font-bold text-zinc-200">
              {view === "week" ? formatWeekLabel(mondayKey ?? dateKey) : formatDayLabel(dateKey)}
            </span>
            <button
              type="button"
              aria-label="Next"
              onClick={() =>
                navigate({
                  date: view === "week" ? shiftDateKey(dateKey, 7) : shiftDateKey(dateKey, 1),
                })
              }
              className="flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-[#00FF41]/40 hover:text-[#00FF41]"
            >
              ›
            </button>
          </div>
        )}
      </div>

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
