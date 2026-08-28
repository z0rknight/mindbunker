"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordFxConversion } from "@/modules/fx/actions";
import { todayISO } from "@/utils/date";
import { FX_PURPOSES, type FxPurpose } from "@/modules/fx/core";

const PURPOSE_LABEL: Record<FxPurpose, string> = {
  OPERATING_COST: "Operating cost (e.g. a BRL subscription)",
  TAX_RESERVE: "Tax reserve",
  OWNER_TRANSFER: "Owner transfer",
  OTHER: "Other",
};

// Sprint C1 -- records a REAL BRL<->USD conversion Emmanuel actually
// performed. No automatic FX API: this is always a manual, after-the-fact
// entry, exactly like Record Owner Pay is for cash movements.
//
// FX + Business Operating Cash Patch §2/§3/§6: scope and "which currency
// did you spend" are both required -- there is no default and no guess.
// Scope decides whether this conversion is folded into Business Cash at
// all (see getRmediaCashSummary/getFinanceSummary); From Currency decides
// which side of Business Cash decreases vs increases (computeFxCashMovements
// in modules/fx/core.ts). Purpose only ever applies to a BUSINESS
// conversion and only ever describes intent -- it never creates an expense
// by itself (the actual subscription charge is what does that).
export function RecordFxConversionButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(todayISO());
  const [brlAmount, setBrlAmount] = useState("");
  const [usdAmount, setUsdAmount] = useState("");
  const [scope, setScope] = useState<"BUSINESS" | "PERSONAL">("BUSINESS");
  const [fromCurrency, setFromCurrency] = useState<"" | "USD" | "BRL">("");
  const [purpose, setPurpose] = useState<"" | FxPurpose>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const brl = Number(brlAmount);
    const usd = Number(usdAmount);
    if (!brlAmount || isNaN(brl) || brl <= 0) {
      setError("Enter a positive BRL amount.");
      return;
    }
    if (!usdAmount || isNaN(usd) || usd <= 0) {
      setError("Enter a positive USD amount.");
      return;
    }
    if (!fromCurrency) {
      setError("Select which currency you actually spent.");
      return;
    }
    startTransition(async () => {
      const result = await recordFxConversion({
        date,
        brlAmount: brl,
        usdAmount: usd,
        scope,
        fromCurrency,
        purpose: scope === "BUSINESS" && purpose ? purpose : null,
        notes: notes || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBrlAmount("");
      setUsdAmount("");
      setFromCurrency("");
      setPurpose("");
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
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
      >
        💱 Record Conversion
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-base">💱 Record FX Conversion</h2>
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
              A real conversion you actually made -- e.g. $100 converted into R$510 to pay a BRL bill.
              A BUSINESS conversion moves Business Cash between currencies; it never touches revenue or expenses.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope("BUSINESS")}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                      scope === "BUSINESS"
                        ? "border-indigo-500 bg-indigo-900/40 text-white"
                        : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    Business
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScope("PERSONAL");
                      setPurpose("");
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                      scope === "PERSONAL"
                        ? "border-indigo-500 bg-indigo-900/40 text-white"
                        : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    Personal
                  </button>
                </div>
                <p className="text-zinc-600 text-[11px] mt-1">
                  {scope === "BUSINESS"
                    ? "Moves Business Cash between USD and BRL. Never affects Personal Finance."
                    : "Moves Personal Finance between USD and BRL. Never affects Business Cash or Owner Pay."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">BRL Amount</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={brlAmount}
                    onChange={(e) => setBrlAmount(e.target.value)}
                    placeholder="510.00"
                    required
                    autoFocus
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">USD Amount</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={usdAmount}
                    onChange={(e) => setUsdAmount(e.target.value)}
                    placeholder="100.00"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Which currency did you spend?</label>
                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value as "" | "USD" | "BRL")}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select...</option>
                  <option value="USD">USD (I spent USD, received BRL)</option>
                  <option value="BRL">BRL (I spent BRL, received USD)</option>
                </select>
              </div>
              {scope === "BUSINESS" && (
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Purpose (optional)</label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as "" | FxPurpose)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">No purpose noted</option>
                    {FX_PURPOSES.map((p) => (
                      <option key={p} value={p}>{PURPOSE_LABEL[p]}</option>
                    ))}
                  </select>
                  <p className="text-zinc-600 text-[11px] mt-1">
                    Describes intent only -- this alone never creates an expense.
                  </p>
                </div>
              )}
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
                {isPending ? "Recording…" : "Record Conversion"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
