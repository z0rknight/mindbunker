"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate, formatCurrency, currentMonthKey, shiftMonthKey, formatMonthKey } from "@/utils/date";
import { EditPersonalTransactionButton } from "./EditPersonalTransactionButton";
import { DeletePersonalTransactionButton } from "./DeletePersonalTransactionButton";

type PersonalTransaction = {
  id: number;
  type: "opening_balance" | "owner_pay_receipt" | "income" | "expense";
  amount: number;
  category: string;
  currency: string;
  date: string;
  notes: string | null;
  // Client Portal Reality round §E: present only on owner_pay_receipt
  // rows (see the schema's link CHECK constraint) -- the business
  // transaction this receipt is the personal side of.
  ownerPayTransactionId: number | null;
};

const TYPE_LABEL: Record<PersonalTransaction["type"], string> = {
  opening_balance: "🏁 Opening Balance",
  owner_pay_receipt: "🏦 Owner Pay from RMEDIA",
  income: "💵 Income",
  expense: "🧾 Expense",
};

const TYPE_ACCENT: Record<PersonalTransaction["type"], string> = {
  opening_balance: "text-zinc-400",
  owner_pay_receipt: "text-indigo-400",
  income: "text-emerald-400",
  expense: "text-red-400",
};

// Sprint C1 §68: narrow month-navigation switcher scoped to this list only
// -- the balance StatCards above stay all-time cumulative (a balance isn't
// meaningfully "for a month"), this just filters which rows are shown so a
// long history doesn't have to be scrolled in full.
export function PersonalTransactionsList({ transactions }: { transactions: PersonalTransaction[] }) {
  const [month, setMonth] = useState(currentMonthKey());

  const filtered = useMemo(
    () => [...transactions].reverse().filter((t) => t.date.slice(0, 7) === month),
    [transactions, month],
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="text-sm font-semibold text-white min-w-[9rem] text-center">{formatMonthKey(month)}</p>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
          aria-label="Next month"
        >
          →
        </button>
        {month !== currentMonthKey() && (
          <button
            type="button"
            onClick={() => setMonth(currentMonthKey())}
            className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            Today
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
          <p className="text-zinc-500 text-sm">No personal transactions in {formatMonthKey(month)}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div id={`personal-tx-${t.id}`} key={t.id} className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${TYPE_ACCENT[t.type]}`}>{TYPE_LABEL[t.type]}</p>
                <p className="text-zinc-500 text-xs">
                  {t.category} · {formatDate(t.date)}
                  {t.notes ? ` · ${t.notes}` : ""}
                </p>
                {t.type === "owner_pay_receipt" && t.ownerPayTransactionId !== null && (
                  <Link
                    href={`/finance#tx-${t.ownerPayTransactionId}`}
                    className="mt-0.5 inline-block text-[11px] text-indigo-400 hover:text-indigo-300"
                  >
                    Transfer from business →
                  </Link>
                )}
                {(t.type === "income" || t.type === "expense") && (
                  <div className="mt-1 flex items-center gap-3">
                    <EditPersonalTransactionButton
                      transaction={{
                        id: t.id,
                        type: t.type,
                        amount: t.amount,
                        currency: t.currency,
                        date: t.date,
                        notes: t.notes,
                        category: t.category,
                      }}
                    />
                    <DeletePersonalTransactionButton id={t.id} />
                  </div>
                )}
              </div>
              <p className={`shrink-0 text-sm font-bold ${t.type === "expense" ? "text-red-400" : "text-white"}`}>
                {t.type === "expense" ? "−" : "+"}
                {formatCurrency(t.amount, t.currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
