import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCoverageMatrix,
  classifyCommercialModel,
  computeMonthlyFinance,
  computeMonthlyTime,
  computeWeeklyCommercialLine,
  deriveCommercialPosition,
  summarizeTopApplications,
} from "./core.ts";

test("top applications merge browser surfaces without inventing extra app time", () => {
  assert.deepEqual(summarizeTopApplications([
    { appKey: "SAFARI", seconds: 20 },
    { appKey: "PREMIERE_PRO", seconds: 40 },
    { appKey: "SAFARI", seconds: 30 },
  ], 2), [
    { appKey: "SAFARI", seconds: 50 },
    { appKey: "PREMIERE_PRO", seconds: 40 },
  ]);
});

const hourly = [{ id: 2, billingType: "HOURLY", hourlyRate: 25, currency: "USD", status: "ACTIVE" }];
const previous = { id: 2, amountCents: 40000, currency: "USD", status: "CANCELLED", createdAt: 1000, note: null };
const current = { id: 3, amountCents: 46833, currency: "USD", status: "OPEN", createdAt: 20_000, note: null };

test("Dave hourly guard derives 164 whole minutes as USD 68.33 and never treats the request as paid", () => {
  const result = deriveCommercialPosition({
    contracts: hourly,
    requests: [previous, current],
    sessions: [
      { startedAt: 2_000, endedAt: 5_360 },
      { startedAt: 6_000, endedAt: 8_640 },
      { startedAt: 9_000, endedAt: 11_413 },
      { startedAt: 12_000, endedAt: 13_428 },
    ],
    paidTransactions: [],
    nowSeconds: 30_000,
  });
  assert.equal(result.model, "HOURLY");
  assert.equal(result.includedMinutes, 164);
  assert.equal(result.supportedDeltaInCurrent, 68.33);
  assert.equal(result.currentOpenTotal, 468.33);
  assert.equal(result.paidAgainstCurrent, 0);
  assert.equal(result.readiness, "REQUESTED");
});

test("draft time after a request remains separate from confirmed/requested value", () => {
  const result = deriveCommercialPosition({
    contracts: hourly,
    requests: [previous, current],
    sessions: [{ startedAt: 21_000, endedAt: 24_600 }],
    paidTransactions: [],
    nowSeconds: 30_000,
  });
  assert.equal(result.currentOpenTotal, 468.33);
  assert.equal(result.draftMinutes, 60);
  assert.equal(result.draftDeltaAfterCurrent, 25);
});

test("fixed-price hours never increase amount owed", () => {
  const fixed = [{ id: 1, billingType: "FIXED", hourlyRate: null, currency: "USD", status: "ACTIVE" }];
  assert.equal(classifyCommercialModel(fixed), "FIXED");
  const result = deriveCommercialPosition({ contracts: fixed, requests: [], sessions: [{ startedAt: 1, endedAt: 36_001 }], paidTransactions: [], nowSeconds: 40_000 });
  assert.equal(result.supportedDeltaInCurrent, null);
  assert.equal(result.draftDeltaAfterCurrent, null);
  assert.equal(result.readiness, "PARTIAL");
});

test("mixed and missing contracts fail closed", () => {
  assert.equal(classifyCommercialModel([...hourly, { id: 3, billingType: "FIXED", hourlyRate: null, currency: "USD", status: "ACTIVE" }]), "MIXED");
  assert.equal(classifyCommercialModel([]), "UNCLEAR");
});

test("September finance fixture separates gross, fees, cash, personal, currencies and management result", () => {
  const rows = computeMonthlyFinance({
    transactions: [
      { type: "income", amount: 644.29, currency: "USD", attributed: true },
      { type: "expense", amount: 32.75, currency: "USD", attributed: false },
      { type: "income", amount: 400, currency: "BRL", attributed: true },
      { type: "expense", amount: 923.48, currency: "BRL", attributed: false },
      { type: "owner_pay", amount: 234.9, currency: "BRL", attributed: false },
    ],
    registeredBilling: [{ amount: 841.67, currency: "USD" }],
    reconciledRevenue: [{ amount: 729.17, currency: "USD" }],
    requested: [],
    platformFees: [{ amount: 72.92, currency: "USD" }, { amount: 11.96, currency: "USD" }],
    unknownCosts: [],
  });
  const usd = rows.find((row) => row.currency === "USD");
  const brl = rows.find((row) => row.currency === "BRL");
  assert.deepEqual({ cash: usd.cashReceived, registered: usd.registeredBilling, revenue: usd.reconciledRevenue, cost: usd.operatingCost, result: usd.managementOperatingResult }, { cash: 644.29, registered: 841.67, revenue: 729.17, cost: 117.63, result: 611.54 });
  assert.deepEqual({ revenue: brl.reconciledRevenue, cost: brl.operatingCost, personal: brl.personalExcluded, result: brl.managementOperatingResult }, { revenue: 400, cost: 923.48, personal: 234.9, result: -523.48 });
});

test("Upwork weekly view keeps registered, posted, fees, net and cash as distinct facts", () => {
  const week = computeWeeklyCommercialLine({ grossAmount: 254.17, posted: true, serviceFees: 25.42, withdrawalFees: 2.99, candidateSettlements: [225.76], directSeconds: 3600, dfySeconds: 1800 });
  assert.deepEqual(week, { postedGross: 254.17, serviceFees: 25.42, withdrawalFees: 2.99, netPlatformValue: 225.76, bankSettlement: 225.76, directMinutes: 60, dfyMinutes: 30 });
  const unposted = computeWeeklyCommercialLine({ grossAmount: 341.67, posted: false, serviceFees: 0, withdrawalFees: 0, candidateSettlements: [], directSeconds: 0, dfySeconds: 0 });
  assert.equal(unposted.netPlatformValue, null);
  assert.equal(unposted.bankSettlement, null);
});

test("September time fixture preserves and excludes the implausible interval", () => {
  const hour = 3600;
  const split = (hours, base) => {
    const rows = [];
    let remaining = Math.round(hours * hour);
    while (remaining > 0) {
      const seconds = Math.min(remaining, 10 * hour);
      rows.push({ ...base, startedAt: 0, endedAt: seconds });
      remaining -= seconds;
    }
    return rows;
  };
  const rows = computeMonthlyTime([
    ...split(72.035, { activityType: "EDITING", clientName: "Taryn", clientStatus: "active", clientSource: "Upwork" }),
    ...split(28.7931, { activityType: "EDITING", clientName: "RMEDIA", clientStatus: "active", clientSource: "" }),
    ...split(11.4594, { activityType: "ADMIN", clientName: "RMEDIA", clientStatus: "active", clientSource: "" }),
    ...split(0.485, { activityType: "OTHER", clientName: "Lead", clientStatus: "lead", clientSource: "" }),
    { startedAt: 0, endedAt: Math.round(41.0533 * hour), activityType: "EDITING", clientName: "Agency", clientStatus: "active", clientSource: "" },
  ]);
  assert.equal(Math.round(rows.reconciledSeconds / hour * 10_000) / 10_000, 112.7725);
  assert.equal(Math.round(rows.excludedSeconds / hour * 10_000) / 10_000, 41.0533);
  assert.equal(rows.excludedCount, 1);
  assert.equal(rows.implausibleCount, 1);
});

test("coverage matrix has no magic score and reports each evidence dimension", () => {
  const matrix = buildCoverageMatrix({ financeUnknownCost: 0, excludedSeconds: 100, unattributedPaid: 0, deliveryEvidenceCount: 2, reviewEvidenceCount: 0, sourceAuthorityClean: true });
  assert.equal(matrix.length, 6);
  assert.equal(matrix.find((row) => row.key === "TIME").status, "YELLOW");
  assert.equal(matrix.find((row) => row.key === "REVIEW").status, "YELLOW");
  assert.equal(matrix.find((row) => row.key === "FINANCE").status, "GREEN");
});
