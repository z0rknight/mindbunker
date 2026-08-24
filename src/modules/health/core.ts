// Monday Local Intelligence Lab, §K — Health activity timeline: pure
// day-grid logic. No DB or framework imports here — see actions.ts and
// src/app/health/page.tsx, which fetch health_logs + caffeine day counts
// and pass them in.

export type HealthLogForTimeline = {
  date: string; // ISO YYYY-MM-DD
  sleepHours: number | null;
  walkingMinutes: number | null;
  cyclingKm: number | null;
};

export type ActivityTimelineDay = {
  date: string;
  weekday: number; // 0 = Monday ... 6 = Sunday
  walked: boolean;
  walkingMinutes: number | null;
  cycled: boolean;
  cyclingKm: number | null;
  sleepHours: number | null;
  caffeineCount: number;
};

function isoToMondayIndexedWeekday(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const jsWeekday = date.getUTCDay(); // 0 = Sunday
  return jsWeekday === 0 ? 6 : jsWeekday - 1;
}

function addDaysISO(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * Builds one entry per day covering the last `days` days (inclusive of
 * today), padded backward to the nearest Monday so the grid always starts
 * on a Monday -- the same Mon-start week convention work-sessions/core.ts
 * and caffeine/core.ts already use. A day with no data of any kind is still
 * included, with every field null/false/0 -- never fabricated, just
 * genuinely absent (no walk/bike/sleep/caffeine recorded that day).
 */
export function buildActivityTimelineDays(
  healthLogs: readonly HealthLogForTimeline[],
  caffeineDayCounts: Readonly<Record<string, number>>,
  todayISODate: string,
  days: number,
): ActivityTimelineDay[] {
  const logsByDate = new Map(healthLogs.map((l) => [l.date, l]));
  const startDate = addDaysISO(todayISODate, -(days - 1));
  const startWeekday = isoToMondayIndexedWeekday(startDate);
  const gridStart = addDaysISO(startDate, -startWeekday);

  const result: ActivityTimelineDay[] = [];
  let cursor = gridStart;
  while (cursor <= todayISODate) {
    const log = logsByDate.get(cursor);
    const walkingMinutes = log?.walkingMinutes ?? null;
    const cyclingKm = log?.cyclingKm ?? null;
    result.push({
      date: cursor,
      weekday: isoToMondayIndexedWeekday(cursor),
      walked: (walkingMinutes ?? 0) > 0,
      walkingMinutes,
      cycled: (cyclingKm ?? 0) > 0,
      cyclingKm,
      sleepHours: log?.sleepHours ?? null,
      caffeineCount: caffeineDayCounts[cursor] ?? 0,
    });
    cursor = addDaysISO(cursor, 1);
  }
  return result;
}

/** Chunks a flat, Monday-padded day list into 7-row week columns for a
 * GitHub-activity-calendar-style grid render. */
export function groupTimelineDaysIntoWeekColumns(
  timelineDays: readonly ActivityTimelineDay[],
): ActivityTimelineDay[][] {
  const columns: ActivityTimelineDay[][] = [];
  for (let i = 0; i < timelineDays.length; i += 7) {
    columns.push(timelineDays.slice(i, i + 7));
  }
  return columns;
}
