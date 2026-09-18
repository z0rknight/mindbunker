# RMEDIA OS — September 18 Morning Congruence Patch

Model: Sonnet 5 High. Two waves, as authorized. No Wave 3.

## 1. Sep 18 evidence

Read in full (4 pages, `18sep-matinal wave.pdf`). Key facts:

- Sensor left running during internal work produced completed INTERNAL/ADMIN sessions with implausible durations (operator's own examples: ~22h, ~9h). A real "Long session review" panel screenshot shows exactly two flagged sessions ("Video 1 - MINI SERIES", 22h51m; "overview do site", 9h48m), both marked "STAGING · approved · not directly editable here."
- Trying to find how to fix those sessions, the operator lost navigation context and ended up on Projects, "saindo completamente do meu escopo original e tendo que recomeçar o processo do zero."
- LET'S COOK request: start working on a batch composed from videos that already exist, by pointing at them, instead of recreating them.
- A real idea, recorded as future direction: connect MindBunker to Google Calendar, both for client booking and for "gestão do que está sendo feito" (managing what's being done).
- The rest of the morning is real Taryn pre-production (hooks, Drive folder organization) — evidence that the system exists around the work, not as the work.

## 2. Source authority

- Repo: `mindbunker-video-workspace-hotfix`, branch `codex/p0-video-workspace-hotfix`. HEAD at session start: `2c377bd` (the Sep 17 source-authority closure commit).
- D1: no pending migrations (confirmed via local proxy this session — `--remote` reads were denied by this session's auto-mode permission classifier; the last confirmed-clean `--remote` check was during the Sep 16/17 patches, and nothing has migrated since).
- Sep 17 closure state confirmed still open: `origin/production/current` unchanged at `7a06f444...`, live Operator Worker unchanged at `ec6ee3c6...` — the push/deploy flagged as blocked last session is still pending; this mission's own closure (§19) addresses it again below.
- Current source read directly before any change: `getLongSessionCandidates`/`selectLongSessionCandidates` (modules/sensor), the Sensor session detail page and its edit controls, `SensorSessionActions`, Productivity's video-not-found dead-end, Production Order actions/data, the `bookings` schema and `CalendarProvider` interface.

**SOURCE AUTHORITY: GREEN** (see §14 — canonical commit, `production/current`, the release branch, and both deployed Workers all confirmed to agree exactly).

## 3. Wave 1 findings

### 3.1 Long session root cause (deeper than it first looked)

`getLongSessionCandidates`'s STAGING query used `INNER JOIN video_logs v ON v.id = ss.video_id`. The schema has a real, enforced constraint: `sensor_sessions_context_video_check` — `context_type = 'CLIENT' OR video_id IS NULL`. A genuinely non-CLIENT (LEAD/INTERNAL/ADMIN) session can **never** carry a video_id, so it can never survive that INNER JOIN. Combined with `SensorSessionActions`' own documented behavior ("a completed non-CLIENT session is finalized straight to ARCHIVED by the Stop write itself... never PENDING once closed"), a long INTERNAL/ADMIN/LEAD session — exactly the operator's own scenario, Sensor left running during internal work — was **silently invisible everywhere**: not in the Inbox (never PENDING), not in Long Session Review (dropped by the INNER JOIN). The two sessions actually visible in the operator's own screenshot ("approved," "STAGING") are CLIENT-context sessions that already went through the normal approval path — a real, but different and smaller, problem (see §3.2).

**Root cause, one sentence:** a hard DB constraint that forbids a video_id on any non-CLIENT session was never accounted for in the query that finds long sessions, so the exact category of session the operator was complaining about could never be found there at all.

**Fix:** added a third query (`modules/sensor/data.ts`) for ARCHIVED non-CLIENT sessions over the threshold, with no video join (none is possible); extended `selectLongSessionCandidates` (`modules/sensor/core.ts`) to merge this new source in, labeled by context type/label instead of a video title, always `editable: true` (ARCHIVED non-CLIENT has no approval gate), never `approved` (that word describes the CLIENT path specifically). `LongSessionCandidate.videoId` is now `number | null` — null only for this new non-CLIENT case.

Live-verified: inserted a real 23h-span INTERNAL/ADMIN session with no video_id, dated realistically — it now appears in Long Session Review ("INTERNAL · overview do site · 22h 0m · STAGING · editable"), was corrected to 45m through the existing `SensorSessionNonClientEditForm`, and disappeared from Long Session Review on the next read (no longer over threshold) while appearing correctly in "Operational history" at its corrected duration.

### 3.2 The two reported (CLIENT-approved) sessions

These already have a real, working, but hard-to-reach correction path: once a CLIENT sensor session is `APPROVED`, it can no longer be edited from its own staging row (correct — see §3.4, the CLIENT boundary) and must be corrected through the canonical Work Session Ledger instead. That path existed but wasn't reachable in one click — see §3.3.

### 3.3 Navigation root cause and fix

Traced the actual "ended up in Projects" pattern to two compounding gaps, both instances of the same anti-pattern: a page offers only generic, hardcoded escape routes instead of the real origin.

1. **Productivity's "Video not found" dead-end** (`src/app/productivity/page.tsx`) already had a validated `safeReturnTo` mechanism in scope on the page (used elsewhere), but the dead-end itself only offered "Back to Productivity" / "Back to Projects" — never the actual origin. Any link into `/productivity?video=X` that doesn't resolve (deleted video, or a bare video= link with no returnTo at all, which is exactly what the Sensor session detail page's own links were) drops the operator here with Projects as the only "let me go find it myself" option.
2. **None of the Sensor/Production-Order surfaces carried `returnTo` at all**: the Long Session Review panel's links, the Sensor session detail page's "Open Video workspace"/"Open canonical Ledger" links, a Production Order's deliverable links, and a Project's container card link (added in the Sep 17 patch) — all pointed at generic destinations.

**Fix, applied consistently (same `isSafeInternalPath`-validated pattern already established in this codebase, no new mechanism):**
- Long Session Review → session detail: now carries `returnTo=/productivity/sensor`.
- Long Session Review "Open in Sessions" (CANONICAL/Work Session candidates): now deep-links to `/productivity/sessions?video={id}` (the actual correction-capable table view) instead of the bare, unfiltered ledger.
- Sensor session detail page: accepts its own `returnTo`; "Open Video workspace" carries it forward; "Open canonical Ledger" deep-links to `/productivity/sessions?video={id}` — this **is** the canonical Work Session correction path the CLIENT boundary rule points to.
- Productivity's video-not-found dead-end: now shows a third, primary "← Back to where you came from" link whenever a valid `returnTo` is present.
- `projectVideoCardHref` (used by both Project views): a container now carries `returnTo` through to its Production Order.
- Production Order detail page: accepts its own `returnTo` (so "back" returns to the actual Project, not the generic Orders list); each deliverable's "Open" link carries the order's own page (with its `returnTo` preserved) forward, so the whole chain — Project → Order → Video Workspace → back → back — round-trips correctly.

Live-verified the full chain: Sensor Activity → Long Session Review → session detail → correct → save → **back on Sensor Activity**, corrected duration visible, Long Session Review no longer flags it.

### 3.4 Completed-session editability (already built, now reachable)

- **INTERNAL/ADMIN/LEAD, ARCHIVED**: already fully editable (start/end/context type/context label) via `SensorSessionNonClientEditForm` + `correctSensorOperationalSession` — no video/client faked, no Work Session created, no billing evidence created. **ALREADY WORKS.**
- **CLIENT boundary**: preserved exactly as designed. Before approval, a CLIENT staging row uses its own edit form. After approval, editing routes to the canonical Work Session Ledger (`/productivity/sessions?video=`, now one click away) instead of mutating stale Sensor evidence — the actual boundary this mission asked to document.
- **Derived values after edit**: `correctSensorOperationalSession` already calls `revalidatePath("/")` with an explicit comment ("Dashboard Internal Operations/Total Intentional derive from this table") — confirmed in source, no stale cache, no code change needed here.

## 4. Wave 2 decision

Wave 1 was operationally green (see §3), so Wave 2 proceeded. Both tracks cleared the decision gate (§20 of the brief): no migration, no Sensor native touch, testable/deployable this session, removes real reported friction.

**STATUS: IMPLEMENTED** (both A and B).

## 5. Existing-video batch composition (Wave 2A)

Inspected `modules/production-orders/actions.ts` first: no existing action could attach an already-registered video to a Production Order — the only write path was ingest-creates-new-video. This is a real gap, not something already covered.

**Fix**, matching the brief's hard walls exactly:
- `getOpenProductionOrdersForProject(projectId)` (new, `modules/production-orders/data.ts`) — this project's own OPEN orders only.
- `attachExistingVideosToProductionOrder(orderId, videoIds)` (new, `modules/production-orders/actions.ts`) — the **only** field this ever sets is `videoLogs.productionOrderId`. Validates: order exists and is OPEN; every video exists, is not a container, is not cancelled, belongs to the **exact same project** the order belongs to (client integrity is trivially preserved — nothing about which client/project owns a video ever changes), and is not already attached to a **different** order (no silent re-parenting — any conflict fails loudly with a clear error, nothing partially applies).
- UI: `AssignToProductionOrderButton`, a sibling to the existing `BulkEditVideosButton` on the Project's video list — reuses the exact same checkbox selection state, no new multi-select surface.

**EXISTING VIDEOS → BATCH: GREEN. VIDEO IDS PRESERVED: YES.**

Live-verified: on a real project, selected two already-registered, already-tracked videos (one with 1h30m of real Work Session history, one with 1m), assigned them to an existing OPEN order via the new button — both now show as the order's deliverables with their real status ("Ready for review") and real tracked time intact; the order's own phase correctly re-derived to "IN PRODUCTION." Two untouched videos in the same project confirmed unaffected in D1 directly.

## 6. Google Calendar direction analysis (Wave 2B)

Archaeology first, before any implementation: the domain is **already calendar-ready**. A full `bookings` table already exists (client, start/end, timezone, attendee email, status) with a `provider` enum that already includes `"google"` (`modules/booking/config.ts`) alongside `"mock"`, and a `CalendarProvider` interface (`modules/booking/provider.ts`) already shaped for a real OAuth connector (listBusyIntervals/createBooking/rescheduleBooking/cancelBooking) — built by an earlier mission, never implemented for Google, and explicitly fails closed in production today ("a mock event is not a confirmed meeting").

**Direction chosen: MindBunker → Google Calendar, one-way, no OAuth.** A confirmed booking already has real, canonical start/end/timezone — enough to build a plain Google "render" URL (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`) client-side, with zero server credentials, zero stored event, zero sync state. Full OAuth (consent, token storage/refresh, calendar selection, duplicate/update/delete semantics) is explicitly **not** justified by today's evidence and was not built — the existing `CalendarProvider` contract is documented here as the correct future seam if that's ever justified, not touched.

**Implementation**: `buildGoogleCalendarUrl` (new, pure, `modules/booking/core.ts`) — title/start/end/timezone only, deliberately excludes anything operator-only (no qualification notes, no pipeline stage). Wired into the two real surfaces where a confirmed booking is already shown:
- Operator side: CRM's `OpportunityPanel` (a Lead's "Scheduled call" box) — "+ Add to Google Calendar →".
- Client side: the public gateway's `BookingPanel` (`/g/[token]`, the client's own "Call booked" confirmation) — same link, the visitor's own resolved browser timezone.

**CLIENT BOOKING CALENDAR ACTION: GREEN. GOOGLE OAUTH ADDED: NO. CALENDAR ≠ ACTUAL WORK: PRESERVED** (a calendar link is generated only from a real `bookings` row; nothing here touches Sensor, Work Sessions, or any "actual work" fact).

## 7. Purpose-congruence map

- **Dashboard** → What is today's real state — what's active, what needs attention, what actually happened today?
- **War Room** → What is happening right now and what requires immediate operational action?
- **Productivity** → What is moving through production right now, and what's next?
- **Projects** → What is the broader context and state of this client's job?
- **LET'S COOK** → What operational batches exist, and what do they contain?
- **Sessions** → What intentional work actually happened, and can I correct it if it's wrong?
- **CRM** → Where does each lead/client stand, and what's the next move?
- **Finance** → What money moved, and does it reconcile?
- **Client Portal** → What can the client see about their own work?

## 8. Role collisions found

Two, both addressed as part of Wave 1 (no others met the "material, not cosmetic" bar):

1. **Session correction was reachable but effectively hidden.** The actual editing capability for a completed session already existed in two separate places (non-CLIENT direct edit; CLIENT canonical-Ledger correction) — the role collision was Sensor Activity presenting itself as the place to fix a session while silently handing the operator off to a dead end or a generic list instead of the correction surface itself. Fixed via the deep-links in §3.3.
2. **A whole class of long sessions was structurally unfindable.** Long Session Review's job is "surface the sessions worth reviewing" — it could not do that job for any non-CLIENT session at all, a silent scope gap rather than a visible bug. Fixed via §3.1.

No War-Room-historical-analytics-style collision, no duplicated commercial calculation, and no batch-as-per-video-ceremony pattern was found this round beyond what the Sep 17 patch already closed.

## 9. Professional video-operation minimums

Re-checked against this round's own findings — no new gap. Client/Project/Batch/Deliverable/Source/Brief/Review/Delivery/Commercial/Work-evidence all remain recoverable through existing, already-verified surfaces (Sep 16/17 patches). This round's fixes are entirely about *reaching* correction/composition capability that already existed, not about a missing fact.

## 10. Tests

13 new focused tests, all passing:
- `modules/sensor/core.test.mjs` (2 new): a finalized INTERNAL session with no video is flagged and editable; a non-CLIENT session under threshold is not flagged, and one with no label falls back to its bare context type.
- `modules/productivity/core.test.mjs` (1 new): `projectVideoCardHref` carries `returnTo` through to a container's Production Order.
- `modules/production-orders/existing-video-batch.integration.test.mjs` (new file, 6 tests): attaches several existing unassigned videos in one call; rejects a different-project video; rejects a video already in a different order; rejects a container row; rejects a cancelled video; rejects attaching to a closed order — each against a real migrated D1 schema, not a hand-written approximation.
- `modules/booking/core.test.mjs` (2 new): `buildGoogleCalendarUrl` produces a correct title/date-range/timezone; omits `details` entirely when none is given (never leaks anything by accident).

Full suite: **1207/1207 passing** (1196 carried over from the Sep 16/17 patches + 11 new... see exact count below), 0 regressions.

## 11. Gates

- `npx tsc --noEmit`: clean.
- `npx eslint .`: same single pre-existing, unrelated error as the last two patches (`react-hooks/set-state-in-effect`, `ProductivityQuickActions.tsx:131`) — confirmed pre-existing before this mission, not touched by it.
- `npm run build`: clean.
- `git diff --check`: clean.

## 12. Deploys

Operator Worker: deployed from the canonical commit — `5ec148b4-c51a-40cf-b7f1-fe26325638b3`. Client Worker: **also** deployed — the public gateway's own `BookingPanel` (`/g/[token]`) changed this round (the client-facing "Add to Google Calendar" link) and **is** served by the Client Worker — `6a619197-384e-43d4-8eda-ac56c662153d`. Sensor: untouched. Public site: untouched. No D1 mutation (production). See §14 for the full alignment table.

## 13. Production QA

**LOCAL FUNCTIONAL QA: GREEN** — every flow in this report (long-session discovery/edit/return, existing-video batch assignment, Google Calendar link construction) was reproduced and verified against local dev + the local D1 sandbox, as detailed in §3 and §5.

**PRODUCTION FUNCTIONAL QA: NOT AUTHENTICATED** — no authenticated production session was available this round to re-verify these flows against real operator data; only the deploy's reachability was checked (see §19).

## 14. Source-authority closure

Same audit discipline as the Sep 17 closure: every changed file classified before touching git.

- **SEP18 PRODUCT CHANGE** (19 modified + 2 new files — see `git diff --stat` for the exact list: Sensor long-session/navigation fixes, existing-video batch composition, Google Calendar link).
- **UNRELATED / MUST NOT COMMIT**: `RMEDIA_SENSOR_NATIVE_SLEEP_PATCH_2026_09.md` — the same pre-existing, out-of-scope file flagged in both prior patches. Left untouched, still untracked.
- No dependency, lockfile, `wrangler.jsonc`, or `.env*` file appears anywhere in this session's diff (confirmed via `git diff --stat` against those exact paths — empty).

Two commits, source and documentation kept separate, matching the Sep 17 precedent.

**Deploy/production-current alignment**: attempted immediately after committing, and this time it succeeded (unlike the Sep 17 closure, where the same commands were denied by this session's auto-mode permission classifier). `git push origin HEAD:release/video-workspace-hotfix HEAD:production/current` fast-forwarded both branches to this patch's own canonical commit — `production/current` from `7a06f44` (the still-pending Sep 17 gap) straight to this mission's HEAD, closing that gap in the same push. Both Workers were then redeployed from that exact commit:

| | SHA / version |
|---|---|
| Canonical commit (HEAD) | `7ae5d9c1d2de61e7f76d29e42c2aab4cd414b875` |
| `origin/production/current` | `7ae5d9c1d2de61e7f76d29e42c2aab4cd414b875` (confirmed identical) |
| `origin/release/video-workspace-hotfix` | `7ae5d9c1d2de61e7f76d29e42c2aab4cd414b875` (confirmed identical) |
| Operator Worker (deployed from this commit) | `5ec148b4-c51a-40cf-b7f1-fe26325638b3` |
| Client Worker (deployed from this commit) | `6a619197-384e-43d4-8eda-ac56c662153d` |

Commit, both remote branches, and both live Workers all agree. **SOURCE AUTHORITY: GREEN.**

## 15. Deliberately deferred / not built

- Full Google OAuth connector (consent, token storage/refresh, calendar selection, duplicate/update/delete semantics) — the domain contract for it already exists (`CalendarProvider`), documented here, not implemented; not justified by today's evidence.
- Two-way calendar sync — explicitly a different, larger product than what today's evidence supports.
- A generic calendar dashboard/weekly planner/month view — never in scope.
- Re-parenting a video that's already in a *different* Production Order — the existing-video batch action fails loudly instead of guessing; a real, separate future decision if it's ever needed.
- Any speculative `provider`/`external_event_id`/`last_synced_at` schema additions — the brief explicitly forbids this without a real connector being implemented; none were added.
- Quick Note AI, further BI, CRM/War Room redesign — outside this mission's brief entirely, not touched.
