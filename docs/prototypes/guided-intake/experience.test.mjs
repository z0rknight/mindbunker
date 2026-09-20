import test from "node:test";
import assert from "node:assert/strict";
import { emptyAnswers } from "./model.mjs";
import { applyExperienceAnswer, buildClientSummary, getVisibleExperienceScreens, selectedExperienceValue, EXPERIENCE_SCREENS, PUBLIC_STARTING_PATHS } from "./experience.mjs";

function answerPath(sequence) {
  return sequence.reduce((answers, [screen, value]) => applyExperienceAnswer(answers, screen, value), emptyAnswers());
}

test("simple defined work skips technical detail but keeps the material approval fact", () => {
  const answers = answerPath([["shape", "one"], ["content", "short"], ["format", "yes"], ["materials", "ready"], ["working-style", "clear"]]);
  const ids = getVisibleExperienceScreens(answers).map((screen) => screen.id);
  assert.equal(ids.includes("special"), false);
  assert.equal(ids.includes("approval"), true);
});

test("new recurring work reveals technical and coordination questions", () => {
  const answers = answerPath([["shape", "ongoing"], ["content", "mix"], ["format", "sort_of"], ["materials", "partial"], ["working-style", "flexible"]]);
  const ids = getVisibleExperienceScreens(answers).map((screen) => screen.id);
  assert.equal(ids.includes("special"), true);
  assert.equal(ids.includes("approval"), true);
});

test("volume alone does not expose technical questions when decisions are resolved", () => {
  const answers = answerPath([["shape", "ongoing"], ["content", "short"], ["format", "yes"], ["materials", "ready"], ["working-style", "clear"]]);
  const ids = getVisibleExperienceScreens(answers).map((screen) => screen.id);
  assert.equal(ids.includes("special"), false);
});

test("not-sure path remains complete and branches toward clarification", () => {
  const answers = answerPath([["shape", "unsure"], ["content", "unsure"], ["format", "unsure"], ["materials", "unsure"], ["working-style", "unsure"], ["special", "unsure"], ["approval", "unsure"]]);
  assert.equal(answers.deliverableCountBand, "unsure");
  assert.equal(answers.sourceReadiness, "needs_help");
  assert.deepEqual(answers.technicalComplexityFlags, ["unsure"]);
});

test("answer edits replace the canonical values used by the model", () => {
  let answers = applyExperienceAnswer(emptyAnswers(), "shape", "one");
  answers = applyExperienceAnswer(answers, "shape", "ongoing");
  assert.equal(answers.deliverableCountBand, "ongoing");
  assert.equal(answers.recurrence, "recurring");
  const screen = EXPERIENCE_SCREENS.find((candidate) => candidate.id === "shape");
  assert.equal(selectedExperienceValue(answers, screen), "ongoing");
});

test("answer edits clear only technical detail that becomes hidden", () => {
  let answers = answerPath([["format", "no"], ["materials", "shape"], ["working-style", "discover"], ["special", "motion"], ["approval", "team"]]);
  assert.deepEqual(answers.technicalComplexityFlags, ["motion"]);
  answers = applyExperienceAnswer(answers, "format", "yes");
  answers = applyExperienceAnswer(answers, "materials", "ready");
  answers = applyExperienceAnswer(answers, "working-style", "clear");
  assert.deepEqual(answers.technicalComplexityFlags, []);
  assert.deepEqual(answers.dependencyFlags, ["approval", "feedback"]);
});

test("public path language does not expose the internal pilot label", () => {
  assert.equal(PUBLIC_STARTING_PATHS.PILOT_SETUP.label, "Define the format first");
  assert.match(PUBLIC_STARTING_PATHS.PILOT_SETUP.why, /first version/i);
});

test("client summary repeats the lead's own choices in plain language", () => {
  const answers = answerPath([["shape", "small"], ["content", "short"], ["format", "yes"], ["materials", "ready"], ["working-style", "clear"], ["timing", "soon"]]);
  assert.deepEqual(buildClientSummary(answers), {
    making: "A few videos",
    content: "Short clips",
    frequency: "As a batch or campaign",
    ready: "Everything is ready",
    definition: "Clear direction",
    timing: "A flexible timing window",
  });
});
