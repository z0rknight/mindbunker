"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSubscriptionPayment, updateSubscriptionStatus } from "@/modules/finance/actions";
import { formatCurrency, todayISO } from "@/utils/date";

type Subscription = {
  id: number;
  name: string;
  vendor: string;
  amount: number;
  currency: string;
  cadence: "MONTHLY" | "ANNUAL";
  renewalDate: string | null;
  status: "ACTIVE" | "CANCELLED" | "TRIAL";
  category: string | null;
};

// Taryn August Ingest Readiness §2 (P0 SAFETY FIX): this button used to
// call recordSubscriptionPayment directly on click, with zero
// confirmation -- a mis-click or a repeated tap created real phantom
// expense transactions (see the finance report's EXISTING QA DATA
// section). Record Charge now ONLY opens a confirm form; nothing mutates
// finance until the human explicitly confirms it, and the server action
// is protected by a per-open idempotency key so a double-submit still
// cannot create two transactions.
export function SubscriptionRow({ subscription }: { subscription: Subscription }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(subscription.amount));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function openModal() {
    setAmount(String(subscription.amount));
    setDate(todayISO());
    setNote("");
    setError(null);
    setSubmitted(false);
    setIdempotencyKey(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${subscription.id}-${Date.now()}-${Math.random()}`,
    );
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted) return; // belt-and-suspenders against a double click racing React state
    setError(null);
    const parsed = Number(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (!date) {
      setError("Enter a payment date.");
      return;
    }
    setSubmitted(true);
    startTransition(async () => {
      const result = await recordSubscriptionPayment({
        subscriptionId: subscription.id,
        amount: parsed,
        date,
        notes: note.trim() || null,
        idempotencyKey,
      });
      if (!result.success) {
        setError(result.error);
        setSubmitted(false);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function setStatus(status: "ACTIVE" | "CANCELLED" | "TRIAL") {
    startTransition(async () => {
      await updateSubscriptionStatus(subscription.id, status);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="min-w-0">
        <p className="text-white font-semibold text-sm truncate">{subscription.name}</p>
        <p className="text-zinc-500 text-xs mt-0.5">
          {subscription.vendor} · {subscription.cadence === "MONTHLY" ? "Monthly" : "Annual"}
          {subscription.renewalDate ? ` · renews ${subscription.renewalDate}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p className="text-white font-bold text-sm">{formatCurrency(subscription.amount, subscription.currency)}</p>
        {subscription.status === "ACTIVE" ? (
          <>
            <button type="button" onClick={openModal} disabled={isPending} className="rounded-lg border border-cyan-700/50 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 font-semibold px-2.5 py-1 text-xs transition-colors disabled:opacity-50">
              Record charge
            </button>
            <button onClick={() => setStatus("CANCELLED")} disabled={isPending} className="rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 px-2.5 py-1 text-xs transition-colors disabled:opacity-50">
              Cancel
            </button>
          </>
        ) : (
          <span className="text-zinc-500 text-xs font-bold uppercase">{subscription.status}</span>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}>
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-bold text-base">Confirm charge</h2>
              <button type="button" onClick={() => !isPending && setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer" aria-label="Close">×</button>
            </div>
            <p className="text-zinc-500 text-xs mb-4">{subscription.name} · {subscription.vendor}</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Amount ({subscription.currency})</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Payment date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Note (optional)</label>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button type="submit" disabled={isPending || submitted} className="w-full rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60">
                {isPending ? "Recording…" : "Confirm & record this charge"}
              </button>
              <p className="text-zinc-600 text-[11px] text-center">Nothing is recorded until you confirm. This creates exactly one expense transaction.</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
