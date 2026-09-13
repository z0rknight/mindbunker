// Session Timeline / Week Calendar (Wave 1). Same underlying canonical
// Work Sessions the existing Ledger (WORK_SESSION_HISTORY_SQL) already
// reads -- this is a read-model extension, not a new source of truth. See
// RMEDIA_SESSION_TIMELINE_CALENDAR_EXERCISE.md §9/§10/§11 for the full
// reasoning; this file implements exactly what that report specified.

import {
  dayKeyFor,
  type WorkSessionActivityType,
  type WorkSessionSource,
} from "./core.ts";

// A direct extension of WORK_SESSION_HISTORY_SQL's own join shape --
// same INNER JOIN video_logs / LEFT JOIN projects / LEFT JOIN clients /
// LEFT JOIN sensor_sessions -- widened with client_id, project_id and
// video_kind (all already columns on the same joined tables) and bound by
// a start/end range instead of a row LIMIT. isOperationalContainer is
// deliberately NOT selected: it has no defined application meaning yet
// (see the exercise report §2) -- reserved for Sensor Wave 3, not guessed
// at here.
export const SESSION_TIMELINE_SQL = `
  SELECT
    ws.id,
    ws.video_id,
    ws.started_at,
    ws.ended_at,
    ws.activity_type,
    ws.note,
    ws.source,
    ws.updated_at,
    COALESCE(v.title, 'Video ' || v.date) AS video_title,
    v.video_kind,
    v.client_id,
    c.name AS client_name,
    v.project_id,
    p.name AS project_name,
    ss.id AS sensor_session_id
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  LEFT JOIN projects p ON p.id = v.project_id
  LEFT JOIN clients c ON c.id = v.client_id
  LEFT JOIN sensor_sessions ss ON ss.approved_work_session_id = ws.id
  WHERE ws.started_at >= ?1 AND ws.started_at < ?2
  ORDER BY ws.started_at ASC
`;

export type VideoKind = "CLIENT_WORK" | "SAMPLE" | "INTERNAL";

export type SessionTimelineItem = {
  id: number;
  startedAt: string; // ISO
  endedAt: string | null; // null = OPEN
  durationSeconds: number; // for OPEN sessions, computed against the caller's "now"

  clientId: number | null;
  clientName: string | null;

  projectId: number | null;
  projectName: string | null;

  videoId: number;
  videoTitle: string;
  videoKind: VideoKind;

  activityType: WorkSessionActivityType;
  source: WorkSessionSource;
  note: string | null;

  status: "OPEN" | "CLOSED";
  updatedAt: string | null;
  sensorSessionId: number | null;
};

// ─── Derived facts: overlap ────────────────────────────────────────────
//
// Standard half-open interval intersection: A.start < B.end && B.start <
// A.end. Touching endpoints (A.end === B.start) are NOT an overlap -- a
// zero-length gap instead (see computeGaps below). Given
// work_sessions_one_open_idx (at most one globally open row), a real
// overlap can only involve at least one CLOSED session with a careless or
// corrected window -- rare, but must never be hidden or silently merged.
// Pure function, "now" passed in by the caller for the OPEN session's
// effective end -- same shape as core.ts's own correlateSessionMemoryNotes.

export function computeOverlaps(
  sessions: readonly SessionTimelineItem[],
  nowIso: string,
): Map<number, number[]> {
  const map = new Map<number, number[]>();
  const effectiveEnd = (s: SessionTimelineItem) =>
    Date.parse(s.endedAt ?? nowIso);

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      const aStart = Date.parse(a.startedAt);
      const aEnd = effectiveEnd(a);
      const bStart = Date.parse(b.startedAt);
      const bEnd = effectiveEnd(b);
      if (aStart < bEnd && bStart < aEnd) {
        const aList = map.get(a.id) ?? [];
        aList.push(b.id);
        map.set(a.id, aList);
        const bList = map.get(b.id) ?? [];
        bList.push(a.id);
        map.set(b.id, bList);
      }
    }
  }
  return map;
}

// Assigns each session to a lane index (0-based) such that no two
// sessions sharing a lane overlap -- a simple greedy interval-graph-
// coloring pass, sessions must already be sorted by startedAt. Pure
// rendering support for the "parallel lanes" visual treatment; never
// changes which sessions are considered overlapping (computeOverlaps
// above remains the single source of truth for that).
export function assignOverlapLanes(
  sessions: readonly SessionTimelineItem[],
  nowIso: string,
): Map<number, number> {
  const lanes = new Map<number, number>();
  const laneEnds: number[] = []; // effective end time currently occupying each lane
  const effectiveEnd = (s: SessionTimelineItem) =>
    Date.parse(s.endedAt ?? nowIso);

  for (const s of sessions) {
    const start = Date.parse(s.startedAt);
    let laneIndex = laneEnds.findIndex((end) => end <= start);
    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(effectiveEnd(s));
    } else {
      laneEnds[laneIndex] = effectiveEnd(s);
    }
    lanes.set(s.id, laneIndex);
  }
  return lanes;
}

// ─── Derived facts: gaps ────────────────────────────────────────────────
//
// A gap is previous.end -> next.start for two CHRONOLOGICALLY ADJACENT
// sessions (by startedAt) that do not overlap. Deliberately only
// inter-session gaps -- no synthetic gap from day-start to the first
// session or from the last session to "now" (see the exercise report
// §11 for why). Never persisted; this is purely a rendering fact.

export type SessionGap = {
  afterId: number;
  beforeId: number;
  gapSeconds: number;
};

export function computeGaps(
  sessions: readonly SessionTimelineItem[],
  nowIso: string,
): SessionGap[] {
  const gaps: SessionGap[] = [];
  const effectiveEnd = (s: SessionTimelineItem) =>
    Date.parse(s.endedAt ?? nowIso);

  for (let i = 0; i < sessions.length - 1; i++) {
    const prevEnd = effectiveEnd(sessions[i]);
    const nextStart = Date.parse(sessions[i + 1].startedAt);
    if (prevEnd < nextStart) {
      gaps.push({
        afterId: sessions[i].id,
        beforeId: sessions[i + 1].id,
        gapSeconds: Math.floor((nextStart - prevEnd) / 1000),
      });
    }
  }
  return gaps;
}

// ─── Raw vs wall-clock duration ────────────────────────────────────────
//
// Every existing total elsewhere in the app (WORK_SESSION_OVERVIEW_SQL,
// Home "Today", Finance hours-by-client) is a raw per-row sum -- it
// already silently double-counts if sessions ever overlap, a latent
// property of the existing code this feature does not change. Here, both
// figures are computed and only surfaced together, only when an overlap
// is actually present on the visible range (see exercise report §10).

export function rawDurationSeconds(sessions: readonly SessionTimelineItem[]): number {
  return sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
}

export function wallClockDurationSeconds(
  sessions: readonly SessionTimelineItem[],
  nowIso: string,
): number {
  if (sessions.length === 0) return 0;
  const effectiveEnd = (s: SessionTimelineItem) =>
    Date.parse(s.endedAt ?? nowIso);
  const intervals = sessions
    .map((s) => [Date.parse(s.startedAt), effectiveEnd(s)] as const)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let [curStart, curEnd] = intervals[0];
  for (let i = 1; i < intervals.length; i++) {
    const [start, end] = intervals[i];
    if (start <= curEnd) {
      curEnd = Math.max(curEnd, end);
    } else {
      total += curEnd - curStart;
      [curStart, curEnd] = [start, end];
    }
  }
  total += curEnd - curStart;
  return Math.floor(total / 1000);
}

// ─── Day bucketing for Timeline / Week ─────────────────────────────────
//
// Reuses dayKeyFor (America/Sao_Paulo, already the trusted grouping key
// throughout work-sessions/core.ts) rather than inventing a second
// timezone boundary primitive. Sessions are bucketed by their own
// startedAt -- a session crossing midnight stays in the day it started,
// exactly like every other day-grouping surface in this app.

export function sessionsByDayKey(
  sessions: readonly SessionTimelineItem[],
): Map<string, SessionTimelineItem[]> {
  const map = new Map<string, SessionTimelineItem[]>();
  for (const s of sessions) {
    const key = dayKeyFor(s.startedAt);
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  }
  return map;
}

export function totalDurationSeconds(sessions: readonly SessionTimelineItem[]): number {
  return rawDurationSeconds(sessions);
}

// ─── Minimal filters ────────────────────────────────────────────────────
//
// Deliberately just three narrow, orthogonal filters (client, source,
// work type) applied as a plain array filter over an already-fetched
// range -- no rules builder, no saved views (see exercise report §9 of
// the mission brief / non-goals). Filter option lists are meant to be
// derived by the caller from the UNFILTERED range set (see
// distinctFilterOptions below), so narrowing one filter never hides the
// options for another.

export type SessionTimelineFilters = {
  clientId?: string | null;
  source?: string | null;
  workType?: string | null;
};

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/u;

export function monthKeyFor(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  if (!MONTH_KEY_PATTERN.test(monthKey)) throw new Error("Invalid month key.");
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthDayKeys(monthKey: string): string[] {
  if (!MONTH_KEY_PATTERN.test(monthKey)) return [];
  const [year, month] = monthKey.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, index) =>
    `${monthKey}-${String(index + 1).padStart(2, "0")}`,
  );
}

export function filterSessionTimelineItems(
  items: readonly SessionTimelineItem[],
  filters: SessionTimelineFilters,
): SessionTimelineItem[] {
  return items.filter((item) => {
    if (filters.clientId && String(item.clientId) !== filters.clientId) return false;
    if (filters.source && item.source !== filters.source) return false;
    if (filters.workType && item.videoKind !== filters.workType) return false;
    return true;
  });
}

export function distinctFilterOptions(items: readonly SessionTimelineItem[]): {
  clients: Array<{ id: string; name: string }>;
  sources: string[];
} {
  const clients = new Map<string, string>();
  const sources = new Set<string>();
  for (const item of items) {
    if (item.clientId !== null) {
      clients.set(String(item.clientId), item.clientName ?? `#${item.clientId}`);
    }
    sources.add(item.source);
  }
  return {
    clients: [...clients.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    sources: [...sources].sort(),
  };
}
