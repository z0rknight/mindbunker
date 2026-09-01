import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLifecycleState, deriveStageDurations, timeToFirstCut } from "./core.ts";

function ev(id, stage, iso) {
  return { id, videoId: 1, stage, note: null, createdAt: new Date(iso) };
}

test("computeLifecycleState: current is newest, previous is second-newest, given newest-first input", () => {
  const events = [ev(3, "EDITING", "2026-08-03T00:00:00Z"), ev(2, "ROUGH_CUT", "2026-08-02T00:00:00Z"), ev(1, "INGEST", "2026-08-01T00:00:00Z")];
  const state = computeLifecycleState(events, new Date("2026-08-03T02:00:00Z"));
  assert.equal(state.currentStage, "EDITING");
  assert.equal(state.previousStage, "ROUGH_CUT");
  assert.equal(state.secondsInCurrentStage, 7200);
});

test("computeLifecycleState: no events -> everything null, no crash", () => {
  const state = computeLifecycleState([]);
  assert.equal(state.currentStage, null);
  assert.equal(state.secondsInCurrentStage, null);
});

test("deriveStageDurations: computes seconds between consecutive oldest-first events", () => {
  const events = [ev(1, "INGEST", "2026-08-01T00:00:00Z"), ev(2, "ROUGH_CUT", "2026-08-01T01:00:00Z")];
  const durations = deriveStageDurations(events);
  assert.equal(durations.length, 1);
  assert.equal(durations[0].seconds, 3600);
  assert.equal(durations[0].fromStage, "INGEST");
  assert.equal(durations[0].toStage, "ROUGH_CUT");
});

test("timeToFirstCut: null when no ROUGH_CUT stage exists yet", () => {
  const events = [ev(1, "INGEST", "2026-08-01T00:00:00Z"), ev(2, "EDITING", "2026-08-01T01:00:00Z")];
  assert.equal(timeToFirstCut(events), null);
});

test("timeToFirstCut: computes seconds from INGEST to ROUGH_CUT", () => {
  const events = [ev(1, "INGEST", "2026-08-01T00:00:00Z"), ev(2, "ROUGH_CUT", "2026-08-01T03:00:00Z")];
  assert.equal(timeToFirstCut(events), 10800);
});
