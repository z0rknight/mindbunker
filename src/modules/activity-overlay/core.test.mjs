import { test } from "node:test";
import assert from "node:assert/strict";
import { computeActivityOverlay } from "./core.ts";

function obs(app, startIso, endIso) {
  return { appName: app, startedAt: new Date(startIso), endedAt: new Date(endIso) };
}

test("computeActivityOverlay: counts app switches between consecutive observations", () => {
  const overlay = computeActivityOverlay([
    obs("Premiere Pro", "2026-08-31T09:00:00Z", "2026-08-31T09:30:00Z"),
    obs("Finder", "2026-08-31T09:30:00Z", "2026-08-31T09:35:00Z"),
    obs("Premiere Pro", "2026-08-31T09:35:00Z", "2026-08-31T10:00:00Z"),
  ]);
  assert.equal(overlay.appSwitchCount, 2);
});

test("computeActivityOverlay: production tool ratio is production seconds / total seconds", () => {
  const overlay = computeActivityOverlay([
    obs("Premiere Pro", "2026-08-31T09:00:00Z", "2026-08-31T09:30:00Z"),
    obs("Safari", "2026-08-31T09:30:00Z", "2026-08-31T09:40:00Z"),
  ]);
  assert.ok(Math.abs((overlay.productionToolRatio ?? 0) - 0.75) < 0.001);
});

test("computeActivityOverlay: null ratio and zero coverage with no observations", () => {
  const overlay = computeActivityOverlay([]);
  assert.equal(overlay.productionToolRatio, null);
  assert.equal(overlay.coverageSeconds, 0);
});
