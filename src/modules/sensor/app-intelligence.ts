// Sensor Operational Ledger + App Intelligence Addendum: pure, deterministic
// derivation over telemetry that already exists (device_activity_observations
// for OBSERVED time, sensor_sessions for intentional intervals). No new
// event stream, no AI classifier, no embeddings. Raw app_name/bundle_id/
// window_title are never mutated -- everything here is read-time derivation.
import { dayKeyFor, mondayOfWeek } from "../work-sessions/core.ts";

// ─── App identity ────────────────────────────────────────────────────────

export const APP_KEYS = [
  "SAFARI",
  "NOTION",
  "CLAUDE",
  "CHATGPT",
  "PREMIERE_PRO",
  "AFTER_EFFECTS",
  "PHOTOSHOP",
  "MEDIA_ENCODER",
  "SLACK",
  "TERMINAL",
  "SUBLIME_TEXT",
  "UPWORK",
  "FINDER",
  "MINDBUNKER_SENSOR",
  "OTHER",
] as const;
export type AppKey = (typeof APP_KEYS)[number];

// Bundle identifier is the stable, preferred key -- matches real captured
// telemetry exactly (see RMEDIA_SENSOR_OPERATIONAL_LEDGER_PATCH_2026_09.md
// "APP TELEMETRY SOURCE" for the production sample this was built from).
// App-name substring is only a fallback for a bundle_id this table doesn't
// know yet -- deliberately conservative (exact/near-exact names only, no
// fuzzy matching) so an unrecognized app reports OTHER rather than a wrong
// guess.
const BUNDLE_ID_MAP: Record<string, AppKey> = {
  "com.apple.Safari": "SAFARI",
  "notion.id": "NOTION",
  "com.anthropic.claudefordesktop": "CLAUDE",
  "com.openai.codex": "CHATGPT",
  "com.adobe.PremierePro.26": "PREMIERE_PRO",
  "com.adobe.AfterEffects.application": "AFTER_EFFECTS",
  "com.adobe.Photoshop": "PHOTOSHOP",
  "com.adobe.ame.application.26": "MEDIA_ENCODER",
  "com.tinyspeck.slackmacgap": "SLACK",
  "com.apple.Terminal": "TERMINAL",
  "com.sublimetext.4": "SUBLIME_TEXT",
  "com.upwork.Upwork": "UPWORK",
  "com.apple.finder": "FINDER",
  "com.rmedia.mindbunker-sensor": "MINDBUNKER_SENSOR",
};

const APP_NAME_FALLBACK: Array<[RegExp, AppKey]> = [
  [/^safari$/iu, "SAFARI"],
  [/^notion$/iu, "NOTION"],
  [/^claude$/iu, "CLAUDE"],
  [/^chatgpt$/iu, "CHATGPT"],
  [/premiere/iu, "PREMIERE_PRO"],
  [/after effects/iu, "AFTER_EFFECTS"],
  [/photoshop/iu, "PHOTOSHOP"],
  [/media encoder/iu, "MEDIA_ENCODER"],
  [/^slack$/iu, "SLACK"],
  [/^terminal$/iu, "TERMINAL"],
  [/sublime text/iu, "SUBLIME_TEXT"],
  [/^upwork$/iu, "UPWORK"],
  [/^finder$/iu, "FINDER"],
  [/mindbunker sensor/iu, "MINDBUNKER_SENSOR"],
];

// Section 11: unknown is valid. An app this table has never seen reports
// OTHER truthfully rather than being forced into the nearest guess.
export function normalizeApplication(bundleId: string | null, appName: string): AppKey {
  if (bundleId && BUNDLE_ID_MAP[bundleId]) return BUNDLE_ID_MAP[bundleId];
  for (const [pattern, key] of APP_NAME_FALLBACK) {
    if (pattern.test(appName)) return key;
  }
  return "OTHER";
}

export const APP_KEY_LABELS: Record<AppKey, string> = {
  SAFARI: "Safari",
  NOTION: "Notion",
  CLAUDE: "Claude",
  CHATGPT: "ChatGPT",
  PREMIERE_PRO: "Premiere Pro",
  AFTER_EFFECTS: "After Effects",
  PHOTOSHOP: "Photoshop",
  MEDIA_ENCODER: "Media Encoder",
  SLACK: "Slack",
  TERMINAL: "Terminal",
  SUBLIME_TEXT: "Sublime Text",
  UPWORK: "Upwork",
  FINDER: "Finder",
  MINDBUNKER_SENSOR: "MindBunker Sensor",
  OTHER: "Other",
};

// ─── Window-title surface classification ──────────────────────────────────
// Section 9: WINDOW TITLE != APPLICATION. A browser tab titled "ChatGPT"
// does not make Safari's time ChatGPT's time -- it adds an optional,
// secondary SURFACE tag on top of the (unchanged) APP=SAFARI attribution.
// Deliberately narrow: only browsers get surface classification; a native
// app's own window title is not reinterpreted as a different surface.

export type SurfaceKey = "CHATGPT_WEB" | "CLAUDE_WEB" | "NOTION_WEB" | null;

const BROWSER_APPS = new Set<AppKey>(["SAFARI"]);

const SURFACE_KEYWORDS: Array<[RegExp, Exclude<SurfaceKey, null>]> = [
  [/chatgpt/iu, "CHATGPT_WEB"],
  [/claude/iu, "CLAUDE_WEB"],
  [/notion/iu, "NOTION_WEB"],
];

export function classifyWindowSurface(appKey: AppKey, windowTitle: string | null): SurfaceKey {
  if (!windowTitle || !BROWSER_APPS.has(appKey)) return null;
  for (const [pattern, surface] of SURFACE_KEYWORDS) {
    if (pattern.test(windowTitle)) return surface;
  }
  return null;
}

// ─── Interval utilities ────────────────────────────────────────────────────

export type Interval = { startedAt: number; endedAt: number };

function clamp(interval: Interval, windowStart: number, windowEnd: number): Interval | null {
  const start = Math.max(interval.startedAt, windowStart);
  const end = Math.min(interval.endedAt, windowEnd);
  return end > start ? { startedAt: start, endedAt: end } : null;
}

// Section 18: "observed coverage" -- the true union of monitored time, not
// a naive max-min span (which would overstate coverage across a real
// Sensor-offline gap) and not a naive sum (which would overstate it across
// overlapping/duplicated observation rows). Sort + merge is the standard,
// correct way to compute this and is cheap at current data volume (see
// Section 30 -- report the measured problem before reaching for anything
// more complex).
export function computeCoverageSeconds(
  intervals: readonly Interval[],
  windowStart: number,
  windowEnd: number,
): number {
  const clamped = intervals
    .map((interval) => clamp(interval, windowStart, windowEnd))
    .filter((interval): interval is Interval => interval !== null)
    .sort((a, b) => a.startedAt - b.startedAt);
  let total = 0;
  let mergedStart: number | null = null;
  let mergedEnd = 0;
  for (const interval of clamped) {
    if (mergedStart === null) {
      mergedStart = interval.startedAt;
      mergedEnd = interval.endedAt;
      continue;
    }
    if (interval.startedAt <= mergedEnd) {
      mergedEnd = Math.max(mergedEnd, interval.endedAt);
    } else {
      total += mergedEnd - mergedStart;
      mergedStart = interval.startedAt;
      mergedEnd = interval.endedAt;
    }
  }
  if (mergedStart !== null) total += mergedEnd - mergedStart;
  return total;
}

// ─── Observed vs. Intentional app time ─────────────────────────────────────

export type AppObservationRow = {
  appKey: AppKey;
  surface: SurfaceKey;
  startedAt: number;
  endedAt: number;
  idle: boolean;
};

export type AppTimeTotal = {
  appKey: AppKey;
  surface: SurfaceKey;
  seconds: number;
};

// OBSERVED ACTIVE APP TIME: active (non-idle) foreground observations,
// clamped to the window, grouped by (appKey, surface). Answers "during
// active computer use, how much time was X foreground" -- independent of
// whether any intentional session was open. Mirrors the exact
// MIN(ended,end)-MAX(started,start) clamping getSensorDashboard's own
// Screen/Active/Idle Time totals already use, so this never disagrees
// with those numbers about what "active" means.
export function aggregateObservedAppTime(
  observations: readonly AppObservationRow[],
  windowStart: number,
  windowEnd: number,
): AppTimeTotal[] {
  const totals = new Map<string, AppTimeTotal>();
  for (const row of observations) {
    if (row.idle) continue;
    const clamped = clamp({ startedAt: row.startedAt, endedAt: row.endedAt }, windowStart, windowEnd);
    if (!clamped) continue;
    const key = `${row.appKey}|${row.surface ?? ""}`;
    const existing = totals.get(key);
    const seconds = clamped.endedAt - clamped.startedAt;
    if (existing) existing.seconds += seconds;
    else totals.set(key, { appKey: row.appKey, surface: row.surface, seconds });
  }
  return Array.from(totals.values()).sort((a, b) => b.seconds - a.seconds);
}

export type IntentionalIntervalRow = {
  contextType: "CLIENT" | "LEAD" | "INTERNAL" | "ADMIN";
  startedAt: number;
  endedAt: number;
};

export type AppIntentionalTotal = AppTimeTotal & {
  byContext: Partial<Record<IntentionalIntervalRow["contextType"], number>>;
};

// INTENTIONAL APP TIME: active app observations intersected with
// intentional Sensor session intervals (ALL four contexts -- a CLIENT
// session's interval is the same physical interval whether or not it is
// later approved into a canonical Work Session; approval never creates a
// second interval, so there is no double-count risk here by construction,
// see Section 14). Answers "during recorded intentional work, how much
// time did X occupy." O(observations x sessions) is intentionally simple
// -- correct at current data volume; see Section 30 before reaching for
// anything smarter.
export function aggregateIntentionalAppTime(
  observations: readonly AppObservationRow[],
  sessions: readonly IntentionalIntervalRow[],
  windowStart: number,
  windowEnd: number,
): AppIntentionalTotal[] {
  const totals = new Map<string, AppIntentionalTotal>();
  for (const obs of observations) {
    if (obs.idle) continue;
    const obsClamped = clamp({ startedAt: obs.startedAt, endedAt: obs.endedAt }, windowStart, windowEnd);
    if (!obsClamped) continue;
    for (const session of sessions) {
      const overlapStart = Math.max(obsClamped.startedAt, session.startedAt);
      const overlapEnd = Math.min(obsClamped.endedAt, session.endedAt);
      if (overlapEnd <= overlapStart) continue;
      const seconds = overlapEnd - overlapStart;
      const key = `${obs.appKey}|${obs.surface ?? ""}`;
      let existing = totals.get(key);
      if (!existing) {
        existing = { appKey: obs.appKey, surface: obs.surface, seconds: 0, byContext: {} };
        totals.set(key, existing);
      }
      existing.seconds += seconds;
      existing.byContext[session.contextType] = (existing.byContext[session.contextType] ?? 0) + seconds;
    }
  }
  return Array.from(totals.values()).sort((a, b) => b.seconds - a.seconds);
}

// ─── Time windows ──────────────────────────────────────────────────────────
// Section 16/17: canonical windows, all in the app's existing
// America/Sao_Paulo reporting timezone (dayKeyFor/mondayOfWeek), never a
// naive UTC boundary. DAILY AVERAGE always divides by calendar days in
// the window, zero-use days included (Section 17) -- never only
// days-with-activity, which the UI does not currently claim to show.

export type TimeWindowKind = "TODAY" | "LAST_3_DAYS" | "LAST_7_DAYS" | "LAST_WEEK" | "THIS_MONTH" | "MONTH";

export type ResolvedWindow = {
  startSeconds: number;
  endSeconds: number;
  days: number;
  label: string;
};

const SP_OFFSET_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

// Local calendar midnight (America/Sao_Paulo) for a given day-key, as a
// Unix-seconds boundary -- derived from Intl's own offset for that instant
// rather than a hardcoded UTC-3 constant, so a DST-observing future
// timezone change would not silently misalign this by an hour.
function localMidnightSeconds(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 12, 0, 0); // noon UTC, safely inside the target local day
  const parts = SP_OFFSET_FORMATTER.formatToParts(new Date(utcGuess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const localNoon = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = utcGuess - localNoon;
  return Math.floor((Date.UTC(y, m - 1, d, 0, 0, 0) + offsetMs) / 1_000);
}

function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function resolveTimeWindow(
  kind: TimeWindowKind,
  nowIso: string,
  monthKey?: string, // required + used only for kind === "MONTH", format YYYY-MM
): ResolvedWindow {
  const todayKey = dayKeyFor(nowIso);
  const nowSeconds = Math.floor(Date.parse(nowIso) / 1_000);

  if (kind === "TODAY") {
    const start = localMidnightSeconds(todayKey);
    return { startSeconds: start, endSeconds: nowSeconds, days: 1, label: "Today" };
  }
  if (kind === "LAST_3_DAYS" || kind === "LAST_7_DAYS") {
    const days = kind === "LAST_3_DAYS" ? 3 : 7;
    const start = localMidnightSeconds(shiftDayKey(todayKey, -(days - 1)));
    return { startSeconds: start, endSeconds: nowSeconds, days, label: kind === "LAST_3_DAYS" ? "Last 3 days" : "Last 7 days" };
  }
  if (kind === "LAST_WEEK") {
    const thisMonday = mondayOfWeek(todayKey);
    const lastMonday = shiftDayKey(thisMonday, -7);
    const start = localMidnightSeconds(lastMonday);
    const end = localMidnightSeconds(thisMonday);
    return { startSeconds: start, endSeconds: end, days: 7, label: "Last week" };
  }
  if (kind === "THIS_MONTH") {
    const firstOfMonth = `${todayKey.slice(0, 7)}-01`;
    const start = localMidnightSeconds(firstOfMonth);
    const dayOfMonth = Number(todayKey.slice(8, 10));
    return { startSeconds: start, endSeconds: nowSeconds, days: dayOfMonth, label: "This month" };
  }
  // MONTH: specific YYYY-MM, full calendar month regardless of "now".
  const key = monthKey ?? todayKey.slice(0, 7);
  const firstOfMonth = `${key}-01`;
  const [y, m] = key.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstOfNextMonth = shiftDayKey(`${key}-01`, daysInMonth);
  const start = localMidnightSeconds(firstOfMonth);
  const naturalEnd = localMidnightSeconds(firstOfNextMonth);
  // A past, fully-elapsed month uses its own real boundary; the current
  // (or a future) month is capped at "now" the same way THIS_MONTH is.
  const end = naturalEnd > nowSeconds ? nowSeconds : naturalEnd;
  return { startSeconds: start, endSeconds: Math.max(start, end), days: daysInMonth, label: key };
}

export function dailyAverageSeconds(totalSeconds: number, days: number): number {
  if (days <= 0) return 0;
  return totalSeconds / days;
}
