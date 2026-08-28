// Sprint C1 -- Personal Finance foundation. Deliberately its own domain,
// not a category tag on the Business Finance `transactions` table: see
// personal_transactions in src/db/schema.ts.

export const PERSONAL_TRANSACTION_TYPES = [
  "opening_balance",
  "owner_pay_receipt",
  "income",
  "expense",
] as const;
export type PersonalTransactionType = (typeof PERSONAL_TRANSACTION_TYPES)[number];

export function isPersonalTransactionType(
  value: unknown,
): value is PersonalTransactionType {
  return (
    typeof value === "string" &&
    (PERSONAL_TRANSACTION_TYPES as readonly string[]).includes(value)
  );
}
