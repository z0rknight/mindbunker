"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFxManualRateForMonth } from "@/modules/fx/actions";
import { currentMonthKey } from "@/utils/date";

// Sprint C1 -- second tier of the FX rate provenance hierarchy: a rate
// Emmanuel explicitly declares for a month that has no observed
// conversions yet (e.g. a historical month before this ledger existed).
// Setting a manual rate never overwrites or gets overwritten by observed
// data -- OBSERVED always wins when both exist for the same month.
export function SetManualRateButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [month, setMonth] = useState(currentMonthKey());
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(rate);
    if (!rate || isNaN(parsed) || parsed <= 0) {
      setError("Enter a positive rate.");
      return;
    }
    startTransition(async () => {
      const result = await setFxManualRateForMonth({ month, rate: parsed, notes: notes || undefined });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setRate("");
      setNotes("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
      >
        ✍️ Set Manual Rate
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-base">✍️ Set Manual FX Rate</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="text-zinc-500 text-xs mb-4">
              Only used for a month with no recorded conversions. If real conversions
              exist for this month, they always take priority over this.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Month</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Rate (1 USD = R$)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min="0"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="5.20"
                  required
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Saving…" : "Set Rate"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
