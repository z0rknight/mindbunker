"use client";
import { useState, useTransition } from "react";
import { setSystemCandidateVerdict, recordSystemIntervention } from "@/modules/system-candidates/actions";

type Candidate = { key: string; category: string; keyword: string | null; count: number; minutesLost: number; verdict: string | null };
type Intervention = { id: number; name: string; problem: string | null; before: string | null; after: string | null };

export function SystemPanel({ candidates, interventions }: { candidates: Candidate[]; interventions: Intervention[] }) {
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">System Candidates (discovery, not automation)</p>
      {candidates.length === 0 ? <p className="text-xs text-zinc-500">Nothing above threshold yet.</p> : (
        <ul className="space-y-2">
          {candidates.map((c) => (
            <li key={c.key} className="text-xs text-zinc-300">
              <p>{c.keyword ?? c.category} · {c.category} · {c.count} occurrences{c.minutesLost ? `, ${c.minutesLost}m lost` : ""}</p>
              <div className="flex gap-1 mt-1">
                {(["IGNORE", "WATCH", "SYSTEMIZE"] as const).map((v) => (
                  <button key={v} disabled={pending} onClick={() => startTransition(async () => { await setSystemCandidateVerdict(c.key, v); })} className={`rounded-md px-2 py-1 text-[10px] font-semibold ${c.verdict === v ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>{v}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 pt-2">Record System Intervention</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="System (e.g. TrueNAS)" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      <input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Problem" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      <input value={before} onChange={(e) => setBefore(e.target.value)} placeholder="Before" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      <input value={after} onChange={(e) => setAfter(e.target.value)} placeholder="After" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      <button disabled={pending || !name} onClick={() => startTransition(async () => { await recordSystemIntervention({ name, problem, before, after }); setName(""); setProblem(""); setBefore(""); setAfter(""); })} className="w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Record</button>
      {interventions.length > 0 && (
        <ul className="text-[11px] text-zinc-500 space-y-1">
          {interventions.map((i) => <li key={i.id}>{i.name}: {i.before} → {i.after}</li>)}
        </ul>
      )}
    </div>
  );
}
