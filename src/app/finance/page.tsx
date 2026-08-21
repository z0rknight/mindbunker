import { StatCard } from "@/components/ui/StatCard";
import { AddIncomeButton, AddExpenseButton } from "@/components/ui/QuickActions";
import { getFinanceSummary, getAllTransactions } from "@/modules/finance/actions";
import { formatCurrency, formatDate, currentMonthName } from "@/utils/date";
import { DeleteTransactionButton } from "./DeleteTransactionButton";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [summary, transactions] = await Promise.all([
    getFinanceSummary(),
    getAllTransactions(),
  ]);

  const recentTransactions = [...transactions].reverse().slice(0, 100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">💰 Finance</h1>
        <p className="text-zinc-500 text-sm mt-1">Income & expense tracker</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Current Balance"
          value={formatCurrency(summary.currentBalance)}
          accent={summary.currentBalance >= 0 ? "green" : "red"}
          icon="💳"
        />
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(summary.monthlyRevenue)}
          sub={currentMonthName()}
          accent="green"
          icon="📈"
        />
        <StatCard
          label="Monthly Expenses"
          value={formatCurrency(summary.monthlyExpenses)}
          sub={currentMonthName()}
          accent="red"
          icon="📉"
        />
        <StatCard
          label="Net This Month"
          value={formatCurrency(summary.monthlyNet)}
          accent={summary.monthlyNet >= 0 ? "green" : "red"}
          icon="⚖️"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Add Transaction</h2>
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <AddIncomeButton />
          <AddExpenseButton />
        </div>
      </div>

      {/* Transactions Table */}
      <div>
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Transactions ({transactions.length} total)
        </h2>
        {recentTransactions.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-500 text-sm">No transactions yet. Add your first income or expense!</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Category</th>
                  <th className="text-right text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t, i) => (
                  <tr key={t.id} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-800/20"}`}>
                    <td className="px-4 py-3 text-white">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.type === "income"
                          ? "bg-emerald-900/50 text-emerald-400"
                          : "bg-red-900/50 text-red-400"
                      }`}>
                        {t.type === "income" ? "Income" : "Expense"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{t.category}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${
                      t.type === "income" ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{t.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <DeleteTransactionButton id={t.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
