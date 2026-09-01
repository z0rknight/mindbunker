import { test } from "node:test";
import assert from "node:assert/strict";
import { sortActionItemsByPriority } from "./core.ts";

test("sortActionItemsByPriority: P0 before P3 regardless of creation order", () => {
  const items = [
    { id: 1, priority: "P3", dueAt: null, createdAt: new Date("2026-01-01") },
    { id: 2, priority: "P0", dueAt: null, createdAt: new Date("2026-01-02") },
  ];
  assert.deepEqual(sortActionItemsByPriority(items).map((i) => i.id), [2, 1]);
});
test("sortActionItemsByPriority: within same priority, earlier due date first", () => {
  const items = [
    { id: 1, priority: "P1", dueAt: new Date("2026-02-01"), createdAt: new Date("2026-01-01") },
    { id: 2, priority: "P1", dueAt: new Date("2026-01-10"), createdAt: new Date("2026-01-01") },
  ];
  assert.deepEqual(sortActionItemsByPriority(items).map((i) => i.id), [2, 1]);
});
test("sortActionItemsByPriority: no due date sorts after any real due date within the same priority", () => {
  const items = [
    { id: 1, priority: "P2", dueAt: null, createdAt: new Date("2026-01-01") },
    { id: 2, priority: "P2", dueAt: new Date("2026-03-01"), createdAt: new Date("2026-01-02") },
  ];
  assert.deepEqual(sortActionItemsByPriority(items).map((i) => i.id), [2, 1]);
});
