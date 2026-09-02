import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActivityTimelineDays,
  buildDailyHealthLedger,
  computeHealthWindowSummary,
  groupTimelineDaysIntoWeekColumns,
  isValidHealthDate,
  validateHealthLogMutableValues,
} from "./core.ts";

test("historical health dates stay exact calendar strings without timezone shifting", () => {
  assert.equal(isValidHealthDate("2026-08-23"), true);
  const parsed = validateHealthLogMutableValues({
    date: "2026-08-23",
    sleepHours: 7.5,
    caffeineMg: 100,
    substancesNotes: null,
    screenTimeHours: 5,
    cyclingKm: null,
    cyclingMinutes: null,
    walkingMinutes: 42,
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.date, "2026-08-23");
});

test("health date validation rejects impossible or shifted-looking dates", () => {
  assert.equal(isValidHealthDate("2026-02-29"), false);
  assert.equal(isValidHealthDate("2026-8-23"), false);
  assert.equal(isValidHealthDate("2026-08-23T00:00:00Z"), false);
});

test("health corrections contain only editable facts and preserve system identity fields", () => {
  const parsed = validateHealthLogMutableValues({
    id: 99,
    date: "2026-08-24",
    sleepHours: null,
    caffeineMg: null,
    substancesNotes: " corrected ",
    screenTimeHours: null,
    cyclingKm: 12.5,
    cyclingMinutes: 35,
    walkingMinutes: null,
    createdAt: new Date("2026-08-27T12:00:00Z"),
  });
  assert.equal(parsed.success, true);
  assert.deepEqual(Object.keys(parsed.data), [
    "date",
    "sleepHours",
    "caffeineMg",
    "substancesNotes",
    "screenTimeHours",
    "cyclingKm",
    "cyclingMinutes",
    "walkingMinutes",
  ]);
  assert.equal(parsed.data.substancesNotes, "corrected");
});

test("health corrections reject invalid values before persistence", () => {
  const parsed = validateHealthLogMutableValues({
    date: "2026-08-24",
    sleepHours: 25,
    caffeineMg: null,
    substancesNotes: null,
    screenTimeHours: null,
    cyclingKm: null,
    cyclingMinutes: null,
    walkingMinutes: null,
  });
  assert.equal(parsed.success, false);
  assert.match(parsed.error, /Sleep/);
});

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
    caffeineCount: null,
  });
});

test("daily ledger preserves unknown, explicit zero, and caffeine provenance", () => {
  const rows = buildDailyHealthLedger([
    {
      id: 1,
      date: "2026-09-01",
      sleepHours: 7,
      caffeineMg: 0,
      substancesNotes: null,
      screenTimeHours: null,
      walkingMinutes: 0,
      cyclingKm: null,
      cyclingMinutes: null,
    },
    {
      id: 2,
      date: "2026-08-30",
      sleepHours: 6,
      caffeineMg: null,
      substancesNotes: null,
      screenTimeHours: null,
      walkingMinutes: null,
      cyclingKm: null,
      cyclingMinutes: null,
    },
  ], {
    "2026-08-31": 2,
  }, [], "2026-09-01", 3);

  assert.equal(rows[0].caffeineMg, 0);
  assert.equal(rows[0].caffeineSource, "MANUAL");
  assert.equal(rows[0].walkingMinutes, 0);
  assert.equal(rows[1].coffeeServings, 2);
  assert.equal(rows[1].caffeineMg, 180);
  assert.equal(rows[1].caffeineSource, "ESTIMATED");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].coffeeServings, null);
  assert.equal(rows[0].caffeineMg, 0);
  assert.equal(rows[0].caffeineSource, "MANUAL");
  assert.equal(rows[2].coffeeServings, null);
  assert.equal(rows[2].caffeineMg, null);
  assert.equal(rows[2].caffeineSource, "NOT_MEASURED");
});

test("daily ledger sums only closed work sessions on their Sao Paulo start day", () => {
  const rows = buildDailyHealthLedger([], {}, [
    { startedAt: "2026-09-01T02:30:00Z", endedAt: "2026-09-01T03:00:00Z" },
    { startedAt: "2026-09-01T04:00:00Z", endedAt: "2026-09-01T04:45:00Z" },
  ], "2026-09-01", 2);
  assert.equal(rows[0].workSeconds, 2_700);
  assert.equal(rows[0].workSessionCount, 1);
  assert.equal(rows[1].workSeconds, 1_800);
  assert.equal(rows[1].workSessionCount, 1);
});

test("health summary uses exactly seven day keys and preserves missing versus zero", () => {
  const dates = ["2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01"];
  const logs = dates.map((date, index) => ({
    id: index + 1,
    date,
    sleepHours: 6,
    caffeineMg: null,
    substancesNotes: null,
    screenTimeHours: null,
    walkingMinutes: index === 0 ? 60 : index === 7 ? 0 : null,
    cyclingKm: null,
    cyclingMinutes: null,
  }));
  const summary = computeHealthWindowSummary(logs, {}, "2026-09-01");
  assert.equal(summary.windowStart, "2026-08-26");
  assert.equal(summary.avgSleep7Days, 6);
  assert.equal(summary.totalWalkingMin7d, 0);
  assert.equal(summary.totalCyclingKm7d, null);
  assert.equal(summary.coffeeServingsToday, null);
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
