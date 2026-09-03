import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCashPocketBalance,
  computePocketDifference,
  computeCashHeadlineByCurrency,
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

test("cash headline sums MAIN pockets as available and RESERVE pockets as reserved, per currency", () => {
  const rows = computeCashHeadlineByCurrency([
    {
      currency: "USD",
      pocket: "MAIN",
      ledgerAmount: 128.85,
      observed: { amount: 128.85, observedAt: "2026-08-31", source: "WISE_PDF" },
    },
    {
      currency: "USD",
      pocket: "RESERVE",
      ledgerAmount: 300,
      observed: { amount: 300, observedAt: "2026-08-31", source: "WISE_PDF" },
    },
    {
      currency: "BRL",
      pocket: "MAIN",
      ledgerAmount: 995.5,
      observed: { amount: 995.5, observedAt: "2026-08-31", source: "WISE_PDF" },
    },
  ]);

  const usd = rows.find((row) => row.currency === "USD");
  assert.ok(usd);
  assert.equal(usd.availableAmount, 128.85);
  assert.equal(usd.availableObserved, true);
  assert.equal(usd.reservedAmount, 300);
  assert.equal(usd.reservedObserved, true);

  const brl = rows.find((row) => row.currency === "BRL");
  assert.ok(brl);
  assert.equal(brl.availableAmount, 995.5);
  // No RESERVE pocket contributed for BRL, so it stays at 0 and (vacuously) observed.
  assert.equal(brl.reservedAmount, 0);
});

test("cash headline never mixes currencies together", () => {
  const rows = computeCashHeadlineByCurrency([
    { currency: "USD", pocket: "MAIN", ledgerAmount: 100, observed: null },
    { currency: "BRL", pocket: "MAIN", ledgerAmount: 500, observed: null },
  ]);
  assert.equal(rows.length, 2);
  const usd = rows.find((row) => row.currency === "USD");
  const brl = rows.find((row) => row.currency === "BRL");
  assert.equal(usd.availableAmount, 100);
  assert.equal(brl.availableAmount, 500);
});

test("cash headline flags a currency total as unobserved when any contributing pocket lacks a real snapshot", () => {
  const rows = computeCashHeadlineByCurrency([
    {
      currency: "USD",
      pocket: "MAIN",
      ledgerAmount: 918.85,
      observed: null, // no real bank snapshot behind this pocket yet
    },
  ]);
  const usd = rows.find((row) => row.currency === "USD");
  assert.equal(usd.availableAmount, 918.85);
  assert.equal(
    usd.availableObserved,
    false,
    "an unreconciled pocket must never be presented as verified cash",
  );
});

test("cash headline falls back to the ledger figure only when no observed snapshot exists, and still flags it unverified", () => {
  const rows = computeCashHeadlineByCurrency([
    { currency: "USD", pocket: "RESERVE", ledgerAmount: 200, observed: null },
  ]);
  const usd = rows.find((row) => row.currency === "USD");
  assert.equal(usd.reservedAmount, 200);
  assert.equal(usd.reservedObserved, false);
  assert.equal(usd.reservedAsOf, null);
});

