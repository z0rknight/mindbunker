"use client";

import {
  FinishedVideoButton,
  NewWorkButton,
  StartWorkButton,
} from "@/components/ui/ProductivityQuickActions";
import { NowFocusPanel } from "@/components/work-sessions/NowFocusPanel";
import { QuickBlock, QuickNote } from "@/components/work-sessions/QuickVideoActions";
import type { OpenWorkSession } from "@/modules/work-sessions/core";

// Dashboard entry point for the Client -> Project -> Video -> Activity ->
// Start flow (Sprint 1.2.x local dogfooding round). When nothing is
// running, the Dashboard's default state is the two primary actions --
// [Start Work] to the left of [Finished Video] -- rather than a
// permanently exposed four-field form; the full selection flow now lives
// behind Start Work's own compact modal (see StartWorkButton in
// ProductivityQuickActions.tsx). When a session is already active, this
// surfaces that state instead of presenting a normal Start flow, exactly
// as before.
//
// NIGHT SHIFT REALITY PATCH SS3: the active-session block also renders the
// real Operator -> Sensor device -> Client -> Project hierarchy, showing
// only the dimensions that actually exist for this session -- never
// fabricating a client/project/device that isn't there (e.g. an ADMIN
// task has no client/project; a WEB_TIMER session has no device). SS4: a
// compact, collapsed-by-default "Quick note" affordance writes straight
// to the same canonical video-memory stream productivity/VideoMemoryPanel
// already reads, so Emmanuel never has to leave Home (or open
// ChatGPT/Notion) just to jot down what happened mid-session.
export function HomeTrackingPanel({
  openSession,
  openSessionElapsedSeconds,
}: {
  openSession: OpenWorkSession | null;
  openSessionElapsedSeconds: number;
}) {
  if (openSession) {
    return (
      <NowFocusPanel
        openSession={openSession}
        openSessionElapsedSeconds={openSessionElapsedSeconds}
        variant="compact"
      >
        <div className="mt-4 flex flex-wrap gap-2 border-t border-emerald-500/15 pt-4">
          <QuickNote videoId={openSession.videoId} />
          <QuickBlock videoId={openSession.videoId} />
        </div>
      </NowFocusPanel>
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

