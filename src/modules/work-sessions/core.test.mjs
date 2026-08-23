import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WORK_SESSION_ACTIVITY,
  DEFAULT_WORK_SESSION_SOURCE,
  STALE_SESSION_WARNING_SECONDS,
  WORK_SESSION_ACTIVITY_TYPES,
  WORK_SESSION_SOURCES,
  correlateSessionMemoryNotes,
  describeSessionCorrection,
  formatClosedDuration,
  groupWorkSessionDaysByWeek,
  groupWorkSessionsByDay,
  isSessionStale,
  isWorkSessionActivityType,
  isWorkSessionId,
  isWorkSessionSource,
  isWorkSessionVideoId,
  toUnixSeconds,
  validateSessionCorrection,
} from "./core.ts";

test("the approved activity vocabulary validates explicitly", () => {
  assert.equal(DEFAULT_WORK_SESSION_ACTIVITY, "EDITING");
  assert.deepEqual(WORK_SESSION_ACTIVITY_TYPES, [
    "EDITING",
    "MOTION_GRAPHICS",
    "COLOR",
    "AUDIO",
    "REVIEW",
    "EXPORT",
    "ADMIN",
    "OTHER",
  ]);
  for (const activity of WORK_SESSION_ACTIVITY_TYPES) {
    assert.equal(isWorkSessionActivityType(activity), true);
  }
  assert.equal(isWorkSessionActivityType("SURVEILLANCE"), false);
  assert.equal(isWorkSessionActivityType("editing"), false);
});

test("work-session identifiers and server timestamps fail closed", () => {
  assert.equal(isWorkSessionVideoId(1), true);
  assert.equal(isWorkSessionVideoId(0), false);
  assert.equal(isWorkSessionVideoId(1.5), false);
  assert.equal(isWorkSessionVideoId("1"), false);
  assert.equal(isWorkSessionId(42), true);
  assert.equal(isWorkSessionId(0), false);
  assert.equal(toUnixSeconds(new Date("2026-08-22T12:00:00.999Z")), 1_787_400_000);
});

test("closed production time uses the compact operator format", () => {
  assert.equal(formatClosedDuration(0), "0m");
  assert.equal(formatClosedDuration(30), "<1m");
  assert.equal(formatClosedDuration(3_599), "59m");
  assert.equal(formatClosedDuration(6_138), "1h 42m");
});

test("the source vocabulary is a single honest value today, deliberately open-ended", () => {
  assert.deepEqual(WORK_SESSION_SOURCES, ["WEB_TIMER"]);
  assert.equal(DEFAULT_WORK_SESSION_SOURCE, "WEB_TIMER");
  assert.equal(isWorkSessionSource("WEB_TIMER"), true);
  assert.equal(isWorkSessionSource("DESKTOP_SENSOR"), false);
  assert.equal(isWorkSessionSource(""), false);
});

test("session correction rejects an inverted or zero-length window", () => {
  const now = new Date("2026-08-23T02:00:00Z");
  const result = validateSessionCorrection(
    {
      videoId: 1,
      startedAt: new Date("2026-08-23T01:00:00Z"),
      endedAt: new Date("2026-08-23T00:59:00Z"),
      activityType: "EDITING",
      note: null,
    },
    now,
  );
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /after start/i);

  const zero = validateSessionCorrection(
    {
      videoId: 1,
      startedAt: new Date("2026-08-23T01:00:00Z"),
      endedAt: new Date("2026-08-23T01:00:00Z"),
      activityType: "EDITING",
      note: null,
    },
    now,
  );
  assert.equal(zero.success, false);
});

test("session correction rejects a future end time and an absurd duration", () => {
  const now = new Date("2026-08-23T02:00:00Z");
  const future = validateSessionCorrection(
    {
      videoId: 1,
      startedAt: new Date("2026-08-23T01:00:00Z"),
      endedAt: new Date("2026-08-23T03:00:00Z"),
      activityType: "EDITING",
      note: null,
    },
    now,
  );
  assert.equal(future.success, false);
  if (!future.success) assert.match(future.error, /future/i);

  const absurd = validateSessionCorrection(
    {
      videoId: 1,
      startedAt: new Date("2026-01-01T00:00:00Z"),
      endedAt: new Date("2026-08-23T01:00:00Z"),
      activityType: "EDITING",
      note: null,
    },
    now,
  );
  assert.equal(absurd.success, false);
  if (!absurd.success) assert.match(absurd.error, /14 days/i);
});

test("session correction rejects an invalid video/activity and trims a valid note", () => {
  const now = new Date("2026-08-23T02:00:00Z");
  const badVideo = validateSessionCorrection(
    {
      videoId: 0,
      startedAt: new Date("2026-08-23T01:00:00Z"),
      endedAt: new Date("2026-08-23T01:30:00Z"),
      activityType: "EDITING",
      note: null,
    },
    now,
  );
  assert.equal(badVideo.success, false);

  const badActivity = validateSessionCorrection(
    {
      videoId: 1,
      startedAt: new Date("2026-08-23T01:00:00Z"),
      endedAt: new Date("2026-08-23T01:30:00Z"),
      activityType: "SURVEILLANCE",
      note: null,
    },
    now,
  );
  assert.equal(badActivity.success, false);

  const ok = validateSessionCorrection(
    {
      videoId: 1,
      startedAt: new Date("2026-08-23T01:00:00Z"),
      endedAt: new Date("2026-08-23T01:30:00Z"),
      activityType: "EDITING",
      note: "  fixed the start time  ",
    },
    now,
  );
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.data.note, "fixed the start time");
});

test("correction diff only mentions fields that actually changed", () => {
  const before = {
    videoId: 1,
    videoTitle: "Video 1 - MINI SERIES",
    startedAt: "2026-08-23T01:00:00.000Z",
    endedAt: "2026-08-23T02:00:00.000Z",
    activityType: "EDITING",
    note: null,
  };
  const unchanged = describeSessionCorrection(
    42,
    before,
    {
      videoId: 1,
      startedAt: new Date("2026-08-23T01:00:00.000Z"),
      endedAt: new Date("2026-08-23T02:00:00.000Z"),
      activityType: "EDITING",
      note: null,
    },
    "Video 1 - MINI SERIES",
  );
  assert.match(unchanged, /no field values changed/);

  const timeFixed = describeSessionCorrection(
    42,
    before,
    {
      videoId: 1,
      startedAt: new Date("2026-08-23T01:10:00.000Z"),
      endedAt: new Date("2026-08-23T02:00:00.000Z"),
      activityType: "EDITING",
      note: null,
    },
    "Video 1 - MINI SERIES",
  );
  assert.match(timeFixed, /start /);
  assert.doesNotMatch(timeFixed, / end /);
  assert.doesNotMatch(timeFixed, /activity /);
});

test("a session is flagged stale only once it crosses the documented threshold", () => {
  assert.equal(STALE_SESSION_WARNING_SECONDS, 6 * 60 * 60);
  assert.equal(isSessionStale(0), false);
  assert.equal(isSessionStale(STALE_SESSION_WARNING_SECONDS - 1), false);
  assert.equal(isSessionStale(STALE_SESSION_WARNING_SECONDS), true);
  assert.equal(isSessionStale(STALE_SESSION_WARNING_SECONDS + 100), true);
});

function historyEntry(overrides = {}) {
  return {
    id: 1,
    videoId: 1,
    videoTitle: "Video 1",
    clientName: "Taryn",
    projectName: "MINI SERIES",
    activityType: "EDITING",
    startedAt: "2026-08-23T01:07:00.000Z",
    endedAt: "2026-08-23T02:58:00.000Z",
    durationSeconds: 6_660,
    status: "CLOSED",
    note: null,
    source: "WEB_TIMER",
    updatedAt: null,
    ...overrides,
  };
}

test("day grouping buckets by the America/Sao_Paulo display date, newest day first", () => {
  // 2026-08-23T01:07Z is 2026-08-22 22:07 in America/Sao_Paulo (UTC-3) —
  // the exact "23:58 close, 22:07 start" boundary from the real dogfooding
  // log this round is built on.
  const lateNightSession = historyEntry({
    id: 1,
    startedAt: "2026-08-23T01:07:00.000Z",
    endedAt: "2026-08-23T02:58:00.000Z",
    durationSeconds: 6_660,
  });
  const nextDaySession = historyEntry({
    id: 2,
    startedAt: "2026-08-23T14:00:00.000Z",
    endedAt: "2026-08-23T15:00:00.000Z",
    durationSeconds: 3_600,
  });
  const days = groupWorkSessionsByDay([nextDaySession, lateNightSession]);
  assert.equal(days.length, 2);
  assert.equal(days[0].dayKey, "2026-08-23");
  assert.equal(days[0].sessions.length, 1);
  assert.equal(days[0].sessions[0].id, 2);
  assert.equal(days[1].dayKey, "2026-08-22");
  assert.equal(days[1].sessions[0].id, 1);
  assert.equal(days[1].totalClosedSeconds, 6_660);
});

test("an open session contributes to hasOpenSession but not to the closed total", () => {
  const open = historyEntry({
    id: 3,
    endedAt: null,
    durationSeconds: null,
    status: "OPEN",
  });
  const closed = historyEntry({ id: 4 });
  const days = groupWorkSessionsByDay([open, closed]);
  const day = days.find((d) => d.sessions.some((s) => s.id === 3));
  assert.ok(day);
  assert.equal(day.hasOpenSession, true);
  assert.equal(day.totalClosedSeconds, closed.durationSeconds);
});

test("week grouping sums daily totals into a Monday-start week, newest week first", () => {
  const monday = historyEntry({
    id: 1,
    startedAt: "2026-08-17T13:00:00.000Z",
    endedAt: "2026-08-17T14:00:00.000Z",
    durationSeconds: 3_600,
  });
  const sunday = historyEntry({
    id: 2,
    startedAt: "2026-08-23T13:00:00.000Z",
    endedAt: "2026-08-23T15:00:00.000Z",
    durationSeconds: 7_200,
  });
  const nextMonday = historyEntry({
    id: 3,
    startedAt: "2026-08-24T13:00:00.000Z",
    endedAt: "2026-08-24T14:00:00.000Z",
    durationSeconds: 3_600,
  });
  const days = groupWorkSessionsByDay([nextMonday, sunday, monday]);
  const weeks = groupWorkSessionDaysByWeek(days);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].weekKey, "2026-08-24");
  assert.equal(weeks[0].totalClosedSeconds, 3_600);
  assert.equal(weeks[1].weekKey, "2026-08-17");
  assert.equal(weeks[1].totalClosedSeconds, 3_600 + 7_200);
  assert.equal(weeks[1].days.length, 2);
});

test("Session Narrative correlates a note to the session that was open when it was written", () => {
  const session = historyEntry({
    id: 10,
    videoId: 200,
    startedAt: "2026-08-23T13:00:00.000Z",
    endedAt: "2026-08-23T15:00:00.000Z",
  });
  const insideNote = { id: 1, videoId: 200, body: "AE froze mid-render", createdAt: "2026-08-23T14:00:00.000Z" };
  const beforeNote = { id: 2, videoId: 200, body: "before the session", createdAt: "2026-08-23T12:00:00.000Z" };
  const afterNote = { id: 3, videoId: 200, body: "after the session", createdAt: "2026-08-23T16:00:00.000Z" };
  const otherVideoNote = { id: 4, videoId: 999, body: "different video", createdAt: "2026-08-23T14:00:00.000Z" };

  const correlated = correlateSessionMemoryNotes(
    session,
    [insideNote, beforeNote, afterNote, otherVideoNote],
    "2026-08-24T00:00:00.000Z",
  );

  assert.equal(correlated.length, 1);
  assert.equal(correlated[0].id, 1);
  assert.equal(correlated[0].body, "AE froze mid-render");
});

test("Session Narrative uses the passed-in now as the upper bound for a still-open session", () => {
  const openSession = historyEntry({
    id: 11,
    videoId: 201,
    startedAt: "2026-08-23T13:00:00.000Z",
    endedAt: null,
    durationSeconds: null,
    status: "OPEN",
  });
  const noteJustWritten = { id: 5, videoId: 201, body: "still going", createdAt: "2026-08-23T13:30:00.000Z" };
  const noteFromTheFuture = { id: 6, videoId: 201, body: "should not correlate", createdAt: "2026-08-23T14:00:00.000Z" };

  const correlated = correlateSessionMemoryNotes(
    openSession,
    [noteJustWritten, noteFromTheFuture],
    "2026-08-23T13:45:00.000Z",
  );

  assert.equal(correlated.length, 1);
  assert.equal(correlated[0].id, 5);
});

test("Session Narrative returns notes oldest-first within a session", () => {
  const session = historyEntry({
    id: 12,
    videoId: 202,
    startedAt: "2026-08-23T13:00:00.000Z",
    endedAt: "2026-08-23T16:00:00.000Z",
  });
  const later = { id: 7, videoId: 202, body: "render complete", createdAt: "2026-08-23T15:00:00.000Z" };
  const earlier = { id: 8, videoId: 202, body: "render started", createdAt: "2026-08-23T14:00:00.000Z" };

  const correlated = correlateSessionMemoryNotes(session, [later, earlier], "2026-08-24T00:00:00.000Z");

  assert.deepEqual(correlated.map((note) => note.id), [8, 7]);
});
