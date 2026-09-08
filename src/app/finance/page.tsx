import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { AddIncomeButton, AddExpenseButton } from "@/components/ui/QuickActions";
import {
  getFinanceOverview,
  getAllTransactions,
  getTaxReserveSettings,
  getRecentIncome,
  getReconciliationRequiringAttention,
  getDebts,
  getSubscriptionSummary,
  getFinanceHealth,
  getCommercialContracts,
  getUnattributedIncomeTransactions,
} from "@/modules/finance/actions";
import { getAmbiguousCashMovements } from "@/modules/cash-accounts/actions";
import { formatCurrency, formatDate, currentMonthKey, currentMonthName, todayISO } from "@/utils/date";
import {
  computeReservedByCurrency,
  computeUpcomingObligations,
  formatMinutesAsHours,
} from "@/modules/finance/core";
import { financeHealthSentence, getFinanceHealthActionItems } from "@/modules/finance/health";
import { DeleteTransactionButton } from "./DeleteTransactionButton";
import { EditTransactionButton } from "./EditTransactionButton";
import { CorrectOwnerPayButton } from "./CorrectOwnerPayButton";
import { RecordOwnerPayButton } from "./RecordOwnerPayButton";
import { TaxReserveControl } from "./TaxReserveControl";
import { getAllClients } from "@/modules/crm/actions";
import { getOperatingReserveSummary } from "@/modules/finance/actions";
import { OperatingReserveControl } from "./OperatingReserveControl";
import { getOwnerPayReceiptIdsByTransaction } from "@/modules/personal-finance/actions";
import { getFxRateForMonth } from "@/modules/fx/actions";
import { ReconcileWithWisePanel } from "@/components/finance/ReconcileWithWisePanel";
import { FinanceHealthPanel } from "@/components/finance/FinanceHealthPanel";
import { EconomicLedgerCard } from "@/components/finance/EconomicLedgerCard";
import { FinanceOverviewPanel, type NeedsYouItem } from "@/components/finance/FinanceOverviewPanel";
import { FinanceTabs } from "./FinanceTabs";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [
    financeOverview,
    transactions,
    taxReserveSettings,
    recentIncome,
    reconciliationAttention,
    allClients,
    operatingReserve,
    debts,
    subscriptionSummary,
    ownerPayReceiptIdsByTransaction,
    businessFx,
    financeHealth,
    commercialContracts,
    unattributedTransactions,
    ambiguousMovements,
  ] = await Promise.all([
    getFinanceOverview(),
    getAllTransactions(),
    getTaxReserveSettings(),
    getRecentIncome(8),
    getReconciliationRequiringAttention(),
    getAllClients(),
    getOperatingReserveSummary(),
    getDebts(),
    getSubscriptionSummary(),
    getOwnerPayReceiptIdsByTransaction(),
    getFxRateForMonth(currentMonthKey(), "BUSINESS"),
    getFinanceHealth(),
    getCommercialContracts(),
    getUnattributedIncomeTransactions(),
    getAmbiguousCashMovements(),
  ]);
  const { summary, ledgerPlanning: rmediaCash } = financeOverview;
  const activeDebts = debts.filter((d) => d.status === "ACTIVE");
  const remainingByCurrency = new Map<string, number>();
  for (const d of activeDebts) {
    remainingByCurrency.set(d.currency, (remainingByCurrency.get(d.currency) ?? 0) + d.remainingBalance);
  }
  const clientOptions = allClients.map((c) => ({ id: c.id, name: c.name }));
  const contractOptions = commercialContracts.map((contract) => ({
    id: contract.id,
    clientId: contract.clientId,
    label: `${contract.platform} · ${contract.billingType} · ${contract.status}`,
    currency: contract.currency,
  }));

  const recentTransactions = [...transactions].reverse().slice(0, 100);

  // Tuesday Patch Priority 4: Overview's three headline numbers, all
  // derived from facts already computed elsewhere on this page -- no new
  // arithmetic beyond the two small sums in modules/finance/core.ts.
  const today = todayISO();
  const availableByCurrency = rmediaCash.map((row) => ({ currency: row.currency, amount: row.availableLedgerNet }));
  const reservedByCurrency = computeReservedByCurrency(
    rmediaCash.map((row) => ({ currency: row.currency, amount: row.taxReserve })),
    operatingReserve,
  );
  const upcomingByCurrency = computeUpcomingObligations(subscriptionSummary.upcomingRenewals, today, 30);
  const monthByCurrency = summary.map((row) => ({
    currency: row.currency,
    received: row.monthlyRevenue,
    spent: row.monthlyExpenses,
    net: row.monthlyNet,
  }));

  // Completion Round §A/§B: "attribution" and "ambiguous-evidence" used to
  // render here as plain navigation links; they now resolve inline via
  // AttributionResolveList / AmbiguousTransferResolveList below (real
  // mutations on transactions.clientId / cash_movements.state), so they're
  // excluded from this generic link-based list to avoid showing the same
  // item twice. business/personal pocket issues, malformed FX, and
  // duplicate identities have no safe single-click resolution -- they stay
  // as links into Accounting details.
  const needsYou: NeedsYouItem[] = getFinanceHealthActionItems(financeHealth)
    .filter((item) => item.key !== "attribution" && item.key !== "ambiguous-evidence")
    .map((item) => ({
      key: item.key,
      label: item.label,
      href: item.href,
      actionLabel: "Fix",
    }));

  const reconciliationRows = reconciliationAttention.map((r) => ({
    contractId: r.contractId,
    clientName: r.clientName,
    platform: r.platform,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    differenceMinutesValue: r.differenceMinutes.value,
  }));

  // Client Portal Reality round §I: real FK links already present on every
  // transaction row (never inferred from category/name strings) -- just
  // rendered as dead text/not shown at all until now.
  function relatedLink(t: (typeof recentTransactions)[number]) {
    if (t.type === "owner_pay") {
      const receiptId = ownerPayReceiptIdsByTransaction.get(t.id);
      return receiptId ? (
        <Link href={`/finance/personal#personal-tx-${receiptId}`} className="text-indigo-400 hover:text-indigo-300">
          View personal receipt →
        </Link>
      ) : null;
    }
    if (t.debtId) {
      return (
        <Link href={`/finance/debts/${t.debtId}`} className="text-cyan-400 hover:text-cyan-300">
          View debt →
        </Link>
      );
    }
    if (t.subscriptionId) {
      return (
        <Link href={`/finance/subscriptions/${t.subscriptionId}`} className="text-cyan-400 hover:text-cyan-300">
          View subscription →
        </Link>
      );
    }
    if (t.contractId) {
      return (
        <Link href={`/finance/contracts/${t.contractId}`} className="text-cyan-400 hover:text-cyan-300">
          View contract →
        </Link>
      );
    }
    if (t.clientId) {
      return (
        <Link href={`/crm/${t.clientId}`} className="text-cyan-400 hover:text-cyan-300">
          View client →
        </Link>
      );
    }
    return null;
  }

  const transactionsPanel = (
    <>
      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Add Transaction</h2>
        <div className="grid max-w-2xl grid-cols-2 sm:grid-cols-3 gap-3">
          <AddIncomeButton clients={clientOptions} contracts={contractOptions} />
          <AddExpenseButton />
          <RecordOwnerPayButton />
        </div>
      </div>

      {/* Recent Income */}
      <div className="mb-8">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Recent Income
        </h2>
        {recentIncome.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-zinc-500 text-sm">No income recorded yet.</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">Category</th>
                  <th className="text-right text-zinc-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">Linked Evidence</th>
                </tr>
              </thead>
              <tbody>
                {recentIncome.map((t, i) => (
                  <tr key={t.id} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-800/20"}`}>
                    <td className="px-4 py-2.5 text-white">{formatDate(t.date)}</td>
                    <td className="px-4 py-2.5 text-zinc-300">{t.category}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-emerald-400">
                      +{formatCurrency(t.amount, t.currency)}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 text-xs">
                      {t.billingEvidenceId ? `#${t.billingEvidenceId}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div id="transactions">
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
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Related</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t, i) => (
                  <tr id={`tx-${t.id}`} key={t.id} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-800/20"}`}>
                    <td className="px-4 py-3 text-white">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.type === "income"
                          ? "bg-emerald-900/50 text-emerald-400"
                          : t.type === "owner_pay"
                          ? "bg-indigo-900/50 text-indigo-400"
                          : "bg-red-900/50 text-red-400"
                      }`}>
                        {t.type === "income" ? "Income" : t.type === "owner_pay" ? "Owner Pay" : "Expense"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{t.category}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${
                      t.type === "income" ? "text-emerald-400" : t.type === "owner_pay" ? "text-indigo-400" : "text-red-400"
                    }`}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount, t.currency)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{t.notes ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{relatedLink(t) ?? <span className="text-zinc-700">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {t.type === "owner_pay" ? (
                          <CorrectOwnerPayButton transaction={t} />
                        ) : (
                          <>
                            <EditTransactionButton transaction={t} />
                            <DeleteTransactionButton id={t.id} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  const accountingPanel = (
    <>
      <div className="mb-6">
        <FinanceHealthPanel health={financeHealth} />
      </div>

      <section className="mb-8" id="business-wise">
        <div className="mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Business cash · what Wise holds
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            Pocket-level custody comes before the economic ledger and planning overlays below.
          </p>
        </div>
        <ReconcileWithWisePanel scope="BUSINESS" />
      </section>

      {/* ── FINANCE COCKPIT: DEBTS + SUBSCRIPTIONS (Taryn August Ingest §4) ─
          Compact summary only -- full payment history / record-charge
          management stays on the dedicated pages this links to. Tax
          Reserve and Operating Reserve are the other two cockpit
          concerns; they already live as compact, directly-editable
          controls in the RMEDIA Cash section immediately below. */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-zinc-500 text-xs uppercase tracking-wider">💳 Debts</p>
            <Link href="/finance/debts" className="text-red-400 hover:text-red-300 text-xs font-semibold">
              View debts →
            </Link>
          </div>
          {activeDebts.length === 0 ? (
            <p className="text-zinc-600 text-sm">No active debts.</p>
          ) : (
            <>
              <p className="text-white font-bold text-lg">
                {activeDebts.length} active
              </p>
              <div className="mt-1 space-y-0.5">
                {[...remainingByCurrency.entries()].map(([currency, amount]) => (
                  <p key={currency} className="text-zinc-400 text-xs">
                    {formatCurrency(amount, currency)} remaining
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-zinc-500 text-xs uppercase tracking-wider">🔁 Subscriptions</p>
            <Link href="/finance/subscriptions" className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold">
              View subscriptions →
            </Link>
          </div>
          {subscriptionSummary.byCurrency.length === 0 ? (
            <p className="text-zinc-600 text-sm">No active subscriptions.</p>
          ) : (
            <div className="space-y-0.5">
              {subscriptionSummary.byCurrency.map((c) => (
                <p key={c.currency} className="text-white text-sm">
                  <span className="font-bold">{formatCurrency(c.monthlyEquivalent, c.currency)}</span>
                  <span className="text-zinc-500 text-xs"> /mo equivalent</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Economic ledger and Wise pockets are deliberately separate facts. */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">
            Business Economic Ledger
          </h2>
          <TaxReserveControl currentPercent={taxReserveSettings.taxReservePercent} />
        </div>
        <div className="mb-4">
          <OperatingReserveControl
            targetAmount={operatingReserve.targetAmount}
            reservedSoFar={operatingReserve.reservedSoFar}
            remainingToTarget={operatingReserve.remainingToTarget}
            currency={operatingReserve.currency}
          />
        </div>
        {rmediaCash.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-zinc-500 text-sm">No transactions yet — nothing to summarize.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rmediaCash.map((row) => (
              <div key={row.currency}>
                {rmediaCash.length > 1 && (
                  <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-2">
                    {row.currency}
                  </p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <EconomicLedgerCard
                    amount={row.economicLedgerNet}
                    currency={row.currency}
                  />
                  <StatCard
                    label="Tax Reserve"
                    value={formatCurrency(row.taxReserve, row.currency)}
                    sub="Experimental — not tax advice"
                    accent="amber"
                    icon="🧯"
                  />
                  <StatCard
                    label="Available Ledger Net"
                    value={formatCurrency(row.availableLedgerNet, row.currency)}
                    sub="Economic ledger net − Tax Reserve"
                    accent={row.availableLedgerNet >= 0 ? "green" : "red"}
                    icon="✅"
                  />
                  <StatCard
                    label="Owner Pay (all time)"
                    value={formatCurrency(row.totalOwnerPay, row.currency)}
                    sub="Not revenue, not an expense"
                    accent="violet"
                    icon="🏦"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RECONCILIATION REQUIRING ATTENTION ────────────────────────────── */}
      {reconciliationAttention.length > 0 && (
        <div className="mb-8">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            ⚠️ Reconciliation Requiring Attention
          </h2>
          <div className="space-y-2">
            {reconciliationAttention.map((r) => (
              <Link
                key={`${r.contractId}-${r.periodStart}-${r.periodEnd}`}
                href={`/finance/contracts/${r.contractId}`}
                className="block bg-zinc-900 border border-amber-900/40 rounded-xl p-4 hover:border-amber-700/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-semibold">
                    {r.clientName} — {r.platform}
                  </p>
                  <p className="text-amber-400 text-xs font-bold">
                    {r.differenceMinutes.value !== null
                      ? `${r.differenceMinutes.value >= 0 ? "+" : ""}${formatMinutesAsHours(
                          Math.abs(r.differenceMinutes.value),
                        )} mismatch`
                      : "—"}
                  </p>
                </div>
                <p className="text-zinc-500 text-xs mt-1">
                  {formatDate(r.periodStart)} – {formatDate(r.periodEnd)} · tracked{" "}
                  {formatMinutesAsHours(r.operationalMinutes.value)} · billed{" "}
                  {r.billedMinutes.value !== null ? formatMinutesAsHours(r.billedMinutes.value) : "—"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Currency ledgers stay separate. FX is context only, never a ledger mutation. */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Business Effective FX</p>
          <p className="mt-0.5 text-sm font-bold text-white">1 USD ≈ R${businessFx.rate.toFixed(4)}</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          {businessFx.source === "OBSERVED"
            ? `observed · ${businessFx.observedConversionCount}`
            : businessFx.source === "MANUAL"
              ? "manual"
              : "fallback"}
        </span>
      </div>
      <div className="mb-8 space-y-4">
        {summary.map((row) => (
          <div key={row.currency}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">{row.currency}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label="Monthly Revenue"
                value={formatCurrency(row.monthlyRevenue, row.currency)}
                sub={currentMonthName()}
                accent="green"
                icon="📈"
              />
              <StatCard
                label="Monthly Expenses"
                value={formatCurrency(row.monthlyExpenses, row.currency)}
                sub={currentMonthName()}
                accent="red"
                icon="📉"
              />
              <StatCard
                label="Net This Month"
                value={formatCurrency(row.monthlyNet, row.currency)}
                accent={row.monthlyNet >= 0 ? "green" : "red"}
                icon="⚖️"
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">💰 Finance</h1>
          <p className="text-zinc-500 text-sm mt-1">Your money, without the accounting.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/finance/contracts"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            🧾 Contracts & Billing Evidence
          </Link>
          <Link
            href="/finance/debts"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            💳 Debts
          </Link>
          <Link
            href="/finance/subscriptions"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            🔁 Subscriptions
          </Link>
          <Link
            href="/finance/fx"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            💱 FX Ledger
          </Link>
          <Link
            href="/finance/personal"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            👤 Personal
          </Link>
        </div>
      </div>

      <FinanceTabs
        overview={
          <FinanceOverviewPanel
            health={financeHealthSentence(financeHealth)}
            availableByCurrency={availableByCurrency}
            reservedByCurrency={reservedByCurrency}
            upcomingByCurrency={upcomingByCurrency}
            monthByCurrency={monthByCurrency}
            needsYou={needsYou}
            unattributedTransactions={unattributedTransactions}
            clientOptions={clientOptions}
            ambiguousMovements={ambiguousMovements}
            reconciliationRows={reconciliationRows}
            currentMonthLabel={currentMonthName()}
          />
        }
        transactions={transactionsPanel}
        accounting={accountingPanel}
      />
    </div>
  );
}
