import {
  WORK_SESSION_ACTIVITY_TYPES,
  type WorkSessionActivityType,
} from "../work-sessions/core.ts";

// Kept here (not sensor/data.ts, which is server-only) so pure consumers
// like war-room/restaurant-core.ts can import the shape without pulling
// in a DB-backed module -- the exact same reason OpenWorkSession lives in
// work-sessions/core.ts rather than its data.ts.
export const SENSOR_CONTEXT_TYPES = ["CLIENT", "LEAD", "INTERNAL", "ADMIN"] as const;
export type SensorContextType = (typeof SENSOR_CONTEXT_TYPES)[number];
export function isSensorContextType(value: unknown): value is SensorContextType {
  return typeof value === "string" && (SENSOR_CONTEXT_TYPES as readonly string[]).includes(value);
}

export type OpenSensorSession = {
  id: number;
  videoId: number | null;
  videoTitle: string | null;
  clientId: number | null;
  clientName: string | null;
  projectName: string | null;
  contextType: SensorContextType;
  contextLabel: string | null;
  activityType: WorkSessionActivityType;
  startedAt: string;
  deviceName: string | null;
};

export const SENSOR_TOKEN_VERSION = "mbs1";
export const SENSOR_SCOPES = [
  "CATALOG_READ",
  "SESSION_WRITE",
  "OBSERVATION_WRITE",
] as const;
export type SensorScope = (typeof SENSOR_SCOPES)[number];

const encoder = new TextEncoder();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export async function hashSensorToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createSensorCredential() {
  const publicId = crypto.randomUUID();
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const token = `${SENSOR_TOKEN_VERSION}.${publicId}.${base64Url(secret)}`;
  return { publicId, token, tokenHash: await hashSensorToken(token) };
}

export function parseSensorToken(token: string | null) {
  if (!token || token.length > 256) return null;
  const [version, publicId, secret, ...extra] = token.split(".");
  if (
    extra.length > 0 ||
    version !== SENSOR_TOKEN_VERSION ||
    !UUID_PATTERN.test(publicId ?? "") ||
    !/^[A-Za-z0-9_-]{43}$/u.test(secret ?? "")
  ) {
    return null;
  }
  return { publicId, token };
}

export function extractBearerToken(request: Request) {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice(7).trim();
}

export function parseScopes(value: string): Set<SensorScope> {
  return new Set(
    value
      .split(",")
      .filter((scope): scope is SensorScope =>
        SENSOR_SCOPES.includes(scope as SensorScope),
      ),
  );
}

function positiveInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function validUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function boundedString(value: unknown, max: number): string | undefined;
function boundedString(value: unknown, max: number, nullable: true): string | null | undefined;
function boundedString(value: unknown, max: number, nullable = false): string | null | undefined {
  if (value === null && nullable) return null;
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  if (clean.length === 0 && nullable) return null;
  return clean.length > 0 && clean.length <= max ? clean : undefined;
}

function unixSeconds(value: unknown) {
  if (typeof value !== "string") return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1_000) : null;
}

export type SensorSessionInput = {
  localSessionId: string;
  videoId: number | null;
  contextType: SensorContextType;
  contextLabel: string | null;
  activityType: WorkSessionActivityType;
  startedAt: number;
  endedAt: number | null;
  note: string | null;
};

// Operational Context Sync Hotfix: CLIENT is unchanged -- still requires a
// real, positive video_id (the video-production hot path stays exactly as
// fast and unambiguous as before). LEAD/INTERNAL/ADMIN must NEVER carry a
// video_id (no fake attribution, no accidental client cross-linking) and
// carry contextLabel instead -- required non-empty for LEAD (mirrors the
// native app's own "Lead work requires a counterparty or lead label" rule),
// optional for INTERNAL, ignored for ADMIN.
export function validateSensorSessionInput(
  value: unknown,
  nowSeconds = Math.floor(Date.now() / 1_000),
): { success: true; data: SensorSessionInput } | { success: false; error: string } {
  if (!value || typeof value !== "object") return { success: false, error: "Invalid session payload." };
  const input = value as Record<string, unknown>;
  const localSessionId = input.local_session_id;
  const videoId = input.video_id;
  const contextTypeRaw = input.context_type ?? "CLIENT";
  const contextLabel = boundedString(input.context_label ?? null, 200, true);
  const activityType = input.activity_type;
  const startedAt = unixSeconds(input.started_at);
  const endedAt = input.ended_at === null || input.ended_at === undefined
    ? null
    : unixSeconds(input.ended_at);
  const note = boundedString(input.note ?? null, 2_000, true);

  if (!validUUID(localSessionId)) return { success: false, error: "Invalid local session ID." };
  if (!isSensorContextType(contextTypeRaw)) return { success: false, error: "Invalid context." };
  const contextType = contextTypeRaw;
  if (contextType === "CLIENT") {
    if (!positiveInteger(videoId)) return { success: false, error: "Invalid video." };
  } else if (videoId !== null && videoId !== undefined) {
    return { success: false, error: "Only Client work may carry a video." };
  }
  if (contextType === "LEAD" && (contextLabel === undefined || contextLabel === null)) {
    return { success: false, error: "Lead work requires a counterparty or lead label." };
  }
  if (!WORK_SESSION_ACTIVITY_TYPES.includes(activityType as WorkSessionActivityType)) {
    return { success: false, error: "Invalid activity." };
  }
  if (startedAt === null || startedAt > nowSeconds + 300 || startedAt < nowSeconds - 14 * 86_400) {
    return { success: false, error: "Invalid session start." };
  }
  if (endedAt !== null && (endedAt <= startedAt || endedAt > nowSeconds + 300)) {
    return { success: false, error: "Invalid session end." };
  }
  if (note === undefined) return { success: false, error: "Invalid note." };
  if (contextLabel === undefined) return { success: false, error: "Invalid context label." };
  return {
    success: true,
    data: {
      localSessionId,
      videoId: contextType === "CLIENT" ? Number(videoId) : null,
      contextType,
      contextLabel,
      activityType: activityType as WorkSessionActivityType,
      startedAt,
      endedAt,
      note,
    },
  };
}

export type SensorObservationInput = {
  localObservationId: string;
  startedAt: number;
  endedAt: number;
  appName: string;
  bundleId: string | null;
  windowTitle: string | null;
  idle: boolean;
  keystrokeCount: number | null;
  mouseMovementCount: number | null;
};

export function validateSensorStopInput(
  value: unknown,
  nowSeconds = Math.floor(Date.now() / 1_000),
): { success: true; data: { localSessionId: string; endedAt: number } } | { success: false; error: string } {
  if (!value || typeof value !== "object") return { success: false, error: "Invalid stop payload." };
  const input = value as Record<string, unknown>;
  const endedAt = unixSeconds(input.ended_at);
  if (!validUUID(input.local_session_id)) return { success: false, error: "Invalid local session ID." };
  if (endedAt === null || endedAt > nowSeconds + 300 || endedAt < nowSeconds - 14 * 86_400) {
    return { success: false, error: "Invalid session end." };
  }
  return { success: true, data: { localSessionId: input.local_session_id, endedAt } };
}

function optionalCount(value: unknown) {
  if (value === null || value === undefined) return null;
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 10_000_000
    ? Number(value)
    : undefined;
}

export function validateObservationBatch(
  value: unknown,
  nowSeconds = Math.floor(Date.now() / 1_000),
): { success: true; data: SensorObservationInput[] } | { success: false; error: string } {
  const raw = (value as { observations?: unknown })?.observations;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) {
    return { success: false, error: "Observation batch must contain 1–100 rows." };
  }
  const data: SensorObservationInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return { success: false, error: "Invalid observation." };
    const input = item as Record<string, unknown>;
    const prohibitedRawInputFields = [
      "key", "key_code", "characters", "text", "mouse_x", "mouse_y", "coordinates",
    ];
    if (prohibitedRawInputFields.some((field) => field in input)) {
      return { success: false, error: "Raw keyboard or pointer data is not accepted." };
    }
    const startedAt = unixSeconds(input.started_at);
    const endedAt = unixSeconds(input.ended_at);
    const appName = boundedString(input.app_name, 200);
    const bundleId = boundedString(input.bundle_id ?? null, 300, true);
    const windowTitle = boundedString(input.window_title ?? null, 500, true);
    const keystrokeCount = optionalCount(input.keystroke_count);
    const mouseMovementCount = optionalCount(input.mouse_movement_count);
    if (!validUUID(input.local_observation_id)) return { success: false, error: "Invalid observation ID." };
    if (startedAt === null || endedAt === null || endedAt < startedAt || endedAt - startedAt > 86_400 || endedAt > nowSeconds + 300) {
      return { success: false, error: "Invalid observation interval." };
    }
    if (appName === undefined || bundleId === undefined || windowTitle === undefined) {
      return { success: false, error: "Invalid observation context." };
    }
    if (typeof input.idle !== "boolean") return { success: false, error: "Invalid idle state." };
    if (keystrokeCount === undefined || mouseMovementCount === undefined) {
      return { success: false, error: "Invalid aggregate input count." };
    }
    data.push({
      localObservationId: input.local_observation_id,
      startedAt,
      endedAt,
      appName,
      bundleId,
      windowTitle,
      idle: input.idle,
      keystrokeCount,
      mouseMovementCount,
    });
  }
  return { success: true, data };
}

// Sensor Reality Sync §3: War Room needs to show SENSOR RECORDING the
// moment a sensor_sessions row is open, without waiting for operator
// approval -- the activity is real Sensor state even before it becomes
// canonical history. Mirrors OPEN_WORK_SESSION_SQL's own shape exactly
// (same joins, same "one open row" assumption) so the two read the same
// way at the call site.
// Operational Context Sync Hotfix: video_id is nullable now (LEFT JOIN, was
// INNER), and a non-CLIENT session shows its own contextType/contextLabel
// instead of manufacturing a client/video attribution it never had.
export const OPEN_SENSOR_SESSION_SQL = `
  SELECT
    ss.id,
    ss.video_id,
    COALESCE(v.title, 'Video ' || v.date) AS video_title,
    v.client_id AS client_id,
    c.name AS client_name,
    p.name AS project_name,
    ss.context_type,
    ss.context_label,
    ss.activity_type,
    ss.started_at,
    sd.name AS device_name
  FROM sensor_sessions ss
  LEFT JOIN video_logs v ON v.id = ss.video_id
  LEFT JOIN projects p ON p.id = v.project_id
  LEFT JOIN clients c ON c.id = v.client_id
  LEFT JOIN sensor_devices sd ON sd.id = ss.sensor_device_id
  WHERE ss.ended_at IS NULL
  ORDER BY ss.id DESC
  LIMIT 1
`;

// video_id is nullable -- the EXISTS guard only applies when a video_id was
// actually given (CLIENT context); a non-CLIENT Start passes ?1 = NULL and
// skips it entirely. validateSensorSessionInput already guarantees video_id
// is null for every non-CLIENT context, so this can never insert a fake
// video/client attribution alongside real Lead/Internal/Admin work.
export const SENSOR_SESSION_START_SQL = `
  INSERT INTO sensor_sessions
    (video_id, context_type, context_label, started_at, ended_at, activity_type, note, source, sensor_device_id, local_session_id, approval_state)
  SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'MAC_SENSOR', ?8, ?9, 'PENDING'
  WHERE ?1 IS NULL OR EXISTS (SELECT 1 FROM video_logs WHERE id = ?1)
  ON CONFLICT DO NOTHING
  RETURNING id, video_id, context_type, context_label, started_at, ended_at, activity_type, source, local_session_id, approval_state
`;

export const SENSOR_SESSION_STOP_SQL = `
  UPDATE sensor_sessions
  SET ended_at = ?3, updated_at = ?3
  WHERE sensor_device_id = ?1
    AND local_session_id = ?2
    AND ended_at IS NULL
    AND ?3 > started_at
  RETURNING id, video_id, started_at, ended_at, activity_type, source, local_session_id, approval_state
`;

// work_sessions.video_id stays NOT NULL (unchanged, canonical Client Work
// Sessions are exactly as video-attributed as they always were) -- so a
// non-CLIENT sensor_sessions row (video_id IS NULL by construction) can
// never satisfy this insert. Approval into a canonical Work Session remains
// exclusively a CLIENT-context operation; non-client sessions stay durable
// Sensor history, reviewable and archivable, never auto-billable.
export const SENSOR_SESSION_APPROVE_INSERT_SQL = `
  INSERT INTO work_sessions
    (video_id, started_at, ended_at, activity_type, note, source, sensor_device_id, sensor_local_id)
  SELECT video_id, started_at, ended_at, activity_type, note,
    'MAC_SENSOR_APPROVED', sensor_device_id, local_session_id
  FROM sensor_sessions
  WHERE id = ?1
    AND approval_state = 'PENDING'
    AND ended_at IS NOT NULL
    AND video_id IS NOT NULL
  ON CONFLICT(sensor_device_id, sensor_local_id) DO NOTHING
  RETURNING id
`;

export const SENSOR_SESSION_APPROVE_MARK_SQL = `
  UPDATE sensor_sessions
  SET approval_state = 'APPROVED',
      approved_work_session_id = (
        SELECT id FROM work_sessions
        WHERE sensor_device_id = sensor_sessions.sensor_device_id
          AND sensor_local_id = sensor_sessions.local_session_id
      ),
      approved_at = COALESCE(approved_at, ?2),
      updated_at = ?2
  WHERE id = ?1
    AND approval_state IN ('PENDING', 'APPROVED')
    AND ended_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM work_sessions
      WHERE sensor_device_id = sensor_sessions.sensor_device_id
        AND sensor_local_id = sensor_sessions.local_session_id
    )
  RETURNING approved_work_session_id
`;

// Sensor Reality Sync: lets Emmanuel fix a forgotten/wrong staged session
// (the "10h because the Mac slept" case) BEFORE it becomes canonical
// history, instead of only after. Deliberately mirrors
// SENSOR_SESSION_APPROVE_INSERT_SQL's own guard (PENDING + already
// stopped) -- editing a still-open session makes no operational sense
// (it's live), and an already-approved/archived/deleted one is a
// canonical-correction or evidence-tombstone concern, not this one.
export const SENSOR_SESSION_UPDATE_SQL = `
  UPDATE sensor_sessions
  SET video_id = ?2, started_at = ?3, ended_at = ?4, activity_type = ?5, note = ?6, updated_at = ?7
  WHERE id = ?1 AND approval_state = 'PENDING' AND ended_at IS NOT NULL
  RETURNING id
`;

export const SENSOR_SESSION_ARCHIVE_SQL = `
  UPDATE sensor_sessions
  SET approval_state = 'ARCHIVED', archived_at = ?2, updated_at = ?2
  WHERE id = ?1 AND approval_state = 'PENDING' AND ended_at IS NOT NULL
  RETURNING id
`;

export const SENSOR_SESSION_DELETE_SQL = `
  UPDATE sensor_sessions
  SET approval_state = 'DELETED', deleted_at = ?2, updated_at = ?2
  WHERE id = ?1 AND approval_state = 'ARCHIVED'
  RETURNING id
`;

// Sensor Reality Sync §10/§17: a read-only, display-only assistance
// list -- never an automatic truncation, deletion, or stop. ">6h" is a
// UI threshold, not a canonical fact; nothing here writes anything.
export const LONG_SESSION_THRESHOLD_SECONDS = 6 * 60 * 60;

export type LongSessionSourceRow = {
  id: number;
  videoId: number;
  videoTitle: string;
  startedAt: number;
  endedAt: number | null;
};

export type LongSessionStagingRow = LongSessionSourceRow & {
  approvalState: "PENDING" | "APPROVED" | "ARCHIVED" | "DELETED";
};

export type LongSessionCandidate = {
  id: number;
  kind: "STAGING" | "CANONICAL";
  date: string;
  target: string;
  durationSeconds: number;
  editable: boolean;
  approved: boolean;
};

export function selectLongSessionCandidates(
  stagingRows: readonly LongSessionStagingRow[],
  canonicalRows: readonly LongSessionSourceRow[],
  now: Date,
  thresholdSeconds: number = LONG_SESSION_THRESHOLD_SECONDS,
): LongSessionCandidate[] {
  const nowSeconds = Math.floor(now.getTime() / 1_000);

  const staging = stagingRows
    .map((row) => {
      const durationSeconds = (row.endedAt ?? nowSeconds) - row.startedAt;
      return {
        id: row.id,
        kind: "STAGING" as const,
        date: new Date(row.startedAt * 1_000).toISOString().slice(0, 10),
        target: row.videoTitle,
        durationSeconds,
        editable: row.approvalState === "PENDING" && row.endedAt !== null,
        approved: row.approvalState === "APPROVED",
        startedAt: row.startedAt,
      };
    })
    .filter((row) => row.durationSeconds > thresholdSeconds);

  const canonical = canonicalRows
    .map((row) => {
      const durationSeconds = (row.endedAt ?? nowSeconds) - row.startedAt;
      return {
        id: row.id,
        kind: "CANONICAL" as const,
        date: new Date(row.startedAt * 1_000).toISOString().slice(0, 10),
        target: row.videoTitle,
        durationSeconds,
        editable: row.endedAt !== null,
        approved: true,
        startedAt: row.startedAt,
      };
    })
    .filter((row) => row.durationSeconds > thresholdSeconds);

  return [...staging, ...canonical]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(({ startedAt, ...candidate }) => candidate);
}

export const SENSOR_OBSERVATION_INSERT_SQL = `
  INSERT INTO device_activity_observations
    (sensor_device_id, local_observation_id, started_at, ended_at, app_name, bundle_id, window_title, idle, keystroke_count, mouse_movement_count, source)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'MAC_SENSOR')
  ON CONFLICT(sensor_device_id, local_observation_id) DO NOTHING
`;

// Tuesday Reality Patch A2: "Sensor stays IDLE" turned out to be a
// presentation gap, not a heartbeat/polling bug -- there was no signal
// distinguishing "no device ever registered" / "device registered but
// hasn't phoned home recently" / "device is actively reporting" from
// each other, and none of that is the same fact as "there is an open
// canonical Work Session right now" (SENSOR ≠ WORK SESSION, preserved).
// A device is considered connected if it has reported within this
// window -- generous relative to the native app's own upload cadence,
// so this never flaps to OFFLINE between two real uploads.
export const SENSOR_CONNECTIVITY_STALE_AFTER_SECONDS = 10 * 60;

export type SensorConnectivityStatus = "NO_DEVICE" | "OFFLINE" | "CONNECTED";

export function resolveSensorConnectivityStatus(
  deviceCount: number,
  lastSuccessfulUpload: Date | null,
  now: Date,
): SensorConnectivityStatus {
  if (deviceCount === 0) return "NO_DEVICE";
  if (!lastSuccessfulUpload) return "OFFLINE";
  const ageSeconds = (now.getTime() - lastSuccessfulUpload.getTime()) / 1_000;
  if (ageSeconds < 0) return "CONNECTED"; // clock skew -- treat as fresh, not an error state
  return ageSeconds <= SENSOR_CONNECTIVITY_STALE_AFTER_SECONDS ? "CONNECTED" : "OFFLINE";
}
