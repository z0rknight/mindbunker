"use client";
import { useState, useTransition } from "react";
import { recordClaim, retireClaim } from "@/modules/claims/actions";

type Claim = { id: number; statement: string; type: string; confidence: string; evidenceNeeded: string | null; status: string };

export function ClaimsPanel({ claims }: { claims: Claim[] }) {
  const [statement, setStatement] = useState("");
  const [type, setType] = useState<"FACT" | "INFERENCE" | "HYPOTHESIS">("HYPOTHESIS");
  const [confidence, setConfidence] = useState<"HIGH" | "MEDIUM" | "LOW">("LOW");
  const [evidenceNeeded, setEvidenceNeeded] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Claims Registry (BI honesty check)</p>
      <input value={statement} onChange={(e) => setStatement(e.target.value)} placeholder='e.g. "Dave fixed-price work has higher effective rate than hourly editing"' className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      <div className="flex gap-2 flex-wrap">
        {(["FACT", "INFERENCE", "HYPOTHESIS"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${type === t ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>{t}</button>
        ))}
        {(["HIGH", "MEDIUM", "LOW"] as const).map((c) => (
          <button key={c} onClick={() => setConfidence(c)} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${confidence === c ? "bg-amber-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>{c}</button>
        ))}
      </div>
      <input value={evidenceNeeded} onChange={(e) => setEvidenceNeeded(e.target.value)} placeholder="Evidence needed" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      <button disabled={pending || !statement} onClick={() => startTransition(async () => { await recordClaim({ statement, type, confidence, evidenceNeeded }); setStatement(""); setEvidenceNeeded(""); })} className="w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Record Claim</button>
      <ul className="text-xs text-zinc-300 space-y-1">
        {claims.filter((c) => c.status !== "RETIRED").map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span>[{c.type}/{c.confidence}] {c.statement}{c.evidenceNeeded ? ` — needs: ${c.evidenceNeeded}` : ""}</span>
            <button onClick={() => startTransition(async () => { await retireClaim(c.id); })} className="shrink-0 rounded-md bg-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-white">Retire</button>
          </li>
        ))}
        {claims.length === 0 && <li className="text-zinc-500">None yet.</li>}
      </ul>
    </div>
  );
}
