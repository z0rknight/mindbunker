"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode, useRef } from "react";
import { LiveIndicator, PixelIcon } from "@/components/ui/PixelVisuals";
import type { CurrentExecution, ExecutionRecommendation } from "@/modules/execution/core";
import { startWork, endWorkSession } from "@/modules/work-sessions/actions";
import { EntityInspectionTrigger, useEntityInspection } from "@/components/entity-inspection/EntityDrawerProvider";
import {
  DEFAULT_WORK_SESSION_ACTIVITY,
  OPERATOR_NAME,
  WORK_SESSION_ACTIVITY_LABELS,
  formatElapsedClock,
  isSessionStale,
} from "@/modules/work-sessions/core";

// P0.1 (Tuesday Reality & Usability Patch): the single canonical NOW/FOCUS
// surface. Before this, "what am I working on right now" was rendered
// independently in HomeTrackingPanel (Dashboard) and inline in
// productivity/page.tsx -- two components reading the same
// getWorkSessionOverview() data but drawn twice, able to drift in copy and
// styling. This component is the one read model's one view; both callers
// pass the same CurrentExecution projection through.
//
// "End Session" closes only the active interval. Finish Video and
// Deliver/Approve remain separate domain actions on their owning surfaces.

export function NowFocusPanel({
  current,
  recommended = null,
  variant = "dominant",
  children,
}: {
  current: CurrentExecution | null;
  recommended?: ExecutionRecommendation | null;
  variant?: "dominant" | "compact";
  // Extra content shown inside the active-session card only (e.g.
  // Dashboard's Quick Note). Ignored in the no-active-work state.
  children?: ReactNode;
}) {
  if (current) {
    return (
      <ActiveSessionCard
        current={current}
        variant={variant}
      >
        {children}
      </ActiveSessionCard>
    );
  }
  return <NoActiveWorkCard recommended={recommended} variant={variant} />;
}

function ActiveSessionCard({
  current,
  variant,
  children,
}: {
  current: CurrentExecution;
  variant: "dominant" | "compact";
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
  const startedAtMs = Date.parse(current.startedAt);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const initialTick = window.setTimeout(() => setNowMs(Date.now()), 0);
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, [current.sessionId]);

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
  }, [router, current.sessionId]);

  const elapsedSeconds =
    nowMs > 0 && Number.isFinite(startedAtMs)
      ? Math.max(0, Math.floor((nowMs - startedAtMs) / 1_000))
      : current.elapsedSeconds;
  const stale = isSessionStale(elapsedSeconds);

  const contextParts = [
    OPERATOR_NAME,
    current.deviceName,
    current.client
      ? current.client.workMode === "DFY"
        ? `${current.client.canonicalName} · DFY via ${current.client.operationalName}`
        : current.client.canonicalName
      : null,
    current.project?.name,
  ].filter((part): part is string => Boolean(part));

  function endSession() {
    setError("");
    startTransition(async () => {
      const result = await endWorkSession(current.video.id);
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
      className={`${compact ? "border-l-[3px] bg-zinc-900/60" : `pixel-frame ${stale ? "pixel-frame-attention" : "pixel-frame-live"}`} rounded-2xl border p-4 sm:p-5 ${compact ? "mb-8" : "mb-7"} ${
        compact ? (stale ? "border-zinc-800 border-l-amber-500" : "border-zinc-800 border-l-red-600") : stale ? "border-amber-500/40 bg-amber-500/[0.08]" : "border-emerald-500/35 bg-emerald-500/[0.07]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div
            className={`flex items-center gap-2 ${
              stale ? "text-amber-300" : "text-emerald-300"
            }`}
          >
            <span className={`rounded border px-2 py-0.5 text-[9px] font-black tracking-widest ${current.blocker ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
              {current.blocker ? "BLOCKED" : "ACTIVE"}
            </span>
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
            {current.video.title}
          </h2>
          <p className={`mb-timer mt-1 font-mono text-zinc-200 ${compact ? "text-lg" : "text-2xl sm:text-3xl"}`}>
            {formatElapsedClock(elapsedSeconds)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {WORK_SESSION_ACTIVITY_LABELS[current.activityType]}
          </p>
          <p className="mt-2 text-xs font-bold text-cyan-200">
            NEXT → {current.nextAction}
          </p>
          {current.blocker && (
            <p className="mt-1 text-xs font-semibold text-amber-300">
              Blocked: {current.blocker.category}
            </p>
          )}
          {current.integrityIssues?.map((issue) => (
            <p key={issue} className="mt-1 text-xs font-semibold text-amber-300">Integrity: {issue}</p>
          ))}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold">
            {current.client && <EntityInspectionTrigger entity={{ type: "client", id: current.client.canonicalId }} className="text-cyan-400 hover:text-cyan-300">Inspect Client</EntityInspectionTrigger>}
            {current.project && <EntityInspectionTrigger entity={{ type: "project", id: current.project.id }} className="text-cyan-400 hover:text-cyan-300">Inspect Project</EntityInspectionTrigger>}
            <EntityInspectionTrigger entity={{ type: "session", id: current.sessionId }} className="text-zinc-400 hover:text-zinc-200">Inspect Session</EntityInspectionTrigger>
          </div>
          {error && <p aria-live="polite" className="mt-2 text-xs text-red-300">{error}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={endSession}
            disabled={isPending}
            className="min-h-11 rounded-xl bg-zinc-100 px-4 py-3 text-center text-sm font-black text-zinc-950 transition hover:bg-white disabled:opacity-50"
          >
            {isPending ? "Ending…" : "End Session"}
          </button>
          <EntityInspectionTrigger
            entity={{ type: "video", id: current.video.id }}
            className={`min-h-11 rounded-xl px-4 py-3 text-center text-sm font-black text-zinc-950 ${
              stale ? "bg-amber-500 hover:bg-amber-400" : "bg-emerald-500 hover:bg-emerald-400"
            }`}
          >
            Inspect Work
          </EntityInspectionTrigger>
        </div>
      </div>
      {children}
    </section>
  );
}

function NoActiveWorkCard({
  recommended,
  variant,
}: {
  recommended: ExecutionRecommendation | null;
  variant: "dominant" | "compact";
}) {
  const router = useRouter();
  const { openEntity } = useEntityInspection();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const compact = variant === "compact";

  function startWorking() {
    if (!recommended) return;
    setError("");
    startTransition(async () => {
      const result = await startWork(recommended.videoId, DEFAULT_WORK_SESSION_ACTIVITY);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
      openEntity({ type: "video", id: recommended.videoId });
    });
  }

  return (
    <section className={`pixel-frame rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 ${compact ? "mb-8" : "mb-7"}`}>
      <p className="mb-system-label flex items-center gap-2 text-zinc-500">
        <PixelIcon name="flag" className="h-3.5 w-3.5" />
        <span className="rounded border border-zinc-700 px-2 py-0.5 text-[9px] font-black tracking-widest text-zinc-400">IDLE</span>
        Next objective
      </p>
      {recommended ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            <span>Recommended next</span>
            {recommended.client && <EntityInspectionTrigger entity={{ type: "client", id: recommended.client.canonicalId }} className="text-cyan-500 hover:text-cyan-300">{recommended.client.canonicalName}</EntityInspectionTrigger>}
            {recommended.project && <EntityInspectionTrigger entity={{ type: "project", id: recommended.project.id }} className="text-cyan-500 hover:text-cyan-300">{recommended.project.name}</EntityInspectionTrigger>}
          </div>
          <h2 className={`mt-1 truncate font-black text-white ${compact ? "text-base" : "text-lg sm:text-xl"}`}>
            <EntityInspectionTrigger entity={{ type: "video", id: recommended.videoId }} className="truncate text-left hover:text-cyan-200">{recommended.title}</EntityInspectionTrigger>
          </h2>
          <p className="mt-1 text-xs text-zinc-500">{recommended.nextAction}</p>
          <div className="mt-3 rounded-lg border border-cyan-900/50 bg-cyan-950/10 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-400">WHY NOW</p>
            {recommended.signals.slice(0, 2).map((signal) => (
              <p key={`${signal.kind}-${signal.message}`} className="mt-1 text-[11px] leading-4 text-zinc-400">{signal.message}</p>
            ))}
          </div>
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
