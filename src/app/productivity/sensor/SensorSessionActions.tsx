"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useTransition } from "react";
import { ActionButton, UpdateFlash, useAction } from "@/components/os";
import { rememberFocusLandmark } from "@/components/os/focus";
import {
  INITIAL_RESOLVE_STATE,
  RESOLVE_ERROR_FALLBACK,
  RESOLVE_HOLD_MS,
  resolveReducer,
} from "@/lib/os/resolve-flow";
import {
  approveSensorSession,
  archiveSensorSession,
  deleteArchivedSensorSession,
} from "@/modules/sensor/actions";

type SensorAction = "approve" | "archive" | "delete";

// Confirmation copy shown ONLY after the server said yes (RMEDIA OS M3).
const RESOLVED_COPY: Record<SensorAction, { title: string; detail: string }> = {
  approve: { title: "Approved", detail: "Saved as a Work Session." },
  archive: { title: "Archived", detail: "Kept as operational history." },
  delete: { title: "Removed from review", detail: "The evidence tombstone is retained." },
};

export function SensorSessionActions({
  id,
  state,
  approvedWorkSessionId,
  contextType = "CLIENT",
}: {
  id: number;
  state: "PENDING" | "APPROVED" | "ARCHIVED" | "DELETED";
  approvedWorkSessionId: number | null;
  contextType?: string;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [resolve, dispatch] = useReducer(resolveReducer, INITIAL_RESOLVE_STATE);
  const perform = useAction((action: () => Promise<{ success: boolean; error?: string }>) => action());
  const ackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const resolved = resolve.phase === "resolved";
  const submitting = resolve.phase === "submitting";

  useEffect(() => {
    mounted.current = true;
    const active = timers.current;
    return () => {
      mounted.current = false;
      active.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // The buttons unmount on success: keep focus on the confirmation.
  useEffect(() => {
    if (resolved) ackRef.current?.focus({ preventScroll: true });
  }, [resolved]);

  async function run(name: SensorAction, action: () => Promise<{ success: boolean; error?: string }>) {
    if (busy.current || resolve.phase !== "idle") return;
    busy.current = true;
    // These actions revalidate the page themselves, so the item may leave the queue in the
    // very response that confirms it. Remember a stable landmark BEFORE submitting so keyboard
    // focus never falls to <body>; restored below only if focus was actually lost.
    const restoreFocus = rememberFocusLandmark(rootRef.current);
    dispatch({ type: "submit", action: name });
    let result: { success: boolean; error?: string };
    try {
      result = await perform.run(action);
    } catch {
      busy.current = false;
      dispatch({ type: "failed", error: RESOLVE_ERROR_FALLBACK });
      return;
    }
    if (!result.success) {
      busy.current = false;
      dispatch({ type: "failed", error: result.error ?? "The Sensor session could not be updated." });
      return;
    }
    dispatch({ type: "succeeded" });
    // Not tied to this component's lifetime: it may already be gone from the revalidated list.
    setTimeout(restoreFocus, 350);
    // If the row is still here (the server kept it), hold the confirmation briefly and then
    // let the revalidated truth replace it. If it already left, the queue's DepartureNotice speaks.
    timers.current.push(
      setTimeout(() => {
        if (!mounted.current) return;
        startRefresh(() => router.refresh());
        timers.current.push(setTimeout(restoreFocus, 500));
      }, RESOLVE_HOLD_MS),
    );
  }

  if (state === "DELETED") {
    return <p className="text-xs text-zinc-600">Manually deleted from operational review; evidence tombstone retained.</p>;
  }

  if (state === "APPROVED" && !resolved) {
    return (
      <p className="text-xs font-semibold text-emerald-300">
        Approved as Work Session #{approvedWorkSessionId ?? "—"}
      </p>
    );
  }

  if (resolved && resolve.action) {
    const copy = RESOLVED_COPY[resolve.action as SensorAction];
    return (
      <UpdateFlash as="div" changeKey={resolved} tone="success" className="rounded-lg" role="status">
        <div
          ref={ackRef}
          tabIndex={-1}
          className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 outline-none"
        >
          <svg className="os-ck mt-0.5 text-emerald-300" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8.5l3.2 3L13 4.5" />
          </svg>
          <div>
            <p className="text-xs font-bold text-emerald-200">{copy.title}</p>
            <p className="text-[11px] text-zinc-400">{copy.detail}</p>
          </div>
        </div>
      </UpdateFlash>
    );
  }

  // Sensor Operational Ledger Patch: a completed non-CLIENT session is
  // finalized straight to ARCHIVED by the Stop write itself (see
  // SENSOR_SESSION_STOP_SQL) -- it is never PENDING once closed, so the
  // PENDING branch below is exclusively a CLIENT concern in practice now.
  // ARCHIVED is the durable state for BOTH "an operator explicitly
  // archived a CLIENT session" and "ordinary completed non-CLIENT
  // operational history" -- the copy here distinguishes the two so
  // neither reads as disposal.
  const isNonClient = contextType !== "CLIENT";

  return (
    <div ref={rootRef}>
      <div className="flex flex-wrap items-center gap-2">
        {state === "PENDING" && (
          <>
            <ActionButton
              pending={submitting && resolve.action === "approve"}
              aria-disabled={submitting ? true : undefined}
              onClick={() => run("approve", () => approveSensorSession(id))}
              className="min-h-10 rounded-lg bg-emerald-400 px-3 text-xs font-black text-zinc-950 hover:bg-emerald-300"
            >
              Approve
            </ActionButton>
            <ActionButton
              pending={submitting && resolve.action === "archive"}
              aria-disabled={submitting ? true : undefined}
              onClick={() => run("archive", () => archiveSensorSession(id))}
              className="min-h-10 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
            >
              Archive
            </ActionButton>
          </>
        )}
        {state === "ARCHIVED" && isNonClient && (
          <span className="text-xs font-semibold text-zinc-400">Completed · operational history</span>
        )}
        {state === "ARCHIVED" && (
          <ActionButton
            pending={submitting && resolve.action === "delete"}
            aria-disabled={submitting ? true : undefined}
            onClick={() => {
              if (window.confirm("Delete this Sensor session from review? The evidence tombstone is retained.")) {
                run("delete", () => deleteArchivedSensorSession(id));
              }
            }}
            className="min-h-10 rounded-lg border border-red-900/70 px-3 text-xs font-bold text-red-300 hover:bg-red-950/30"
          >
            Delete manually…
          </ActionButton>
        )}
      </div>
      {resolve.error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {resolve.error}
        </p>
      )}
    </div>
  );
}
