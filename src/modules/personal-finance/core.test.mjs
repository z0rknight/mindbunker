import test from "node:test";
import assert from "node:assert/strict";
import {
  computePersonalBalanceByCurrency,
  validatePersonalTransactionInput,
  validatePersonalTransactionCorrectionInput,
  isEditablePersonalTransactionType,
  isDeletablePersonalTransactionType,
} from "./core.ts";

// Sprint C1 required human-QA fixture, reproduced exactly:
//   Opening BRL R$500, Owner Pay +R$300, Food -R$80, Transport -R$40
//   -> expected personal BRL cash balance = R$680.
test("computePersonalBalanceByCurrency matches the exact worked fixture", () => {
  const rows = [
    { type: "opening_balance", amount: 500, currency: "BRL" },
    { type: "owner_pay_receipt", amount: 300, currency: "BRL" },
    { type: "expense", amount: 80, currency: "BRL" },
    { type: "expense", amount: 40, currency: "BRL" },
  ];
  const result = computePersonalBalanceByCurrency(rows);
  assert.deepEqual(result, [
    {
      currency: "BRL",
      openingBalance: 500,
      ownerPayReceipts: 300,
      income: 0,
      expenses: 120,
      fxNet: 0,
      balance: 680,
    },
  ]);
});

test("owner pay receipts never count as personal income", () => {
  const result = computePersonalBalanceByCurrency([
    { type: "owner_pay_receipt", amount: 300, currency: "BRL" },
    { type: "income", amount: 50, currency: "BRL" },
  ]);
  assert.equal(result[0].ownerPayReceipts, 300);
  assert.equal(result[0].income, 50);
  assert.equal(result[0].balance, 350);
});

test("currencies never mix -- a USD gift and a BRL expense stay in separate rows", () => {
  const result = computePersonalBalanceByCurrency([
    { type: "opening_balance", amount: 500, currency: "BRL" },
    { type: "income", amount: 100, currency: "USD" },
    { type: "expense", amount: 40, currency: "BRL" },
  ]);
  const brl = result.find((r) => r.currency === "BRL");
  const usd = result.find((r) => r.currency === "USD");
  assert.equal(brl.balance, 460);
  assert.equal(usd.balance, 100);
});

test("an empty ledger produces no currency rows", () => {
  assert.deepEqual(computePersonalBalanceByCurrency([]), []);
});

test("validatePersonalTransactionInput rejects owner_pay_receipt as a direct entry", () => {
  const error = validatePersonalTransactionInput({
    type: "owner_pay_receipt",
    amount: 100,
    category: "Owner Pay",
    currency: "BRL",
  });
  assert.match(error ?? "", /automatically/i);
});

test("validatePersonalTransactionInput accepts opening_balance, income, and expense", () => {
  for (const type of ["opening_balance", "income", "expense"]) {
    assert.equal(
      validatePersonalTransactionInput({ type, amount: 10, category: "Test", currency: "BRL" }),
      null,
    );
  }
});

test("validatePersonalTransactionInput rejects non-positive amounts and blank category/currency", () => {
  assert.match(
    validatePersonalTransactionInput({ type: "expense", amount: 0, category: "Food", currency: "BRL" }) ?? "",
    /amount/i,
  );
  assert.match(
    validatePersonalTransactionInput({ type: "expense", amount: 10, category: "  ", currency: "BRL" }) ?? "",
    /category/i,
  );
  assert.match(
    validatePersonalTransactionInput({ type: "expense", amount: 10, category: "Food", currency: "" }) ?? "",
    /currency/i,
  );
});

// Lunch Reality Patch P1: PERSONAL-scope FX conversions move personal cash
// between currencies but are never income or expense, and never touch
// Business Cash (that separation is enforced by the caller filtering
// fx_conversions by scope before this function ever sees a row).
test("PERSONAL fx movements shift balance only, never income/expense", () => {
  const rows = [{ type: "opening_balance", amount: 500, currency: "BRL" }];
  const fxMovements = [
    { currency: "BRL", amount: -510 },
    { currency: "USD", amount: 100 },
  ];
  const result = computePersonalBalanceByCurrency(rows, fxMovements);
  const brl = result.find((r) => r.currency === "BRL");
  const usd = result.find((r) => r.currency === "USD");
  assert.equal(brl.fxNet, -510);
  assert.equal(brl.income, 0);
  assert.equal(brl.expenses, 0);
  assert.equal(brl.balance, -10);
  assert.equal(usd.fxNet, 100);
  assert.equal(usd.income, 0);
  assert.equal(usd.expenses, 0);
  assert.equal(usd.balance, 100);
});

test("a currency with no fx movement gets fxNet 0 and an unaffected balance", () => {
  const rows = [{ type: "opening_balance", amount: 200, currency: "BRL" }];
  const result = computePersonalBalanceByCurrency(rows, []);
  assert.equal(result[0].fxNet, 0);
  assert.equal(result[0].balance, 200);
});

test("an fx movement can introduce a currency that had no ledger rows at all", () => {
  const fxMovements = [{ currency: "USD", amount: 100 }];
  const result = computePersonalBalanceByCurrency([], fxMovements);
  assert.equal(result.length, 1);
  assert.equal(result[0].currency, "USD");
  assert.equal(result[0].fxNet, 100);
  assert.equal(result[0].balance, 100);
});

// Personal Finance Correction Patch -- a compact correction path for
// ordinary manually-created rows only.
test("isEditablePersonalTransactionType: only income and expense are editable", () => {
  assert.equal(isEditablePersonalTransactionType("income"), true);
  assert.equal(isEditablePersonalTransactionType("expense"), true);
  assert.equal(isEditablePersonalTransactionType("opening_balance"), false);
  assert.equal(isEditablePersonalTransactionType("owner_pay_receipt"), false);
});

test("isDeletablePersonalTransactionType matches editability exactly", () => {
  assert.equal(isDeletablePersonalTransactionType("income"), true);
  assert.equal(isDeletablePersonalTransactionType("expense"), true);
  assert.equal(isDeletablePersonalTransactionType("opening_balance"), false);
  assert.equal(isDeletablePersonalTransactionType("owner_pay_receipt"), false);
});

test("validatePersonalTransactionCorrectionInput: the QA case -- income corrected to expense is valid", () => {
  const error = validatePersonalTransactionCorrectionInput({
    currentType: "income",
    nextType: "expense",
    amount: 38.99,
    currency: "BRL",
    date: "2026-08-25",
  });
  assert.equal(error, null);
});

test("validatePersonalTransactionCorrectionInput: expense corrected back to income is valid", () => {
  const error = validatePersonalTransactionCorrectionInput({
    currentType: "expense",
    nextType: "income",
    amount: 10,
    currency: "USD",
    date: "2026-08-01",
  });
  assert.equal(error, null);
});

test("validatePersonalTransactionCorrectionInput: opening_balance and owner_pay_receipt are never editable, even to themselves", () => {
  assert.match(
    validatePersonalTransactionCorrectionInput({
      currentType: "opening_balance",
      nextType: "opening_balance",
      amount: 10,
      currency: "BRL",
      date: "2026-08-01",
    }) ?? "",
    /only income and expense/i,
  );
  assert.match(
    validatePersonalTransactionCorrectionInput({
      currentType: "owner_pay_receipt",
      nextType: "owner_pay_receipt",
      amount: 10,
      currency: "BRL",
      date: "2026-08-01",
    }) ?? "",
    /only income and expense/i,
  );
});

test("validatePersonalTransactionCorrectionInput: an income/expense row can never be converted into opening_balance or owner_pay_receipt", () => {
  assert.match(
    validatePersonalTransactionCorrectionInput({
      currentType: "income",
      nextType: "owner_pay_receipt",
      amount: 10,
      currency: "BRL",
      date: "2026-08-01",
    }) ?? "",
    /Income or Expense/i,
  );
  assert.match(
    validatePersonalTransactionCorrectionInput({
      currentType: "expense",
      nextType: "opening_balance",
      amount: 10,
      currency: "BRL",
      date: "2026-08-01",
    }) ?? "",
    /Income or Expense/i,
  );
});

test("validatePersonalTransactionCorrectionInput: rejects non-positive amounts and blank currency/date", () => {
  assert.match(
    validatePersonalTransactionCorrectionInput({
      currentType: "income",
      nextType: "expense",
      amount: 0,
      currency: "BRL",
      date: "2026-08-25",
    }) ?? "",
    /amount/i,
  );
  assert.match(
    validatePersonalTransactionCorrectionInput({
      currentType: "income",
      nextType: "expense",
      amount: 10,
      currency: "  ",
      date: "2026-08-25",
    }) ?? "",
    /currency/i,
  );
  assert.match(
    validatePersonalTransactionCorrectionInput({
      currentType: "income",
      nextType: "expense",
      amount: 10,
      currency: "BRL",
      date: "",
    }) ?? "",
    /date/i,
  );
});
