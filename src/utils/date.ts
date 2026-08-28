/**
 * Get current time in Brazil (GMT-3)
 */
export function nowBrazil(): Date {
  return new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
}

/**
 * Returns today's date as ISO string YYYY-MM-DD (Brazil timezone)
 */
export function todayISO(): string {
  return nowBrazil().toISOString().split("T")[0];
}

/**
 * Returns the start of the current month as ISO string YYYY-MM-DD (Brazil timezone)
 */
export function startOfMonthISO(): string {
  const now = nowBrazil();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Returns a date N days ago as ISO string YYYY-MM-DD
 */
export function daysAgoISO(days: number): string {
  const d = nowBrazil();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
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
export function currentMonthName(): string {
  return nowBrazil().toLocaleString("en-US", { month: "long" });
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
export function currentMonthKey(): string {
  return startOfMonthISO().slice(0, 7);
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
