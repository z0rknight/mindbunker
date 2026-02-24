import { getWarRoomData } from "@/modules/analytics/service";
import { formatCurrency } from "@/utils/date";

export const dynamic = "force-dynamic";

export default async function WarRoomPage() {
  const data = await getWarRoomData();
  const { income, efficiency, biological, momentum, leverage } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">💎</span>
            <h1 className="text-3xl font-black text-white tracking-tight">WAR ROOM</h1>
          </div>
          <p className="text-zinc-500 text-sm">
            Strategic Performance Intelligence · No vanity metrics · Brutal clarity
          </p>
        </div>
        <div className="text-right">
          <p className="text-zinc-600 text-xs">Last updated</p>
          <p className="text-zinc-400 text-xs font-mono">
            {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* ── CRASH DETECTOR BANNER ──────────────────────────────────────────── */}
      {biological.crashReason && (
        <div
          className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${
            biological.crashDetected
              ? "bg-red-950/60 border-red-700 animate-pulse"
              : "bg-amber-950/40 border-amber-700/60"
          }`}
        >
          <span className="text-2xl mt-0.5">{biological.crashDetected ? "🚨" : "⚠️"}</span>
          <div>
            <p
              className={`font-bold text-sm ${
                biological.crashDetected ? "text-red-400" : "text-amber-400"
              }`}
            >
              {biological.crashDetected
                ? "SYSTEM CRASH IMMINENT — REST REQUIRED"
                : "BURNOUT RISK RISING — MONITOR CLOSELY"}
            </p>
            <p className="text-zinc-400 text-xs mt-0.5">{biological.crashReason}</p>
          </div>
        </div>
      )}

      {/* ── LAYER 1: INCOME INTELLIGENCE ──────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="I. INCOME INTELLIGENCE" icon="💰" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Revenue Goal Progress */}
          <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">
                R$20k Trajectory
              </p>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  income.onTrack
                    ? "bg-cyan-900/50 text-cyan-400 border border-cyan-700/50"
                    : "bg-red-900/50 text-red-400 border border-red-700/50"
                }`}
              >
                {income.onTrack ? "ON TRACK" : "BEHIND PACE"}
              </span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-3xl font-black text-white">
                {formatCurrency(income.monthlyRevenue)}
              </span>
              <span className="text-zinc-500 text-sm mb-1">
                / {formatCurrency(income.revenueGoal)}
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-700 ease-out ${
                  income.onTrack
                    ? "bg-gradient-to-r from-cyan-600 to-cyan-400"
                    : "bg-gradient-to-r from-red-700 to-red-500"
                }`}
                style={{ width: `${income.revenueGoalPct}%` }}
              />
            </div>
            <p
              className={`text-sm font-bold mt-2 ${
                income.onTrack ? "text-cyan-400" : "text-red-400"
              }`}
            >
              {income.revenueGoalPct}% Complete
            </p>
          </div>

          {/* Yield Metrics */}
          <div className="flex flex-col gap-4">
            <MetricCard
              label="Effective Flat-Rate Yield"
              sublabel="LEVERAGE METRIC"
              value={
                income.effectiveFlatRateYield
                  ? formatCurrency(income.effectiveFlatRateYield) + "/video"
                  : "—"
              }
              accent="cyan"
              icon="⚡"
            />
            <MetricCard
              label="All-Time Revenue/Video"
              sublabel="Whale Model"
              value={
                income.revenuePerVideoAllTime
                  ? formatCurrency(income.revenuePerVideoAllTime)
                  : "—"
              }
              accent="zinc"
              icon="🐋"
            />
          </div>
        </div>

        {/* Top Clients */}
        {income.topClientsByRevenue.length > 0 && (
          <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
              Top Clients by Revenue
            </p>
            <div className="space-y-2">
              {income.topClientsByRevenue.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-zinc-600 text-xs w-4 font-mono">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium">{c.name}</span>
                      <span className="text-cyan-400 text-sm font-bold">
                        {formatCurrency(c.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-zinc-500 text-xs">{c.projects} projects</span>
                      {c.effectiveYield && (
                        <span className="text-zinc-400 text-xs">
                          · {formatCurrency(c.effectiveYield)}/project
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── LAYER 2: EFFICIENCY & FRICTION ────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="II. EFFICIENCY & FRICTION" icon="⚙️" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Revision Drag Index */}
          <div
            className={`bg-zinc-900 border rounded-xl p-4 ${
              efficiency.revisionDragTier === "elite"
                ? "border-cyan-700/50"
                : efficiency.revisionDragTier === "normal"
                ? "border-zinc-700"
                : "border-red-700/60"
            }`}
          >
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
              Revision Drag Index
            </p>
            <p
              className={`text-2xl font-black ${
                efficiency.revisionDragTier === "elite"
                  ? "text-cyan-400"
                  : efficiency.revisionDragTier === "normal"
                  ? "text-amber-400"
                  : "text-red-400"
              }`}
            >
              {efficiency.revisionDragIndex !== null
                ? efficiency.revisionDragIndex.toFixed(2)
                : "—"}
            </p>
            <p
              className={`text-xs font-bold mt-1 uppercase ${
                efficiency.revisionDragTier === "elite"
                  ? "text-cyan-500"
                  : efficiency.revisionDragTier === "normal"
                  ? "text-amber-500"
                  : "text-red-500"
              }`}
            >
              {efficiency.revisionDragTier === "elite"
                ? "⚡ Elite"
                : efficiency.revisionDragTier === "normal"
                ? "⚠ Normal"
                : "🔴 Friction"}
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              &lt;0.5 Elite · 0.5–1.2 Normal · &gt;1.2 Friction
            </p>
          </div>

          <MetricCard
            label="Videos This Month"
            value={efficiency.videosThisMonth}
            accent="violet"
            icon="🎬"
          />
          <MetricCard
            label="Revenue / Video"
            value={
              efficiency.revenuePerVideo
                ? formatCurrency(efficiency.revenuePerVideo)
                : "—"
            }
            accent="cyan"
            icon="💵"
          />
          <MetricCard
            label="Videos / Active Client"
            value={efficiency.videosPerActiveClient ?? "—"}
            sublabel={`${efficiency.activeClientCount} active clients`}
            accent="zinc"
            icon="👥"
          />
        </div>

        {/* Client Drain Ranking */}
        {efficiency.clientDrainRanking.length > 0 && (
          <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-1">
              Client Drain Ranking
            </p>
            <p className="text-zinc-600 text-xs mb-3">
              Sorted by lowest effective yield — these clients cost you the most per R$ earned
            </p>
            <div className="space-y-2">
              {efficiency.clientDrainRanking.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span
                    className={`text-xs w-4 font-mono font-bold ${
                      i === 0 ? "text-red-400" : i === 1 ? "text-amber-400" : "text-zinc-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-white text-sm">{c.name}</span>
                    <span
                      className={`text-sm font-bold ${
                        c.effectiveYield === null
                          ? "text-zinc-500"
                          : c.effectiveYield < 500
                          ? "text-red-400"
                          : c.effectiveYield < 1500
                          ? "text-amber-400"
                          : "text-cyan-400"
                      }`}
                    >
                      {c.effectiveYield ? formatCurrency(c.effectiveYield) + "/proj" : "No data"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── LAYER 3: BIOLOGICAL CORRELATION ───────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="III. BIOLOGICAL CORRELATION" icon="🧬" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Output vs Sleep */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
              Output vs Sleep Architecture
            </p>
            <div className="space-y-3">
              <SleepCorrelationRow
                label="Good Sleep (≥7h)"
                value={biological.avgVideosGoodSleep}
                color="cyan"
              />
              <SleepCorrelationRow
                label="Crash Nights (<5h)"
                value={biological.avgVideosCrashSleep}
                color="red"
              />
              <SleepCorrelationRow
                label="Vampire Nights (<4h)"
                value={biological.avgVideosVampireNights}
                color="amber"
              />
            </div>
            <p className="text-zinc-600 text-xs mt-3">Avg videos delivered per day type</p>
          </div>

          {/* Caffeine Metrics */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
              Caffeine Intelligence
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Total Caffeine This Month</p>
                <p className="text-2xl font-black text-amber-400">
                  {biological.totalCaffeineMonth}
                  <span className="text-sm font-normal text-zinc-500 ml-1">mg</span>
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Caffeine / Revenue Ratio</p>
                <p
                  className={`text-xl font-bold ${
                    biological.caffeinePerRevenue === null
                      ? "text-zinc-500"
                      : biological.caffeinePerRevenue > 5
                      ? "text-red-400"
                      : "text-cyan-400"
                  }`}
                >
                  {biological.caffeinePerRevenue !== null
                    ? `${biological.caffeinePerRevenue} mg/R$`
                    : "—"}
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  {biological.caffeinePerRevenue !== null && biological.caffeinePerRevenue > 5
                    ? "⚠ High caffeine relative to revenue"
                    : "Ratio within range"}
                </p>
              </div>
            </div>
          </div>

          {/* Physical Activity */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
              Physical Recovery
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Cycling (7d avg)</p>
                <p className="text-2xl font-black text-cyan-400">
                  {biological.avgCyclingKm7d !== null
                    ? `${biological.avgCyclingKm7d} km/day`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Walking (7d avg)</p>
                <p className="text-xl font-bold text-cyan-300">
                  {biological.avgWalkingMin7d !== null
                    ? `${biological.avgWalkingMin7d} min/day`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Activity Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-cyan-700 to-cyan-400 transition-all duration-700"
                      style={{ width: `${(biological.physicalActivityScore / 50) * 100}%` }}
                    />
                  </div>
                  <span className="text-cyan-400 text-xs font-bold">
                    {biological.physicalActivityScore}/50
                  </span>
                </div>
                <p className="text-zinc-600 text-xs mt-1">Reduces crash penalty</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LAYER 4: MOMENTUM & TRAJECTORY ───────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="IV. MOMENTUM & TRAJECTORY" icon="🔥" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Revenue Streak</p>
            <p className="text-3xl font-black text-orange-400">
              {momentum.revenueStreak}
              <span className="text-sm font-normal text-zinc-500 ml-1">days</span>
            </p>
            <p className="text-zinc-600 text-xs mt-1">Consecutive billable days</p>
          </div>

          <TrendCard
            label="Revenue Trend"
            value={
              momentum.revenueGrowthPct !== null
                ? `${momentum.revenueGrowthPct > 0 ? "+" : ""}${momentum.revenueGrowthPct}%`
                : "—"
            }
            trend={momentum.revenueTrend}
            sublabel="vs last month"
          />

          <TrendCard
            label="Output Trend"
            value={
              momentum.outputGrowthPct !== null
                ? `${momentum.outputGrowthPct > 0 ? "+" : ""}${momentum.outputGrowthPct}%`
                : "—"
            }
            trend={momentum.outputTrend}
            sublabel="videos vs last month"
          />

          <MetricCard
            label="Consistency Streak"
            value={`${momentum.consistencyStreak}d`}
            sublabel="Any log activity"
            accent="violet"
            icon="📅"
          />
        </div>
      </section>

      {/* ── LAYER 5: LEVERAGE SCORE ────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="V. THE LEVERAGE SCORE" icon="💎" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Main Score */}
          <div className="md:col-span-2 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-cyan-900/50 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-1">
                  Leverage Score
                </p>
                <div className="flex items-end gap-3">
                  <span className="text-6xl font-black text-white transition-all duration-700">
                    {leverage.score}
                  </span>
                  <span className="text-zinc-500 text-sm mb-2">XP</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-zinc-500 text-xs uppercase tracking-wider">Level</p>
                <p className="text-4xl font-black text-cyan-400">{leverage.level}</p>
              </div>
            </div>

            <div className="mb-3">
              <p className="text-cyan-400 font-bold text-lg">{leverage.levelTitle}</p>
              <p className="text-zinc-500 text-xs">
                {leverage.xpToNextLevel > 0
                  ? `${leverage.xpToNextLevel} XP to Level ${leverage.level + 1}`
                  : "MAX LEVEL ACHIEVED"}
              </p>
            </div>

            {/* XP Progress Bar */}
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-cyan-700 to-cyan-400 transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(
                    ((leverage.levelMaxXp - leverage.xpToNextLevel) / leverage.levelMaxXp) * 100,
                    100
                  )}%`,
                }}
              />
            </div>

            {/* Level Ladder */}
            <div className="mt-4 flex gap-1 flex-wrap">
              {["Rookie", "Operator", "Grinder", "Specialist", "Tactician", "Strategist", "Enforcer", "Weaponized", "Apex", "Elite"].map(
                (title, i) => (
                  <span
                    key={title}
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      i + 1 === leverage.level
                        ? "bg-cyan-900/50 border-cyan-600 text-cyan-300 font-bold"
                        : i + 1 < leverage.level
                        ? "bg-zinc-800 border-zinc-700 text-zinc-400"
                        : "border-zinc-800 text-zinc-700"
                    }`}
                  >
                    {i + 1 < leverage.level ? "✓" : ""} {title}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
              Score Breakdown
            </p>
            <div className="space-y-2">
              <BreakdownRow
                label="Effective Yield"
                value={leverage.breakdown.effectiveYieldBonus}
                positive
              />
              <BreakdownRow
                label="Revenue Growth"
                value={leverage.breakdown.revenueGrowthBonus}
                positive
              />
              <BreakdownRow
                label="Output (Deep Work)"
                value={leverage.breakdown.deepWorkBonus}
                positive
              />
              <BreakdownRow
                label="Physical Activity"
                value={leverage.breakdown.physicalActivityBonus}
                positive
              />
              <BreakdownRow
                label="Streak Bonus"
                value={leverage.breakdown.streakBonus}
                positive
              />
              <div className="border-t border-zinc-800 pt-2 mt-2">
                <BreakdownRow
                  label="Revision Drag"
                  value={-leverage.breakdown.revisionDragPenalty}
                  positive={false}
                />
                <BreakdownRow
                  label="Crash Penalty"
                  value={-leverage.breakdown.crashPenalty}
                  positive={false}
                />
              </div>
              <div className="border-t border-zinc-700 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-white text-sm font-bold">Total</span>
                  <span className="text-cyan-400 text-sm font-black">{leverage.score} XP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function SectionHeader({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-base">{icon}</span>
      <h2 className="text-zinc-300 text-xs font-black uppercase tracking-widest">{label}</h2>
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  );
}

function MetricCard({
  label,
  sublabel,
  value,
  accent,
  icon,
}: {
  label: string;
  sublabel?: string;
  value: string | number;
  accent: "cyan" | "violet" | "zinc" | "amber" | "red";
  icon?: string;
}) {
  const colorMap = {
    cyan: "text-cyan-400",
    violet: "text-violet-400",
    zinc: "text-zinc-300",
    amber: "text-amber-400",
    red: "text-red-400",
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-sm">{icon}</span>}
        <p className="text-zinc-500 text-xs uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-black ${colorMap[accent]}`}>{value}</p>
      {sublabel && <p className="text-zinc-600 text-xs mt-0.5">{sublabel}</p>}
    </div>
  );
}

function TrendCard({
  label,
  value,
  trend,
  sublabel,
}: {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  sublabel?: string;
}) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor =
    trend === "up" ? "text-cyan-400" : trend === "down" ? "text-red-400" : "text-zinc-400";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`text-2xl font-black ${trendColor}`}>{value}</p>
        <span className={`text-xl font-black ${trendColor}`}>{trendIcon}</span>
      </div>
      {sublabel && <p className="text-zinc-600 text-xs mt-0.5">{sublabel}</p>}
    </div>
  );
}

function SleepCorrelationRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: "cyan" | "red" | "amber";
}) {
  const colorMap = {
    cyan: "text-cyan-400",
    red: "text-red-400",
    amber: "text-amber-400",
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400 text-xs">{label}</span>
      <span className={`text-sm font-bold ${colorMap[color]}`}>
        {value !== null ? `${value} videos/day` : "No data"}
      </span>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  positive,
}: {
  label: string;
  value: number;
  positive: boolean;
}) {
  const isZero = value === 0;
  const color = isZero
    ? "text-zinc-600"
    : positive && value > 0
    ? "text-cyan-400"
    : !positive && value < 0
    ? "text-red-400"
    : "text-zinc-500";

  return (
    <div className="flex justify-between items-center">
      <span className="text-zinc-500 text-xs">{label}</span>
      <span className={`text-xs font-bold font-mono ${color}`}>
        {value > 0 ? "+" : ""}
        {value}
      </span>
    </div>
  );
}
