import Link from "next/link";
import { formatCurrency } from "@/utils/date";
import type { FinanceHealthSentence } from "@/modules/finance/health";
import type { CurrencyAmount } from "@/modules/finance/core";
import type { UnattributedTransaction } from "@/modules/finance/actions";
import type { AmbiguousCashMovement } from "@/modules/cash-accounts/actions";
import {
  AmbiguousTransferResolveList,
  AttributionResolveList,
  ReconciliationAcknowledgeList,
  type ReconciliationAttentionRow,
} from "./NeedsYouResolvers";

// Tuesday Patch Priority 4 (brief §Finance): "Your money, without the
// accounting." The whole point of this panel is restraint -- at most
// three big numbers, one sentence for health, one line per currency for
// the month, and a short operational list. Everything else (Wise
// reconciliation, custody ledger, FX, billing evidence...) still exists,
// just one tab over, in Accounting details.

export type NeedsYouItem = {
  key: string;
  label: string;
  detail?: string;
  href: string;
  actionLabel: string;
};

export function FinanceOverviewPanel({
  health,
  reservedByCurrency,
  availableByCurrency,
  upcomingByCurrency,
  monthByCurrency,
  needsYou,
  unattributedTransactions,
  clientOptions,
  ambiguousMovements,
  reconciliationRows,
  currentMonthLabel,
}: {
  health: FinanceHealthSentence;
  reservedByCurrency: CurrencyAmount[];
  availableByCurrency: CurrencyAmount[];
  upcomingByCurrency: CurrencyAmount[];
  monthByCurrency: Array<{ currency: string; received: number; spent: number; net: number }>;
  needsYou: NeedsYouItem[];
  // Completion Round §A: these three render as real inline resolution
  // instead of navigation links -- see NeedsYouResolvers.tsx for the
  // canonical mutation each one calls.
  unattributedTransactions: UnattributedTransaction[];
  clientOptions: Array<{ id: number; name: string }>;
  ambiguousMovements: AmbiguousCashMovement[];
  reconciliationRows: ReconciliationAttentionRow[];
  currentMonthLabel: string;
}) {
  const totalNeedsYou =
    needsYou.length + unattributedTransactions.length + ambiguousMovements.length + reconciliationRows.length;
  const currencies = Array.from(
    new Set([
      ...availableByCurrency.map((r) => r.currency),
      ...reservedByCurrency.map((r) => r.currency),
      ...upcomingByCurrency.map((r) => r.currency),
    ]),
  );
  const byCurrency = <T extends { currency: string }>(rows: T[], currency: string) =>
    rows.find((r) => r.currency === currency);

  return (
    <div className="space-y-6">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 sm:p-5 ${
          health.emoji === "🟢"
            ? "border-emerald-900/60 bg-emerald-950/25"
            : health.emoji === "🟡"
              ? "border-amber-900/60 bg-amber-950/25"
              : "border-red-900/60 bg-red-950/25"
        }`}
      >
        <p className="text-base font-bold text-white">
          {health.emoji} {health.text}
        </p>
        {totalNeedsYou > 0 && (
          <a href="#needs-you" className="text-xs font-black uppercase tracking-wide text-zinc-300 hover:text-white">
            Review {totalNeedsYou} item{totalNeedsYou === 1 ? "" : "s"} →
          </a>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Your Money</h2>
        {currencies.length === 0 ? (
          <p className="text-sm text-zinc-600">No transactions yet — nothing to summarize.</p>
        ) : (
          <div className="space-y-4">
            {currencies.map((currency) => (
              <div key={currency}>
                {currencies.length > 1 && (
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">{currency}</p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MoneyCard
                    label="Available"
                    sub="safe to use"
                    value={formatCurrency(byCurrency(availableByCurrency, currency)?.amount ?? 0, currency)}
                    accent="emerald"
                  />
                  <MoneyCard
                    label="Reserved"
                    sub="taxes + reserves"
                    value={formatCurrency(byCurrency(reservedByCurrency, currency)?.amount ?? 0, currency)}
                    accent="amber"
                  />
                  <MoneyCard
                    label="Upcoming"
                    sub="next 30 days"
                    value={formatCurrency(byCurrency(upcomingByCurrency, currency)?.amount ?? 0, currency)}
                    accent="zinc"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">This Month</h2>
        {monthByCurrency.length === 0 ? (
          <p className="text-sm text-zinc-600">No activity in {currentMonthLabel} yet.</p>
        ) : (
          <div className="space-y-1">
            {monthByCurrency.map((row) => (
              <p key={row.currency} className="text-sm text-zinc-300">
                <span className="font-bold text-zinc-500">{currentMonthLabel}:</span>{" "}
                <span className="font-mono text-emerald-400">+{formatCurrency(row.received, row.currency)} received</span>
                {" · "}
                <span className="font-mono text-red-400">−{formatCurrency(row.spent, row.currency)} spent</span>
                {" = "}
                <span className={`font-mono font-bold ${row.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {row.net >= 0 ? "+" : ""}
                  {formatCurrency(row.net, row.currency)}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div id="needs-you">
        <h2 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
          Needs You {totalNeedsYou > 0 && `— ${totalNeedsYou}`}
        </h2>
        {totalNeedsYou === 0 ? (
          <p className="text-sm text-zinc-600">Nothing needs your attention right now.</p>
        ) : (
          <div className="space-y-2">
            <AttributionResolveList transactions={unattributedTransactions} clients={clientOptions} />
            <AmbiguousTransferResolveList movements={ambiguousMovements} />
            <ReconciliationAcknowledgeList rows={reconciliationRows} />
            {needsYou.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-900/40 bg-amber-950/10 px-4 py-3 text-sm hover:border-amber-700/60"
              >
                <div className="min-w-0">
                  <p className="font-bold text-white">{item.label}</p>
                  {item.detail && <p className="mt-0.5 text-xs text-zinc-500">{item.detail}</p>}
                </div>
                <span className="shrink-0 text-xs font-black text-amber-300">{item.actionLabel} →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MoneyCard({
  label,
  sub,
  value,
  accent,
}: {
  label: string;
  sub: string;
  value: string;
  accent: "emerald" | "amber" | "zinc";
}) {
  const accentClass =
    accent === "emerald"
      ? "border-emerald-600/30 bg-emerald-600/5 text-emerald-400"
      : accent === "amber"
        ? "border-amber-600/30 bg-amber-600/5 text-amber-400"
        : "border-zinc-700 bg-zinc-800/50 text-white";
  return (
    <div className={`rounded-xl border p-4 ${accentClass.split(" ").slice(0, 2).join(" ")}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass.split(" ")[2]}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}
