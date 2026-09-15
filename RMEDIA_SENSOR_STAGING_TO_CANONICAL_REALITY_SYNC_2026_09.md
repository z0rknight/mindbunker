# RMEDIA Sensor — Staging → War Room Live → Correct → Canonical Reality Sync
**Date:** 2026-09-15 · **Status: LIVE.**

---

## 1. Actual Prior Architecture

Archaeology confirmed the architecture the mission described already existed and was sound — nothing was bypassed:

`sensor_sessions` (staging, `approval_state`: PENDING/APPROVED/ARCHIVED/DELETED) → operator Approve (`approveSensorSession`) → exactly one `work_sessions` row (`source='MAC_SENSOR_APPROVED'`). Archive/Delete already existed for a PENDING row Emmanuel wants to dismiss without canonicalizing. Every one of these paths was already idempotent at the **database level**, not just by convention:

- `sensor_sessions_device_local_unique` (`sensor_device_id`, `local_session_id`) makes a retried Start a no-op that returns the existing row.
- `SENSOR_SESSION_STOP_SQL` re-queries and returns the already-stopped row on a repeat Stop.
- `work_sessions_sensor_local_unique` makes a retried Approve's `INSERT ... ON CONFLICT DO NOTHING` create zero new rows the second time, and `SENSOR_SESSION_APPROVE_MARK_SQL`'s own `WHERE approval_state IN ('PENDING','APPROVED')` lets the mark step re-run safely too. This was already covered by an existing test (`approve(); approve();` asserting exactly one canonical row) before this wave touched anything.

## 2. Local ↔ Remote Truth

Confirmed via the native `mindbunker-sensor` Swift repo (binary hash-matched against the installed `~/Applications/RMEDIA Sensor.app` to be certain it's the real source, not a stale prototype):

- **A. Does the native app already upload sensor_sessions remotely?** Yes — a real, durable HTTP client (`SyncClient.swift`), not local-only.
- **B. When does it upload?** Only on explicit user action (Start Work / Stop buttons) plus a 60-second sweep that retries anything still queued. **There is no heartbeat endpoint** — server or native — matching the server's own API surface (`start`/`stop`/`observations`/`catalog`, nothing else).
- **C/D. Sleep/quit/reconnect** — see §8.

## 3. Staging Lifecycle

Unchanged and reused exactly as-is: Start creates a PENDING row; Stop closes it; it stays PENDING until Emmanuel Approves, Archives, or (new this wave) edits it. No second Work Session path was created.

## 4. War Room Live Behavior

**New.** War Room now distinguishes three states on the Restaurant View editor station, not two:

- **Idle** — no open canonical session, no open Sensor recording.
- **WORKING** (cyan) — an open canonical `work_sessions` row. Unchanged from before.
- **SENSOR RECORDING** (amber, "not yet approved") — an open `sensor_sessions` row, with **no approval required to show it** — the activity is real Sensor state the instant it starts.

Precedence is explicit and tested both directions: a canonical open session always wins the display even if a Sensor recording is *also* open at the same time (a real possibility — they're independent tables) — never double-counted. Implemented via `getOpenSensorSessionOverview()` (mirrors `getWorkSessionOverview`'s exact shape and its own "elapsed computed once, in the data layer, never during render" rule) and `buildRestaurantActiveSession`'s new 5-argument precedence logic in `war-room/restaurant-core.ts`.

## 5. Approval Path

Unchanged (`approveSensorSession` / `archiveSensorSession` / `deleteArchivedSensorSession`, all pre-existing). Verified live: editing a session, then approving it, produced exactly one canonical Work Session with the corrected duration.

## 6. Correction Path

Unchanged. `correctWorkSession` (existing, `work-sessions/actions.ts`) remains the one path for fixing an already-canonical session — no second "Sensor correction" screen was built, per the mission's own explicit instruction. The new staging-side edit (`updateSensorSession`) reuses `validateSessionCorrection` from the same module **unchanged** — one validation rule for "what makes a session correction valid," staging or canonical.

## 7. Long-Session Findings

Production `sensor_sessions` today: 59 APPROVED, 1 ARCHIVED, 0 PENDING, max historical duration ≈5h10m — **nothing currently exceeds the 6h display threshold** in production. The ">6h" scenario in the mission is a real, confirmed *failure mode* (§8), not a currently-outstanding production row. A new read-only, display-only list on the Sensor page (`getLongSessionCandidates`, pure `selectLongSessionCandidates`) covers both `sensor_sessions` and `work_sessions` so it's ready the moment one appears — verified live with a seeded 10h local fixture (see §12).

## 8. Sleep/Reconnect Behavior

**Root cause of "10h sessions" confirmed, not guessed.** The native app's `NSWorkspace.willSleepNotification` handler (`SensorModel.swift`) only ever closes the passive `activity_observations` row — it never calls `stopWork()`/`stopSession()` on the open `intentional_sessions` row (the one that becomes `sensor_sessions` server-side). A laptop closed mid-edit and reopened hours later keeps that session open the entire time, exactly matching the symptom described.

Everything else here is solid and did **not** need building: `local_session_id` is a durable SQLite-backed UUID that survives restarts (no duplicate-start risk); network failures go into a real, ordered, retrying outbox (`sync_outbox`, start-before-stop ordering enforced) — not fire-and-forget; a force-quit leaves the session open locally, mirroring the server exactly, and resumes tracking (not a duplicate) on next launch. Per mission §11, no new local retry queue was built because a solid one already exists.

**Native fix not applied this wave.** The `mindbunker-sensor` repo currently has ~410 lines of unrelated, substantial, clearly-intentional **uncommitted** work in progress (an "operational contexts" feature — Client/Lead/Internal/Admin — referencing a separate `MISSION_B_REQUIREMENTS.md`) touching the exact same files (`SensorModel.swift`, `Database.swift`, tests, docs) the sleep fix would need to touch. Per this session's git-safety obligations, that in-progress work was not read further than necessary to confirm it's unrelated, not touched, and not committed over. The precise, minimal fix is identified and ready (mirror the existing `willPowerOffNotification`/`willTerminateNotification` pattern: also stop the open intentional session on sleep, not just the observation) but is deferred to when that other work is reconciled, rather than risk an entangled commit in a repo this session doesn't have full context on.

## 9. Idempotency

Covered by the pre-existing test (`approve(); approve();` → 1 row) plus this wave's additions: a retried edit on an already-approved or still-open session is rejected outright (`SENSOR_SESSION_UPDATE_SQL`'s own `WHERE approval_state='PENDING' AND ended_at IS NOT NULL` guard) rather than silently corrupting canonical history.

## 10. Tests

17 new tests across 3 files:

| File | New tests |
|---|---|
| `sensor/core.test.mjs` | 7 — long-session selection: under-threshold excluded, over-threshold flagged, open-session never editable, approved-not-editable, canonical always approved=true, combined+sorted, exact-math no truncation |
| `sensor/integration.test.mjs` | 5 — edit persists correction, edit rejected on open session, edit rejected on approved session, cross-client approval isolation + zero billing-table writes, `OPEN_SENSOR_SESSION_SQL` reflects open→stopped transition |
| `war-room/restaurant-core.test.mjs` | 3 — SENSOR_RECORDING surfaces when no canonical session is open, canonical always wins precedence over a simultaneous Sensor recording, full `buildRestaurantViewModel` composition surfaces it correctly |

| Gate | Result |
|---|---|
| `git diff --check` | clean |
| `npm test` | **1135/1135 pass** |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 errors (3 pre-existing unrelated warnings) — one real `react-hooks/purity` error was caught and fixed (moved `Date.now()` out of the page component into the data layer, matching `getWorkSessionOverview`'s own established pattern) |
| `npm run build` | succeeds |
| `rm -rf .next .open-next` + fresh build | succeeds, `basePath: /mindbunker` confirmed |
| `npx opennextjs-cloudflare build` | succeeds |

## 11. Operator Deploy

| | |
|---|---|
| Pre-deploy version | `a0585805-39ea-4e05-8fdc-b422c39c58ce` |
| **New version** | **`8dac1809-262d-4a21-a862-947496ffed02`** |
| Traffic | 100% |
| Client Worker | not touched, not redeployed |

## 12. Sensor Build

Not built/deployed this wave — the fix was identified but deliberately not applied (§8). No native app change shipped.

## 13. Live Journey

Full journey run against a disposable local fixture (never production):

1. Seeded a 10h PENDING, stopped `sensor_sessions` row ("Mac slept mid-session, forgot to stop") → Sensor page correctly showed it in both the Inbox and the new **Long session review** section (`10h 0m · STAGING · editable`).
2. Opened the session detail page → clicked **Edit before approving** → corrected the end time to a real 30-minute window → **Save** → duration updated to `30m`, state stayed PENDING, long-session flag disappeared (no longer over threshold).
3. Clicked **Approve** → "Approved as Work Session #9" with the corrected 30m duration, not the fabricated 10h.
4. Seeded a separate **open** `sensor_sessions` row (no `ended_at`) → War Room's editor station immediately showed **SENSOR RECORDING** (amber), correct client/video, a live elapsed counter, "NOT YET APPROVED" — with no approval step required.
5. While that Sensor recording was still open, also opened a canonical `work_sessions` row on a *different* video → War Room correctly switched to **EDITING** (cyan, canonical) for the new session — the Sensor recording was not shown, not double-counted, exactly matching the precedence rule.
6. All fixture rows (2 sensor devices, 3 sensor_sessions, 1 approved work_session, 1 canonical work_session) deleted afterward — confirmed local DB back to zero rows in every touched table. **No production data was read from or written to at any point in this journey.**

## 14. Billing Safety

Verified two ways: (a) a dedicated integration test creates `billing_evidence`/`billing_allocations`/`transactions`/`payment_requests` tables alongside the sensor fixture and asserts all four stay at zero rows after an ordinary approval; (b) by construction — `approveSensorSession` and `updateSensorSession` touch only `sensor_sessions` and `work_sessions`, nothing else. Sensor activity, once approved, is exactly as billable (or not) as any other `work_sessions` row was already — this wave changed nothing about that boundary.

## 15. Remaining Gaps

- **Native sleep-bug fix** — identified precisely, not applied (§8). This is the actual next step to fully close the "10h session" story at the source; the review/edit safety net built this wave means it's no longer a two-day archaeology problem in the meantime, just a few clicks.
- **UTM/query-param prefill, favicon, System Brief rewrite** — unrelated carryover items from prior waves, untouched here.
- Nothing else was started outside this mission's scope: no new module, no second approval workflow, no Sensor→billing automation.

---

## Final Structured Output

```
SENSOR CONNECTIVITY: GREEN
LOCAL → REMOTE STAGING: GREEN
WAR ROOM SENSOR RECORDING: GREEN
STAGING REVIEW: GREEN
EDIT BEFORE APPROVAL: GREEN
APPROVAL → WORK SESSION: GREEN
DUPLICATE PROTECTION: GREEN
SESSION CORRECTION: GREEN

LONG SESSION CANDIDATES: 0 (production today; feature verified live against a seeded local fixture)

BILLING SIDE EFFECT: NONE

MIGRATIONS: NONE
CLIENT DEPLOY: NONE
OPERATOR DEPLOY: 8dac1809-262d-4a21-a862-947496ffed02
SENSOR BUILD: NONE (fix identified, deliberately deferred -- see §8)
```

**FINAL VERDICT:**

**YELLOW — Sensor activity is live, reviewable, and canonical when approved; the one remaining gap is the native sleep fix itself.** Every web-side piece of this mission is done and live: War Room shows real Sensor activity the instant it starts, a forgotten/wrong staged session is editable before it ever becomes history, approval is exactly as idempotent as it always was, and nothing here touches billing. The root cause of "10h sessions" is now precisely understood and located in the native app's sleep handler — but that fix was deliberately not applied this wave because the native repo has unrelated, substantial, uncommitted work in progress this session should not risk entangling. That's the exact remaining gap: a small, well-scoped native patch, ready to land once that other work is reconciled.

STOP.
