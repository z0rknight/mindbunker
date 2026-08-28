import "server-only";

import { getAuthenticatedDb } from "@/db";
import { getVideoOperationalMemoryForVideos } from "@/modules/video-memory/actions";
import {
  OPEN_WORK_SESSION_SQL,
  VIDEO_WORK_SESSION_SUMMARY_SQL,
  WORK_SESSION_ATTRIBUTION_SQL,
  WORK_SESSION_BY_ID_SQL,
  WORK_SESSION_HISTORY_SQL,
  WORK_SESSION_OVERVIEW_SQL,
  computeProjectStreaks,
  computeTodayWorkSessionStats,
  correlateSessionMemoryNotes,
  dayKeyFor,
  isSessionStale,
  isWorkSessionActivityType,
  isWorkSessionSource,
  isWorkSessionVideoId,
  sortProjectStreaks,
  toUnixSeconds,
  type CorrelatedMemoryNote,
  type OpenWorkSession,
  type ProjectStreak,
  type SessionCorrectionBefore,
  type TodayWorkSessionStats,
  type VideoWorkSessionState,
  type VideoWorkSessionSummary,
  type WorkSessionAttributionRow,
  type WorkSessionHistoryEntry,
} from "./core";

type RawSummaryRow = {
  video_id: number;
  closed_seconds: number;
  session_count: number;
};

type RawOpenSessionRow = {
  id: number;
  video_id: number;
  video_title: string;
  client_name: string | null;
  project_name: string | null;
  activity_type: string;
  started_at: number;
  device_name: string | null;
};

type RawHistoryRow = {
  id: number;
  video_id: number;
  video_title: string;
  client_name: string | null;
  project_name: string | null;
  activity_type: string;
  started_at: number;
  ended_at: number | null;
  note: string | null;
  source: string;
  updated_at: number | null;
  sensor_session_id: number | null;
};

type RawSessionByIdRow = {
  id: number;
  video_id: number;
  client_id: number | null;
  video_title: string;
  client_name: string | null;
  project_name: string | null;
  activity_type: string;
  started_at: number;
  ended_at: number | null;
  note: string | null;
};

function mapSummary(row: RawSummaryRow): VideoWorkSessionSummary {
  return {
    videoId: Number(row.video_id),
    closedSeconds: Number(row.closed_seconds),
    sessionCount: Number(row.session_count),
  };
}

function mapOpenSession(row: RawOpenSessionRow | null): OpenWorkSession | null {
  if (!row || !isWorkSessionActivityType(row.activity_type)) return null;
  return {
    id: Number(row.id),
    videoId: Number(row.video_id),
    videoTitle: row.video_title,
    clientName: row.client_name,
    projectName: row.project_name,
    activityType: row.activity_type,
    startedAt: new Date(Number(row.started_at) * 1_000).toISOString(),
    deviceName: row.device_name,
  };
}

async function readOpenSession(client: D1Database) {
  const row = await client
    .prepare(OPEN_WORK_SESSION_SQL)
    .first<RawOpenSessionRow>();
  return mapOpenSession(row);
}

export async function getWorkSessionOverview() {
  const db = await getAuthenticatedDb();
  const [summaryResult, openSession] = await Promise.all([
    db.$client
      .prepare(WORK_SESSION_OVERVIEW_SQL)
      .all<RawSummaryRow>(),
    readOpenSession(db.$client),
  ]);

  // Computed here, in the data layer, rather than in the Productivity page
  // component: React's purity rule (correctly) forbids calling Date.now()
  // during render, since a Server Component's render can be invoked more
  // than once. This function is a plain async data fetch, not a render, so
  // "now" is read exactly once per request, at fetch time — the request's
  // own timestamp, same as every other timestamp already read this way.
  const openSessionElapsedSeconds = openSession
    ? Math.max(0, Math.floor((Date.now() - Date.parse(openSession.startedAt)) / 1_000))
    : 0;
  const openSessionStale = openSession !== null && isSessionStale(openSessionElapsedSeconds);

  return {
    summaries: summaryResult.results.map(mapSummary),
    openSession,
    openSessionElapsedSeconds,
    openSessionStale,
  };
}

export async function getVideoWorkSessionState(
  videoId: number,
): Promise<VideoWorkSessionState> {
  if (!isWorkSessionVideoId(videoId)) {
    return {
      summary: { videoId: 0, closedSeconds: 0, sessionCount: 0 },
      openSession: null,
    };
  }

  const db = await getAuthenticatedDb();
  const [summaryRow, openSession] = await Promise.all([
    db.$client
      .prepare(VIDEO_WORK_SESSION_SUMMARY_SQL)
      .bind(videoId)
      .first<RawSummaryRow>(),
    readOpenSession(db.$client),
  ]);

  return {
    summary: summaryRow
      ? mapSummary(summaryRow)
      : { videoId, closedSeconds: 0, sessionCount: 0 },
    openSession,
  };
}

export async function videoClosedSeconds(videoId: number) {
  if (!isWorkSessionVideoId(videoId)) return 0;
  const db = await getAuthenticatedDb();
  const row = await db.$client
    .prepare(VIDEO_WORK_SESSION_SUMMARY_SQL)
    .bind(videoId)
    .first<RawSummaryRow>();
  return row ? Number(row.closed_seconds) : 0;
}

const DEFAULT_HISTORY_LIMIT = 200;

function mapHistoryEntry(row: RawHistoryRow): WorkSessionHistoryEntry | null {
  if (!isWorkSessionActivityType(row.activity_type)) return null;
  const startedAtMs = Number(row.started_at) * 1_000;
  const endedAtMs = row.ended_at === null ? null : Number(row.ended_at) * 1_000;
  const source = isWorkSessionSource(row.source) ? row.source : "WEB_TIMER";
  return {
    id: Number(row.id),
    videoId: Number(row.video_id),
    videoTitle: row.video_title,
    clientName: row.client_name,
    projectName: row.project_name,
    activityType: row.activity_type,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: endedAtMs === null ? null : new Date(endedAtMs).toISOString(),
    durationSeconds:
      endedAtMs === null ? null : Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1_000)),
    status: endedAtMs === null ? "OPEN" : "CLOSED",
    note: row.note,
    source,
    updatedAt:
      row.updated_at === null ? null : new Date(Number(row.updated_at) * 1_000).toISOString(),
    sensorSessionId: row.sensor_session_id === null ? null : Number(row.sensor_session_id),
  };
}

// Read-only, additive, dogfooding-week only (Sprint 1.2.1). Does not mutate
// anything and is not on the hot path of Start/Stop. videoId is an optional
// filter (local consolidation round) so a single video own session history
// can be viewed without inventing a second history surface; the 200-row
// cap then applies only within that video own sessions, not the whole ledger.
export async function getWorkSessionHistory(
  limit: number = DEFAULT_HISTORY_LIMIT,
  videoId: number | null = null,
): Promise<WorkSessionHistoryEntry[]> {
  const db = await getAuthenticatedDb();
  const result = await db.$client
    .prepare(WORK_SESSION_HISTORY_SQL)
    .bind(limit, videoId)
    .all<RawHistoryRow>();
  return result.results
    .map(mapHistoryEntry)
    .filter((entry): entry is WorkSessionHistoryEntry => entry !== null);
}

// Sprint 1.2.1 Ledger P1: one video option list for the correction UI's
// video-reassignment dropdown. Deliberately not filtered by Geladeira
// archival state or Project status — correcting which video a piece of
// already-performed work belongs to is fixing history, not selecting a
// destination for new work, so an archived client's videos must remain
// reachable here even though they are hidden from the Quick Actions
// selectors (see modules/productivity/actions.ts). Ordered by recency;
// capped at 300 — a documented scope limit, not silent truncation: a video
// created before the 300 most recent won't appear and would need a direct
// database fix, which is an acceptable P1 limitation for a correction path
// used to fix mistakes, not to browse the whole catalog.
const CORRECTION_VIDEO_OPTIONS_LIMIT = 300;

export type WorkSessionVideoOption = {
  id: number;
  title: string;
  clientName: string | null;
  projectName: string | null;
};

export async function getVideoOptionsForCorrection(): Promise<
  WorkSessionVideoOption[]
> {
  const db = await getAuthenticatedDb();
  const result = await db.$client
    .prepare(
      `SELECT
         v.id,
         COALESCE(v.title, 'Video ' || v.date) AS title,
         c.name AS client_name,
         p.name AS project_name
       FROM video_logs v
       LEFT JOIN projects p ON p.id = v.project_id
       LEFT JOIN clients c ON c.id = v.client_id
       ORDER BY v.created_at DESC, v.id DESC
       LIMIT ?1`,
    )
    .bind(CORRECTION_VIDEO_OPTIONS_LIMIT)
    .all<{ id: number; title: string; client_name: string | null; project_name: string | null }>();
  return result.results.map((row) => ({
    id: Number(row.id),
    title: row.title,
    clientName: row.client_name,
    projectName: row.project_name,
  }));
}

export async function getWorkSessionById(sessionId: number): Promise<{
  before: SessionCorrectionBefore;
  clientId: number | null;
} | null> {
  const db = await getAuthenticatedDb();
  const row = await db.$client
    .prepare(WORK_SESSION_BY_ID_SQL)
    .bind(sessionId)
    .first<RawSessionByIdRow>();
  if (!row || !isWorkSessionActivityType(row.activity_type)) return null;
  return {
    before: {
      videoId: Number(row.video_id),
      videoTitle: row.video_title,
      startedAt: new Date(Number(row.started_at) * 1_000).toISOString(),
      endedAt:
        row.ended_at === null ? null : new Date(Number(row.ended_at) * 1_000).toISOString(),
      activityType: row.activity_type,
      note: row.note,
    },
    clientId: row.client_id === null ? null : Number(row.client_id),
  };
}

// Session Narrative (Sunday Systems Round, Phase B/C/D): correlates each
// session in a page of Work Session history with the Video Memory notes
// captured on the same video while it was open. Computed here (a plain
// async data fetch, not a component render) rather than in the page
// component, for the same react-hooks/purity reason getWorkSessionOverview
// reads "now" in the data layer above: an open session's correlation
// window needs the request's own clock reading exactly once. Returns only
// sessions that actually have correlated notes -- most sessions will have
// none, and the caller (the Session Ledger page) treats an absent key the
// same as an empty list.
export async function getSessionNarratives(
  sessions: readonly WorkSessionHistoryEntry[],
): Promise<Record<number, CorrelatedMemoryNote[]>> {
  const videoIds = [...new Set(sessions.map((session) => session.videoId))];
  const notes = await getVideoOperationalMemoryForVideos(videoIds);
  const nowIso = new Date().toISOString();

  const result: Record<number, CorrelatedMemoryNote[]> = {};
  for (const session of sessions) {
    const correlated = correlateSessionMemoryNotes(session, notes, nowIso);
    if (correlated.length > 0) {
      result[session.id] = correlated;
    }
  }
  return result;
}

// ─── NIGHT SHIFT REALITY PATCH §5/§6/§9 ────────────────────────────────────

type RawAttributionRow = {
  started_at: number;
  ended_at: number;
  project_id: number | null;
  project_name: string | null;
  client_id: number | null;
  client_name: string | null;
};

const ATTRIBUTION_LOOKBACK_DAYS = 35;

async function fetchAttributionRows(): Promise<WorkSessionAttributionRow[]> {
  const db = await getAuthenticatedDb();
  const cutoff = toUnixSeconds(
    new Date(Date.now() - ATTRIBUTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1_000),
  );
  const result = await db.$client
    .prepare(WORK_SESSION_ATTRIBUTION_SQL)
    .bind(cutoff)
    .all<RawAttributionRow>();
  return result.results.map((row) => ({
    projectId: row.project_id === null ? null : Number(row.project_id),
    projectName: row.project_name,
    clientId: row.client_id === null ? null : Number(row.client_id),
    clientName: row.client_name,
    startedAt: new Date(Number(row.started_at) * 1_000).toISOString(),
    durationSeconds: Math.max(0, Number(row.ended_at) - Number(row.started_at)),
  }));
}

// §5: top-N project streaks for Home "Momentum". Derived entirely from
// canonical Work Session history within a 35-day lookback -- no persisted
// streak counter, so it can never drift from the real ledger.
export async function getProjectStreaks(limit = 3): Promise<ProjectStreak[]> {
  const rows = await fetchAttributionRows();
  const todayKey = dayKeyFor(new Date().toISOString());
  return sortProjectStreaks(computeProjectStreaks(rows, todayKey)).slice(0, limit);
}

// §6/§9: today's attributable work -- total duration, session count, and
// per-client seconds (the latter feeds Finance's rate-equivalent). "Today"
// is resolved the same way everywhere in this patch: dayKeyFor on each
// session's own started_at, in America/Sao_Paulo, never SQLite's UTC date().
// An open session's live elapsed time is folded in only when that session
// itself started today -- so the Home "Today" total reflects what's
// actually happening right now, not just closed history.
export async function getTodayWorkSessionStats(): Promise<TodayWorkSessionStats> {
  const [rows, overview] = await Promise.all([
    fetchAttributionRows(),
    getWorkSessionOverview(),
  ]);
  const todayKey = dayKeyFor(new Date().toISOString());
  const stats = computeTodayWorkSessionStats(rows, todayKey);

  if (overview.openSession && dayKeyFor(overview.openSession.startedAt) === todayKey) {
    stats.totalSeconds += overview.openSessionElapsedSeconds;
    stats.sessionCount += 1;
  }
  return stats;
}


// ─── MICRO PATCH §2: Last Active (Projects / CRM) ──────────────────────────
// Deliberately NOT reusing fetchAttributionRows()/ATTRIBUTION_LOOKBACK_DAYS
// above -- that 35-day window is correct for streaks (a stale streak
// *should* disappear) but wrong here: a project genuinely last touched 40
// days ago must still report its real last-active date, not look
// indistinguishable from "never worked." These are separate, unbounded,
// one-shot MAX(started_at) GROUP BY queries -- no N+1, one call each,
// batched into the existing overview fetches via Promise.all.

const LAST_ACTIVE_BY_PROJECT_SQL = `
  SELECT v.project_id AS group_id, MAX(ws.started_at) AS last_active_at
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  WHERE ws.ended_at IS NOT NULL AND v.project_id IS NOT NULL
  GROUP BY v.project_id
`;

const LAST_ACTIVE_BY_CLIENT_SQL = `
  SELECT v.client_id AS group_id, MAX(ws.started_at) AS last_active_at
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  WHERE ws.ended_at IS NOT NULL AND v.client_id IS NOT NULL
  GROUP BY v.client_id
`;

type RawLastActiveRow = { group_id: number; last_active_at: number };

async function fetchLastActiveMap(sql: string): Promise<Map<number, string>> {
  const db = await getAuthenticatedDb();
  const result = await db.$client.prepare(sql).all<RawLastActiveRow>();
  const map = new Map<number, string>();
  for (const row of result.results) {
    map.set(Number(row.group_id), new Date(Number(row.last_active_at) * 1_000).toISOString());
  }
  return map;
}

// Keyed by project_id -- one row per project that has at least one closed,
// attributed Work Session, ever (not lookback-bounded).
export async function getLastActiveByProject(): Promise<Map<number, string>> {
  return fetchLastActiveMap(LAST_ACTIVE_BY_PROJECT_SQL);
}

// Keyed by client_id, same semantics.
export async function getLastActiveByClient(): Promise<Map<number, string>> {
  return fetchLastActiveMap(LAST_ACTIVE_BY_CLIENT_SQL);
}
