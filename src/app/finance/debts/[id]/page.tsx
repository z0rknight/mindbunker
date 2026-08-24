import Link from "next/link";
import { notFound } from "next/navigation";
import { getDebtById } from "@/modules/finance/actions";
import { formatCurrency } from "@/utils/date";
import { RecordDebtPaymentButton } from "./RecordDebtPaymentButton";
import { DebtPaymentRow } from "./DebtPaymentRow";

export const dynamic = "force-dynamic";

export default async function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const debtId = parseInt(id, 10);
  if (isNaN(debtId)) notFound();

  const debt = await getDebtById(debtId);
  if (!debt) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/finance/debts" className="text-zinc-500 text-xs hover:text-white">← Debts</Link>
      <div className="mt-2 mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{debt.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">{debt.creditor}</p>
        </div>
        {debt.status === "ACTIVE" && <RecordDebtPaymentButton debtId={debt.id} currency={debt.currency} />}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wider">Original</p>
          <p className="text-white font-bold text-lg mt-1">{formatCurrency(debt.originalAmount, debt.currency)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wider">Paid</p>
          <p className="text-emerald-400 font-bold text-lg mt-1">{formatCurrency(debt.paidTotal, debt.currency)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wider">Remaining</p>
          <p className="text-white font-bold text-lg mt-1">{formatCurrency(debt.remainingBalance, debt.currency)}</p>
        </div>
      </div>

      {debt.notes && <p className="text-zinc-400 text-sm mb-6">{debt.notes}</p>}

      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Payment history</h2>
      {debt.payments.length === 0 ? (
        <p className="text-zinc-600 text-sm">No payments recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {debt.payments.map((p) => (
            <DebtPaymentRow key={p.id} payment={{ id: p.id, amount: p.amount, currency: p.currency, date: p.date, notes: p.notes }} />
          ))}
        </div>
      )}
    </div>
  );
}
