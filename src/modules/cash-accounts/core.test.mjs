import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCashPocketBalance,
  computePocketDifference,
  validateAccountSnapshotInput,
  validateInternalPocketPair,
  validateInternalPocketTransferInput,
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

test("internal pocket transfer validates amount, identity, and preserves currency", () => {
  const valid = {
    fromAccountId: 1,
    toAccountId: 2,
    amount: 50,
    date: "2026-08-31",
    idempotencyKey: "pocket-transfer:11111111-1111-4111-8111-111111111111",
  };
  assert.equal(validateInternalPocketTransferInput(valid), null);
  assert.match(validateInternalPocketTransferInput({ ...valid, amount: 0 }) ?? "", /positive/i);
  assert.match(validateInternalPocketTransferInput({ ...valid, toAccountId: 1 }) ?? "", /different/i);
  assert.equal(validateInternalPocketPair(
    { id: 1, scope: "PERSONAL", currency: "USD" },
    { id: 2, scope: "PERSONAL", currency: "USD" },
    "PERSONAL",
  ), null);
  assert.match(validateInternalPocketPair(
    { id: 1, scope: "PERSONAL", currency: "USD" },
    { id: 2, scope: "PERSONAL", currency: "BRL" },
    "PERSONAL",
  ) ?? "", /same currency/i);
});

test("Aug 31 canonical deltas close all seven Wise pockets exactly", () => {
  const fixtures = [
    [68.85, [300, -200, -40], 128.85],
    [100, [200], 300],
    [59.96, [205.54, -170], 95.5],
    [0, [438.75, -300, -28, -50], 60.75],
    [0, [50], 50],
    [37.72, [143.94, 170, -167.88, -20, -111], 52.78],
    [33.16, [], 33.16],
  ];
  for (const [opening, deltas, expected] of fixtures) {
    assert.equal(computeCashPocketBalance(opening, deltas.map((amount) => ({ amount, date: "2026-08-31" }))), expected);
  }
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
