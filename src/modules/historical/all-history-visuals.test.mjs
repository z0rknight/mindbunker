import assert from "node:assert/strict";
import test from "node:test";

import {
  computeYoYRevenueChange,
  computeCumulativeRevenue,
} from "./core.ts";

test("computeYoYRevenueChange: null for the first year (no prior year)", () => {
  const result = computeYoYRevenueChange([
    { year: 2023, revenueUsd: 1000 },
    { year: 2024, revenueUsd: 1200 },
  ]);
  assert.strictEqual(result[0].changePct, null);
  assert.strictEqual(result[1].changePct, 20);
});

test("computeYoYRevenueChange: null (not 0%) whenever either side is unknown", () => {
  const result = computeYoYRevenueChange([
    { year: 2023, revenueUsd: null },
    { year: 2024, revenueUsd: 1200 },
    { year: 2025, revenueUsd: null },
  ]);
  assert.strictEqual(result[0].changePct, null);
  assert.strictEqual(result[1].changePct, null); // prior year (2023) unknown
  assert.strictEqual(result[2].changePct, null); // this year unknown
});

test("computeYoYRevenueChange: null when prior year revenue was exactly 0 (avoid div-by-zero)", () => {
  const result = computeYoYRevenueChange([
    { year: 2023, revenueUsd: 0 },
    { year: 2024, revenueUsd: 500 },
  ]);
  assert.strictEqual(result[1].changePct, null);
});

test("computeYoYRevenueChange: handles a negative (declining) change", () => {
  const result = computeYoYRevenueChange([
    { year: 2023, revenueUsd: 1000 },
    { year: 2024, revenueUsd: 800 },
  ]);
  assert.strictEqual(result[1].changePct, -20);
});

test("computeCumulativeRevenue: sums known years in order", () => {
  const result = computeCumulativeRevenue([
    { year: 2023, revenueUsd: 1000 },
    { year: 2024, revenueUsd: 500 },
    { year: 2025, revenueUsd: 250 },
  ]);
  assert.deepEqual(
    result.map((r) => r.cumulativeUsd),
    [1000, 1500, 1750],
  );
});

test("computeCumulativeRevenue: stops (goes null) at the first unknown year and stays null after, never treating it as 0", () => {
  const result = computeCumulativeRevenue([
    { year: 2023, revenueUsd: 1000 },
    { year: 2024, revenueUsd: null },
    { year: 2025, revenueUsd: 2000 },
  ]);
  assert.deepEqual(
    result.map((r) => r.cumulativeUsd),
    [1000, null, null],
  );
});

test("computeCumulativeRevenue: sorts by year first regardless of input order", () => {
  const result = computeCumulativeRevenue([
    { year: 2025, revenueUsd: 300 },
    { year: 2023, revenueUsd: 100 },
    { year: 2024, revenueUsd: 200 },
  ]);
  assert.deepEqual(
    result.map((r) => [r.year, r.cumulativeUsd]),
    [
      [2023, 100],
      [2024, 300],
      [2025, 600],
    ],
  );
});
