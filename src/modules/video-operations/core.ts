import {
  BLOCKER_CATEGORIES,
  CHECKLIST_STATUSES,
  FRICTION_CATEGORIES,
  PRODUCTION_STEPS,
  REVISION_CATEGORIES,
  REVISION_CAUSES,
  type BlockerCategory,
  type ChecklistStatus,
  type FrictionCategory,
  type ProductionStep,
  type RevisionCategory,
  type RevisionCause,
} from "./config.ts";

const OPERATOR_TIME_ZONE = "America/Sao_Paulo";
const EXPLICIT_INSTANT_PATTERN = /(Z|[+-]\d{2}:\d{2})$/u;
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u;
const OPERATOR_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: OPERATOR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function operatorParts(instant: Date): DateTimeParts {
  const parts = OPERATOR_DATE_TIME_FORMATTER.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function utcFromParts(parts: DateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function equalParts(left: DateTimeParts, right: DateTimeParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

/**
 * Converts a browser datetime-local value as an America/Sao_Paulo wall time
 * into an explicit UTC instant. This never depends on the Worker/browser host
 * timezone, and the round-trip check rejects impossible or DST-skipped times.
 */
export function operatorLocalDateTimeToIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = LOCAL_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const desired: DateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const wallClockEpoch = utcFromParts(desired);
  const wallClockDate = new Date(wallClockEpoch);
  if (
    wallClockDate.getUTCFullYear() !== desired.year ||
    wallClockDate.getUTCMonth() + 1 !== desired.month ||
    wallClockDate.getUTCDate() !== desired.day ||
    desired.hour > 23 ||
    desired.minute > 59 ||
    desired.second > 59
  ) {
    return null;
  }

  // Resolve the IANA-zone offset at the candidate instant, then once more at
  // the corrected instant in case the first guess crossed an offset boundary.
  let candidate = wallClockEpoch;
  for (let index = 0; index < 2; index += 1) {
    const representedWallClock = utcFromParts(operatorParts(new Date(candidate)));
    candidate = wallClockEpoch - (representedWallClock - candidate);
  }
  const instant = new Date(candidate);
  return equalParts(operatorParts(instant), desired) ? instant.toISOString() : null;
}

/** Formats an absolute instant for a datetime-local input in operator time. */
export function instantToOperatorDateTimeLocal(value: Date | string): string | null {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = operatorParts(instant);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isMember<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export const isFrictionCategory = (value: unknown): value is FrictionCategory =>
  isMember(FRICTION_CATEGORIES, value);
export const isBlockerCategory = (value: unknown): value is BlockerCategory =>
  isMember(BLOCKER_CATEGORIES, value);
export const isProductionStep = (value: unknown): value is ProductionStep =>
  isMember(PRODUCTION_STEPS, value);
export const isChecklistStatus = (value: unknown): value is ChecklistStatus =>
  isMember(CHECKLIST_STATUSES, value);
export const isRevisionCause = (value: unknown): value is RevisionCause =>
  isMember(REVISION_CAUSES, value);
export const isRevisionCategory = (value: unknown): value is RevisionCategory =>
  isMember(REVISION_CATEGORIES, value);

export function cleanRequiredText(
  value: unknown,
  label: string,
  maxLength: number,
): { success: true; value: string } | { success: false; error: string } {
  const cleaned = typeof value === "string" ? value.trim() : "";
  if (!cleaned) return { success: false, error: `${label} is required.` };
  if (cleaned.length > maxLength) {
    return { success: false, error: `${label} is too long (max ${maxLength}).` };
  }
  return { success: true, value: cleaned };
}

export function cleanOptionalText(value: unknown, maxLength: number): string | null | false {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return false;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.length <= maxLength ? cleaned : false;
}

export function parseOptionalNonNegativeMinutes(value: unknown): number | null | false {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_080) return false;
  return parsed;
}

export function parseOptionalDueAt(value: unknown): Date | null | false {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !EXPLICIT_INSTANT_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? false : parsed;
}

export function commitmentChronologyIssue(input: {
  createdAt: Date | string;
  dueAt: Date | string;
}): "DUE_BEFORE_CREATED" | null {
  const createdAt = new Date(input.createdAt);
  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(createdAt.getTime()) || Number.isNaN(dueAt.getTime())) {
    return "DUE_BEFORE_CREATED";
  }
  return dueAt.getTime() < createdAt.getTime() ? "DUE_BEFORE_CREATED" : null;
}

export function computePromiseAccuracy(
  pairs: readonly { dueAt: Date | null; deliveredAt: Date }[],
) {
  const measurable = pairs.filter(
    (pair): pair is { dueAt: Date; deliveredAt: Date } => pair.dueAt !== null,
  );
  const deltasSeconds = measurable.map(
    (pair) => (pair.deliveredAt.getTime() - pair.dueAt.getTime()) / 1_000,
  );
  return {
    sampleCount: deltasSeconds.length,
    onTimeCount: deltasSeconds.filter((delta) => delta <= 0).length,
    lateCount: deltasSeconds.filter((delta) => delta > 0).length,
  };
}

export function computeChecklistProgress(
  items: readonly { status: ChecklistStatus }[],
) {
  const applicable = items.filter((item) => item.status !== "NOT_REQUIRED");
  const done = applicable.filter((item) => item.status === "DONE").length;
  return {
    done,
    applicable: applicable.length,
    complete: items.length > 0 && applicable.every((item) => item.status === "DONE"),
  };
}

// ─── Quick Deadline presets (P0.3 / P0.5) ───────────────────────────────────
//
// Shared between OperationalMemoryPanel (per-video Quick Deadline) and
// QuickCapture (global Cmd/Ctrl+K) so both compute due dates identically.
// Every preset resolves to an operator-local datetime-local string
// (instantToOperatorDateTimeLocal, above) which operatorLocalDateTimeToIso
// then converts into the exact same explicit-instant createVideoCommitment
// already expects -- presets never bypass that canonical action.
export function operatorNowParts() {
  const [datePart, timePart] = (instantToOperatorDateTimeLocal(new Date()) ?? "1970-01-01T00:00").split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return { year, month, day, hour, minute };
}

export function operatorDatePlusDays(
  parts: { year: number; month: number; day: number },
  deltaDays: number,
) {
  // Pure calendar-day counter, not a real instant -- UTC here only avoids
  // DST edge cases in the arithmetic itself, never used as a timezone claim.
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function operatorLocalString(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

export type QuickDeadlinePreset = { label: string; resolve: () => string };

export const QUICK_DEADLINE_PRESETS: QuickDeadlinePreset[] = [
  { label: "+2h", resolve: () => instantToOperatorDateTimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1_000)) ?? "" },
  {
    label: "Tonight",
    resolve: () => {
      const now = operatorNowParts();
      // Already past 20:00 operator time -- "tonight" rolls to tomorrow
      // rather than resolving to a due date already in the past (which
      // createVideoCommitment's chronology check would reject anyway).
      const target = now.hour >= 20 ? operatorDatePlusDays(now, 1) : now;
      return operatorLocalString(target.year, target.month, target.day, 20, 0);
    },
  },
  {
    label: "Tomorrow",
    resolve: () => {
      const tomorrow = operatorDatePlusDays(operatorNowParts(), 1);
      return operatorLocalString(tomorrow.year, tomorrow.month, tomorrow.day, 18, 0);
    },
  },
  { label: "24h", resolve: () => instantToOperatorDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1_000)) ?? "" },
  { label: "48h", resolve: () => instantToOperatorDateTimeLocal(new Date(Date.now() + 48 * 60 * 60 * 1_000)) ?? "" },
];
