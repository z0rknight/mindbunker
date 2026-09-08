import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBillingEvidenceIdempotencyKey,
  computeReconciliation,
  computeFinanceSummaryByCurrency,
  computeEconomicLedgerPlanning,
  convertUsdToBrl,
  formatMinutesAsHours,
  validateBillingEvidenceInput,
  validateContractInput,
  validateIncomeContractAttribution,
  computeRateEquivalent,
  validateOwnerPayCorrectionInput,
  validateTransactionCorrectionInput,
  computeClientOperationalMinutes,
} from "./core.ts";

test("transaction corrections require positive amounts, real dates, and explicit currencies", () => {
  const valid = { amount: 140, category: "Software", date: "2026-08-24", currency: "USD" };
  assert.equal(validateTransactionCorrectionInput(valid), null);
  assert.match(validateTransactionCorrectionInput({ ...valid, amount: 0 }) ?? "", /positive/u);
  assert.match(validateTransactionCorrectionInput({ ...valid, date: "2026-02-30" }) ?? "", /valid transaction date/u);
  assert.match(validateTransactionCorrectionInput({ ...valid, currency: "US" }) ?? "", /three-letter/u);
  assert.equal(validateOwnerPayCorrectionInput({ amount: 140, date: "2026-08-24", currency: "USD" }), null);
});

// Real Taryn Dubreuil / Upwork fixture from the Monday Money Lab P0 brief:
//   Period 2026-08-10..2026-08-16, Upwork billed 15h10 (910 min), rate
//   USD 25/hour, gross USD 379.17. MindBunker operational tracked 16h02
//   (962 min) for the same window, per the brief's worked example.
const TARYN_BILLED_MINUTES = 15 * 60 + 10; // 910
const TARYN_OPERATIONAL_MINUTES = 16 * 60 + 2; // 962
const TARYN_RATE = 25;
const TARYN_GROSS = 379.17;

test("formatMinutesAsHours matches the brief's exact display convention", () => {
  assert.equal(formatMinutesAsHours(TARYN_BILLED_MINUTES), "15h10");
  assert.equal(formatMinutesAsHours(TARYN_OPERATIONAL_MINUTES), "16h02");
  assert.equal(formatMinutesAsHours(52), "0h52");
  assert.equal(formatMinutesAsHours(0), "0h00");
});

test("computeReconciliation reproduces the real Taryn worked example", () => {
  const result = computeReconciliation({
    operationalMinutes: TARYN_OPERATIONAL_MINUTES,
    billingEvidence: {
      billableMinutes: TARYN_BILLED_MINUTES,
      rate: TARYN_RATE,
      grossAmount: TARYN_GROSS,
      currency: "USD",
    },
  });

  assert.equal(result.operationalMinutes.value, 962);
  assert.equal(result.operationalMinutes.provenance, "SOURCE_FACT");
  assert.equal(result.billedMinutes.value, 910);
  assert.equal(result.billedMinutes.provenance, "SOURCE_FACT");
  // Difference is 52 minutes -- an observed mismatch, not an error.
  assert.equal(result.differenceMinutes.value, 52);
  assert.equal(result.differenceMinutes.provenance, "DERIVED");
  assert.equal(result.contractRate.value, 25);
  assert.equal(result.grossBilled.value, 379.17);
  // Gross / operational hour = 379.17 / (962/60) = 23.648856... -> 23.65
  assert.equal(result.grossPerOperationalHour.value, 23.65);
  assert.equal(result.grossPerOperationalHour.provenance, "DERIVED");
  assert.equal(result.currency, "USD");
});

test("computeReconciliation never fabricates a value when no billing evidence exists yet", () => {
  const result = computeReconciliation({
    operationalMinutes: TARYN_OPERATIONAL_MINUTES,
    billingEvidence: null,
  });

  assert.equal(result.operationalMinutes.value, 962);
  assert.equal(result.operationalMinutes.provenance, "SOURCE_FACT");
  assert.equal(result.billedMinutes.value, null);
  assert.equal(result.billedMinutes.provenance, "UNATTRIBUTED");
  assert.equal(result.differenceMinutes.value, null);
  assert.equal(result.grossPerOperationalHour.value, null);
  assert.equal(result.currency, null);
});

test("computeReconciliation returns null (not Infinity/NaN) gross-per-hour when zero operational minutes", () => {
  const result = computeReconciliation({
    operationalMinutes: 0,
    billingEvidence: {
      billableMinutes: TARYN_BILLED_MINUTES,
      rate: TARYN_RATE,
      grossAmount: TARYN_GROSS,
      currency: "USD",
    },
  });

  assert.equal(result.grossPerOperationalHour.value, null);
  assert.equal(result.grossPerOperationalHour.provenance, "UNATTRIBUTED");
  // The mismatch itself is still an observed, reportable fact.
  assert.equal(result.differenceMinutes.value, -910);
});

test("buildBillingEvidenceIdempotencyKey is deterministic and re-import-safe", () => {
  const base = {
    contractId: 1,
    periodStart: "2026-08-10",
    periodEnd: "2026-08-16",
    source: "MANUAL",
    externalReference: null,
  };
  const key1 = buildBillingEvidenceIdempotencyKey(base);
  const key2 = buildBillingEvidenceIdempotencyKey({ ...base });
  assert.equal(key1, key2);

  // A different period produces a different key.
  const key3 = buildBillingEvidenceIdempotencyKey({
    ...base,
    periodStart: "2026-08-17",
    periodEnd: "2026-08-23",
  });
  assert.notEqual(key1, key3);

  // Blank vs missing external reference normalize to the same key.
  const key4 = buildBillingEvidenceIdempotencyKey({ ...base, externalReference: "  " });
  assert.equal(key1, key4);
});

test("computeEconomicLedgerPlanning projects planning from the canonical Economic Ledger Net", () => {
  const summary = computeEconomicLedgerPlanning({
    totalIncome: 1000,
    economicLedgerNet: 1000,
    taxReservePercent: 10,
  });
  assert.equal(summary.economicLedgerNet, 1000);
  assert.equal(summary.taxReserve, 100);
  assert.equal(summary.availableLedgerNet, 900);
});

test("computeEconomicLedgerPlanning never reconstructs the ledger formula independently", () => {
  const summary = computeEconomicLedgerPlanning({
    totalIncome: 1000,
    economicLedgerNet: 650,
    taxReservePercent: 10,
  });
  assert.equal(summary.economicLedgerNet, 650);
  assert.equal(summary.taxReserve, 100);
  assert.equal(summary.availableLedgerNet, 550);
});

test("finance summary never lets a BRL expense alter the USD ledger", () => {
  const result = computeFinanceSummaryByCurrency([
    { type: "income", amount: 343.75, currency: "USD", date: "2026-08-24" },
    { type: "owner_pay", amount: 140, currency: "USD", date: "2026-08-24" },
    { type: "expense", amount: 100, currency: "BRL", date: "2026-08-24" },
  ], "2026-08-01");

  assert.deepEqual(result, [
    { currency: "BRL", totalIncome: 0, totalExpenses: 100, totalOwnerPay: 0, monthlyRevenue: 0, monthlyExpenses: 100, monthlyNet: -100, economicLedgerNet: -100 },
    { currency: "USD", totalIncome: 343.75, totalExpenses: 0, totalOwnerPay: 140, monthlyRevenue: 343.75, monthlyExpenses: 0, monthlyNet: 343.75, economicLedgerNet: 203.75 },
  ]);
});

test("equal numeric amounts in different currencies remain separate", () => {
  const result = computeFinanceSummaryByCurrency([
    { type: "income", amount: 100, currency: "USD", date: "2026-08-24" },
    { type: "expense", amount: 100, currency: "BRL", date: "2026-08-24" },
  ], "2026-08-01");
  assert.equal(result.find((row) => row.currency === "USD")?.economicLedgerNet, 100);
  assert.equal(result.find((row) => row.currency === "BRL")?.economicLedgerNet, -100);
});

test("finance month grouping does not pull a future month across Aug 31 / Sep 1", () => {
  const result = computeFinanceSummaryByCurrency([
    { type: "income", amount: 100, currency: "USD", date: "2026-08-31" },
    { type: "income", amount: 200, currency: "USD", date: "2026-09-01" },
  ], "2026-08-01");
  assert.equal(result[0].monthlyRevenue, 100);
  assert.equal(result[0].economicLedgerNet, 300);
});

test("effective FX converts USD to BRL only in an explicit derived view", () => {
  assert.equal(convertUsdToBrl(203.75), 1039.13);
});

test("validateContractInput enforces the real Taryn fixture shape", () => {
  const tarynContract = {
    clientId: 1,
    platform: "Upwork",
    billingType: "HOURLY",
    hourlyRate: 25,
    currency: "USD",
  };
  assert.equal(validateContractInput(tarynContract), null);

  assert.match(
    validateContractInput({ ...tarynContract, clientId: null }) ?? "",
    /client/i,
  );
  assert.match(
    validateContractInput({ ...tarynContract, hourlyRate: null }) ?? "",
    /hourly rate/i,
  );
  assert.match(
    validateContractInput({ ...tarynContract, billingType: "WEIRD" }) ?? "",
    /HOURLY or FIXED/i,
  );
});

test("validateContractInput allows FIXED contracts without an hourly rate", () => {
  assert.equal(
    validateContractInput({
      clientId: 1,
      platform: "Direct",
      billingType: "FIXED",
      hourlyRate: null,
      currency: "USD",
    }),
    null,
  );
});

test("income attribution rejects a contract from another client and accepts the canonical owner", () => {
  assert.equal(
    validateIncomeContractAttribution({ requestedClientId: 2, contract: { clientId: 2 } }),
    null,
  );
  assert.match(
    validateIncomeContractAttribution({ requestedClientId: 3, contract: { clientId: 2 } }) ?? "",
    /does not belong/i,
  );
  assert.match(
    validateIncomeContractAttribution({ requestedClientId: 2, contract: null }) ?? "",
    /not found/i,
  );
});

test("validateBillingEvidenceInput enforces the real Taryn fixture shape", () => {
  const tarynEvidence = {
    periodStart: "2026-08-10",
    periodEnd: "2026-08-16",
    billableMinutes: TARYN_BILLED_MINUTES,
    rate: TARYN_RATE,
    grossAmount: TARYN_GROSS,
    currency: "USD",
  };
  assert.equal(validateBillingEvidenceInput(tarynEvidence), null);

  assert.match(
    validateBillingEvidenceInput({
      ...tarynEvidence,
      periodEnd: "2026-08-01",
    }) ?? "",
    /before period start/i,
  );
  assert.match(
    validateBillingEvidenceInput({ ...tarynEvidence, billableMinutes: -1 }) ?? "",
    /billable minutes/i,
  );
});

// ─── Monday Pre-Freeze Consolidation P0 ────────────────────────────────────

import {
  computeCashReconciliation,
  computeDebtRemainingBalance,
  computeDerivedProportionAllocation,
  computeMonthlyEquivalent,
  validateBillingAllocationInput,
  validateDebtInput,
  validateFreelanceIncomeInput,
  validatePlatformFeeInput,
  validateSubscriptionInput,
} from "./core.ts";

// Real Taryn platform-fee/cash fixture from the Monday Pre-Freeze brief:
//   Gross billed USD 379.17, platform fee USD 37.92 -> derived net
//   379.17 - 37.92 = 341.25, while USD 343.75 actually arrives in Wise.
//   This is a REAL, deliberately-unresolved discrepancy.
test("computeCashReconciliation reproduces the real Taryn gross/fee/cash discrepancy without hiding it", () => {
  const result = computeCashReconciliation({
    grossBilled: 379.17,
    platformFees: [37.92],
    cashReceived: 343.75,
    currency: "USD",
  });

  assert.equal(result.grossBilled.value, 379.17);
  assert.equal(result.grossBilled.provenance, "SOURCE_FACT");
  assert.equal(result.platformFeesTotal.value, 37.92);
  assert.equal(result.platformFeesTotal.provenance, "SOURCE_FACT");
  assert.equal(result.derivedNetProceeds.value, 341.25);
  assert.equal(result.derivedNetProceeds.provenance, "DERIVED");
  assert.equal(result.cashReceived.value, 343.75);
  // The discrepancy: 343.75 - 341.25 = 2.50, exposed, not "fixed".
  assert.equal(result.differenceFromDerivedNet.value, 2.5);
  assert.equal(result.differenceFromDerivedNet.provenance, "DERIVED");
});

test("computeCashReconciliation never fabricates cash received before a transaction is linked", () => {
  const result = computeCashReconciliation({
    grossBilled: 379.17,
    platformFees: [37.92],
    cashReceived: null,
    currency: "USD",
  });
  assert.equal(result.cashReceived.value, null);
  assert.equal(result.cashReceived.provenance, "UNATTRIBUTED");
  assert.equal(result.differenceFromDerivedNet.value, null);
  // Net proceeds are still computable from gross + fee alone.
  assert.equal(result.derivedNetProceeds.value, 341.25);
});

test("computeCashReconciliation marks platform fees UNATTRIBUTED when none recorded yet", () => {
  const result = computeCashReconciliation({
    grossBilled: 379.17,
    platformFees: [],
    cashReceived: null,
    currency: "USD",
  });
  assert.equal(result.platformFeesTotal.value, 0);
  assert.equal(result.platformFeesTotal.provenance, "UNATTRIBUTED");
  // No hardcoded 10% (or any) fee rule -- absent evidence means zero fees
  // known so far, not an assumed fee.
  assert.equal(result.derivedNetProceeds.value, 379.17);
});

test("validatePlatformFeeInput rejects negative fees", () => {
  assert.equal(validatePlatformFeeInput({ amount: 37.92, currency: "USD" }), null);
  assert.match(
    validatePlatformFeeInput({ amount: -1, currency: "USD" }) ?? "",
    /zero or positive/i,
  );
});

test("validateFreelanceIncomeInput requires a client only for Freelance income, case-insensitively", () => {
  assert.match(
    validateFreelanceIncomeInput({ category: "Freelance", type: "income", clientId: null }) ?? "",
    /client/i,
  );
  assert.match(
    validateFreelanceIncomeInput({ category: "FREELANCE", type: "income", clientId: null }) ?? "",
    /client/i,
  );
  assert.equal(
    validateFreelanceIncomeInput({ category: "Freelance", type: "income", clientId: 1 }),
    null,
  );
  // Non-Freelance income, and non-income transactions, are unaffected.
  assert.equal(
    validateFreelanceIncomeInput({ category: "Other", type: "income", clientId: null }),
    null,
  );
  assert.equal(
    validateFreelanceIncomeInput({ category: "Freelance", type: "expense", clientId: null }),
    null,
  );
});

test("computeDerivedProportionAllocation splits gross by tracked-minute share and always labels DERIVED at the call site", () => {
  // 0434 + 0435 account for 70% of tracked client time in the brief's example.
  const slices = computeDerivedProportionAllocation({
    grossAmount: 379.17,
    videoMinutes: [
      { videoId: 434, minutes: 420 }, // 7h
      { videoId: 435, minutes: 240 }, // 4h -> together 660/943 min = 70%
      { videoId: 999, minutes: 283 }, // remaining 30%
    ],
  });
  const total = slices.reduce((s, x) => s + x.derivedAmount, 0);
  assert.ok(Math.abs(total - 379.17) < 0.02);
  const v434 = slices.find((s) => s.videoId === 434);
  assert.ok(v434.proportion > 0.4 && v434.proportion < 0.46);
});

test("computeDerivedProportionAllocation returns nothing (not divide-by-zero) when no operational minutes exist", () => {
  const slices = computeDerivedProportionAllocation({
    grossAmount: 379.17,
    videoMinutes: [],
  });
  assert.deepEqual(slices, []);
});

test("validateBillingAllocationInput enforces non-negative amount and currency", () => {
  assert.equal(
    validateBillingAllocationInput({ method: "MANUAL_AMOUNT", amount: 100, currency: "USD" }),
    null,
  );
  assert.match(
    validateBillingAllocationInput({ method: "MANUAL_AMOUNT", amount: -5, currency: "USD" }) ?? "",
    /zero or positive/i,
  );
});

test("computeDebtRemainingBalance derives from original amount minus real payments, never a stored mutable field", () => {
  assert.equal(
    computeDebtRemainingBalance({ originalAmount: 2000, paymentsTotal: 200 }),
    1800,
  );
  assert.equal(
    computeDebtRemainingBalance({ originalAmount: 2000, paymentsTotal: 0 }),
    2000,
  );
  assert.equal(
    computeDebtRemainingBalance({ originalAmount: 2000, paymentsTotal: 2000 }),
    0,
  );
});

test("validateDebtInput requires name, creditor, positive amount, currency", () => {
  const good = { name: "Camera gear loan", creditor: "Mom", originalAmount: 2000, currency: "USD" };
  assert.equal(validateDebtInput(good), null);
  assert.match(validateDebtInput({ ...good, name: "" }) ?? "", /name/i);
  assert.match(validateDebtInput({ ...good, originalAmount: 0 }) ?? "", /positive/i);
});

test("computeMonthlyEquivalent divides ANNUAL by 12 and never charges MONTHLY subscriptions differently", () => {
  assert.equal(computeMonthlyEquivalent({ amount: 120, cadence: "ANNUAL" }), 10);
  assert.equal(computeMonthlyEquivalent({ amount: 15, cadence: "MONTHLY" }), 15);
});

test("validateSubscriptionInput enforces required fields and a real cadence", () => {
  const good = { name: "Creative Cloud", vendor: "Adobe", amount: 120, currency: "USD", cadence: "ANNUAL" };
  assert.equal(validateSubscriptionInput(good), null);
  assert.match(validateSubscriptionInput({ ...good, cadence: "WEEKLY" }) ?? "", /MONTHLY or ANNUAL/i);
  assert.match(validateSubscriptionInput({ ...good, amount: 0 }) ?? "", /positive/i);
});

// ─── NIGHT SHIFT REALITY PATCH §6: rate-equivalent ─────────────────────────

test("computeRateEquivalent: matches the brief's worked example (3h attributable at $25/h = $75)", () => {
  const result = computeRateEquivalent(3 * 3600, 25, "USD");
  assert.equal(result.rateEquivalent, 75);
  assert.equal(result.currency, "USD");
  assert.equal(result.hourlyRate, 25);
});

test("computeRateEquivalent: fractional hours round to cents, never to a whole dollar", () => {
  // 3h02m = 3.0333...h at $25/h = $75.8333... -> $75.83
  const result = computeRateEquivalent(3 * 3600 + 2 * 60, 25, "USD");
  assert.equal(result.rateEquivalent, 75.83);
});

test("computeRateEquivalent: zero attributable seconds is zero, not omitted or null", () => {
  assert.equal(computeRateEquivalent(0, 25, "USD").rateEquivalent, 0);
});

test("computeRateEquivalent: currency is preserved, never converted", () => {
  const result = computeRateEquivalent(3600, 100, "BRL");
  assert.equal(result.currency, "BRL");
  assert.equal(result.rateEquivalent, 100);
});

test("business FX moves cash between currencies without touching revenue or expenses", () => {
  const summary = computeFinanceSummaryByCurrency(
    [
      { type: "income", amount: 203.75, currency: "USD", date: "2026-08-24" },
    ],
    "2026-08-01",
    [
      { currency: "USD", amount: -100 },
      { currency: "BRL", amount: 510 },
    ],
  );

  assert.deepEqual(summary, [
    {
      currency: "BRL",
      totalIncome: 0,
      totalExpenses: 0,
      totalOwnerPay: 0,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      monthlyNet: 0,
      economicLedgerNet: 510,
    },
    {
      currency: "USD",
      totalIncome: 203.75,
      totalExpenses: 0,
      totalOwnerPay: 0,
      monthlyRevenue: 203.75,
      monthlyExpenses: 0,
      monthlyNet: 203.75,
      economicLedgerNet: 103.75,
    },
  ]);
});

test("a BRL subscription charge reduces converted BRL cash and creates a BRL expense only", () => {
  const summary = computeFinanceSummaryByCurrency(
    [
      { type: "income", amount: 203.75, currency: "USD", date: "2026-08-24" },
      { type: "expense", amount: 250, currency: "BRL", date: "2026-08-25" },
    ],
    "2026-08-01",
    [
      { currency: "USD", amount: -100 },
      { currency: "BRL", amount: 510 },
    ],
  );

  assert.equal(summary.find((row) => row.currency === "BRL")?.economicLedgerNet, 260);
  assert.equal(summary.find((row) => row.currency === "BRL")?.monthlyExpenses, 250);
  assert.equal(summary.find((row) => row.currency === "USD")?.economicLedgerNet, 103.75);
  assert.equal(summary.find((row) => row.currency === "USD")?.monthlyExpenses, 0);
});
// P0 POST-AUDIT FIX (DR-2) -- computeClientOperationalMinutes tests.
// These exercise the actual derivation function directly (not a
// reimplementation of its logic), per the Post-Audit Root Fix Wave
// mission's explicit instruction to "prefer testing the actual
// query/derivation rather than reproducing its logic in the test." Rows
// mirror exactly what CLIENT_OPERATIONAL_SESSIONS_SQL returns (raw
// started_at/ended_at unix-seconds + video_kind, no day/kind filtering
// applied by SQL) so these tests are proving the same JS filtering path
// production actually runs, not a parallel mock of it.
//
// Fixture timestamps and their America/Sao_Paulo local-day resolution
// (verified independently via Intl.DateTimeFormat before writing these
// tests, not asserted blind):
//   2026-08-15T14:00:00Z (1786802400) -> local day 2026-08-15
//   2026-08-15T01:00:00Z (1786755600) -> local day 2026-08-14 (!)
//     -- this is the exact UTC-vs-local-day boundary case DR-2 fixes:
//     the old date(started_at,'unixepoch') UTC comparison would have
//     placed this session on 2026-08-15; the operator's actual local
//     day is still 2026-08-14.

test("DR-2 scenario A: a CLIENT_WORK session inside the target local day is counted", () => {
  const rows = [
    { startedAt: 1786802400, endedAt: 1786806000, videoKind: "CLIENT_WORK" }, // 60 min
  ];
  const result = computeClientOperationalMinutes(rows, "2026-08-15", "2026-08-15");
  assert.equal(result.minutes, 60);
  assert.equal(result.openSessionCount, 0);
});

test("DR-2 scenario B: a SAMPLE session inside the target local day is excluded", () => {
  const rows = [
    { startedAt: 1786802400, endedAt: 1786806000, videoKind: "CLIENT_WORK" }, // 60 min, counted
    { startedAt: 1786809600, endedAt: 1786813200, videoKind: "SAMPLE" }, // 60 min, must be excluded
  ];
  const result = computeClientOperationalMinutes(rows, "2026-08-15", "2026-08-15");
  assert.equal(result.minutes, 60, "SAMPLE session minutes must not inflate the client total");
});

test("DR-2 scenario C: an INTERNAL session inside the target local day is excluded", () => {
  const rows = [
    { startedAt: 1786802400, endedAt: 1786806000, videoKind: "CLIENT_WORK" }, // 60 min, counted
    { startedAt: 1786816800, endedAt: 1786820400, videoKind: "INTERNAL" }, // 60 min, must be excluded
  ];
  const result = computeClientOperationalMinutes(rows, "2026-08-15", "2026-08-15");
  assert.equal(result.minutes, 60, "INTERNAL session minutes must not inflate the client total");
});

test("DR-2 scenario D: a session just after UTC midnight lands in the correct operator-local day, not the UTC day", () => {
  // 2026-08-15T01:00:00Z is UTC day 2026-08-15 but America/Sao_Paulo
  // (UTC-3) local day 2026-08-14. The old date(started_at,'unixepoch')
  // SQL comparison would have wrongly counted this inside a
  // period ending 2026-08-15; the fix must exclude it there and include
  // it only when the period actually covers the operator's real local
  // day, 2026-08-14.
  const rows = [
    { startedAt: 1786755600, endedAt: 1786757400, videoKind: "CLIENT_WORK" }, // 30 min
  ];
  const wrongDayPeriod = computeClientOperationalMinutes(rows, "2026-08-15", "2026-08-15");
  assert.equal(
    wrongDayPeriod.minutes,
    0,
    "a session whose operator-local day is 2026-08-14 must not be counted in a 2026-08-15-only period",
  );

  const correctDayPeriod = computeClientOperationalMinutes(rows, "2026-08-14", "2026-08-14");
  assert.equal(
    correctDayPeriod.minutes,
    30,
    "the same session must be counted when the period covers its real operator-local day",
  );
});

test("DR-2 scenario E: existing valid reconciliation behavior is unchanged for an unambiguous mid-period CLIENT_WORK session, and open sessions are still counted separately", () => {
  const rows = [
    // Unambiguous mid-period CLIENT_WORK session, 90 minutes, well clear
    // of any timezone boundary -- must still be counted exactly as
    // before this fix.
    { startedAt: 1786543200, endedAt: 1786548600, videoKind: "CLIENT_WORK" },
    // A still-open (ended_at === null) CLIENT_WORK session -- must be
    // reported via openSessionCount, not folded into the minutes total,
    // exactly as the pre-fix function's return shape already required.
    { startedAt: 1786629600, endedAt: null, videoKind: "CLIENT_WORK" },
  ];
  const result = computeClientOperationalMinutes(rows, "2026-08-10", "2026-08-16");
  assert.equal(result.minutes, 90);
  assert.equal(result.openSessionCount, 1);
});

// ─── Tuesday Patch Priority 4 (Finance Overview) ───────────────────────────

import { computeReservedByCurrency, computeUpcomingObligations } from "./core.ts";

test("computeReservedByCurrency sums tax reserve and operating reserve per currency", () => {
  const result = computeReservedByCurrency(
    [{ currency: "USD", amount: 100 }, { currency: "BRL", amount: 50 }],
    { currency: "USD", reservedSoFar: 47.25 },
  );
  assert.deepEqual(result, [
    { currency: "USD", amount: 147.25 },
    { currency: "BRL", amount: 50 },
  ]);
});

test("computeReservedByCurrency omits a currency that nets to zero", () => {
  const result = computeReservedByCurrency([], { currency: "USD", reservedSoFar: 0 });
  assert.deepEqual(result, []);
});

test("computeReservedByCurrency introduces the operating reserve's own currency even with no tax reserve rows", () => {
  const result = computeReservedByCurrency([], { currency: "BRL", reservedSoFar: 200 });
  assert.deepEqual(result, [{ currency: "BRL", amount: 200 }]);
});

test("computeUpcomingObligations sums renewals within the window and excludes past-due or far-out ones", () => {
  const today = "2026-09-08";
  const renewals = [
    { renewalDate: "2026-09-15", amount: 20, currency: "USD" }, // 7 days out, included
    { renewalDate: "2026-10-20", amount: 999, currency: "USD" }, // 42 days out, excluded
    { renewalDate: "2026-09-01", amount: 999, currency: "USD" }, // already past, excluded
    { renewalDate: null, amount: 999, currency: "USD" }, // no date, excluded
    { renewalDate: "2026-09-08", amount: 15, currency: "BRL" }, // due today, included
  ];
  const result = computeUpcomingObligations(renewals, today, 30);
  assert.deepEqual(result, [
    { currency: "USD", amount: 20 },
    { currency: "BRL", amount: 15 },
  ]);
});
