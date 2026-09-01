import { EvidenceDrawer } from "./EvidenceDrawer";
import type { getBusinessPressureFacts } from "./business-pressure-data";

type Facts = Awaited<ReturnType<typeof getBusinessPressureFacts>>;

// Wave 4R: Business/Finance Pressure read-model. Pure facts, no scores --
// reuses Finance Health / Subscriptions / Debts / Tax Reserve verbatim,
// no new calculation is introduced here.
export function BusinessPressurePanel({ facts }: { facts: Facts }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Business Pressure</p>
      <ul className="text-xs text-zinc-300 space-y-1.5">
        <li>Cash reconciliation: <span className={facts.cashReconciledStatus === "GREEN" ? "text-emerald-400" : "text-amber-400"}>{facts.cashReconciledStatus}</span> — {facts.cashReconciledReason} ({facts.reconciledPockets}/{facts.expectedPockets} pockets)</li>
        <li>Subscriptions due (upcoming): {facts.activeSubscriptionCount}
          {facts.subscriptionMonthlyByCurrency.length > 0 && (
            <span className="text-zinc-500"> — {facts.subscriptionMonthlyByCurrency.map((s) => `${s.currency} ${s.monthlyRecurring}`).join(", ")}/mo</span>
          )}
        </li>
        <li>Debts due: {facts.debtsDueCount} (remaining balance {facts.debtsDueTotal.toLocaleString()})</li>
        <li>Tax reserve target: {facts.taxReservePercent !== null ? `${facts.taxReservePercent}%` : "not set"}</li>
        <li>Open commitments (all owners): {facts.openCommitmentCount}</li>
      </ul>
      <EvidenceDrawer
        label="business pressure"
        sources={[
          "FACT: reuses getFinanceHealth/getSubscriptionSummary/getDebts/getTaxReserveSettings unchanged",
          "No currencies combined -- subscriptions/revenue stay per-currency",
          "No composite pressure score -- each number stands alone",
        ]}
      />
    </div>
  );
}
