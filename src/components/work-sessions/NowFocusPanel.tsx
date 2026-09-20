"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode, useRef } from "react";
import { LiveIndicator, PixelIcon } from "@/components/ui/PixelVisuals";
import { videoWorkspaceHref } from "@/modules/productivity/core";
import { startWorkSession, stopWorkSession } from "@/modules/work-sessions/actions";
import {
  DEFAULT_WORK_SESSION_ACTIVITY,
  OPERATOR_NAME,
  WORK_SESSION_ACTIVITY_LABELS,
  formatElapsedClock,
  isSessionStale,
  type OpenWorkSession,
} from "@/modules/work-sessions/core";

// P0.1 (Tuesday Reality & Usability Patch): the single canonical NOW/FOCUS
// surface. Before this, "what am I working on right now" was rendered
// independently in HomeTrackingPanel (Dashboard) and inline in
// productivity/page.tsx -- two components reading the same
// getWorkSessionOverview() data but drawn twice, able to drift in copy and
// styling. This component is the one read model's one view; both callers
// pass the same openSession/openSessionElapsedSeconds props through.
//
// Deliberately does NOT implement Pause: work_sessions has no pause concept
// (only startedAt/endedAt -- see db/schema.ts), so a Pause button here would
// simulate state the canonical model doesn't have. Finish Session is the one
// real transition out of an open session (stopWorkSession).
export type RecommendedNextItem = {
  id: number;
  title: string;
  clientName: string | null;
  projectName: string | null;
  nextAction: string;
};

export function NowFocusPanel({
  openSession,
  openSessionElapsedSeconds,
  recommended = null,
  variant = "dominant",
  returnTo,
  children,
}: {
  openSession: OpenWorkSession | null;
  openSessionElapsedSeconds: number;
  recommended?: RecommendedNextItem | null;
  variant?: "dominant" | "compact";
  // Sep 18 Afternoon Readiness Refinement: this is the one shared "what am
  // I working on right now" surface -- Dashboard, War Room, and
  // Productivity all render the same component (see the module comment
  // above), and none of its own links carried the caller's page back as
  // returnTo. From War Room specifically, "Open Workspace"/"Start Working"
  // used to drop the operator into Productivity's generic video-not-found
  // fallback with no way back to War Room -- the same lost-context pattern
  // fixed for Sensor/Production-Order navigation earlier today. Each
  // caller passes its own path; Productivity's own `?video=` deep link
  // already validates this the same way as every other returnTo in the app
  // (isSafeInternalPath), so a plain literal here is safe.
  returnTo?: string;
  // Extra content shown inside the active-session card only (e.g.
  // Dashboard's Quick Note). Ignored in the no-active-work state.
  children?: ReactNode;
}) {
  if (openSession) {
    return (
      <ActiveSessionCard
        openSession={openSession}
        initialElapsedSeconds={openSessionElapsedSeconds}
        variant={variant}
        returnTo={returnTo}
      >
        {children}
      </ActiveSessionCard>
    );
  }
  return <NoActiveWorkCard recommended={recommended} variant={variant} returnTo={returnTo} />;
}

function ActiveSessionCard({
  openSession,
  initialElapsedSeconds,
  variant,
  returnTo,
  children,
}: {
  openSession: OpenWorkSession;
  initialElapsedSeconds: number;
  variant: "dominant" | "compact";
  returnTo?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  // Ticks from the canonical startedAt timestamp, same derivation
  // getWorkSessionOverview() already does server-side at fetch time -- this
  // just keeps recomputing it client-side every second instead of freezing
  // at the value the last server render happened to catch (Section 19:
  // "elapsed" is derived, never persisted).
  //
  // nowMs starts at 0 (not Date.now()): initializing it during render would
  // read a different instant on the server render and the client hydration
  // pass, producing a text mismatch React flags as a hydration error (same
  // reason getWorkSessionOverview's own comment forbids Date.now() at
  // render time). 0 keeps first paint on both sides equal to
  // initialElapsedSeconds; only the post-mount effect below (WorkSessionPanel
  // uses the identical setTimeout(0) + setInterval pair) starts the real tick.
  const startedAtMs = Date.parse(openSession.startedAt);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const initialTick = window.setTimeout(() => setNowMs(Date.now()), 0);
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, [openSession.id]);

  // Operating-Intelligence train (Sep 19): the ticker above only counts UP from
  // startedAt, so a session stopped on another device (or window) kept
  // "running" here until a manual refresh -- the stale-timer note from the
  // Aug 23 Quick Notes. The database was always right; only this display was
  // stale. Re-validate against the server whenever this tab becomes visible or
  // regains focus (throttled, and only while a session is shown as running).
  const lastResyncMs = useRef(0);
  useEffect(() => {
    function resync() {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastResyncMs.current < 15_000) return;
      lastResyncMs.current = now;
      router.refresh();
    }
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, [router, openSession.id]);

  const elapsedSeconds =
    nowMs > 0 && Number.isFinite(startedAtMs)
      ? Math.max(0, Math.floor((nowMs - startedAtMs) / 1_000))
      : initialElapsedSeconds;
  const stale = isSessionStale(elapsedSeconds);

  const contextParts = [
    OPERATOR_NAME,
    openSession.deviceName,
    openSession.clientName,
    openSession.projectName,
  ].filter((part): part is string => Boolean(part));

  function finishSession() {
    setError("");
    startTransition(async () => {
      const result = await stopWorkSession(openSession.videoId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const compact = variant === "compact";

  return (
    <section
      className={`pixel-frame ${stale ? "pixel-frame-attention" : "pixel-frame-live"} rounded-2xl border p-4 sm:p-5 ${compact ? "mb-8" : "mb-7"} ${
        stale ? "border-amber-500/40 bg-amber-500/[0.08]" : "border-emerald-500/35 bg-emerald-500/[0.07]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div
            className={`flex items-center gap-2 ${
              stale ? "text-amber-300" : "text-emerald-300"
            }`}
          >
            {stale ? (
              <span className="mb-system-label">SESSION CHECK · RUNNING LONG</span>
            ) : (
              <LiveIndicator label="LIVE OPERATION" />
            )}
          </div>
          {contextParts.length > 0 && (
            <p className="mt-1.5 truncate text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              {contextParts.join(" / ")}
            </p>
          )}
          <h2 className={`mt-2 truncate font-black text-white ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>
            {openSession.videoTitle}
          </h2>
          <p className={`mb-timer mt-1 font-mono text-zinc-200 ${compact ? "text-lg" : "text-2xl sm:text-3xl"}`}>
            {formatElapsedClock(elapsedSeconds)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {WORK_SESSION_ACTIVITY_LABELS[openSession.activityType]}
          </p>
          {error && <p aria-live="polite" className="mt-2 text-xs text-red-300">{error}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={finishSession}
            disabled={isPending}
            className="min-h-11 rounded-xl bg-zinc-100 px-4 py-3 text-center text-sm font-black text-zinc-950 transition hover:bg-white disabled:opacity-50"
          >
            {isPending ? "Finishing…" : "Finish Session"}
          </button>
          <Link
            href={videoWorkspaceHref(openSession.videoId, returnTo)}
            className={`min-h-11 rounded-xl px-4 py-3 text-center text-sm font-black text-zinc-950 ${
              stale ? "bg-amber-500 hover:bg-amber-400" : "bg-emerald-500 hover:bg-emerald-400"
            }`}
          >
            Open Workspace
          </Link>
        </div>
      </div>
      {children}
    </section>
  );
}

function NoActiveWorkCard({
  recommended,
  variant,
  returnTo,
}: {
  recommended: RecommendedNextItem | null;
  variant: "dominant" | "compact";
  returnTo?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const compact = variant === "compact";

  function startWorking() {
    if (!recommended) return;
    setError("");
    startTransition(async () => {
      const result = await startWorkSession(recommended.id, DEFAULT_WORK_SESSION_ACTIVITY);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(videoWorkspaceHref(recommended.id, returnTo));
    });
  }

  return (
    <section className={`pixel-frame rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 ${compact ? "mb-8" : "mb-7"}`}>
      <p className="mb-system-label flex items-center gap-2 text-zinc-500">
        <PixelIcon name="flag" className="h-3.5 w-3.5" />
        Next objective
      </p>
      {recommended ? (
        <>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            Recommended next
            {[recommended.clientName, recommended.projectName].filter(Boolean).length > 0 &&
              ` · ${[recommended.clientName, recommended.projectName].filter(Boolean).join(" / ")}`}
          </p>
          <h2 className={`mt-1 truncate font-black text-white ${compact ? "text-base" : "text-lg sm:text-xl"}`}>
            {recommended.title}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">{recommended.nextAction}</p>
          {error && <p aria-live="polite" className="mt-2 text-xs text-red-300">{error}</p>}
          <button
            type="button"
            onClick={startWorking}
            disabled={isPending}
            className="mt-4 min-h-11 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {isPending ? "Starting…" : "Start Working →"}
          </button>
        </>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">Nothing in progress and nothing planned right now.</p>
      )}
    </section>
  );
}
