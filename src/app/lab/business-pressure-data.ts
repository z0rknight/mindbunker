import "server-only";
import { getFinanceHealth, getSubscriptionSummary, getDebts, getTaxReserveSettings, getFinanceSummary } from "@/modules/finance/actions";
import { listOpenCommitments } from "@/modules/commitments/data";

// Wave 4R: read-only Business Pressure facts. Reuses Finance's own trusted
// aggregations (getFinanceHealth etc.) -- no new financial calculation is
// introduced here, and nothing is combined across currencies.
export async function getBusinessPressureFacts() {
  const [health, subs, debts, taxReserve, summary, openCommitments] = await Promise.all([
    getFinanceHealth(),
    getSubscriptionSummary(),
    getDebts(),
    getTaxReserveSettings(),
    getFinanceSummary(),
    listOpenCommitments(),
  ]);
  const debtsDue = debts.filter((d) => d.remainingBalance > 0);
  return {
    cashReconciledStatus: health.status,
    cashReconciledReason: health.reason,
    reconciledPockets: health.reconciledPockets,
    expectedPockets: health.expectedPockets,
    activeSubscriptionCount: subs.upcomingRenewals.length,
    subscriptionMonthlyByCurrency: subs.byCurrency,
    debtsDueCount: debtsDue.length,
    debtsDueTotal: debtsDue.reduce((sum, d) => sum + d.remainingBalance, 0),
    taxReservePercent: taxReserve.taxReservePercent,
    monthlyRevenueByCurrency: summary,
    openCommitmentCount: openCommitments.length,
  };
}
