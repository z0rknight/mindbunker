import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import {
  getPersonalTransactions,
  getPersonalBalanceSummary,
  getPersonalFlowSummary,
} from "@/modules/personal-finance/actions";
import { currentMonthKey, currentMonthName, formatCurrency } from "@/utils/date";
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
  const month = currentMonthKey();
  const [transactions, balances, flow] = await Promise.all([
    getPersonalTransactions(),
    getPersonalBalanceSummary(),
    getPersonalFlowSummary(month),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6">
        <Link href="/finance" className="text-zinc-500 text-xs hover:text-white">← Finance</Link>
        <h1 className="text-2xl font-bold text-white mt-1">👤 Personal Finance</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Separate from RMEDIA Cash. Owner Pay receipts arrive here automatically — never counted as personal income.
        </p>
      </div>

      <section className="mb-8" id="personal-wise">
        <div className="mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Wise cash · what exists now
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            Pocket-level custody evidence. This is the source for “how much money do I actually have?”
          </p>
        </div>
        <ReconcileWithWisePanel scope="PERSONAL" />
      </section>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {balances.length === 0 && <RecordPersonalTransactionButton kind="opening_balance" />}
        <RecordPersonalTransactionButton kind="income" />
        <RecordPersonalTransactionButton kind="expense" />
        <ConvertPersonalCurrencyButton />
      </div>

      <section className="mb-8">
        <div className="mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            {currentMonthName()} flow
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            Period activity only. Opening balances stay out; FX moves currency but never becomes income or expense.
          </p>
        </div>
        {flow.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-600">
            No personal activity recorded for {currentMonthName()}.
          </div>
        ) : (
          <div className="space-y-4">
            {flow.map((row) => (
              <div key={row.currency}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  {row.currency}
                </p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <StatCard
                    label="Net flow"
                    value={formatCurrency(row.netFlow, row.currency)}
                    accent={row.netFlow >= 0 ? "green" : "red"}
                    sub={currentMonthName()}
                    icon="↕"
                  />
                  <StatCard label="Owner Pay in" value={formatCurrency(row.ownerPayIn, row.currency)} accent="blue" icon="🏦" />
                  <StatCard label="External income" value={formatCurrency(row.externalIncome, row.currency)} accent="green" icon="💵" />
                  <StatCard label="Expenses" value={formatCurrency(row.expenses, row.currency)} accent="red" icon="🧾" />
                  <StatCard label="FX impact" value={formatCurrency(row.fxNet, row.currency)} icon="💱" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Recorded economic history
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-600">
          This ledger groups the personal facts recorded in MindBunker by currency across Main and Dolarize.
          It is not pocket-aware and historical coverage is incomplete, so it is not expected to equal Wise cash.
          Use the Wise section above for actual cash and this section to explain recorded Owner Pay, spending and FX.
        </p>

      {balances.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center mb-8">
          <p className="text-zinc-500 text-sm">
            No personal balance yet. Start by setting an Opening Balance for the currency you track personally (e.g. BRL).
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {balances.map((b) => (
            <div key={b.currency}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">{b.currency}</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  label="Recorded ledger net"
                  value={formatCurrency(b.balance, b.currency)}
                  accent={b.balance >= 0 ? "green" : "red"}
                  icon="💳"
                  sub="All time · all pockets in this currency"
                />
                <StatCard label="Opening" value={formatCurrency(b.openingBalance, b.currency)} icon="🏁" />
                <StatCard label="Owner Pay In" value={formatCurrency(b.ownerPayReceipts, b.currency)} accent="blue" icon="🏦" />
                <StatCard label="Expenses (all time)" value={formatCurrency(b.expenses, b.currency)} accent="red" icon="🧾" />
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
      </section>

      <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">Transactions</h2>
      <PersonalTransactionsList transactions={transactions} />
    </div>
  );
}
