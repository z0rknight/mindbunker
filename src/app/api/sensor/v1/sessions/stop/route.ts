import { getDb } from "@/db";
import {
  SENSOR_SESSION_STOP_SQL,
  validateSensorStopInput,
} from "@/modules/sensor/core";
import {
  authenticateSensorRequest,
  readJson,
  sensorUnauthorized,
} from "@/modules/sensor/server";

type SessionRow = {
  id: number;
  video_id: number | null;
  context_type: string;
  context_label: string | null;
  started_at: number;
  ended_at: number | null;
  activity_type: string;
  source: string;
  local_session_id: string;
  approval_state: string;
};

export async function POST(request: Request) {
  const device = await authenticateSensorRequest(request, "SESSION_WRITE");
  if (!device) return sensorUnauthorized();
  let payload: unknown;
  try { payload = await readJson(request); } catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
  const parsed = validateSensorStopInput(payload);
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 });
  const db = await getDb();
  const input = parsed.data;
  const stopped = await db.$client
    .prepare(SENSOR_SESSION_STOP_SQL)
    .bind(device.id, input.localSessionId, input.endedAt)
    .first<SessionRow>();
  if (stopped) return Response.json({ session: mapSession(stopped), idempotent: false });
  const existing = await db.$client
    .prepare("SELECT id, video_id, started_at, ended_at, activity_type, source, local_session_id, approval_state FROM sensor_sessions WHERE sensor_device_id = ?1 AND local_session_id = ?2")
    .bind(device.id, input.localSessionId)
    .first<SessionRow>();
  if (!existing) return Response.json({ error: "Canonical sensor session not found yet." }, { status: 409 });
  if (existing.ended_at === null) return Response.json({ error: "End time must be after the canonical start." }, { status: 400 });
  return Response.json({ session: mapSession(existing), idempotent: true });
}

function mapSession(row: SessionRow) {
  return {
    id: Number(row.id),
    local_session_id: row.local_session_id,
    ended_at: row.ended_at === null ? null : new Date(Number(row.ended_at) * 1_000).toISOString(),
    source: row.source,
    approval_state: row.approval_state,
  };
}
