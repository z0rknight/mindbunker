import { getWarRoomData } from "@/modules/analytics/service";
import { formatCurrency } from "@/utils/date";

export const dynamic = "force-dynamic";

// Motivational quotes based on current state
function getMotivationalQuote(
  leverageScore: number,
  crashDetected: boolean,
  revenueStreak: number,
  level: number
): { quote: string; author: string; mood: string } {
  const quotes = {
    elite: [
      { quote: "Excellence is not a destination; it is a continuous journey that never ends.", author: "Brian Tracy", mood: "focused" },
      { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs", mood: "focused" },
      { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier", mood: "focused" },
    ],
    high: [
      { quote: "The harder I work, the luckier I get.", author: "Gary Player", mood: "motivated" },
      { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", mood: "motivated" },
      { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt", mood: "motivated" },
    ],
    building: [
      { quote: "Every expert was once a beginner. Every pro was once an amateur.", author: "Robin Sharma", mood: "building" },
      { quote: "The secret of getting ahead is getting started.", author: "Mark Twain", mood: "building" },
      { quote: "Small daily improvements are the key to staggering long-term results.", author: "Robin Sharma", mood: "building" },
    ],
    recovery: [
      { quote: "Rest and self-care are so important. When you take time to replenish your spirit, it allows you to serve others from the overflow.", author: "Eleanor Brown", mood: "recovery" },
      { quote: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott", mood: "recovery" },
      { quote: "The time to relax is when you don't have time for it.", author: "Sydney J. Harris", mood: "recovery" },
    ],
    streak: [
      { quote: "Consistency is what transforms average into excellence.", author: "Unknown", mood: "momentum" },
      { quote: "Success is the result of perfection, hard work, learning from failure, loyalty, and persistence.", author: "Colin Powell", mood: "momentum" },
      { quote: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt", mood: "momentum" },
    ],
  };

  // Priority: crash detected > elite level > high streak > building
  if (crashDetected) {
    return quotes.recovery[Math.floor(Math.random() * quotes.recovery.length)];
  }
  if (level >= 8) {
    return quotes.elite[Math.floor(Math.random() * quotes.elite.length)];
  }
  if (revenueStreak >= 7) {
    return quotes.streak[Math.floor(Math.random() * quotes.streak.length)];
  }
  if (leverageScore >= 500) {
    return quotes.high[Math.floor(Math.random() * quotes.high.length)];
  }
  return quotes.building[Math.floor(Math.random() * quotes.building.length)];
}

export default async function WarRoomPage() {
  const data = await getWarRoomData();
  const { income, efficiency, biological, momentum, leverage } = data;

  const motivationalQuote = getMotivationalQuote(
    leverage.score,
    biological.crashDetected,
    momentum.revenueStreak,
    leverage.level
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row">
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

      {/* ── MOTIVATIONAL QUOTE ─────────────────────────────────────────────── */}
      <div className="mb-8 bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <span className="text-3xl">
            {motivationalQuote.mood === "recovery" ? "🌙" :
             motivationalQuote.mood === "momentum" ? "🔥" :
             motivationalQuote.mood === "focused" ? "🎯" :
             motivationalQuote.mood === "motivated" ? "⚡" : "🌱"}
          </span>
          <div className="flex-1">
            <p className="text-zinc-300 text-lg italic font-medium leading-relaxed">
              &ldquo;{motivationalQuote.quote}&rdquo;
            </p>
            <p className="text-zinc-500 text-sm mt-2">— {motivationalQuote.author}</p>
          </div>
          <div className="text-right">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              motivationalQuote.mood === "recovery" ? "bg-purple-900/50 text-purple-400 border border-purple-700/50" :
              motivationalQuote.mood === "momentum" ? "bg-orange-900/50 text-orange-400 border border-orange-700/50" :
              motivationalQuote.mood === "focused" ? "bg-cyan-900/50 text-cyan-400 border border-cyan-700/50" :
              motivationalQuote.mood === "motivated" ? "bg-amber-900/50 text-amber-400 border border-amber-700/50" :
              "bg-green-900/50 text-green-400 border border-green-700/50"
            }`}>
              {motivationalQuote.mood.toUpperCase()}
            </span>
          </div>
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
                  income.onTrack === true
                    ? "bg-cyan-900/50 text-cyan-400 border border-cyan-700/50"
                    : income.onTrack === false
                      ? "bg-red-900/50 text-red-400 border border-red-700/50"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}
              >
                {income.onTrack === true ? "ON TRACK" : income.onTrack === false ? "BEHIND PACE" : "NO BRL BASIS"}
              </span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-3xl font-black text-white">
                {income.monthlyRevenue === null
                  ? "—"
                  : formatCurrency(income.monthlyRevenue, income.revenueCurrency)}
              </span>
              <span className="text-zinc-500 text-sm mb-1">
                / {formatCurrency(income.revenueGoal, income.revenueCurrency)}
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-700 ease-out ${
                  income.onTrack === true
                    ? "bg-gradient-to-r from-cyan-600 to-cyan-400"
                    : income.onTrack === false
                      ? "bg-gradient-to-r from-red-700 to-red-500"
                      : "bg-zinc-700"
                }`}
                style={{ width: `${income.revenueGoalPct ?? 0}%` }}
              />
            </div>
            <p
              className={`text-sm font-bold mt-2 ${
                income.onTrack === true ? "text-cyan-400" : income.onTrack === false ? "text-red-400" : "text-zinc-500"
              }`}
            >
              {income.revenueGoalPct === null ? "Unavailable without BRL revenue provenance" : `${income.revenueGoalPct}% Complete`}
            </p>
          </div>

          {/* Yield Metrics */}
          <div className="flex flex-col gap-4">
            <MetricCard
              label="Effective Flat-Rate Yield"
              sublabel="LEVERAGE METRIC"
              value={
                income.effectiveFlatRateYield
                  ? formatCurrency(income.effectiveFlatRateYield, income.revenueCurrency) + "/video"
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
                  ? formatCurrency(income.revenuePerVideoAllTime, income.revenueCurrency)
                  : "—"
              }
              accent="zinc"
              icon="🐋"
            />
          </div>
        </div>

        {income.monthlyRevenueByCurrency.length > 0 && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              This month by currency
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Separate ledgers; no inferred FX conversion. The R$20k goal uses BRL only.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {income.monthlyRevenueByCurrency.map((row) => (
                <span key={row.currency} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white">
                  {formatCurrency(row.amount, row.currency)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top Clients */}
        {income.topClientsByRevenue.length > 0 && (
          <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-1">
              Top Clients by Revenue
            </p>
            <p className="text-zinc-600 text-xs mb-3">
              Grouped by currency and ranked only within each currency; no inferred FX conversion.
            </p>
            <div className="space-y-2">
              {income.topClientsByRevenue.map((c, i) => (
                <div key={`${c.name}-${c.currency}`} className="flex items-center gap-3">
                  <span className="text-zinc-600 text-xs w-4 font-mono">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium">{c.name}</span>
                      <span className="text-cyan-400 text-sm font-bold">
                        {formatCurrency(c.revenue, c.currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-zinc-500 text-xs">{c.projects} projects</span>
                      {c.effectiveYield && (
                        <span className="text-zinc-400 text-xs">
                          · {formatCurrency(c.effectiveYield, c.currency)}/project
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
                ? formatCurrency(efficiency.revenuePerVideo, income.revenueCurrency)
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
              Sorted by lowest effective yield, ranked by raw amount (not currency-adjusted) —
              these clients cost you the most per unit of revenue earned
            </p>
            <div className="space-y-2">
              {efficiency.clientDrainRanking.map((c, i) => (
                <div key={`${c.name}-${c.currency}`} className="flex items-center gap-3">
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
                      {c.effectiveYield ? formatCurrency(c.effectiveYield, c.currency) + "/proj" : "No data"}
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
                <p className="text-zinc-500 text-xs mb-1">Coffees / Video</p>
                <p
                  className={`text-xl font-bold ${
                    biological.coffeesPerVideo === null ? "text-zinc-500" : "text-cyan-400"
                  }`}
                >
                  {biological.coffeesPerVideo !== null
                    ? `${biological.coffeesPerVideo} ☕/video`
                    : "—"}
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  {biological.coffeesPerVideo !== null
                    ? `${biological.totalCoffeesMonth} coffees this month`
                    : "No completed videos this month yet"}
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

          {/* Physical Activity Timeline */}
          {biological.activityTimeline.length > 0 && (
            <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
                Physical Activity Timeline (Last 7 Days)
              </p>
              <div className="space-y-3">
                {biological.activityTimeline.map((activity, i) => (
                  <div key={activity.date} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-zinc-500 text-xs font-mono">
                        {new Date(activity.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <p className="text-zinc-400 text-xs">
                        {activity.cyclingKm !== null ? `${activity.cyclingKm}km cycling` : ''}
                        {activity.cyclingKm !== null && activity.walkingMinutes !== null ? ' · ' : ''}
                        {activity.walkingMinutes !== null ? `${activity.walkingMinutes}min walking` : ''}
                      </p>
                    </div>
                    <div className="w-32 bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan-700 to-cyan-400 transition-all duration-700"
                        style={{ width: `${(activity.totalActivity / 50) * 100}%` }}
                      />
                    </div>
                    <span className="text-cyan-400 text-xs font-bold">
                      {Math.round(activity.totalActivity * 10) / 10}/50
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            sublabel={`${momentum.revenueGrowthCurrency} vs last month`}
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
            sublabel="Closed Work Session days"
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
                label="Output Volume"
                value={leverage.breakdown.outputVolumeBonus}
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
