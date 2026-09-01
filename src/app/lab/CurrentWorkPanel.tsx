"use client";

import { useState, useTransition } from "react";
import { stopWorkSession, startWorkSession } from "@/modules/work-sessions/actions";
import { WORK_SESSION_ACTIVITY_TYPES, WORK_SESSION_ACTIVITY_LABELS } from "@/modules/work-sessions/core";
import type { OpenWorkSession, WorkSessionActivityType } from "@/modules/work-sessions/core";
import { logFrictionEvent } from "@/modules/friction/actions";
import { FRICTION_CATEGORIES } from "@/modules/friction/core";
import { openBlocker } from "@/modules/blockers/actions";
import { BLOCKER_CATEGORIES } from "@/modules/blockers/core";
import { submitQaCheck } from "@/modules/qa-gate/actions";
import { QA_CHECKS } from "@/modules/qa-gate/core";
import { createActionItem } from "@/modules/action-items/actions";

type AssetItem = { itemType: string; status: string };
type Commitment = { id: number; description: string; dueAt: Date | null };

type Context = {
  openSession: OpenWorkSession | null;
  elapsedSeconds: number;
  stale: boolean;
  video: {
    nextAction: string | null;
    waitingOn: string | null;
    readyToProduce: boolean;
    assetChecklist: AssetItem[];
    nextCommitment: Commitment | null;
  } | null;
};

function fmtElapsed(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

export function CurrentWorkPanel({ context }: { context: Context }) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"none" | "switch" | "friction" | "blocker" | "qa" | "note">("none");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (!context.openSession) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-sm font-semibold text-white">Current Work</p>
        <p className="text-xs text-zinc-500 mt-1">No active session. Start one from Work Session Guardian below.</p>
      </div>
    );
  }

  const s = context.openSession;
  const missingAssets = (context.video?.assetChecklist ?? []).filter((a) => a.status === "MISSING");

  function act(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      setMode("none");
      setNote("");
      setMessage("Done.");
    });
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${context.stale ? "border-amber-700 bg-amber-950/20" : "border-zinc-800 bg-zinc-900/50"}`}>
      <div>
        <p className="text-sm font-semibold text-white">Current Work {context.stale && <span className="text-amber-400">· STALE</span>}</p>
        <p className="text-xs text-zinc-400 mt-1">
          {s.clientName ?? "—"} / {s.projectName ?? "—"} / <span className="text-zinc-200">{s.videoTitle ?? "—"}</span>
        </p>
        <p className="text-xs text-zinc-500">
          {WORK_SESSION_ACTIVITY_LABELS[s.activityType]} · elapsed {fmtElapsed(context.elapsedSeconds)}
        </p>
      </div>

      {context.video && (
        <div className="text-[11px] text-zinc-400 space-y-0.5">
          {context.video.nextAction && <p>Next: {context.video.nextAction}</p>}
          {context.video.waitingOn && context.video.waitingOn !== "NONE" && <p>Waiting on: {context.video.waitingOn}</p>}
          {context.video.nextCommitment && (
            <p>Deadline: {context.video.nextCommitment.description}{context.video.nextCommitment.dueAt ? ` (${new Date(context.video.nextCommitment.dueAt).toISOString().slice(0, 10)})` : ""}</p>
          )}
          {!context.video.readyToProduce && missingAssets.length > 0 && (
            <p className="text-amber-400">Missing: {missingAssets.map((a) => a.itemType).join(", ")}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setMode(mode === "switch" ? "none" : "switch")} className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-white">Switch Activity</button>
        <button type="button" onClick={() => setMode(mode === "friction" ? "none" : "friction")} className="rounded-md bg-orange-900 px-2 py-1 text-[11px] font-semibold text-orange-200">Add Friction</button>
        <button type="button" onClick={() => setMode(mode === "blocker" ? "none" : "blocker")} className="rounded-md bg-red-900 px-2 py-1 text-[11px] font-semibold text-red-200">Add Blocker</button>
        <button type="button" onClick={() => setMode(mode === "qa" ? "none" : "qa")} className="rounded-md bg-violet-900 px-2 py-1 text-[11px] font-semibold text-violet-200">Add QA Issue</button>
        <button type="button" onClick={() => setMode(mode === "note" ? "none" : "note")} className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-white">Add Note</button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act(() => stopWorkSession(s.videoId))}
          className="rounded-md bg-zinc-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
        >
          Stop
        </button>
      </div>

      {mode === "switch" && (
        <div className="flex flex-wrap gap-1.5">
          {WORK_SESSION_ACTIVITY_TYPES.filter((a) => a !== s.activityType).map((a) => (
            <button
              key={a}
              disabled={pending}
              onClick={() => act(async () => { await stopWorkSession(s.videoId); await startWorkSession(s.videoId, a as WorkSessionActivityType); })}
              className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300"
            >
              {WORK_SESSION_ACTIVITY_LABELS[a]}
            </button>
          ))}
        </div>
      )}
      {mode === "friction" && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-white" />
          {FRICTION_CATEGORIES.map((c) => (
            <button key={c} disabled={pending || !note} onClick={() => act(() => logFrictionEvent({ category: c, videoId: s.videoId, note }))} className="rounded-md bg-orange-900 px-2 py-1 text-[10px] text-orange-200">{c}</button>
          ))}
        </div>
      )}
      {mode === "blocker" && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's blocking?" className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-white" />
          {BLOCKER_CATEGORIES.map((c) => (
            <button key={c} disabled={pending || !note} onClick={() => act(() => openBlocker({ category: c, ownerType: "VIDEO", ownerId: s.videoId, note }))} className="rounded-md bg-red-900 px-2 py-1 text-[10px] text-red-200">{c}</button>
          ))}
        </div>
      )}
      {mode === "qa" && (
        <div className="flex flex-wrap gap-1.5">
          {QA_CHECKS.map((c) => (
            <button
              key={c.key}
              disabled={pending}
              onClick={() =>
                act(() =>
                  submitQaCheck(
                    s.videoId,
                    Object.fromEntries(QA_CHECKS.map((k) => [k.key, k.key !== c.key])),
                  ),
                )
              }
              className="rounded-md bg-violet-900 px-2 py-1 text-[10px] text-violet-200"
            >
              {c.label} failed
            </button>
          ))}
        </div>
      )}
      {mode === "note" && (
        <div className="flex gap-1.5">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to self" className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-white" />
          <button disabled={pending || !note} onClick={() => act(() => createActionItem({ title: note, ownerType: "VIDEO", ownerId: s.videoId }))} className="rounded-md bg-zinc-700 px-2 py-1 text-[11px] text-white disabled:opacity-40">Save</button>
        </div>
      )}
      {message && <p className="text-[11px] text-zinc-500">{message}</p>}
    </div>
  );
}
