"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFxConversion } from "@/modules/fx/actions";
import { FX_PURPOSES, type FxPurpose, type FxScope, type FxCurrency } from "@/modules/fx/core";

const PURPOSE_LABEL: Record<FxPurpose, string> = {
  OPERATING_COST: "Operating cost (e.g. a BRL subscription)",
  TAX_RESERVE: "Tax reserve",
  OWNER_TRANSFER: "Owner transfer",
  OTHER: "Other",
};

// Client Portal Reality round SH: Sprint C1 deferred edit/delete for FX
// conversions. The monthly weighted rate re-derives from all conversion
// rows on every read (see resolveFxRateForMonth/computeVolumeWeightedRate
// in modules/fx/core.ts) -- nothing is cached, so correcting a typo here
// needs no separate recompute step. Mirrors RecordFxConversionButton's
// exact form shape, pre-filled.
//
// FX + Business Operating Cash Patch §17: a legacy row can be
// scope="UNCLASSIFIED" -- never silently reclassified. The scope picker
// starts blank for those rows (not defaulted to Business or Personal) so
// saving requires an explicit, deliberate choice; picking neither leaves
// the row exactly as it was.
export function EditFxConversionButton({
  conversion,
}: {
  conversion: {
    id: number;
    date: string;
    brlAmount: number;
    usdAmount: number;
    scope: FxScope;
    fromCurrency: FxCurrency | null;
    purpose: FxPurpose | null;
    notes: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(conversion.date);
  const [brlAmount, setBrlAmount] = useState(String(conversion.brlAmount));
  const [usdAmount, setUsdAmount] = useState(String(conversion.usdAmount));
  const [scope, setScope] = useState<"" | "BUSINESS" | "PERSONAL">(
    conversion.scope === "UNCLASSIFIED" ? "" : conversion.scope,
  );
  const [fromCurrency, setFromCurrency] = useState<"" | "USD" | "BRL">(conversion.fromCurrency ?? "");
  const [purpose, setPurpose] = useState<"" | FxPurpose>(conversion.purpose ?? "");
  const [notes, setNotes] = useState(conversion.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function openModal() {
    setDate(conversion.date);
    setBrlAmount(String(conversion.brlAmount));
    setUsdAmount(String(conversion.usdAmount));
    setScope(conversion.scope === "UNCLASSIFIED" ? "" : conversion.scope);
    setFromCurrency(conversion.fromCurrency ?? "");
    setPurpose(conversion.purpose ?? "");
    setNotes(conversion.notes ?? "");
    setError(null);
    setOpen(true);
  }

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
    if (!scope) {
      setError("This conversion is Unclassified. Choose Business or Personal to save.");
      return;
    }
    if (!fromCurrency) {
      setError("Select which currency was actually spent.");
      return;
    }
    startTransition(async () => {
      const result = await updateFxConversion(conversion.id, {
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
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-zinc-500 hover:text-white text-xs transition-colors cursor-pointer"
      >
        Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-base">Edit FX Conversion</h2>
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
              Correcting a typo. The monthly rate recomputes automatically -- nothing else to update.
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
                {scope === "" && (
                  <p className="text-amber-400 text-[11px] mt-1">
                    Unclassified -- choose Business or Personal to save.
                  </p>
                )}
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
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Which currency was spent?</label>
                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value as "" | "USD" | "BRL")}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select...</option>
                  <option value="USD">USD (spent USD, received BRL)</option>
                  <option value="BRL">BRL (spent BRL, received USD)</option>
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
                {isPending ? "Saving..." : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
