import { getDb } from "@/db";
import { canonicalClientId, isInternalClientName } from "@/lib/client-identity";
import {
  SENSOR_CAPTURE_INSERT_SQL,
  enrichContextSnapshot,
  resolveCaptureSessionAtOccurredAt,
  validateSensorCapture,
} from "@/modules/sensor/core";
import { authenticateSensorRequest, readJson, sensorUnauthorized } from "@/modules/sensor/server";

type CaptureRow = { id: number };
type SessionAtCaptureRow = {
  id: number;
  video_id: number;
  started_at: number;
  ended_at: number | null;
  activity_type: string;
  video_title: string;
  video_kind: string;
  project_id: number | null;
  project_name: string | null;
  client_id: number | null;
  client_name: string | null;
};

export async function POST(request: Request) {
  const device = await authenticateSensorRequest(request, "OBSERVATION_WRITE");
  if (!device) return sensorUnauthorized();
  let payload: unknown;
  try { payload = await readJson(request); } catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
  const parsed = validateSensorCapture(payload);
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 });
  const input = parsed.data;
  const db = await getDb();
  const existing = await db.$client.prepare(
    "SELECT id FROM captures WHERE sensor_device_id = ?1 AND local_capture_id = ?2",
  ).bind(device.id, input.localCaptureId).first<CaptureRow>();
  if (existing) return Response.json({ capture_id: Number(existing.id), idempotent: true });

  let canonicalSession: SessionAtCaptureRow | null = null;
  const integrityIssues = Array.isArray(input.contextSnapshot.integrityIssues)
    ? input.contextSnapshot.integrityIssues.filter((value): value is string => typeof value === "string").slice(0, 20)
    : [];
  if (input.claimedWorkSessionId !== null) {
    const claimed = await db.$client.prepare(`
      SELECT ws.id, ws.video_id, ws.started_at, ws.ended_at, ws.activity_type,
        COALESCE(v.title, 'Video ' || v.date) AS video_title, v.video_kind,
        v.project_id, p.name AS project_name, v.client_id, c.name AS client_name
      FROM work_sessions ws
      JOIN video_logs v ON v.id = ws.video_id
      LEFT JOIN projects p ON p.id = v.project_id
      LEFT JOIN clients c ON c.id = v.client_id
      WHERE ws.id = ?1
    `).bind(input.claimedWorkSessionId).first<SessionAtCaptureRow>();
    const resolved = resolveCaptureSessionAtOccurredAt(
      input.claimedWorkSessionId,
      input.occurredAt,
      claimed ? {
        ...claimed,
        id: Number(claimed.id),
        startedAt: Number(claimed.started_at),
        endedAt: claimed.ended_at === null ? null : Number(claimed.ended_at),
      } : null,
    );
    if (resolved.integrityIssue) integrityIssues.push(resolved.integrityIssue);
    canonicalSession = resolved.session;
  }

  const resolvedClientId = canonicalSession?.client_id === null || canonicalSession?.client_id === undefined
    ? null
    : canonicalClientId(Number(canonicalSession.client_id));
  let resolvedClientName = canonicalSession?.client_name ?? null;
  if (resolvedClientId !== null && resolvedClientId !== Number(canonicalSession?.client_id)) {
    const canonical = await db.$client.prepare("SELECT name FROM clients WHERE id = ?1").bind(resolvedClientId).first<{ name: string }>();
    resolvedClientName = canonical?.name ?? null;
  }
  const workClass = canonicalSession
    ? canonicalSession.video_kind === "INTERNAL" || isInternalClientName(canonicalSession.client_name)
      ? "INTERNAL"
      : canonicalSession.client_id === null ? null : "CLIENT"
    : null;
  const serverResolution = canonicalSession ? {
    provenance: "CANONICAL_RESOLVED",
    workSessionID: Number(canonicalSession.id),
    videoID: Number(canonicalSession.video_id),
    videoTitle: canonicalSession.video_title,
    projectID: canonicalSession.project_id === null ? null : Number(canonicalSession.project_id),
    projectName: canonicalSession.project_name,
    clientID: resolvedClientId,
    clientName: resolvedClientName,
    workClass,
    activityType: canonicalSession.activity_type,
  } : null;
  const snapshotJson = JSON.stringify(enrichContextSnapshot(
    input.contextSnapshot,
    serverResolution,
    integrityIssues,
  ));
  const context = canonicalSession ? workClass ?? "UNKNOWN" : "UNKNOWN";
  const inserted = await db.$client.prepare(SENSOR_CAPTURE_INSERT_SQL).bind(
    context,
    input.eventType,
    input.note,
    input.occurredAt,
    device.id,
    input.localCaptureId,
    snapshotJson,
    canonicalSession?.id ?? null,
  ).first<CaptureRow>();
  if (inserted) return Response.json({ capture_id: Number(inserted.id), idempotent: false }, { status: 201 });
  const raced = await db.$client.prepare(
    "SELECT id FROM captures WHERE sensor_device_id = ?1 AND local_capture_id = ?2",
  ).bind(device.id, input.localCaptureId).first<CaptureRow>();
  if (raced) return Response.json({ capture_id: Number(raced.id), idempotent: true });
  return Response.json({ error: "Capture could not be recorded." }, { status: 409 });
}
