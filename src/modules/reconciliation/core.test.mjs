import assert from "node:assert/strict";
import test from "node:test";
import {
  computeReconciliationDifference,
  isCashCurrency,
  isCashScope,
  validateCashBalanceSnapshotInput,
} from "./core.ts";

test("isCashScope/isCashCurrency accept only the closed vocabulary", () => {
  assert.equal(isCashScope("BUSINESS"), true);
  assert.equal(isCashScope("PERSONAL"), true);
  assert.equal(isCashScope("OTHER"), false);
  assert.equal(isCashCurrency("USD"), true);
  assert.equal(isCashCurrency("BRL"), true);
  assert.equal(isCashCurrency("EUR"), false);
});

test("computeReconciliationDifference: business BRL example from the brief (ledger 120.00, observed 103.58 -> -16.42)", () => {
  const diff = computeReconciliationDifference(120.0, 103.58);
  assert.ok(Math.abs(diff - -16.42) < 0.001);
});

test("computeReconciliationDifference: business USD example matches exactly (163.85 vs 163.85 -> 0)", () => {
  assert.equal(computeReconciliationDifference(163.85, 163.85), 0);
});

test("validateCashBalanceSnapshotInput accepts a well-formed snapshot", () => {
  const result = validateCashBalanceSnapshotInput({
    scope: "BUSINESS",
    currency: "BRL",
    balanceAmount: 103.58,
    observedAt: "2026-08-26",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.source, "WISE_MANUAL");
  assert.equal(result.data.notes, null);
});

test("validateCashBalanceSnapshotInput rejects invalid scope/currency/date/amount", () => {
  const result = validateCashBalanceSnapshotInput({
    scope: "NOPE",
    currency: "EUR",
    balanceAmount: -5,
    observedAt: "not-a-date",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.scope);
  assert.ok(result.errors.currency);
  assert.ok(result.errors.balanceAmount);
  assert.ok(result.errors.observedAt);
});

test("validateCashBalanceSnapshotInput trims and defaults notes/source", () => {
  const result = validateCashBalanceSnapshotInput({
    scope: "PERSONAL",
    currency: "USD",
    balanceAmount: 40,
    observedAt: "2026-08-26",
    notes: "  from Wise app  ",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.notes, "from Wise app");
  assert.equal(result.data.source, "WISE_MANUAL");
});
