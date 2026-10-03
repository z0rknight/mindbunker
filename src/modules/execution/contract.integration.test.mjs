import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = (...segments) => readFileSync(path.join(dir, ...segments), "utf8");

function sliceFunction(contents, signature) {
  const start = contents.indexOf(signature);
  assert.ok(start >= 0, `expected ${signature}`);
  const next = contents.indexOf("\nexport ", start + signature.length);
  return next === -1 ? contents.slice(start) : contents.slice(start, next);
}

test("Dashboard and the sole War Room execution surface consume the canonical execution read API", () => {
  const dashboard = source("..", "..", "app", "page.tsx");
  const productivity = source("..", "..", "app", "productivity", "page.tsx");
  const warRoom = source("..", "..", "app", "war-room", "page.tsx");

  assert.match(dashboard, /getExecutionSnapshot/u);
  assert.match(productivity, /redirect/u);
  assert.doesNotMatch(productivity, /getCurrentExecution|ExecutionQueueSection/u);
  assert.match(warRoom, /getCurrentExecution/u);
  assert.match(warRoom, /getExecutionRecommendation/u);
  assert.match(warRoom, /selectExecutionQueue/u);
  assert.doesNotMatch(dashboard, /selectDashboardNow/u);
});

test("Start Work is one server-owned operation and records its event in the same batch", () => {
  const actions = source("..", "work-sessions", "actions.ts");
  const fn = sliceFunction(actions, "export async function startWork(");
  assert.match(fn, /validateStartTarget/u);
  assert.match(fn, /\.batch<RawMutationRow>/u);
  assert.match(fn, /START_WORK_SESSION_SQL/u);
  assert.match(fn, /LOG_WORK_SESSION_STARTED_SQL/u);
  assert.match(fn, /state\.openSession\?\.videoId === videoId/u);
  assert.match(fn, /changed: false/u);
  assert.doesNotMatch(fn, /update\(videoLogs\)/u);
  assert.doesNotMatch(actions, /export async function startWorkSession\(/u);
});

test("Start Work derives and validates Video to Project to canonical Client", () => {
  const actions = source("..", "work-sessions", "actions.ts");
  const validation = sliceFunction(actions, "async function validateStartTarget(");
  assert.match(validation, /leftJoin\(projects/u);
  assert.match(validation, /leftJoin\(clients/u);
  assert.match(validation, /projectClientId !== row\.clientId/u);
  assert.match(validation, /canonicalClientId\(row\.clientId\)/u);
  assert.match(validation, /Canonical Client for this operational alias was not found/u);
});

test("session end remains distinct from Video finish/delivery semantics", () => {
  const actions = source("..", "work-sessions", "actions.ts");
  const productivityActions = source("..", "productivity", "actions.ts");
  const panel = source("..", "..", "components", "work-sessions", "NowFocusPanel.tsx");
  const fn = sliceFunction(actions, "export async function endWorkSession(");
  const finishVideo = sliceFunction(productivityActions, "async function applyVideoStatusTransition(");
  assert.match(fn, /STOP_WORK_SESSION_SQL/u);
  assert.match(fn, /LOG_WORK_SESSION_ENDED_SQL/u);
  assert.doesNotMatch(fn, /update\(videoLogs\)/u);
  assert.doesNotMatch(finishVideo, /workSessions/u);
  assert.match(panel, /"End Session"/u);
  assert.doesNotMatch(panel, /"Finish Session"/u);
});

test("the app-shell entity contract covers Client, Project, Video and Session", () => {
  const navigation = source("..", "..", "lib", "entity-navigation.ts");
  for (const entity of ["client", "project", "video", "session"]) {
    assert.match(navigation, new RegExp(`type: "${entity}"`, "u"));
  }
});
