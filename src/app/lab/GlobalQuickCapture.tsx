"use client";

import { useState, useTransition } from "react";
import { createCommitment } from "@/modules/commitments/actions";
import { logFrictionEvent } from "@/modules/friction/actions";
import { openBlocker } from "@/modules/blockers/actions";
import { logCrmActivity } from "@/modules/crm/actions";
import type { CommitmentOwnerType } from "@/modules/commitments/core";

type Option = { id: number; name?: string; title?: string };

// Wave 3Q: fixes the Wave 2 PATCH item -- Quick Capture was video-only.
// This is the CLIENT/PROJECT/VIDEO/NONE-context sibling. "NONE" context
// actions (nothing selected) are limited to what genuinely doesn't need
// an owner -- there isn't one in this set, so NONE just means "pick a
// context first," shown plainly rather than silently disabled.
export function GlobalQuickCapture({ clients, projects, videos }: { clients: Option[]; projects: Option[]; videos: Option[] }) {
  const [ownerType, setOwnerType] = useState<CommitmentOwnerType>("CLIENT");
  const [ownerId, setOwnerId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const options = ownerType === "CLIENT" ? clients : ownerType === "PROJECT" ? projects : videos;

  function run(fn: () => Promise<{ success: boolean; message?: string; error?: string }>) {
    if (!ownerId) { setMessage("Pick a client/project/video first."); return; }
    startTransition(async () => {
      const r = await fn();
      setMessage(r.success ? (r.message ?? "Done.") : (r.error ?? "Failed."));
      setNote("");
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Global Quick Capture</p>
      <div className="flex gap-2">
        {(["CLIENT", "PROJECT", "VIDEO"] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setOwnerType(t); setOwnerId(""); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${ownerType === t ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>
            {t}
          </button>
        ))}
      </div>
      <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white">
        <option value="">Select {ownerType.toLowerCase()}…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name ?? o.title}</option>)}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      <div className="grid grid-cols-2 gap-1.5">
        <button disabled={pending} onClick={() => run(() => createCommitment({ ownerType, ownerId: Number(ownerId), description: note || "Untitled commitment" }))} className="rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-white">Add Commitment</button>
        <button disabled={pending} onClick={() => run(() => logFrictionEvent({ category: "OTHER", clientId: ownerType === "CLIENT" ? Number(ownerId) : undefined, projectId: ownerType === "PROJECT" ? Number(ownerId) : undefined, videoId: ownerType === "VIDEO" ? Number(ownerId) : undefined, note }))} className="rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-white">Add Friction</button>
        <button disabled={pending} onClick={() => run(() => openBlocker({ category: "OTHER", ownerType, ownerId: Number(ownerId), note }))} className="rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-white">Add Blocker</button>
        <button disabled={pending || ownerType !== "CLIENT"} onClick={() => run(() => logCrmActivity(Number(ownerId), { description: note || "Interaction logged" }))} className="rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40">Log Interaction (client only)</button>
      </div>
      {message && <p className="text-xs text-emerald-400">{message}</p>}
    </div>
  );
}
