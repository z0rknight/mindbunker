import { test } from "node:test";
import assert from "node:assert/strict";
import { nextIdeaStage } from "./core.ts";

test("nextIdeaStage: IDEA advances to PROPOSED", () => {
  assert.equal(nextIdeaStage("IDEA"), "PROPOSED");
});
test("nextIdeaStage: PROPOSED advances to APPROVED", () => {
  assert.equal(nextIdeaStage("PROPOSED"), "APPROVED");
});
test("nextIdeaStage: APPROVED has no further stage (null, not a crash)", () => {
  assert.equal(nextIdeaStage("APPROVED"), null);
});
