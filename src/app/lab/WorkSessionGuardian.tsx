"use client";

import { useState, useTransition } from "react";
import { stopWorkSession, startWorkSession } from "@/modules/work-sessions/actions";
import { STALE_SESSION_WARNING_SECONDS, WORK_SESSION_ACTIVITY_TYPES, WORK_SESSION_ACTIVITY_LABELS } from "@/modules/work-sessions/core";
import type { OpenWorkSession, WorkSessionActivityType } from "@/modules/work-sessions/core";

type VideoOption = { id: number; title: string; clientName: string | null; projectName: string | null };

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// Cluster C (Work Session Quick-Switch + Stale Guardian): thin client-side
// orchestration over the two EXISTING, already-tested server actions
// (stopWorkSession / startWorkSession) -- deliberately not a new
// lower-level DB path, so the single-open-session invariant and every
// existing safety check in work-sessions/actions.ts keeps applying
// unchanged. "Quick switch" is just "stop, then start" with one click
// instead of two page visits.
export function WorkSessionGuardian({
  openSession,
  elapsedSeconds,
  videoOptions,
}: {
  openSession: OpenWorkSession | null;
  elapsedSeconds: number;
  videoOptions: VideoOption[];
}) {
  const [targetVideoId, setTargetVideoId] = useState("");
  const [targetActivity, setTargetActivity] = useState<WorkSessionActivityType>("EDITING");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const stale = openSession !== null && elapsedSeconds >= STALE_SESSION_WARNING_SECONDS;

  if (!openSession) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-sm font-semibold text-white">Work session</p>
        <p className="mt-1 text-sm text-zinc-500">No open session right now.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${stale ? "border-amber-700 bg-amber-950/30" : "border-zinc-800 bg-zinc-900/50"}`}>
      <p className="text-sm font-semibold text-white">Work session {stale && <span className="text-amber-400">· stale ({formatElapsed(elapsedSeconds)})</span>}</p>
      <p className="mt-1 text-sm text-zinc-300">{openSession.videoTitle}</p>
      <p className="text-xs text-zinc-500">
        {openSession.clientName ?? "—"} {openSession.projectName ? `· ${openSession.projectName}` : ""} · {openSession.activityType}
      </p>
      <div className="mt-3 flex gap-2">
        <select
          value={targetVideoId}
          onChange={(e) => setTargetVideoId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white"
        >
          <option value="">Quick switch to…</option>
          {videoOptions
            .filter((v) => v.id !== openSession.videoId)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
                {v.clientName ? ` (${v.clientName})` : ""}
              </option>
            ))}
        </select>
        <select
          value={targetActivity}
          onChange={(e) => setTargetActivity(e.target.value as WorkSessionActivityType)}
          className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white"
        >
          {WORK_SESSION_ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {WORK_SESSION_ACTIVITY_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !targetVideoId}
          onClick={() =>
            startTransition(async () => {
              const stopResult = await stopWorkSession(openSession.videoId);
              if (!stopResult.success) {
                setMessage(stopResult.error);
                return;
              }
              // Wave 2 fix: no longer inherits the outgoing session's
              // activity type -- the operator picks it explicitly, since
              // a switch is often ALSO an activity change (e.g. EDITING
              // on video A -> REVIEW on video B).
              const startResult = await startWorkSession(Number(targetVideoId), targetActivity);
              setMessage(startResult.success ? "Switched." : startResult.error);
              if (startResult.success) setTargetVideoId("");
            })
          }
          className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Switch
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-zinc-400">{message}</p>}
    </div>
  );
}
