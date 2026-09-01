"use client";
import { useState, useTransition } from "react";
import { captureToInbox, completeActionItem, cancelActionItem, classifyActionItem, setActionItemPriority } from "@/modules/action-items/actions";
import type { ActionPriority } from "@/modules/action-items/core";

type Item = {
  id: number;
  title: string;
  priority: string;
  status: string;
  dueAt: Date | string | null;
  note: string | null;
  ownerType: string | null;
  ownerId: number | null;
  source: string;
};
type Option = { id: number; name?: string; title?: string };

const PRIORITY_COLOR: Record<string, string> = { P0: "bg-red-900 text-red-200", P1: "bg-orange-900 text-orange-200", P2: "bg-zinc-800 text-zinc-300", P3: "bg-zinc-800 text-zinc-500" };

// Wave 4N/4O: Capture Inbox ("WHAT'S IN YOUR HEAD?" -- zero-friction,
// always P2, always unowned) sits at the top; Action Radar (everything
// open, sorted by priority) below it. One primitive, two views -- this
// panel does NOT duplicate Commitments/Blockers/Video/Project/CRM
// follow-ups, it is only for intentions that don't fit any of those.
export function ActionRadarPanel({ items, clients, projects, videos }: { items: Item[]; clients: Option[]; projects: Option[]; videos: Option[] }) {
  const [capture, setCapture] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Capture Inbox — WHAT&apos;S IN YOUR HEAD?</p>
      <div className="flex gap-1.5">
        <input
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
          placeholder="Type it. Triage later."
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white"
        />
        <button
          disabled={pending || !capture}
          onClick={() => startTransition(async () => { await captureToInbox(capture); setCapture(""); })}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Capture
        </button>
      </div>

      <p className="text-sm font-semibold text-white pt-2">Action Radar ({items.length} open)</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <ActionRow key={it.id} item={it} clients={clients} projects={projects} videos={videos} />
        ))}
        {items.length === 0 && <li className="text-xs text-zinc-500">Nothing open.</li>}
      </ul>
    </div>
  );
}

function ActionRow({ item, clients, projects, videos }: { item: Item; clients: Option[]; projects: Option[]; videos: Option[] }) {
  const [pending, startTransition] = useTransition();
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [ownerType, setOwnerType] = useState<"CLIENT" | "PROJECT" | "VIDEO">("CLIENT");
  const [ownerId, setOwnerId] = useState("");
  const options = ownerType === "CLIENT" ? clients : ownerType === "PROJECT" ? projects : videos;

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_COLOR[item.priority] ?? "bg-zinc-800"}`}>{item.priority}</span>
        <span className="flex-1 text-xs text-white">{item.title}</span>
        <button disabled={pending} onClick={() => startTransition(async () => { await completeActionItem(item.id); })} className="shrink-0 rounded-md bg-emerald-800 px-2 py-0.5 text-[10px] text-emerald-200">Done</button>
        <button disabled={pending} onClick={() => startTransition(async () => { await cancelActionItem(item.id); })} className="shrink-0 rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">Cancel</button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["P0", "P1", "P2", "P3"] as ActionPriority[]).map((p) => (
          <button key={p} disabled={pending} onClick={() => startTransition(async () => { await setActionItemPriority(item.id, p); })} className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${item.priority === p ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-500"}`}>{p}</button>
        ))}
        {item.ownerType ? (
          <span className="text-[10px] text-zinc-500">linked: {item.ownerType} #{item.ownerId}</span>
        ) : (
          <button onClick={() => setClassifyOpen((v) => !v)} className="text-[10px] text-zinc-500 underline decoration-dotted">link to…</button>
        )}
      </div>
      {classifyOpen && !item.ownerType && (
        <div className="flex gap-1.5 items-center pt-1">
          <div className="flex gap-1">
            {(["CLIENT", "PROJECT", "VIDEO"] as const).map((t) => (
              <button key={t} onClick={() => { setOwnerType(t); setOwnerId(""); }} className={`rounded px-1.5 py-0.5 text-[9px] ${ownerType === t ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>{t}</button>
            ))}
          </div>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[10px] text-white">
            <option value="">Select…</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name ?? o.title}</option>)}
          </select>
          <button disabled={pending || !ownerId} onClick={() => startTransition(async () => { await classifyActionItem(item.id, ownerType, Number(ownerId)); setClassifyOpen(false); })} className="rounded-md bg-zinc-700 px-2 py-0.5 text-[10px] text-white">Link</button>
        </div>
      )}
    </li>
  );
}
