import { test } from "node:test";
import assert from "node:assert/strict";
import { detectRepeatedFriction, frictionCountsByCategory } from "./core.ts";

test("detectRepeatedFriction: flags a category+keyword group at/above threshold", () => {
  const events = [
    { category: "FILES", note: "missing asset ep1" },
    { category: "FILES", note: "missing asset ep2" },
    { category: "FILES", note: "missing asset ep3" },
    { category: "SOFTWARE", note: "crash on export" },
  ];
  const groups = detectRepeatedFriction(events, 3);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].category, "FILES");
  assert.equal(groups[0].keyword, "MISSING");
  assert.equal(groups[0].count, 3);
});

test("detectRepeatedFriction: below threshold is not flagged", () => {
  const events = [
    { category: "FILES", note: "missing asset" },
    { category: "FILES", note: "missing asset" },
  ];
  assert.deepEqual(detectRepeatedFriction(events, 3), []);
});

test("detectRepeatedFriction: notes with no keyword still group by category alone", () => {
  const events = [{ category: "HARDWARE", note: null }, { category: "HARDWARE", note: null }, { category: "HARDWARE", note: null }];
  const groups = detectRepeatedFriction(events, 3);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].keyword, null);
});

test("frictionCountsByCategory: counts every category, including zero counts", () => {
  const counts = frictionCountsByCategory([{ category: "QA" }, { category: "QA" }, { category: "OTHER" }]);
  assert.equal(counts.QA, 2);
  assert.equal(counts.OTHER, 1);
  assert.equal(counts.FILES, 0);
});
