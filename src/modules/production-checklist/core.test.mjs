import { test } from "node:test";
import assert from "node:assert/strict";
import { computeChecklistProgress } from "./core.ts";

test("computeChecklistProgress: empty checklist is not complete (unknown, not done)", () => {
  assert.equal(computeChecklistProgress([]).complete, false);
});
test("computeChecklistProgress: NOT_REQUIRED steps are excluded from the applicable count", () => {
  const items = [{ step: "ASSEMBLY", status: "DONE" }, { step: "CAPTIONS", status: "NOT_REQUIRED" }];
  const p = computeChecklistProgress(items);
  assert.equal(p.applicable, 1);
  assert.equal(p.done, 1);
  assert.equal(p.complete, true);
});
test("computeChecklistProgress: one NOT_STARTED step among applicable ones blocks complete", () => {
  const items = [{ step: "ASSEMBLY", status: "DONE" }, { step: "COLOR", status: "NOT_STARTED" }];
  assert.equal(computeChecklistProgress(items).complete, false);
});
