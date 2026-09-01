"use client";

import { useState, useTransition } from "react";
import { changeRevisionCount } from "@/modules/productivity/actions";

type VideoOption = { id: number; title: string };

const CAUSES = [
  { value: "OUR_ERROR", label: "Our error" },
  { value: "CLIENT_CHANGE", label: "Client changed their mind" },
  { value: "SCOPE_CHANGE", label: "Scope changed" },
] as const;

// Cluster E: logs a revision (the existing +1 path) WITH a QA/rework
// provenance classification, so getQaAvoidableFailureStats has real data
// to compute an avoidable-failure rate from. Deliberately separate from
// the two existing quick-action buttons elsewhere in the app (which stay
// untouched, defaulting to UNKNOWN) -- this is an additive, opt-in surface.
export function RevisionClassifyForm({ videos }: { videos: VideoOption[] }) {
  const [videoId, setVideoId] = useState("");
  const [cause, setCause] = useState<(typeof CAUSES)[number]["value"]>("OUR_ERROR");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!videoId) return;
        startTransition(async () => {
          const result = await changeRevisionCount(Number(videoId), 1, cause);
          setMessage({
            ok: result.success,
            text: result.success ? (result.message ?? "Revision logged.") : result.error,
          });
        });
      }}
    >
      <p className="text-sm font-semibold text-white">Log classified revision</p>
      <select
        value={videoId}
        onChange={(e) => setVideoId(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
        required
      >
        <option value="">Select video…</option>
        {videos.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        {CAUSES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCause(c.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              cause === c.value ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={pending || !videoId}
        className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Log revision"}
      </button>
      {message && (
        <p className={`text-xs ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
      )}
    </form>
  );
}
