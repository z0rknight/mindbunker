import assert from "node:assert/strict";
import test from "node:test";

import { groupDashboardAttention, rankDashboardAttention, selectDashboardNow } from "./core.ts";
import { buildDailyHealthLedger, computeHealthWindowSummary } from "../health/core.ts";
import { previousMonthComparableRangeISO } from "../../utils/date.ts";

const base = {
  videoId: 4,
  videoTitle: "Episode 1",
  clientName: "Taryn",
  projectName: "MINI SERIES",
};

test("attention ranking puts data issues before overdue, blockers, and lifecycle work", () => {
  const items = rankDashboardAttention([
    { ...base, source: "VIDEO", sourceId: 4, title: "Review", createdAt: "2026-09-01T10:00:00Z", videoStatus: "READY_FOR_REVIEW" },
    { ...base, source: "BLOCKER", sourceId: 8, title: "Missing files", createdAt: "2026-09-01T10:00:00Z" },
    { ...base, source: "COMMITMENT", sourceId: 2, title: "Valid overdue", createdAt: "2026-08-30T10:00:00Z", dueAt: "2026-08-31T10:00:00Z" },
    { ...base, source: "COMMITMENT", sourceId: 1, title: "Impossible", createdAt: "2026-09-01T20:38:56Z", dueAt: "2026-08-31T17:38:00Z" },
  ], new Date("2026-09-01T21:00:00Z"));

  assert.deepEqual(items.map((item) => item.reason), [
    "DATA_ISSUE",
    "OVERDUE",
    "BLOCKED",
    "READY_FOR_REVIEW",
  ]);
});

test("impossible commitments never masquerade as overdue work", () => {
  const [item] = rankDashboardAttention([
    { ...base, source: "COMMITMENT", sourceId: 1, title: "48h turnaround", createdAt: "2026-09-01T20:38:56Z", dueAt: "2026-08-31T17:38:00Z" },
  ], new Date("2026-09-02T12:00:00Z"));
  assert.equal(item.reason, "DATA_ISSUE");
});

test("commitments outside the next seven operator days stay off Attention", () => {
  const items = rankDashboardAttention([
    { ...base, source: "COMMITMENT", sourceId: 1, title: "Later", createdAt: "2026-09-01T12:00:00Z", dueAt: "2026-09-10T15:00:00Z" },
  ], new Date("2026-09-01T12:00:00Z"));
  assert.deepEqual(items, []);
});

test("resolved blockers are excluded from operational attention", () => {
  const items = rankDashboardAttention([
    { ...base, source: "BLOCKER", sourceId: 3, title: "Resolved", createdAt: "2026-09-01T10:00:00Z", resolvedAt: "2026-09-01T11:00:00Z" },
  ], new Date("2026-09-01T12:00:00Z"));
  assert.deepEqual(items, []);
});

test("valid today and next-seven-day promises remain visible after lifecycle attention", () => {
  const items = rankDashboardAttention([
    { ...base, source: "VIDEO", sourceId: 9, title: "Changes", createdAt: "2026-09-01T10:00:00Z", videoStatus: "CHANGES_REQUESTED" },
    { ...base, source: "COMMITMENT", sourceId: 10, title: "Today", createdAt: "2026-09-01T10:00:00Z", dueAt: "2026-09-01T23:00:00Z" },
    { ...base, source: "COMMITMENT", sourceId: 11, title: "Soon", createdAt: "2026-09-01T10:00:00Z", dueAt: "2026-09-06T15:00:00Z" },
  ], new Date("2026-09-01T12:00:00Z"));
  assert.deepEqual(items.map((item) => item.reason), [
    "CHANGES_REQUESTED",
    "DUE_TODAY",
    "DUE_NEXT_7_DAYS",
  ]);
});

test("attention is capped at five items after deterministic ranking", () => {
  const candidates = Array.from({ length: 7 }, (_, index) => ({
    ...base,
    source: "BLOCKER",
    sourceId: index + 1,
    title: `Blocker ${index + 1}`,
    createdAt: `2026-09-01T10:0${index}:00Z`,
  }));
  assert.deepEqual(
    rankDashboardAttention(candidates, new Date("2026-09-01T12:00:00Z")).map((item) => item.sourceId),
    [1, 2, 3, 4, 5],
  );
});

test("an open session wins over recent closed-session fallback", () => {
  assert.deepEqual(
    selectDashboardNow({ id: 1 }, [{ videoId: 4, status: "IN_PROGRESS" }]),
    { mode: "OPEN", targets: [] },
  );
});

test("recent fallback includes at most two in-progress targets, never review work", () => {
  const selected = selectDashboardNow(null, [
    { videoId: 4, status: "READY_FOR_REVIEW" },
    { videoId: 5, status: "IN_PROGRESS" },
    { videoId: 6, status: "IN_PROGRESS" },
    { videoId: 7, status: "IN_PROGRESS" },
  ]);
  assert.deepEqual(selected.targets.map((target) => target.videoId), [5, 6]);
});

test("local operator dogfood keeps attention, health, and trend facts truthful", () => {
  const now = new Date("2026-09-10T15:00:00Z");
  const promise = {
    ...base,
    source: "COMMITMENT",
    sourceId: 20,
    title: "Deliver episode",
    createdAt: "2026-09-09T12:00:00Z",
    dueAt: "2026-09-10T18:00:00Z",
  };
  const blocker = {
    ...base,
    source: "BLOCKER",
    sourceId: 21,
    title: "Missing source files",
    createdAt: "2026-09-10T12:00:00Z",
  };
  const review = {
    ...base,
    source: "VIDEO",
    sourceId: 4,
    title: "Episode 1",
    createdAt: "2026-09-10T11:00:00Z",
    videoStatus: "READY_FOR_REVIEW",
  };

  assert.deepEqual(
    rankDashboardAttention([promise], now).map((item) => item.reason),
    ["DUE_TODAY"],
  );
  assert.deepEqual(
    rankDashboardAttention([promise, blocker, review], now).map((item) => item.reason),
    ["BLOCKED", "READY_FOR_REVIEW", "DUE_TODAY"],
  );
  assert.deepEqual(
    rankDashboardAttention([{ ...blocker, resolvedAt: "2026-09-10T14:00:00Z" }, review], now)
      .map((item) => item.reason),
    ["READY_FOR_REVIEW"],
  );

  const healthRows = [{
    id: 1,
    date: "2026-09-10",
    sleepHours: 7,
    caffeineMg: null,
    substancesNotes: null,
    screenTimeHours: null,
    walkingMinutes: 30,
    cyclingKm: null,
    cyclingMinutes: null,
  }];
  const ledger = buildDailyHealthLedger(healthRows, { "2026-09-10": 2 }, [], "2026-09-10", 7);
  const today = ledger[0];
  assert.deepEqual(
    [today.sleepHours, today.coffeeServings, today.caffeineMg, today.caffeineSource, today.walkingMinutes, today.cyclingKm],
    [7, 2, 180, "ESTIMATED", 30, null],
  );
  const summary = computeHealthWindowSummary(healthRows, { "2026-09-10": 2 }, "2026-09-10");
  assert.equal(summary.windowStart, "2026-09-04");
  assert.equal(summary.totalWalkingMin7d, 30);
  assert.equal(summary.totalCyclingKm7d, null);
  assert.deepEqual(previousMonthComparableRangeISO(now), {
    start: "2026-08-01",
    end: "2026-08-10",
  });
});

// ─── Tuesday Patch Priority 1: Dashboard attention grouping ────────────────

test("groupDashboardAttention collapses same reason/client/project into one group with a count", () => {
  const items = rankDashboardAttention(
    [
      { videoId: 1, videoTitle: "VSF__2", clientName: "Dave", projectName: "Short Form", source: "VIDEO", sourceId: 1, title: "Ready for review", createdAt: "2026-09-01T10:00:00Z", videoStatus: "READY_FOR_REVIEW" },
      { videoId: 2, videoTitle: "VSF__3", clientName: "Dave", projectName: "Short Form", source: "VIDEO", sourceId: 2, title: "Ready for review", createdAt: "2026-09-01T10:00:00Z", videoStatus: "READY_FOR_REVIEW" },
      { videoId: 3, videoTitle: "VSF__4", clientName: "Dave", projectName: "Short Form", source: "VIDEO", sourceId: 3, title: "Ready for review", createdAt: "2026-09-01T10:00:00Z", videoStatus: "READY_FOR_REVIEW" },
      { videoId: 4, videoTitle: "VSF__5", clientName: "Dave", projectName: "Short Form", source: "VIDEO", sourceId: 4, title: "Ready for review", createdAt: "2026-09-01T10:00:00Z", videoStatus: "READY_FOR_REVIEW" },
      { videoId: 5, videoTitle: "Video 1", clientName: "Taryn", projectName: "Mini Series", source: "VIDEO", sourceId: 5, title: "Ready for review", createdAt: "2026-09-01T10:00:00Z", videoStatus: "READY_FOR_REVIEW" },
    ],
    new Date("2026-09-02T00:00:00Z"),
    200,
  );
  const groups = groupDashboardAttention(items);
  assert.equal(groups.length, 2);
  const dave = groups.find((group) => group.clientName === "Dave");
  const taryn = groups.find((group) => group.clientName === "Taryn");
  assert.equal(dave.items.length, 4);
  assert.equal(taryn.items.length, 1);
  assert.equal(dave.reasonLabel, "Ready for review");
});

test("groupDashboardAttention never produces more raw rows than the underlying items -- no duplicate alert objects", () => {
  const items = rankDashboardAttention(
    [
      { videoId: 1, videoTitle: "A", clientName: "Dave", projectName: "P", source: "VIDEO", sourceId: 1, title: "x", createdAt: "2026-09-01T10:00:00Z", videoStatus: "READY_FOR_REVIEW" },
      { videoId: 2, videoTitle: "B", clientName: "Dave", projectName: "P", source: "VIDEO", sourceId: 2, title: "x", createdAt: "2026-09-01T10:00:00Z", videoStatus: "READY_FOR_REVIEW" },
    ],
    new Date("2026-09-02T00:00:00Z"),
    200,
  );
  const groups = groupDashboardAttention(items);
  const totalGroupedItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  assert.equal(totalGroupedItems, items.length);
});

test("groupDashboardAttention keeps a lone item's own video title visible, not hidden behind a count", () => {
  const items = rankDashboardAttention(
    [{ videoId: 5, videoTitle: "Episode 01", clientName: "Taryn", projectName: "Mini Series", source: "VIDEO", sourceId: 5, title: "x", createdAt: "2026-09-01T10:00:00Z", videoStatus: "READY_FOR_REVIEW" }],
    new Date("2026-09-02T00:00:00Z"),
    200,
  );
  const [group] = groupDashboardAttention(items);
  assert.equal(group.items.length, 1);
  assert.equal(group.items[0].videoTitle, "Episode 01");
});

test("groupDashboardAttention orders groups by the same reason severity as ranking (data issue/overdue before lifecycle)", () => {
  const items = rankDashboardAttention(
    [
      { videoId: 1, videoTitle: "A", clientName: "Dave", projectName: "P1", source: "VIDEO", sourceId: 1, title: "x", createdAt: "2026-09-01T10:00:00Z", videoStatus: "READY_FOR_REVIEW" },
      { videoId: 2, videoTitle: "B", clientName: "Shelley", projectName: "P2", source: "BLOCKER", sourceId: 2, title: "Missing files", createdAt: "2026-09-01T10:00:00Z" },
    ],
    new Date("2026-09-02T00:00:00Z"),
    200,
  );
  const groups = groupDashboardAttention(items);
  assert.equal(groups[0].reason, "BLOCKED");
  assert.equal(groups[1].reason, "READY_FOR_REVIEW");
});

test("groupDashboardAttention respects groupLimit on the number of GROUPS, not raw items", () => {
  const items = rankDashboardAttention(
    Array.from({ length: 10 }, (_, index) => ({
      videoId: index,
      videoTitle: `V${index}`,
      clientName: `Client${index}`,
      projectName: `P${index}`,
      source: "VIDEO",
      sourceId: index,
      title: "x",
      createdAt: "2026-09-01T10:00:00Z",
      videoStatus: "READY_FOR_REVIEW",
    })),
    new Date("2026-09-02T00:00:00Z"),
    200,
  );
  const groups = groupDashboardAttention(items, 3);
  assert.equal(groups.length, 3);
});
