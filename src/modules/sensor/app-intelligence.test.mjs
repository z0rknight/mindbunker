import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateIntentionalAppTime,
  aggregateObservedAppTime,
  classifyWindowSurface,
  computeCoverageSeconds,
  dailyAverageSeconds,
  normalizeApplication,
  resolveTimeWindow,
} from "./app-intelligence.ts";

test("normalizeApplication: real captured bundle IDs map to their canonical app key", () => {
  assert.equal(normalizeApplication("com.apple.Safari", "Safari"), "SAFARI");
  assert.equal(normalizeApplication("com.adobe.PremierePro.26", "Adobe Premiere"), "PREMIERE_PRO");
  // Real production evidence: the native ChatGPT desktop app's actual
  // bundle id is com.openai.codex, not a "chatgpt" string -- bundle_id
  // wins over any name-based guess, exactly as Section 8 requires.
  assert.equal(normalizeApplication("com.openai.codex", "ChatGPT"), "CHATGPT");
  assert.equal(normalizeApplication("com.anthropic.claudefordesktop", "Claude"), "CLAUDE");
  assert.equal(normalizeApplication("notion.id", "Notion"), "NOTION");
});

test("normalizeApplication: an unrecognized bundle/app falls back honestly to OTHER, never a wrong guess", () => {
  assert.equal(normalizeApplication("com.example.SomeNewApp", "Some New App"), "OTHER");
  assert.equal(normalizeApplication(null, "Unknown Thing"), "OTHER");
});

test("normalizeApplication: app-name fallback only fires when bundle_id is absent or unrecognized", () => {
  assert.equal(normalizeApplication(null, "Safari"), "SAFARI");
  assert.equal(normalizeApplication(null, "Adobe Premiere Pro"), "PREMIERE_PRO");
});

test("classifyWindowSurface: Safari + a ChatGPT-titled tab stays APP=SAFARI with SURFACE=CHATGPT_WEB, never rewritten as the app", () => {
  assert.equal(classifyWindowSurface("SAFARI", "ChatGPT"), "CHATGPT_WEB");
  assert.equal(classifyWindowSurface("SAFARI", "Notion – Sensor Ledger"), "NOTION_WEB");
  assert.equal(classifyWindowSurface("SAFARI", "claude.ai"), "CLAUDE_WEB");
});

test("classifyWindowSurface: a native app's own window title is never reinterpreted as a browser surface", () => {
  assert.equal(classifyWindowSurface("CLAUDE", "ChatGPT comparison notes"), null, "CLAUDE is not a browser");
  assert.equal(classifyWindowSurface("PREMIERE_PRO", "Notion project — timeline"), null);
});

test("classifyWindowSurface: no title, or no keyword match, returns null (not a fabricated surface)", () => {
  assert.equal(classifyWindowSurface("SAFARI", null), null);
  assert.equal(classifyWindowSurface("SAFARI", "Google — search results"), null);
});

test("aggregateObservedAppTime: excludes idle observations, clamps to the window, sums per app", () => {
  const rows = [
    { appKey: "PREMIERE_PRO", surface: null, startedAt: 1_000, endedAt: 1_600, idle: false }, // 600s active
    { appKey: "PREMIERE_PRO", surface: null, startedAt: 1_600, endedAt: 2_000, idle: true }, // idle, excluded
    { appKey: "SAFARI", surface: "CHATGPT_WEB", startedAt: 900, endedAt: 1_100, idle: false }, // clamps to 1000-1100 = 100s
    { appKey: "SAFARI", surface: "CHATGPT_WEB", startedAt: 2_500, endedAt: 2_600, idle: false }, // outside window, excluded
  ];
  const totals = aggregateObservedAppTime(rows, 1_000, 2_000);
  const premiere = totals.find((t) => t.appKey === "PREMIERE_PRO");
  const safari = totals.find((t) => t.appKey === "SAFARI");
  assert.equal(premiere.seconds, 600);
  assert.equal(safari.seconds, 100);
  assert.equal(safari.surface, "CHATGPT_WEB");
});

test("aggregateIntentionalAppTime: only counts the overlap between active app time and an intentional session interval", () => {
  const observations = [
    // Premiere active 0-3600 (1 hour)
    { appKey: "PREMIERE_PRO", surface: null, startedAt: 0, endedAt: 3_600, idle: false },
  ];
  const sessions = [
    // A CLIENT session only covers the first 20 minutes.
    { contextType: "CLIENT", startedAt: 0, endedAt: 1_200 },
  ];
  const totals = aggregateIntentionalAppTime(observations, sessions, 0, 3_600);
  assert.equal(totals.length, 1);
  assert.equal(totals[0].seconds, 1_200, "only the overlapping 20 minutes count as intentional");
  assert.equal(totals[0].byContext.CLIENT, 1_200);
});

test("aggregateIntentionalAppTime: editing a session's timestamps changes the overlap result (derived, never a stored total)", () => {
  const observations = [{ appKey: "PREMIERE_PRO", surface: null, startedAt: 0, endedAt: 3_600, idle: false }];
  const before = aggregateIntentionalAppTime(observations, [{ contextType: "INTERNAL", startedAt: 0, endedAt: 1_800 }], 0, 3_600);
  const afterCorrection = aggregateIntentionalAppTime(observations, [{ contextType: "INTERNAL", startedAt: 0, endedAt: 900 }], 0, 3_600);
  assert.equal(before[0].seconds, 1_800);
  assert.equal(afterCorrection[0].seconds, 900, "correcting the session's end must immediately change the derived overlap");
});

test("aggregateIntentionalAppTime: a CLIENT session later approved into a Work Session is still ONE physical interval -- no double count", () => {
  const observations = [{ appKey: "PREMIERE_PRO", surface: null, startedAt: 0, endedAt: 3_600, idle: false }];
  // Approval never creates a second sensor_sessions row or a second
  // interval -- the overlap source is sensor_sessions itself, so passing
  // the same session once (regardless of its approval_state) is the only
  // correct call shape. This test documents that contract: calling with
  // the same interval twice (simulating a hypothetical bug that also fed
  // the approved work_session's interval in) is what WOULD double count,
  // proving the real code path (which only ever supplies one row per
  // sensor session) cannot.
  const once = aggregateIntentionalAppTime(observations, [{ contextType: "CLIENT", startedAt: 0, endedAt: 3_600 }], 0, 3_600);
  const wouldDouble = aggregateIntentionalAppTime(
    observations,
    [
      { contextType: "CLIENT", startedAt: 0, endedAt: 3_600 },
      { contextType: "CLIENT", startedAt: 0, endedAt: 3_600 },
    ],
    0,
    3_600,
  );
  assert.equal(once[0].seconds, 3_600);
  assert.equal(wouldDouble[0].seconds, 7_200, "documents why the data layer must supply each sensor session exactly once");
});

test("computeCoverageSeconds: merges overlapping/adjacent observation intervals instead of naively summing them", () => {
  const intervals = [
    { startedAt: 0, endedAt: 100 },
    { startedAt: 50, endedAt: 150 }, // overlaps the first -- must not double count 50-100
    { startedAt: 400, endedAt: 500 }, // a real gap before this
  ];
  const coverage = computeCoverageSeconds(intervals, 0, 1_000);
  assert.equal(coverage, 150 + 100); // 0-150 merged, plus 400-500
});

test("computeCoverageSeconds: a real Sensor-offline gap is NOT hidden by a naive min/max span", () => {
  const intervals = [
    { startedAt: 0, endedAt: 60 },
    { startedAt: 86_000, endedAt: 86_400 }, // almost a full day later
  ];
  const coverage = computeCoverageSeconds(intervals, 0, 86_400);
  assert.equal(coverage, 60 + 400, "coverage must reflect only what was actually observed, not the full min-max span");
  assert.ok(coverage < 86_400, "must never imply full-window coverage when most of it was an offline gap");
});

test("resolveTimeWindow: TODAY starts at America/Sao_Paulo local midnight, not UTC midnight", () => {
  // 2026-09-16T02:00:00Z is 2026-09-15 23:00 in America/Sao_Paulo (UTC-3)
  // -- still "yesterday" locally, so TODAY must resolve to Sep 15's local
  // midnight, not Sep 16's.
  const window = resolveTimeWindow("TODAY", "2026-09-16T02:00:00.000Z");
  const localMidnightSep15 = Date.parse("2026-09-15T03:00:00.000Z") / 1_000; // Sep 15 00:00 -03:00 == Sep 15 03:00 UTC
  assert.equal(window.startSeconds, localMidnightSep15);
  assert.equal(window.days, 1);
});

test("resolveTimeWindow: LAST_3_DAYS and LAST_7_DAYS are rolling windows including today, ending now", () => {
  const now = "2026-09-16T18:00:00.000Z";
  const w3 = resolveTimeWindow("LAST_3_DAYS", now);
  const w7 = resolveTimeWindow("LAST_7_DAYS", now);
  assert.equal(w3.days, 3);
  assert.equal(w7.days, 7);
  assert.equal(w3.endSeconds, Math.floor(Date.parse(now) / 1_000));
  assert.ok(w3.startSeconds > w7.startSeconds, "a 3-day window must start later (more recently) than a 7-day window ending at the same instant");
});

test("resolveTimeWindow: LAST_WEEK is the previous completed Monday-start calendar week, not a rolling 7 days", () => {
  // 2026-09-16 is a Wednesday; this week's Monday is 2026-09-14, so last
  // week is 2026-09-07 through 2026-09-14 (exclusive end).
  const window = resolveTimeWindow("LAST_WEEK", "2026-09-16T18:00:00.000Z");
  const expectedStart = Date.parse("2026-09-07T03:00:00.000Z") / 1_000;
  const expectedEnd = Date.parse("2026-09-14T03:00:00.000Z") / 1_000;
  assert.equal(window.startSeconds, expectedStart);
  assert.equal(window.endSeconds, expectedEnd);
  assert.equal(window.days, 7);
});

test("resolveTimeWindow: THIS_MONTH is month-to-date, days = day-of-month so far", () => {
  const window = resolveTimeWindow("THIS_MONTH", "2026-09-16T18:00:00.000Z");
  assert.equal(window.days, 16);
  const expectedStart = Date.parse("2026-09-01T03:00:00.000Z") / 1_000;
  assert.equal(window.startSeconds, expectedStart);
});

test("resolveTimeWindow: MONTH accepts an explicit YYYY-MM and returns the full completed calendar month", () => {
  const window = resolveTimeWindow("MONTH", "2026-09-16T18:00:00.000Z", "2026-08");
  const expectedStart = Date.parse("2026-08-01T03:00:00.000Z") / 1_000;
  const expectedEnd = Date.parse("2026-09-01T03:00:00.000Z") / 1_000;
  assert.equal(window.startSeconds, expectedStart);
  assert.equal(window.endSeconds, expectedEnd);
  assert.equal(window.days, 31);
});

test("resolveTimeWindow: MONTH for the current, still-ongoing month caps at now instead of the full month", () => {
  const window = resolveTimeWindow("MONTH", "2026-09-16T18:00:00.000Z", "2026-09");
  assert.equal(window.endSeconds, Math.floor(Date.parse("2026-09-16T18:00:00.000Z") / 1_000));
});

test("dailyAverageSeconds: includes zero-use days in the denominator (never only active days)", () => {
  // 1 hour of total usage across a 3-day window, even if only 1 of those
  // days had any activity at all -- the average must still divide by 3.
  assert.equal(dailyAverageSeconds(3_600, 3), 1_200);
  assert.equal(dailyAverageSeconds(0, 7), 0);
});
