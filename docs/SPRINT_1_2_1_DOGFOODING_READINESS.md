# Sprint 1.2.1 — Dogfooding Week Preparation / Observation System

Date: 2026-08-22
Scope: MINDBUNKER — SPRINT 1.2.1 DOGFOODING WEEK PREPARATION / OBSERVATION
SYSTEM, per the brief for Aug 23–28. Smallest safe changeset, verified
against the real repository at
`/Users/emmanueldarosadillenburg/Documents/New project/mindbunker`.

North star for this round: prepare MindBunker to be used for real Rosa Media
production this week, not to design more infrastructure. Everything below
was inspected in the actual repo before being written down; nothing here is
inferred from the brief in isolation.

---

## 1. Work Session behavioral audit

Read `src/modules/work-sessions/{core,data,actions}.ts` and
`src/app/productivity/{WorkSessionPanel.tsx,page.tsx}` directly. No behavior
was changed while auditing.

**What gets persisted when Start is pressed.** One row in `work_sessions`:
`video_id`, `started_at` (a server-generated Unix-seconds timestamp — not
anything the client sends), `activity_type`. The insert and the "is anything
else already open" check happen in a single SQL statement
(`START_WORK_SESSION_SQL`), because D1 executes a database's statements one
at a time and a separate check-then-insert could race.

**Client-side vs. persisted timestamps.** Elapsed time is computed
client-side, but always from the persisted timestamp: `WorkSessionPanel.tsx`
parses `openSession.startedAt` (which came from the DB) and renders
`now − startedAt`, ticking every second via `setInterval`. There is no
separate client-only "timer state" and no periodic server heartbeat while a
session runs — the server only ever records the start.

**Browser/tab/PWA closed.** Nothing happens server-side. The session stays
open exactly as it was. There is no client-side "pause" concept to lose.

**Another device opens MindBunker.** It reads the same server truth. The
Productivity page shows a global "Work session active" banner
(`workSessionOverview.openSession`, sourced from the DB, not from any one
browser), and any `WorkSessionPanel` reconstructs the same elapsed time from
the same `started_at`. Two devices watching the same open session see
identical, independently-computed clocks — not one leading and one
following.

**Can a session remain active indefinitely?** Structurally, yes. Nothing in
the schema or the app enforces a maximum duration. This is a real,
documented limitation (see the Dogfooding Log) — not fixed this round, for
reasons below.

**Can multiple simultaneous sessions exist?** No — and this is already
enforced at the database level, not just in application code:
`work_sessions_one_open_idx` is a partial unique index on `(1) WHERE
ended_at IS NULL`, so SQLite itself rejects a second concurrently-open row.
This is a *global* single-session model (one open session across the whole
app, not one per video), and it was already adversarially tested in the
Work Session P0 round with two simultaneous `Start` requests from separate
worker threads — only one ever wins. This round's full test re-run (§8)
re-confirms it still holds.

**What happens after crashes/restarts?** Full recovery. State lives
entirely in D1, which is durable; nothing is held only in browser memory or
in a live server process. A refreshed tab, a different device, or a
restarted app all read the same open session back from the database
(covered by the existing test "refresh or process restart recovers the
active session").

**Do sessions record source/device metadata?** No. The `work_sessions`
table has exactly these columns: `id, video_id, started_at, ended_at,
activity_type, note, created_at`. There is no device id, user agent, or
capture-type column. Every row today implicitly means "started and stopped
by hand in the MindBunker web timer" — that's simply the only thing that
can currently write to this table.

**Where can completed Work Sessions currently be viewed?** Before this
round: only as a per-video aggregate (`closedSeconds`, `sessionCount`) shown
on `WorkSessionPanel` — there was no view of individual sessions anywhere in
the app. This round adds one; see section 2.

**Can sessions be edited or deleted?** No application path exists for
either. The only mutation beyond `startWorkSession` is `stopWorkSession`,
which sets `ended_at` on the one currently-open row and nothing else.

**Relationship to Client → Project → Video.** Attribution is video-only at
the table level — `video_id` is the only foreign key `work_sessions` has.
Client and Project are derived by joining through `video_logs.project_id`
and `video_logs.client_id`; they are not stored redundantly on the session
row itself.

**Dangerous-defect check (per the brief's explicit ask).** The one
structural risk that would actually matter for dogfooding-week data
integrity — uncontrolled duplicate active sessions — is already prevented
at the database level and already covered by adversarial concurrency tests.
No new dangerous defect was found. The one real, open risk is UX rather
than corruption: an abandoned open session (forgot to press Stop) will
silently accumulate real wall-clock time indefinitely, with no warning at
any duration threshold, and will inflate `closedSeconds` whenever it's
eventually stopped. Per the brief's own instruction not to redesign the
timer blindly, this was not fixed this round — it is logged as an **OPEN**
item in `docs/DOGFOODING_2026_W35.md` for real usage to surface how much it
actually matters before any fix is designed.

## 2. Session History — smallest useful implementation

Added, read-only, zero schema changes:

- `WORK_SESSION_HISTORY_SQL` (`src/modules/work-sessions/core.ts`) — every
  session, newest first, `LEFT JOIN`ed to `projects`/`clients` via
  `video_logs`' own `project_id`/`client_id` (both nullable, so the join is
  `LEFT`, matching how those columns already behave elsewhere in the app).
- `getWorkSessionHistory(limit = 200)` (`src/modules/work-sessions/data.ts`)
  — maps raw rows to a typed `WorkSessionHistoryEntry`: date/time, duration
  (`null` while a session is open, never fabricated), client, project,
  video, activity, and a derived `status` of `"OPEN" | "CLOSED"`.
- `/productivity/sessions` (`src/app/productivity/page.tsx` links to it from
  the footer) — a plain read-only table: Started · Duration · Client ·
  Project · Video · Activity · Status. An open session shows "running…"
  instead of a duration, never a stale or zero value.

**Capture/source type.** Deliberately not added as a column or a fake value.
The page carries one explanatory line instead: every row today is
`WEB_TIMER` by construction (it's the only thing that can write to this
table), so a per-row column would just repeat the same word 200 times. The
cleanest future path, when a passive desktop sensor is eventually built, is
a `source` (or `capture_type`) enum column on `work_sessions` itself —
*not* a new table — with `WEB_TIMER` as the default/backfill value for
every existing row, so provenance becomes real data instead of an assumed
constant. That's a one-column additive migration when the time comes; it is
not needed to ship this round's read-only view.

Nothing about `startWorkSession`/`stopWorkSession` changed. This is
additive and reversible: delete the page, the SQL constant, and the data
function, and the app is exactly as it was.

## 3. Desktop Sensor boundary (documentation only — nothing built)

No sensor code was written this round. The boundary, for when one is:

**Work Session** = intentional operational context. A human decided "I am
now working on this video" and said so by pressing Start. It is sparse (one
row per deliberate act), authoritative for billing/reporting, and lives in
`work_sessions` exactly as it does today.

**Activity Sensor** = observed computer behavior. A future passive process
noticing which application had focus, for how long, on which machine. It
would be dense (potentially a row or event per minute), inherently
uncertain (which video/client is this even for? unknown without inference),
and must not be mistaken for an intentional record.

**They must not become the same table or the same concept.** A Work Session
must never be auto-created, auto-extended, or auto-corrected from sensor
data. Doing so would silently convert "the human said they worked X hours"
into "the computer guessed X hours," which is exactly the kind of tier
collapse the Historical Reference Layer (Sprint 1.2 P0) was built to avoid
in the historical-evidence direction — the same discipline applies here,
prospectively.

**How they'd eventually relate:** by timestamp correlation only, computed
on read (e.g. "of the 4 hours logged in this Work Session, how much
overlapped with Premiere-focused Activity Sensor windows?") — never by
writing into each other's tables. This mirrors the natural-key,
non-destructive-join pattern already used for the Historical Reference
Layer's own identity resolution.

No schema, module, or table for an Activity Sensor exists in the repository
today (confirmed by search — see section 6), and none was added this round.

## 4. Historical Reference Layer — status and Mac-terminal runbook

**What changed since the last round, found during this round's Phase 0
re-inspection (nothing here was done by this session):** `bun run
db:generate` has since been run in your own terminal. `drizzle-kit`
generated its own migration file, `0012_melted_mole_man.sql`, and its own
`src/db/migrations/meta/0012_snapshot.json`, and updated
`meta/_journal.json` accordingly. My hand-written
`0012_historical_reference_layer.sql` from the P0 round is gone from the
working tree (removed, presumably in the course of running `db:generate`
cleanly). This resolves the one open gap flagged in the P0 round report.

I diffed the two: **drizzle-kit's own generated SQL is structurally
identical** to what I hand-wrote — same five tables, same CHECK
constraints, same composite `(batch_id, identity_canonical_id)` foreign
keys, same partial unique index for "one ACTIVE batch." The only
difference is statement ordering (drizzle emits tables alphabetically;
mine followed dependency order) and the file's random generated name —
neither affects behavior, since SQLite resolves foreign keys by table name
at write time, not by creation order. This is good confirmation that
`schema.ts` was captured correctly the first time. The historical
integration test (`src/modules/historical/integration.test.mjs`) reads the
migrations directory by listing and sorting whatever `.sql` files exist —
it does not hardcode a filename — so it picked up
`0012_melted_mole_man.sql` automatically. Re-run this round: still 7/7
passing (see §8), against **all 13 migrations, `0000` through `0012`, in
order**, including the rename.

**Migration state:** ready. `0012_melted_mole_man.sql` +
`meta/0012_snapshot.json` + the `_journal.json` entry are all present and
consistent (18 tables in the snapshot: the 13 pre-existing plus the 5
`hist_*` tables — matches `schema.ts` exactly).

**Importer readiness:** built and unit/integration-tested
(`src/modules/historical/{core,actions}.ts` +
`historical/{core,integration}.test.mjs`), **never run** against any real
database, local or remote. It is not wired to any UI button, by design —
running it is the production mutation the Data Safety protocol gates.

**Idempotency:** content-fingerprint based (`computeHistArtifactFingerprint`,
SHA-256 over all four source documents). A batch with an identical
fingerprint that is already `ACTIVE` or `SUPERSEDED` short-circuits with
`skipped: true` and zero writes; a leftover `PENDING` batch from an
interrupted attempt is reused rather than duplicated.

**Expected record counts (unchanged, independently reconciled twice now —
once in the P0 round, once by re-reading the embedded JSON this round):**
**209 facts, 47 identities, 44 coverage-months** (→ 132 coverage rows, 44
months × 3 sources each).

**Local import path:** did not exist before this round in any runnable
form. `importHistoricalArtifact()` calls `getAuthenticatedDb()` →
`requireAuth()`, which depends on `next/headers` and only works inside a
real, authenticated Next.js request — it cannot be called from a bare
script. Rather than wire a UI trigger into the product (explicitly out of
scope this round), I added
`scripts/local-only-import-historical.mjs`: a disposable tool that lives
outside `src/`, is not imported by any route, and is untouched by `next
build` / `opennextjs-cloudflare build`. It reuses the same validation,
fingerprinting, and coverage-mapping functions from
`historical/core.ts` (no duplicated logic there), and reaches the local D1
binding via wrangler's own `getPlatformProxy()` API instead of going
through `getAuthenticatedDb()`. **I could not execute this script in this
session** — the sandbox bridging this session to your repository runs on
Linux ARM64 and reads your Mac's `node_modules` (compiled for
darwin-arm64), so anything touching `workerd`'s native binary (which
`getPlatformProxy()` needs) fails here exactly as `wrangler`/`next build`
already did in the P0 round. It is written by directly mirroring the
tested `actions.ts` logic, but you should treat its first real run as a
verification step, not a known-good result — check its printed counts
against the numbers above before trusting it further.

**All History empty/populated behavior:** unchanged from P0. No batch is
`ACTIVE` (nothing has been imported anywhere, local or remote), so
`/all-history` renders its "not yet imported" empty state, not a table of
zeros.

**Production Data Safety requirements:** unchanged and untouched this
round. No production database was touched. No `wrangler d1 migrations
apply --remote` was run. No backup/count-comparison/Time Travel bookmark
was taken from this session — as before, `wrangler`'s native binary can't
run in this sandbox, so those steps have to happen in your own terminal.

### Mac-terminal runbook (local only — nothing here touches production)

All commands below run from the repository root on your own Mac, where the
native `workerd`/`esbuild` binaries actually match your `node_modules`.
`package.json` scripts and `wrangler.jsonc` were read directly from your
repo to get these exact; they are not guesses.

**1. Drizzle snapshot verification.**
```bash
bun run db:generate
```
Since `0012_snapshot.json` already exists and matches `schema.ts`, this
should print that there is nothing new to generate. If it instead proposes
a diff, stop and look at it before continuing — it means something in
`schema.ts` and the committed snapshot have drifted.

**2. Local, isolated D1 apply of migration `0012`.**
```bash
bun run db:migrate:local
```
This is `wrangler d1 migrations apply mindbunker --local` under the hood.
It only touches the local Miniflare-backed database under
`.wrangler/state` (per your own README) — never the remote/production D1
(`database_id: d6ada5db-1f36-4ee9-9a05-01d131abf219` in `wrangler.jsonc`).
Safe to run repeatedly; already-applied migrations are skipped.

**3. `next build`.**
```bash
bun run build
```
Plain `next build`. This alone could not be executed in this session (see
§8) — `tsc --noEmit` already type-checks every file under the same
`tsconfig.json` Next's build would use, and passed clean, but an actual
`next build` is still worth running once yourself before you rely on it.

**4. OpenNext build.**
```bash
npx opennextjs-cloudflare build
```
Build-only, without also launching `preview` (which `bun run preview`
would do as a combined step — see below if you want the full
Workers-runtime test too). This produces `.open-next/worker.js`, the exact
artifact `wrangler.jsonc`'s `main` field points at.

**5. Run the historical import — local only.**
```bash
bun run db:migrate:local      # if you haven't already run step 2
node scripts/local-only-import-historical.mjs
```
This writes into your **local** D1 only (via `getPlatformProxy()`, which
defaults to the same local Miniflare state `next dev`/`wrangler d1
--local` use). It never touches remote D1 — there is no `--remote` path in
this script at all. Re-running it is safe: the same fingerprint-based
idempotency as the real importer applies (a second run reports "Skipped,"
no writes).

**6. Exact local URL for `/all-history`.**
```bash
bun run dev
```
Then, once logged in with your existing local password (the same
`AUTH_PASSWORD_HASH`/`MB_AUTH_PASSWORD_HASH` already in your `.dev.vars` —
this is MindBunker's own login form, not Cloudflare Access, which only
guards the real production deployment):

```
http://localhost:3000/mindbunker/all-history
```
(Port is whatever `next dev` prints, normally 3000; the `/mindbunker` base
path is set in `next.config.ts` and applies locally too.)

**7. Expected row counts after local import.**
- `hist_facts`: **209**
- `hist_identities`: **47**
- `hist_source_coverage`: **132** (44 months × 3 sources)
- `hist_import_batches`: **1**, `status = 'ACTIVE'`

Spot-check with wrangler directly if you want to see it outside the app:
```bash
wrangler d1 execute mindbunker --local --command "SELECT (SELECT COUNT(*) FROM hist_facts) AS facts, (SELECT COUNT(*) FROM hist_identities) AS identities, (SELECT COUNT(*) FROM hist_source_coverage) AS coverage, (SELECT COUNT(*) FROM hist_import_batches WHERE status='ACTIVE') AS active_batches;"
```

**8. Rollback / cleanup for local QA data.**
Two options, both local-only:

- *Targeted* (keeps any other local dev data — clients/videos/work
  sessions — you may have created while testing):
  ```bash
  wrangler d1 execute mindbunker --local --command "DELETE FROM hist_import_batches;"
  ```
  The cascading foreign keys (already verified in the integration test
  suite) take every `hist_identities`/`hist_identity_source_labels`/
  `hist_facts`/`hist_source_coverage` row with it.

- *Full reset* (wipes the entire local D1, not just the historical layer —
  use this if you want a completely clean slate):
  ```bash
  rm -rf .wrangler/state/v3/d1
  bun run db:migrate:local
  ```
  This only affects the local database directory on disk; it cannot reach
  production.

## 5. Dogfooding observation log

`docs/DOGFOODING_2026_W35.md` — seeded with today's four observations
(timer-continues-after-switching-away, no session history view, unbounded
session risk, Work-Session-vs-Activity-Sensor boundary), each already
carrying a Decision per the structure the brief specified. Delivered as a
separate file alongside this one.

## 6. Feature / workflow map (as of this round, from the real repository)

| Area | Status | Basis |
|---|---|---|
| Client | WORKING | `clients` table; full CRUD-equivalent flows in `src/app/crm/*` (add, tabs, opportunity panel) |
| Project | WORKING | `projects` table; `src/modules/projects` (config/core/actions + tests) + `ProjectManager.tsx` |
| Video | WORKING | `video_logs` table; `src/modules/productivity` core/actions + `VideoOperationsCard`/`VideoEditor` |
| Productivity | WORKING | `src/app/productivity/page.tsx` — the production-floor view; current/attention/planned/completed grouping |
| Work Sessions | WORKING, with known limitations | Start/Stop/aggregate all functional and tested; no edit/delete, no source metadata, no max-duration guard (§1) |
| Video Memory | WORKING | `src/modules/video-memory` (operational notes on videos; blocks deletion of videos with memory) + `VideoMemoryPanel.tsx` |
| Client Portal | WORKING | `src/modules/client-portal` (core/data) + `src/app/client/[token]/page.tsx` — token-gated, read-only client-facing view |
| Historical / All History | FOUNDATION ONLY | Schema, importer, and read-only page all built and tested (Sprint 1.2 P0); nothing imported/active yet (§4) |
| Finance | WORKING (basic) | `transactions` table; `src/modules/finance/actions.ts` + `src/app/finance/page.tsx` — transaction logging only, no invoicing |
| Health | WORKING | `health_logs` table; full-featured page with stats, log history, quick actions |
| Vault | PLANNED / NOT IMPLEMENTED | No files, no table, no references anywhere in the repository |
| Gateway | WORKING | `gateway_invitations`/`intake_submissions` tables; `src/modules/gateway` + `src/app/g/[token]` (briefing form, booking panel, open-tracking) |
| Activity Sensor | PLANNED / NOT IMPLEMENTED | No dedicated module or table exists. The only related code is the *retrospective* ActivityWatch AFK import inside the Historical Reference Layer, which is a one-time evidence import, not a live sensor (§3) |
| Gamification / XP | PLANNED / NOT IMPLEMENTED | No module, no schema fields, no references anywhere in the repository |
| Geladeira / archival CRM | PLANNED / NOT IMPLEMENTED | Zero references anywhere in the repository (confirmed by a repo-wide search) |

(Booking — `bookings`/`booking_settings`/`availability_windows` tables and
`src/modules/booking` — exists and is WORKING, feeding both the CRM
availability page and the client Gateway; not one of the requested
categories, noted here for completeness since it's load-bearing for
Gateway.)

## 7. Tiny code changes made, with justification

Every change below is additive, reversible, and does not touch
`startWorkSession`/`stopWorkSession` or any existing mutation path.

1. **`src/modules/work-sessions/core.ts`** — added `WORK_SESSION_HISTORY_SQL`
   (a `SELECT`, no writes) and the `WorkSessionHistoryEntry` type.
   *Justification:* item 2 of the brief, "I need to be able to inspect real
   entries created during dogfooding" — there was no way to do this at all
   before this round.
2. **`src/modules/work-sessions/data.ts`** — added
   `getWorkSessionHistory()`, read-only.
   *Justification:* same as above; keeps the query itself in `core.ts` per
   house convention and the DB access in `data.ts`.
3. **`src/app/productivity/sessions/page.tsx`** (new file) — read-only
   table rendering the above.
   *Justification:* makes the history actually visible, per the brief.
4. **`src/app/productivity/page.tsx`** — one added line, a footer link to
   `/productivity/sessions`.
   *Justification:* discoverability, without adding a new nav-wide entry or
   touching `Sidebar.tsx` again this round.
5. **`src/modules/work-sessions/integration.test.mjs`** — two new tests
   covering the history query's join correctness, ordering, and `LIMIT`
   handling.
   *Justification:* "tests" is explicitly preferred over redesigns in the
   brief's change-discipline section; this is net-new coverage for net-new
   code, nothing existing was touched.
6. **`scripts/local-only-import-historical.mjs`** (new file, outside
   `src/`, not part of the built/deployed app) — a disposable local D1 tool
   mirroring the existing, already-tested `importHistoricalArtifact()`
   Server Action.
   *Justification:* the previous round's acceptance explicitly asked for
   "the exact command to run/import the historical artifact locally only";
   there was no way to do that at all without either wiring a UI trigger
   into the product (which both that acceptance and this brief rule out)
   or writing a script. A script outside `src/` was the smaller, more
   reversible, more honestly-scoped choice of the two.

**Nothing else was touched.** No schema change, no changes to
`startWorkSession`/`stopWorkSession`, no new subsystem, no dashboards, no
Vault/Gateway/Activity Sensor/XP/Geladeira work.

## 8. Test / build / lint / typecheck results

All commands below were run against the real repository, after the changes
in section 7, in this order: implement → test → lint → typecheck → confirm
git scope.

| Check | Result |
|---|---|
| `node --test src/modules/**/*.test.mjs` | **75/75 pass** (73 from the P0 round + 2 new: the session-history join/order/limit tests) |
| `npx eslint .` (repo-wide) | **clean**, no output |
| `npx tsc --noEmit` | **clean**, no output |
| `git status --short` | 4 files modified beyond the P0 round's own diff (`productivity/page.tsx`, `work-sessions/{core,data,integration.test}`), 2 new paths (`src/app/productivity/sessions/`, `scripts/`) — plus the P0 round's already-known diff, now including the drizzle-regenerated `0012_melted_mole_man.sql`/`0012_snapshot.json` in place of my hand-written migration (§4) |

`next build` and `opennextjs-cloudflare build/preview` were **not** run to
a working result in this session, for the same structural reason as the P0
round: this session's bridge to your repository runs on Linux ARM64 and
reads `node_modules` compiled for darwin-arm64, so anything shelling out to
`workerd`/`esbuild`'s native binary fails here. `tsc --noEmit` already
confirms every file in this round type-checks under the same
`tsconfig.json` Next's own build would use; §4's runbook gives you the
exact commands to run the real build yourself.

## 9. Deferred decisions (explicit, not forgotten)

Per the brief's own scope: Activity Sensor implementation, XP/gamification,
Geladeira, and the actual historical import into any real database
(local or remote) were all deliberately not done this round. Also
deferred:

- **The unbounded Work Session duration risk (§1).** Logged as OPEN in the
  Dogfooding Log rather than fixed blind. Whether it needs an idle warning,
  a maximum duration, or nothing at all should come from watching real
  Aug 23–28 usage, per the brief's own North Star.
- **A `source`/`capture_type` column on `work_sessions`.** Documented as
  the cleanest future path (§2) but not added — no consumer needs it yet,
  and adding it now would be exactly the "fake precision" the brief warned
  against.
- **Running `scripts/local-only-import-historical.mjs` for real.** Written
  and reasoned through, but genuinely unexecuted (native-binary gap, same
  as `next build`/`wrangler`) — its first real run on your machine should
  be treated as a verification step.
- **A UI trigger for the historical import.** Still deliberately absent, by
  design, exactly as in the P0 round.

## Final status

DOGFOODING READY WITH KNOWN LIMITATIONS
