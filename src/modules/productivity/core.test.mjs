import assert from "node:assert/strict";
import test from "node:test";

import { validateVideoInput } from "./core.ts";

test("video input preserves its project and client references", () => {
  const result = validateVideoInput({
    title: "  Launch cut  ",
    projectId: 4,
    clientId: 2,
    notes: "  Vertical version  ",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, {
      title: "Launch cut",
      projectId: 4,
      clientId: 2,
      notes: "Vertical version",
    });
  }
});

test("video input rejects nameless videos and invalid references", () => {
  assert.equal(validateVideoInput({ title: "" }).success, false);
  assert.equal(
    validateVideoInput({ title: "Cut", projectId: -1 }).success,
    false,
  );
});
