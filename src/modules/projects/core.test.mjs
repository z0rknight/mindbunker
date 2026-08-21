import assert from "node:assert/strict";
import test from "node:test";

import {
  isPositiveId,
  validateProjectInput,
} from "./core.ts";

test("project input keeps only useful bounded fields", () => {
  const result = validateProjectInput({
    name: "  Product launch  ",
    status: "active",
    deadline: "2026-09-10",
    notes: "  First delivery  ",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, {
      name: "Product launch",
      status: "active",
      deadline: "2026-09-10",
      notes: "First delivery",
    });
  }
});

test("project input rejects invalid status, date, and ids", () => {
  assert.equal(
    validateProjectInput({ name: "Project", status: "fake" }).success,
    false,
  );
  assert.equal(
    validateProjectInput({
      name: "Project",
      status: "active",
      deadline: "2026-02-31",
    }).success,
    false,
  );
  assert.equal(isPositiveId(1), true);
  assert.equal(isPositiveId(0), false);
  assert.equal(isPositiveId(1.2), false);
});
