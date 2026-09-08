"use client";

import { useState, useTransition } from "react";
import { addVideoOperationalNote } from "@/modules/video-memory/actions";
import { VIDEO_OPERATIONAL_NOTE_MAX_LENGTH } from "@/modules/video-memory/core";
import { openVideoBlocker } from "@/modules/video-operations/actions";
import { BLOCKER_CATEGORIES, type BlockerCategory } from "@/modules/video-operations/config";

// Tuesday Patch Completion Round §G: "Add Note and Block should not
// require opening the full workspace" from the NOW/FOCUS dominant card.
// Extracted from HomeTrackingPanel's own local QuickNote (previously
// Dashboard-only) so Productivity's NowFocusPanel gets the identical
// component instead of a second implementation -- both write through the
// exact same canonical actions VideoMemoryPanel / OperationalMemoryPanel
// already use elsewhere (addVideoOperationalNote, openVideoBlocker), so a
// note or blocker added here shows up there too, no new storage.

export function QuickNote({ videoId }: { videoId: number }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-9 rounded-lg border border-emerald-500/25 px-3 text-xs font-bold text-emerald-300/80 hover:border-emerald-500/50 hover:text-emerald-200"
      >
        + Add note
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
    <form onSubmit={submit} className="w-full">
      <label htmlFor={`quick-note-${videoId}`} className="sr-only">
        Quick note for this session
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`quick-note-${videoId}`}
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

export function QuickBlock({ videoId }: { videoId: number }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BlockerCategory>("CLIENT");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-9 rounded-lg border border-red-500/25 px-3 text-xs font-bold text-red-300/80 hover:border-red-500/50 hover:text-red-200"
      >
        + Block
      </button>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    startTransition(async () => {
      const result = await openVideoBlocker({ videoId, category, note });
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setNote("");
      setFeedback("Blocked.");
      setOpen(false);
    });
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as BlockerCategory)}
          className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950/75 px-3 text-sm text-white outline-none focus:border-red-500"
        >
          {BLOCKER_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What is blocked?"
          maxLength={1_000}
          autoFocus
          className="min-h-11 flex-1 rounded-xl border border-zinc-700 bg-zinc-950/75 px-3.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
        />
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Block"}
        </button>
      </div>
      {feedback && <p aria-live="polite" className="mt-2 text-xs text-red-200">{feedback}</p>}
    </form>
  );
}
