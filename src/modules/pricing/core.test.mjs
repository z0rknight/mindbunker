import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeQuantity,
  computeALaCarteLineCents,
  computePackagePricing,
  centsToDollarsString,
  buildPackageSummaryText,
} from "./core.ts";

const CONFIG = {
  products: [
    { id: "long-form", label: "Long-form video", unitPriceCents: 40_000 },
    { id: "short-form", label: "Short-form video", unitPriceCents: 7_500 },
    { id: "thumbnail", label: "Thumbnail", unitPriceCents: 1_500 },
  ],
  packageDiscountRate: 0.2,
};

test("sanitizeQuantity floors positive fractions and rejects everything else", () => {
  assert.strictEqual(sanitizeQuantity(3), 3);
  assert.strictEqual(sanitizeQuantity(3.9), 3);
  assert.strictEqual(sanitizeQuantity(0), 0);
  assert.strictEqual(sanitizeQuantity(-1), 0);
  assert.strictEqual(sanitizeQuantity(NaN), 0);
  assert.strictEqual(sanitizeQuantity(Infinity), 0);
  assert.strictEqual(sanitizeQuantity(undefined), 0);
  assert.strictEqual(sanitizeQuantity(null), 0);
});

test("a-la-carte line price is quantity times the canonical unit price, in cents", () => {
  assert.strictEqual(computeALaCarteLineCents(CONFIG, "long-form", 2), 80_000);
  assert.strictEqual(computeALaCarteLineCents(CONFIG, "short-form", 5), 37_500);
  assert.strictEqual(computeALaCarteLineCents(CONFIG, "thumbnail", 0), 0);
  assert.strictEqual(computeALaCarteLineCents(CONFIG, "unknown-product", 4), 0);
});

test("zero/invalid package: no quantities selected produces an all-zero result", () => {
  const result = computePackagePricing(CONFIG, {});
  assert.strictEqual(result.retailSubtotalCents, 0);
  assert.strictEqual(result.discountAmountCents, 0);
  assert.strictEqual(result.packageTotalCents, 0);
  assert.strictEqual(result.hasAnySelection, false);
});

test("one long-form only", () => {
  const result = computePackagePricing(CONFIG, { "long-form": 1 });
  assert.strictEqual(result.retailSubtotalCents, 40_000);
  assert.strictEqual(result.discountAmountCents, 8_000); // 20% of $400
  assert.strictEqual(result.packageTotalCents, 32_000);
  assert.strictEqual(result.hasAnySelection, true);
});

test("one short-form only", () => {
  const result = computePackagePricing(CONFIG, { "short-form": 1 });
  assert.strictEqual(result.retailSubtotalCents, 7_500);
  assert.strictEqual(result.discountAmountCents, 1_500); // 20% of $75
  assert.strictEqual(result.packageTotalCents, 6_000);
});

test("mixed package with thumbnail: 2 long + 5 short + 2 thumbnail", () => {
  const result = computePackagePricing(CONFIG, {
    "long-form": 2,
    "short-form": 5,
    thumbnail: 2,
  });
  // 2*400 + 5*75 + 2*15 = 800 + 375 + 30 = 1205 dollars = 120500 cents
  assert.strictEqual(result.retailSubtotalCents, 120_500);
  assert.strictEqual(result.discountAmountCents, 24_100); // 20% of 1205
  assert.strictEqual(result.packageTotalCents, 96_400);

  const byId = Object.fromEntries(result.lineItems.map((li) => [li.id, li]));
  assert.strictEqual(byId["long-form"].lineTotalCents, 80_000);
  assert.strictEqual(byId["short-form"].lineTotalCents, 37_500);
  assert.strictEqual(byId["thumbnail"].lineTotalCents, 3_000);
});

test("mixed package without thumbnail behaves the same as thumbnail:0", () => {
  const withZero = computePackagePricing(CONFIG, {
    "long-form": 1,
    "short-form": 3,
    thumbnail: 0,
  });
  const omitted = computePackagePricing(CONFIG, {
    "long-form": 1,
    "short-form": 3,
  });
  assert.deepEqual(withZero, omitted);
});

test("larger quantities scale linearly", () => {
  const result = computePackagePricing(CONFIG, {
    "long-form": 10,
    "short-form": 20,
    thumbnail: 15,
  });
  // 10*400 + 20*75 + 15*15 = 4000 + 1500 + 225 = 5725 dollars
  assert.strictEqual(result.retailSubtotalCents, 572_500);
  assert.strictEqual(result.discountAmountCents, 114_500);
  assert.strictEqual(result.packageTotalCents, 458_000);
});

test("discount 0 (future configurable discount) leaves package total equal to retail", () => {
  const zeroDiscountConfig = { ...CONFIG, packageDiscountRate: 0 };
  const result = computePackagePricing(zeroDiscountConfig, { "long-form": 2 });
  assert.strictEqual(result.discountAmountCents, 0);
  assert.strictEqual(result.packageTotalCents, result.retailSubtotalCents);
});

test("discount is configurable -- 15% produces a different, correctly rounded total", () => {
  const fifteenPct = { ...CONFIG, packageDiscountRate: 0.15 };
  const result = computePackagePricing(fifteenPct, { "short-form": 1 }); // $75
  assert.strictEqual(result.discountAmountCents, Math.round(7_500 * 0.15)); // 1125
  assert.strictEqual(result.packageTotalCents, 7_500 - 1_125);
});

test("rounding edge case: an odd-cent subtotal rounds the discount to the nearest cent, not truncated", () => {
  const oddConfig = {
    products: [{ id: "x", label: "X", unitPriceCents: 333 }],
    packageDiscountRate: 0.2,
  };
  const result = computePackagePricing(oddConfig, { x: 1 });
  // 333 * 0.20 = 66.6 -> rounds to 67
  assert.strictEqual(result.discountAmountCents, 67);
  assert.strictEqual(result.packageTotalCents, 266);
});

test("negative and non-integer quantities in the input are sanitized before pricing", () => {
  const result = computePackagePricing(CONFIG, {
    "long-form": -5,
    "short-form": 2.9,
    thumbnail: NaN,
  });
  assert.strictEqual(result.lineItems.find((li) => li.id === "long-form").quantity, 0);
  assert.strictEqual(result.lineItems.find((li) => li.id === "short-form").quantity, 2);
  assert.strictEqual(result.lineItems.find((li) => li.id === "thumbnail").quantity, 0);
});

test("changing the canonical unit price changes every downstream calculation", () => {
  const before = computePackagePricing(CONFIG, { "long-form": 1 });
  const raisedConfig = {
    ...CONFIG,
    products: CONFIG.products.map((p) =>
      p.id === "long-form" ? { ...p, unitPriceCents: 50_000 } : p,
    ),
  };
  const after = computePackagePricing(raisedConfig, { "long-form": 1 });
  assert.strictEqual(before.retailSubtotalCents, 40_000);
  assert.strictEqual(after.retailSubtotalCents, 50_000);
  assert.strictEqual(after.discountAmountCents, 10_000);
  assert.strictEqual(after.packageTotalCents, 40_000);
});

test("centsToDollarsString formats as USD currency", () => {
  assert.strictEqual(centsToDollarsString(120_500), "$1,205.00");
  assert.strictEqual(centsToDollarsString(0), "$0.00");
  assert.strictEqual(centsToDollarsString(67), "$0.67");
});

test("package summary reflects selected quantities and totals, omits zero-quantity lines", () => {
  const result = computePackagePricing(CONFIG, {
    "long-form": 2,
    "short-form": 5,
    thumbnail: 0,
  });
  const summary = buildPackageSummaryText(result);
  assert.match(summary, /2x Long-form video/);
  assert.match(summary, /5x Short-form video/);
  assert.doesNotMatch(summary, /Thumbnail/);
  assert.match(summary, /Retail value: \$1,175\.00/);
  assert.match(summary, /Package savings \(20%\): \$235\.00/);
  assert.match(summary, /Monthly package: \$940\.00/);
});

test("empty package summary still renders a valid, honest zero total", () => {
  const result = computePackagePricing(CONFIG, {});
  const summary = buildPackageSummaryText(result);
  assert.match(summary, /Retail value: \$0\.00/);
  assert.match(summary, /Monthly package: \$0\.00/);
});
