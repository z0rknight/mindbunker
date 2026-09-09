import assert from "node:assert/strict";
import test from "node:test";
import {
  computeGaps,
  computeOverlaps,
  assignOverlapLanes,
  distinctFilterOptions,
  filterSessionTimelineItems,
  rawDurationSeconds,
  sessionsByDayKey,
  wallClockDurationSeconds,
} from "./timeline.ts";

const NOW = "2026-09-11T20:00:00.000Z";

let nextId = 1;
function item(startedAt, endedAt, overrides = {}) {
  const startedMs = Date.parse(startedAt);
  const endedMs = endedAt ? Date.parse(endedAt) : Date.parse(NOW);
  return {
    id: nextId++,
    startedAt,
    endedAt,
    durationSeconds: Math.floor((endedMs - startedMs) / 1000),
    clientId: null,
    clientName: null,
    projectId: null,
    projectName: null,
    videoId: 1,
    videoTitle: "Video",
    videoKind: "CLIENT_WORK",
    activityType: "EDITING",
    source: "WEB_TIMER",
    note: null,
    status: endedAt ? "CLOSED" : "OPEN",
    updatedAt: null,
    sensorSessionId: null,
    ...overrides,
  };
}

// ─── Overlaps ───────────────────────────────────────────────────────────

test("computeOverlaps: empty day produces no overlaps", () => {
  assert.equal(computeOverlaps([], NOW).size, 0);
});

test("computeOverlaps: a normal, non-overlapping day produces no overlaps", () => {
  const a = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z");
  const b = item("2026-09-11T09:30:00.000Z", "2026-09-11T10:00:00.000Z");
  const overlaps = computeOverlaps([a, b], NOW);
  assert.equal(overlaps.size, 0);
});

test("computeOverlaps: touching sessions (A.end === B.start) are NOT an overlap", () => {
  const a = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z");
  const b = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:00:00.000Z");
  const overlaps = computeOverlaps([a, b], NOW);
  assert.equal(overlaps.size, 0);
});

test("computeOverlaps: a simple two-way overlap is detected both ways", () => {
  const a = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:00:00.000Z");
  const b = item("2026-09-11T09:30:00.000Z", "2026-09-11T10:15:00.000Z");
  const overlaps = computeOverlaps([a, b], NOW);
  assert.deepEqual(overlaps.get(a.id), [b.id]);
  assert.deepEqual(overlaps.get(b.id), [a.id]);
});

test("computeOverlaps: a three-way overlap lists every pairwise partner", () => {
  const a = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:30:00.000Z");
  const b = item("2026-09-11T09:15:00.000Z", "2026-09-11T10:00:00.000Z");
  const c = item("2026-09-11T09:45:00.000Z", "2026-09-11T11:00:00.000Z");
  const overlaps = computeOverlaps([a, b, c], NOW);
  assert.deepEqual(new Set(overlaps.get(a.id)), new Set([b.id, c.id]));
  assert.deepEqual(new Set(overlaps.get(b.id)), new Set([a.id, c.id]));
  assert.deepEqual(new Set(overlaps.get(c.id)), new Set([a.id, b.id]));
});

test("computeOverlaps: an OPEN session overlapping a closed one uses the caller's now as its effective end", () => {
  const closed = item("2026-09-11T19:50:00.000Z", "2026-09-11T20:10:00.000Z");
  const open = item("2026-09-11T19:55:00.000Z", null); // running, effective end = NOW (20:00)
  const overlaps = computeOverlaps([closed, open], NOW);
  assert.deepEqual(overlaps.get(closed.id), [open.id]);
  assert.deepEqual(overlaps.get(open.id), [closed.id]);
});

test("computeOverlaps: an OPEN session that hasn't reached the other session's start yet does not overlap", () => {
  const a = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z");
  const open = item("2026-09-11T19:55:00.000Z", null); // starts long after a ends
  const overlaps = computeOverlaps([a, open], NOW);
  assert.equal(overlaps.size, 0);
});

test("assignOverlapLanes: non-overlapping sessions all land in lane 0", () => {
  const a = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z");
  const b = item("2026-09-11T09:30:00.000Z", "2026-09-11T10:00:00.000Z");
  const lanes = assignOverlapLanes([a, b], NOW);
  assert.equal(lanes.get(a.id), 0);
  assert.equal(lanes.get(b.id), 0);
});

test("assignOverlapLanes: a two-way overlap gets two distinct lanes", () => {
  const a = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:00:00.000Z");
  const b = item("2026-09-11T09:30:00.000Z", "2026-09-11T10:15:00.000Z");
  const lanes = assignOverlapLanes([a, b], NOW);
  assert.notEqual(lanes.get(a.id), lanes.get(b.id));
});

// ─── Gaps ───────────────────────────────────────────────────────────────

test("computeGaps: empty day produces no gaps", () => {
  assert.deepEqual(computeGaps([], NOW), []);
});

test("computeGaps: adjacent sessions with no gap produce nothing", () => {
  const a = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z");
  const b = item("2026-09-11T09:15:00.000Z", "2026-09-11T09:45:00.000Z");
  const gaps = computeGaps([a, b], NOW);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].gapSeconds, 15 * 60);
});

// Touching sessions (A.end === B.start) produce NO gap entry at all, not a
// zero-length one -- there's nothing real to show a band for, and the
// Timeline only renders a gap band when gapSeconds is truthy, so a
// {gapSeconds:0} entry would either be silently dropped or render a
// confusing empty "0m gap" band. Absence, not a zero value, is the
// correct honest representation of "nothing happened here."
test("computeGaps: touching sessions produce no gap entry, never a negative one", () => {
  const a = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z");
  const b = item("2026-09-11T09:00:00.000Z", "2026-09-11T09:30:00.000Z");
  assert.deepEqual(computeGaps([a, b], NOW), []);
});

test("computeGaps: an overlapping pair produces no gap entry", () => {
  const a = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:00:00.000Z");
  const b = item("2026-09-11T09:30:00.000Z", "2026-09-11T10:15:00.000Z");
  assert.deepEqual(computeGaps([a, b], NOW), []);
});

test("computeGaps: an OPEN session produces no trailing gap after it", () => {
  const a = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z");
  const open = item("2026-09-11T10:00:00.000Z", null);
  // only one gap between a and open -- nothing "after" open since it's last
  const gaps = computeGaps([a, open], NOW);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].afterId, a.id);
  assert.equal(gaps[0].beforeId, open.id);
});

test("computeGaps: a dense day with many short sessions produces one gap per real interval", () => {
  const sessions = [
    item("2026-09-11T09:00:00.000Z", "2026-09-11T09:12:00.000Z"),
    item("2026-09-11T09:15:00.000Z", "2026-09-11T09:26:00.000Z"),
    item("2026-09-11T09:30:00.000Z", "2026-09-11T09:52:00.000Z"),
    item("2026-09-11T10:00:00.000Z", "2026-09-11T10:08:00.000Z"),
  ];
  const gaps = computeGaps(sessions, NOW);
  assert.equal(gaps.length, 3);
  assert.ok(gaps.every((g) => g.gapSeconds > 0));
});

// ─── Raw vs wall-clock duration ─────────────────────────────────────────

test("rawDurationSeconds: sums every session's own duration, double-counting overlaps", () => {
  const a = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:00:00.000Z"); // 1h
  const b = item("2026-09-11T09:30:00.000Z", "2026-09-11T10:15:00.000Z"); // 45m
  assert.equal(rawDurationSeconds([a, b]), 3600 + 45 * 60);
});

test("wallClockDurationSeconds: merges overlapping intervals into the real time actually covered", () => {
  const a = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:00:00.000Z");
  const b = item("2026-09-11T09:30:00.000Z", "2026-09-11T10:15:00.000Z");
  // union is 09:00 -> 10:15 = 1h15m, not the raw 1h45m sum
  assert.equal(wallClockDurationSeconds([a, b], NOW), 75 * 60);
});

test("wallClockDurationSeconds: equals the raw sum when nothing overlaps", () => {
  const a = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z");
  const b = item("2026-09-11T09:30:00.000Z", "2026-09-11T10:00:00.000Z");
  assert.equal(wallClockDurationSeconds([a, b], NOW), rawDurationSeconds([a, b]));
});

test("wallClockDurationSeconds: empty day is zero", () => {
  assert.equal(wallClockDurationSeconds([], NOW), 0);
});

// ─── Filters ──────────────────────────────────────────────────────────

test("filterSessionTimelineItems: client filter narrows to that client only", () => {
  const taryn = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z", {
    clientId: 2,
    clientName: "Taryn Dubreuil",
  });
  const dave = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:00:00.000Z", {
    clientId: 4,
    clientName: "Dave DeMink",
  });
  const result = filterSessionTimelineItems([taryn, dave], { clientId: "2" });
  assert.deepEqual(result, [taryn]);
});

test("filterSessionTimelineItems: source filter distinguishes Sensor-approved / Manual / Web Timer", () => {
  const sensor = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z", { source: "MAC_SENSOR_APPROVED" });
  const manual = item("2026-09-11T09:00:00.000Z", "2026-09-11T09:30:00.000Z", { source: "MANUAL" });
  const web = item("2026-09-11T10:00:00.000Z", "2026-09-11T11:00:00.000Z", { source: "WEB_TIMER" });
  const all = [sensor, manual, web];
  assert.deepEqual(filterSessionTimelineItems(all, { source: "MAC_SENSOR_APPROVED" }), [sensor]);
  assert.deepEqual(filterSessionTimelineItems(all, { source: "MANUAL" }), [manual]);
  assert.deepEqual(filterSessionTimelineItems(all, { source: "WEB_TIMER" }), [web]);
});

test("filterSessionTimelineItems: work-type filter distinguishes client work from INTERNAL", () => {
  const client = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z", { videoKind: "CLIENT_WORK" });
  const internal = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:00:00.000Z", { videoKind: "INTERNAL", clientName: "RMEDIA" });
  const result = filterSessionTimelineItems([client, internal], { workType: "INTERNAL" });
  assert.deepEqual(result, [internal]);
});

test("filterSessionTimelineItems: no filters returns every item unchanged", () => {
  const a = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z");
  const b = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:00:00.000Z");
  assert.deepEqual(filterSessionTimelineItems([a, b], {}), [a, b]);
});

test("distinctFilterOptions: derives client/source option lists from the visible range only, never fabricating", () => {
  const taryn = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z", {
    clientId: 2,
    clientName: "Taryn Dubreuil",
    source: "WEB_TIMER",
  });
  const internal = item("2026-09-11T09:00:00.000Z", "2026-09-11T10:00:00.000Z", {
    clientId: null,
    clientName: null,
    source: "MAC_SENSOR_APPROVED",
  });
  const { clients, sources } = distinctFilterOptions([taryn, internal]);
  assert.deepEqual(clients, [{ id: "2", name: "Taryn Dubreuil" }]);
  assert.deepEqual(sources, ["MAC_SENSOR_APPROVED", "WEB_TIMER"]);
});

// ─── Day bucketing ──────────────────────────────────────────────────────

test("sessionsByDayKey: buckets a session by its own startedAt local day, sorted within the day", () => {
  const late = item("2026-09-11T23:50:00.000Z", "2026-09-12T00:10:00.000Z");
  const early = item("2026-09-11T08:00:00.000Z", "2026-09-11T09:00:00.000Z");
  const map = sessionsByDayKey([late, early]);
  // both fall on the same UTC calendar day here (Sep 11) since dayKeyFor
  // uses America/Sao_Paulo (UTC-3) -- 23:50 UTC is already Sep 11 20:50
  // local, so it belongs to Sep 11 local too.
  const key = [...map.keys()][0];
  assert.equal(map.get(key).length, 2);
  assert.deepEqual(map.get(key).map((s) => s.id), [early.id, late.id]);
});
