"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  startWorkSession,
  stopWorkSession,
} from "@/modules/work-sessions/actions";
import {
  DEFAULT_WORK_SESSION_ACTIVITY,
  WORK_SESSION_ACTIVITY_LABELS,
  WORK_SESSION_ACTIVITY_TYPES,
  formatClosedDuration,
  type VideoWorkSessionState,
  type WorkSessionActivityType,
} from "@/modules/work-sessions/core";

function formatElapsedClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

export function WorkSessionPanel({
  videoId,
  initialState,
}: {
  videoId: number;
  initialState: VideoWorkSessionState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(initialState);
  const [activityType, setActivityType] =
    useState<WorkSessionActivityType>(DEFAULT_WORK_SESSION_ACTIVITY);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

  const openSession = state.openSession;
  const isThisVideoActive = openSession?.videoId === videoId;
  const isAnotherVideoActive = Boolean(openSession && !isThisVideoActive);
  const startedAt = openSession ? Date.parse(openSession.startedAt) : null;
  const elapsedSeconds =
    isThisVideoActive && startedAt !== null && now > 0
      ? Math.max(0, Math.floor((now - startedAt) / 1_000))
      : 0;

  useEffect(() => {
    if (!isThisVideoActive) return;
    const initialTick = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, [isThisVideoActive, openSession?.startedAt]);

  function start() {
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await startWorkSession(videoId, activityType);
      if (!result.success) {
        if (result.state) setState(result.state);
        setError(result.error);
        router.refresh();
        return;
      }
      setState(result.state);
      setFeedback(result.message);
      router.refresh();
    });
  }

  function stop() {
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await stopWorkSession(videoId);
      if (!result.success) {
        if (result.state) setState(result.state);
        setError(result.error);
        router.refresh();
        return;
      }
      setState(result.state);
      setFeedback(result.message);
      router.refresh();
    });
  }

  return (
    <section className="mb-5 rounded-2xl border border-cyan-900/70 bg-cyan-950/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
            Tracked production time
          </p>
          <p className="mt-1 text-lg font-black text-white">
            {formatClosedDuration(state.summary.closedSeconds)}
            <span className="ml-2 text-xs font-semibold text-zinc-500">
              · {state.summary.sessionCount} {state.summary.sessionCount === 1 ? "session" : "sessions"}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Closed sessions only
          </p>
        </div>
        {isThisVideoActive && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
            ● Active
          </span>
        )}
      </div>

      {isThisVideoActive && openSession ? (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-zinc-950/60 p-4 text-center">
          <p className="text-sm font-bold text-emerald-300">
            {WORK_SESSION_ACTIVITY_LABELS[openSession.activityType]}
          </p>
          <p
            role="timer"
            aria-label={`Elapsed time ${formatElapsedClock(elapsedSeconds)}`}
            className="mt-2 font-mono text-3xl font-black tabular-nums text-white"
          >
            {formatElapsedClock(elapsedSeconds)}
          </p>
          <button
            type="button"
            onClick={stop}
            disabled={isPending}
            className="mt-4 min-h-12 w-full rounded-xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-50"
          >
            {isPending ? "Stopping…" : "Stop"}
          </button>
        </div>
      ) : isAnotherVideoActive && openSession ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-amber-300">
            Work is already running
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-200">
            {openSession.videoTitle} · {WORK_SESSION_ACTIVITY_LABELS[openSession.activityType]}
          </p>
          <Link
            href={`/productivity?video=${openSession.videoId}`}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-cyan-300 hover:text-cyan-200"
          >
            Open active video →
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor={`work-session-activity-${videoId}`}
              className="mb-1.5 block text-xs font-bold text-zinc-400"
            >
              Activity
            </label>
            <select
              id={`work-session-activity-${videoId}`}
              value={activityType}
              onChange={(event) =>
                setActivityType(event.target.value as WorkSessionActivityType)
              }
              disabled={isPending}
              className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            >
              {WORK_SESSION_ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {WORK_SESSION_ACTIVITY_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={start}
            disabled={isPending}
            className="min-h-12 w-full rounded-xl bg-cyan-700 px-4 text-sm font-black text-white transition hover:bg-cyan-600 disabled:opacity-50"
          >
            {isPending ? "Starting…" : "Start work"}
          </button>
        </div>
      )}

      {error && <p aria-live="assertive" className="mt-3 text-sm text-red-300">{error}</p>}
      {feedback && <p aria-live="polite" className="mt-3 text-sm text-emerald-300">{feedback}</p>}
    </section>
  );
}
