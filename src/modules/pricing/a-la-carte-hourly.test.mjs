import assert from "node:assert/strict";
import test from "node:test";

import { computeALaCarteHourlyEstimate } from "./core.ts";

const CONFIG = {
  hourlyRateCents: 5_000, // $50/h
  thumbnailUnitPriceCents: 1_500,
  rushSurchargeRate: 0.25,
  revisionRoundHours: 1.5,
};

test("baseline standard complexity, no add-ons", () => {
  const result = computeALaCarteHourlyEstimate(CONFIG, {
    estimatedHours: 8,
    complexityMultiplier: 1,
    includeRush: false,
    extraRevisionRounds: 0,
    thumbnailCount: 0,
  });
  assert.strictEqual(result.adjustedHours, 8);
  assert.strictEqual(result.totalHours, 8);
  assert.strictEqual(result.laborCents, 8 * 5_000); // $400
  assert.strictEqual(result.rushSurchargeCents, 0);
  assert.strictEqual(result.thumbnailCents, 0);
  assert.strictEqual(result.totalCents, 40_000);
});

test("complexity multiplier scales adjusted hours and therefore price", () => {
  const result = computeALaCarteHourlyEstimate(CONFIG, {
    estimatedHours: 10,
    complexityMultiplier: 1.3,
    includeRush: false,
    extraRevisionRounds: 0,
    thumbnailCount: 0,
  });
  assert.strictEqual(result.adjustedHours, 13);
  assert.strictEqual(result.laborCents, Math.round(13 * 5_000));
});

test("extra revision rounds add hours at the configured rate", () => {
  const result = computeALaCarteHourlyEstimate(CONFIG, {
    estimatedHours: 5,
    complexityMultiplier: 1,
    includeRush: false,
    extraRevisionRounds: 2,
    thumbnailCount: 0,
  });
  assert.strictEqual(result.revisionHours, 3); // 2 * 1.5
  assert.strictEqual(result.totalHours, 8);
  assert.strictEqual(result.laborCents, 8 * 5_000);
});

test("rush surcharge is a percentage of labor only, applied after labor is computed", () => {
  const result = computeALaCarteHourlyEstimate(CONFIG, {
    estimatedHours: 10,
    complexityMultiplier: 1,
    includeRush: true,
    extraRevisionRounds: 0,
    thumbnailCount: 0,
  });
  assert.strictEqual(result.laborCents, 50_000);
  assert.strictEqual(result.rushSurchargeCents, 12_500); // 25% of 50,000
  assert.strictEqual(result.totalCents, 62_500);
});

test("thumbnails add a flat per-unit amount, independent of labor", () => {
  const result = computeALaCarteHourlyEstimate(CONFIG, {
    estimatedHours: 0,
    complexityMultiplier: 1,
    includeRush: false,
    extraRevisionRounds: 0,
    thumbnailCount: 3,
  });
  assert.strictEqual(result.laborCents, 0);
  assert.strictEqual(result.thumbnailCents, 3 * 1_500);
  assert.strictEqual(result.totalCents, 4_500);
});

test("full combination: complexity + rush + revisions + thumbnails all compose", () => {
  const result = computeALaCarteHourlyEstimate(CONFIG, {
    estimatedHours: 8,
    complexityMultiplier: 1.3,
    includeRush: true,
    extraRevisionRounds: 1,
    thumbnailCount: 2,
  });
  const adjustedHours = 8 * 1.3; // 10.4
  const revisionHours = 1.5;
  const totalHours = adjustedHours + revisionHours; // 11.9
  const laborCents = Math.round(totalHours * 5_000);
  const rushCents = Math.round(laborCents * 0.25);
  const thumbCents = 2 * 1_500;
  assert.strictEqual(result.totalHours, totalHours);
  assert.strictEqual(result.laborCents, laborCents);
  assert.strictEqual(result.rushSurchargeCents, rushCents);
  assert.strictEqual(result.totalCents, laborCents + rushCents + thumbCents);
});

test("negative/NaN/missing inputs sanitize to 0 rather than corrupting the price", () => {
  const result = computeALaCarteHourlyEstimate(CONFIG, {
    estimatedHours: -5,
    complexityMultiplier: NaN,
    includeRush: false,
    extraRevisionRounds: -3,
    thumbnailCount: undefined,
  });
  assert.strictEqual(result.baseHours, 0);
  assert.strictEqual(result.complexityMultiplier, 1); // invalid multiplier falls back to 1x, not 0x
  assert.strictEqual(result.extraRevisionRounds, 0);
  assert.strictEqual(result.thumbnailCount, 0);
  assert.strictEqual(result.totalCents, 0);
});
