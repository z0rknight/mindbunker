"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDebtPayment, deleteDebtPayment } from "@/modules/finance/actions";
import { formatCurrency, formatDate } from "@/utils/date";

type Payment = {
  id: number;
  amount: number;
  currency: string;
  date: string;
  notes: string | null;
};

// Taryn August Ingest Readiness §3/§12: a debt payment entered with the
// wrong amount/date, or twice, must be correctable in the UI -- editing
// updates the same transaction row (paid/remaining recompute
// automatically server-side); delete removes it entirely. Neither ever
// inserts a second offsetting entry.
export function DebtPaymentRow({ payment }: { payment: Payment }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [date, setDate] = useState(payment.date);
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setAmount(String(payment.amount));
    setDate(payment.date);
    setNotes(payment.notes ?? "");
    setError(null);
    setEditing(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (!date) {
      setError("Enter a date.");
      return;
    }
    startTransition(async () => {
      const result = await updateDebtPayment({ paymentId: payment.id, amount: parsed, date, notes: notes || null });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("Delete this payment? This cannot be undone; the debt's remaining balance will recalculate.")) return;
    startTransition(async () => {
      await deleteDebtPayment(payment.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="rounded-lg bg-zinc-900 border border-red-800/40 px-4 py-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">Amount</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-red-500" />
          </div>
          <div>
            <label className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-red-500" />
          </div>
        </div>
        <div>
          <label className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-red-500" />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending} className="rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold px-3 py-1.5 text-xs transition-colors disabled:opacity-60">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} disabled={isPending} className="rounded-lg border border-zinc-700 text-zinc-400 hover:text-white px-3 py-1.5 text-xs transition-colors">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
      <div>
        <p className="text-white text-sm">{formatDate(payment.date)}</p>
        {payment.notes && <p className="text-zinc-600 text-xs mt-0.5">{payment.notes}</p>}
      </div>
      <div className="flex items-center gap-3">
        <p className="text-white font-semibold text-sm">{formatCurrency(payment.amount, payment.currency)}</p>
        <button type="button" onClick={startEdit} disabled={isPending} className="text-zinc-500 hover:text-white text-xs transition-colors disabled:opacity-40">
          Edit
        </button>
        <button type="button" onClick={handleDelete} disabled={isPending} className="text-zinc-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40">
          Delete
        </button>
      </div>
    </div>
  );
}
