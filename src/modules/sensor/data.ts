import "server-only";

import { getAuthenticatedDb } from "@/db";
import { sensorDevices } from "@/db/schema";
import { desc } from "drizzle-orm";
import { todayISO } from "@/utils/date";
import {
  LONG_SESSION_THRESHOLD_SECONDS,
  OPEN_SENSOR_SESSION_SQL,
  computeTodaySensorOperationalStats,
  isSensorContextType,
  selectLongSessionCandidates,
  type LongSessionCandidate,
  type LongSessionSourceRow,
  type LongSessionStagingRow,
  type LongSessionNonClientRow,
  type OpenSensorSession,
  type SensorOperationalRow,
  type TodaySensorOperationalStats,
} from "./core";
import { dayKeyFor, isWorkSessionActivityType } from "../work-sessions/core";
import {
  aggregateIntentionalAppTime,
  aggregateObservedAppTime,
  classifyWindowSurface,
  computeCoverageSeconds,
  computeSessionCoverage,
  dailyAverageSeconds,
  normalizeApplication,
  resolveTimeWindow,
  type AppIntentionalTotal,
  type AppObservationRow,
  type AppTimeTotal,
  type IntentionalIntervalRow,
  type SessionCoverage,
  type TimeWindowKind,
} from "./app-intelligence";

type TotalsRow = {
  screen_seconds: number;
  active_seconds: number;
  idle_seconds: number;
  keystroke_count: number | null;
  mouse_movement_count: number | null;
  keystroke_observation_count: number;
  mouse_observation_count: number;
};

export type SensorAppRow = {
  app_name: string;
  active_seconds: number;
  idle_seconds: number;
};

export type SensorSessionListRow = {
  id: number;
  video_id: number | null;
  video_title: string | null;
  client_name: string | null;
  project_name: string | null;
  context_type: string;
  context_label: string | null;
  activity_type: string;
  started_at: number;
  ended_at: number | null;
  source: string;
  approval_state: "PENDING" | "APPROVED" | "ARCHIVED" | "DELETED";
  approved_work_session_id: number | null;
};

type CountRow = { count: number };

type RawOpenSensorSessionRow = {
  id: number;
  video_id: number | null;
  video_title: string | null;
  client_id: number | null;
  client_name: string | null;
  project_name: string | null;
  context_type: string;
  context_label: string | null;
  activity_type: string;
  started_at: number;
  device_name: string | null;
};

function mapOpenSensorSession(row: RawOpenSensorSessionRow | null): OpenSensorSession | null {
  if (!row || !isWorkSessionActivityType(row.activity_type) || !isSensorContextType(row.context_type)) return null;
  return {
    id: Number(row.id),
    videoId: row.video_id === null ? null : Number(row.video_id),
    videoTitle: row.video_title,
    clientId: row.client_id === null ? null : Number(row.client_id),
    clientName: row.client_name,
    projectName: row.project_name,
    contextType: row.context_type,
    contextLabel: row.context_label,
    activityType: row.activity_type,
    startedAt: new Date(Number(row.started_at) * 1_000).toISOString(),
    deviceName: row.device_name,
  };
}

// Sensor Reality Sync §3: reads the SAME staging fact War Room needs to
// show SENSOR RECORDING -- an open (unstopped) sensor_sessions row --
// before any operator approval exists. Deliberately as cheap and
// standalone as getWorkSessionOverview's own readOpenSession: one
// indexed query, safe to add to War Room's existing Promise.all.
// Elapsed seconds are computed here, at fetch time, in the data layer --
// not in the War Room page component -- for the exact same reason
// getWorkSessionOverview computes openSessionElapsedSeconds here rather
// than in its caller: React forbids calling the impure Date.now() during
// a component's render, and this is a plain async data fetch, not a
// render, so "now" is read exactly once per request.
export async function getOpenSensorSessionOverview(): Promise<{
  openSensorSession: OpenSensorSession | null;
  openSensorSessionElapsedSeconds: number;
}> {
  const db = await getAuthenticatedDb();
  const row = await db.$client
    .prepare(OPEN_SENSOR_SESSION_SQL)
    .first<RawOpenSensorSessionRow>();
  const openSensorSession = mapOpenSensorSession(row);
  const openSensorSessionElapsedSeconds = openSensorSession
    ? Math.max(0, Math.floor((Date.now() - Date.parse(openSensorSession.startedAt)) / 1_000))
    : 0;
  return { openSensorSession, openSensorSessionElapsedSeconds };
}

type RawSensorOperationalRow = {
  context_type: string;
  started_at: number;
  ended_at: number | null;
};

// Sensor Operational Ledger Patch §10/§11: the server-side counterpart of
// getTodayWorkSessionStats' own open-session handling, but for durable
// non-CLIENT operational history instead of canonical Work Sessions.
// CLIENT is explicitly excluded from the SQL itself (not just from the
// pure aggregator) -- a CLIENT Sensor session's time is only ever counted
// once it becomes a real work_sessions row via approval, already read by
// getTodayWorkSessionStats; nothing here can double it. A 2-day lookback
// (mirroring the safety margin, not the 35-day streak window
// fetchAttributionRows uses) is enough to cover any session whose
// started_at lands in "today" under America/Sao_Paulo but "yesterday" in
// UTC storage, without scanning the whole table.
export async function getTodaySensorOperationalStats(): Promise<TodaySensorOperationalStats> {
  const db = await getAuthenticatedDb();
  const cutoff = Math.floor(Date.now() / 1_000) - 2 * 86_400;
  const [closed, open] = await Promise.all([
    db.$client
      .prepare(`
        SELECT context_type, started_at, ended_at
        FROM sensor_sessions
        WHERE context_type IN ('LEAD', 'INTERNAL', 'ADMIN')
          AND ended_at IS NOT NULL
          AND started_at >= ?1
      `)
      .bind(cutoff)
      .all<RawSensorOperationalRow>(),
    db.$client
      .prepare(`
        SELECT context_type, started_at, ended_at
        FROM sensor_sessions
        WHERE context_type IN ('LEAD', 'INTERNAL', 'ADMIN')
          AND ended_at IS NULL
        ORDER BY id DESC
        LIMIT 1
      `)
      .all<RawSensorOperationalRow>(),
  ]);
  const rows: SensorOperationalRow[] = [...closed.results, ...open.results]
    .filter((row): row is RawSensorOperationalRow & { context_type: "LEAD" | "INTERNAL" | "ADMIN" } =>
      isSensorContextType(row.context_type) && row.context_type !== "CLIENT")
    .map((row) => ({
      contextType: row.context_type,
      startedAt: new Date(Number(row.started_at) * 1_000).toISOString(),
      endedAt: row.ended_at === null ? null : new Date(Number(row.ended_at) * 1_000).toISOString(),
    }));
  const todayKey = dayKeyFor(new Date().toISOString());
  return computeTodaySensorOperationalStats(rows, todayKey, Math.floor(Date.now() / 1_000));
}

type RawObservationRow = {
  app_name: string;
  bundle_id: string | null;
  window_title: string | null;
  started_at: number;
  ended_at: number;
  idle: number;
};

type RawIntentionalIntervalRow = {
  context_type: "CLIENT" | "LEAD" | "INTERNAL" | "ADMIN";
  started_at: number;
  ended_at: number;
};

export type ApplicationUsage = {
  window: { label: string; startSeconds: number; endSeconds: number; days: number };
  observed: AppTimeTotal[];
  intentional: AppIntentionalTotal[];
  coverageSeconds: number;
  dailyAverageSeconds: number; // observed, matching the top-level total the UI leads with
  // How much intentional session time the telemetry can speak to (never
  // normalised to 100%): see computeSessionCoverage.
  sessionCoverage: SessionCoverage;
  // Whether window titles are captured at all -- without them a browser
  // "web surface" (e.g. a site inside Safari) cannot be attributed.
  surfaceTelemetry: { activeObservations: number; withWindowTitle: number };
};

// App/Window Telemetry Intelligence (addendum §6-§22): reuses the exact
// raw evidence already captured and synced -- device_activity_observations
// for OBSERVED time, sensor_sessions (all four contexts, any
// approval_state) for INTENTIONAL overlap. No new telemetry stream, no
// new table, no native Sensor change. Bounded by the resolved window at
// the SQL layer (cheap at current row volume -- see Section 30), then
// normalized/aggregated in pure functions so the actual math is fully
// unit-tested and independent of D1.
export async function getApplicationUsage(
  windowKind: TimeWindowKind,
  monthKey?: string,
): Promise<ApplicationUsage> {
  const db = await getAuthenticatedDb();
  const window = resolveTimeWindow(windowKind, new Date().toISOString(), monthKey);
  const [observationRows, sessionRows] = await Promise.all([
    db.$client
      .prepare(`
        SELECT app_name, bundle_id, window_title, started_at, ended_at, idle
        FROM device_activity_observations
        WHERE started_at < ?2 AND ended_at > ?1
      `)
      .bind(window.startSeconds, window.endSeconds)
      .all<RawObservationRow>(),
    db.$client
      .prepare(`
        SELECT context_type, started_at, COALESCE(ended_at, ?3) AS ended_at
        FROM sensor_sessions
        WHERE started_at < ?2 AND COALESCE(ended_at, ?3) > ?1
          AND approval_state != 'DELETED'
      `)
      .bind(window.startSeconds, window.endSeconds, Math.floor(Date.now() / 1_000))
      .all<RawIntentionalIntervalRow>(),
  ]);

  const observations: AppObservationRow[] = observationRows.results.map((row) => {
    const appKey = normalizeApplication(row.bundle_id, row.app_name);
    return {
      appKey,
      surface: classifyWindowSurface(appKey, row.window_title),
      startedAt: Number(row.started_at),
      endedAt: Number(row.ended_at),
      idle: Boolean(row.idle),
    };
  });
  const sessions: IntentionalIntervalRow[] = sessionRows.results.map((row) => ({
    contextType: row.context_type,
    startedAt: Number(row.started_at),
    endedAt: Number(row.ended_at),
  }));

  const observed = aggregateObservedAppTime(observations, window.startSeconds, window.endSeconds);
  const intentional = aggregateIntentionalAppTime(observations, sessions, window.startSeconds, window.endSeconds);
  const coverageSeconds = computeCoverageSeconds(
    observations.map((row) => ({ startedAt: row.startedAt, endedAt: row.endedAt })),
    window.startSeconds,
    window.endSeconds,
  );
  const totalObservedSeconds = observed.reduce((sum, row) => sum + row.seconds, 0);
  const sessionCoverage = computeSessionCoverage(observations, sessions, window.startSeconds, window.endSeconds);
  const activeRows = observationRows.results.filter((row) => !row.idle);
  const surfaceTelemetry = {
    activeObservations: activeRows.length,
    withWindowTitle: activeRows.filter((row) => typeof row.window_title === "string" && row.window_title.trim() !== "").length,
  };

  return {
    window: { label: window.label, startSeconds: window.startSeconds, endSeconds: window.endSeconds, days: window.days },
    observed,
    intentional,
    coverageSeconds,
    dailyAverageSeconds: dailyAverageSeconds(totalObservedSeconds, window.days),
    sessionCoverage,
    surfaceTelemetry,
  };
}

const SENSOR_SESSION_LIST_SQL = `
  SELECT ss.id, ss.video_id, COALESCE(v.title, 'Video ' || v.date) AS video_title,
    c.name AS client_name, p.name AS project_name,
    ss.context_type, ss.context_label, ss.activity_type,
    ss.started_at, ss.ended_at, ss.source, ss.approval_state,
    ss.approved_work_session_id
  FROM sensor_sessions ss
  LEFT JOIN video_logs v ON v.id = ss.video_id
  LEFT JOIN projects p ON p.id = v.project_id
  LEFT JOIN clients c ON c.id = v.client_id
`;

export async function getSensorDashboard() {
  const db = await getAuthenticatedDb();
  const start = Math.floor(Date.parse(`${todayISO()}T03:00:00Z`) / 1_000);
  const end = start + 86_400;
  const [devices, totals, apps, inbox, approvedHistory, archivedHistory, observationCount, pendingCount, approvedCount, archivedCount] = await Promise.all([
    db.select().from(sensorDevices).orderBy(desc(sensorDevices.createdAt)),
    db.$client
      .prepare(`
        SELECT
          COALESCE(SUM(MIN(ended_at, ?2) - MAX(started_at, ?1)), 0) AS screen_seconds,
          COALESCE(SUM(CASE WHEN idle = 0 THEN MIN(ended_at, ?2) - MAX(started_at, ?1) ELSE 0 END), 0) AS active_seconds,
          COALESCE(SUM(CASE WHEN idle = 1 THEN MIN(ended_at, ?2) - MAX(started_at, ?1) ELSE 0 END), 0) AS idle_seconds,
          SUM(CASE WHEN started_at >= ?1 AND started_at < ?2 THEN keystroke_count END) AS keystroke_count,
          SUM(CASE WHEN started_at >= ?1 AND started_at < ?2 THEN mouse_movement_count END) AS mouse_movement_count,
          COUNT(CASE WHEN started_at >= ?1 AND started_at < ?2 THEN keystroke_count END) AS keystroke_observation_count,
          COUNT(CASE WHEN started_at >= ?1 AND started_at < ?2 THEN mouse_movement_count END) AS mouse_observation_count
        FROM device_activity_observations
        WHERE started_at < ?2 AND ended_at > ?1
      `)
      .bind(start, end)
      .first<TotalsRow>(),
    db.$client
      .prepare(`
        SELECT app_name,
          SUM(CASE WHEN idle = 0 THEN MIN(ended_at, ?2) - MAX(started_at, ?1) ELSE 0 END) AS active_seconds,
          SUM(CASE WHEN idle = 1 THEN MIN(ended_at, ?2) - MAX(started_at, ?1) ELSE 0 END) AS idle_seconds
        FROM device_activity_observations
        WHERE started_at < ?2 AND ended_at > ?1
        GROUP BY app_name ORDER BY active_seconds DESC LIMIT 20
      `)
      .bind(start, end)
      .all<SensorAppRow>(),
    db.$client
      .prepare(`${SENSOR_SESSION_LIST_SQL}
        WHERE ss.approval_state = 'PENDING' AND ss.ended_at IS NOT NULL
        ORDER BY ss.started_at DESC LIMIT 100`)
      .all<SensorSessionListRow>(),
    db.$client
      .prepare(`${SENSOR_SESSION_LIST_SQL}
        WHERE ss.approval_state = 'APPROVED'
        ORDER BY ss.started_at DESC LIMIT 30`)
      .all<SensorSessionListRow>(),
    db.$client
      .prepare(`${SENSOR_SESSION_LIST_SQL}
        WHERE ss.approval_state = 'ARCHIVED'
        ORDER BY ss.started_at DESC LIMIT 30`)
      .all<SensorSessionListRow>(),
    db.$client.prepare("SELECT COUNT(*) AS count FROM device_activity_observations").first<CountRow>(),
    db.$client.prepare("SELECT COUNT(*) AS count FROM sensor_sessions WHERE approval_state = 'PENDING' AND ended_at IS NOT NULL").first<CountRow>(),
    db.$client.prepare("SELECT COUNT(*) AS count FROM sensor_sessions WHERE approval_state = 'APPROVED'").first<CountRow>(),
    db.$client.prepare("SELECT COUNT(*) AS count FROM sensor_sessions WHERE approval_state = 'ARCHIVED'").first<CountRow>(),
  ]);
  return {
    devices,
    totals: totals ?? {
      screen_seconds: 0,
      active_seconds: 0,
      idle_seconds: 0,
      keystroke_count: null,
      mouse_movement_count: null,
      keystroke_observation_count: 0,
      mouse_observation_count: 0,
    },
    apps: apps.results,
    inbox: inbox.results,
    approvedHistory: approvedHistory.results,
    archivedHistory: archivedHistory.results,
    diagnostics: {
      uploadedObservations: Number(observationCount?.count ?? 0),
      pendingReview: Number(pendingCount?.count ?? 0),
      approvedSessions: Number(approvedCount?.count ?? 0),
      archivedSessions: Number(archivedCount?.count ?? 0),
      lastSuccessfulUpload: devices.reduce<Date | null>((latest, device) => {
        if (!device.lastSeenAt) return latest;
        return latest === null || device.lastSeenAt > latest ? device.lastSeenAt : latest;
      }, null),
    },
  };
}

type SensorSessionDetailRow = SensorSessionListRow & {
  sensor_device_id: number;
  note: string | null;
  approved_at: number | null;
  archived_at: number | null;
  deleted_at: number | null;
};

type InputSignalsRow = {
  keystroke_count: number | null;
  mouse_movement_count: number | null;
  idle_seconds: number;
  observation_count: number;
};

export async function getSensorSessionDetail(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = await getAuthenticatedDb();
  const session = await db.$client
    .prepare(`
      SELECT ss.id, ss.video_id,
        COALESCE(v.title, 'Video ' || v.date) AS video_title,
        c.name AS client_name, p.name AS project_name,
        ss.context_type, ss.context_label, ss.activity_type,
        ss.started_at, ss.ended_at, ss.source, ss.approval_state,
        ss.approved_work_session_id, ss.sensor_device_id, ss.note,
        ss.approved_at, ss.archived_at, ss.deleted_at
      FROM sensor_sessions ss
      LEFT JOIN video_logs v ON v.id = ss.video_id
      LEFT JOIN projects p ON p.id = v.project_id
      LEFT JOIN clients c ON c.id = v.client_id
      WHERE ss.id = ?1
    `)
    .bind(id)
    .first<SensorSessionDetailRow>();
  if (!session) return null;
  const effectiveEnd = session.ended_at ?? Math.floor(Date.now() / 1_000);
  const [apps, signals] = await Promise.all([
    db.$client
      .prepare(`
        SELECT o.app_name,
          SUM(MIN(o.ended_at, ?3) - MAX(o.started_at, ?2)) AS active_seconds,
          0 AS idle_seconds
        FROM device_activity_observations o
        WHERE o.sensor_device_id = ?1
          AND o.idle = 0
          AND o.started_at < ?3
          AND o.ended_at > ?2
        GROUP BY o.app_name
        ORDER BY active_seconds DESC, o.app_name
      `)
      .bind(session.sensor_device_id, session.started_at, effectiveEnd)
      .all<SensorAppRow>(),
    db.$client
      .prepare(`
        SELECT
          CASE WHEN COUNT(o.keystroke_count) = 0 THEN NULL ELSE SUM(o.keystroke_count) END AS keystroke_count,
          CASE WHEN COUNT(o.mouse_movement_count) = 0 THEN NULL ELSE SUM(o.mouse_movement_count) END AS mouse_movement_count,
          COALESCE(SUM(CASE WHEN o.idle = 1 THEN MIN(o.ended_at, ?3) - MAX(o.started_at, ?2) ELSE 0 END), 0) AS idle_seconds,
          COUNT(*) AS observation_count
        FROM device_activity_observations o
        WHERE o.sensor_device_id = ?1
          AND o.started_at < ?3
          AND o.ended_at > ?2
      `)
      .bind(session.sensor_device_id, session.started_at, effectiveEnd)
      .first<InputSignalsRow>(),
  ]);
  return {
    now: effectiveEnd,
    session,
    apps: apps.results,
    signals: signals ?? {
      keystroke_count: null,
      mouse_movement_count: null,
      idle_seconds: 0,
      observation_count: 0,
    },
  };
}

type RawLongStagingRow = {
  id: number;
  video_id: number;
  video_title: string;
  started_at: number;
  ended_at: number | null;
  approval_state: "PENDING" | "APPROVED" | "ARCHIVED" | "DELETED";
};

type RawLongCanonicalRow = {
  id: number;
  video_id: number;
  video_title: string;
  started_at: number;
  ended_at: number | null;
};

// Sensor Reality Sync §10/§17: filters to candidates in SQL (bounded,
// indexed on started_at) rather than pulling every historical session
// into JS to filter -- the pure decision (what counts as "long", how to
// combine/sort the two sources) still lives entirely in
// selectLongSessionCandidates.
type RawLongNonClientRow = {
  id: number;
  context_type: "LEAD" | "INTERNAL" | "ADMIN";
  context_label: string | null;
  started_at: number;
  ended_at: number | null;
};

export async function getLongSessionCandidates(
  thresholdSeconds: number = LONG_SESSION_THRESHOLD_SECONDS,
): Promise<LongSessionCandidate[]> {
  const db = await getAuthenticatedDb();
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const [staging, canonical, nonClient] = await Promise.all([
    db.$client
      .prepare(`
        SELECT ss.id, ss.video_id, COALESCE(v.title, 'Video ' || v.date) AS video_title,
          ss.started_at, ss.ended_at, ss.approval_state
        FROM sensor_sessions ss
        INNER JOIN video_logs v ON v.id = ss.video_id
        WHERE ss.approval_state != 'DELETED'
          AND (COALESCE(ss.ended_at, ?1) - ss.started_at) > ?2
        ORDER BY ss.started_at DESC
        LIMIT 50
      `)
      .bind(nowSeconds, thresholdSeconds)
      .all<RawLongStagingRow>(),
    db.$client
      .prepare(`
        SELECT ws.id, ws.video_id, COALESCE(v.title, 'Video ' || v.date) AS video_title,
          ws.started_at, ws.ended_at
        FROM work_sessions ws
        INNER JOIN video_logs v ON v.id = ws.video_id
        WHERE (COALESCE(ws.ended_at, ?1) - ws.started_at) > ?2
        ORDER BY ws.started_at DESC
        LIMIT 50
      `)
      .bind(nowSeconds, thresholdSeconds)
      .all<RawLongCanonicalRow>(),
    // Sep 18 Morning Congruence Patch: a non-CLIENT sensor_sessions row can
    // never have a video_id (sensor_sessions_context_video_check), so it
    // can never appear in the staging query above -- this is the separate
    // source that actually surfaces it. Never DELETED; PENDING is excluded
    // on purpose (a non-CLIENT session is finalized straight to ARCHIVED by
    // the Stop write itself, so a still-PENDING one is either mid-session
    // or a data anomaly worth investigating directly, not a "long session"
    // to flag here).
    db.$client
      .prepare(`
        SELECT ss.id, ss.context_type, ss.context_label, ss.started_at, ss.ended_at
        FROM sensor_sessions ss
        WHERE ss.context_type != 'CLIENT'
          AND ss.approval_state = 'ARCHIVED'
          AND (COALESCE(ss.ended_at, ?1) - ss.started_at) > ?2
        ORDER BY ss.started_at DESC
        LIMIT 50
      `)
      .bind(nowSeconds, thresholdSeconds)
      .all<RawLongNonClientRow>(),
  ]);

  const stagingRows: LongSessionStagingRow[] = staging.results.map((row) => ({
    id: Number(row.id),
    videoId: Number(row.video_id),
    videoTitle: row.video_title,
    startedAt: Number(row.started_at),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
    approvalState: row.approval_state,
  }));
  const canonicalRows: LongSessionSourceRow[] = canonical.results.map((row) => ({
    id: Number(row.id),
    videoId: Number(row.video_id),
    videoTitle: row.video_title,
    startedAt: Number(row.started_at),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
  }));
  const nonClientRows: LongSessionNonClientRow[] = nonClient.results.map((row) => ({
    id: Number(row.id),
    contextType: row.context_type,
    contextLabel: row.context_label,
    startedAt: Number(row.started_at),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
  }));

  return selectLongSessionCandidates(stagingRows, canonicalRows, new Date(), thresholdSeconds, nonClientRows);
}
