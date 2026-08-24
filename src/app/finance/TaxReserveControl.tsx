"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTaxReservePercent } from "@/modules/finance/actions";

// Monday Money Lab P0 §9: experimental cash-planning percentage only.
// NOT tax accounting, NOT Brazilian tax law -- one number Emmanuel can
// change, clearly labeled as an estimate everywhere it's shown.
export function TaxReserveControl({ currentPercent }: { currentPercent: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentPercent));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setError("Enter a percent between 0 and 100.");
      return;
    }
    startTransition(async () => {
      try {
        await setTaxReservePercent(parsed);
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save.");
      }
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[11px] text-zinc-500 hover:text-zinc-300 underline decoration-dotted underline-offset-2 cursor-pointer"
      >
        Reserve rate: {currentPercent}% (experimental) · edit
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 text-xs">
      <label className="text-zinc-500">Experimental reserve %</label>
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        max="100"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-indigo-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-indigo-700 hover:bg-indigo-600 text-white font-semibold px-2 py-1 text-xs disabled:opacity-60"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setValue(String(currentPercent));
          setError(null);
        }}
        className="text-zinc-500 hover:text-white px-1"
      >
        Cancel
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </form>
  );
}
