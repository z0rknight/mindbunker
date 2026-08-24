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
