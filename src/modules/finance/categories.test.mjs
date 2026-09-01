import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_EXPENSE_CATEGORIES,
  PERSONAL_EXPENSE_CATEGORIES,
  resolveExpenseCategory,
} from "./categories.ts";

test("manual business and personal expenses use canonical options", () => {
  assert.equal(resolveExpenseCategory("Software", "", BUSINESS_EXPENSE_CATEGORIES), "Software");
  assert.equal(resolveExpenseCategory("Groceries", "", PERSONAL_EXPENSE_CATEGORIES), "Groceries");
  assert.equal(resolveExpenseCategory("Mercado", "", PERSONAL_EXPENSE_CATEGORIES), null);
});

test("Other requires and preserves a short operator detail", () => {
  assert.equal(resolveExpenseCategory("Other", "  Client prop  ", BUSINESS_EXPENSE_CATEGORIES), "Other — Client prop");
  assert.equal(resolveExpenseCategory("Other", "", BUSINESS_EXPENSE_CATEGORIES), null);
  assert.equal(resolveExpenseCategory("Other", "x".repeat(81), BUSINESS_EXPENSE_CATEGORIES), null);
});
