import { getWarRoomData } from "@/modules/analytics/service";
import { getActiveSignals, type Signal, type SignalConfidence, type SignalSeverity } from "@/modules/signals";
import { getDailyLedger, type DailyLedgerRow } from "@/modules/daily-ledger";
import { listOpenDecisions, type OpenDecisionRow } from "@/modules/decisions/actions";
import { getClientHoursForPeriod, getRateEquivalentsForPeriod } from "@/modules/finance/actions";
import { mondayOfWeek } from "@/modules/work-sessions/core";
import { OpenDecisionCard, RecordDecisionButton } from "./DecisionControls";
import { formatCurrency, startOfMonthISO, todayISO } from "@/utils/date";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WarRoomPage() {
  const today = todayISO();
  const [data, signals, dailyLedger, openDecisions, weekEstimates, monthHours] = await Promise.all([
    getWarRoomData(),
    getActiveSignals(),
    getDailyLedger(7),
    listOpenDecisions(),
    getRateEquivalentsForPeriod(mondayOfWeek(today), today),
    getClientHoursForPeriod(startOfMonthISO(), today),
  ]);
  const { income, efficiency, biological, momentum } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:p-6">
      <ActiveSignalsSection signals={signals} />
      <DecisionsSection decisions={openDecisions} />
      <DailyLedgerSection rows={dailyLedger} />
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">💎</span>
            <h1 className="text-3xl font-black text-white tracking-tight">WAR ROOM</h1>
          </div>
          <p className="text-zinc-500 text-sm">
            Recorded business facts · restrained derived context
          </p>
        </div>
        <div className="text-right">
          <p className="text-zinc-600 text-xs">Last updated</p>
          <p className="text-zinc-400 text-xs font-mono">
            {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* ── LAYER 1: INCOME INTELLIGENCE ──────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="I. INCOME CONTEXT" icon="💰" />
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
              label="Recorded Income / Completed Video"
              sublabel="Current month · context only"
              value={
                income.effectiveFlatRateYield
                  ? formatCurrency(income.effectiveFlatRateYield, income.perVideoCurrency) + "/video"
                  : "—"
              }
              accent="cyan"
              icon="⚡"
            />
            <MetricCard
              label="All-Time Income / Completed Video"
              sublabel="Not per-video attribution"
              value={
                income.revenuePerVideoAllTime
                  ? formatCurrency(income.revenuePerVideoAllTime, income.perVideoCurrency)
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
        <SectionHeader label="II. PRODUCTION FACTS" icon="⚙️" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
              Rework Evidence
            </p>
            <p className="text-2xl font-black text-zinc-200">
              {efficiency.totalRevisions} revisions
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              {efficiency.videosThisMonth} completed videos
              {efficiency.revisionDragIndex !== null
                ? ` · ${efficiency.revisionDragIndex.toFixed(2)} per video`
                : ""}
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
                ? formatCurrency(efficiency.revenuePerVideo, income.perVideoCurrency)
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

      </section>

      {/* ── LAYER 3: BIOLOGICAL CORRELATION ───────────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="III. HEALTH CONTEXT" icon="🧬" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Output vs Sleep */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
              Output by recorded sleep
            </p>
            <div className="space-y-3">
              <SleepCorrelationRow
                label="Good Sleep (≥7h)"
                value={biological.avgVideosGoodSleep}
                sampleCount={biological.goodSleepSampleCount}
                color="cyan"
              />
              <SleepCorrelationRow
                label="Recorded sleep <5h"
                value={biological.avgVideosCrashSleep}
                sampleCount={biological.crashSleepSampleCount}
                color="red"
              />
              <SleepCorrelationRow
                label="Recorded sleep <4h"
                value={biological.avgVideosVampireNights}
                sampleCount={biological.vampireSleepSampleCount}
                color="amber"
              />
            </div>
            <p className="text-zinc-600 text-xs mt-3">
              Descriptive averages from recorded days · not causal
            </p>
          </div>

          {/* Caffeine Metrics */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">
              Caffeine records
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Total Caffeine This Month</p>
                <p className="text-2xl font-black text-amber-400">
                  {biological.estimatedCaffeineDaysMonth > 0 ? "~" : ""}
                  {biological.totalCaffeineMonth}
                  <span className="text-sm font-normal text-zinc-500 ml-1">mg</span>
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  {biological.estimatedCaffeineDaysMonth > 0
                    ? `${biological.estimatedCaffeineDaysMonth} estimated day${biological.estimatedCaffeineDaysMonth === 1 ? "" : "s"} from quick coffee logs`
                    : biological.manualCaffeineDaysMonth > 0
                      ? `${biological.manualCaffeineDaysMonth} precise manual day${biological.manualCaffeineDaysMonth === 1 ? "" : "s"}`
                      : "No caffeine evidence this month"}
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
              Recorded activity (7d)
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Cycling (measured-day avg · 7d)</p>
                <p className="text-2xl font-black text-cyan-400">
                  {biological.avgCyclingKm7d !== null
                    ? `${biological.avgCyclingKm7d} km/day`
                    : "—"}
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  N={biological.cyclingSampleCount7d} recorded days
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Walking (measured-day avg · 7d)</p>
                <p className="text-xl font-bold text-cyan-300">
                  {biological.avgWalkingMin7d !== null
                    ? `${biological.avgWalkingMin7d} min/day`
                    : "—"}
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  N={biological.walkingSampleCount7d} recorded days
                </p>
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
                {biological.activityTimeline.map((activity) => (
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
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Recorded Income Streak</p>
            <p className="text-3xl font-black text-orange-400">
              {momentum.revenueStreak}
              <span className="text-sm font-normal text-zinc-500 ml-1">days</span>
            </p>
            <p className="text-zinc-600 text-xs mt-1">Consecutive days with recorded income</p>
          </div>

          <TrendCard
            label="Revenue Trend"
            value={
              momentum.revenueGrowthPct !== null
                ? `${momentum.revenueGrowthPct > 0 ? "+" : ""}${momentum.revenueGrowthPct}%`
                : "—"
            }
            trend={momentum.revenueTrend}
            sublabel={
              momentum.revenueGrowthPct === null
                ? `Insufficient comparable sample · N=${momentum.comparableDays} days`
                : `${momentum.revenueGrowthCurrency} MTD vs same ${momentum.comparableDays} days`
            }
          />

          <TrendCard
            label="Output Trend"
            value={
              momentum.outputGrowthPct !== null
                ? `${momentum.outputGrowthPct > 0 ? "+" : ""}${momentum.outputGrowthPct}%`
                : "—"
            }
            trend={momentum.outputTrend}
            sublabel={
              momentum.outputGrowthPct === null
                ? `Insufficient comparable sample · N=${momentum.comparableDays} days`
                : `MTD videos vs same ${momentum.comparableDays} days`
            }
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

      {/* ── LAYER 5: ACTIVE-WINDOW ESTIMATES (Tuesday Patch Priority 5) ─────
          Brief's own worked examples: "O quanto foi gerado nessa semana
          baseando-se em quanto operei em contratos ativos?" / "O que as
          sessions do Dave renderam nessa semana?" / "Quantas horas operei
          para a Taryn no mes?" -- both derived from already-tracked Work
          Sessions, neither ever written to transactions (see
          computeRateEquivalent's invariant): estimates for the still-open
          window, not income. */}
      <section className="mb-8">
        <SectionHeader label="V. THIS WEEK / THIS MONTH" icon="🗓️" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-1">
              Estimated value this week
            </p>
            <p className="text-zinc-600 text-xs mb-3">
              Tracked hours this week × active hourly contract rate. Not billed, not income.
            </p>
            {weekEstimates.length === 0 ? (
              <p className="text-zinc-600 text-sm">No tracked time yet against an active hourly contract this week.</p>
            ) : (
              <div className="space-y-2">
                {weekEstimates.map((row) => (
                  <div key={row.clientId} className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{row.clientName}</span>
                    <span className="text-cyan-400 text-sm font-bold">
                      {formatCurrency(row.rateEquivalent, row.currency)}
                      <span className="ml-1 text-zinc-500 text-xs font-normal">
                        · {(row.attributableSeconds / 3600).toFixed(1)}h
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-1">
              Hours by client this month
            </p>
            <p className="text-zinc-600 text-xs mb-3">
              Distinct tracked coverage, merged across overlapping sessions. Any client, any billing type.
            </p>
            {monthHours.length === 0 ? (
              <p className="text-zinc-600 text-sm">No tracked time recorded this month yet.</p>
            ) : (
              <div className="space-y-2">
                {monthHours.map((row) => (
                  <div key={row.clientId} className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{row.clientName}</span>
                    <span className="text-violet-300 text-sm font-bold">
                      {(row.minutes / 60).toFixed(1)}h
                    </span>
                  </div>
                ))}
              </div>
            )}
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
        {value !== "—" && <span className={`text-xl font-black ${trendColor}`}>{trendIcon}</span>}
      </div>
      {sublabel && <p className="text-zinc-600 text-xs mt-0.5">{sublabel}</p>}
    </div>
  );
}

function SleepCorrelationRow({
  label,
  value,
  sampleCount,
  color,
}: {
  label: string;
  value: number | null;
  sampleCount: number;
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
        {sampleCount >= 5 && value !== null ? `${value} videos/day · N=${sampleCount}` : `Insufficient · N=${sampleCount}`}
      </span>
    </div>
  );
}

// ─── OPERATOR INTELLIGENCE PATCH: ACTIVE SIGNALS (Phase 2) ─────────────────

function severityClass(severity: SignalSeverity) {
  if (severity === "ACTION") return "border-red-900/60 bg-red-950/15 text-red-300";
  if (severity === "WATCH") return "border-amber-900/60 bg-amber-950/15 text-amber-300";
  return "border-zinc-700 bg-zinc-900 text-zinc-400";
}

function confidenceLabel(confidence: SignalConfidence) {
  if (confidence === "HIGH") return "HIGH CONFIDENCE";
  if (confidence === "MEDIUM") return "MEDIUM CONFIDENCE";
  return "INSUFFICIENT DATA";
}

function ActiveSignalsSection({ signals }: { signals: Signal[] }) {
  return (
    <section className="mb-8">
      <SectionHeader label="ACTIVE SIGNALS" icon="📡" />
      <p className="mb-3 text-xs text-zinc-600">
        Patterns MindBunker noticed on its own -- overdue, blocked, or repeating. &ldquo;Record decision&rdquo;
        writes down what you decided to do about one, with an optional date to check back -- it doesn&apos;t take
        any action itself, and skipping it changes nothing.
      </p>
      {signals.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
          No active signals. Nothing overdue, blocked, or repeating right now.
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className={`flex flex-col gap-1 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${severityClass(signal.severity)}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {signal.severity}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {confidenceLabel(signal.confidence)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-bold text-white">{signal.statement}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{signal.evidence}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2">
                {signal.action && (
                  <Link
                    href={signal.action.href}
                    className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-center text-xs font-bold text-zinc-200 hover:border-violet-500 hover:text-violet-200"
                  >
                    {signal.action.label} →
                  </Link>
                )}
                <RecordDecisionButton signalType={signal.kind} context={signal.context} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── OPERATOR INTELLIGENCE PATCH: DECISION LOG (Phase 5) ───────────────────

function DecisionsSection({ decisions }: { decisions: OpenDecisionRow[] }) {
  if (decisions.length === 0) return null;
  return (
    <section className="mb-8">
      <SectionHeader label="OPEN DECISIONS" icon="🧭" />
      <p className="mb-3 text-xs text-zinc-600">
        Decisions you recorded from a signal, still waiting on a result. &ldquo;Record result&rdquo; closes one
        out with what actually happened; &ldquo;Cancel&rdquo; drops it without a result if it turned out moot.
      </p>
      <div className="space-y-2">
        {decisions.map((decision) => (
          <OpenDecisionCard key={decision.id} decision={decision} />
        ))}
      </div>
    </section>
  );
}

// ─── OPERATOR INTELLIGENCE PATCH: DAILY OPERATIONAL LEDGER (Phase 3) ───────

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}` : `${minutes}m`;
}

function formatTimeOfDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function DailyLedgerSection({ rows }: { rows: DailyLedgerRow[] }) {
  return (
    <section className="mb-8">
      <SectionHeader label="DAILY OPERATIONAL LEDGER · LAST 7 DAYS" icon="📓" />
      <p className="mb-3 text-xs text-zinc-600">
        What actually happened each day, derived from evidence already recorded elsewhere. &ldquo;—&rdquo; means no evidence for that day, not zero.
      </p>
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Date</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Capacity</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Work</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Output</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Quality</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Money</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-b border-zinc-800/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-400">{row.date}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {row.capacity.sleepHours !== null ? `${row.capacity.sleepHours}h sleep` : "— sleep"}
                  {row.capacity.caffeineMg !== null ? ` · ${row.capacity.caffeineMg}mg` : ""}
                  {row.capacity.walkingMinutes !== null ? ` · ${row.capacity.walkingMinutes}m walk` : ""}
                  {row.capacity.cyclingKm !== null ? ` · ${row.capacity.cyclingKm}km cycle` : ""}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {formatDuration(row.work.trackedSeconds)}
                  {row.work.sessionCount > 0 ? ` · ${row.work.sessionCount} session${row.work.sessionCount === 1 ? "" : "s"}` : ""}
                  {row.work.videosTouched > 0 ? ` · ${row.work.videosTouched} video${row.work.videosTouched === 1 ? "" : "s"}` : ""}
                  {row.work.sessionCount > 0 ? ` · ${formatTimeOfDay(row.work.firstSessionAt)}–${formatTimeOfDay(row.work.lastSessionAt)}` : ""}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {row.output.videosDelivered} delivered
                  {row.output.commitmentsDue > 0 ? ` · ${row.output.commitmentsDue} due` : ""}
                  {row.output.commitmentsMissed > 0 ? ` · ${row.output.commitmentsMissed} missed` : ""}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {row.quality.detailedRevisions} revisions
                  {row.quality.ourErrorRevisions > 0 ? ` (${row.quality.ourErrorRevisions} our error)` : ""}
                  {row.quality.reworkMinutes !== null ? ` · ${row.quality.reworkMinutes}m rework` : ""}
                  {row.quality.frictionEvents > 0 ? ` · ${row.quality.frictionEvents} friction` : ""}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {row.economics.revenueByCurrency.length === 0 && row.economics.expenseByCurrency.length === 0
                    ? "—"
                    : [
                        ...row.economics.revenueByCurrency.map((c) => `+${formatCurrency(c.amount, c.currency)}`),
                        ...row.economics.expenseByCurrency.map((c) => `-${formatCurrency(c.amount, c.currency)}`),
                      ].join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
