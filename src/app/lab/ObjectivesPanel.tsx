"use client";
import { useState, useTransition } from "react";
import { createObjective, updateObjectiveCurrentText, setObjectiveStatus } from "@/modules/objectives/actions";

type Objective = {
  id: number;
  title: string;
  period: string | null;
  status: string;
  targetText: string | null;
  currentText: string | null;
  notes: string | null;
  linkedCommitmentId: number | null;
  linkedProjectId: number | null;
  linkedClientId: number | null;
};

// Wave 4Q: minimal strategic-outcome container -- not a task tree. Links
// to Commitment/Project/Client are optional and shown as raw ids (no new
// picker UI was worth building for a "consider" surface).
export function ObjectivesPanel({ objectives }: { objectives: Objective[] }) {
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [target, setTarget] = useState("");
  const [pending, startTransition] = useTransition();
  const active = objectives.filter((o) => o.status === "ACTIVE");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Objectives (strategic outcomes, not tasks)</p>
      <div className="flex flex-wrap gap-1.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objective title" className="min-w-[10rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
        <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Period (e.g. Q3 2026)" className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      </div>
      <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target (what does done look like?)" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      <button
        disabled={pending || !title}
        onClick={() => startTransition(async () => {
          await createObjective({ title, period: period || undefined, targetText: target || undefined });
          setTitle(""); setPeriod(""); setTarget("");
        })}
        className="w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        Add Objective
      </button>
      <ul className="space-y-2">
        {active.map((o) => (
          <ObjectiveRow key={o.id} o={o} />
        ))}
        {active.length === 0 && <li className="text-xs text-zinc-500">No active objectives.</li>}
      </ul>
    </div>
  );
}

function ObjectiveRow({ o }: { o: Objective }) {
  const [current, setCurrent] = useState(o.currentText ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white">{o.title}{o.period ? ` (${o.period})` : ""}</span>
        <div className="flex gap-1">
          <button disabled={pending} onClick={() => startTransition(async () => { await setObjectiveStatus(o.id, "DONE"); })} className="rounded-md bg-emerald-800 px-2 py-0.5 text-[10px] text-emerald-200">Done</button>
          <button disabled={pending} onClick={() => startTransition(async () => { await setObjectiveStatus(o.id, "DROPPED"); })} className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">Drop</button>
        </div>
      </div>
      {o.targetText && <p className="text-[11px] text-zinc-500">Target: {o.targetText}</p>}
      <div className="flex gap-1.5">
        <input value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Where things stand now" className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-white" />
        <button disabled={pending} onClick={() => startTransition(async () => { await updateObjectiveCurrentText(o.id, current); })} className="rounded-md bg-zinc-700 px-2 py-1 text-[11px] text-white">Save</button>
      </div>
    </li>
  );
}
