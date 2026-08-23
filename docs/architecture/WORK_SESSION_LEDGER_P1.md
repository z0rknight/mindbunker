# MindBunker — Work Session Ledger P1

Date: 2026-08-23
Scope: Sprint 1.2.1 — Work Session Ledger + Human Dogfooding Round 1
Status of this document: implementation report + design brief, for human review before the Aug 23–28 dogfooding week begins.

This round evolves MindBunker's Work Session timer into a trustworthy operational time ledger, based on a real dogfooding session performed by Emmanuel on 2026-08-23 (`meu fluxo registro 23 ago 26.pdf`, 14 pages). Per Emmanuel's own framing for this round: **the ledger stops lying by omission first; the sensor goes underneath it later.** Nothing in this round implements a desktop sensor, an activity observer, or any form of automatic capture — those are designed (§9–§11) but explicitly deferred (§13).

---

## 1. Current architecture (before this round)

Verified directly against the repository, not against prior reports (per this round's own "code is authority" instruction).

**Schema (`src/db/schema.ts`, `work_sessions` table, pre-round):** `id`, `video_id` (FK → `video_logs.id`, `onDelete: restrict` — the only hard-blocking FK in the schema), `started_at`, `ended_at` (nullable — null means open), `activity_type` (CHECK-constrained enum: EDITING / MOTION_GRAPHICS / COLOR / AUDIO / REVIEW / EXPORT / ADMIN / OTHER, default EDITING), `note`, `created_at`. Two structural invariants enforced at the database level, not in application code: `work_sessions_one_open_idx`, a partial unique index on `(1) WHERE ended_at IS NULL`, guarantees **at most one open session can exist globally**; `work_sessions_ended_after_started_check` guarantees a closed session's `ended_at` is always strictly after `started_at`.

**Module (`src/modules/work-sessions/`):** `core.ts` held pure types, validators, and hand-written SQL constants (`START_WORK_SESSION_SQL`, `STOP_WORK_SESSION_SQL`, `WORK_SESSION_OVERVIEW_SQL`, `VIDEO_WORK_SESSION_SUMMARY_SQL`, `OPEN_WORK_SESSION_SQL`). `data.ts` held read functions (`getWorkSessionOverview`, `getVideoWorkSessionState`, `videoClosedSeconds`). `actions.ts` held exactly two Server Actions: `startWorkSession(videoId, activityType)` and `stopWorkSession(videoId)`. Both mutation SQL statements are single UPDATE/INSERT...SELECT statements with WHERE-clause guards, not separate check-then-write pairs — deliberately, because D1 processes a database's statements one at a time and a separate check-then-write could race under concurrent requests.

**UI:** `WorkSessionPanel.tsx` (client component embedded in `/productivity`, one instance per video) rendered a Start/Stop button, a live `setInterval`-driven elapsed clock while a session on that video was open, and an "another video is active" notice when a different video's session was the one running. `/productivity/sessions` (pre-existing from an earlier round) rendered a flat, unfiltered, ungrouped list of every session ever recorded — no day/week structure, no correction, no distinction between active and completed beyond a status label.

**What did not exist before this round, confirmed by direct search of `work_sessions` reads/writes across the repo:** no field recording how or where a session was captured; no way to edit a completed session's data once written; no visibility into how long an open session had been running beyond the live clock (nothing flagged an abnormally long session); no day or week grouping on the history page; no audit trail for any Work Session mutation (unlike CRM stage changes, Gateway events, and Video Memory notes, which all write a `crm_events` row).

## 2. Dogfooding evidence

Source: `meu fluxo registro 23 ago 26.pdf`, Emmanuel's real production day on 2026-08-23, read in full.

The evidence that drove this round's design, condensed to what actually mattered for the ledger (not a transcript of the PDF):

- A single real editing block (Taryn / MINI SERIES) ran for roughly 1h51 with the activity logged once as `EDITING`, but the actual work inside that block moved across several genuinely different contexts — footage review, timeline cuts, a color pass, an export attempt — all invisible to MindBunker because the system only records what was declared at Start.
- The device that had the Work Session timer open was not always the device doing the work. Emmanuel described starting or checking a session from his phone while the actual editing happened on the Mac mini. **This is the load-bearing fact for the entire round**: it rules out ever inferring "what application was active" from which browser/device is driving the timer UI, because those two things are not the same fact.
- Sessions were tracked in parallel by three different systems this week: MindBunker's own timer, Upwork's own time tracker (for the Sean Go contract), and a handwritten paper log Emmanuel keeps by hand. These three don't agree with each other in general, and are not expected to — each measures something slightly different (declared intent vs. Upwork's own capture vs. a human's own handwritten memory).
- No session was ever left open by accident during this particular dogfooding day, but Emmanuel flagged it as a known risk from past experience (forgetting to stop a session across a sleep/wake cycle) worth designing for even though this round's own data doesn't reproduce it.

## 3. Failure modes identified

1. **`activity_type = EDITING` is too coarse for a real session.** A single declared activity cannot describe a 1h51 block that moved through review, cutting, color, and export. This is not a bug in the current code — `EDITING` was accurately declared — it's a resolution mismatch between what the ledger can express and what actually happened. The fix required by the brief is explicitly **not** "stop and restart the timer at every context switch" (that would trade one failure mode — coarse activity — for a worse one — an operator who spends more time managing the tracker than doing the work). The correct fix, confirmed by the brief's own instruction, is architectural: a human declares context once per session (unchanged this round — `activity_type` stays a closed, stable enum), and a future passive layer supplies finer-grained detail underneath it (§9–§11), correlated by timestamp rather than merged into the same field.
2. **The infinite-timer problem.** A session with no end time can run forever if never stopped. No occurrence in this round's own dogfooding data, but a known historical risk. Addressed in §7.
3. **No source/capture-method field existed.** Every session looked identical regardless of whether it was started reliably from the desktop or from a phone glancing at an already-running timer. Not fixable by inventing a value MindBunker cannot actually know (see the brief's explicit "do not invent device/source information" instruction) — fixable by adding a field that honestly records the one thing that is knowable: which capture path produced the row. Addressed in §5.
4. **No correction path for a wrong session.** A wrong client, wrong video, wrong start/end time, or wrong activity on a completed session had no safe fix short of a direct database edit. Addressed in §6.
5. **The Session History page had no information architecture.** A flat list of every session ever, in whatever order the query happened to return, does not answer "how much did I work this week" or "what did I do yesterday" without manual arithmetic. Addressed in §4/§8.

## 4. Implemented changes

All changes are additive. No existing Work Session row was altered, no destructive migration was written, and `startWorkSession`/`stopWorkSession`'s existing behavior and SQL are unchanged from before this round (verified: `START_WORK_SESSION_SQL` and `STOP_WORK_SESSION_SQL` are byte-for-byte the same as the pre-round versions).

**Schema** (`src/db/schema.ts`, migration `0014_first_shockwave.sql`, additive `ALTER TABLE ... ADD COLUMN`, applied and verified against a fresh local D1 instance — `PRAGMA table_info` confirms 9 columns, `PRAGMA foreign_key_check` confirms no integrity violation):

```sql
ALTER TABLE `work_sessions` ADD `source` text DEFAULT 'WEB_TIMER' NOT NULL;
ALTER TABLE `work_sessions` ADD `updated_at` integer;
```

`source` deliberately has **no CHECK constraint** — SQLite cannot `ALTER` a CHECK constraint without recreating the whole table, and this vocabulary (`WEB_TIMER` today; `MANUAL`, `IMPORTED`, and eventually a desktop-sensor-derived value later) is expected to grow. This mirrors the precedent already set for `clients.archivalState` in the Geladeira round. `activity_type`'s CHECK constraint is untouched — that vocabulary is closed and stable. `updated_at` is null for every row that has never been corrected; null is itself meaningful here (never touched), not a placeholder.

**`core.ts`** (rewritten, 522 lines) adds: `WORK_SESSION_SOURCES = ["WEB_TIMER"]` and `isWorkSessionSource()` (the single source of truth for the open vocabulary — `WEB_TIMER` is the only value any code path can currently produce, honestly); `isWorkSessionId()`; `STOP_WORK_SESSION_AT_SQL` (stops the open session at an operator-chosen past timestamp instead of "now" — reused by both the stale-session recovery flow and nothing else); `WORK_SESSION_BY_ID_SQL` and `CORRECT_WORK_SESSION_SQL` (§6); `validateSessionCorrection()` / `describeSessionCorrection()` (§6); `STALE_SESSION_WARNING_SECONDS` / `isSessionStale()` (§7); `groupWorkSessionsByDay()` / `groupWorkSessionDaysByWeek()` (§4/§8, timezone-correct grouping — see below); `WORK_SESSION_HISTORY_SQL` extended to select `source` and `updated_at`.

**`data.ts`** adds `getWorkSessionById()` (single-session read, used by the correction flow) and `getVideoOptionsForCorrection()` (a video picker for the correction UI, deliberately **not** filtered by Geladeira archival state — correcting which video a piece of already-performed work belongs to is fixing history, not choosing a destination for new work, so an archived client's videos must stay reachable here even though they're hidden from the Quick Actions selectors elsewhere in Productivity; capped at 300 most-recent videos, a documented scope limit rather than a silent one). `getWorkSessionOverview()` now computes `openSessionElapsedSeconds` and `openSessionStale` in the data layer rather than in a component render — this was required by React 19's `react-hooks/purity` lint rule (see §"Errors and fixes" note below), and has the honest side effect of making "is this session stale" a server-computed fact evaluated once per request, not a client-recomputed one.

**`actions.ts`** (rewritten, 309 lines) preserves `startWorkSession`/`stopWorkSession` unchanged and adds two new Server Actions: `stopWorkSessionAt(videoId, endedAtIso)` (§7) and `correctWorkSession(sessionId, input)` (§6).

**UI:** `WorkSessionPanel.tsx` gained a stale-session recovery panel (amber, appears only once a session crosses the 6-hour threshold, dismissible per-session) with "Still working — keep going" and "Correct end time" controls. `/productivity`'s global status banner now reads `openSessionStale` from the server and switches from emerald to amber accordingly, with its call-to-action text changing from "Open active workspace" to "Review this session." `/productivity/sessions` was rewritten from a flat list into a day → week grouped ledger (`WorkSessionHistoryTable.tsx`, new file, 336 lines) with inline per-session correction and an explicit provenance note ("every row below was captured via the MindBunker web timer... unless marked Corrected").

**Tests:** `core.test.mjs` rewritten (12 tests). `integration.test.mjs` extended with 7 new tests. Full module suite: **112/112 passing.**

## 5. Session Ledger model

Every field the brief asked for, and what backs it today:

| Field | Backing | Status |
|---|---|---|
| Start timestamp | `started_at` | unchanged, native |
| End timestamp | `ended_at` (nullable = open) | unchanged, native |
| Calculated duration | derived at read time (`ended_at - started_at`), never stored | unchanged, native |
| Client | derived via `video_id → video_logs.client_id` | unchanged, native |
| Project | derived via `video_id → video_logs.project_id` | unchanged, native |
| Video | `video_id` (required FK) | unchanged, native |
| Declared activity/context | `activity_type` (closed 8-value enum) | unchanged this round, deliberately — see §3.1 |
| Status | derived (`ended_at IS NULL` → OPEN, else CLOSED) | unchanged, native |
| Optional note | `note` | unchanged, native (now editable via correction — §6) |
| Creation timestamp | `created_at` | unchanged, native |
| Modification timestamp | `updated_at` (new, nullable) | **new this round** — set only by `correctWorkSession`, never by Start/Stop |
| Source / capture method | `source` (new, `WEB_TIMER` today) | **new this round**, honestly minimal — see below |

On `source` specifically, following the brief's explicit instruction not to invent what the system cannot know: MindBunker today has exactly one way a Work Session row is created — a browser calling `startWorkSession` through the web UI. It does not know, and this round does not pretend to know, which physical device that browser was running on, whether it was a phone or the Mac mini, or anything about what application was active elsewhere. So `source` currently records exactly one honest fact — "this row came from the web timer, not an import or a manual backfill" — and no more. The column exists now, with an open vocabulary, so that when a real second source arrives (a manual historical entry, an eventual desktop-sensor-derived row), it has somewhere to record that difference without a schema change. Today, every single row in the table has the same `source` value, and this document says so rather than dressing up a single-value column as more device-awareness than it has.

## 6. Correction semantics

**What can be corrected:** video, start time, end time, activity type, and note — on a **closed** session only. `CORRECT_WORK_SESSION_SQL`'s own WHERE clause (`ended_at IS NOT NULL`) makes the currently-open session structurally unreachable by this path; there is no separate application check standing between "open" and "editable" that could be bypassed or forgotten.

```sql
UPDATE work_sessions
SET video_id = ?2, started_at = ?3, ended_at = ?4, activity_type = ?5, note = ?6, updated_at = ?7
WHERE id = ?1
  AND ended_at IS NOT NULL
  AND ?4 > ?3
  AND EXISTS (SELECT 1 FROM video_logs WHERE id = ?2)
RETURNING id, video_id, started_at, ended_at, activity_type, note, updated_at
```

**Validation** (`validateSessionCorrection()`, pure and independently unit-tested): rejects an invalid video or activity type; rejects unparseable dates; rejects `endedAt <= startedAt` (no negative or zero duration); rejects an end time in the future; rejects a corrected session longer than 14 days (a sanity backstop against a fat-fingered year, not a hard product rule — flagged in the code as exactly that); rejects a note over 2,000 characters.

**What "operational history must not silently mutate" means here, concretely:** the row's own current values do change in place (this is not an event-sourced system, and the brief explicitly asked not to build one — "we need trustworthy records, not NASA Mission Control"). What does not happen silently is the *fact that a correction occurred*. Following the existing house pattern — `crm_events` already serves as the single overloaded audit table for CRM history and Video Memory notes — every correction that actually changes a field writes one `crm_events` row (`type: "work_session.corrected"`, `actor: "admin"`) with a human-readable description built by `describeSessionCorrection()`, e.g. `Work Session #142 corrected: start 2026-08-23T14:02:00.000Z → 2026-08-23T13:55:00.000Z; activity EDITING → COLOR`. The description only names fields that actually changed — correcting only a note doesn't falsely claim the video or times moved too. This is deliberately the smallest mechanism that fits: no separate `work_session_corrections` table, no before/after snapshot columns, no versioning. The pre-correction values live in exactly one place — the `crm_events.description` text — which is sufficient for "was this session ever corrected, and roughly what changed," and insufficient for anything resembling forensic replay. That tradeoff is intentional and matches the brief's own "trustworthy, not NASA Mission Control" instruction; it is not a gap this round failed to notice.

**What reassigning the video on a correction does and doesn't do:** the `crm_events` row is filed against the session's *new* video's client (via a fresh lookup after the correction succeeds), not the old one — so a correction that fixes "I logged this against the wrong client's video" shows up in the corrected client's timeline, which is where a human reviewing that client's history would look for it.

## 7. Stale-session semantics

The brief asked for an explicit evaluation of options A–D (long-session warning / stale-session recovery / maximum-duration protection / no automatic intervention) and a recommendation based on minimal interference. What was implemented:

**Chosen model: A layered warning + recovery, no automatic intervention, no hard cap.**

- **(A) Long-session warning — implemented.** `STALE_SESSION_WARNING_SECONDS = 6 hours`. Once an open session crosses this threshold, both the per-video panel and the global `/productivity` banner switch to an amber "stale" visual state. 6 hours is a starting heuristic, documented in the code as exactly that (not a law): long enough that a normal editing block won't trip it even on a long day, short enough to plausibly catch "forgot to press Stop before sleep." It is expected to be tuned from real data gathered during the Aug 23–28 dogfooding week (§14), not treated as final.
- **(B) Stale-session recovery — implemented, as "Keep going" / "Correct end time."** The amber panel offers exactly two actions, both human-driven: **"Still working — keep going"** dismisses the warning for that session (it can reappear if the session keeps running and the operator later wants to check it again — dismissal is a per-render UI state, not a persisted "never warn me again" flag) and **"Correct end time"** opens a `datetime-local` picker (capped at "now" — cannot pick a future time) and calls the new `stopWorkSessionAt(videoId, endedAtIso)` action, closing the session at the chosen past timestamp instead of "now."
- **(C) Maximum-duration protection — not implemented, deliberately.** The brief asked for this to be justified by actual data before being built. This round's own dogfooding data contains zero forgotten-session incidents (the longest real block was 1h51). Inventing an automatic cutoff on zero observed occurrences would risk corrupting a real, unusually long editing day the same way the failure it's meant to prevent would — the difference between "silently truncated at some invented ceiling" and "silently left open forever" is not obviously an improvement. This is one of the two items flagged for revisiting only if the Aug 23–28 week actually produces a forgotten-session incident (§13).
- **(D) No automatic intervention — the load-bearing principle, not a rejected option.** Nothing in this implementation ever closes, truncates, or otherwise mutates a session without the operator pressing a button. The system makes the anomaly *visible* (amber banner, amber panel, elapsed time called out explicitly); it never *acts* on the operator's behalf.

**Why `stopWorkSessionAt` is not logged as a correction:** it is the session's *first* close, not an edit of an already-closed row. Pressing "Stop" with a chosen past time and pressing "Stop" with the implicit "now" are equally authoritative first-time closes — the distinction the `crm_events` audit trail exists to capture is "this record changed after being finalized," which doesn't apply here. `STOP_WORK_SESSION_AT_SQL` shares `STOP_WORK_SESSION_SQL`'s exact guard shape (only affects the row that is still open for this video, end time must be after start time), just parameterized on a chosen end timestamp instead of `now()`.

## 8. Productivity information hierarchy

The brief asked what `/productivity` should actually answer, and to recommend the smallest useful hierarchy rather than filling the page with dashboards merely because metrics exist.

**What `/productivity` (the daily-driver page) should answer, in priority order:**
1. What am I doing right now, and is it healthy? (the global status banner — now stale-aware, §7)
2. Per video I'm actively working across: tracked time and session count, Start/Stop.
3. Nothing else — no weekly rollups, no by-client breakdowns, no historical comparison belong on this page. It exists to be looked at during work, not to be analyzed after it.

**What `/productivity/sessions` (the ledger/reference page, this round's main UI change) should answer:**
1. What did I actually do today, and this week? — **implemented this round** via `groupWorkSessionsByDay()` → `groupWorkSessionDaysByWeek()`, rendered as week sections containing day sections containing individual session rows, each with a running total. This directly mirrors the Upwork-like information architecture the brief asked for (chronological, daily grouping, weekly totals, individual session inspection, active-vs-completed distinction) **without cloning Upwork's visual design** — no timesheet grid, no colored bar charts, just the same three-level grouping expressed in MindBunker's own existing visual language.
2. Was anything logged wrong, and can I fix it without losing the record that it was wrong? — **implemented this round** via inline per-session correction (§6).
3. **Explicitly not implemented, and not recommended for this round:** by-client or by-project breakdowns, historical-era comparison (2024 reconstructed vs. 2025 vs. native 2026), or reconciliation against a future observed-activity stream. All three require data or correlation logic that doesn't exist yet (§9–§12), and adding placeholder UI for data MindBunker doesn't have yet would violate the same "do not manufacture data" instruction that shaped the `source` field. When the historical import (Sprint 1.2 P0, still never run against a real database — see the canonical map) and a future sensor both exist, a comparison view becomes possible; today it would just be an empty or misleading widget.

Net recommendation: two pages, two questions. `/productivity` answers "what's happening now." `/productivity/sessions` answers "what happened, and is it recorded correctly." Nothing forces a third page or a dashboard-style rollup into either.

## 9. Desktop Sensor boundary

Per Emmanuel's own explicit sequencing instruction — *"não peça o desktop tracker ainda"* — no sensor code, no capture agent, no window-title reading, and no automatic activity inference of any kind exists after this round. This section and §10–§11 are the contract a future round would build against, not a preview of partial implementation.

**The boundary this round protects, restated precisely:** `work_sessions` is, and must remain, the table of record for **declared intent** — a human said "I am working on X, doing Y, starting now." A future sensor observation is evidence **about** a Work Session, generated independently and correlated after the fact, never a Work Session itself and never a value written into `work_sessions`. Concretely, this means: no new column on `work_sessions` should ever hold a sensor-observed value (application name, window title, idle time); no future sensor write path should ever set `ended_at`, `started_at`, or `activity_type` on an existing `work_sessions` row; and the existing `source` column's open vocabulary is exactly wide enough to eventually record "this session's activity type was corrected based on sensor evidence, by a human, after review" (still a human action, still going through `correctWorkSession`) — never wide enough to let a sensor mutate a session unattended.

**Why this line matters given this round's own dogfooding evidence:** "the device displaying the timer is not necessarily the device performing the work" (§2) means a sensor watching the Mac mini and a Work Session started from a phone are not describing the same thing by default — they need to be correlated by time window, explicitly, with the mismatch visible when it happens, not quietly assumed away.

## 10. Proposed Activity Sensor contract (design only)

A minimal schema for a future local macOS collector, proposed for evaluation in a future round — nothing here is created by this round's migration.

```
activity_observations  (proposed name — deliberately not "work_sessions_v2"
                         or anything suggesting it replaces the ledger)
  id                  integer PK
  device_id           text NOT NULL      -- which machine captured this (e.g. "mac-mini-emmanuel")
  started_at           integer NOT NULL   -- unix seconds
  ended_at             integer NOT NULL   -- unix seconds; observations are always closed intervals,
                                           -- never open-ended the way a work_session can be
  application_name     text               -- nullable; null if capture was blocked by a privacy rule (§11)
  window_title          text              -- nullable; redacted/omitted per §11's rules far more often
                                           -- than application_name
  is_idle               integer (boolean) NOT NULL  -- AFK/idle state at capture time
  url_domain            text               -- nullable; domain-only, never a full URL (§11) — only
                                             -- populated once/if a future privacy decision permits it
  captured_at            integer NOT NULL  -- when the local collector wrote this row, distinct from
                                             -- started_at/ended_at (the observed interval)
```

**Explicitly separate from `work_sessions`.** No foreign key from `work_sessions` to this table and none in the other direction. Correlation is computed at read time by overlapping `[work_sessions.started_at, work_sessions.ended_at]` against `[activity_observations.started_at, activity_observations.ended_at]` for matching or plausible time windows — never a stored join, so a correlation is always a live computation over two independently-true tables, not a cached judgment that can drift from the underlying facts.

**Open questions this round deliberately leaves open, not resolved:** what happens to a correlation when a Work Session spans a gap in sensor data (laptop asleep, collector not running, collector not yet installed on a given device)? Given `work_sessions.started_at`/`ended_at` can now be corrected (§6) after this round, does an existing correlation need to be recomputed, or is a correlation always computed fresh from current values (favoring the latter — it avoids inventing a second place a stale value could live)? With one operator but potentially multiple machines, does `device_id` ever need to be a first-class dimension in the Session Ledger UI itself, or does it stay purely a `activity_observations`-side detail? None of these block this round's implementation; they are exactly the kind of decision a sensor-focused round should make with real correlation examples in hand, not in the abstract.

## 11. Privacy model (design only)

Required to exist *before* any capture code is written, per the brief. Proposed, not implemented:

- **Allowlist/blocklist for application capture.** Password managers and similar sensitive-category applications are excluded from capture entirely by name-match, not merely redacted after the fact — `application_name` and `window_title` should never be written for a blocklisted app, not written-then-hidden.
- **Local preprocessing before any row leaves the collecting device.** Redaction, allowlist filtering, and idle-state computation happen on-device; nothing resembling a raw OS-level event stream is proposed to leave the machine that captured it.
- **Window-title redaction by default.** `window_title` is the single highest-risk field (browser tab titles routinely contain personal or client-sensitive text). The proposed default is to capture `application_name` normally but treat `window_title` as opt-in per application, defaulting to null.
- **Domain-only URL capture, never a full URL.** If browser activity capture is ever enabled, `url_domain` only — no path, no query string, matching the same principle already enforced elsewhere in this codebase's own privacy rules (see the "never place personal or sensitive data in URL parameters" constraint this session already operates under).
- **Private/incognito exclusion.** Any browser window in a private/incognito state is excluded from capture outright, not just from title capture.
- **Retention policy.** Proposed as a bounded window (e.g. raw `activity_observations` rows aged out after N days, with only aggregated/correlated summaries retained past that point) rather than indefinite retention — not sized in this round, since no capture exists yet to size it against.
- **Raw vs. aggregated telemetry.** The schema in §10 is already the "aggregated" shape (one row per observed interval, not a raw keystroke/mouse-event stream) — a future round should not need to design a rawer layer underneath it; if one is ever needed, it should be even more clearly excluded from ever reaching MindBunker's own database.

None of this is implemented. It exists here so a future sensor round starts from a privacy posture already decided, rather than deciding it under the pressure of "the sensor already works, now what do we do about privacy" — the ordering the brief explicitly warned against ("do not implement invasive capture merely because technically possible").

## 12. Historical evidence boundary

MindBunker's native `work_sessions` table and the historical reconstructed evidence produced by the separate `rmedia-historical-data-lab` artifact (Upwork/Clockify/ActivityWatch, `historical_facts_v0.json` / `identity_map_v0.json` / `source_coverage_v0.json`, contract v0.1.0) remain fully unmerged after this round, exactly as before it. This was verified two ways: no query in the codebase joins `work_sessions` to any `hist_*` table (confirmed in the canonical map's own relationship audit), and this round added zero code that reads from or writes to the historical artifact's tables.

The artifact's own contract already states the rule this round's brief also insists on, independently and consistently: historical reconstructed evidence is tier 1 (derived, confidence-tagged, never a first-class MindBunker observation); a native `work_sessions` row is tier 3; nothing in the artifact should be written directly into `work_sessions`, and nothing this round did writes to it. The artifact's own hard rules are worth restating here because they bound what a *future* import round must respect once historical backfill actually begins: an `activitywatch_afk` fact marked `canonical: false` or `confidence: "EXPERIMENTAL"` must never become worked/active hours or a `work_sessions` row; Sean Go's Clockify `tracked_hours_upper_bound` must never be summed with `tracked_hours_confident`; no cross-source rate (Upwork revenue ÷ Clockify hours, or anything ÷ AFK hours) may ever be constructed; a `source_coverage_v0.json` month marked "UNKNOWN / NO SOURCE DATA" must never be treated as a confirmed zero.

Future era comparison, once it exists, must not imply uniform measurement quality across eras: 2024 (fully reconstructed, lower confidence), 2025 (stronger reconstructed evidence), 2026 (reconstructed + native, the year both this round's ledger and the historical artifact overlap), 2027 (expected to be primarily native). This round adds one new fact to that picture worth flagging forward: `work_sessions.source` now exists and is honestly single-valued (`WEB_TIMER` only) for every 2026 row produced so far — meaning even within the "native" era, there is currently no way to distinguish a manually-corrected native session (§6) from an original one at a glance in the raw data without also checking `updated_at`. A future comparison view should read both columns, not just lean on `source` alone.

## 13. Deferred work

Explicitly out of scope for this round, per the brief's own DESIGN ONLY list — not implemented, not started:

- macOS Activity Sensor / automatic window capture (contract proposed in §10, nothing built)
- OCR of Emmanuel's handwritten paper logs (paper remains a future evidence layer the architecture doesn't assume away, but no scanning/import code exists)
- Historical reconstruction import into MindBunker's own tables (the Sprint 1.2 P0 artifact and importer already exist from an earlier round and remain unrun against any real database — unchanged by this round)
- XP or gamification derived from tracked time
- EHR/profitability algorithms correlating time against revenue (§8's "worked time and revenue are never correlated" gap, restated from the canonical map, remains open)
- Automated billing
- Invasive telemetry of any kind

Two items from this round's own design were deliberately left as future decisions rather than resolved now, flagged for revisiting only if real data justifies it:

- **Maximum-duration protection (§7, option C).** Not built. Revisit only if the Aug 23–28 dogfooding week (or later use) actually produces a forgotten-open-session incident; building it against zero real occurrences would be inventing a rule to solve a problem that hasn't been observed.
- **A persisted "don't warn me about this session again" flag.** The current "Still working — keep going" dismissal is UI-local (per render), not stored, so a very long legitimate session could re-show the amber warning on a later page load. Not fixed this round because it's unclear yet whether that's actually annoying in practice or exactly the right behavior (a persistent reminder that a session is unusually long) — a dogfooding-week judgment call, not an oversight.

## 14. Human QA protocol — week of Aug 23–28, 2026

Seven tests, as specified. Each should be run for real, on real devices, not simulated where a real run is possible.

1. **Desktop-controlled session.** Start a session from the Mac mini's browser, work normally, stop it from the same browser. Confirms the baseline path is unaffected by this round's changes (it should be — `startWorkSession`/`stopWorkSession` are byte-identical to before).
2. **Mobile-controlled session.** Start a session from a phone, do the actual work on the Mac mini, stop the session from the phone. Confirms the single-open-session invariant and the elapsed-time display both hold correctly when the controlling device never touches the work itself — directly testing the round's central architectural claim (§2, §9).
3. **Cross-device.** Start from desktop, inspect progress from mobile mid-session, stop from mobile. Confirms state (`getVideoWorkSessionState`) is consistent across devices reading the same D1-backed session, not cached per-device.
4. **Browser closed.** Start a session, close the controlling browser entirely, do real work, reopen the browser, verify the elapsed clock reflects real wall-clock time since start (not time since the browser reopened). Confirms `elapsedSeconds` is computed from `started_at` to `now`, never from any client-side timer state that a closed tab would have lost.
5. **Forgotten session.** Deliberately leave a session open past the 6-hour `STALE_SESSION_WARNING_SECONDS` threshold (or manipulate a test session's `started_at` via direct D1 access if 6 real hours isn't practical mid-week) and confirm the amber stale-recovery UI appears on both the per-video panel and the global `/productivity` banner, and that both "Keep going" and "Correct end time" behave as designed (§7).
6. **Incorrect metadata.** Deliberately create a completed session with a wrong video, wrong times, or wrong activity, then correct it via `/productivity/sessions`. Confirm: the correction succeeds, the session's visible values update, `updated_at` is set, and a `work_session.corrected` `crm_events` row appears in the (new) video's client's timeline with an accurate description of what changed (§6).
7. **Real production block.** A genuine 1–2 hour Taryn/MINI SERIES (or equivalent real client work) editing block, tracked simultaneously in MindBunker, Upwork's own tracker, and the handwritten paper log. Per the brief's own framing: **the goal is not perfect equality between the three numbers** — it's understanding what each one actually measures. Record all three totals and any qualitative observation about where and why they diverge (MindBunker measures declared-active time between Start and Stop; Upwork measures whatever its own client captures; the paper log measures whatever Emmanuel chose to write down). This test's output feeds directly into whether `hist_facts`' existing tier-1 treatment of Upwork/Clockify data (§12) is calibrated correctly, without asserting the systems should ever be forced to agree.

## 15. Production migration / runbook

No production access or production D1 credentials exist in this session, consistent with every prior round in this project. Everything in this round — the migration, the local D1 verification (`PRAGMA table_info`, `PRAGMA foreign_key_check`), the full test suite, and the production/OpenNext builds — was run and verified against a local D1 instance and a local build only. **No production mutation happened, and none was attempted.**

When a human is ready to apply this to production, the runbook is exactly the two additive statements already generated and already verified locally:

```sql
ALTER TABLE `work_sessions` ADD `source` text DEFAULT 'WEB_TIMER' NOT NULL;
ALTER TABLE `work_sessions` ADD `updated_at` integer;
```

via `npx wrangler d1 migrations apply mindbunker --remote` (not `--local`), after reviewing this document. Both statements are pure additive `ALTER TABLE ... ADD COLUMN`s with a default on the `NOT NULL` column — no existing row's data is touched, no existing column is altered or dropped, and every currently-running query against `work_sessions` that doesn't reference the two new columns is unaffected. This is the same low-risk migration shape used for `clients.archivalState` in the Geladeira round.

---

## Regression suite — what was actually run this round

- `npm test` (112/112 module tests) — **pass**
- Local D1 migration chain (`drizzle-kit generate` → `wrangler d1 migrations apply --local` → `PRAGMA table_info` / `PRAGMA foreign_key_check`) — **pass, clean**
- `npx tsc --noEmit` (full repository) — **pass, zero errors**
- `git diff --check` — **pass** (one trailing-blank-line-at-EOF issue found and fixed in `integration.test.mjs`; re-verified clean and re-ran the full test suite afterward, still 112/112)
- `npm run build` (Next.js production build) — **pass** (required the same plain-filesystem-copy workaround as the Geladeira round: the mounted repo's FUSE layer rejects the delete calls Next's build finalization step needs, so the build was run from a `rsync`'d plain-filesystem copy, not in place — a device/tooling constraint, not a code defect)
- `npx opennextjs-cloudflare build` (OpenNext/Cloudflare Workers build) — **pass**, same copy
- Scoped ESLint (`npx eslint` limited to every file touched this round: `src/app/productivity`, `src/modules/work-sessions`, `src/db/schema.ts`) — **pass, zero errors**, after fixing two real React 19 lint violations during development (a `react-hooks/set-state-in-effect` violation, fixed by adjusting state during render instead of in a `useEffect`; a `react-hooks/purity` violation from calling `Date.now()` during a Server Component render, fixed by moving that computation into `getWorkSessionOverview()` in the data layer)
- Full-repository `npx eslint .` — **inconclusive, honestly reported rather than assumed clean.** This device's shell tooling in this session enforces a 45-second hard cap per command; a full-repo lint pass on this codebase does not reliably complete within that cap regardless of how it's invoked (background execution was attempted for this run and is still in progress at the time of writing this section — see the addendum note below if it completed before delivery). Scoped lint on every file this round touched is clean; the full-repo pass is an environment/tooling limitation of this session, not a known defect, and is reported as exactly that rather than silently assumed passing.

Two adversarial test-scenario requirements from the brief are addressed by existing, unmodified behavior rather than new tests this round: "archived/Geladeira clients remain excluded from current-work selectors" is pre-existing behavior from the Geladeira round, untouched here (the new `getVideoOptionsForCorrection()` deliberately does the opposite — includes archived clients' videos — for the reason explained in §5/§6, which is a different selector serving a different purpose, not a regression of the original rule); "historical facts never appear as native Work Sessions" is covered by the existing structural test `Historical module code never references work_sessions — the tier boundary is structural, not just convention`, which remains green.

## Final status

**WORK SESSION LEDGER P1 READY FOR HUMAN REVIEW**
