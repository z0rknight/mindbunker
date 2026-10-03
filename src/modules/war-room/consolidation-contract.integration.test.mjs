import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("War Room owns the execution hierarchy and Productivity is absent from primary navigation", () => {
  const page = src("../../app/war-room/page.tsx");
  const sidebar = src("../../components/layout/Sidebar.tsx");
  assert.ok(page.indexOf("<NowFocusPanel") < page.indexOf("Live context"));
  assert.ok(page.indexOf("Live context") < page.indexOf("<WarRoomExecutionQueue"));
  assert.ok(page.indexOf("<WarRoomExecutionQueue") < page.indexOf("<DailyLedgerSection"));
  assert.doesNotMatch(sidebar, /label: "Productivity"/u);
  assert.match(sidebar, /grid-cols-6/u);
});

test("top objective visibly distinguishes IDLE, ACTIVE and BLOCKED and explains WHY NOW", () => {
  const panel = src("../../components/work-sessions/NowFocusPanel.tsx");
  for (const state of ["IDLE", "ACTIVE", "BLOCKED", "WHY NOW", "NEXT →"]) {
    assert.match(panel, new RegExp(state, "u"));
  }
  assert.match(panel, /startWork\(/u);
  assert.match(panel, /endWorkSession\(/u);
});

test("full queue reuses canonical actions while deep management stays outside the retired route", () => {
  const tool = src("../../app/war-room/WarRoomExecutionQueue.tsx");
  const queue = src("../../app/productivity/ExecutionQueueSection.tsx");
  const compatibility = src("../../app/productivity/page.tsx");
  const workspace = src("../../app/war-room/workspace/page.tsx");
  assert.match(tool, /ExecutionQueueSection/u);
  assert.match(queue, /reorderExecutionQueueItem/u);
  assert.match(queue, /startWork/u);
  assert.match(queue, /interactiveFilters/u);
  assert.match(compatibility, /redirect\(videoWorkspaceHref/u);
  assert.doesNotMatch(compatibility, /VideoOperationsCard|ExecutionQueueSection/u);
  assert.match(workspace, /VideoOperationsCard/u);
});

test("War Room inspection remains drawer-first for live context and queue rows", () => {
  const page = src("../../app/war-room/page.tsx");
  const compactQueue = src("../../app/war-room/WarRoomExecutionQueue.tsx");
  const stage = src("../../app/war-room/restaurant/WarRoomRestaurantStage.tsx");
  assert.match(page, /EntityInspectionHrefTrigger/u);
  assert.match(compactQueue, /EntityInspectionTrigger/u);
  assert.match(stage, /EntityInspection/u);
});
