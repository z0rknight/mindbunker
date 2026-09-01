"use client";

import { useState, useTransition } from "react";
import { recordHypothesis, recordExperiment, resolveExperiment, type Verdict } from "@/modules/decision-log/actions";

type LogData = {
  decisions: { id: number; statement: string; context: string | null }[];
  hypotheses: { id: number; statement: string }[];
  experiments: { id: number; hypothesisId: number | null; successCondition: string; result: string | null; verdict: string | null }[];
};

const VERDICTS: Verdict[] = ["KEEP", "PATCH", "KILL", "INCONCLUSIVE"];

export function DecisionLogPanel({ log }: { log: LogData }) {
  const [hypothesis, setHypothesis] = useState("");
  const [successCondition, setSuccessCondition] = useState("");
  const [resultText, setResultText] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Decision / Experiment Log</p>

      <div className="flex gap-2">
        <input value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="Hypothesis" className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
        <button disabled={pending || !hypothesis} onClick={() => startTransition(async () => { await recordHypothesis(hypothesis); setHypothesis(""); })} className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Add</button>
      </div>
      <div className="flex gap-2">
        <input value={successCondition} onChange={(e) => setSuccessCondition(e.target.value)} placeholder="Experiment success condition" className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
        <button disabled={pending || !successCondition} onClick={() => startTransition(async () => { await recordExperiment(null, successCondition); setSuccessCondition(""); })} className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Add</button>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Experiments</p>
        <ul className="space-y-2">
          {log.experiments.map((e) => (
            <li key={e.id} className="text-xs text-zinc-300">
              <p>{e.successCondition}</p>
              {e.verdict ? (
                <p className="text-zinc-500">→ {e.verdict}{e.result ? `: ${e.result}` : ""}</p>
              ) : (
                <div className="flex gap-1 mt-1 flex-wrap">
                  <input
                    value={resultText[e.id] ?? ""}
                    onChange={(ev) => setResultText((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                    placeholder="result"
                    className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-white"
                  />
                  {VERDICTS.map((v) => (
                    <button
                      key={v}
                      disabled={pending}
                      onClick={() => startTransition(async () => { await resolveExperiment(e.id, resultText[e.id] ?? "", v); })}
                      className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-white"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
          {log.experiments.length === 0 && <li className="text-xs text-zinc-500">None yet.</li>}
        </ul>
      </div>
    </div>
  );
}
