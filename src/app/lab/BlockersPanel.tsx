"use client";
import { useState, useTransition } from "react";
import { openBlocker, resolveBlocker } from "@/modules/blockers/actions";
import { BLOCKER_CATEGORIES, blockedSeconds, isCurrentlyBlocked } from "@/modules/blockers/core";
import type { CommitmentOwnerType } from "@/modules/commitments/core";

type Option = { id: number; name?: string; title?: string };
type BlockerRow = { id: number; category: string; ownerType: string; ownerId: number; note: string | null; startedAt: Date; resolvedAt: Date | null };

function fmtHours(s: number) { return `${(s / 3600).toFixed(1)}h`; }

export function BlockersPanel({ blockers, clients, projects, videos }: { blockers: BlockerRow[]; clients: Option[]; projects: Option[]; videos: Option[] }) {
  const [category, setCategory] = useState<(typeof BLOCKER_CATEGORIES)[number]>("CLIENT");
  const [ownerType, setOwnerType] = useState<CommitmentOwnerType>("PROJECT");
  const [ownerId, setOwnerId] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const options = ownerType === "CLIENT" ? clients : ownerType === "PROJECT" ? projects : videos;
  const open = blockers.filter((b) => isCurrentlyBlocked(b));
  const byCategory = blockers.reduce<Record<string, number>>((acc, b) => { acc[b.category] = (acc[b.category] ?? 0) + 1; return acc; }, {});

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Blockers ({open.length} currently blocked)</p>
      <div className="flex flex-wrap gap-1.5">
        {BLOCKER_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${category === c ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>{c}</button>
        ))}
      </div>
      <div className="flex gap-2">
        {(["CLIENT", "PROJECT", "VIDEO"] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setOwnerType(t); setOwnerId(""); }} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${ownerType === t ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>{t}</button>
        ))}
      </div>
      <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white">
        <option value="">Select {ownerType.toLowerCase()}…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name ?? o.title}</option>)}
      </select>
      <div className="flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
        <button disabled={pending || !ownerId} onClick={() => startTransition(async () => { await openBlocker({ category, ownerType, ownerId: Number(ownerId), note }); setNote(""); })} className="shrink-0 rounded-lg bg-red-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Open Blocker</button>
      </div>
      <ul className="text-xs text-zinc-300 space-y-1">
        {open.map((b) => (
          <li key={b.id} className="flex items-center justify-between">
            <span>{b.category}{b.note ? `: ${b.note}` : ""} · blocked {fmtHours(blockedSeconds(b))}</span>
            <button onClick={() => startTransition(async () => { await resolveBlocker(b.id); })} className="rounded-md bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white">Resolve</button>
          </li>
        ))}
      </ul>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">By category (all time)</p>
        <ul className="text-[11px] text-zinc-500 space-y-0.5">
          {Object.entries(byCategory).map(([c, n]) => <li key={c}>{c}: {n}</li>)}
        </ul>
      </div>
    </div>
  );
}
