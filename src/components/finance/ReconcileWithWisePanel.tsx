"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getCashPocketReconciliation,
  recordCashAccountSnapshot,
  type CashPocketReconciliationRow,
} from "@/modules/cash-accounts/actions";
import { formatCurrency, todayISO } from "@/utils/date";

function formatDiff(currency: string, diff: number): string {
  const formatted = formatCurrency(Math.abs(diff), currency);
  if (diff > 0.005) return `+${formatted}`;
  if (diff < -0.005) return `-${formatted}`;
  return formatCurrency(0, currency);
}

function diffColor(diff: number): string {
  if (Math.abs(diff) < 0.005) return "text-emerald-400";
  return "text-amber-400";
}

// Reality Closure (26 Aug 2026): "MindBunker needs to distinguish LEDGER
// BALANCE from OBSERVED ACCOUNT BALANCE." This panel is evidence-only --
// recording a snapshot here never creates income/expense/FX/owner-pay,
// and this component never mutates anything but cash_account_snapshots.
// Drop-in on both /finance (scope="BUSINESS") and /finance/personal
// (scope="PERSONAL"); self-fetches on mount so neither page's existing
// data-fetching needs to change.
export function ReconcileWithWisePanel({ scope }: { scope: "BUSINESS" | "PERSONAL" }) {
  const router = useRouter();
  const [rows, setRows] = useState<CashPocketReconciliationRow[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openAccountId, setOpenAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [observedAt, setObservedAt] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    getCashPocketReconciliation(scope).then(setRows);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const openForm = (accountId: number) => {
    setOpenAccountId(accountId);
    setAmount("");
    setObservedAt(todayISO());
    setNotes("");
    setError(null);
  };

  const submit = () => {
    if (!openAccountId) return;
    setError(null);
    startTransition(async () => {
      const result = await recordCashAccountSnapshot({
        scope,
        cashAccountId: openAccountId,
        balanceAmount: Number(amount) || 0,
        observedAt,
        notes,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpenAccountId(null);
      load();
      router.refresh();
    });
  };

  if (!rows) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        Reconcile with Wise
      </p>
      <p className="mt-1 text-xs text-zinc-600">
        Each Wise pocket closes independently. Observed balances are evidence only — recording
        one never changes revenue, expenses, FX rate, or the source movements.
      </p>

      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={row.accountId} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-white">{row.label}</span>
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  {row.currency} · {row.pocket}
                </span>
              </div>
              {openAccountId !== row.accountId && (
                <button
                  type="button"
                  onClick={() => openForm(row.accountId)}
                  className="text-[11px] font-bold text-violet-300 hover:text-violet-200"
                >
                  {row.observed ? "Update observed" : "Record observed balance"}
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-zinc-600">Derived</p>
                <p className="font-bold text-zinc-200">{formatCurrency(row.ledgerAmount, row.currency)}</p>
              </div>
              <div>
                <p className="text-zinc-600">Observed</p>
                <p className="font-bold text-zinc-200">
                  {row.observed ? formatCurrency(row.observed.amount, row.currency) : "—"}
                </p>
              </div>
              <div>
                <p className="text-zinc-600">Difference</p>
                <p className={`font-bold ${row.difference === null ? "text-zinc-600" : diffColor(row.difference)}`}>
                  {row.difference === null ? "—" : formatDiff(row.currency, row.difference)}
                </p>
              </div>
            </div>
            {row.observed && (
              <p className="mt-1.5 text-[10px] text-zinc-700">
                Observed {row.observed.observedAt} · {row.observed.source}
              </p>
            )}

            <p className="mt-1.5 text-[10px] text-zinc-700">
              Opening {formatCurrency(row.openingBalance, row.currency)} · {row.openingAsOf}
            </p>

            {openAccountId === row.accountId && (
              <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Observed ${row.currency} balance`}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                  <input
                    type="date"
                    value={observedAt}
                    onChange={(e) => setObservedAt(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
                {error && <p className="text-xs text-red-300">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {isPending ? "Saving…" : "Save observed balance"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenAccountId(null)}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-400 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
