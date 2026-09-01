"use client";
import { useState, useTransition } from "react";
import { logWakeUp } from "@/modules/daily-state/actions";

type TodayState = { sleepHours: number | null; energy: number | null; focus: number | null } | null;

export function WakeUpForm({ today }: { today: TodayState }) {
  const [sleepHours, setSleepHours] = useState(today?.sleepHours?.toString() ?? "");
  const [energy, setEnergy] = useState(today?.energy ?? 3);
  const [focus, setFocus] = useState(today?.focus ?? 3);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
      <p className="text-sm font-semibold text-white">Wake Up (under 20 seconds)</p>
      <div className="flex gap-2 items-center">
        <input type="number" step="0.5" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="sleep hrs" className="w-20 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
        <label className="text-xs text-zinc-500">Energy <input type="range" min={1} max={5} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className="align-middle" /> {energy}</label>
        <label className="text-xs text-zinc-500">Focus <input type="range" min={1} max={5} value={focus} onChange={(e) => setFocus(Number(e.target.value))} className="align-middle" /> {focus}</label>
      </div>
      <button disabled={pending} onClick={() => startTransition(async () => { const r = await logWakeUp({ sleepHours: sleepHours ? Number(sleepHours) : undefined, energy, focus }); setMessage(r.success ? r.message : r.error); })} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">Log</button>
      {message && <p className="text-xs text-emerald-400">{message}</p>}
    </div>
  );
}
