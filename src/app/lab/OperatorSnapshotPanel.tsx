"use client";
import { useState, useTransition } from "react";
import { buildVideoContextText, buildDayContextText } from "./copy-context-actions";

type Option = { id: number; title: string };

// Wave 4W: plain-text Operator Snapshot export -- current day, or a
// selected video's full context -- for pasting into Claude/Codex/Notion/
// manual archive. No API integration; the browser clipboard is the only
// mechanism.
export function OperatorSnapshotPanel({ videos }: { videos: Option[] }) {
  const [videoId, setVideoId] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy(value: string) {
    setText(value);
    setCopied(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard API can be unavailable (non-secure context, permissions) --
      // the text still renders below for manual copy.
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Export Operator Snapshot</p>
      <div className="flex gap-1.5">
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await copy(await buildDayContextText()); })}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Copy Today
        </button>
        <select value={videoId} onChange={(e) => setVideoId(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white">
          <option value="">Select video…</option>
          {videos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
        </select>
        <button
          disabled={pending || !videoId}
          onClick={() => startTransition(async () => { await copy(await buildVideoContextText(Number(videoId))); })}
          className="shrink-0 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Copy Video
        </button>
      </div>
      {copied && <p className="text-[10px] text-emerald-400">Copied to clipboard.</p>}
      {text && <textarea readOnly value={text} rows={8} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-[10px] text-zinc-300 font-mono" />}
    </div>
  );
}
