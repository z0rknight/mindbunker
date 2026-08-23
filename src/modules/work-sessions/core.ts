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

// Sprint 1.2.1 Ledger P1: capture-method vocabulary. Open-ended by design —
// see the comment on work_sessions.source in schema.ts for why this column
// carries no CHECK constraint. WEB_TIMER is the only value any code path
// can currently produce (starting/stopping the on-screen timer, or
// correcting an already-closed session — a correction changes the *values*
// of a WEB_TIMER-captured row, it does not change how the row was
// originally captured). MANUAL (a session entered after the fact with no
// prior timer row) and IMPORTED (from historical reconstruction) are
// listed here as the documented next values, per the brief's own capture
// method list — neither is produced by any code in this round.
export const WORK_SESSION_SOURCES = ["WEB_TIMER"] as const;
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

// Local dogfooding consolidation: ?2 is an optional video filter (bind
// null to see the unfiltered ledger, exactly as before). Kept as one query
// rather than a second SQL constant so the filtered and unfiltered views
// can never silently drift from each other in shape.
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
    ws.updated_at
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  LEFT JOIN projects p ON p.id = v.project_id
  LEFT JOIN clients c ON c.id = v.client_id
  WHERE (?2 IS NULL OR ws.video_id = ?2)
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
function dayKeyFor(iso: string): string {
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
