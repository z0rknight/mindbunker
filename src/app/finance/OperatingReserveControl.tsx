"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOperatingReserveTarget, recordOperatingReserveContribution } from "@/modules/finance/actions";
import { formatCurrency } from "@/utils/date";

// Monday Real-Operation Pre-Freeze §11: a minimal, single-target extension
// of Finance -- NOT a treasury subsystem, NOT a Wise integration. Target is
// one editable number; "reserved so far" is DERIVED from real expense
// transactions tagged category = 'Operating Reserve' (see
// getOperatingReserveSummary in actions.ts).
export function OperatingReserveControl({
  targetAmount,
  reservedSoFar,
  remainingToTarget,
  currency,
}: {
  targetAmount: number | null;
  reservedSoFar: number;
  remainingToTarget: number | null;
  currency: string;
}) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [targetValue, setTargetValue] = useState(targetAmount !== null ? String(targetAmount) : "");
  const [contributionAmount, setContributionAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function saveTarget(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = targetValue.trim() ? Number(targetValue) : null;
    startTransition(async () => {
      const result = await setOperatingReserveTarget({ targetAmount: parsed, currency });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditingTarget(false);
      router.refresh();
    });
  }

  function contribute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(contributionAmount);
    if (!contributionAmount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    startTransition(async () => {
      const result = await recordOperatingReserveContribution({ amount: parsed, currency });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setContributing(false);
      setContributionAmount("");
      router.refresh();
    });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">Operating Cost Reserve</p>
        <div className="flex gap-2">
          <button onClick={() => setContributing((v) => !v)} className="text-[11px] text-cyan-400 hover:text-cyan-300 underline decoration-dotted underline-offset-2 cursor-pointer">
            + contribute
          </button>
          <button onClick={() => setEditingTarget((v) => !v)} className="text-[11px] text-zinc-500 hover:text-zinc-300 underline decoration-dotted underline-offset-2 cursor-pointer">
            edit target
          </button>
        </div>
      </div>
      <p className="text-white font-bold text-lg">
        {formatCurrency(reservedSoFar, currency)}
        {targetAmount !== null && (
          <span className="text-zinc-500 text-sm font-normal"> / {formatCurrency(targetAmount, currency)}</span>
        )}
      </p>
      {remainingToTarget !== null && (
        <p className="text-zinc-500 text-xs mt-1">{formatCurrency(remainingToTarget, currency)} remaining to target</p>
      )}
      {targetAmount === null && <p className="text-zinc-600 text-xs mt-1">No target set yet.</p>}

      {editingTarget && (
        <form onSubmit={saveTarget} className="mt-3 flex items-center gap-2 text-xs">
          <input type="number" inputMode="decimal" step="0.01" min="0" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="Target amount" className="w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-500" />
          <button type="submit" disabled={isPending} className="rounded bg-cyan-700 hover:bg-cyan-600 text-white font-semibold px-2 py-1 text-xs disabled:opacity-60">Save</button>
        </form>
      )}
      {contributing && (
        <form onSubmit={contribute} className="mt-3 flex items-center gap-2 text-xs">
          <input type="number" inputMode="decimal" step="0.01" min="0" value={contributionAmount} onChange={(e) => setContributionAmount(e.target.value)} placeholder="Amount" autoFocus className="w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-500" />
          <button type="submit" disabled={isPending} className="rounded bg-cyan-700 hover:bg-cyan-600 text-white font-semibold px-2 py-1 text-xs disabled:opacity-60">Record</button>
        </form>
      )}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
