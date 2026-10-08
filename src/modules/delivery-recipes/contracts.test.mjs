import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Recipe actions preserve canonical ownership and completed Video safety", () => {
  const actions = read("./actions.ts");
  assert.match(actions, /getAuthenticatedDb/);
  assert.match(actions, /video\.status === "DONE"/);
  assert.match(actions, /isOperationalContainer/);
  assert.match(actions, /delivery_recipe_events/);
  assert.match(actions, /operator_click/);
  assert.doesNotMatch(actions, /insert\(workSessions\)|update\(workSessions\)|deviceActivity|sensorSessions/);
  assert.match(read("../../app/productivity/DeliveryRecipePanel.tsx"), /Stage time:/, "operator view states the time boundary");
});

test("client projection exposes broad progress only", () => {
  const data = read("./data.ts");
  const view = read("../../app/client/dashboard/videos/[id]/ClientRecipeProgress.tsx");
  assert.match(data, /buildClientRecipeProjection/);
  assert.doesNotMatch(data, /\b(workSessions|deliveryRecipeEvents|qualityStandardSnapshot|labelSnapshot)\b/);
  assert.doesNotMatch(view, /Session|Sensor|standard|Recipe step|event history/iu);
});

test("operator Video surface owns Recipe interaction and legacy checklist stays historical", () => {
  const editor = read("../../app/productivity/VideoEditor.tsx");
  const advanced = read("../../app/productivity/VideoAdvancedPanel.tsx");
  assert.match(editor, /<DeliveryRecipePanel videoId=\{video\.id\} \/>/);
  assert.match(advanced, /Advanced \/ history/);
  assert.match(advanced, /Production checklist/);
});
