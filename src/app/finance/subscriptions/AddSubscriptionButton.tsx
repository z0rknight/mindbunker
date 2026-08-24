"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSubscription } from "@/modules/finance/actions";
import { DEFAULT_CURRENCY } from "@/modules/finance/config";

export function AddSubscriptionButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [cadence, setCadence] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [renewalDate, setRenewalDate] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSubscription({
        name,
        vendor,
        amount: Number(amount),
        currency,
        cadence,
        renewalDate: renewalDate || null,
        category: category || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setName("");
      setVendor("");
      setAmount("");
      setRenewalDate("");
      setCategory("");
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer">
        + Add Subscription
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">🔁 Add Subscription</h2>
              <button type="button" onClick={() => setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer" aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Creative Cloud" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Vendor</label>
                  <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} required placeholder="Adobe" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Amount</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Currency</label>
                  <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} required maxLength={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 uppercase" />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Cadence</label>
                <div className="flex gap-2">
                  {(["MONTHLY", "ANNUAL"] as const).map((c) => (
                    <button key={c} type="button" onClick={() => setCadence(c)} className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${cadence === c ? "border-cyan-600 bg-cyan-600/20 text-cyan-300" : "border-zinc-700 bg-zinc-800 text-zinc-400"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Renewal date</label>
                  <input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Category</label>
                  <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Optional" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button type="submit" disabled={isPending} className="w-full rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60">
                {isPending ? "Creating…" : "Create Subscription"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
