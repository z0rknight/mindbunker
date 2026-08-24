import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActivityTimelineDays,
  groupTimelineDaysIntoWeekColumns,
} from "./core.ts";

test("buildActivityTimelineDays pads back to the nearest Monday", () => {
  // 2026-08-27 is a Thursday; 7 days back is 2026-08-21 (Friday).
  // The grid must start on the Monday on/before that: 2026-08-17.
  const days = buildActivityTimelineDays([], {}, "2026-08-27", 7);
  assert.strictEqual(days[0].date, "2026-08-17");
  assert.strictEqual(days[0].weekday, 0); // Monday
  assert.strictEqual(days[days.length - 1].date, "2026-08-27");
});

test("buildActivityTimelineDays never fabricates data for days with no log", () => {
  const days = buildActivityTimelineDays([], {}, "2026-08-24", 1);
  assert.strictEqual(days.length, 1);
  assert.deepEqual(days[0], {
    date: "2026-08-24",
    weekday: 0,
    walked: false,
    walkingMinutes: null,
    cycled: false,
    cyclingKm: null,
    sleepHours: null,
    caffeineCount: 0,
  });
});

test("buildActivityTimelineDays marks walked/cycled true only for positive values", () => {
  const logs = [
    { date: "2026-08-24", sleepHours: 7, walkingMinutes: 30, cyclingKm: 0 },
    { date: "2026-08-25", sleepHours: null, walkingMinutes: 0, cyclingKm: 12.5 },
  ];
  const days = buildActivityTimelineDays(logs, { "2026-08-24": 2 }, "2026-08-25", 2);
  const day24 = days.find((d) => d.date === "2026-08-24");
  const day25 = days.find((d) => d.date === "2026-08-25");
  assert.strictEqual(day24.walked, true);
  assert.strictEqual(day24.cycled, false);
  assert.strictEqual(day24.caffeineCount, 2);
  assert.strictEqual(day25.walked, false);
  assert.strictEqual(day25.cycled, true);
});

test("groupTimelineDaysIntoWeekColumns chunks into groups of 7, except the final column which may be a partial (still-in-progress) week", () => {
  // "today" isn't always a Sunday, so the grid (padded back to a Monday but
  // never padded forward past today) doesn't always end on a week boundary
  // -- the last column can legitimately hold fewer than 7 days, same as the
  // current week on a GitHub-style contribution calendar.
  const days = buildActivityTimelineDays([], {}, "2026-08-27", 14);
  const columns = groupTimelineDaysIntoWeekColumns(days);
  for (let i = 0; i < columns.length - 1; i++) {
    assert.strictEqual(columns[i].length, 7);
  }
  assert.ok(columns[columns.length - 1].length <= 7);
  assert.strictEqual(
    columns.reduce((sum, col) => sum + col.length, 0),
    days.length,
  );
  assert.strictEqual(columns[0][0].date, days[0].date);
});
