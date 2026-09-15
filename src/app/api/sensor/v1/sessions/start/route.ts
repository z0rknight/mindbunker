import { getDb } from "@/db";
import {
  SENSOR_SESSION_START_SQL,
  validateSensorSessionInput,
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

const SESSION_SELECT_COLUMNS =
  "id, video_id, context_type, context_label, started_at, ended_at, activity_type, source, local_session_id, approval_state";

export async function POST(request: Request) {
  const device = await authenticateSensorRequest(request, "SESSION_WRITE");
  if (!device) return sensorUnauthorized();
  let payload: unknown;
  try { payload = await readJson(request); } catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
  const parsed = validateSensorSessionInput(payload);
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 });
  const input = parsed.data;
  const db = await getDb();
  const existing = await db.$client
    .prepare(`SELECT ${SESSION_SELECT_COLUMNS} FROM sensor_sessions WHERE sensor_device_id = ?1 AND local_session_id = ?2`)
    .bind(device.id, input.localSessionId)
    .first<SessionRow>();
  if (existing) return Response.json({ session: mapSession(existing), idempotent: true });

  const inserted = await db.$client
    .prepare(SENSOR_SESSION_START_SQL)
    .bind(
      input.videoId,
      input.contextType,
      input.contextLabel,
      input.startedAt,
      input.endedAt,
      input.activityType,
      input.note,
      device.id,
      input.localSessionId,
    )
    .first<SessionRow>();
  if (inserted) return Response.json({ session: mapSession(inserted), idempotent: false }, { status: 201 });

  if (input.videoId !== null) {
    const video = await db.$client.prepare("SELECT id FROM video_logs WHERE id = ?1").bind(input.videoId).first();
    if (!video) return Response.json({ error: "Video not found." }, { status: 404 });
  }
  const raced = await db.$client
    .prepare(`SELECT ${SESSION_SELECT_COLUMNS} FROM sensor_sessions WHERE sensor_device_id = ?1 AND local_session_id = ?2`)
    .bind(device.id, input.localSessionId)
    .first<SessionRow>();
  if (raced) return Response.json({ session: mapSession(raced), idempotent: true });
  return Response.json({ error: "Sensor session could not be recorded." }, { status: 409 });
}

function mapSession(row: SessionRow) {
  return {
    id: Number(row.id),
    local_session_id: row.local_session_id,
    video_id: row.video_id === null ? null : Number(row.video_id),
    context_type: row.context_type,
    context_label: row.context_label,
    activity_type: row.activity_type,
    started_at: new Date(Number(row.started_at) * 1_000).toISOString(),
    ended_at: row.ended_at === null ? null : new Date(Number(row.ended_at) * 1_000).toISOString(),
    source: row.source,
    approval_state: row.approval_state,
  };
}
