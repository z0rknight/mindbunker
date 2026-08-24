"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTransaction } from "@/modules/finance/actions";

// Monday Money Lab P0 §12/§4 QA step: "Register the real Upwork money event
// only when its actual semantics are known." This is a deliberate, manual
// step — separate from registering billing evidence — because billing
// evidence (what was billed) and a cash event (what actually moved) are two
// different facts (§4/§5, Three Truths). Pre-fills from the evidence but
// never auto-creates the transaction; Emmanuel confirms it actually landed.
export function LinkIncomeButton({
  billingEvidenceId,
  suggestedAmount,
  suggestedCurrency,
  clientLabel,
}: {
  billingEvidenceId: number;
  suggestedAmount: number;
  suggestedCurrency: string;
  clientLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(suggestedAmount));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    startTransition(async () => {
      try {
        await addTransaction({
          type: "income",
          amount: parsed,
          category: clientLabel,
          currency: suggestedCurrency,
          billingEvidenceId,
          notes: `Linked to billing evidence #${billingEvidenceId}`,
        });
        setDone(true);
        router.refresh();
        setTimeout(() => setOpen(false), 900);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not register income.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40 font-semibold px-3 py-1.5 text-xs transition-colors cursor-pointer"
      >
        💵 Register money received
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-base">💵 Register Money Received</h2>
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
              Only register this once you know it actually landed — billing
              evidence (what was billed) and this cash event (what moved) are
              different facts. Enters RMEDIA Cash as income linked to evidence
              #{billingEvidenceId}.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">
                  Amount ({suggestedCurrency})
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              {done && <p className="text-emerald-400 text-xs">Registered.</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Registering…" : "Confirm — Money Received"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
