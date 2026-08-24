import assert from "node:assert/strict";
import test from "node:test";

import {
  validateScreenTimeSnapshotInput,
  normalizeScreenTimeSnapshotInput,
  checkDuplicatePeriod,
  topByHours,
} from "./core.ts";

const VALID_PAYLOAD = {
  periodStart: "2026-08-17",
  periodEnd: "2026-08-23",
  device: "iPhone",
  totalHours: 34.5,
  categories: [
    { name: "Social", hours: 10.2 },
    { name: "Productivity", hours: 8.1 },
  ],
  apps: [
    { name: "Instagram", hours: 5.1, category: "Social" },
    { name: "Slack", hours: 4.0, category: "Productivity" },
  ],
};

test("validateScreenTimeSnapshotInput accepts a well-formed payload", () => {
  const result = validateScreenTimeSnapshotInput(VALID_PAYLOAD);
  assert.strictEqual(result.valid, true);
  assert.deepEqual(result.warnings, []);
});

test("validateScreenTimeSnapshotInput rejects periodEnd before periodStart", () => {
  const result = validateScreenTimeSnapshotInput({
    ...VALID_PAYLOAD,
    periodStart: "2026-08-23",
    periodEnd: "2026-08-17",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("periodEnd")));
});

test("validateScreenTimeSnapshotInput rejects negative totalHours", () => {
  const result = validateScreenTimeSnapshotInput({
    ...VALID_PAYLOAD,
    totalHours: -1,
  });
  assert.strictEqual(result.valid, false);
});

test("validateScreenTimeSnapshotInput rejects negative app/category hours", () => {
  const result = validateScreenTimeSnapshotInput({
    ...VALID_PAYLOAD,
    apps: [{ name: "Bad", hours: -2 }],
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("apps[0].hours")));
});

test("validateScreenTimeSnapshotInput warns (not errors) when app hours exceed the total", () => {
  const result = validateScreenTimeSnapshotInput({
    ...VALID_PAYLOAD,
    totalHours: 5,
    apps: [
      { name: "A", hours: 4 },
      { name: "B", hours: 4 },
    ],
  });
  assert.strictEqual(result.valid, true);
  assert.ok(result.warnings.some((w) => w.includes("more than the reported total")));
});

test("validateScreenTimeSnapshotInput rejects a non-object payload", () => {
  assert.strictEqual(validateScreenTimeSnapshotInput(null).valid, false);
  assert.strictEqual(validateScreenTimeSnapshotInput("nope").valid, false);
});

test("normalizeScreenTimeSnapshotInput converts totalHours to rounded totalMinutes", () => {
  const normalized = normalizeScreenTimeSnapshotInput(VALID_PAYLOAD);
  assert.strictEqual(normalized.totalMinutes, Math.round(34.5 * 60));
  assert.strictEqual(normalized.device, "iPhone");
  assert.strictEqual(normalized.categories.length, 2);
  assert.strictEqual(normalized.apps.length, 2);
});

test("checkDuplicatePeriod: no existing rows -> not a duplicate", () => {
  const normalized = normalizeScreenTimeSnapshotInput(VALID_PAYLOAD);
  const check = checkDuplicatePeriod(normalized, []);
  assert.strictEqual(check.isDuplicate, false);
  assert.strictEqual(check.isExactRepeat, false);
});

test("checkDuplicatePeriod: exact repeat is idempotent", () => {
  const normalized = normalizeScreenTimeSnapshotInput(VALID_PAYLOAD);
  const check = checkDuplicatePeriod(normalized, [
    {
      periodStart: normalized.periodStart,
      periodEnd: normalized.periodEnd,
      device: normalized.device,
      totalMinutes: normalized.totalMinutes,
    },
  ]);
  assert.strictEqual(check.isDuplicate, true);
  assert.strictEqual(check.isExactRepeat, true);
});

test("checkDuplicatePeriod: same period+device, different total -> duplicate but not exact repeat", () => {
  const normalized = normalizeScreenTimeSnapshotInput(VALID_PAYLOAD);
  const check = checkDuplicatePeriod(normalized, [
    {
      periodStart: normalized.periodStart,
      periodEnd: normalized.periodEnd,
      device: normalized.device,
      totalMinutes: normalized.totalMinutes + 100,
    },
  ]);
  assert.strictEqual(check.isDuplicate, true);
  assert.strictEqual(check.isExactRepeat, false);
});

test("topByHours sorts descending and respects the limit", () => {
  const entries = [
    { name: "A", hours: 1 },
    { name: "B", hours: 5 },
    { name: "C", hours: 3 },
  ];
  assert.deepEqual(topByHours(entries, 2), [
    { name: "B", hours: 5 },
    { name: "C", hours: 3 },
  ]);
});
