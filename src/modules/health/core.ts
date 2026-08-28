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
