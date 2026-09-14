export const OPERATOR_TIME_ZONE = "America/Sao_Paulo";

type OperatorDateParts = { year: number; month: number; day: number };

const OPERATOR_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: OPERATOR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function operatorDateParts(instant: Date): OperatorDateParts {
  const parts = OPERATOR_DATE_FORMATTER.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function formatDateParts({ year, month, day }: OperatorDateParts): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The operator-facing calendar date for an absolute instant. */
export function operatorDateKey(instant: Date | string = new Date()): string {
  const parsed = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid instant.");
  return formatDateParts(operatorDateParts(parsed));
}

/** Calendar arithmetic on a YYYY-MM-DD key, independent of host timezone. */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Returns today's date as ISO string YYYY-MM-DD (Brazil timezone)
 */
export function todayISO(now: Date = new Date()): string {
  return operatorDateKey(now);
}

/**
 * Returns the start of the current month as ISO string YYYY-MM-DD (Brazil timezone)
 */
export function startOfMonthISO(now: Date = new Date()): string {
  return `${todayISO(now).slice(0, 7)}-01`;
}

/**
 * Returns a date N days ago as ISO string YYYY-MM-DD
 */
export function daysAgoISO(days: number, now: Date = new Date()): string {
  return shiftDateKey(todayISO(now), -days);
}

/**
 * Inclusive rolling-window start. A seven-day window containing today starts
 * six calendar days ago, not seven. Keeping this explicit prevents the common
 * `gte(today - 7)` eight-day window bug.
 */
export function inclusiveWindowStartISO(
  days: number,
  now: Date = new Date(),
): string {
  if (!Number.isSafeInteger(days) || days < 1) {
    throw new Error("Window days must be a positive integer.");
  }
  return shiftDateKey(todayISO(now), -(days - 1));
}

export function previousMonthRangeISO(now: Date = new Date()): {
  start: string;
  end: string;
} {
  const currentMonth = startOfMonthISO(now).slice(0, 7);
  const previousMonth = shiftMonthKey(currentMonth, -1);
  const followingMonth = shiftMonthKey(previousMonth, 1);
  return {
    start: `${previousMonth}-01`,
    end: shiftDateKey(`${followingMonth}-01`, -1),
  };
}

/** Previous month, clipped to the same elapsed operator-calendar day. */
export function previousMonthComparableRangeISO(now: Date = new Date()): {
  start: string;
  end: string;
} {
  const currentKey = todayISO(now);
  const previousMonth = shiftMonthKey(currentKey.slice(0, 7), -1);
  const [year, month] = previousMonth.split("-").map(Number);
  const daysInPreviousMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const elapsedDay = Math.min(Number(currentKey.slice(8, 10)), daysInPreviousMonth);
  return {
    start: `${previousMonth}-01`,
    end: `${previousMonth}-${String(elapsedDay).padStart(2, "0")}`,
  };
}

export function operatorMonthProgress(now: Date = new Date()): {
  dayOfMonth: number;
  daysInMonth: number;
} {
  const { year, month, day } = operatorDateParts(now);
  return { dayOfMonth: day, daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}

/**
 * Global Health Audit — War Room hydration P0: format a clock time using
 * the explicit canonical operator timezone, never the runtime's own
 * locale/timezone. `toLocaleTimeString()` with no explicit `timeZone`
 * produces DIFFERENT text on the server (a Cloudflare Worker, which has
 * no real "local" timezone -- effectively UTC) than on the client (the
 * browser's own OS timezone) -- a classic React hydration mismatch
 * (production error #418), and exactly the 3-hour (UTC vs.
 * America/Sao_Paulo) shift the audit observed. Any server/client-rendered
 * clock value in this app must go through this function, never a bare
 * `toLocaleTimeString()` call.
 */
export function formatOperatorTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATOR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/**
 * Format currency. Monday Money Lab P0: accepts an optional explicit
 * currency code (ISO 4217, e.g. "USD", "BRL") -- every call site that
 * already knows its currency should pass it. Defaults to "USD" only
 * because that has always been the only currency this app has ever
 * entered or displayed, preserving every existing call site unchanged.
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get current month name (Brazil timezone)
 */
export function currentMonthName(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATOR_TIME_ZONE,
    month: "long",
  }).format(now);
}

/**
 * Sprint C1 §68: minimal month-navigation vocabulary shared by any surface
 * that needs a "previous/next month" switcher (FX ledger, Personal
 * Finance). A month key is always "YYYY-MM". These are pure string/number
 * helpers -- no Date-object DST or month-length edge cases to worry about.
 */

/**
 * Returns the current month as "YYYY-MM" (Brazil timezone).
 */
export function currentMonthKey(now: Date = new Date()): string {
  return startOfMonthISO(now).slice(0, 7);
}

/**
 * Shifts a "YYYY-MM" month key by N months (positive = later, negative = earlier).
 */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

/**
 * Formats a "YYYY-MM" month key for display, e.g. "August 2026".
 */
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[month - 1]} ${year}`;
}
