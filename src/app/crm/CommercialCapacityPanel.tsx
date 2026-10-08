"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCommercialCapacity } from "@/modules/commercial-operating/actions";
import { COMMERCIAL_CAPACITY_STATES, type CommercialCapacityState } from "@/modules/commercial-operating/config";

export function CommercialCapacityPanel({ capacity }: { capacity: {
  state: CommercialCapacityState;
  recurringSeats: number;
  heroProjects: number;
  reason: string | null;
  actor: string;
  updatedAt: string;
} }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(capacity.state);
  const [recurringSeats, setRecurringSeats] = useState(capacity.recurringSeats);
  const [heroProjects, setHeroProjects] = useState(capacity.heroProjects);
  const [reason, setReason] = useState(capacity.reason ?? "");
  const [feedback, setFeedback] = useState("");
  return (
    <details className="mb-6 rounded-2xl border border-cyan-900/60 bg-cyan-950/10" open={capacity.state !== "OPEN"}>
      <summary className="cursor-pointer list-none px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Human-owned capacity</p><p className="mt-1 text-sm font-bold text-white">{capacity.state} · recurring {capacity.recurringSeats}/3 · Hero {capacity.heroProjects}/1</p></div>
          <span className="text-xs text-zinc-500">Last decision {new Date(capacity.updatedAt).toLocaleString()} · {capacity.actor}</span>
        </div>
      </summary>
      <div className="grid gap-3 border-t border-cyan-900/40 p-4 sm:grid-cols-[1fr_8rem_8rem_1.5fr_auto] sm:p-5">
        <select value={state} onChange={(event) => setState(event.target.value as CommercialCapacityState)} className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white">{COMMERCIAL_CAPACITY_STATES.map((value) => <option key={value}>{value}</option>)}</select>
        <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Recurring<input type="number" min={0} max={3} value={recurringSeats} onChange={(event) => setRecurringSeats(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" /></label>
        <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Hero<input type="number" min={0} max={1} value={heroProjects} onChange={(event) => setHeroProjects(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" /></label>
        <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Optional reason / upcoming commitment" className="min-h-11 self-end rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600" />
        <button type="button" disabled={isPending} onClick={() => startTransition(async () => { const result = await updateCommercialCapacity({ state, recurringSeats, heroProjects, reason }); setFeedback(result.success ? result.message : result.error); if (result.success) router.refresh(); })} className="min-h-11 self-end rounded-xl bg-cyan-600 px-4 text-sm font-black text-white hover:bg-cyan-500 disabled:opacity-60">{isPending ? "Saving…" : "Save"}</button>
      </div>
      {feedback && <p className="px-5 pb-4 text-xs text-zinc-400">{feedback}</p>}
    </details>
  );
}
