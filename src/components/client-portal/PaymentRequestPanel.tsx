"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/utils/date";
import {
  cancelPaymentRequest,
  createPaymentRequest,
  markPaymentRequestPaid,
} from "@/modules/payment-requests/actions";

type PaymentRequestRow = {
  id: number;
  clientId: number;
  amountCents: number;
  currency: string;
  paymentUrl: string;
  status: "OPEN" | "PAID" | "CANCELLED";
  note: string | null;
};

// Dave Monday Release §29: the operator control surface for the new
// payment_requests primitive. Deliberately minimal -- create one OPEN
// request, mark it PAID or CANCELLED. No editing an existing request's
// amount/URL in place (cancel and create a new one instead) -- keeps the
// history honest without needing an edit-audit-trail concept for a table
// this small.
export function PaymentRequestPanel({
  clientId,
  requests,
}: {
  clientId: number;
  requests: PaymentRequestRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [note, setNote] = useState("");

  const open = requests.find((r) => r.status === "OPEN") ?? null;
  const history = requests.filter((r) => r.status !== "OPEN");

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError("Enter a valid positive amount.");
      return;
    }
    startTransition(async () => {
      const result = await createPaymentRequest({
        clientId,
        amountCents,
        currency: currency.toUpperCase(),
        paymentUrl,
        note: note.trim() || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setAmount("");
      setPaymentUrl("");
      setNote("");
      router.refresh();
    });
  }

  function handleMarkPaid(id: number) {
    startTransition(async () => {
      await markPaymentRequestPaid(id);
      router.refresh();
    });
  }

  function handleCancel(id: number) {
    startTransition(async () => {
      await cancelPaymentRequest(id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-400">
        Payment request
      </p>

      {open ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3.5">
          <p className="text-lg font-black text-white">
            {formatCurrency(open.amountCents / 100, open.currency)}
          </p>
          <p className="mt-1 truncate text-xs text-zinc-500">{open.paymentUrl}</p>
          {open.note && <p className="mt-1 text-xs text-zinc-400">{open.note}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => handleMarkPaid(open.id)}
              className="min-h-10 flex-1 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Mark paid
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleCancel(open.id)}
              className="min-h-10 flex-1 rounded-lg border border-red-900/60 px-3 text-xs font-black text-red-400 hover:bg-red-950/30 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-2.5">
          {error && (
            <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <div className="grid grid-cols-[1fr_90px] gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="min-h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-600"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="min-h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-sm text-white"
            >
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
            </select>
          </div>
          <input
            value={paymentUrl}
            onChange={(e) => setPaymentUrl(e.target.value)}
            placeholder="https://wise.com/pay/r/..."
            className="min-h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-600"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="min-h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={pending}
            className="min-h-10 w-full rounded-lg bg-violet-600 px-3 text-xs font-black text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {pending ? "Creating..." : "Create payment request"}
          </button>
        </form>
      )}

      {history.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[11px] font-bold text-zinc-500">
            History ({history.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-zinc-900/50 px-3 py-2 text-xs">
                <span className="text-zinc-400">{formatCurrency(r.amountCents / 100, r.currency)}</span>
                <span className={r.status === "PAID" ? "text-emerald-400" : "text-zinc-600"}>{r.status}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
