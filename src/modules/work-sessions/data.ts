import "server-only";

import { getAuthenticatedDb } from "@/db";
import { getVideoOperationalMemoryForVideos } from "@/modules/video-memory/actions";
import {
  OPEN_WORK_SESSION_SQL,
  VIDEO_WORK_SESSION_SUMMARY_SQL,
  WORK_SESSION_BY_ID_SQL,
  WORK_SESSION_HISTORY_SQL,
  WORK_SESSION_OVERVIEW_SQL,
  correlateSessionMemoryNotes,
  isSessionStale,
  isWorkSessionActivityType,
  isWorkSessionSource,
  isWorkSessionVideoId,
  type CorrelatedMemoryNote,
  type OpenWorkSession,
  type SessionCorrectionBefore,
  type VideoWorkSessionState,
  type VideoWorkSessionSummary,
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
  activity_type: string;
  started_at: number;
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
    activityType: row.activity_type,
    startedAt: new Date(Number(row.started_at) * 1_000).toISOString(),
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
