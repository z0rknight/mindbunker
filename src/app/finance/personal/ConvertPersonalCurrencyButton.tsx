"use client";

import { useState } from "react";
import { recordFxConversion } from "@/modules/fx/actions";
import { todayISO } from "@/utils/date";

type FxCurrency = "USD" | "BRL";

export function ConvertPersonalCurrencyButton() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => todayISO());
  const [brlAmount, setBrlAmount] = useState("");
  const [usdAmount, setUsdAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState<FxCurrency | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDate(todayISO());
    setBrlAmount("");
    setUsdAmount("");
    setFromCurrency("");
    setNotes("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const brl = Number(brlAmount);
    const usd = Number(usdAmount);

    if (!date) {
      setError("Date is required.");
      return;
    }
    if (!Number.isFinite(brl) || brl <= 0) {
      setError("Enter a valid BRL amount.");
      return;
    }
    if (!Number.isFinite(usd) || usd <= 0) {
      setError("Enter a valid USD amount.");
      return;
    }
    if (!fromCurrency) {
      setError("Choose which currency you spent.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await recordFxConversion({
        date,
        brlAmount: brl,
        usdAmount: usd,
        scope: "PERSONAL",
        fromCurrency,
        notes: notes || undefined,
      });
      if (!result.success) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setOpen(false);
      reset();
    } catch {
      setError("Could not save conversion.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 text-sm font-bold text-zinc-200 transition hover:bg-zinc-900"
      >
        💱 Convert currency
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-2xl">
            <h2 className="text-base font-black text-zinc-100">💱 Convert Currency</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              A real personal conversion you actually made -- e.g. $100 converted into R$510. Moves your Personal
              Finance cash between currencies. Never counted as income or an expense, and never touches Business
              Cash.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  Use the date the conversion actually happened, not necessarily today.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">BRL Amount</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={brlAmount}
                    onChange={(e) => setBrlAmount(e.target.value)}
                    placeholder="510.00"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">USD Amount</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={usdAmount}
                    onChange={(e) => setUsdAmount(e.target.value)}
                    placeholder="100.00"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Which currency did you spend?
                </label>
                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value as FxCurrency | "")}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">Select...</option>
                  <option value="USD">USD -- I spent dollars, received reais</option>
                  <option value="BRL">BRL -- I spent reais, received dollars</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Wise transfer"
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              </div>

              {error && <p className="text-xs font-semibold text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  className="flex-1 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm font-bold text-zinc-400 transition hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save conversion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
