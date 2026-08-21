import {
  BOOKING_BUFFER_OPTIONS,
  BOOKING_DURATION_OPTIONS,
  BOOKING_HORIZON_OPTIONS,
  BOOKING_NOTICE_OPTIONS,
  type BookingStatus,
} from "./config.ts";
import type { OpportunityStage } from "../gateway/config.ts";

const MINUTE_IN_MILLISECONDS = 60_000;
const HOUR_IN_MILLISECONDS = 60 * MINUTE_IN_MILLISECONDS;
const DAY_IN_MILLISECONDS = 24 * HOUR_IN_MILLISECONDS;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export type BookingSettingsValue = {
  enabled: boolean;
  timezone: string;
  durationMinutes: number;
  bufferMinutes: number;
  minimumNoticeHours: number;
  bookingHorizonDays: number;
};

export type AvailabilityWindowValue = {
  weekday: number;
  enabled: boolean;
  startMinute: number;
  endMinute: number;
};

export type BusyInterval = {
  startsAt: Date | string;
  endsAt: Date | string;
};

export type AvailableSlot = {
  startsAt: string;
  endsAt: string;
};

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function cleanEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase().slice(0, 320);
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function parseTimeToMinute(value: unknown) {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function minuteToTime(value: number) {
  const minute = Math.max(0, Math.min(1_439, Math.trunc(value)));
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function validateBookingSettings(value: BookingSettingsValue) {
  return (
    typeof value.enabled === "boolean" &&
    isValidTimeZone(value.timezone) &&
    (BOOKING_DURATION_OPTIONS as readonly number[]).includes(
      value.durationMinutes,
    ) &&
    (BOOKING_BUFFER_OPTIONS as readonly number[]).includes(
      value.bufferMinutes,
    ) &&
    (BOOKING_NOTICE_OPTIONS as readonly number[]).includes(
      value.minimumNoticeHours,
    ) &&
    (BOOKING_HORIZON_OPTIONS as readonly number[]).includes(
      value.bookingHorizonDays,
    )
  );
}

export function validateAvailabilityWindows(
  windows: AvailabilityWindowValue[],
) {
  if (windows.length !== 7) return false;
  const weekdays = new Set<number>();
  for (const window of windows) {
    if (
      !Number.isInteger(window.weekday) ||
      window.weekday < 0 ||
      window.weekday > 6 ||
      weekdays.has(window.weekday) ||
      typeof window.enabled !== "boolean" ||
      !Number.isInteger(window.startMinute) ||
      !Number.isInteger(window.endMinute) ||
      window.startMinute < 0 ||
      window.endMinute > 1_440 ||
      window.startMinute >= window.endMinute
    ) {
      return false;
    }
    weekdays.add(window.weekday);
  }
  return true;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, Number(part.value)]),
  );
  const year = values.year;
  const month = values.month;
  const day = values.day;
  const hour = values.hour;
  const minute = values.minute;
  return {
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    minuteOfDay: hour * 60 + minute,
    dateKey: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function overlapsBusyInterval(
  startsAt: Date,
  endsAt: Date,
  intervals: BusyInterval[],
  bufferMinutes: number,
) {
  const buffer = bufferMinutes * MINUTE_IN_MILLISECONDS;
  return intervals.some((interval) => {
    const busyStart = toDate(interval.startsAt).getTime() - buffer;
    const busyEnd = toDate(interval.endsAt).getTime() + buffer;
    return startsAt.getTime() < busyEnd && endsAt.getTime() > busyStart;
  });
}

export function generateAvailableSlots({
  settings,
  windows,
  busyIntervals,
  now = new Date(),
  limit = 500,
}: {
  settings: BookingSettingsValue;
  windows: AvailabilityWindowValue[];
  busyIntervals: BusyInterval[];
  now?: Date;
  limit?: number;
}) {
  if (
    !settings.enabled ||
    !validateBookingSettings(settings) ||
    !validateAvailabilityWindows(windows) ||
    limit <= 0
  ) {
    return [] as AvailableSlot[];
  }

  const minimumStart = new Date(
    now.getTime() + settings.minimumNoticeHours * HOUR_IN_MILLISECONDS,
  );
  const horizon = new Date(
    now.getTime() + settings.bookingHorizonDays * DAY_IN_MILLISECONDS,
  );
  const firstCandidate = new Date(
    Math.ceil(minimumStart.getTime() / (15 * MINUTE_IN_MILLISECONDS)) *
      15 *
      MINUTE_IN_MILLISECONDS,
  );
  const duration = settings.durationMinutes * MINUTE_IN_MILLISECONDS;
  const cadence = settings.durationMinutes + settings.bufferMinutes;
  const windowsByWeekday = new Map(
    windows.filter((window) => window.enabled).map((window) => [window.weekday, window]),
  );
  const result: AvailableSlot[] = [];

  for (
    let timestamp = firstCandidate.getTime();
    timestamp <= horizon.getTime() && result.length < limit;
    timestamp += 15 * MINUTE_IN_MILLISECONDS
  ) {
    const startsAt = new Date(timestamp);
    const endsAt = new Date(timestamp + duration);
    const startParts = zonedParts(startsAt, settings.timezone);
    const endParts = zonedParts(endsAt, settings.timezone);
    const window = windowsByWeekday.get(startParts.weekday);
    if (!window) continue;
    if (startParts.dateKey !== endParts.dateKey) continue;
    if (
      startParts.minuteOfDay < window.startMinute ||
      endParts.minuteOfDay > window.endMinute ||
      (startParts.minuteOfDay - window.startMinute) % cadence !== 0
    ) {
      continue;
    }
    if (
      overlapsBusyInterval(
        startsAt,
        endsAt,
        busyIntervals,
        settings.bufferMinutes,
      )
    ) {
      continue;
    }
    result.push({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
  }

  return result;
}

export function formatDateKeyInTimeZone(date: Date, timeZone: string) {
  return zonedParts(date, timeZone).dateKey;
}

export function stageAfterBooking(
  currentStage: OpportunityStage,
): OpportunityStage {
  return ["new", "qualified", "invited"].includes(currentStage)
    ? "booked"
    : currentStage;
}

export function isConfirmedBooking(status: BookingStatus) {
  return status === "confirmed";
}

