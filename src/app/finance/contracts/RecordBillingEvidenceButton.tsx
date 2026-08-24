"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordBillingEvidence } from "@/modules/finance/actions";
import { BILLING_EVIDENCE_SOURCES, type BillingEvidenceSource } from "@/modules/finance/config";

// Monday Money Lab P0 §3: minimum billing-evidence registration. Real QA
// fixture this form must support as-is: 2026-08-10..2026-08-16, 15h10
// (910 min), USD 25/hour, gross USD 379.17. Idempotent: re-submitting the
// exact same contract+period+source+reference shows "already imported"
// instead of creating a duplicate row (see buildBillingEvidenceIdempotencyKey).
export function RecordBillingEvidenceButton({
  contractId,
  defaultCurrency,
}: {
  contractId: number;
  defaultCurrency: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [rate, setRate] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [source, setSource] = useState<BillingEvidenceSource>("MANUAL");
  const [externalReference, setExternalReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: boolean } | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const billableMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    startTransition(async () => {
      try {
        const outcome = await recordBillingEvidence({
          contractId,
          periodStart,
          periodEnd,
          billableMinutes,
          rate: Number(rate),
          grossAmount: Number(grossAmount),
          currency,
          source,
          externalReference: externalReference || null,
        });
        setResult(outcome);
        router.refresh();
        if (outcome.created) {
          setTimeout(() => setOpen(false), 900);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not register billing evidence.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer"
      >
        + Register Billing Evidence
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">📥 Register Billing Evidence</h2>
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
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Period Start</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Period End</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Billable Time</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="15"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-zinc-500 text-xs">h</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    placeholder="10"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-zinc-500 text-xs">m</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Rate</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="25.00"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Gross Amount</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={grossAmount}
                    onChange={(e) => setGrossAmount(e.target.value)}
                    placeholder="379.17"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Currency</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 uppercase"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as BillingEvidenceSource)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    {BILLING_EVIDENCE_SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">External Ref</label>
                  <input
                    type="text"
                    value={externalReference}
                    onChange={(e) => setExternalReference(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              {result && (
                <p className={`text-xs ${result.created ? "text-emerald-400" : "text-amber-400"}`}>
                  {result.created
                    ? "Registered."
                    : "Already imported — this exact evidence already exists (idempotency key matched), no duplicate created."}
                </p>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Registering…" : "Register Billing Evidence"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
