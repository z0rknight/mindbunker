"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePersonalTransaction } from "@/modules/personal-finance/actions";

type EditableType = "income" | "expense";

// Personal Finance Correction Patch -- compact row-level edit for an
// ordinary income/expense row. Deliberately excludes opening_balance and
// owner_pay_receipt (see isEditablePersonalTransactionType in
// modules/personal-finance/core.ts) -- callers only ever render this for
// a row whose type is already income or expense. Category is editable
// (blank/omitted preserves the existing category server-side -- see
// updatePersonalTransaction in modules/personal-finance/actions.ts).
export function EditPersonalTransactionButton({
  transaction,
}: {
  transaction: {
    id: number;
    type: EditableType;
    amount: number;
    currency: string;
    date: string;
    notes: string | null;
    category: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<EditableType>(transaction.type);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [currency, setCurrency] = useState(transaction.currency);
  const [date, setDate] = useState(transaction.date);
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [category, setCategory] = useState(transaction.category);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function reset() {
    setType(transaction.type);
    setAmount(String(transaction.amount));
    setCurrency(transaction.currency);
    setDate(transaction.date);
    setNotes(transaction.notes ?? "");
    setCategory(transaction.category);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (!date) {
      setError("Date is required.");
      return;
    }
    startTransition(async () => {
      const result = await updatePersonalTransaction(transaction.id, {
        type,
        amount: parsed,
        currency,
        date,
        notes: notes || undefined,
        category: category || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-zinc-600 hover:text-violet-400 text-xs transition-colors cursor-pointer"
      >
        Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOpen(false);
              reset();
            }
          }}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-base">✏️ Edit Transaction</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      type === "income"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    💵 Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      type === "expense"
                        ? "border-red-500 bg-red-500/15 text-red-300"
                        : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    🧾 Expense
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Amount</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    autoFocus
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Currency</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-violet-700 hover:bg-violet-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Saving…" : "Save correction"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
