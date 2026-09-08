export const WORK_SESSION_ACTIVITY_TYPES = [
  "EDITING",
  "MOTION_GRAPHICS",
  "COLOR",
  "AUDIO",
  "REVIEW",
  "EXPORT",
  "ADMIN",
  // Client Service Reality Patch (25 Aug 2026): pricing, replying to a
  // client, brief interpretation, quote preparation, delivery
  // coordination -- everything that used to have no honest home except
  // "Other". One clear activity, not ten communication subtypes (per the
  // brief's own instruction).
  "CLIENT_SERVICE",
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
  CLIENT_SERVICE: "Client service",
  OTHER: "Other",
};

// Sprint 1.2.1 Ledger P1: capture-method vocabulary. Open-ended by design —
// see the comment on work_sessions.source in schema.ts for why this column
// carries no CHECK constraint. WEB_TIMER remains the browser capture path;
// MAC_SENSOR identifies the native macOS bridge without changing correction
// semantics. MANUAL (Tuesday Patch Priority 6, brief's "Log Manual Time --
// caso você esqueça de iniciar sessão") identifies a session that was
// never live-tracked at all -- entered directly as a closed start/end
// window, e.g. to backfill a day the operator forgot to log. Future
// IMPORTED values remain deliberately deferred.
export const WORK_SESSION_SOURCES = [
  "WEB_TIMER",
  "MAC_SENSOR",
  "MAC_SENSOR_APPROVED",
  "MANUAL",
] as const;
export type WorkSessionSource = (typeof WORK_SESSION_SOURCES)[number];
export const DEFAULT_WORK_SESSION_SOURCE: WorkSessionSource = "WEB_TIMER";

export function isWorkSessionSource(
  value: unknown,
): value is WorkSessionSource {
  return (
    typeof value === "string" &&
    WORK_SESSION_SOURCES.includes(value as WorkSessionSource)
  );
}

// NIGHT SHIFT REALITY PATCH §3: MindBunker serves one operator. Rather than
// inventing a users table for a single-person tool, operator identity is
// this tiny configuration constant -- the smallest thing that can possibly
// work, per the brief's own preference (config over a new canonical
// concept). If MindBunker ever serves more than one operator, this is the
// first thing that has to change; until then, a table would be pure
// speculative abstraction.
export const OPERATOR_NAME = "Emmanuel";

export type OpenWorkSession = {
  id: number;
  videoId: number;
  videoTitle: string;
  // Null when the video has no client/project attribution -- never
  // fabricated. A session on an unattributed video (e.g. an ADMIN task) is
  // shown honestly as just the video/activity, not guessed into a client.
  clientName: string | null;
  clientId: number | null;
  projectName: string | null;
  activityType: WorkSessionActivityType;
  startedAt: string;
  // Null for a WEB_TIMER session (no physical device involved) or when the
  // linked sensor_devices row has since been revoked/renamed away; present
  // only when this really is MAC_SENSOR-captured evidence from a named
  // device -- see work_sessions.sensor_device_id in db/schema.ts.
  deviceName: string | null;
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

export function isWorkSessionId(value: unknown): value is number {
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

// HH:MM:SS live-clock rendering for an actively-ticking open session (NOW/
// FOCUS, WorkSessionPanel). Distinct from formatClosedDuration above, which
// is the compact "2h 14m" form used for closed/historical totals.
export function formatElapsedClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
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

// Stale-session recovery (Sprint 1.2.1 Ledger P1, §6 model B): stops the
// one open session at an operator-chosen past timestamp instead of "now".
// ?3 is the request-time "now" bound, passed in explicitly rather than
// computed in SQL, so the same clock reading used for validation upstream
// is also what guards the write — a session can never be closed in the
// future.
export const STOP_WORK_SESSION_AT_SQL = `
  UPDATE work_sessions
  SET ended_at = ?2
  WHERE video_id = ?1
    AND ended_at IS NULL
    AND ?2 > started_at
    AND ?2 <= ?3
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

// NIGHT SHIFT REALITY PATCH §3: extended with LEFT JOINs to clients/
// projects/sensor_devices so the Home "Now" panel can show the real
// attribution hierarchy (Operator -> Device -> Client -> Project -> Video)
// when it exists, and honestly fall back to less when it doesn't --
// video_logs.client_id/project_id and work_sessions.sensor_device_id are
// all nullable, so every LEFT JOIN can legitimately produce NULL. Never
// widened to INNER JOIN: doing so would silently hide an open session on
// an unattributed video instead of showing it plainly.
export const OPEN_WORK_SESSION_SQL = `
  SELECT
    ws.id,
    ws.video_id,
    COALESCE(v.title, 'Video ' || v.date) AS video_title,
    v.client_id AS client_id,
    c.name AS client_name,
    p.name AS project_name,
    ws.activity_type,
    ws.started_at,
    sd.name AS device_name
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  LEFT JOIN projects p ON p.id = v.project_id
  LEFT JOIN clients c ON c.id = v.client_id
  LEFT JOIN sensor_devices sd ON sd.id = ws.sensor_device_id
  WHERE ws.ended_at IS NULL
  ORDER BY ws.id DESC
  LIMIT 1
`;

// Local dogfooding consolidation: ?2 is an optional video filter (bind
// null to see the unfiltered ledger, exactly as before). Kept as one query
// rather than a second SQL constant so the filtered and unfiltered views
// can never silently drift from each other in shape.
// Tuesday Patch Priority 6 ("um painel similar a esse dentro de cada
// projeto dos clientes... já temos as log sessions por video em um certo
// sentido"): ?3 generalizes the existing video filter to a Project, so
// the same ledger page can scope to "every session across every video in
// this project" -- one dedicated, isolated evidence source per project,
// reusing the full existing table/correction/narrative UI rather than a
// second, smaller panel.
export const WORK_SESSION_HISTORY_SQL = `
  SELECT
    ws.id,
    ws.video_id,
    COALESCE(v.title, 'Video ' || v.date) AS video_title,
    c.name AS client_name,
    p.name AS project_name,
    ws.activity_type,
    ws.started_at,
    ws.ended_at,
    ws.note,
    ws.source,
    ws.updated_at,
    ss.id AS sensor_session_id
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  LEFT JOIN projects p ON p.id = v.project_id
  LEFT JOIN clients c ON c.id = v.client_id
  LEFT JOIN sensor_sessions ss ON ss.approved_work_session_id = ws.id
  WHERE (?2 IS NULL OR ws.video_id = ?2)
    AND (?3 IS NULL OR v.project_id = ?3)
  ORDER BY ws.started_at DESC
  LIMIT ?1
`;

export type WorkSessionHistoryEntry = {
  id: number;
  videoId: number;
  videoTitle: string;
  clientName: string | null;
  projectName: string | null;
  activityType: WorkSessionActivityType;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  status: "OPEN" | "CLOSED";
  note: string | null;
  source: WorkSessionSource;
  updatedAt: string | null;
  // Brief C ("Final Local Ingest / Live Readiness") §13: present only when
  // this Work Session was captured/approved from a Sensor evidence session
  // (sensor_sessions.approved_work_session_id is unique per work session,
  // so this is a straight 1:1 reverse lookup, not a new correlation). Lets
  // the ledger link to the existing Sensor Session detail route instead of
  // duplicating that UI. SENSOR FREEZE (§14): this only reads the existing
  // approved_work_session_id relationship -- nothing about Sensor
  // ingestion, its endpoint, port 3011 behavior, approval semantics,
  // evidence correlation, or provenance rules is touched.
  sensorSessionId: number | null;
};

// One row for a single work_sessions record, joined the same way the
// history query is, for correction pre-checks and audit-diff building.
export const WORK_SESSION_BY_ID_SQL = `
  SELECT
    ws.id,
    ws.video_id,
    v.client_id,
    COALESCE(v.title, 'Video ' || v.date) AS video_title,
    c.name AS client_name,
    p.name AS project_name,
    ws.activity_type,
    ws.started_at,
    ws.ended_at,
    ws.note
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  LEFT JOIN projects p ON p.id = v.project_id
  LEFT JOIN clients c ON c.id = v.client_id
  WHERE ws.id = ?1
`;

// Correction of an already-CLOSED session (Sprint 1.2.1 Ledger P1, §5).
// Deliberately cannot touch an open session (ended_at IS NOT NULL guard) —
// the single-open-session invariant and the live timer own that path.
// ?4 > ?3 is a second, DB-level defense against an inverted/negative
// duration, mirroring the same discipline START/STOP already use; the
// authoritative check still happens in validateSessionCorrection() first.
export const CORRECT_WORK_SESSION_SQL = `
  UPDATE work_sessions
  SET video_id = ?2, started_at = ?3, ended_at = ?4, activity_type = ?5, note = ?6, updated_at = ?7
  WHERE id = ?1
    AND ended_at IS NOT NULL
    AND ?4 > ?3
    AND EXISTS (SELECT 1 FROM video_logs WHERE id = ?2)
  RETURNING id, video_id, started_at, ended_at, activity_type, note, updated_at
`;

// Tuesday Patch Priority 6 (brief's "Log Manual Time" + the "não logasse
// no dia 7" backfill complaint -- the same underlying gap: no way to
// record a work window that was never live-tracked). Deliberately an
// INSERT of an already-closed row, never touching the
// work_sessions_one_open_idx partial unique index (that index only
// applies where ended_at IS NULL) -- a manual entry can be logged
// regardless of whatever else is or isn't currently running.
export const LOG_MANUAL_WORK_SESSION_SQL = `
  INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note, source)
  SELECT ?1, ?2, ?3, ?4, ?5, 'MANUAL'
  WHERE EXISTS (SELECT 1 FROM video_logs WHERE id = ?1)
    AND ?3 > ?2
  RETURNING id, video_id, started_at, ended_at, activity_type, note, source
`;

export type SessionCorrectionInput = {
  videoId: number;
  startedAt: Date;
  endedAt: Date;
  activityType: WorkSessionActivityType;
  note: string | null;
};

export type SessionCorrectionValidation =
  | { success: true; data: SessionCorrectionInput }
  | { success: false; error: string };

const MAX_SESSION_NOTE_LENGTH = 2_000;
// A single Work Session longer than this is refused by correction, the same
// way it would be flagged as stale while running (see
// STALE_SESSION_WARNING_SECONDS below) — not a hard product rule, a sanity
// backstop against a fat-fingered date (e.g. wrong year) turning one
// session into months of phantom tracked time.
const MAX_SESSION_DURATION_SECONDS = 14 * 24 * 60 * 60; // 14 days

export function validateSessionCorrection(
  input: {
    videoId: unknown;
    startedAt: unknown;
    endedAt: unknown;
    activityType: unknown;
    note: unknown;
  },
  now: Date = new Date(),
): SessionCorrectionValidation {
  if (!isWorkSessionVideoId(input.videoId)) {
    return { success: false, error: "Choose a valid video." };
  }
  if (!isWorkSessionActivityType(input.activityType)) {
    return { success: false, error: "Choose a valid activity." };
  }
  const startedAt =
    input.startedAt instanceof Date ? input.startedAt : new Date(String(input.startedAt));
  const endedAt =
    input.endedAt instanceof Date ? input.endedAt : new Date(String(input.endedAt));
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return { success: false, error: "Start and end must be valid dates." };
  }
  if (endedAt.getTime() <= startedAt.getTime()) {
    return { success: false, error: "End time must be after start time." };
  }
  if (endedAt.getTime() > now.getTime()) {
    return { success: false, error: "End time cannot be in the future." };
  }
  if (
    (endedAt.getTime() - startedAt.getTime()) / 1_000 >
    MAX_SESSION_DURATION_SECONDS
  ) {
    return {
      success: false,
      error: "That session would be longer than 14 days — check the dates.",
    };
  }
  const rawNote = typeof input.note === "string" ? input.note.trim() : "";
  if (rawNote.length > MAX_SESSION_NOTE_LENGTH) {
    return { success: false, error: "Note is too long." };
  }

  return {
    success: true,
    data: {
      videoId: input.videoId,
      startedAt,
      endedAt,
      activityType: input.activityType,
      note: rawNote.length > 0 ? rawNote : null,
    },
  };
}

export type SessionCorrectionBefore = {
  videoId: number;
  videoTitle: string;
  startedAt: string;
  endedAt: string | null;
  activityType: WorkSessionActivityType;
  note: string | null;
};

// Human-readable audit trail text, stored as a crm_events.description (see
// actions.ts). Only mentions fields that actually changed — a correction
// that only fixes the note doesn't claim the video or times changed too.
export function describeSessionCorrection(
  sessionId: number,
  before: SessionCorrectionBefore,
  after: SessionCorrectionInput,
  afterVideoTitle: string,
): string {
  const changes: string[] = [];
  if (before.videoId !== after.videoId) {
    changes.push(`video ${before.videoTitle} → ${afterVideoTitle}`);
  }
  if (before.startedAt !== after.startedAt.toISOString()) {
    changes.push(`start ${before.startedAt} → ${after.startedAt.toISOString()}`);
  }
  const beforeEndedIso = before.endedAt;
  if (beforeEndedIso !== after.endedAt.toISOString()) {
    changes.push(`end ${beforeEndedIso ?? "(open)"} → ${after.endedAt.toISOString()}`);
  }
  if (before.activityType !== after.activityType) {
    changes.push(`activity ${before.activityType} → ${after.activityType}`);
  }
  if ((before.note ?? "") !== (after.note ?? "")) {
    changes.push("note updated");
  }
  const summary = changes.length > 0 ? changes.join("; ") : "no field values changed";
  return `Work Session #${sessionId} corrected: ${summary}`;
}

// ─── Stale / long-running session visibility (§6) ──────────────────────────
//
// Recommended model, per the brief's own instruction to evaluate A-D and
// pick one based on minimal interference: a threshold-based visibility
// flag (closest to option A, "long-session warning"), paired with the
// ability to close the session at a chosen past time instead of "now"
// (option B's "Correct end time" branch, reusing the same validation as a
// post-hoc correction). No maximum-duration cutoff exists (option C) — one
// data point (this round's own 1h51 test) does not justify inventing a
// ceiling, and a silently-enforced cutoff would corrupt real elapsed time
// rather than just flag it. No automatic stop of any kind (never option D
// taken to its automatic extreme) — the human always presses a button.
//
// 6 hours is a starting heuristic, not a law: it's long enough that a
// normal edit session won't trip it, short enough to catch "forgot to
// press Stop before sleep." Expected to be tuned from real Aug 23-28
// dogfooding data, per docs/architecture/WORK_SESSION_LEDGER_P1.md.
export const STALE_SESSION_WARNING_SECONDS = 6 * 60 * 60;

export function isSessionStale(elapsedSeconds: number): boolean {
  return elapsedSeconds >= STALE_SESSION_WARNING_SECONDS;
}

// ─── Day / week grouping for the Session History surface (§4) ─────────────
//
// Pure functions, no DB access — operate on WorkSessionHistoryEntry[]
// already fetched by getWorkSessionHistory(). Day buckets use the same
// display timezone (America/Sao_Paulo) the history page already renders
// timestamps in, so a session shown as "11:58 PM" lands in the day the
// operator actually sees it on, not whatever day UTC would put it in.

const HISTORY_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const HISTORY_DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  month: "short",
  day: "numeric",
});

// en-CA locale formats as YYYY-MM-DD, which sorts correctly as a string —
// used as the grouping key.
export function dayKeyFor(iso: string): string {
  return HISTORY_DAY_FORMATTER.format(new Date(iso));
}

export type WorkSessionDayGroup = {
  dayKey: string;
  label: string;
  totalClosedSeconds: number;
  hasOpenSession: boolean;
  sessions: WorkSessionHistoryEntry[];
};

export function groupWorkSessionsByDay(
  entries: WorkSessionHistoryEntry[],
): WorkSessionDayGroup[] {
  const groups = new Map<string, WorkSessionDayGroup>();
  for (const entry of entries) {
    const dayKey = dayKeyFor(entry.startedAt);
    let group = groups.get(dayKey);
    if (!group) {
      group = {
        dayKey,
        label: HISTORY_DAY_LABEL_FORMATTER.format(new Date(entry.startedAt)),
        totalClosedSeconds: 0,
        hasOpenSession: false,
        sessions: [],
      };
      groups.set(dayKey, group);
    }
    group.sessions.push(entry);
    if (entry.durationSeconds !== null) {
      group.totalClosedSeconds += entry.durationSeconds;
    } else {
      group.hasOpenSession = true;
    }
  }
  // Map preserves insertion order; entries arrive newest-first from SQL, so
  // this is already newest-day-first. Re-sort defensively in case a caller
  // passes unsorted entries (e.g. a future manual-entry path).
  return Array.from(groups.values()).sort((a, b) =>
    b.dayKey.localeCompare(a.dayKey),
  );
}

export type WorkSessionWeekGroup = {
  weekKey: string;
  label: string;
  totalClosedSeconds: number;
  days: WorkSessionDayGroup[];
};

// ISO week (Monday start), matching the Upwork reference view's own
// "Aug 17 - Aug 23" weekly framing. Computed from each day group's own key
// (already timezone-correct) rather than re-deriving from raw timestamps.
// Exported (Sprint 1.2 local dogfooding consolidation) so a page-level
// "this week" comparison can reuse the exact same Monday-start week
// boundary the ledger itself uses, instead of a second, potentially
// drifting definition of "current week."
export function mondayOfWeek(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay(); // 0 = Sunday
  const diffToMonday = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(mondayKey: string): string {
  const [year, month, day] = mondayKey.split("-").map(Number);
  const monday = new Date(Date.UTC(year, month - 1, day));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export function groupWorkSessionDaysByWeek(
  dayGroups: WorkSessionDayGroup[],
): WorkSessionWeekGroup[] {
  const groups = new Map<string, WorkSessionWeekGroup>();
  for (const day of dayGroups) {
    const weekKey = mondayOfWeek(day.dayKey);
    let group = groups.get(weekKey);
    if (!group) {
      group = {
        weekKey,
        label: formatWeekLabel(weekKey),
        totalClosedSeconds: 0,
        days: [],
      };
      groups.set(weekKey, group);
    }
    group.days.push(day);
    group.totalClosedSeconds += day.totalClosedSeconds;
  }
  return Array.from(groups.values()).sort((a, b) =>
    b.weekKey.localeCompare(a.weekKey),
  );
}

// --- Session Narrative (Sunday Systems Round, Phase B/C) -------------------
//
// Video Memory notes (crm_events, type video.note_added) and Work Sessions
// were never designed to reference each other, but both already carry the
// same video_id and a real timestamp. So "what was written while this
// session was open" is answerable as a pure projection over data that
// already exists, with no schema change and no new table: a note
// correlates to a session when it shares the same video and its timestamp
// falls inside the session's [startedAt, endedAt] window. An still-open
// session has no endedAt yet, so its upper bound (nowIso) is passed in by
// the caller rather than computed here, for the same react-hooks/purity
// reason getWorkSessionOverview() reads "now" in the data layer, not in a
// component render.

export type CorrelatedMemoryNote = {
  id: number;
  body: string;
  createdAt: string;
};

export type MemoryNoteForCorrelation = {
  id: number;
  videoId: number;
  body: string;
  createdAt: string;
};

export function correlateSessionMemoryNotes(
  session: Pick<WorkSessionHistoryEntry, "videoId" | "startedAt" | "endedAt">,
  notes: readonly MemoryNoteForCorrelation[],
  nowIso: string,
): CorrelatedMemoryNote[] {
  const start = Date.parse(session.startedAt);
  const end = session.endedAt !== null ? Date.parse(session.endedAt) : Date.parse(nowIso);
  return notes
    .filter((note) => note.videoId === session.videoId)
    .filter((note) => {
      const noteTime = Date.parse(note.createdAt);
      return noteTime >= start && noteTime <= end;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((note) => ({ id: note.id, body: note.body, createdAt: note.createdAt }));
}

// ─── NIGHT SHIFT REALITY PATCH §3/§5/§6/§9: attribution window ───────────
//
// One raw fetch (closed sessions only, joined to client/project) serving
// two different derived views: project day-streaks (§5) and today's
// duration/session-count/per-client-seconds (§6, §9). ?1 is a bound epoch
// seconds cutoff computed by the caller (data.ts) -- a lookback window
// generous enough to cover any realistic streak, never the whole ledger.
export const WORK_SESSION_ATTRIBUTION_SQL = `
  SELECT
    ws.started_at,
    ws.ended_at,
    v.project_id AS project_id,
    p.name AS project_name,
    v.client_id AS client_id,
    c.name AS client_name
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  LEFT JOIN projects p ON p.id = v.project_id
  LEFT JOIN clients c ON c.id = v.client_id
  WHERE ws.ended_at IS NOT NULL
    AND ws.started_at >= ?1
  ORDER BY ws.started_at ASC
`;

export type WorkSessionAttributionRow = {
  projectId: number | null;
  projectName: string | null;
  clientId: number | null;
  clientName: string | null;
  startedAt: string;
  durationSeconds: number;
};

// Simple calendar-day arithmetic on a "YYYY-MM-DD" key. UTC-anchored on
// purpose -- this only ever adds/subtracts whole days from a key that was
// itself already correctly resolved to America/Sao_Paulo via dayKeyFor()
// above, so no further timezone conversion belongs here.
function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

export type ProjectStreak = {
  projectId: number;
  projectName: string;
  clientId: number | null;
  clientName: string | null;
  currentStreak: number;
  lastActiveDayKey: string;
  isActiveToday: boolean;
};

// §5: "a project active day exists when canonical evidence associates
// meaningful work with that project on that local calendar date" --
// Work Sessions explicitly linked to a project via video_logs.project_id,
// never inferred from passive Sensor observation. Multiple sessions the
// same day count once (a Set of day keys, not a count). A streak must end
// today or yesterday to be "current" -- a project last worked 2+ days ago
// shows no streak rather than a stale one (so it stops meaning something
// at 00:01, per the brief's own worked example).
export function computeProjectStreaks(
  rows: readonly Pick<WorkSessionAttributionRow, "projectId" | "projectName" | "clientId" | "clientName" | "startedAt">[],
  todayKey: string,
): ProjectStreak[] {
  const byProject = new Map<number, { name: string; clientId: number | null; clientName: string | null; days: Set<string> }>();
  for (const row of rows) {
    if (row.projectId === null) continue; // passive/unattributed work never creates a streak
    const dayKey = dayKeyFor(row.startedAt);
    const entry = byProject.get(row.projectId) ?? {
      name: row.projectName ?? "",
      clientId: row.clientId,
      clientName: row.clientName,
      days: new Set<string>(),
    };
    entry.days.add(dayKey);
    byProject.set(row.projectId, entry);
  }

  const yesterdayKey = shiftDayKey(todayKey, -1);
  const streaks: ProjectStreak[] = [];
  for (const [projectId, { name, clientId, clientName, days }] of byProject) {
    const lastActiveDayKey = [...days].sort().at(-1)!;
    if (lastActiveDayKey !== todayKey && lastActiveDayKey !== yesterdayKey) continue;

    let currentStreak = 0;
    let cursor = lastActiveDayKey;
    while (days.has(cursor)) {
      currentStreak += 1;
      cursor = shiftDayKey(cursor, -1);
    }
    streaks.push({
      projectId,
      projectName: name,
      clientId,
      clientName,
      currentStreak,
      lastActiveDayKey,
      isActiveToday: lastActiveDayKey === todayKey,
    });
  }
  return streaks;
}

// Sort per §5: currently active first, then longest streak, then most
// recently active. Callers slice to the top ~3 for Home.
export function sortProjectStreaks(streaks: readonly ProjectStreak[]): ProjectStreak[] {
  return [...streaks].sort((a, b) => {
    if (a.isActiveToday !== b.isActiveToday) return a.isActiveToday ? -1 : 1;
    if (a.currentStreak !== b.currentStreak) return b.currentStreak - a.currentStreak;
    return b.lastActiveDayKey.localeCompare(a.lastActiveDayKey);
  });
}

export type TodayWorkSessionStats = {
  totalSeconds: number;
  sessionCount: number;
  byClient: Array<{ clientId: number; clientName: string; seconds: number }>;
};

// §6/§9: TODAY = the operator's current local calendar day, resolved by
// dayKeyFor on each session's own started_at -- never SQLite's UTC-based
// date(), which would misattribute a late-evening Brazil session to the
// wrong day (see the Sprint C1 report's note on this same class of bug in
// finance/core.ts's CLIENT_OPERATIONAL_MINUTES_SQL, deliberately not
// reused here for exactly that reason).
export function computeTodayWorkSessionStats(
  closedRows: readonly WorkSessionAttributionRow[],
  todayKey: string,
): TodayWorkSessionStats {
  const todays = closedRows.filter((row) => dayKeyFor(row.startedAt) === todayKey);
  const byClientMap = new Map<number, { name: string; seconds: number }>();
  let totalSeconds = 0;
  for (const row of todays) {
    totalSeconds += row.durationSeconds;
    if (row.clientId !== null) {
      const entry = byClientMap.get(row.clientId) ?? { name: row.clientName ?? "", seconds: 0 };
      entry.seconds += row.durationSeconds;
      byClientMap.set(row.clientId, entry);
    }
  }
  return {
    totalSeconds,
    sessionCount: todays.length,
    byClient: Array.from(byClientMap, ([clientId, v]) => ({
      clientId,
      clientName: v.name,
      seconds: v.seconds,
    })),
  };
}


// ─── MICRO PATCH (Open/Copy, Last Active, Provenance, /book) ──────────────
// §2: "Last active" -- a short, honest relative label for when a
// project/client was last actively worked on (explicit attributable Work
// Sessions only, never inferred from passive Sensor observation -- see
// getLastActiveByProject/getLastActiveByClient in data.ts, which this
// formats). Reuses dayKeyFor's existing America/Sao_Paulo day-boundary
// semantics for the Today/Yesterday bucketing so this never disagrees with
// any other Today/Yesterday label already in the app.
export function formatLastActive(iso: string, nowIso: string): string {
  const then = new Date(iso);
  const now = new Date(nowIso);
  const todayKey = dayKeyFor(nowIso);
  const thenKey = dayKeyFor(iso);

  if (thenKey === todayKey) {
    const diffHours = Math.floor((now.getTime() - then.getTime()) / (60 * 60 * 1000));
    return diffHours < 1 ? "Just now" : `${diffHours}h ago`;
  }
  if (thenKey === shiftDayKey(todayKey, -1)) {
    return "Yesterday";
  }

  const [, month, day] = thenKey.split("-").map(Number);
  const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${MONTH_LABELS[month - 1]} ${day}`;
}
