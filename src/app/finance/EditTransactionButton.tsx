"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTransaction } from "@/modules/finance/actions";

export function EditTransactionButton({
  transaction,
}: {
  transaction: {
    id: number;
    amount: number;
    category: string;
    date: string;
    notes: string | null;
    currency: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState(transaction.category);
  const [date, setDate] = useState(transaction.date);
  const [currency, setCurrency] = useState(transaction.currency);
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateTransaction(transaction.id, {
        amount: Number(amount),
        category,
        date,
        currency,
        notes,
      });
      if (!result.success) return setError(result.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-zinc-500 hover:text-cyan-400">
        Edit
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
          <form onSubmit={submit} className="safe-sheet max-h-[92dvh] w-full space-y-4 overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 sm:max-w-sm sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-white">Edit transaction</h2>
                <p className="text-xs text-zinc-500">Identity and linked evidence stay unchanged.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 min-w-11 text-xl text-zinc-500">×</button>
            </div>
            <label className="block text-xs text-zinc-400">Amount<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white" /></label>
            <label className="block text-xs text-zinc-400">Currency<input required maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white" /></label>
            <label className="block text-xs text-zinc-400">Date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white" /></label>
            <label className="block text-xs text-zinc-400">Category<input required value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white" /></label>
            <label className="block text-xs text-zinc-400">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white" /></label>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button disabled={pending} className="w-full rounded-lg bg-cyan-700 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? "Saving…" : "Save correction"}</button>
          </form>
        </div>
      )}
    </>
  );
}
