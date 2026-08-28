import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { getPersonalTransactions, getPersonalBalanceSummary } from "@/modules/personal-finance/actions";
import { formatCurrency } from "@/utils/date";
import { RecordPersonalTransactionButton } from "./RecordPersonalTransactionButton";
import { ConvertPersonalCurrencyButton } from "./ConvertPersonalCurrencyButton";
import { PersonalTransactionsList } from "./PersonalTransactionsList";
import { ReconcileWithWisePanel } from "@/components/finance/ReconcileWithWisePanel";

export const dynamic = "force-dynamic";

// Sprint C1 §67: Personal Finance foundation. Strictly separate from
// Business Finance -- no shared table, no shared total anywhere. Owner Pay
// receipts arrive here automatically via the bridge in
// finance/actions.ts's recordOwnerPay; everything else is entered directly
// on this page.
export default async function PersonalFinancePage() {
  const [transactions, balances] = await Promise.all([
    getPersonalTransactions(),
    getPersonalBalanceSummary(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6">
        <Link href="/finance" className="text-zinc-500 text-xs hover:text-white">← Finance</Link>
        <h1 className="text-2xl font-bold text-white mt-1">👤 Personal Finance</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Separate from RMEDIA Cash. Owner Pay receipts arrive here automatically — never counted as personal income.
        </p>
      </div>

      {balances.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center mb-8">
          <p className="text-zinc-500 text-sm">
            No personal balance yet. Start by setting an Opening Balance for the currency you track personally (e.g. BRL).
          </p>
        </div>
      ) : (
        <div className="mb-8 space-y-4">
          {balances.map((b) => (
            <div key={b.currency}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">{b.currency}</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  label="Balance"
                  value={formatCurrency(b.balance, b.currency)}
                  accent={b.balance >= 0 ? "green" : "red"}
                  icon="💳"
                />
                <StatCard label="Opening" value={formatCurrency(b.openingBalance, b.currency)} icon="🏁" />
                <StatCard label="Owner Pay In" value={formatCurrency(b.ownerPayReceipts, b.currency)} accent="blue" icon="🏦" />
                <StatCard label="Expenses" value={formatCurrency(b.expenses, b.currency)} accent="red" icon="🧾" />
                {b.fxNet !== 0 && (
                  <StatCard
                    label="FX Net"
                    value={formatCurrency(b.fxNet, b.currency)}
                    accent={b.fxNet >= 0 ? "green" : "red"}
                    icon="💱"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <RecordPersonalTransactionButton kind="opening_balance" />
        <RecordPersonalTransactionButton kind="income" />
        <RecordPersonalTransactionButton kind="expense" />
        <ConvertPersonalCurrencyButton />
      </div>

      <div className="mb-8">
        <ReconcileWithWisePanel scope="PERSONAL" />
      </div>

      <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">Transactions</h2>
      <PersonalTransactionsList transactions={transactions} />
    </div>
  );
}
