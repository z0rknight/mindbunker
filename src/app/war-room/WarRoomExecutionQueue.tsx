"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EntityInspectionTrigger } from "@/components/entity-inspection/EntityDrawerProvider";
import { FinishedVideoButton, PlanVideoButton } from "@/components/ui/QuickActions";
import type { CurrentExecution, ExecutionRecommendation } from "@/modules/execution/core";
import { videoWorkspaceHref } from "@/modules/productivity/core";
import type { QueueRow } from "@/app/productivity/ExecutionQueueSection";
import { ExecutionQueueSection } from "@/app/productivity/ExecutionQueueSection";
import { selectCompactExecutionQueue } from "@/modules/war-room/execution-queue";

export function WarRoomExecutionQueue({
  queue,
  current,
  recommended,
}: {
  queue: QueueRow[];
  current: CurrentExecution | null;
  recommended: ExecutionRecommendation | null;
}) {
  const [open, setOpen] = useState(false);
  const compact = selectCompactExecutionQueue(queue, {
    currentVideoId: current?.video.id,
    recommendedVideoId: recommended?.videoId,
  });
  const now = current
    ? { id: current.video.id, title: current.video.title, state: current.blocker ? "BLOCKED" : "ACTIVE" }
    : recommended
      ? { id: recommended.videoId, title: recommended.title, state: "IDLE · RECOMMENDED" }
      : null;

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <section aria-labelledby="war-room-execution-queue" className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Execution queue</p>
          <h2 id="war-room-execution-queue" className="mt-1 text-lg font-black text-white">NOW / NEXT / LATER</h2>
          <p className="mt-1 text-xs text-zinc-500">A bounded view of the canonical production queue.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-xl border border-cyan-800 bg-cyan-950/20 px-4 text-xs font-black text-cyan-200 hover:border-cyan-500">
          Open production queue →
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_2fr_0.65fr]">
        <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">NOW</p>
          {now ? (
            <>
              <span className={`mt-2 inline-block text-[10px] font-black ${now.state === "BLOCKED" ? "text-red-300" : now.state === "ACTIVE" ? "text-emerald-300" : "text-cyan-300"}`}>{now.state}</span>
              <EntityInspectionTrigger entity={{ type: "video", id: now.id }} className="mt-1 block text-left text-sm font-black text-white hover:text-cyan-200">{now.title}</EntityInspectionTrigger>
            </>
          ) : <p className="mt-2 text-sm text-zinc-600">Queue clear.</p>}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">NEXT · {compact.next.length}</p>
          <div className="mt-2 divide-y divide-zinc-800">
            {compact.next.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <EntityInspectionTrigger entity={{ type: "video", id: item.id }} className="min-w-0 truncate text-left text-sm font-bold text-zinc-200 hover:text-cyan-200">
                  {item.title ?? `Video ${item.date}`}
                </EntityInspectionTrigger>
                <Link href={videoWorkspaceHref(item.id, "/war-room")} className="shrink-0 text-[10px] font-black text-zinc-500 hover:text-white">Manage</Link>
              </div>
            ))}
            {compact.next.length === 0 && <p className="text-sm text-zinc-600">No executable work waiting.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">LATER</p>
          <p className="mt-2 font-mono text-3xl font-black text-zinc-300">{compact.laterCount}</p>
          <p className="text-[10px] text-zinc-600">queued / blocked / review</p>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Production queue" onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
          <div className="max-h-[94dvh] w-full max-w-7xl overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl sm:rounded-2xl sm:p-6">
            <header className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">War Room tool</p>
                <h2 className="mt-1 text-xl font-black text-white">Full Production Queue</h2>
                <p className="mt-1 text-xs text-zinc-500">Search, filter, reorder, start, inspect, or enter deep management.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 min-w-11 rounded-full bg-zinc-800 text-xl text-zinc-300" aria-label="Close production queue">×</button>
            </header>
            <div className="mb-5 grid gap-2 border-y border-zinc-800 py-4 sm:grid-cols-2 lg:grid-cols-5">
              <PlanVideoButton compact />
              <FinishedVideoButton />
              <Link href="/productivity/orders" className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-800 px-3 text-xs font-black text-emerald-300">Production Orders</Link>
              <Link href="/productivity/backfill" className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 px-3 text-xs font-black text-zinc-300">Backfill a day</Link>
              <Link href="/productivity/captures" className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 px-3 text-xs font-black text-zinc-300">Capture Inbox</Link>
            </div>
            <ExecutionQueueSection queue={queue} activeVideoId={current?.video.id ?? null} interactiveFilters />
          </div>
        </div>
      )}
    </section>
  );
}
