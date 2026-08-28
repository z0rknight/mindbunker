// Monday Money Lab P0 -- minimal shared vocabulary for the Finance module's
// new commercial-contract / billing-evidence / cash-flow concepts. Kept
// deliberately small: no automatic FX, no tax-law encoding, no Upwork API
// client config. Extend only when a new, real, human-approved need appears.

export const CONTRACT_BILLING_TYPES = ["HOURLY", "FIXED"] as const;
export type ContractBillingType = (typeof CONTRACT_BILLING_TYPES)[number];

export const CONTRACT_STATUSES = ["ACTIVE", "PAUSED", "ENDED"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const BILLING_EVIDENCE_SOURCES = [
  "MANUAL",
  "CSV_IMPORT",
  "UPWORK_REPORT",
] as const;
export type BillingEvidenceSource = (typeof BILLING_EVIDENCE_SOURCES)[number];

// Extends the pre-existing "income" | "expense" vocabulary with
// "owner_pay" -- see the transactions table comment in src/db/schema.ts
// for why this is a third type rather than a flavor of "expense".
export const TRANSACTION_TYPES = ["income", "expense", "owner_pay"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// This app has only ever entered/displayed USD (see formatCurrency in
// src/utils/date.ts) -- this constant documents that fact, it does not
// assert it will always be true.
export const DEFAULT_CURRENCY = "USD";

// Experimental cash-planning default, not a tax rate. Emmanuel can change
// it per docs/architecture/MONDAY_MONEY_LAB_P0.md §9.
export const DEFAULT_TAX_RESERVE_PERCENT = 10;

// Temporary manual operating rate. This is display/configuration context
// only: transaction ledgers and every per-currency subtotal remain in their
// original currency.
export const EFFECTIVE_USD_TO_BRL_RATE = 5.1;

export function isContractBillingType(
  value: unknown,
): value is ContractBillingType {
  return (
    typeof value === "string" &&
    (CONTRACT_BILLING_TYPES as readonly string[]).includes(value)
  );
}

export function isContractStatus(value: unknown): value is ContractStatus {
  return (
    typeof value === "string" &&
    (CONTRACT_STATUSES as readonly string[]).includes(value)
  );
}

export function isBillingEvidenceSource(
  value: unknown,
): value is BillingEvidenceSource {
  return (
    typeof value === "string" &&
    (BILLING_EVIDENCE_SOURCES as readonly string[]).includes(value)
  );
}

// Monday Pre-Freeze Consolidation P0: billing allocation methods (§13).
export const BILLING_ALLOCATION_METHODS = [
  "MANUAL_AMOUNT",
  "MANUAL_MINUTES",
  "DERIVED_PROPORTION",
] as const;
export type BillingAllocationMethod = (typeof BILLING_ALLOCATION_METHODS)[number];

// §16: debt lifecycle.
export const DEBT_STATUSES = ["ACTIVE", "PAID"] as const;
export type DebtStatus = (typeof DEBT_STATUSES)[number];

// §17: subscription billing cadence + lifecycle.
export const SUBSCRIPTION_CADENCES = ["MONTHLY", "ANNUAL"] as const;
export type SubscriptionCadence = (typeof SUBSCRIPTION_CADENCES)[number];

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "CANCELLED", "TRIAL"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// §6: the exact category value that triggers the "Freelance income cannot
// be orphaned" invariant. Matched case-insensitively against
// transactions.category -- see transactions_freelance_requires_client_check
// in src/db/schema.ts, which enforces this same rule at the DB level.
export const FREELANCE_CATEGORY = "Freelance";

export function isFreelanceCategory(category: string): boolean {
  return category.trim().toLowerCase() === FREELANCE_CATEGORY.toLowerCase();
}

export function isBillingAllocationMethod(
  value: unknown,
): value is BillingAllocationMethod {
  return (
    typeof value === "string" &&
    (BILLING_ALLOCATION_METHODS as readonly string[]).includes(value)
  );
}
