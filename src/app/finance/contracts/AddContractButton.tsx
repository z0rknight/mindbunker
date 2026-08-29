"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCommercialContract } from "@/modules/finance/actions";
import { DEFAULT_CURRENCY } from "@/modules/finance/config";

type ClientOption = { id: number; name: string };

// Monday Money Lab P0 §2: minimum commercial-contract representation.
// Real QA fixture this form must support as-is: Taryn Dubreuil / Upwork /
// HOURLY / USD 25.00/hour.
export function AddContractButton({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [clientId, setClientId] = useState<string>(String(clients[0]?.id ?? ""));
  const [platform, setPlatform] = useState("Upwork");
  const [externalReference, setExternalReference] = useState("");
  const [billingType, setBillingType] = useState<"HOURLY" | "FIXED">("HOURLY");
  const [hourlyRate, setHourlyRate] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError("Select a client.");
      return;
    }
    startTransition(async () => {
      try {
        await createCommercialContract({
          clientId: Number(clientId),
          platform,
          externalReference: externalReference || null,
          billingType,
          hourlyRate: billingType === "HOURLY" ? Number(hourlyRate) : null,
          currency,
          notes: notes || null,
        });
        setOpen(false);
        setExternalReference("");
        setHourlyRate("");
        setNotes("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create contract.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer"
      >
        + Add Contract
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">🧾 Add Commercial Contract</h2>
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
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Client</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="" disabled>Select a client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Platform</label>
                  <input
                    type="text"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    placeholder="Upwork"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">External ref / URL</label>
                  <input
                    type="text"
                    value={externalReference}
                    onChange={(e) => setExternalReference(e.target.value)}
                    placeholder="ID or https://…"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Billing Type</label>
                <div className="flex gap-2">
                  {(["HOURLY", "FIXED"] as const).map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => setBillingType(bt)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                        billingType === bt
                          ? "border-violet-600 bg-violet-600/20 text-violet-300"
                          : "border-zinc-700 bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {billingType === "HOURLY" && (
                  <div>
                    <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Hourly Rate</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="25.00"
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                  </div>
                )}
                <div className={billingType === "HOURLY" ? "" : "col-span-2"}>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Currency</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    placeholder="USD"
                    required
                    maxLength={3}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Creating…" : "Create Contract"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
