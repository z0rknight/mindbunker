import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClientRecipeProjection,
  canTransitionRecipeStep,
  cleanRecipeText,
  summarizeRecipeSteps,
} from "./core.ts";

const step = (id, position, state, gate = "BUILD") => ({
  id,
  label: `Step ${id}`,
  gate,
  position,
  qualityStandard: null,
  state,
  updatedAt: "2026-10-08T12:00:00.000Z",
});

test("Recipe state machine supports start, completion, N/A and truthful reopen only", () => {
  assert.equal(canTransitionRecipeStep("NOT_STARTED", "ACTIVE"), true);
  assert.equal(canTransitionRecipeStep("ACTIVE", "DONE"), true);
  assert.equal(canTransitionRecipeStep("NOT_STARTED", "N_A"), true);
  assert.equal(canTransitionRecipeStep("DONE", "ACTIVE"), true);
  assert.equal(canTransitionRecipeStep("DONE", "NOT_STARTED"), false);
  assert.equal(canTransitionRecipeStep("ACTIVE", "NOT_STARTED"), false);
});

test("summary exposes current and next without claiming an empty Recipe is complete", () => {
  assert.deepEqual(summarizeRecipeSteps([]), {
    done: 0,
    applicable: 0,
    complete: false,
    currentStep: null,
    nextStep: null,
  });
  const steps = [step(1, 0, "DONE"), step(2, 1, "ACTIVE"), step(3, 2, "NOT_STARTED"), step(4, 3, "N_A")];
  const summary = summarizeRecipeSteps(steps);
  assert.equal(summary.done, 1);
  assert.equal(summary.applicable, 3);
  assert.equal(summary.complete, false);
  assert.equal(summary.currentStep.id, 2);
  assert.equal(summary.nextStep.id, 3);
});

test("client projection collapses internal steps into readable stages", () => {
  const projection = buildClientRecipeProjection([
    step(1, 0, "DONE", "STRUCTURE"),
    step(2, 1, "DONE", "BUILD"),
    step(3, 2, "ACTIVE", "FINISH"),
    step(4, 3, "NOT_STARTED", "QUALITY_REVIEW"),
    step(5, 4, "NOT_STARTED", "REVIEW_DELIVERY"),
  ]);
  assert.deepEqual(projection, [
    { key: "EDITING", label: "Editing", state: "DONE" },
    { key: "FINISHING", label: "Finishing", state: "ACTIVE" },
    { key: "QUALITY_REVIEW", label: "Quality review", state: "UP_NEXT" },
    { key: "READY_FOR_YOU", label: "Ready for you", state: "NOT_STARTED" },
  ]);
  assert.equal(JSON.stringify(projection).includes("Step 1"), false, "internal step labels never leak");
  assert.equal(JSON.stringify(projection).includes("time"), false, "operator time never leaks");
});

test("Recipe text is concise and required without inventing defaults", () => {
  assert.equal(cleanRecipeText("  Long-form   editorial  ", 120), "Long-form editorial");
  assert.equal(cleanRecipeText(" ", 120), null);
  assert.equal(cleanRecipeText("x".repeat(121), 120), null);
});
