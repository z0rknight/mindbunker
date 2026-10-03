import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Projects remains an inspection surface with semantic URL views and two densities", () => {
  const page = source("../../app/projects/page.tsx");
  assert.match(page, /Current/);
  assert.match(page, /By Client/);
  assert.match(page, /Completed/);
  assert.match(page, /Internal/);
  assert.match(page, /EntityInspectionTrigger/);
  assert.match(page, /\["cards", "rows"\]/);
  assert.doesNotMatch(page, /Start Work/);
  assert.doesNotMatch(page, />Open →</);
});

test("structural projection consumes Wave 0 integrity and canonical identity", () => {
  const page = source("../../app/projects/page.tsx");
  const actions = source("./actions.ts");
  assert.match(page, /getRelationshipIntegrity/);
  assert.match(actions, /canonicalClientId/);
  assert.match(actions, /clientWorkMode/);
  assert.match(actions, /isInternalClientName/);
});

test("batch hierarchy is based only on explicit production data", () => {
  const actions = source("./actions.ts");
  assert.match(actions, /productionOrderId/);
  assert.match(actions, /batchLabel/);
  assert.doesNotMatch(actions, /startsWith\(/);
  assert.doesNotMatch(actions, /title.*batch/iu);
});

test("full Project management page and Wave 3 compatibility route remain in place", () => {
  const fullPage = source("../../app/projects/[id]/page.tsx");
  const compatibility = source("../../app/productivity/page.tsx");
  assert.match(fullPage, /getProjectWorkspace/);
  assert.match(compatibility, /"\/war-room"/);
});
