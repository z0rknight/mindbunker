import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  OPEN_WORK_SESSION_SQL,
  VIDEO_WORK_SESSION_SUMMARY_SQL,
  WORK_SESSION_OVERVIEW_SQL,
  isWorkSessionActivityType,
  isWorkSessionVideoId,
  type OpenWorkSession,
  type VideoWorkSessionState,
  type VideoWorkSessionSummary,
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

  return {
    summaries: summaryResult.results.map(mapSummary),
    openSession,
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
