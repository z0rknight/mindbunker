import { StatCard } from "@/components/ui/StatCard";
import {
  FinishedVideoButton,
  AddIncomeButton,
  AddExpenseButton,
  LogTodayButton,
} from "@/components/ui/QuickActions";
import { getFinanceSummary } from "@/modules/finance/actions";
import { getVideoStats } from "@/modules/productivity/actions";
import { getHealthSummary } from "@/modules/health/actions";
import { getCRMSummary } from "@/modules/crm/actions";
import { getInvestmentSummary } from "@/modules/investments/actions";
import { formatCurrency, currentMonthName } from "@/utils/date";

export default async function DashboardPage() {
  const [finance, video, health, crm, investments] = await Promise.all([
    getFinanceSummary(),
    getVideoStats(),
    getHealthSummary(),
    getCRMSummary(),
    getInvestmentSummary(),
  ]);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-zinc-500 text-sm">{greeting} 👋</p>
        <h1 className="text-2xl font-bold text-white mt-1">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">{currentMonthName()} {now.getFullYear()}</p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FinishedVideoButton />
          <AddIncomeButton />
          <AddExpenseButton />
          <LogTodayButton />
        </div>
      </div>

      {/* Finance Section */}
      <div className="mb-6">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">💰 Finance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Current Balance"
            value={formatCurrency(finance.currentBalance)}
            accent={finance.currentBalance >= 0 ? "green" : "red"}
            icon="💳"
          />
          <StatCard
            label="Monthly Revenue"
            value={formatCurrency(finance.monthlyRevenue)}
            sub={currentMonthName()}
            accent="green"
            icon="📈"
          />
          <StatCard
            label="Monthly Expenses"
            value={formatCurrency(finance.monthlyExpenses)}
            sub={currentMonthName()}
            accent="red"
            icon="📉"
          />
          <StatCard
            label="Net This Month"
            value={formatCurrency(finance.monthlyNet)}
            accent={finance.monthlyNet >= 0 ? "green" : "red"}
            icon="⚖️"
          />
        </div>
      </div>

      {/* Investments Section */}
      <div className="mb-6">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">📈 Investments</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="BTC Holdings"
            value={investments.btcHoldings !== null ? `${investments.btcHoldings} BTC` : "—"}
            sub={investments.btcValue !== null ? formatCurrency(investments.btcValue) : undefined}
            accent="amber"
            icon="₿"
          />
          <StatCard
            label="Portfolio Value"
            value={formatCurrency(investments.totalValue)}
            accent="amber"
            icon="💼"
          />
          <StatCard
            label="Total P&L"
            value={formatCurrency(investments.totalPnL)}
            sub={`${investments.pnlPercent > 0 ? "+" : ""}${investments.pnlPercent}%`}
            accent={investments.totalPnL >= 0 ? "green" : "red"}
            icon="📊"
          />
          <StatCard
            label="Assets Tracked"
            value={investments.assets.length}
            accent="zinc"
            icon="🪙"
          />
        </div>
      </div>

      {/* Productivity Section */}
      <div className="mb-6">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">🎬 Productivity</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Videos Today"
            value={video.today}
            accent="violet"
            icon="🎬"
          />
          <StatCard
            label="Videos This Week"
            value={video.week}
            accent="violet"
            icon="📅"
          />
          <StatCard
            label="Videos This Month"
            value={video.month}
            sub={currentMonthName()}
            accent="violet"
            icon="🗓️"
          />
          <StatCard
            label="Total Revisions"
            value={video.totalRevisions}
            accent="zinc"
            icon="🔄"
          />
        </div>
      </div>

      {/* CRM Section */}
      <div className="mb-6">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">👥 CRM</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Active Clients"
            value={crm.activeClientsCount}
            accent="blue"
            icon="✅"
          />
          <StatCard
            label="Leads This Month"
            value={crm.leadsThisMonth}
            sub={currentMonthName()}
            accent="blue"
            icon="🎯"
          />
          <StatCard
            label="Total Contacts"
            value={crm.totalClients}
            accent="zinc"
            icon="📋"
          />
        </div>
      </div>

      {/* Health Section */}
      <div className="mb-6">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">🫀 Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Avg Sleep (7d)"
            value={health.avgSleep7Days !== null ? `${health.avgSleep7Days}h` : "—"}
            accent="blue"
            icon="😴"
          />
          <StatCard
            label="Caffeine Today"
            value={health.caffeineToday !== null ? `${health.caffeineToday}mg` : "—"}
            accent="amber"
            icon="☕"
          />
          <StatCard
            label="Screen Time Today"
            value={health.screenTimeToday !== null ? `${health.screenTimeToday}h` : "—"}
            accent="zinc"
            icon="🖥️"
          />
        </div>
      </div>
    </div>
  );
}
