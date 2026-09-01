export const BUSINESS_EXPENSE_CATEGORIES = [
  "Software",
  "Subscriptions",
  "Equipment",
  "Banking / Fees",
  "Workspace",
  "Travel",
  "Meals / Production",
  "Contractors",
  "Marketing",
  "Other",
] as const;

export const PERSONAL_EXPENSE_CATEGORIES = [
  "Groceries",
  "Food & Delivery",
  "Transport",
  "Health",
  "Home",
  "Entertainment",
  "Personal Supplies",
  "Substances",
  "Other",
] as const;

export function resolveExpenseCategory(
  selected: string,
  otherDetail: string,
  allowed: readonly string[],
): string | null {
  if (!allowed.includes(selected)) return null;
  if (selected !== "Other") return selected;
  const detail = otherDetail.trim();
  if (!detail || detail.length > 80) return null;
  return `Other — ${detail}`;
}
