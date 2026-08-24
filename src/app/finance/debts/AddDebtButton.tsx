"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDebt } from "@/modules/finance/actions";
import { DEFAULT_CURRENCY } from "@/modules/finance/config";

export function AddDebtButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [creditor, setCreditor] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createDebt({
        name,
        creditor,
        originalAmount: Number(originalAmount),
        currency,
        notes: notes || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setName("");
      setCreditor("");
      setOriginalAmount("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-red-800 hover:bg-red-700 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer"
      >
        + Add Debt
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">💳 Add Debt</h2>
              <button type="button" onClick={() => setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer" aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Equipment loan" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Creditor</label>
                <input type="text" value={creditor} onChange={(e) => setCreditor(e.target.value)} required placeholder="Bank, person, institution" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Original Amount</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Currency</label>
                  <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} required maxLength={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 uppercase" />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button type="submit" disabled={isPending} className="w-full rounded-lg bg-red-700 hover:bg-red-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60">
                {isPending ? "Creating…" : "Create Debt"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
