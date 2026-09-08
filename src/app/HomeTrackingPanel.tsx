"use client";

import { useState, useTransition } from "react";
import {
  FinishedVideoButton,
  NewWorkButton,
  StartWorkButton,
} from "@/components/ui/ProductivityQuickActions";
import { NowFocusPanel } from "@/components/work-sessions/NowFocusPanel";
import type { OpenWorkSession } from "@/modules/work-sessions/core";
import { addVideoOperationalNote } from "@/modules/video-memory/actions";
import { VIDEO_OPERATIONAL_NOTE_MAX_LENGTH } from "@/modules/video-memory/core";

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
        <QuickNote videoId={openSession.videoId} />
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

// SS4: collapsed by default -- Home stays a compact daily surface (SS9)
// even though this affordance exists. Reuses the exact canonical note
// stream (crmEvents, type "video.note_added") that
// productivity/VideoMemoryPanel already reads, so a note added here shows
// up there too with no new storage.
function QuickNote({ videoId }: { videoId: number }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 min-h-9 rounded-lg border border-emerald-500/25 px-3 text-xs font-bold text-emerald-300/80 hover:border-emerald-500/50 hover:text-emerald-200"
      >
        + Quick note
      </button>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    startTransition(async () => {
      const result = await addVideoOperationalNote(videoId, body);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setBody("");
      setFeedback("Saved.");
      setOpen(false);
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 border-t border-emerald-500/15 pt-4">
      <label htmlFor={`home-quick-note-${videoId}`} className="sr-only">
        Quick note for this session
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`home-quick-note-${videoId}`}
          type="text"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={VIDEO_OPERATIONAL_NOTE_MAX_LENGTH}
          placeholder="What just happened?"
          autoFocus
          className="min-h-11 flex-1 rounded-xl border border-zinc-700 bg-zinc-950/75 px-3.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500 disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {feedback && <p aria-live="polite" className="mt-2 text-xs text-emerald-200">{feedback}</p>}
    </form>
  );
}
