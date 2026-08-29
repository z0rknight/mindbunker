import type { PerformanceStats } from "@/utils/statistics";
import { formatCurrency } from "@/utils/date";

interface PerformanceStatsProps {
  stats: PerformanceStats;
}

// ─── TREND INDICATOR ─────────────────────────────────────────────────────────

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-zinc-600 text-xs">—</span>;
  const isPositive = pct >= 0;
  return (
    <span
      className={`text-xs font-semibold flex items-center gap-0.5 ${
        isPositive ? "text-emerald-400" : "text-red-400"
      }`}
    >
      {isPositive ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

// ─── STAT TILE ────────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string | number | null;
  sub?: string;
  trend?: number | null;
  accent?: "gold" | "violet" | "cyan" | "emerald" | "rose" | "zinc";
  icon?: string;
  large?: boolean;
}

const tileAccentMap: Record<string, string> = {
  gold: "border-yellow-500/40 bg-yellow-500/5 shadow-yellow-500/10",
  violet: "border-violet-500/40 bg-violet-500/5 shadow-violet-500/10",
  cyan: "border-cyan-500/40 bg-cyan-500/5 shadow-cyan-500/10",
  emerald: "border-emerald-500/40 bg-emerald-500/5 shadow-emerald-500/10",
  rose: "border-rose-500/40 bg-rose-500/5 shadow-rose-500/10",
  zinc: "border-zinc-700 bg-zinc-800/50",
};

const tileValueMap: Record<string, string> = {
  gold: "text-yellow-300",
  violet: "text-violet-300",
  cyan: "text-cyan-300",
  emerald: "text-emerald-300",
  rose: "text-rose-300",
  zinc: "text-white",
};

function StatTile({
  label,
  value,
  sub,
  trend,
  accent = "zinc",
  icon,
  large = false,
}: StatTileProps) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-lg ${tileAccentMap[accent]} transition-all duration-200 hover:scale-[1.02]`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider leading-tight">
          {label}
        </p>
        {icon && <span className="text-base opacity-80">{icon}</span>}
      </div>
      <p
        className={`font-bold ${tileValueMap[accent]} ${large ? "text-3xl" : "text-2xl"}`}
      >
        {value === null || value === undefined ? "—" : value}
      </p>
      <div className="flex items-center gap-2 mt-1">
        {sub && <p className="text-zinc-500 text-xs">{sub}</p>}
        {trend !== undefined && <Trend pct={trend} />}
      </div>
    </div>
  );
}

// ─── SCORE BAR ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  // Videos (100 max) + closed-session streak (50 max), less revision drag.
  const maxScore = 150;
  const pct = Math.min(Math.round((score / maxScore) * 100), 100);

  const color =
    pct >= 70
      ? "from-yellow-400 to-amber-500"
      : pct >= 40
        ? "from-violet-400 to-purple-500"
        : "from-zinc-500 to-zinc-600";

  const label =
    pct >= 80
      ? "🏆 Elite"
      : pct >= 60
        ? "🔥 On Fire"
        : pct >= 40
          ? "⚡ Building"
          : pct >= 20
            ? "🌱 Starting"
            : "💤 Dormant";

  return (
    <div className="mt-3">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
          Score Level
        </span>
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-zinc-600 text-xs mt-1">{score} pts</p>
    </div>
  );
}

// ─── STREAK DISPLAY ───────────────────────────────────────────────────────────

function StreakDisplay({ streak }: { streak: number }) {
  const flames =
    streak >= 14
      ? "🔥🔥🔥"
      : streak >= 7
        ? "🔥🔥"
        : streak >= 3
          ? "🔥"
          : streak >= 1
            ? "✨"
            : "💤";

  return (
    <div className="rounded-xl border border-orange-500/40 bg-orange-500/5 shadow-lg shadow-orange-500/10 p-4 transition-all duration-200 hover:scale-[1.02]">
      <div className="flex items-start justify-between mb-2">
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
          Consistency Streak
        </p>
        <span className="text-base">{flames}</span>
      </div>
      <p className="text-3xl font-bold text-orange-300">
        {streak}{" "}
        <span className="text-lg font-normal text-orange-400/70">
          {streak === 1 ? "day" : "days"}
        </span>
      </p>
      <p className="text-zinc-500 text-xs mt-1">
        {streak === 0
          ? "Close a Work Session today to start your streak"
          : streak < 3
            ? "Keep going — momentum builds here"
            : streak < 7
              ? "Nice consistency — don't break it"
              : streak < 14
                ? "One week+ — you're in the zone"
                : "Legendary streak — protect it"}
      </p>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function PerformanceStatsSection({ stats }: PerformanceStatsProps) {
  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">
          💎 Performance Stats
        </h2>
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-zinc-600 text-xs">Derived metrics</span>
      </div>

      {/* Productivity Score — Hero Card */}
      <div className="rounded-xl border border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 to-amber-600/5 shadow-lg shadow-yellow-500/10 p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">
              🎖 Productivity Score
            </p>
            <p className="text-5xl font-black text-yellow-300 tracking-tight">
              {stats.productivityScore}
            </p>
            <p className="text-zinc-500 text-xs mt-1">
              Videos + Work-session streak − Revision penalty
            </p>
          </div>
          <div className="text-right">
            <p className="text-zinc-500 text-xs mb-1">This Month</p>
            <div className="flex flex-col gap-1 items-end">
              {stats.revenueGrowthPct !== null && (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 text-xs">{stats.revenueGrowthCurrency} revenue</span>
                  <Trend pct={stats.revenueGrowthPct} />
                </div>
              )}
              {stats.videosGrowthPct !== null && (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 text-xs">Output</span>
                  <Trend pct={stats.videosGrowthPct} />
                </div>
              )}
            </div>
          </div>
        </div>
        <ScoreBar score={stats.productivityScore} />
      </div>

      {/* Streak */}
      <div className="mb-4">
        <StreakDisplay streak={stats.consistencyStreak} />
      </div>

      {stats.revenueThisMonthByCurrency.length > 0 && (
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Revenue this month · separate currencies
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {stats.revenueThisMonthByCurrency.map((row) => (
              <span key={row.currency} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white">
                {formatCurrency(row.amount, row.currency)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Derived Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile
          label="Revenue / Video"
          value={
            stats.revenuePerVideo !== null
              ? formatCurrency(stats.revenuePerVideo, stats.revenueCurrency)
              : null
          }
          sub={`${stats.revenueCurrency} only · this month`}
          trend={stats.revenueGrowthPct}
          accent="emerald"
          icon="💰"
        />
        <StatTile
          label="Avg Revisions / Video"
          value={stats.avgRevisionsPerVideo}
          sub={
            stats.avgRevisionsPerVideo !== null
              ? stats.avgRevisionsPerVideo > 2
                ? "⚠️ High friction"
                : "✅ Clean delivery"
              : undefined
          }
          accent={
            stats.avgRevisionsPerVideo !== null && stats.avgRevisionsPerVideo > 2
              ? "rose"
              : "cyan"
          }
          icon="🔄"
        />
        <StatTile
          label="Videos / Active Client"
          value={stats.videosPerActiveClient}
          sub="This month"
          accent="violet"
          icon="🎬"
        />
        <StatTile
          label="Revenue Growth"
          value={
            stats.revenueGrowthPct !== null
              ? `${stats.revenueGrowthPct > 0 ? "+" : ""}${stats.revenueGrowthPct}%`
              : null
          }
          sub={`${stats.revenueGrowthCurrency} vs last month`}
          accent={
            stats.revenueGrowthPct !== null && stats.revenueGrowthPct >= 0
              ? "emerald"
              : "rose"
          }
          icon="📈"
        />
        <StatTile
          label="Output Growth"
          value={
            stats.videosGrowthPct !== null
              ? `${stats.videosGrowthPct > 0 ? "+" : ""}${stats.videosGrowthPct}%`
              : null
          }
          sub="vs last month"
          accent={
            stats.videosGrowthPct !== null && stats.videosGrowthPct >= 0
              ? "emerald"
              : "rose"
          }
          icon="🎬"
        />
        <StatTile
          label="Caffeine / Video"
          value={
            stats.caffeinePerVideo !== null
              ? `${stats.caffeinePerVideo}mg`
              : null
          }
          sub="This month"
          accent="gold"
          icon="☕"
        />
      </div>
    </div>
  );
}
