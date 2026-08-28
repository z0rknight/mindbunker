import test from "node:test";
import assert from "node:assert/strict";
import {
  computeImpliedRate,
  computeVolumeWeightedRate,
  resolveFxRateForMonth,
  validateFxConversionInput,
  validateFxManualRateInput,
  monthOf,
  computeFxCashMovements,
} from "./core.ts";

// Sprint C1 required human-QA fixture, reproduced exactly:
//   Aug 05: R$510 -> $100 (implied rate 5.10)
//   Aug 15: R$1,050 -> $200 (implied rate 5.25)
//   cumulative volume-weighted average after these two = R$5.20/USD
//   Aug 20: R$530 -> $100 (implied rate 5.30)
//   cumulative volume-weighted average after all three = R$5.225/USD

test("computeImpliedRate matches each individual fixture conversion", () => {
  assert.equal(computeImpliedRate({ brlAmount: 510, usdAmount: 100 }), 5.1);
  assert.equal(computeImpliedRate({ brlAmount: 1050, usdAmount: 200 }), 5.25);
  assert.equal(computeImpliedRate({ brlAmount: 530, usdAmount: 100 }), 5.3);
});

test("computeVolumeWeightedRate matches the fixture's cumulative averages", () => {
  const first = { brlAmount: 510, usdAmount: 100 };
  const second = { brlAmount: 1050, usdAmount: 200 };
  const third = { brlAmount: 530, usdAmount: 100 };

  assert.equal(computeVolumeWeightedRate([first, second]), 5.2);
  assert.equal(computeVolumeWeightedRate([first, second, third]), 5.225);
});

test("computeVolumeWeightedRate is volume-weighted, not a simple average of implied rates", () => {
  // A simple average of 5.10 and 5.30 would be 5.20 too (coincidentally),
  // so use an asymmetric pair to actually distinguish the two approaches:
  // a huge low-rate conversion should pull the average toward it.
  const huge = { brlAmount: 5000, usdAmount: 1000 }; // implied 5.00
  const tiny = { brlAmount: 60, usdAmount: 10 }; // implied 6.00
  const simpleAverage = 5.5;
  const weighted = computeVolumeWeightedRate([huge, tiny]);
  assert.notEqual(weighted, simpleAverage);
  assert.equal(weighted, round4((5000 + 60) / (1000 + 10)));
});

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

test("computeVolumeWeightedRate returns null for an empty list", () => {
  assert.equal(computeVolumeWeightedRate([]), null);
});

test("resolveFxRateForMonth prefers OBSERVED over MANUAL over FALLBACK", () => {
  const observed = resolveFxRateForMonth({
    monthConversions: [{ brlAmount: 510, usdAmount: 100 }],
    manualRate: 4.5,
    fallbackRate: 5.1,
  });
  assert.equal(observed.source, "OBSERVED");
  assert.equal(observed.rate, 5.1);
  assert.equal(observed.observedConversionCount, 1);

  const manual = resolveFxRateForMonth({
    monthConversions: [],
    manualRate: 4.5,
    fallbackRate: 5.1,
  });
  assert.equal(manual.source, "MANUAL");
  assert.equal(manual.rate, 4.5);

  const fallback = resolveFxRateForMonth({
    monthConversions: [],
    manualRate: null,
    fallbackRate: 5.1,
  });
  assert.equal(fallback.source, "FALLBACK");
  assert.equal(fallback.rate, 5.1);
});

test("resolveFxRateForMonth falls back to EFFECTIVE_USD_TO_BRL_RATE when no fallbackRate is given", () => {
  const result = resolveFxRateForMonth({ monthConversions: [], manualRate: null });
  assert.equal(result.source, "FALLBACK");
  assert.equal(result.rate, 5.1);
});

test("validateFxConversionInput rejects zero/negative amounts and missing date", () => {
  assert.equal(
    validateFxConversionInput({ date: "2026-08-05", brlAmount: 510, usdAmount: 100, scope: "BUSINESS", fromCurrency: "USD" }),
    null,
  );
  assert.match(
    validateFxConversionInput({ date: "", brlAmount: 510, usdAmount: 100, scope: "BUSINESS" }) ?? "",
    /date/i,
  );
  assert.match(
    validateFxConversionInput({ date: "2026-08-05", brlAmount: 0, usdAmount: 100, scope: "BUSINESS" }) ?? "",
    /brl/i,
  );
  assert.match(
    validateFxConversionInput({ date: "2026-08-05", brlAmount: 510, usdAmount: -1, scope: "BUSINESS" }) ?? "",
    /usd/i,
  );
});

test("validateFxManualRateInput enforces YYYY-MM shape and a positive rate", () => {
  assert.equal(validateFxManualRateInput({ month: "2026-08", rate: 5.2 }), null);
  assert.match(validateFxManualRateInput({ month: "August 2026", rate: 5.2 }) ?? "", /YYYY-MM/);
  assert.match(validateFxManualRateInput({ month: "2026-08", rate: 0 }) ?? "", /rate/i);
});

test("monthOf extracts YYYY-MM from an ISO date", () => {
  assert.equal(monthOf("2026-08-05"), "2026-08");
  assert.equal(monthOf("2026-12-31"), "2026-12");
});

test("computeFxCashMovements is direction-aware and never guesses a legacy row", () => {
  assert.deepEqual(
    computeFxCashMovements({ brlAmount: 510, usdAmount: 100, fromCurrency: "USD" }),
    [
      { currency: "USD", amount: -100 },
      { currency: "BRL", amount: 510 },
    ],
  );
  assert.deepEqual(
    computeFxCashMovements({ brlAmount: 510, usdAmount: 100, fromCurrency: "BRL" }),
    [
      { currency: "BRL", amount: -510 },
      { currency: "USD", amount: 100 },
    ],
  );
  assert.deepEqual(
    computeFxCashMovements({ brlAmount: 510, usdAmount: 100, fromCurrency: null }),
    [],
  );
});

test("conversion validation enforces scope, direction, and the finite purpose vocabulary", () => {
  assert.match(
    validateFxConversionInput({ date: "2026-08-05", brlAmount: 510, usdAmount: 100, scope: "" }) ?? "",
    /scope/i,
  );
  assert.match(
    validateFxConversionInput({ date: "2026-08-05", brlAmount: 510, usdAmount: 100, scope: "BUSINESS", fromCurrency: "EUR" }) ?? "",
    /from currency/i,
  );
  assert.match(
    validateFxConversionInput({ date: "2026-08-05", brlAmount: 510, usdAmount: 100, scope: "BUSINESS", purpose: "ADOBE" }) ?? "",
    /purpose/i,
  );
  assert.match(
    validateFxConversionInput({ date: "2026-08-05", brlAmount: 510, usdAmount: 100, scope: "UNCLASSIFIED" }) ?? "",
    /BUSINESS or PERSONAL/i,
  );
});
