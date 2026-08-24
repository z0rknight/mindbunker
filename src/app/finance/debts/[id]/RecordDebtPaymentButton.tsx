"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordDebtPayment } from "@/modules/finance/actions";
import { todayISO } from "@/utils/date";

export function RecordDebtPaymentButton({ debtId, currency }: { debtId: number; currency: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  function openModal() {
    setAmount("");
    setDate(todayISO());
    setNotes("");
    setError(null);
    setSubmitted(false);
    setIdempotencyKey(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${debtId}-${Date.now()}-${Math.random()}`,
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
    if (!date) {
      setError("Enter a payment date.");
      return;
    }
    setSubmitted(true);
    startTransition(async () => {
      const result = await recordDebtPayment({ debtId, amount: parsed, date, notes: notes || null, idempotencyKey });
      if (!result.success) {
        setError(result.error);
        setSubmitted(false);
        return;
      }
      setOpen(false);
      setAmount("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={openModal} className="rounded-lg bg-red-700 hover:bg-red-600 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer">
        Record Payment
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}>
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">Record Payment</h2>
              <button type="button" onClick={() => !isPending && setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer" aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Amount ({currency})</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Payment date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button type="submit" disabled={isPending || submitted} className="w-full rounded-lg bg-red-700 hover:bg-red-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60">
                {isPending ? "Saving…" : "Record Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
