"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  startWorkSession,
  stopWorkSession,
  stopWorkSessionAt,
} from "@/modules/work-sessions/actions";
import {
  DEFAULT_WORK_SESSION_ACTIVITY,
  WORK_SESSION_ACTIVITY_LABELS,
  WORK_SESSION_ACTIVITY_TYPES,
  formatClosedDuration,
  formatElapsedClock,
  isSessionStale,
  type VideoWorkSessionState,
  type WorkSessionActivityType,
} from "@/modules/work-sessions/core";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time, not an ISO string.
function toDatetimeLocalValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
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
  // Sprint 1.2 native intelligence audit: keep this panel in lockstep with
  // the server on every render pass, not just after this device own
  // Start/Stop. useState(initialState) only reads its argument on first
  // mount, so without this a session stopped on a different device left
  // this device ticking clock and Stop button showing a session that
  // was already closed elsewhere. This adjusts state during render (not
  // an effect) the same way seenSessionId does below, so a fresh
  // initialState prop (a new object on every server re-render, whether
  // from this device own router.refresh() or the polling effect
  // further down) always wins over stale local state, while this
  // component own optimistic setState(result.state) calls after a
  // local action are left untouched between refreshes.
  // Compare a stable state signature, not object identity. Server Component
  // payloads may re-materialize an equivalent object when the parent client
  // component re-renders (for example when opening the Video workspace).
  // Object-identity comparison treated that as a server update on every
  // render and caused an infinite render loop. These fields fully describe
  // the server truth this panel needs to adopt.
  const initialStateSignature = [
    initialState.summary.videoId,
    initialState.summary.closedSeconds,
    initialState.summary.sessionCount,
    initialState.openSession?.id ?? "idle",
    initialState.openSession?.videoId ?? "none",
    initialState.openSession?.startedAt ?? "none",
    initialState.openSession?.activityType ?? "none",
  ].join(":");
  const [syncedInitialStateSignature, setSyncedInitialStateSignature] =
    useState(initialStateSignature);
  if (initialStateSignature !== syncedInitialStateSignature) {
    setSyncedInitialStateSignature(initialStateSignature);
    setState(initialState);
  }
  const [activityType, setActivityType] =
    useState<WorkSessionActivityType>(DEFAULT_WORK_SESSION_ACTIVITY);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [staleDismissed, setStaleDismissed] = useState(false);
  const [showCorrectEndTime, setShowCorrectEndTime] = useState(false);
  const [customEndTime, setCustomEndTime] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);
  // Reset the stale-session UI whenever a *different* session becomes the
  // open one (a new Start after this video's session closed, or another
  // video's session taking over). This intentionally adjusts state during
  // render rather than in a useEffect — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // — so it can't cause the cascading extra render an effect-based reset
  // would.
  const [seenSessionId, setSeenSessionId] = useState<number | null>(null);

  const openSession = state.openSession;
  const openSessionId = openSession?.id ?? null;
  if (openSessionId !== seenSessionId) {
    setSeenSessionId(openSessionId);
    setStaleDismissed(false);
    setShowCorrectEndTime(false);
    setConfirmStop(false);
  }
  const isThisVideoActive = openSession?.videoId === videoId;
  const isAnotherVideoActive = Boolean(openSession && !isThisVideoActive);
  const startedAt = openSession ? Date.parse(openSession.startedAt) : null;
  const elapsedSeconds =
    isThisVideoActive && startedAt !== null && now > 0
      ? Math.max(0, Math.floor((now - startedAt) / 1_000))
      : 0;
  const stale = isThisVideoActive && isSessionStale(elapsedSeconds) && !staleDismissed;

  useEffect(() => {
    if (!isThisVideoActive) return;
    const initialTick = window.setTimeout(() => setNow(Date.now()), 0);
    // Once a session is old enough to matter for staleness, a per-minute
    // tick is plenty — no need for the 1s cadence used for the live clock
    // below to also drive the staleness check.
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, [isThisVideoActive, openSession?.startedAt]);

  // Sprint 1.2 native intelligence audit, item B (multi-device stale state):
  // this device believes ITS video has the open session. Poll the server
  // periodically to confirm that is still true — the one case where staleness
  // is materially misleading (a clock that keeps ticking, implying tracked
  // time is accumulating, after another device already pressed Stop).
  // router.refresh() re-fetches this route Server Component data; the
  // sync block above then adopts it. 20s is a deliberately un-realtime
  // cadence — not a websocket, not sub-second — chosen to catch a cross-
  // device Stop within one real work session without polling aggressively.
  // Does not run for the "another video is active" branch: a stale belief
  // there is corrected immediately and loudly by START_WORK_SESSION_SQL own
  // guard the moment this device tries to start a session, so it does
  // not silently mislead the operator the way a stuck clock would.
  useEffect(() => {
    if (!isThisVideoActive) return;
    const interval = window.setInterval(() => router.refresh(), 20_000);
    return () => window.clearInterval(interval);
  }, [isThisVideoActive, router]);

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
      setConfirmStop(false);
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

  function stopAtCustomTime() {
    if (!customEndTime) {
      setError("Choose an end time.");
      return;
    }
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await stopWorkSessionAt(
        videoId,
        new Date(customEndTime).toISOString(),
      );
      if (!result.success) {
        if (result.state) setState(result.state);
        setError(result.error);
        router.refresh();
        return;
      }
      setState(result.state);
      setFeedback(result.message);
      setShowCorrectEndTime(false);
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
            {state.summary.sessionCount > 0 ? (
              // Local consolidation round: a video own session count is the
              // natural entry point into "show me those sessions" (real
              // dogfooding expectation) — reuse the existing Session Ledger
              // page via a video filter instead of a new detail view.
              <Link
                href={`/productivity/sessions?video=${videoId}`}
                className="ml-2 text-xs font-semibold text-cyan-400 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-300"
              >
                · {state.summary.sessionCount} {state.summary.sessionCount === 1 ? "session" : "sessions"}
              </Link>
            ) : (
              <span className="ml-2 text-xs font-semibold text-zinc-500">· 0 sessions</span>
            )}
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
          {confirmStop ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-left">
              <p className="text-sm font-black text-red-100">Stop this session?</p>
              <p className="mt-1 text-xs leading-5 text-red-200/70">
                The tracked time will be saved through this moment.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmStop(false)}
                  disabled={isPending}
                  className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-200 disabled:opacity-50"
                >
                  Keep working
                </button>
                <button
                  type="button"
                  onClick={stop}
                  disabled={isPending}
                  className="min-h-11 rounded-xl bg-red-600 px-3 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {isPending ? "Stopping…" : "Confirm stop"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmStop(true)}
              disabled={isPending}
              className="mt-4 min-h-12 w-full rounded-xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-50"
            >
              Stop
            </button>
          )}

          {stale && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left">
              <p className="text-xs font-black uppercase tracking-wide text-amber-300">
                Still working?
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-100/90">
                This session has been running for{" "}
                {formatClosedDuration(elapsedSeconds)} (started{" "}
                {new Date(openSession.startedAt).toLocaleString("en-US", {
                  timeZone: "America/Sao_Paulo",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                ). If you forgot to press Stop, correct the end time instead of
                letting it keep running.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStaleDismissed(true)}
                  className="min-h-9 rounded-lg border border-amber-500/30 px-3 text-xs font-bold text-amber-200 hover:bg-amber-500/10"
                >
                  Still working — keep going
                </button>
                <button
                  type="button"
                  onClick={() => setShowCorrectEndTime((value) => !value)}
                  className="min-h-9 rounded-lg border border-amber-500/30 px-3 text-xs font-bold text-amber-200 hover:bg-amber-500/10"
                >
                  Correct end time
                </button>
              </div>
              {showCorrectEndTime && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="flex-1">
                    <label
                      htmlFor={`stale-end-time-${videoId}`}
                      className="mb-1 block text-[10px] font-bold uppercase text-amber-200/80"
                    >
                      Actual end time
                    </label>
                    <input
                      id={`stale-end-time-${videoId}`}
                      type="datetime-local"
                      value={customEndTime}
                      max={toDatetimeLocalValue(new Date())}
                      onChange={(event) => setCustomEndTime(event.target.value)}
                      className="min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-2.5 text-sm text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={stopAtCustomTime}
                    disabled={isPending}
                    className="min-h-10 rounded-lg bg-amber-500 px-3 text-xs font-black text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    Stop at this time
                  </button>
                </div>
              )}
            </div>
          )}
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
