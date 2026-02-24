/**
 * Returns today's date as ISO string YYYY-MM-DD
 */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Returns the start of the current month as ISO string YYYY-MM-DD
 */
export function startOfMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Returns a date N days ago as ISO string YYYY-MM-DD
 */
export function daysAgoISO(days: number): string {
  const d = new Date();
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
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get current month name
 */
export function currentMonthName(): string {
  return new Date().toLocaleString("en-US", { month: "long" });
}
