"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordOwnerPay } from "@/modules/finance/actions";
import { DEFAULT_CURRENCY } from "@/modules/finance/config";

// Monday Money Lab P0 §10: RMEDIA CASH -> OWNER PAY -> PERSONAL MONEY. A
// deliberately plain, explicit form -- no recurring/automatic scheduling
// this round, matching the brief's "support the intended weekly workflow
// without forcing recurring automation yet."
export function RecordOwnerPayButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  function openModal() {
    setAmount("");
    setCurrency(DEFAULT_CURRENCY);
    setNotes("");
    setError(null);
    setSubmitted(false);
    // Client Portal Reality round §C: minted once per form-open, same
    // convention as RecordDebtPaymentButton -- a double-click/retry of
    // the same submit cannot create a second Owner Pay.
    setIdempotencyKey(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `owner-pay-${Date.now()}-${Math.random()}`,
    );
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted) return;
    setError(null);
    const parsed = Number(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setSubmitted(true);
    startTransition(async () => {
      const result = await recordOwnerPay({
        amount: parsed,
        currency,
        notes: notes || undefined,
        idempotencyKey,
      });
      if (!result.success) {
        setError(result.error);
        setSubmitted(false);
        return;
      }
      setAmount("");
      setNotes("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm bg-indigo-800 hover:bg-indigo-700 text-white active:scale-95 transition-all w-full cursor-pointer"
      >
        <span className="text-2xl">🏦</span>
        <span>Record Owner Pay</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-base">🏦 Record Owner Pay</h2>
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
              RMEDIA Cash → Owner Pay → Personal Money. This is not revenue and
              not a business expense — it reduces Business Cash directly.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">
                  Amount ({currency})
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="USD">USD</option>
                  <option value="BRL">BRL</option>
                </select>
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
                {isPending ? "Recording…" : "Record Owner Pay"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
