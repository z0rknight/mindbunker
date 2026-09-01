// Sprint C1 -- pure logic only. No DB access here (that lives in
// actions.ts); everything below is unit-testable in isolation and is what
// core.test.mjs exercises directly.

import { round2 } from "../finance/core.ts";

export type PersonalTransactionLike = {
  type: "opening_balance" | "owner_pay_receipt" | "income" | "expense";
  amount: number;
  currency: string;
};

export type PersonalBalanceByCurrency = {
  currency: string;
  openingBalance: number;
  ownerPayReceipts: number;
  income: number;
  expenses: number;
  fxNet: number;
  balance: number;
};

// Lunch Reality Patch §5: a PERSONAL-scope fx_conversions row moves cash
// between currencies within Personal Finance -- it is NOT personal income,
// NOT a personal expense, and it never touches Business Cash or Business
// observed FX (that separation lives one level up, in how the caller
// filters fx_conversions by scope before ever reaching this function).
// Same shape and same "fold into balance only" principle as
// computeFxCashMovements' business-side counterpart in finance/core.ts.
export type PersonalFxMovement = { currency: string; amount: number };

export type DatedPersonalTransactionLike = PersonalTransactionLike & {
  date: string;
};

export type DatedPersonalFxMovement = PersonalFxMovement & {
  date: string;
};

export type PersonalFlowByCurrency = {
  currency: string;
  month: string;
  ownerPayIn: number;
  externalIncome: number;
  expenses: number;
  fxNet: number;
  netFlow: number;
};

// September Finance Operator Patch: flow is period activity, not a balance.
// Opening balances never appear here, and FX only changes the currency
// positions involved -- it never becomes income or expense. Keeping this
// separate from computePersonalBalanceByCurrency prevents an Aug 31 closing
// fact from being presented as Sep 1 income.
export function computePersonalFlowByCurrency(
  rows: DatedPersonalTransactionLike[],
  fxMovements: DatedPersonalFxMovement[],
  month: string,
): PersonalFlowByCurrency[] {
  const byCurrency = new Map<
    string,
    { ownerPayIn: number; externalIncome: number; expenses: number; fxNet: number }
  >();

  const getBucket = (currencyRaw: string) => {
    const currency = currencyRaw.trim().toUpperCase();
    const existing = byCurrency.get(currency);
    if (existing) return { currency, bucket: existing };
    const bucket = { ownerPayIn: 0, externalIncome: 0, expenses: 0, fxNet: 0 };
    byCurrency.set(currency, bucket);
    return { currency, bucket };
  };

  for (const row of rows) {
    if (!row.currency.trim() || row.date.slice(0, 7) !== month) continue;
    const { bucket } = getBucket(row.currency);
    if (row.type === "owner_pay_receipt") bucket.ownerPayIn += row.amount;
    else if (row.type === "income") bucket.externalIncome += row.amount;
    else if (row.type === "expense") bucket.expenses += row.amount;
    // opening_balance is deliberately ignored: it is stock, not flow.
  }

  for (const movement of fxMovements) {
    if (!movement.currency.trim() || movement.date.slice(0, 7) !== month) continue;
    getBucket(movement.currency).bucket.fxNet += movement.amount;
  }

  return Array.from(byCurrency.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, bucket]) => ({
      currency,
      month,
      ownerPayIn: round2(bucket.ownerPayIn),
      externalIncome: round2(bucket.externalIncome),
      expenses: round2(bucket.expenses),
      fxNet: round2(bucket.fxNet),
      netFlow: round2(
        bucket.ownerPayIn + bucket.externalIncome - bucket.expenses + bucket.fxNet,
      ),
    }));
}

// Personal cash balance is entirely separate from Business Cash (see
// getRmediaCashSummary in modules/finance/actions.ts) -- there is no
// shared total anywhere. Owner Pay receipts increase this balance but are
// never counted as `income`: `income` here is reserved for genuine
// external personal income (a gift, a second job), never money that
// already passed through RMEDIA Cash. Currency is the first grouping key,
// same discipline as computeFinanceSummaryByCurrency in finance/core.ts --
// a BRL personal expense never touches a USD personal balance.
export function computePersonalBalanceByCurrency(
  rows: PersonalTransactionLike[],
  fxMovements: PersonalFxMovement[] = [],
): PersonalBalanceByCurrency[] {
  const byCurrency = new Map<
    string,
    { openingBalance: number; ownerPayReceipts: number; income: number; expenses: number; fxNet: number }
  >();

  function getBucket(currencyRaw: string) {
    const currency = currencyRaw.trim().toUpperCase();
    const existing = byCurrency.get(currency);
    if (existing) return { currency, bucket: existing };
    const created = { openingBalance: 0, ownerPayReceipts: 0, income: 0, expenses: 0, fxNet: 0 };
    byCurrency.set(currency, created);
    return { currency, bucket: created };
  }

  for (const row of rows) {
    if (!row.currency.trim()) continue;
    const { bucket } = getBucket(row.currency);
    if (row.type === "opening_balance") bucket.openingBalance += row.amount;
    else if (row.type === "owner_pay_receipt") bucket.ownerPayReceipts += row.amount;
    else if (row.type === "income") bucket.income += row.amount;
    else bucket.expenses += row.amount;
  }

  // Folded in a second pass, same as finance/core.ts's business-side
  // equivalent -- can introduce a currency key the transactions loop never
  // saw (e.g. the very first BRL a client ever converted into, with no
  // prior BRL opening balance/expense on record).
  for (const movement of fxMovements) {
    if (!movement.currency.trim()) continue;
    const { bucket } = getBucket(movement.currency);
    bucket.fxNet += movement.amount;
  }

  return Array.from(byCurrency.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, bucket]) => ({
      currency,
      openingBalance: round2(bucket.openingBalance),
      ownerPayReceipts: round2(bucket.ownerPayReceipts),
      income: round2(bucket.income),
      expenses: round2(bucket.expenses),
      fxNet: round2(bucket.fxNet),
      balance: round2(
        bucket.openingBalance + bucket.ownerPayReceipts + bucket.income - bucket.expenses + bucket.fxNet,
      ),
    }));
}

// owner_pay_receipt rows are never entered directly by a human -- they are
// created only by the Owner Pay bridge in finance/actions.ts's
// recordOwnerPay, always paired to a real business transaction. Any direct
// call attempting to create one through the ordinary input form is
// rejected here, not just hidden from the UI.
export function validatePersonalTransactionInput(input: {
  type: string;
  amount: number;
  category: string;
  currency: string;
  date?: string;
}): string | null {
  if (!["opening_balance", "owner_pay_receipt", "income", "expense"].includes(input.type)) {
    return "Invalid personal transaction type.";
  }
  if (input.type === "owner_pay_receipt") {
    return "Owner Pay receipts are created automatically by Record Owner Pay, not entered directly.";
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "Amount must be positive.";
  }
  if (!input.category || !input.category.trim()) return "Category is required.";
  if (!input.currency || !input.currency.trim()) return "Currency is required.";
  if (input.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.date)) return "Enter a valid transaction date.";
    const [year, month, day] = input.date.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.toISOString().slice(0, 10) !== input.date) {
      return "Enter a valid transaction date.";
    }
  }
  return null;
}

// Personal Finance Correction Patch -- a correction path exists ONLY for
// ordinary manually-created rows (income/expense). opening_balance and
// owner_pay_receipt keep their own protected semantics: opening_balance is
// a one-time starting fact, and owner_pay_receipt is the one and only
// proof the Business Cash -> Owner Pay -> Personal Money bridge happened
// for a given business transaction (see personal_transactions_owner_pay_link_check
// in src/db/schema.ts) -- neither is reachable through this validator, so
// neither can be "corrected" into losing its protected meaning.
export type EditablePersonalTransactionType = "income" | "expense";

export function isEditablePersonalTransactionType(
  type: string,
): type is EditablePersonalTransactionType {
  return type === "income" || type === "expense";
}

// Validates an edit to an EXISTING income/expense row -- switching type
// between income <-> expense, or correcting amount/currency/date/notes.
// Deliberately does not touch category (not part of the compact row
// action's required fields) or id (the caller always updates the existing
// row in place, never deletes+recreates -- see updatePersonalTransaction).
export function validatePersonalTransactionCorrectionInput(input: {
  currentType: string;
  nextType: string;
  amount: number;
  currency: string;
  date: string;
}): string | null {
  if (!isEditablePersonalTransactionType(input.currentType)) {
    return "Only Income and Expense rows can be edited here.";
  }
  if (!isEditablePersonalTransactionType(input.nextType)) {
    return "Type must be Income or Expense.";
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "Amount must be positive.";
  }
  if (!input.currency || !input.currency.trim()) return "Currency is required.";
  if (!input.date || !input.date.trim()) return "Date is required.";
  return null;
}

// A row is deletable through the compact row action ONLY if it's an
// ordinary income/expense entry. opening_balance is protected (it's the
// one-time starting fact the whole balance is anchored to); owner_pay_receipt
// is protected because deleting it would silently break the Business Cash
// <-> Personal Money bridge for a real business transaction that already
// happened -- rejecting it outright here means the bridge can never be
// partially broken through this path, full stop.
export function isDeletablePersonalTransactionType(type: string): boolean {
  return isEditablePersonalTransactionType(type);
}
