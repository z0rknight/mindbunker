"use client";

import Link from "next/link";
import {
  FinishedVideoButton,
  NewWorkButton,
  StartWorkButton,
} from "@/components/ui/ProductivityQuickActions";
import {
  WORK_SESSION_ACTIVITY_LABELS,
  formatClosedDuration,
  type OpenWorkSession,
} from "@/modules/work-sessions/core";

// Dashboard entry point for the Client → Project → Video → Activity → Start
// flow (Sprint 1.2.x local dogfooding round). When nothing is running, the
// Dashboard's default state is the two primary actions -- [Start Work] to
// the left of [Finished Video] -- rather than a permanently exposed
// four-field form; the full selection flow now lives behind Start Work's
// own compact modal (see StartWorkButton in ProductivityQuickActions.tsx).
// When a session is already active, this surfaces that state instead of
// presenting a normal Start flow, exactly as before.
export function HomeTrackingPanel({
  openSession,
  openSessionElapsedSeconds,
}: {
  openSession: OpenWorkSession | null;
  openSessionElapsedSeconds: number;
}) {
  if (openSession) {
    return (
      <section className="mb-8 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.07] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Tracking now
            </p>
            <h2 className="mt-2 truncate text-lg font-black text-white">{openSession.videoTitle}</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {WORK_SESSION_ACTIVITY_LABELS[openSession.activityType]} · {formatClosedDuration(openSessionElapsedSeconds)} elapsed
            </p>
          </div>
          <Link
            href={`/productivity?video=${openSession.videoId}`}
            className="min-h-12 rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-black text-zinc-950 hover:bg-emerald-400"
          >
            Open active workspace
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-zinc-400 text-xs font-semibold uppercase tracking-widest">Primary Actions</h2>
      <div className="grid grid-cols-2 gap-3 sm:max-w-lg sm:grid-cols-3">
        <NewWorkButton />
        <StartWorkButton />
        <FinishedVideoButton />
      </div>
    </section>
  );
}
