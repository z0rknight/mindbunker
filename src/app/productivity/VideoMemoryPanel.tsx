"use client";

import {
  addVideoOperationalNote,
  getVideoOperationalMemory,
} from "@/modules/video-memory/actions";
import { VIDEO_OPERATIONAL_NOTE_MAX_LENGTH } from "@/modules/video-memory/core";
import { useEffect, useState, useTransition } from "react";

type MemoryEntry = {
  id: number;
  body: string;
  createdAt: string;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

// Sprint 1.2 native intelligence audit, item D: capture and retrieval are
// different UX problems. Write path (the textarea above) stays completely
// unbounded and low-friction — this constant only bounds the READ path, so
// a video with many notes does not distort the production floor page.
// Pure client-side rendering change; the data layer still fetches every
// entry (no query/schema change), so "Show all" never triggers a second
// request.
const COLLAPSED_ENTRY_COUNT = 5;

export function VideoMemoryPanel({ videoId }: { videoId: number }) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getVideoOperationalMemory(videoId).then((result) => {
      if (!active) return;
      if (result.success) {
        setEntries(result.entries);
      } else {
        setFeedback(result.error);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [videoId]);

  function addNote(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    startTransition(async () => {
      const result = await addVideoOperationalNote(videoId, body);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setEntries((current) => [result.entry, ...current]);
      setBody("");
      setFeedback("Memory saved.");
    });
  }

  return (
    <section className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">
            Video memory
          </p>
          <h3 className="mt-1 font-black text-white">What happened while making this?</h3>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">
          Newest first
        </span>
      </div>

      <form onSubmit={addNote} className="mt-4">
        <label htmlFor={`video-memory-${videoId}`} className="sr-only">
          Add operational note
        </label>
        <textarea
          id={`video-memory-${videoId}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={VIDEO_OPERATIONAL_NOTE_MAX_LENGTH}
          rows={3}
          placeholder="Add note…"
          className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950/75 px-3.5 py-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-zinc-600">⌘/Ctrl + Enter to save</p>
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {isPending ? "Saving…" : "Add note"}
          </button>
        </div>
      </form>

      {feedback && <p aria-live="polite" className="mt-3 text-sm text-violet-200">{feedback}</p>}

      <div className="mt-4 border-t border-zinc-800 pt-4">
        {loading ? (
          <p className="text-sm text-zinc-600">Loading memory…</p>
        ) : entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-600">
            No operational memory yet. Add the first useful fact.
          </p>
        ) : (
          <>
            <ol className="space-y-3">
              {(expanded ? entries : entries.slice(0, COLLAPSED_ENTRY_COUNT)).map((entry) => (
                <li key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-950/45 p-3.5">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{entry.body}</p>
                  <time dateTime={entry.createdAt} className="mt-2 block text-[11px] font-bold text-zinc-600">
                    {formatTimestamp(entry.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
            {!expanded && entries.length > COLLAPSED_ENTRY_COUNT && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="mt-3 min-h-9 w-full rounded-xl border border-zinc-800 text-xs font-bold text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              >
                Show {entries.length - COLLAPSED_ENTRY_COUNT} more
              </button>
            )}
            {expanded && entries.length > COLLAPSED_ENTRY_COUNT && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="mt-3 min-h-9 w-full rounded-xl border border-zinc-800 text-xs font-bold text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              >
                Show fewer
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
