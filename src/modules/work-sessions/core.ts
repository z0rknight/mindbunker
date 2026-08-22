export const WORK_SESSION_ACTIVITY_TYPES = [
  "EDITING",
  "MOTION_GRAPHICS",
  "COLOR",
  "AUDIO",
  "REVIEW",
  "EXPORT",
  "ADMIN",
  "OTHER",
] as const;

export type WorkSessionActivityType =
  (typeof WORK_SESSION_ACTIVITY_TYPES)[number];

export const DEFAULT_WORK_SESSION_ACTIVITY: WorkSessionActivityType = "EDITING";

export const WORK_SESSION_ACTIVITY_LABELS: Record<
  WorkSessionActivityType,
  string
> = {
  EDITING: "Editing",
  MOTION_GRAPHICS: "Motion graphics",
  COLOR: "Color",
  AUDIO: "Audio",
  REVIEW: "Review",
  EXPORT: "Export",
  ADMIN: "Admin",
  OTHER: "Other",
};

export type OpenWorkSession = {
  id: number;
  videoId: number;
  videoTitle: string;
  activityType: WorkSessionActivityType;
  startedAt: string;
};

export type VideoWorkSessionSummary = {
  videoId: number;
  closedSeconds: number;
  sessionCount: number;
};

export type VideoWorkSessionState = {
  summary: VideoWorkSessionSummary;
  openSession: OpenWorkSession | null;
};

export function isWorkSessionActivityType(
  value: unknown,
): value is WorkSessionActivityType {
  return (
    typeof value === "string" &&
    WORK_SESSION_ACTIVITY_TYPES.includes(value as WorkSessionActivityType)
  );
}

export function isWorkSessionVideoId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

export function toUnixSeconds(value: Date) {
  return Math.floor(value.getTime() / 1_000);
}

export function formatClosedDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds === 0) return "0m";
  if (seconds < 60) return "<1m";
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// This must remain one SQL statement. D1 processes a database's statements
// one at a time, so the global open-session check and insert cannot interleave.
export const START_WORK_SESSION_SQL = `
  INSERT INTO work_sessions (video_id, started_at, activity_type)
  SELECT ?1, ?2, ?3
  WHERE EXISTS (
    SELECT 1 FROM video_logs WHERE id = ?1
  )
  AND NOT EXISTS (
    SELECT 1 FROM work_sessions WHERE ended_at IS NULL
  )
  RETURNING id, video_id, started_at, ended_at, activity_type, note
`;

export const STOP_WORK_SESSION_SQL = `
  UPDATE work_sessions
  SET ended_at = ?2
  WHERE video_id = ?1
    AND ended_at IS NULL
    AND ?2 > started_at
  RETURNING id, video_id, started_at, ended_at, activity_type, note
`;

export const WORK_SESSION_OVERVIEW_SQL = `
  SELECT
    video_id,
    COALESCE(
      SUM(
        CASE
          WHEN ended_at IS NOT NULL THEN ended_at - started_at
          ELSE 0
        END
      ),
      0
    ) AS closed_seconds,
    COUNT(*) AS session_count
  FROM work_sessions
  GROUP BY video_id
  ORDER BY video_id
`;

export const VIDEO_WORK_SESSION_SUMMARY_SQL = `
  SELECT
    ?1 AS video_id,
    COALESCE(
      SUM(
        CASE
          WHEN ended_at IS NOT NULL THEN ended_at - started_at
          ELSE 0
        END
      ),
      0
    ) AS closed_seconds,
    COUNT(*) AS session_count
  FROM work_sessions
  WHERE video_id = ?1
`;

export const OPEN_WORK_SESSION_SQL = `
  SELECT
    ws.id,
    ws.video_id,
    COALESCE(v.title, 'Video ' || v.date) AS video_title,
    ws.activity_type,
    ws.started_at
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  WHERE ws.ended_at IS NULL
  ORDER BY ws.id DESC
  LIMIT 1
`;
