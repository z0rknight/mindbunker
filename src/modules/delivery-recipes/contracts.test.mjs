import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Recipe actions preserve canonical ownership and completed Video safety", () => {
  const actions = read("./actions.ts");
  const service = read("./service.ts");
  assert.match(actions, /getAuthenticatedDb/);
  assert.match(service, /video\.status === "DONE"/);
  assert.match(service, /isOperationalContainer/);
  assert.match(service, /delivery_recipe_events/);
  assert.match(actions, /operator_click/);
  assert.doesNotMatch(`${actions}\n${service}`, /insert\(workSessions\)|update\(workSessions\)|deviceActivity|sensorSessions/);
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

test("RMEDIA App routes reuse the canonical Recipe service and current Work Session", () => {
  const readRoute = read("../../app/api/sensor/v1/recipes/current/route.ts");
  const transitionRoute = read("../../app/api/sensor/v1/recipes/current/steps/[stepId]/route.ts");
  const nativeProjection = read("./native.ts");
  assert.match(readRoute, /authenticateSensorRequest\(request, "CATALOG_READ"\)/);
  assert.match(transitionRoute, /authenticateSensorRequest\(request, "SESSION_WRITE"\)/);
  assert.match(readRoute, /readCanonicalExecution/);
  assert.match(transitionRoute, /readCanonicalExecution/);
  assert.match(transitionRoute, /transitionDeliveryRecipeStepWithDb/);
  assert.match(transitionRoute, /source: "RMEDIA_APP"/);
  assert.match(transitionRoute, /native_operator_click:device:/);
  assert.doesNotMatch(`${readRoute}\n${transitionRoute}\n${nativeProjection}`, /insert\(workSessions\)|update\(workSessions\)|deviceActivity|sensorSessions/u);
});
