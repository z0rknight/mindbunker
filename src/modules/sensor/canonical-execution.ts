import "server-only";

import { canonicalClientId, isInternalClientName } from "@/lib/client-identity";
import type { WorkSessionActivityType } from "@/modules/work-sessions/core";
import {
  RMEDIA_CANONICAL_END_EVENT_SQL,
  RMEDIA_CANONICAL_END_SQL,
  RMEDIA_CANONICAL_START_EVENT_SQL,
  RMEDIA_CANONICAL_START_SQL,
} from "./core";

type ExecutionRow = {
  work_session_id: number;
  video_id: number;
  video_title: string;
  project_id: number | null;
  project_name: string | null;
  client_id: number | null;
  client_name: string | null;
  video_kind: string;
  activity_type: string;
  started_at: number;
};

export type CanonicalExecutionProjection = {
  work_session_id: number;
  video_id: number;
  video_title: string;
  project_id: number | null;
  project_name: string | null;
  client_id: number | null;
  client_name: string | null;
  work_class: "CLIENT" | "INTERNAL" | null;
  activity_type: string;
  started_at: string;
};

const EXECUTION_SELECT = `
  SELECT ws.id AS work_session_id, ws.video_id, COALESCE(v.title, 'Video ' || v.date) AS video_title,
    v.project_id, p.name AS project_name, v.client_id, c.name AS client_name,
    v.video_kind, ws.activity_type, ws.started_at
  FROM work_sessions ws
  JOIN video_logs v ON v.id = ws.video_id
  LEFT JOIN projects p ON p.id = v.project_id
  LEFT JOIN clients c ON c.id = v.client_id
`;

async function projectExecution(client: D1Database, row: ExecutionRow | null) {
  if (!row) return null;
  const resolvedClientId = row.client_id === null ? null : canonicalClientId(Number(row.client_id));
  let resolvedClientName = row.client_name;
  if (resolvedClientId !== null && resolvedClientId !== Number(row.client_id)) {
    const canonical = await client.prepare("SELECT name FROM clients WHERE id = ?1").bind(resolvedClientId).first<{ name: string }>();
    resolvedClientName = canonical?.name ?? null;
  }
  return {
    work_session_id: Number(row.work_session_id),
    video_id: Number(row.video_id),
    video_title: row.video_title,
    project_id: row.project_id === null ? null : Number(row.project_id),
    project_name: row.project_name,
    client_id: resolvedClientId,
    client_name: resolvedClientName,
    work_class: row.video_kind === "INTERNAL" || isInternalClientName(row.client_name)
      ? "INTERNAL" as const
      : row.client_id === null ? null : "CLIENT" as const,
    activity_type: row.activity_type,
    started_at: new Date(Number(row.started_at) * 1_000).toISOString(),
  } satisfies CanonicalExecutionProjection;
}

export async function readCanonicalExecution(client: D1Database) {
  const row = await client.prepare(`${EXECUTION_SELECT} WHERE ws.ended_at IS NULL LIMIT 1`).first<ExecutionRow>();
  return projectExecution(client, row);
}

type StartTargetRow = {
  id: number;
  title: string | null;
  date: string;
  status: string;
  video_kind: string;
  cancelled_at: number | null;
  client_id: number | null;
  client_name: string | null;
  client_status: string | null;
  archival_state: string | null;
  project_id: number | null;
  project_client_id: number | null;
  project_status: string | null;
};

export async function startCanonicalExecution(
  client: D1Database,
  deviceId: number,
  videoId: number,
  activityType: WorkSessionActivityType,
  nowSeconds = Math.floor(Date.now() / 1_000),
): Promise<{ session: CanonicalExecutionProjection; idempotent: boolean }> {
  const target = await client.prepare(`
    SELECT v.id, v.title, v.date, v.status, v.video_kind, v.cancelled_at,
      v.client_id, c.name AS client_name, c.status AS client_status,
      c.archival_state, v.project_id, p.client_id AS project_client_id,
      p.status AS project_status
    FROM video_logs v
    LEFT JOIN projects p ON p.id = v.project_id
    LEFT JOIN clients c ON c.id = v.client_id
    WHERE v.id = ?1
  `).bind(videoId).first<StartTargetRow>();
  if (!target) throw new CanonicalExecutionError(404, "Video not found.");
  if (target.cancelled_at !== null) throw new CanonicalExecutionError(409, "Cancelled work cannot be started.");
  if (target.status === "DONE") throw new CanonicalExecutionError(409, "Finished work cannot be started again without reopening the Video.");
  const hasClient = target.client_id !== null;
  const hasProject = target.project_id !== null;
  if (hasClient !== hasProject) throw new CanonicalExecutionError(409, "This Video has an incomplete Client / Project assignment.");
  if (target.video_kind === "CLIENT_WORK" && (!hasClient || !hasProject)) {
    throw new CanonicalExecutionError(409, "Client work must reference both a Client and a Project before Start Work.");
  }
  if (target.project_id !== null && target.project_client_id === null) throw new CanonicalExecutionError(409, "Assigned Project was not found.");
  if (target.client_id !== null && target.client_name === null) throw new CanonicalExecutionError(409, "Assigned Client was not found.");
  if (target.client_id !== null && target.project_client_id !== target.client_id) throw new CanonicalExecutionError(409, "Video Client does not match its Project Client.");
  if (target.project_status === "archived") throw new CanonicalExecutionError(409, "Archived Projects cannot start new work.");
  if (target.archival_state === "GELADEIRA" || target.client_status === "inactive") {
    throw new CanonicalExecutionError(409, "Inactive or archived Clients cannot start new work.");
  }

  const canonicalId = target.client_id === null ? null : canonicalClientId(Number(target.client_id));
  if (canonicalId !== null && canonicalId !== Number(target.client_id)) {
    const canonical = await client.prepare("SELECT id FROM clients WHERE id = ?1").bind(canonicalId).first();
    if (!canonical) throw new CanonicalExecutionError(409, "Canonical Client for this operational alias was not found.");
  }
  const description = `Started ${activityType} on ${target.title ?? `Video ${target.date}`} from RMEDIA App`;
  const eventKey = `rmedia-work-session-start:${deviceId}:${videoId}:${nowSeconds}`;
  const [startResult] = await client.batch<ExecutionRow>([
    client.prepare(RMEDIA_CANONICAL_START_SQL).bind(videoId, nowSeconds, activityType, deviceId),
    client.prepare(RMEDIA_CANONICAL_START_EVENT_SQL).bind(
      videoId, canonicalId, nowSeconds, description, eventKey, activityType, deviceId,
    ),
  ]);
  const inserted = startResult.results[0] ?? null;
  const active = await readCanonicalExecution(client);
  if (!active) throw new CanonicalExecutionError(409, "Canonical Work Session could not be started.");
  if (active.video_id !== videoId) throw new CanonicalExecutionError(409, `Work is already running on ${active.video_title}.`);
  return { session: active, idempotent: inserted === null };
}

export async function endCanonicalExecution(
  client: D1Database,
  workSessionId: number,
  nowSeconds = Math.floor(Date.now() / 1_000),
): Promise<{ ended: true; idempotent: boolean }> {
  const existing = await client.prepare(`${EXECUTION_SELECT} WHERE ws.id = ?1 LIMIT 1`).bind(workSessionId).first<ExecutionRow>();
  if (!existing) {
    const closed = await client.prepare("SELECT id FROM work_sessions WHERE id = ?1 AND ended_at IS NOT NULL").bind(workSessionId).first();
    if (closed) return { ended: true, idempotent: true };
    throw new CanonicalExecutionError(404, "Work Session not found.");
  }
  if (nowSeconds <= Number(existing.started_at)) throw new CanonicalExecutionError(409, "The session just started. Wait a moment and stop again.");
  const canonicalId = existing.client_id === null ? null : canonicalClientId(Number(existing.client_id));
  const [endResult] = await client.batch([
    client.prepare(RMEDIA_CANONICAL_END_SQL).bind(workSessionId, nowSeconds),
    client.prepare(RMEDIA_CANONICAL_END_EVENT_SQL).bind(
      workSessionId, canonicalId, nowSeconds, `rmedia-work-session-end:${workSessionId}:${nowSeconds}`,
    ),
  ]);
  if (!endResult.results[0]) {
    const closed = await client.prepare("SELECT id FROM work_sessions WHERE id = ?1 AND ended_at IS NOT NULL").bind(workSessionId).first();
    if (closed) return { ended: true, idempotent: true };
    throw new CanonicalExecutionError(409, "Work Session could not be ended.");
  }
  return { ended: true, idempotent: false };
}

export class CanonicalExecutionError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
