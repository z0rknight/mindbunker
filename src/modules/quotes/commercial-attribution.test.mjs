import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateProjectCommercialSummary,
  buildClientHourlySummary,
} from "./core.ts";

// Post-Job Commercial + Delivery Sniper §2/§18: "46m x USD25/h = USD19.17"
// worked example, exercised through the same path the UI renders --
// getCommercialTermsForVideo's estimatedAccruedValue (verified in the
// finance/core.test.mjs computeRateEquivalent tests) flows straight into
// these display-layer functions with no further recompute.
test("aggregateProjectCommercialSummary: HOURLY video totals match the brief's worked example", () => {
  const terms = [
    {
      billingModel: "HOURLY",
      contractId: 1,
      platform: "Upwork",
      currency: "USD",
      hourlyRate: 25,
      trackedSeconds: 46 * 60,
      estimatedAccruedValue: 19.17,
      upworkBilledTotal: null,
      upworkBilledCurrency: null,
      upworkEvidenceCount: 0,
      attribution: "VIDEO_CONTRACT",
    },
  ];
  const summary = aggregateProjectCommercialSummary(terms);
  assert.equal(summary.byCurrency.length, 1);
  assert.equal(summary.byCurrency[0].currency, "USD");
  assert.equal(summary.byCurrency[0].estimatedAccruedTotal, 19.17);
  assert.equal(summary.byCurrency[0].agreedTotalCents, null);
  assert.equal(summary.trackedSecondsTotal, 46 * 60);
  assert.equal(summary.unattributedCount, 0);
});

test("aggregateProjectCommercialSummary: USD and BRL never collapse into one bucket", () => {
  const terms = [
    {
      billingModel: "HOURLY",
      contractId: 1,
      platform: "Upwork",
      currency: "USD",
      hourlyRate: 25,
      trackedSeconds: 3600,
      estimatedAccruedValue: 25,
      upworkBilledTotal: null,
      upworkBilledCurrency: null,
      upworkEvidenceCount: 0,
      attribution: "CLIENT_SINGLE_ACTIVE_CONTRACT",
    },
    {
      billingModel: "FIXED",
      quoteId: 1,
      source: "Manual",
      currency: "BRL",
      agreedPriceCents: 10000,
      turnaroundLabel: "3 days",
      revisionsIncluded: 2,
      scopeText: "",
      trackedSeconds: 1800,
    },
  ];
  const summary = aggregateProjectCommercialSummary(terms);
  const byCurrency = Object.fromEntries(summary.byCurrency.map((b) => [b.currency, b]));
  assert.equal(byCurrency.USD.estimatedAccruedTotal, 25);
  assert.equal(byCurrency.USD.agreedTotalCents, null);
  assert.equal(byCurrency.BRL.agreedTotalCents, 10000);
  assert.equal(byCurrency.BRL.estimatedAccruedTotal, null);
});

test("aggregateProjectCommercialSummary: unattributed videos are counted, never treated as $0", () => {
  const terms = [
    { billingModel: "NONE", trackedSeconds: 600 },
    { billingModel: "NONE", trackedSeconds: 0 },
  ];
  const summary = aggregateProjectCommercialSummary(terms);
  assert.equal(summary.unattributedCount, 2);
  assert.equal(summary.byCurrency.length, 0);
  assert.equal(summary.videoCount, 2);
});

test("buildClientHourlySummary: null for FIXED and NONE, populated for HOURLY", () => {
  assert.equal(
    buildClientHourlySummary({ billingModel: "NONE", trackedSeconds: 0 }),
    null,
  );
  assert.equal(
    buildClientHourlySummary({
      billingModel: "FIXED",
      quoteId: 1,
      source: "Manual",
      currency: "USD",
      agreedPriceCents: 10000,
      turnaroundLabel: "3 days",
      revisionsIncluded: 2,
      scopeText: "",
      trackedSeconds: 0,
    }),
    null,
  );
  const hourly = buildClientHourlySummary({
    billingModel: "HOURLY",
    contractId: 1,
    platform: "Upwork",
    currency: "USD",
    hourlyRate: 25,
    trackedSeconds: 46 * 60,
    estimatedAccruedValue: 19.17,
    upworkBilledTotal: 500,
    upworkBilledCurrency: "USD",
    upworkEvidenceCount: 3,
    attribution: "VIDEO_CONTRACT",
  });
  assert.deepEqual(hourly, {
    hourlyRateLabel: "$25.00/h",
    trackedSeconds: 46 * 60,
    estimatedAccruedLabel: "$19.17",
    currency: "USD",
  });
  // Client-safe: platform/contractId/upworkBilledTotal never leak through.
  assert.equal("platform" in hourly, false);
  assert.equal("contractId" in hourly, false);
  assert.equal("upworkBilledTotal" in hourly, false);
});
