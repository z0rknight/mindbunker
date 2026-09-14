import assert from "node:assert/strict";
import test from "node:test";
import {
  isQueueEligible,
  moveBefore,
  moveInOrder,
  resequencePositions,
  selectExecutionQueue,
  selectNextExecutable,
  stageForQueueItem,
} from "./queue.ts";

function video(overrides) {
  return {
    id: 1,
    title: "Video",
    date: "2026-09-08",
    status: "PLANNED",
    videoKind: "CLIENT_WORK",
    clientId: 1,
    clientName: "Client",
    projectId: 1,
    projectName: "Project",
    projectDeadline: null,
    coverUrl: null,
    orientation: null,
    isOperationalContainer: false,
    queuePosition: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: null,
    ...overrides,
  };
}

test("eligibility: only CLIENT_WORK and not DONE", () => {
  assert.equal(isQueueEligible({ videoKind: "CLIENT_WORK", status: "PLANNED" }), true);
  assert.equal(isQueueEligible({ videoKind: "CLIENT_WORK", status: "DONE" }), false);
  assert.equal(isQueueEligible({ videoKind: "SAMPLE", status: "PLANNED" }), false);
  assert.equal(isQueueEligible({ videoKind: "INTERNAL", status: "IN_PROGRESS" }), false);
});

test("operational batch containers never appear as executable videos", () => {
  assert.equal(
    isQueueEligible({ videoKind: "CLIENT_WORK", status: "PLANNED", isOperationalContainer: true }),
    false,
  );
  assert.equal(
    isQueueEligible({ videoKind: "CLIENT_WORK", status: "PLANNED", isOperationalContainer: false }),
    true,
  );
});

// QA fix (2026-09-14): Productivity board layout -- stage grouping stays
// a pure status->lane mapping, independent from the grid/column layout
// that renders it. This is the exact rule ExecutionQueueSection.tsx's
// own stageFor() now delegates to.
test("stageForQueueItem groups every queue-eligible status into exactly one of three stages", () => {
  assert.equal(stageForQueueItem("PLANNED"), "PLANNED");
  assert.equal(stageForQueueItem("IN_PROGRESS"), "MAKING");
  assert.equal(stageForQueueItem("CHANGES_REQUESTED"), "MAKING");
  assert.equal(stageForQueueItem("READY_FOR_REVIEW"), "REVIEW");
});

test("stageForQueueItem: a status it doesn't recognize as MAKING/REVIEW falls back to PLANNED, never throws or returns undefined", () => {
  // DONE is queue-ineligible in the first place (see isQueueEligible), but
  // stageForQueueItem itself must still be a total function over every
  // VideoStatus -- a queue-eligibility bug elsewhere must never turn into
  // a crash here.
  assert.equal(stageForQueueItem("DONE"), "PLANNED");
});

test("DONE videos never appear in the queue projection", () => {
  const queue = selectExecutionQueue(
    [video({ id: 1, status: "DONE" }), video({ id: 2, status: "PLANNED" })],
    { blockedVideoIds: new Set() },
  );
  assert.deepEqual(queue.map((item) => item.id), [2]);
});

test("positioned items sort ascending by queuePosition, before any unpositioned item", () => {
  const queue = selectExecutionQueue(
    [
      video({ id: 1, queuePosition: 3000 }),
      video({ id: 2, queuePosition: 1000 }),
      video({ id: 3, queuePosition: null, updatedAt: new Date("2026-09-05T00:00:00Z") }),
      video({ id: 4, queuePosition: 2000 }),
    ],
    { blockedVideoIds: new Set() },
  );
  assert.deepEqual(queue.map((item) => item.id), [2, 4, 1, 3]);
});

test("unpositioned items fall back to most-recently-touched first, deterministically", () => {
  const queue = selectExecutionQueue(
    [
      video({ id: 1, updatedAt: new Date("2026-09-01T00:00:00Z") }),
      video({ id: 2, updatedAt: new Date("2026-09-05T00:00:00Z") }),
      video({ id: 3, createdAt: new Date("2026-09-03T00:00:00Z"), updatedAt: null }),
    ],
    { blockedVideoIds: new Set() },
  );
  assert.deepEqual(queue.map((item) => item.id), [2, 3, 1]);
});

test("blocked items are flagged and excluded from executable, but keep their position", () => {
  const queue = selectExecutionQueue(
    [video({ id: 1, queuePosition: 1000 }), video({ id: 2, queuePosition: 2000 })],
    { blockedVideoIds: new Set([1]), blockerCategoryByVideoId: new Map([[1, "CLIENT"]]) },
  );
  assert.equal(queue[0].id, 1);
  assert.equal(queue[0].isBlocked, true);
  assert.equal(queue[0].blockerCategory, "CLIENT");
  assert.equal(queue[0].isExecutable, false);
  assert.equal(queue[1].isBlocked, false);
});

test("READY_FOR_REVIEW is visible in the queue, not hidden, but never executable", () => {
  const queue = selectExecutionQueue(
    [video({ id: 1, status: "READY_FOR_REVIEW", queuePosition: 1000 })],
    { blockedVideoIds: new Set() },
  );
  assert.equal(queue.length, 1);
  assert.equal(queue[0].isAwaitingReview, true);
  assert.equal(queue[0].isExecutable, false);
});

test("next executable skips blocked and awaiting-review items in position order", () => {
  const queue = selectExecutionQueue(
    [
      video({ id: 1, queuePosition: 1000 }),
      video({ id: 2, queuePosition: 2000, status: "READY_FOR_REVIEW" }),
      video({ id: 3, queuePosition: 3000 }),
    ],
    { blockedVideoIds: new Set([1]) },
  );
  const next = selectNextExecutable(queue);
  assert.equal(next.id, 3);
});

test("next executable is null when every eligible item is blocked or awaiting review", () => {
  const queue = selectExecutionQueue(
    [
      video({ id: 1, queuePosition: 1000, status: "READY_FOR_REVIEW" }),
      video({ id: 2, queuePosition: 2000 }),
    ],
    { blockedVideoIds: new Set([2]) },
  );
  assert.equal(selectNextExecutable(queue), null);
});

test("next executable is null on an empty queue", () => {
  assert.equal(selectNextExecutable(selectExecutionQueue([], { blockedVideoIds: new Set() })), null);
});

test("resolving a blocker changes only isBlocked, never queue position/rank", () => {
  const videos = [video({ id: 1, queuePosition: 1000 }), video({ id: 2, queuePosition: 2000 })];
  const blocked = selectExecutionQueue(videos, { blockedVideoIds: new Set([1]) });
  const resolved = selectExecutionQueue(videos, { blockedVideoIds: new Set() });
  assert.equal(blocked[0].queueRank, resolved[0].queueRank);
  assert.equal(blocked[0].queuePosition, resolved[0].queuePosition);
  assert.equal(blocked[0].isBlocked, true);
  assert.equal(resolved[0].isBlocked, false);
});

test("moveInOrder: 'top' moves an item to index 0", () => {
  assert.deepEqual(moveInOrder([1, 2, 3, 4], 3, "top"), [3, 1, 2, 4]);
});

test("moveInOrder: 'up' swaps with the previous item", () => {
  assert.deepEqual(moveInOrder([1, 2, 3], 3, "up"), [1, 3, 2]);
});

test("moveInOrder: 'up' on the first item is a no-op", () => {
  assert.deepEqual(moveInOrder([1, 2, 3], 1, "up"), [1, 2, 3]);
});

test("moveInOrder: 'down' swaps with the next item", () => {
  assert.deepEqual(moveInOrder([1, 2, 3], 1, "down"), [2, 1, 3]);
});

test("moveInOrder: 'down' on the last item is a no-op", () => {
  assert.deepEqual(moveInOrder([1, 2, 3], 3, "down"), [1, 2, 3]);
});

test("moveInOrder: an id not present in the list returns the list unchanged", () => {
  assert.deepEqual(moveInOrder([1, 2, 3], 99, "top"), [1, 2, 3]);
});

test("moveBefore expresses drag intent without trusting a browser-supplied full order", () => {
  assert.deepEqual(moveBefore([1, 2, 3, 4], 4, 2), [1, 4, 2, 3]);
  assert.deepEqual(moveBefore([1, 2, 3, 4], 1, null), [2, 3, 4, 1]);
  assert.deepEqual(moveBefore([1, 2, 3], 9, 2), [1, 2, 3]);
});

test("resequencePositions assigns sparse integers in list order starting at 1000", () => {
  const positions = resequencePositions([3, 1, 2]);
  assert.deepEqual([...positions.entries()], [[3, 1000], [1, 2000], [2, 3000]]);
});

test("resequencing normalizes duplicate/legacy positions deterministically", () => {
  // Two rows that somehow share a position (legacy data) still produce a
  // single unambiguous order once resequenced, because resequencing
  // always starts from an already-ordered id list, never from raw
  // positions directly.
  const order = [5, 6];
  const positions = resequencePositions(order);
  assert.equal(new Set(positions.values()).size, 2);
});
