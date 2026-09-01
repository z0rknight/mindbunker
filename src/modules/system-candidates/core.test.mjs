import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSystemCandidates } from "./core.ts";

test("detectSystemCandidates: flags by count threshold", () => {
  const events = [
    { category: "FILES", note: "missing asset", minutesLost: 5 },
    { category: "FILES", note: "missing asset", minutesLost: 5 },
    { category: "FILES", note: "missing asset", minutesLost: 5 },
  ];
  const candidates = detectSystemCandidates(events, 3, 999);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].count, 3);
});

test("detectSystemCandidates: flags by minutesLost threshold even below count threshold", () => {
  const events = [{ category: "HARDWARE", note: "crash", minutesLost: 90 }];
  const candidates = detectSystemCandidates(events, 5, 60);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].minutesLost, 90);
});

test("detectSystemCandidates: below both thresholds is not flagged", () => {
  assert.deepEqual(detectSystemCandidates([{ category: "OTHER", note: "x", minutesLost: 1 }], 3, 60), []);
});
