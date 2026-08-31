import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCashPocketBalance,
  computePocketDifference,
  validateAccountSnapshotInput,
} from "./core.ts";

test("cash pocket derives opening plus signed movements through snapshot date", () => {
  assert.equal(
    computeCashPocketBalance(
      0.25,
      [
        { date: "2026-08-03", amount: 300 },
        { date: "2026-08-03", amount: -100 },
        { date: "2026-08-31", amount: 99 },
      ],
      "2026-08-30",
    ),
    200.25,
  );
});

test("reserve is independent because each account is computed separately", () => {
  const main = computeCashPocketBalance(0, [{ date: "2026-08-26", amount: -100 }]);
  const reserve = computeCashPocketBalance(0, [{ date: "2026-08-26", amount: 100 }]);
  assert.equal(main, -100);
  assert.equal(reserve, 100);
});

test("pocket difference follows observed minus derived convention", () => {
  assert.equal(computePocketDifference(59.96, 59.96), 0);
  assert.equal(computePocketDifference(60, 59.96), -0.04);
});

test("snapshot validation rejects invalid account/date/amount", () => {
  assert.match(validateAccountSnapshotInput({ cashAccountId: 0, balanceAmount: 1, observedAt: "2026-08-30" }), /invalid/i);
  assert.match(validateAccountSnapshotInput({ cashAccountId: 1, balanceAmount: -1, observedAt: "2026-08-30" }), /non-negative/i);
  assert.match(validateAccountSnapshotInput({ cashAccountId: 1, balanceAmount: 1, observedAt: "08-30-2026" }), /valid date/i);
  assert.equal(validateAccountSnapshotInput({ cashAccountId: 1, balanceAmount: 0, observedAt: "2026-08-30" }), null);
});
