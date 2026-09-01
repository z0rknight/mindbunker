"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recordPersonalOpeningBalance,
  recordPersonalIncome,
  recordPersonalExpense,
} from "@/modules/personal-finance/actions";
import { DEFAULT_CURRENCY } from "@/modules/finance/config";
import {
  PERSONAL_EXPENSE_CATEGORIES,
  resolveExpenseCategory,
} from "@/modules/finance/categories";

type Kind = "opening_balance" | "income" | "expense";

const KIND_CONFIG: Record<
  Kind,
  { label: string; icon: string; color: string; defaultCategory: string; showCategory: boolean }
> = {
  opening_balance: {
    label: "Set Opening Balance",
    icon: "🏁",
    color: "bg-zinc-700 hover:bg-zinc-600",
    defaultCategory: "Opening Balance",
    showCategory: false,
  },
  income: {
    label: "Add Personal Income",
    icon: "💵",
    color: "bg-emerald-700 hover:bg-emerald-600",
    defaultCategory: "",
    showCategory: true,
  },
  expense: {
    label: "Add Personal Expense",
    icon: "🧾",
    color: "bg-red-800 hover:bg-red-700",
    defaultCategory: "",
    showCategory: true,
  },
};

// Sprint C1 -- deliberately excludes `owner_pay_receipt`: that type is only
// ever created by the Owner Pay bridge (finance/actions.ts's
// recordOwnerPay), never entered directly here. See
// validatePersonalTransactionInput in modules/personal-finance/core.ts,
// which rejects a direct attempt even if the UI is bypassed.
export function RecordPersonalTransactionButton({ kind }: { kind: Kind }) {
  const config = KIND_CONFIG[kind];
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(config.defaultCategory);
  const [otherCategory, setOtherCategory] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      const data = { amount: parsed, currency, notes: notes || undefined };
      const expenseCategory = kind === "expense"
        ? resolveExpenseCategory(category, otherCategory, PERSONAL_EXPENSE_CATEGORIES)
        : category;
      if (kind === "expense" && !expenseCategory) {
        setError(category === "Other" ? "Describe the Other category briefly." : "Select a category.");
        return;
      }
      const result =
        kind === "opening_balance"
          ? await recordPersonalOpeningBalance(data)
          : kind === "income"
            ? await recordPersonalIncome({ ...data, category: category || "Income" })
            : await recordPersonalExpense({ ...data, category: expenseCategory || "Expense" });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setAmount("");
      setCategory(config.defaultCategory);
      setOtherCategory("");
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
        className={`flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm text-white active:scale-95 transition-all w-full cursor-pointer ${config.color}`}
      >
        <span className="text-2xl">{config.icon}</span>
        <span>{config.label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-base">{config.icon} {config.label}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="0.00"
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
                    placeholder="BRL"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
              {config.showCategory && (
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Category</label>
                  {kind === "expense" ? (
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                    >
                      <option value="">Select a category…</option>
                      {PERSONAL_EXPENSE_CATEGORIES.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Gift, side job..."
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                  )}
                </div>
              )}
              {kind === "expense" && category === "Other" && (
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Other detail</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={otherCategory}
                    onChange={(e) => setOtherCategory(e.target.value)}
                    placeholder="Short description"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              )}
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
                {isPending ? "Saving…" : "Save"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
