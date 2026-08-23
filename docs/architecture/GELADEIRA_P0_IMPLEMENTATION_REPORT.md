# Geladeira P0 Implementation Report

Sprint 1.2 — Client Archival / Operational Visibility
Round: MINDBUNKER — GELADEIRA P0 IMPLEMENTATION
Date: 2026-08-23

Scope reminder (from the round instructions, carried through unmodified):
Geladeira is a reversible operational archival/visibility state on `clients`,
orthogonal to `clients.status`. It is not delete, not churn, not historical
identity, not project archival, not XP, not a new relationship entity. No
broad CRM redesign, no Historical identity work, no XP, no Activity Sensor,
and no production deploy this round.

## Schema

Added two columns to `clients`, additive only, no destructive backfill:

```ts
archivalState: text("archival_state", { enum: ["ACTIVE_SURFACE", "GELADEIRA"] })
  .notNull()
  .default("ACTIVE_SURFACE"),
archivedAt: integer("archived_at", { mode: "timestamp" }),
```

Migration `src/db/migrations/0013_demonic_paper_doll.sql`:

```sql
ALTER TABLE `clients` ADD `archival_state` text DEFAULT 'ACTIVE_SURFACE' NOT NULL;
ALTER TABLE `clients` ADD `archived_at` integer;
```

Design notes:
- `archival_state` deliberately has no SQL `CHECK` constraint. This matches
  the existing convention in this schema — `clients.status` itself has no
  CHECK, while stricter tables like `work_sessions.activity_type` and the
  `hist_*` tables do declare one. Enum-typed `text()` columns without an
  explicit `check(...)` call are the lighter house convention used
  elsewhere for `clients`, so `archival_state` follows it for consistency
  rather than introducing a new stricter pattern on this one column.
- No equivalent representation (separate join table, status enum value,
  etc.) was judged materially safer than two columns directly on `clients`
  — a join table would be over-engineering for a single reversible boolean
  concern, and folding it into `status` would violate the explicit
  orthogonality requirement. Implemented as specified.
- Verified locally against isolated D1 (`wrangler d1 migrations apply
  mindbunker --local`): both pre-existing clients defaulted to
  `ACTIVE_SURFACE` / `archived_at: null` after migration, and
  `PRAGMA foreign_key_check` returned empty.

## Archive semantics

Pure domain logic lives in `src/modules/crm/core.ts` (no framework/db
imports), covered by `src/modules/crm/core.test.mjs` (10 tests):

- `planArchivalTransition(currentState, targetState)` computes whether a
  transition is a no-op (already in the target state → idempotent, no
  write) or a real transition, and never touches `status`,
  `opportunityStage`, `converted`, or `contacted`.
- `archiveClient(id)` / `reactivateClient(id)` in
  `src/modules/crm/actions.ts` use this planner, then `db.batch([...])` an
  update (setting only `archivalState` + `archivedAt`) plus a `crmEvents`
  insert recording the transition, and revalidate the CRM/project/
  productivity paths that surface the client. Repeated calls in the same
  state are safe no-ops that still return success.
- No child table (`projects`, `videoLogs`, `crmEvents`, financial tables,
  `work_sessions`) is ever written to on archive/reactivate except the new
  audit `crmEvents` row.

Verified in `src/modules/crm/geladeira.integration.test.mjs` (11 tests)
against the real `0013_demonic_paper_doll.sql` migration run over a SQLite
fixture seeded with two pre-existing clients (one with a project, video,
and CRM event attached) — matching the "existing clients" requirement.

## Visibility

Centralized on the `ACTIVE_SURFACE` / `GELADEIRA` constants and
`isActiveSurface()` in `src/modules/crm/core.ts`; each query layer applies
its own explicit, reviewed predicate rather than a global filter:

- `src/modules/crm/page.tsx` — CRM main list splits into an always-visible
  active/leads table and a collapsed-by-default `<details>` Geladeira
  section (reuses the existing `ClientTable`, no new UI system).
- `src/modules/projects/actions.ts` — `getProjectsOverview()` excludes
  projects whose client is in `GELADEIRA`. `getProjectWorkspace()` (direct
  `/projects/[id]` access) is intentionally untouched, per the direct-URL
  requirement.
- `src/modules/productivity/actions.ts` — `getAllVideoLogs()` excludes
  videos whose client is `GELADEIRA` (videos with no client, i.e.
  `clientId IS NULL`, are kept — a Geladeira client should hide its own
  videos, not unrelated ones). `getProductivityQuickOptions()` excludes
  `GELADEIRA` clients from both the active-project rows and the client
  picker rows used by Quick Actions/current-work selectors.
  `videoRows` (a separate query in the same function) was deliberately
  left unfiltered — flagging this as an open scoping question rather than
  guessing: if it feeds a different, already-scoped surface, leave as is;
  if it feeds the same "current work" picker as the other two, it should
  get the same filter in a follow-up. Documented in code, not silently
  decided.
- `src/modules/analytics/service.ts` — `activeClients` now also excludes
  `GELADEIRA`, since it is explicitly an "active" count.
- Direct Client (`/crm/[id]`), Project (`/projects/[id]`), and Video URLs
  are all untouched and remain reachable regardless of archival state —
  no route-level guard was added.
- All-History / historical reference surfaces were not touched at all —
  Geladeira and Historical identity remain fully independent, as required.
- Finance history queries were not touched — no financial query was
  modified to filter on `archivalState`.
- Gateway/Vault URLs keep their existing auth semantics unchanged (see
  next section).

## Vault/Gateway

No new auth model, no automatic revocation. `src/app/crm/[id]/
GeladeiraControl.tsx` (new client component) renders, alongside the
Move-to-Geladeira button, an amber warning box — *"This client still has
active private access. Archiving does not revoke it."* — whenever the
client's existing Gateway invitation has `status === "active"`, with a
"Revoke access" button that calls the pre-existing
`revokeGatewayInvitation(clientId, invitationId)` action directly. Nothing
in `archiveClient()`/`reactivateClient()` touches Gateway/Vault tables.

## Delete safety

`deleteClient()` in `src/modules/crm/actions.ts` now fails closed:
before deleting, it runs `getClientDependencyCounts()` (six `count(*)`
queries: projects, videos, CRM events, gateway invitations, bookings,
intake submissions) and refuses the delete — no cascade, no partial
mutation — if `clientHasProtectedHistory(counts)` is true, returning a
descriptive error built by `describeProtectedHistory(counts)` (e.g. "This
client has 2 projects, 5 videos... Move it to Geladeira instead, or
remove the related records first."). `src/app/crm/ClientActions.tsx` now
awaits the result and surfaces the error to the operator instead of
firing-and-forgetting.

This is the smallest safe guard that fits the current app, per the
instruction to prefer failing closed over a broader deletion-system
redesign: permanent delete stays a distinct affordance from Geladeira,
still requires the existing confirmation, and is blocked outright whenever
protected history exists — Geladeira is now the normal path for removing
a dormant client from view. No "stronger administrative override" path
was added, since the instructions treat refusal as an acceptable minimum
and building one would have meant designing new admin/auth scaffolding
out of scope for this round.

## Regression

- `npm test` — 96/96 passing (includes the 21 new Geladeira tests: 10 unit
  in `core.test.mjs`, 11 integration in `geladeira.integration.test.mjs`).
- `npm run lint` — clean.
- `npm run typecheck` — clean.
- `git diff --check` — clean (no whitespace-conflict markers).
- `npm run build` (Next.js production build) — succeeded cleanly,
  compiled, typechecked, and generated all static/dynamic routes with no
  errors.
- OpenNext/Cloudflare build (`npx opennextjs-cloudflare build`) —
  succeeded: Next.js build, middleware/static/cache bundling, and the
  Cloudflare Worker bundle (`.open-next/worker.js`) all completed with no
  errors.
- Isolated D1 migration chain (`wrangler d1 migrations apply mindbunker
  --local`) — applied cleanly against a fresh local D1, migration 0013
  included.
- `PRAGMA foreign_key_check` against that local D1 after migration and
  after exercising archive/reactivate — empty (no FK violations).

All required regression gates pass. Environment note for the record: this
round ran on the user's device bridge, whose Linux sandbox is a different
CPU architecture (linux-arm64) than the macOS machine `node_modules` was
originally installed on, so several native optional-dependency binaries
(esbuild, workerd, @next/swc, lightningcss, @tailwindcss/oxide) had to be
fetched for that architecture before the two build steps above would run
at all, and the two build steps above were ultimately run from a plain
(non-FUSE-mounted) filesystem copy of the repo rather than in place,
because the mounted repo's filesystem bridge blocks the file deletions
Next.js performs during build finalization. This is a sandbox tooling
detail, not a statement about the app; both builds are green.

Test scenarios 1–14 from the round brief, mapped to where they're covered:

1. Existing clients default `ACTIVE_SURFACE` — `geladeira.integration.test.mjs`
2. Archive preserves `status`/`opportunityStage`/`converted`/`contacted` — `core.test.mjs`, `geladeira.integration.test.mjs`
3. Archive preserves Projects/Videos/CRM history rows — `geladeira.integration.test.mjs`
4. Reactivate restores visibility — `geladeira.integration.test.mjs`
5. Archive is idempotent — `core.test.mjs`
6. Reactivate is idempotent — `core.test.mjs`
7. Geladeira client hidden from default CRM list — code path in `crm/page.tsx`; see Human QA for browser verification
8. Geladeira client's Projects hidden from default Projects overview — `getProjectsOverview()` filter; see Human QA
9. Geladeira client's Videos hidden from default Productivity overview — `getAllVideoLogs()` filter; see Human QA
10. Direct Project/Video URLs remain valid — untouched by design (`getProjectWorkspace()` not filtered); see Human QA
11. Vault/Gateway capability unchanged on archive — `archiveClient()` never writes gateway tables; confirmed by reading `gateway/actions.ts` (no coupling exists to remove)
12. Historical reference tables/identity untouched — no historical module file was modified this round (`git status` confirms)
13. Client deletion cannot silently destroy protected history — `clientHasProtectedHistory()` guard in `deleteClient()`, covered by `core.test.mjs`
14. FK integrity — `PRAGMA foreign_key_check`, confirmed empty after migration and after archive/reactivate exercises

Scenarios 7–10 are verified at the query/filter-logic level (tests 8–9
above exercise the underlying counts) but not yet driven through an actual
rendered page in a browser — see Human QA below for exact steps.

## Human QA

Not performed this round — no browser automation tooling was invoked
against a running dev server. Recommended steps for a human (or a
follow-up round with browser tooling) before sign-off:

1. `npm run dev`, open `/crm`. Archive a client with an active project and
   video. Confirm it disappears from the main table and appears only in
   the collapsed Geladeira section; confirm the Geladeira stat card count
   increments.
2. Open `/projects`. Confirm that client's project(s) no longer appear.
3. Open `/productivity`. Confirm that client's video(s) no longer appear
   in quick-action/current-work pickers.
4. Copy the direct `/projects/[id]` and `/client/[token]`-style URLs for
   the archived client's project/video and load them directly — confirm
   they still render normally.
5. Reactivate the client from `/crm/[id]`; confirm it reappears on all
   three surfaces above.
6. On a client with an active Gateway invitation, archive it and confirm
   the amber warning + "Revoke access" button render correctly.
7. Attempt to delete a client with projects/videos; confirm the refusal
   message appears and nothing is removed. Delete an empty lead with no
   related rows; confirm it succeeds.
8. Responsive check at 390×844, 768×1024, and 1440×900 on `/crm`,
   `/crm/[id]`, and `/projects` — confirm no horizontal overflow and no
   console errors. Not performed this round; flagging as outstanding
   rather than assuming pass.

## Production

No production changes were made or attempted this round, consistent with
every prior round's instruction not to deploy. No production Cloudflare
account was inspected, no production D1 backup, SHA-256, or Time Travel
bookmark was taken, and no Worker version/rollback point was recorded —
none of that access exists in this session.

Runbook for a human operator to take this to production once Human QA
above is signed off:

1. Confirm the canonical Cloudflare account/D1 database ID matches
   `wrangler.jsonc` (`mindbunker` binding) — do not assume.
2. Inspect the production migration ledger (`wrangler d1 migrations list
   mindbunker --remote`) and confirm it is at 0012 before applying 0013.
3. Take a D1 backup / export and record its SHA-256.
4. Record a Cloudflare D1 Time Travel bookmark (restore point) immediately
   before migrating.
5. Record current Client / Project / Video / Work Session row counts.
6. Run `wrangler d1 migrations apply mindbunker --remote` (additive-only:
   two `ALTER TABLE ADD COLUMN` statements, no data rewrite).
7. Re-run the row counts from step 5 and confirm they are unchanged;
   confirm all existing clients now read `archival_state =
   'ACTIVE_SURFACE'`; run a remote `PRAGMA foreign_key_check` equivalent
   if available, or spot-check FK integrity via targeted queries.
8. Deploy the application build to a 0% (canary/staged) Worker version
   alongside the current production version; note the current production
   Worker version ID as the rollback target.
9. Smoke-test the staged version against the now-migrated database
   (archive/reactivate a test client, confirm visibility rules, confirm
   delete-guard).
10. Promote to 100% only if the smoke test is fully green; otherwise roll
    back the Worker to the recorded version ID. The migration itself is
    additive and does not need to be rolled back even if the application
    rollout is.

## Deferred

Explicitly not implemented this round, per the round's constraints:

- XP / Loyalty scoring of any kind.
- Historical identity linking — untouched, verified via `git status`.
- Activity Sensor.
- Advanced analytics or a new dashboard beyond the single existing
  `geladeiraCount` stat card added to the CRM header.
- Automatic churn detection or reactivation scoring/suggestions — moving
  a client to or from Geladeira remains a fully manual, explicit operator
  action.
- A stronger/administrative override path for deleting a client that has
  protected history — deletion is refused outright in that case rather
  than gated behind a second, stronger flow.
- Filtering `videoRows` inside `getProductivityQuickOptions()` — left
  unfiltered pending clarification on whether it feeds the same
  current-work surface as the two rows next to it that were filtered (see
  Visibility section).
- Any production database mutation or Worker deployment.

GELADEIRA P0 READY FOR HUMAN REVIEW
