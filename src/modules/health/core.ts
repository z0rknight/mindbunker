// Monday Local Intelligence Lab, §K — Health activity timeline: pure
// day-grid logic. No DB or framework imports here — see actions.ts and
// src/app/health/page.tsx, which fetch health_logs + caffeine day counts
// and pass them in.

import { estimateCaffeineMgFromServings } from "../caffeine/core.ts";

export type HealthLogForTimeline = {
  date: string; // ISO YYYY-MM-DD
  sleepHours: number | null;
  walkingMinutes: number | null;
  cyclingKm: number | null;
};

export type HealthLogMutableValues = {
  date: string;
  sleepHours: number | null;
  caffeineMg: number | null;
  substancesNotes: string | null;
  screenTimeHours: number | null;
  cyclingKm: number | null;
  cyclingMinutes: number | null;
  walkingMinutes: number | null;
};

type HealthLogValidation =
  | { success: true; data: HealthLogMutableValues }
  | { success: false; error: string };

/**
 * Validates a calendar date without converting it through local time or UTC.
 * The returned value is the exact YYYY-MM-DD string the operator chose.
 */
export function isValidHealthDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function validateNullableNumber(
  value: unknown,
  label: string,
  options: { max?: number; integer?: boolean } = {},
): { success: true; value: number | null } | { success: false; error: string } {
  if (value === null || value === "") return { success: true, value: null };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return { success: false, error: `${label} must be zero or a positive number.` };
  }
  if (options.max !== undefined && value > options.max) {
    return { success: false, error: `${label} must be ${options.max} or less.` };
  }
  if (options.integer && !Number.isSafeInteger(value)) {
    return { success: false, error: `${label} must be a whole number.` };
  }
  return { success: true, value };
}

/**
 * Full-row validation for the small operator-side correction form. It
 * deliberately returns only editable domain fields: id/createdAt/updatedAt
 * are not accepted here, so correcting the happened-on date can never
 * rewrite record identity or system creation time.
 */
export function validateHealthLogMutableValues(
  values: Record<string, unknown>,
): HealthLogValidation {
  if (!isValidHealthDate(values.date)) {
    return { success: false, error: "Choose a valid calendar date." };
  }

  const sleep = validateNullableNumber(values.sleepHours, "Sleep", { max: 24 });
  if (!sleep.success) return sleep;
  const caffeine = validateNullableNumber(values.caffeineMg, "Caffeine", {
    integer: true,
  });
  if (!caffeine.success) return caffeine;
  const screenTime = validateNullableNumber(values.screenTimeHours, "Screen time", {
    max: 24,
  });
  if (!screenTime.success) return screenTime;
  const cyclingKm = validateNullableNumber(values.cyclingKm, "Cycling distance");
  if (!cyclingKm.success) return cyclingKm;
  const cyclingMinutes = validateNullableNumber(
    values.cyclingMinutes,
    "Cycling duration",
    { integer: true },
  );
  if (!cyclingMinutes.success) return cyclingMinutes;
  const walkingMinutes = validateNullableNumber(
    values.walkingMinutes,
    "Walking duration",
    { integer: true },
  );
  if (!walkingMinutes.success) return walkingMinutes;

  if (
    values.substancesNotes !== null &&
    values.substancesNotes !== "" &&
    typeof values.substancesNotes !== "string"
  ) {
    return { success: false, error: "Notes must be text." };
  }
  const substancesNotes =
    values.substancesNotes === null || values.substancesNotes === ""
      ? null
      : values.substancesNotes.trim().slice(0, 2_000) || null;

  return {
    success: true,
    data: {
      date: values.date,
      sleepHours: sleep.value,
      caffeineMg: caffeine.value,
      substancesNotes,
      screenTimeHours: screenTime.value,
      cyclingKm: cyclingKm.value,
      cyclingMinutes: cyclingMinutes.value,
      walkingMinutes: walkingMinutes.value,
    },
  };
}

export type ActivityTimelineDay = {
  date: string;
  weekday: number; // 0 = Monday ... 6 = Sunday
  walked: boolean;
  walkingMinutes: number | null;
  cycled: boolean;
  cyclingKm: number | null;
  sleepHours: number | null;
  caffeineCount: number | null;
};

export type HealthLogForLedger = HealthLogForTimeline & {
  id: number;
  caffeineMg: number | null;
  substancesNotes: string | null;
  screenTimeHours: number | null;
  cyclingMinutes: number | null;
};

export type ClosedWorkSessionForLedger = {
  startedAt: Date | string;
  endedAt: Date | string;
};

export type DailyHealthLedgerRow = {
  date: string;
  healthLogId: number | null;
  sleepHours: number | null;
  coffeeServings: number | null;
  caffeineMg: number | null;
  caffeineSource: "MANUAL" | "ESTIMATED" | "NOT_MEASURED";
  walkingMinutes: number | null;
  cyclingKm: number | null;
  cyclingMinutes: number | null;
  workSeconds: number | null;
  workSessionCount: number | null;
  substancesNotes: string | null;
  screenTimeHours: number | null;
};

export function computeHealthWindowSummary(
  healthLogs: readonly HealthLogForLedger[],
  caffeineDayCounts: Readonly<Record<string, number>>,
  todayISODate: string,
  windowDays = 7,
) {
  const windowStart = addDaysISO(todayISODate, -(windowDays - 1));
  const logs = healthLogs.filter(
    (log) => log.date >= windowStart && log.date <= todayISODate,
  );
  const todayLog = logs.find((log) => log.date === todayISODate) ?? null;
  const sleepLogs = logs.filter((log) => log.sleepHours !== null);
  const cyclingLogs = logs.filter((log) => log.cyclingKm !== null);
  const walkingLogs = logs.filter((log) => log.walkingMinutes !== null);
  const coffeeServingsToday = Object.hasOwn(caffeineDayCounts, todayISODate)
    ? caffeineDayCounts[todayISODate]
    : null;
  const manualCaffeineToday = todayLog?.caffeineMg ?? null;
  const caffeineTodaySource = manualCaffeineToday !== null
    ? "MANUAL" as const
    : coffeeServingsToday !== null
      ? "ESTIMATED" as const
      : "NOT_MEASURED" as const;

  return {
    avgSleep7Days: sleepLogs.length > 0
      ? Math.round((sleepLogs.reduce((sum, log) => sum + (log.sleepHours ?? 0), 0) / sleepLogs.length) * 10) / 10
      : null,
    caffeineToday: manualCaffeineToday !== null
      ? manualCaffeineToday
      : coffeeServingsToday !== null
        ? estimateCaffeineMgFromServings(coffeeServingsToday)
        : null,
    caffeineTodaySource,
    coffeeServingsToday,
    screenTimeToday: todayLog?.screenTimeHours ?? null,
    cyclingKmToday: todayLog?.cyclingKm ?? null,
    walkingMinutesToday: todayLog?.walkingMinutes ?? null,
    totalCyclingKm7d: cyclingLogs.length > 0
      ? Math.round(cyclingLogs.reduce((sum, log) => sum + (log.cyclingKm ?? 0), 0) * 10) / 10
      : null,
    totalWalkingMin7d: walkingLogs.length > 0
      ? walkingLogs.reduce((sum, log) => sum + (log.walkingMinutes ?? 0), 0)
      : null,
    todayLog,
    windowStart,
  };
}

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
      caffeineCount: Object.hasOwn(caffeineDayCounts, cursor)
        ? caffeineDayCounts[cursor]
        : null,
    });
    cursor = addDaysISO(cursor, 1);
  }
  return result;
}

/**
 * One truthful row per operator calendar day. Missing means null; an explicit
 * stored zero remains zero. Quick coffees produce a clearly labelled estimate,
 * while a manual caffeine value is the precise daily authority and is never
 * added to that estimate.
 */
export function buildDailyHealthLedger(
  healthLogs: readonly HealthLogForLedger[],
  caffeineDayCounts: Readonly<Record<string, number>>,
  workSessions: readonly ClosedWorkSessionForLedger[],
  todayISODate: string,
  days: number,
): DailyHealthLedgerRow[] {
  const logsByDate = new Map(healthLogs.map((log) => [log.date, log]));
  const workByDate = new Map<string, { seconds: number; sessions: number }>();
  for (const session of workSessions) {
    const startedAt = new Date(session.startedAt);
    const endedAt = new Date(session.endedAt);
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) continue;
    const seconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1_000));
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(startedAt);
    const current = workByDate.get(date) ?? { seconds: 0, sessions: 0 };
    current.seconds += seconds;
    current.sessions += 1;
    workByDate.set(date, current);
  }

  const start = addDaysISO(todayISODate, -(days - 1));
  const dayKeys = new Set<string>();
  for (const log of healthLogs) {
    if (log.date >= start && log.date <= todayISODate) dayKeys.add(log.date);
  }
  for (const date of Object.keys(caffeineDayCounts)) {
    if (date >= start && date <= todayISODate) dayKeys.add(date);
  }
  for (const date of workByDate.keys()) {
    if (date >= start && date <= todayISODate) dayKeys.add(date);
  }

  const result: DailyHealthLedgerRow[] = [];
  for (const cursor of [...dayKeys].sort().reverse()) {
    const log = logsByDate.get(cursor);
    const hasCoffee = Object.hasOwn(caffeineDayCounts, cursor);
    const coffeeServings = hasCoffee ? caffeineDayCounts[cursor] : null;
    const manualMg = log?.caffeineMg ?? null;
    const caffeineSource = manualMg !== null
      ? "MANUAL"
      : coffeeServings !== null
        ? "ESTIMATED"
        : "NOT_MEASURED";
    const work = workByDate.get(cursor);
    result.push({
      date: cursor,
      healthLogId: log?.id ?? null,
      sleepHours: log?.sleepHours ?? null,
      coffeeServings,
      caffeineMg: manualMg !== null
        ? manualMg
        : coffeeServings !== null
          ? estimateCaffeineMgFromServings(coffeeServings)
          : null,
      caffeineSource,
      walkingMinutes: log?.walkingMinutes ?? null,
      cyclingKm: log?.cyclingKm ?? null,
      cyclingMinutes: log?.cyclingMinutes ?? null,
      workSeconds: work?.seconds ?? null,
      workSessionCount: work?.sessions ?? null,
      substancesNotes: log?.substancesNotes ?? null,
      screenTimeHours: log?.screenTimeHours ?? null,
    });
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
