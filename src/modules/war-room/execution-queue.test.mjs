import assert from "node:assert/strict";
import test from "node:test";
import { selectCompactExecutionQueue } from "./execution-queue.ts";

function row(id, overrides = {}) {
  return {
    id,
    isExecutable: true,
    isBlocked: false,
    isAwaitingReview: false,
    ...overrides,
  };
}

test("compact queue excludes current and policy recommendation, then bounds NEXT to three", () => {
  const result = selectCompactExecutionQueue(
    [row(1), row(2), row(3), row(4), row(5), row(6)],
    { currentVideoId: 1, recommendedVideoId: 4 },
  );
  assert.deepEqual(result.next.map((item) => item.id), [2, 3, 5]);
  assert.equal(result.laterCount, 1);
});

test("blocked and review rows remain counted in LATER but never appear as NEXT", () => {
  const result = selectCompactExecutionQueue(
    [row(1, { isExecutable: false, isBlocked: true }), row(2), row(3, { isExecutable: false, isAwaitingReview: true })],
    {},
  );
  assert.deepEqual(result.next.map((item) => item.id), [2]);
  assert.equal(result.laterCount, 2);
});
