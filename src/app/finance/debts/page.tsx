import Link from "next/link";
import { getDebts } from "@/modules/finance/actions";
import { formatCurrency } from "@/utils/date";
import { AddDebtButton } from "./AddDebtButton";

export const dynamic = "force-dynamic";

// Monday Real-Operation Pre-Freeze §16: very small debt prototype. No
// compound-interest forecasting -- remainingBalance is always DERIVED
// (originalAmount minus the real payment ledger), never a stored,
// driftable column.
export default async function DebtsPage() {
  const debts = await getDebts();
  const active = debts.filter((d) => d.status === "ACTIVE");
  const paid = debts.filter((d) => d.status === "PAID");

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href="/finance" className="text-zinc-500 text-xs hover:text-white">← Finance</Link>
          <h1 className="text-2xl font-bold text-white mt-1">💳 Debts</h1>
          <p className="text-zinc-500 text-sm mt-1">Cash-planning tracker — no interest math, just real payments.</p>
        </div>
        <AddDebtButton />
      </div>

      {debts.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-500 text-sm">No debts recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active</h2>
              {active.map((d) => (
                <Link key={d.id} href={`/finance/debts/${d.id}`} className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-red-700/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{d.name}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{d.creditor}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white font-bold text-sm">{formatCurrency(d.remainingBalance, d.currency)}</p>
                      <p className="text-zinc-600 text-xs">of {formatCurrency(d.originalAmount, d.currency)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {paid.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Paid</h2>
              {paid.map((d) => (
                <Link key={d.id} href={`/finance/debts/${d.id}`} className="block bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-300 font-semibold text-sm">{d.name}</p>
                    <span className="text-emerald-400 text-xs font-bold">PAID</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
