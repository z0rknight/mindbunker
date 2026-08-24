// Monday Local Intelligence Lab, §G/I — Caffeine event pure logic.
// No DB or framework imports here — see actions.ts. Deliberately works on
// day-count maps (dayKey -> total servings) rather than raw event lists:
// every consumer this round (today count, week count, activity timeline)
// only ever needs "how many servings on day X," and a plain
// Record<string, number> is trivially serializable across the server/client
// boundary (a Map is not), which matters because the activity timeline
// passes this data into a client component.

export type CaffeineDayCounts = Readonly<Record<string, number>>;

const DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// en-CA locale formats as YYYY-MM-DD, matching the dayKeyFor() convention
// already used by work-sessions/core.ts for the same display-timezone
// day-bucketing reason (America/Sao_Paulo, so a coffee logged at 11:58pm
// lands on the day the operator actually sees it on).
export function caffeineDayKey(iso: string): string {
  return DAY_FORMATTER.format(new Date(iso));
}

// ISO week (Monday start), same convention as work-sessions/core.ts's
// mondayOfWeek — kept as an independent copy rather than a shared import
// since these are pure date-key functions with no other module coupling,
// and caffeine is deliberately its own small module, not a dependency of
// work-sessions or vice versa.
export function mondayOfWeek(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay(); // 0 = Sunday
  const diffToMonday = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
}

export function daysInWeekOf(dayKey: string): string[] {
  const monday = mondayOfWeek(dayKey);
  const [year, month, day] = monday.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
}

export function sumCaffeineForDays(
  counts: CaffeineDayCounts,
  dayKeys: readonly string[],
): number {
  return dayKeys.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
}

export type CaffeineSummary = {
  todayCount: number;
  weekCount: number;
};

export function computeCaffeineSummary(
  counts: CaffeineDayCounts,
  todayKey: string,
): CaffeineSummary {
  return {
    todayCount: counts[todayKey] ?? 0,
    weekCount: sumCaffeineForDays(counts, daysInWeekOf(todayKey)),
  };
}

// Monday Real-Operation Pre-Freeze §14 — the "+1 Coffee" quick action
// (logCaffeineEvent in actions.ts) deliberately never touches
// health_logs.caffeineMg (see that action's own comment), but the War Room
// "Caffeine Ratio" / "Total Caffeine This Month" metric (analytics/service.ts)
// was reading ONLY health_logs.caffeineMg — so a quick-logged coffee never
// moved the ratio. This is an explicit, documented estimate (Emmanuel's own
// figure), not laboratory truth: 1 serving ≈ 200mL ≈ 90mg caffeine.
export const CAFFEINE_MG_PER_SERVING_ESTIMATE = 90;

export function estimateCaffeineMgFromServings(servings: number): number {
  return servings * CAFFEINE_MG_PER_SERVING_ESTIMATE;
}

// One real day of caffeine intake, reconciled from two independent tracking
// paths: a manually-typed health_logs.caffeineMg total (precise, when
// entered) and quick-logged caffeineEvents servings (fast, estimate-based).
// These are NOT additive — they are two different ways of recording the
// SAME real-world quantity — so the day's contribution is whichever source
// reports a higher figure, never their sum (which would silently double
// count a day where both a manual note AND a quick-log exist).
export function reconcileDailyCaffeineMg(
  manualMg: number | null,
  quickLogServings: number,
): number {
  return Math.max(manualMg ?? 0, estimateCaffeineMgFromServings(quickLogServings));
}

// Taryn August Ingest Readiness §17: the same reconcile-don't-sum logic,
// but returning null (display "-- Not measured") when NEITHER source has
// anything for the day, instead of a misleading 0mg. This is what the
// Dashboard's "Caffeine Today" stat should have used from the start --
// the earlier Monday Real-Operation Pre-Freeze §14 fix only reached the
// War Room's monthly total, so the daily Dashboard number kept reading
// health_logs.caffeineMg alone and never moved for a quick-logged coffee.
export function resolveCaffeineTodayDisplay(
  manualMg: number | null,
  quickLogServings: number,
): number | null {
  if (manualMg === null && quickLogServings <= 0) return null;
  return reconcileDailyCaffeineMg(manualMg, quickLogServings);
}
