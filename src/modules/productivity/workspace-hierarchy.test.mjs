import assert from "node:assert/strict";
import test from "node:test";

import { getVideoWorkspaceStatePresentation } from "./workspace-hierarchy.ts";

test("workspace hierarchy promotes review only for review-driven states", () => {
  assert.equal(getVideoWorkspaceStatePresentation("PLANNED").reviewIsPrimary, false);
  assert.equal(getVideoWorkspaceStatePresentation("IN_PROGRESS").reviewIsPrimary, false);
  assert.equal(getVideoWorkspaceStatePresentation("READY_FOR_REVIEW").reviewIsPrimary, true);
  assert.equal(getVideoWorkspaceStatePresentation("CHANGES_REQUESTED").reviewIsPrimary, true);
  assert.equal(getVideoWorkspaceStatePresentation("DONE").reviewIsPrimary, false);
});

test("workspace hierarchy makes delivery primary only after execution is done", () => {
  for (const status of ["PLANNED", "IN_PROGRESS", "READY_FOR_REVIEW", "CHANGES_REQUESTED"]) {
    assert.equal(getVideoWorkspaceStatePresentation(status).deliveryIsPrimary, false);
  }
  assert.equal(getVideoWorkspaceStatePresentation("DONE").deliveryIsPrimary, true);
});

test("each lifecycle state has a distinct operator-facing next instruction", () => {
  const statuses = ["PLANNED", "IN_PROGRESS", "READY_FOR_REVIEW", "CHANGES_REQUESTED", "DONE"];
  const presentations = statuses.map((status) => getVideoWorkspaceStatePresentation(status));
  assert.equal(new Set(presentations.map((item) => item.headline)).size, statuses.length);
  assert.ok(presentations.every((item) => item.guidance.length > 20));
});
