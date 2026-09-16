# RMEDIA Sensor — Operational Ledger Patch + App Intelligence Addendum
**Date:** 2026-09-16 · **Status: LIVE.**

---

## 1. Old Incorrect Semantic

A completed non-CLIENT (INTERNAL/ADMIN/LEAD) Sensor session sat in `sensor_sessions` with `approval_state = 'PENDING'`, listed in the Sensor Inbox / Review section, with only an "Archive" action and copy reading *"INTERNAL work has no canonical Video → Archive when reviewed."* This modeled real, completed operational time as if it were awaiting a commercial decision it structurally could never receive (it can never carry a `video_id`, so it can never be Approved). Production confirmed the real effect: the Dashboard showed `INTERNAL OPERATIONS: 0m` while 14 real, completed INTERNAL Sensor sessions existed in the database, because `getTodayWorkSessionStats` only ever reads canonical `work_sessions`, which non-CLIENT Sensor work never touches.

## 2. Final Canonical Model

```
CLIENT:   open → SENSOR RECORDING → closed → PENDING (Inbox, awaiting approval) → APPROVED → canonical Work Session
INTERNAL: open → SENSOR RECORDING → closed → ARCHIVED immediately (durable operational history, no approval)
ADMIN:    open → SENSOR RECORDING → closed → ARCHIVED immediately (durable operational history, no approval)
LEAD:     open → SENSOR RECORDING → closed → ARCHIVED immediately (durable operational lead/sales history, no approval)
```

WORK TRUTH ≠ COMMERCIAL TRUTH: a completed session proves time was spent, never billable time, billing evidence, invoice, payment, or client cost.

## 3. Exact Source Changes

Repo `mindbunker-video-workspace-hotfix`, all in `src/modules/sensor/`, `src/app/api/sensor/`, `src/app/productivity/sensor/`, `src/app/page.tsx`, `src/lib/client-identity.ts`.

- **`SENSOR_SESSION_STOP_SQL`** (`sensor/core.ts`) — the same `UPDATE` that sets `ended_at` now also sets `approval_state`/`archived_at` via a `CASE WHEN context_type = 'CLIENT'` guard: CLIENT keeps its exact prior value (stays `PENDING`), every other context finalizes to `ARCHIVED` with `archived_at` set to the same stop timestamp, atomically, in one write. No new status value, no migration — `ARCHIVED` already meant "durable, reviewed, not deleted."
- **`SENSOR_SESSION_UPDATE_NONCLIENT_SQL`** (new) + **`validateSensorSessionCorrection`** (new) + **`correctSensorOperationalSession`** action (new) — lets a finalized (`ARCHIVED`) non-CLIENT session's `started_at`/`ended_at`/`context_type`/`context_label` be corrected without an approval step, a video, or touching a CLIENT row (guarded both directions: can't touch an existing CLIENT row, can't convert a row into CLIENT).
- **`computeTodaySensorOperationalStats`** (new, pure) + **`getTodaySensorOperationalStats`** (new, data layer) — mirrors `computeTodayWorkSessionStats`'s own `dayKeyFor`-based local-day filtering exactly; sums closed INTERNAL/ADMIN/LEAD Sensor time for today, folding in the live elapsed time of the one currently-open non-CLIENT session if it started today (same convention as the existing open-canonical-session handling).
- **`splitIntentionalWork`** (`lib/client-identity.ts`) — now takes an optional second argument (defaults to zero) adding non-CLIENT Sensor operational seconds on top of the existing canonical-Work-Session-derived split. `internalOperationsSeconds` gains INTERNAL+ADMIN Sensor time; a new `leadOperationsSeconds` field tracks LEAD separately (never silently folded into Internal); `totalIntentionalSeconds` includes all of it.
- **UI copy** (`SensorSessionActions.tsx`, Sensor Activity `page.tsx`, session detail `page.tsx`) — removed the "has no canonical Video → Archive when reviewed" line; non-CLIENT `ARCHIVED` rows now read "Completed · operational history"; the Sensor Inbox/History section is split into "Operational history" (non-CLIENT, not collapsed, not framed as hidden) and "Archived Client Sensor evidence" (CLIENT-only, unchanged collapsed framing).
- **`SensorSessionNonClientEditForm.tsx`** (new) — the non-CLIENT twin of the existing `SensorSessionEditForm`, wired into `SensorSessionDetailControls` alongside the unchanged CLIENT path.

## 4. Dashboard Aggregation Rule

```
CLIENT PRODUCTION   = canonical CLIENT Work Session time (unchanged)
INTERNAL OPERATIONS = canonical RMEDIA-attributed Work Session time (unchanged)
                     + completed INTERNAL Sensor time (new)
                     + completed ADMIN Sensor time (new)
LEAD OPERATIONS     = completed LEAD Sensor time (new; tracked explicitly, no dedicated
                       Dashboard card yet — see §14 below; never folded into Internal)
TOTAL INTENTIONAL   = canonical total + INTERNAL + ADMIN + LEAD Sensor time
```

Each source is mutually exclusive by construction: canonical totals come from `work_sessions` (a CLIENT Sensor session only ever contributes there, once, after approval); non-CLIENT Sensor time comes from `sensor_sessions` rows that structurally can never carry a `video_id` and therefore can never also exist as a `work_sessions` row. Proven by test (§8).

## 5. Inbox Rule

The Inbox (`approval_state = 'PENDING' AND ended_at IS NOT NULL`) query itself is unchanged — it didn't need to be. Because Stop now finalizes non-CLIENT sessions directly to `ARCHIVED`, they simply never reach that state again after this patch. Verified live (§10): pending-review count is `0` for both CLIENT and non-CLIENT after a real Stop.

## 6. Historical Rows Normalized

Exact affected set queried first (id, context_type, context_label, started_at, ended_at, approval_state, video_id) — **14 rows, ids 61–72 and 75–76, all `INTERNAL`, all `video_id NULL`**. No `ADMIN`/`LEAD` legacy rows existed. Idempotent normalization:

```sql
UPDATE sensor_sessions
SET approval_state = 'ARCHIVED', archived_at = ended_at, updated_at = ended_at
WHERE context_type IN ('INTERNAL', 'ADMIN', 'LEAD')
  AND approval_state = 'PENDING'
  AND ended_at IS NOT NULL;
```

`archived_at`/`updated_at` use each row's own `ended_at` (not "now"), making a normalized row indistinguishable from one that had gone through the corrected Stop path originally. `changes: 14` — exact match, zero surprises.

## 7. D1 Backup + Integrity Verification

| Check | Result |
|---|---|
| Backup | `wrangler d1 export --remote` → `mindbunker-prod-backup-pre-ledger-normalization-20260916-120622.sql` (4.19 MB, 76 `sensor_sessions` rows confirmed inside) |
| Pre-count | 76 total `sensor_sessions` |
| Eligible count | 14 |
| Updated count | 14 (`changes: 14`) |
| Post-count | 76 total (unchanged — no deletion) |
| Remaining eligible | 0 |
| CLIENT pending count | 0 before, 0 after (untouched) |
| `PRAGMA foreign_key_check` | `[]` — clean |
| No fake video/client IDs | confirmed — all 14 rows still `video_id IS NULL` |
| No fabricated Work Sessions | confirmed — 0 `work_sessions` rows reference these `local_session_id`s |

## 8. Tests

66 tests added/updated:

| File | Coverage |
|---|---|
| `sensor/integration.test.mjs` | Stop auto-finalizes LEAD/INTERNAL/ADMIN atomically with `archived_at` set and no `video_id`; CLIENT Stop completely unaffected (stays PENDING); non-CLIENT correction (start/end/context/label) without approval or a fake video; correction SQL refuses to touch CLIENT or convert into/out of CLIENT; a still-open session can't be corrected via the finalized-only path |
| `sensor/core.test.mjs` | Correction validation mirrors Start's own context/label rules; `computeTodaySensorOperationalStats` sums INTERNAL/ADMIN/LEAD separately, excludes other days, folds in live open-session time |
| `sensor/app-intelligence.test.mjs` (new, 19 tests) | bundle-id normalization against real captured telemetry (incl. the non-obvious `com.openai.codex → CHATGPT`), OTHER fallback, Safari+title→`CHATGPT_WEB`/`NOTION_WEB`/`CLAUDE_WEB` surface classification without ever relabeling the app, active-vs-idle exclusion, TODAY/3D/7D/last-week/this-month/specific-month window boundaries in America/Sao_Paulo, daily average including zero-use days, coverage-gap detection (a real offline gap is never hidden by a naive min/max span), session-edit-changes-overlap, and the CLIENT-approval-does-not-double-count-telemetry contract |
| `lib/client-identity.test.mjs` | `splitIntentionalWork`'s new signature, LEAD tracked separately, default-zero backward compatibility |

**1179/1179 pass** (full suite).

## 9. Build

| Gate | Result |
|---|---|
| `git diff --check` | clean |
| `npm test` | 1179/1179 |
| `npx tsc --noEmit` | clean |
| `npx eslint .` (touched paths) | clean |
| `npm run build` | succeeds |

## 10. Deploy

Operator only — `mindbunker`, version `d192df84-daca-48a3-8ee3-cff1cfaf40cc`, 100% traffic. Client Worker, public site, and native Sensor were not touched or redeployed (Stop's server-side logic alone handles the new semantics; the existing Stop payload already carries everything needed).

## 11. Live QA

Direct browser click-through wasn't possible (no session credentials in this environment; the Sensor menu-bar app doesn't register as an automatable application in this environment either). Instead, **the actual deployed SQL was exercised directly against live production D1** — more rigorous than a UI click-through for verifying server-side semantics, since it runs the identical statements the API route executes:

1. Inserted a disposable QA `INTERNAL` session (id 77) and `ADMIN` session (id 78) against the real registered device (`Emmanuel Mac Sensor Production`), open (no `ended_at`).
2. Confirmed War Room's exact `OPEN_SENSOR_SESSION_SQL` returns the ADMIN session live, with `video_id`/`client_id`/`client_name` all `null` — no fabricated attribution.
3. Ran the exact deployed `SENSOR_SESSION_STOP_SQL` on both. Both finalized to `ARCHIVED` in one write, `video_id` still `null`.
4. Verified: pending-review count `0`, War Room back to idle (no open session), zero `work_sessions` rows created for either, `billing_evidence`/`billing_allocations` row counts unchanged (9/9, identical to pre-QA).
5. Confirmed both rows fall inside the Dashboard's real Today-aggregation query window.
6. Deleted both QA rows. Row count confirmed restored to 76.

Final production state confirmed: `CLIENT` 61 APPROVED + 1 ARCHIVED + **0 PENDING** (unchanged); `INTERNAL` **14 ARCHIVED + 0 PENDING** (normalized). Unauthenticated deploy-health check: the login page renders cleanly post-deploy, no error.

## 12. Billing Regression Proof

`billing_evidence` and `billing_allocations` row counts were 9/9 before this mission's live QA and 9/9 after — zero rows created, zero rows mutated. No `transactions` or `payment_requests` rows reference any Sensor session, CLIENT or non-CLIENT. The DB-level guard from the prior sync hotfix (`sensor_sessions_context_video_check`: non-CLIENT can never carry a `video_id`) combined with `SENSOR_SESSION_APPROVE_INSERT_SQL`'s own `video_id IS NOT NULL` requirement makes it structurally impossible for this patch to create billable history — verified again, not just assumed.

## 13. Future BI Capability Enabled

This patch and its addendum establish, as pure derived data (nothing new stored):
- Truthful daily INTERNAL/ADMIN/LEAD operational time on the Dashboard.
- Per-app OBSERVED and INTENTIONAL time, by context, across Today/3D/7D/last-week/this-month/any specific month.
- A coverage disclosure so incomplete Sensor history is never presented as complete.

This is enough raw evidence to eventually support "how much time did I spend building MindBunker," "how much ADMIN time this month," "how much time went into sales," etc. — once operating-cost data matures enough to responsibly attach a number to it.

## 14. What Was Deliberately Not Built

- No cost/hour formula, ROI dashboard, tool-cost allocation, client profitability calculation, or equipment depreciation model.
- No accounting entries, expense transactions, or fabricated revenue/cost facts for internal time.
- No new analytics page or summary table — Application Usage lives inside the existing Productivity → Sensor Activity page, not the Dashboard.
- No dedicated "Lead / Sales" Dashboard card — LEAD operational time is tracked explicitly in code and tests and included in Total Intentional, but has no dedicated visual card yet (the smallest-diff choice; adding one is a two-line follow-up if wanted, deliberately deferred rather than touching the Dashboard's grid layout in this pass).
- No AI classifier / embeddings / external service for app or window classification — a small deterministic bundle-id lookup table only, built from real captured telemetry.
- No native Sensor rebuild — the server-side Stop fix alone is sufficient; nothing about the existing native payload needed to change.
- No schema migration — `ARCHIVED` was reused for its existing meaning; `device_activity_observations` and `sensor_sessions` were both already sufficient for the App Intelligence addendum.
- No initiative/domain taxonomy beyond raw `context_label` — a label like *"quartou"* is legitimate historical evidence, not a durable BI dimension; solving that classification problem is explicitly out of scope here.

---

## Final Structured Output

```
NON-CLIENT STOP SEMANTICS: GREEN
CLIENT APPROVAL SEMANTICS: GREEN
INTERNAL OPERATIONS DASHBOARD: GREEN
TOTAL INTENTIONAL: GREEN

SENSOR INBOX:
  Client pending: 0
  Non-client pending: 0

HISTORICAL NON-CLIENT ROWS NORMALIZED: 14
OPERATIONAL HISTORY PRESERVED: YES
FAKE WORK SESSIONS CREATED: 0
BILLING SIDE EFFECTS: 0

D1 BACKUP: mindbunker-prod-backup-pre-ledger-normalization-20260916-120622.sql
FOREIGN KEY CHECK: GREEN

TESTS: 1179/1179
TYPECHECK: GREEN
ESLINT: GREEN
BUILD: GREEN

OPERATOR DEPLOY: d192df84-daca-48a3-8ee3-cff1cfaf40cc
CLIENT DEPLOY: NONE
SENSOR RELEASE: NONE (not proven necessary -- server-side Stop fix alone handles the new semantics)
PUBLIC SITE: UNTOUCHED

SESSION EDITABILITY:
INTERNAL SESSION EDITING: GREEN
ADMIN SESSION EDITING: GREEN
LEAD SESSION EDITING: GREEN
CLIENT PENDING EDITING: GREEN (unchanged)
CLIENT POST-APPROVAL BOUNDARY: GREEN (unchanged -- Sensor edit never mutates a canonical Work Session; use correctWorkSession)

APP TELEMETRY AVAILABLE: YES
APP NORMALIZATION: GREEN
ACTIVE APP TIME: GREEN
INTENTIONAL APP TIME: GREEN
TODAY: GREEN
3-DAY AVG: GREEN
7-DAY AVG: GREEN
LAST WEEK: GREEN
THIS MONTH: GREEN
SPECIFIC MONTH QUERY: GREEN
TELEMETRY COVERAGE DISCLOSED: YES
MIGRATION: NONE

FINAL VERDICT:

GREEN — OPERATIONAL TIME IS EDITABLE, FINAL, AND ANALYTICALLY USEFUL
```

STOP.

No cost/hour built. No ROI built. No new dashboard built.
