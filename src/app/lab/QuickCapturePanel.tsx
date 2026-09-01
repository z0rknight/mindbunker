"use client";

import { useState, useTransition } from "react";
import { startWorkSession } from "@/modules/work-sessions/actions";
import { WORK_SESSION_ACTIVITY_TYPES, WORK_SESSION_ACTIVITY_LABELS, type WorkSessionActivityType } from "@/modules/work-sessions/core";
import { createCommitment } from "@/modules/commitments/actions";
import { logFrictionEvent } from "@/modules/friction/actions";
import { recordDelivery } from "@/modules/deliveries/actions";
import { recordDecision } from "@/modules/decision-log/actions";

type VideoOption = { id: number; title: string; clientName: string | null; projectName: string | null };

// Wave 2J: Quick Capture. Context inheritance is the point -- when a video
// is already selected in the Video Workbench (shared `videoId` state, lifted
// to LabWorkspace), every action here targets it directly. No re-asking
// for client/project/video.
export function QuickCapturePanel({ videos, videoId }: { videos: VideoOption[]; videoId: string }) {
  const [activity, setActivity] = useState<WorkSessionActivityType>("EDITING");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = videos.find((v) => String(v.id) === videoId);

  function run(label: string, fn: () => Promise<{ success: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      setMessage(r.success ? (r.message ?? `${label} done.`) : (r.error ?? `${label} failed.`));
      setNote("");
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Quick Capture</p>
      <p className="text-xs text-zinc-500">
        {selected ? `Context: ${selected.title}${selected.clientName ? ` (${selected.clientName})` : ""}` : "No video selected in Workbench — actions below need one."}
      </p>

      <select
        value={activity}
        onChange={(e) => setActivity(e.target.value as WorkSessionActivityType)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white"
      >
        {WORK_SESSION_ACTIVITY_TYPES.map((t) => (
          <option key={t} value={t}>{WORK_SESSION_ACTIVITY_LABELS[t]}</option>
        ))}
      </select>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (used by Commitment / Friction / Decision / Delivery)"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white"
      />

      <div className="grid grid-cols-2 gap-1.5">
        <button disabled={pending || !selected} onClick={() => run("Start work", () => startWorkSession(selected!.id, activity))} className="rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40">Start Work</button>
        <button disabled={pending || !selected || !note} onClick={() => run("Commitment", () => createCommitment({ ownerType: "VIDEO", ownerId: selected!.id, description: note }))} className="rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40">Add Commitment</button>
        <button disabled={pending || !selected} onClick={() => run("Friction", () => logFrictionEvent({ category: "OTHER", videoId: selected!.id, note }))} className="rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40">Add Friction</button>
        <button disabled={pending || !selected} onClick={() => run("Delivery", () => recordDelivery({ videoId: selected!.id, note }))} className="rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40">Deliver Video</button>
        <button disabled={pending || !note} onClick={() => run("Decision", () => recordDecision(note, selected ? `Video: ${selected.title}` : null))} className="rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40 col-span-2">Record Decision</button>
      </div>
      {message && <p className="text-xs text-emerald-400">{message}</p>}
      <p className="text-[10px] text-zinc-600">&quot;Add QA Issue&quot; and &quot;Switch Activity&quot; live in the Video Workbench above (Quality Gate / Work Session Guardian) rather than duplicated here.</p>
    </div>
  );
}
