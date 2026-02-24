import { StatCard } from "@/components/ui/StatCard";
import { getInvestmentSummary } from "@/modules/investments/actions";
import { formatCurrency } from "@/utils/date";
import { AddAssetButton } from "./AddAssetButton";
import { AssetActions } from "./AssetActions";

export default async function InvestmentsPage() {
  const summary = await getInvestmentSummary();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">📈 Investments</h1>
        <p className="text-zinc-500 text-sm mt-1">Crypto & asset portfolio tracker (manual)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Portfolio Value"
          value={formatCurrency(summary.totalValue)}
          accent="amber"
          icon="💼"
        />
        <StatCard
          label="Total Cost"
          value={formatCurrency(summary.totalCost)}
          accent="zinc"
          icon="💵"
        />
        <StatCard
          label="Total P&L"
          value={formatCurrency(summary.totalPnL)}
          sub={`${summary.pnlPercent > 0 ? "+" : ""}${summary.pnlPercent}%`}
          accent={summary.totalPnL >= 0 ? "green" : "red"}
          icon="📊"
        />
        <StatCard
          label="BTC Holdings"
          value={summary.btcHoldings !== null ? `${summary.btcHoldings} BTC` : "—"}
          sub={summary.btcValue !== null ? formatCurrency(summary.btcValue) : undefined}
          accent="amber"
          icon="₿"
        />
      </div>

      {/* Add Asset */}
      <div className="mb-8">
        <AddAssetButton />
      </div>

      {/* Assets Table */}
      <div>
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Assets ({summary.assets.length})
        </h2>
        {summary.assets.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-500 text-sm">No assets tracked yet. Add your first holding!</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Asset</th>
                  <th className="text-right text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-right text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Avg Buy</th>
                  <th className="text-right text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Current</th>
                  <th className="text-right text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Value</th>
                  <th className="text-right text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">P&L</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {summary.assets.map((asset, i) => {
                  const value = asset.amount * asset.currentPrice;
                  const cost = asset.amount * asset.avgBuyPrice;
                  const pnl = value - cost;
                  const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(1) : "0";

                  return (
                    <tr key={asset.id} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-800/20"}`}>
                      <td className="px-4 py-3">
                        <span className="text-white font-bold">{asset.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono">{asset.amount}</td>
                      <td className="px-4 py-3 text-right text-zinc-400 font-mono">{formatCurrency(asset.avgBuyPrice)}</td>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono">{formatCurrency(asset.currentPrice)}</td>
                      <td className="px-4 py-3 text-right text-amber-400 font-mono font-medium">{formatCurrency(value)}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                          <span className="text-xs ml-1 opacity-70">({pnl >= 0 ? "+" : ""}{pnlPct}%)</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AssetActions id={asset.id} asset={asset} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
