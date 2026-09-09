"use client";

import { useMemo, useState } from "react";
import {
  WORK_SESSION_ACTIVITY_LABELS,
  formatClosedDuration,
} from "@/modules/work-sessions/core";
import {
  computeGaps,
  computeOverlaps,
  rawDurationSeconds,
  wallClockDurationSeconds,
  type SessionTimelineItem,
} from "@/modules/work-sessions/timeline";
import type { WorkSessionVideoOption } from "@/modules/work-sessions/data";
import { SessionInspectorPanel } from "./SessionInspectorPanel";
import { pixelFont } from "./fonts";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Short sessions still need a legible minimum footprint (Session Timeline
// exercise report §5) -- below this duration, a block drops its video
// title / pill row but keeps client, project and activity type visible,
// so a dense day never leaves a block with zero attribution shown.
const COMPACT_DURATION_SECONDS = 8 * 60;

export function SessionTimeline({
  items,
  totalCountBeforeFilters,
  dateKey,
  nowIso,
  videoOptions,
}: {
  items: SessionTimelineItem[];
  totalCountBeforeFilters: number;
  dateKey: string;
  nowIso: string;
  videoOptions: WorkSessionVideoOption[];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...items].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)),
    [items],
  );
  const overlaps = useMemo(() => computeOverlaps(sorted, nowIso), [sorted, nowIso]);
  const gaps = useMemo(() => computeGaps(sorted, nowIso), [sorted, nowIso]);
  const gapAfterId = useMemo(() => new Map(gaps.map((g) => [g.afterId, g.gapSeconds])), [gaps]);

  const hasOverlap = overlaps.size > 0;
  const raw = useMemo(() => rawDurationSeconds(sorted), [sorted]);
  const wall = useMemo(() => wallClockDurationSeconds(sorted, nowIso), [sorted, nowIso]);

  const selected = sorted.find((s) => s.id === selectedId) ?? null;

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-14 text-center text-sm text-zinc-600">
        {totalCountBeforeFilters > 0
          ? "No sessions match the current filters for this day."
          : "No sessions recorded this day."}
      </div>
    );
  }

  // Group consecutive sessions into overlap clusters so lane-splitting
  // only applies exactly where sessions actually overlap (exercise report
  // §5/§10) -- a normal, non-overlapping day renders as a single column.
  const clusters: SessionTimelineItem[][] = [];
  const seen = new Set<number>();
  for (const s of sorted) {
    if (seen.has(s.id)) continue;
    const cluster = [s];
    seen.add(s.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const member of cluster) {
        for (const otherId of overlaps.get(member.id) ?? []) {
          if (!seen.has(otherId)) {
            const other = sorted.find((x) => x.id === otherId);
            if (other) {
              cluster.push(other);
              seen.add(other.id);
              grew = true;
            }
          }
        }
      }
    }
    cluster.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
    clusters.push(cluster);
  }

  return (
    <div>
      {hasOverlap && (
        <div className="mb-4 rounded border border-amber-700/40 bg-amber-950/20 px-3 py-2.5 text-xs leading-5 text-amber-200">
          ⚠ Overlapping sessions on {dateKey} —{" "}
          <span className="font-bold">{formatClosedDuration(raw)}</span> raw (sum of
          each session) vs <span className="font-bold">{formatClosedDuration(wall)}</span>{" "}
          wall-clock (time actually covered). Both are shown honestly; neither has
          been merged or corrected automatically.
        </div>
      )}

      <ol className="relative border-l border-zinc-800 pl-4">
        {clusters.map((cluster) => {
          const gapSeconds = gapAfterId.get(cluster[cluster.length - 1].id);
          return (
            <li key={cluster[0].id} className="mb-1">
              <p className="-ml-4 mb-1 pl-0 text-[10px] font-bold text-zinc-600">
                <time dateTime={cluster[0].startedAt}>{formatTime(cluster[0].startedAt)}</time>
              </p>
              <div className={cluster.length > 1 ? "grid gap-2" : ""} style={cluster.length > 1 ? { gridTemplateColumns: `repeat(${cluster.length}, minmax(0,1fr))` } : undefined}>
                {cluster.map((session) => {
                  const isOverlap = (overlaps.get(session.id)?.length ?? 0) > 0;
                  const compact = session.durationSeconds < COMPACT_DURATION_SECONDS && cluster.length === 1;
                  const isOpen = session.status === "OPEN";
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedId(session.id)}
                      className={`w-full rounded-md border px-3 text-left transition-colors ${compact ? "py-2" : "py-2.5"} ${
                        isOpen
                          ? "border-[#00FF41]/40 bg-[#00FF41]/[0.06] hover:border-[#00FF41]/70"
                          : isOverlap
                            ? "border-[#FF0000]/35 bg-[#FF0000]/[0.06] hover:border-[#FF0000]/60"
                            : "border-zinc-800 bg-zinc-900/60 hover:border-cyan-800/60"
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-bold text-white">
                          {isOpen && (
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#00FF41] align-middle" />
                          )}
                          <time dateTime={session.startedAt}>{formatTime(session.startedAt)}</time>
                          {session.endedAt && (
                            <>
                              {" – "}
                              <time dateTime={session.endedAt}>{formatTime(session.endedAt)}</time>
                            </>
                          )}
                        </span>
                        <span className={`text-[11px] font-semibold ${isOpen ? "text-[#00FF41]" : "text-zinc-400"}`}>
                          {isOpen ? "● running" : formatClosedDuration(session.durationSeconds)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[12.5px] font-bold text-zinc-100">
                        {session.clientName ?? "—"}
                        {session.projectName ? ` · ${session.projectName}` : ""}
                        {compact ? ` · ${WORK_SESSION_ACTIVITY_LABELS[session.activityType]}` : ""}
                      </p>
                      {!compact && (
                        <>
                          <p className={`truncate text-[11px] ${session.videoKind === "INTERNAL" ? "text-violet-400" : "text-cyan-400"}`}>
                            {session.videoTitle}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-zinc-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-400">
                              {WORK_SESSION_ACTIVITY_LABELS[session.activityType]}
                            </span>
                            {(session.source === "MAC_SENSOR" || session.source === "MAC_SENSOR_APPROVED") && (
                              <span className="rounded-full border border-cyan-800/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-400">
                                Sensor
                              </span>
                            )}
                            {isOpen && (
                              <span className="rounded-full border border-[#00FF41]/40 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#00FF41]">
                                Open
                              </span>
                            )}
                            {session.updatedAt && (
                              <span className="rounded-full border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">
                                Corrected
                              </span>
                            )}
                            {isOverlap && (
                              <span className="rounded-full border border-[#FF0000]/40 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-400">
                                ⚠ Overlap
                              </span>
                            )}
                          </div>
                          {session.note && (
                            <p className="mt-1 truncate text-[11px] italic text-zinc-500">
                              &quot;{session.note}&quot;
                            </p>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
              {gapSeconds ? (
                <div
                  className={`${pixelFont.className} my-2 rounded border border-dashed border-zinc-800 py-2 text-center text-[8px] uppercase tracking-wide text-zinc-600`}
                >
                  {formatClosedDuration(gapSeconds)} gap
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <SessionInspectorPanel
        session={selected}
        isOverlap={selected ? (overlaps.get(selected.id)?.length ?? 0) > 0 : false}
        videoOptions={videoOptions}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
