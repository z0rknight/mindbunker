# MONDAY REAL-OPERATION PRE-FREEZE
## Taryn August Reference Dataset Foundation
Date: 2026-08-24 · Mode: LOCAL IMPLEMENTATION · Production: NOT TOUCHED

This document records what this round changed, and tags every claim:
**VERIFIED** (proven by an automated check run this round), **SOURCE FACT**
(a real figure Emmanuel supplied), **REPORTED** (Emmanuel's own account,
not independently verified), **DERIVED** (computed from other facts,
labeled as such wherever shown), **EXPERIMENTAL** (a deliberately rough
estimate, e.g. the tax reserve %), **DEFERRED** (explicitly not built this
round, with the reason).

---

## 1. Real Data Ingest is Product Development

The Taryn August 2026 operation is the first real dataset this schema has
to survive contact with. Every extension in this round exists because a
real, reported shape (Look Studios Session) did not fit the prior
Client → Project → Video model — not because a feature seemed clever.

## 2. Video != Deliverable != Asset

**VERIFIED.** Added `assets` (project-required, video-OPTIONAL) and kept
`video_logs` untouched in shape. An Asset is one of six provisional types:
`FINAL_DELIVERABLE`, `CLIENT_REVIEW`, `UTILITY_ASSET`, `AI_INPUT`,
`SOURCE_PREP`, `BONUS_EXTRA` (see `src/modules/assets/config.ts`). The
Look Studios fixture (Taryn's Cut 1.0/1.1/1.2, Full Cut, Color Correction
Previews, AI Processing cuts) is reproduced end-to-end against the real
migrated schema in
`src/modules/assets/look-studios-fixture.integration.test.mjs`: one
project, one video, six assets of 4+ distinct types, five with NO video
relation — asserted directly at the SQL level (FK check, integrity check,
row counts), not just app-layer validation.

## 3. Source media is referenced, not hosted

**VERIFIED.** `source_media_references` stores `approx_size_label` as
free text ("~800 GB") — never parsed into a byte count — plus `location`
and `profile`, both free text, no storage-provider coupling. Tested in
`src/modules/assets/core.test.mjs` and the Look Studios fixture test.

## 4. Operational evidence != Billing evidence != Cash movement

**VERIFIED (carried over + extended).** `work_sessions` /
`sensor_sessions` (operational), `billing_evidence` (billing),
`transactions` (cash) remain three separate tables with no destructive
derivation between them. This round added `platform_fees` and
`computeCashReconciliation` (in `src/modules/finance/core.ts`), which
always shows grossBilled / platformFeesTotal / derivedNetProceeds /
cashReceived / differenceFromDerivedNet as five separately provenance-
tagged fields — a mismatch between derived net and actual cash is
surfaced, never silently reconciled.

## 5. Client-safe views != internal economics

**VERIFIED.** The new `/crm/[id]/preview` "View as client" page
(`src/app/crm/[id]/preview/page.tsx`) calls `getClientDashboardView()` —
the EXACT function `/client/dashboard` calls — with the target clientId,
gated by `requireAuth()`. It does not re-derive a second projection. The
existing strip test (`portal projection strips identifiers and
internal-only fields`, `src/modules/client-portal/core.test.mjs`) already
proves finance/margin/fees/notes never reach this projection.

## 6. Sensor evidence requires human approval before Ledger

**VERIFIED — unchanged.** Sensor P1.1 (migration `0020_sensor_inbox_p11`,
already present from concurrent work before this round started) was not
touched. `sensor_sessions` remains `approval_state` PENDING until a human
approves it into `work_sessions` with `source = MAC_SENSOR_APPROVED`.

## 7. reviewUrl / deliveryUrl / publishedUrl are provider-independent

**VERIFIED.** `video_logs` gained `review_url` and `published_url`
(nullable, plain `ALTER TABLE ADD COLUMN`, migration `0021_easy_jocasta`).
`deliveryUrl`/`reviewUrl`/`publishedUrl` are validated with the identical
generic HTTPS-only validator — no provider name appears in the schema.

## 8. Frame.io is current P0 review infrastructure / Drive is delivery

**REPORTED**, documented only — no API integration, per explicit
deferral (§19 of the brief).

## 9. Streaming remains deferred

**DEFERRED**, unchanged — no video hosting, no DAM, per explicit
instruction.

## 10. Unknown historical facts remain unknown

**VERIFIED.** `approx_size_label` stays a string. `billing_evidence`
fields (`earning_date`, platform fee) stay nullable, never defaulted to a
computed percentage (`computeCashReconciliation` marks an empty
`platformFees` array `UNATTRIBUTED`, never assumes a rate).

## 11. Schema extensions follow defensible real evidence

**VERIFIED.** Every new table/column in this round traces to a specific
section of the brief (see the Migration Chain section below).

---

## Migration Chain

Old HEAD (start of this round): `0020_sensor_inbox_p11` (already applied
locally by concurrent work before this round began — audited, not
modified).

New HEAD: **`0021_easy_jocasta`**.

What it does:
- `CREATE TABLE assets` — §3 (VIDEO != DELIVERABLE != ASSET).
- `CREATE TABLE operating_reserve_settings` — §11 (minimal operating-cost
  reserve target; reserved-so-far stays DERIVED from transactions, never
  a second stored total).
- `CREATE TABLE source_media_references` — §4.
- `ALTER TABLE video_logs ADD review_url text` / `ADD published_url text`
  — §5/§6.

**Known limitation, documented not hidden:** the schema originally
included a DB-level CHECK constraint
(`video_logs_review_url_required_check`) enforcing "no `READY_FOR_REVIEW`
without a `review_url`." Applying it required SQLite's standard
recreate-table-to-add-CHECK pattern (`PRAGMA foreign_keys=OFF` / rebuild /
rename). This failed against the real local D1 with
`SQLITE_CONSTRAINT_TRIGGER` — **D1 does not honor
`PRAGMA foreign_keys=OFF`** during a migration, and `video_logs` has 5+ FK
referrers (`work_sessions`, `sensor_sessions`, `billing_allocations`,
`reconciliation_notes`, `assets`), so the DROP TABLE step in the recreate
is rejected. The constraint was moved to the app layer instead
(`planVideoTransition` in `src/modules/productivity/core.ts`, enforced at
every write path) — this is a real platform constraint of D1, not a
shortcut; it is called out explicitly in the schema.ts comment on
`video_logs.reviewUrl` so a future reader doesn't assume DB-level
protection that isn't there.

**Chain verification (VERIFIED, run this round):**
- `npx drizzle-kit generate` → "No schema changes, nothing to migrate" —
  schema.ts and the migration ledger agree.
- Full chain `0000` → `0021` (22 files) applied to a fresh in-memory
  SQLite database via `node:sqlite`: all statements executed cleanly,
  `PRAGMA foreign_key_check` → `[]`, `PRAGMA integrity_check` → `ok`, 34
  tables.
- Applied to the REAL local D1 (`wrangler d1 migrations apply mindbunker
  --local`): 9 commands, all ✅.
- Live D1 file read directly (bypassing D1's PRAGMA restriction on
  `wrangler d1 execute`): `integrity_check: ok`, `foreign_key_check: []`,
  real local data survived (2 clients, 1 video, all pre-existing rows
  intact), `video_logs` now has 18 columns including `review_url` /
  `published_url`.

No production migration was touched. No remote D1 command was run.

---

## Domain Model

**Client** — unchanged shape; gained a rename path (`RenameClientButton`
using the existing `updateClient({name})` action, which already accepted
a name field with no UI ever calling it that way — §7).

**Project** — unchanged shape; gained a client filter on `/projects`
(`ClientFilter.tsx`, a query-param `?client=<id>` filter, §8) and two new
child collections: Assets and Source Media References, both rendered on
`/projects/[id]`.

**Video / Work Unit** — gained `reviewUrl`/`publishedUrl` (nullable);
`READY_FOR_REVIEW` is this repo's existing name for the brief's
`AWAITING_CLIENT_APPROVAL` concept (reused, not duplicated, per the
brief's own "do not replace useful existing vocabulary" instruction) and
now requires a non-empty `reviewUrl` to enter that state
(`planVideoTransition`).

**Asset** — new. `projectId` required, `videoId` optional, `type` one of
6 provisional values, `status` DRAFT/READY/DELIVERED, plus
review/delivery/published/thumbnail URLs, `deliveredAt`, `notes`,
`source` (provenance). CRUD in `src/modules/assets/actions.ts`, UI in
`src/app/projects/[id]/AssetsPanel.tsx`.

**Source Media** — new. `projectId` required, `approxSizeLabel`/
`location`/`profile`/`notes` all free text and all optional. CRUD in
`src/modules/assets/actions.ts`, UI in
`src/app/projects/[id]/SourceMediaPanel.tsx`.

**Contract** — unchanged shape (already existed from the prior round);
gained a direct main-nav entry (`/finance/contracts`, added to
`Sidebar.tsx` right below Sessions, §9) instead of being one click deep
inside Finance only.

**Sessions** — untouched, per §22 ("do not redesign the Ledger").

**Billing** — `billing_evidence` unchanged shape; gained `platform_fees`,
`billing_allocations`, `reconciliation_notes` (all created LAST round,
wired to actions.ts THIS round — see Finance below).

**Finance** — see below.

---

## Look Studios Fixture

`src/modules/assets/look-studios-fixture.integration.test.mjs` builds the
real migration chain in-memory, then inserts:

```
Client: Taryn Dubreuil
Project: Look Studios Session
  Source Media: ~800 GB / NAS-Dropbox / LOG
  Video: "Full Cut" (1 real production unit)
  Assets (6, project-scoped, 4 distinct types):
    Taryn's Cut 1.0        CLIENT_REVIEW    (no video link)
    Taryn's Cut 1.1        CLIENT_REVIEW    (no video link)
    Taryn's Cut 1.2        CLIENT_REVIEW    (no video link)
    Color Correction Prev.  UTILITY_ASSET    (no video link)
    AI Processing cuts      AI_INPUT         (no video link)
    Full Cut — delivery     FINAL_DELIVERABLE (linked to the video)
```

Assertions (all pass): 6 assets on one project; 5 of 6 have no video
relation; asset types are genuinely heterogeneous; exactly 1 video row
(outputs are NOT flattened into fake separately-contracted videos); the
source media size stays the string `"~800 GB"`; FK check empty; integrity
check ok.

---

## Client Portal

**Emmanuel can preview:** `/crm/[id]/preview` — admin-gated
(`requireAuth()`), calls the exact same `getClientDashboardView()` the
real client dashboard calls. Shows Ready-for-review / In-production /
Recent-deliveries sections using the same `VideoCard` component the real
portal uses, so what Emmanuel sees IS what the client would see, not an
approximation.

**What the client sees, by video state:**
- `READY_FOR_REVIEW` → "Review video" → `reviewUrl`
- has `publishedUrl` → "View published" → `publishedUrl`
- otherwise (delivered) → "Watch" → `deliveryUrl`

Same precedence implemented in both `VideoCard.tsx` (dashboard) and the
legacy `/client/[token]` flow.

**What the client never sees** (VERIFIED by the existing strip test,
unchanged this round): finance, owner pay, margin, platform fees, debts,
taxes, internal Sensor diagnostics, internal notes.

---

## Finance

Newly wired this round (schema for these existed from the prior round;
`actions.ts` had never been extended for them):

- **Platform fees**: `recordPlatformFee`, `getPlatformFeesForEvidence`,
  `getCashReconciliationForEvidence` (returns the full gross/fee/
  derived-net/cash/difference picture, provenance-tagged).
- **Billing allocations**: `recordBillingAllocation`,
  `getBillingAllocationsForEvidence`,
  `previewDerivedBillingAllocation` (preview-only — never persists a
  DERIVED_PROPORTION slice without an explicit follow-up call).
- **Reconciliation notes**: `recordReconciliationNote`,
  `getReconciliationNotesForContract`.
- **Debts** (§16, REQUIRED): `createDebt`, `recordDebtPayment` (creates
  an ordinary `expense` transaction carrying `debtId`; remaining balance
  is always DERIVED — `originalAmount` minus the real payment sum, never
  a stored, driftable column), `getDebts`, `getDebtById`. UI:
  `/finance/debts` (list) and `/finance/debts/[id]` (detail + payment
  history + Record Payment).
- **Subscriptions** (§17/§18, REQUIRED): `createSubscription`,
  `recordSubscriptionPayment`, `updateSubscriptionStatus`,
  `getSubscriptions`, `getSubscriptionSummary` (monthly recurring /
  annual committed / monthly-equivalent, grouped by currency — never
  summed across currencies). UI: `/finance/subscriptions`.
- **Freelance income requires a client** (§6, REQUIRED FIX): the ONE form
  that ever defaulted its category to "Freelance" (`AddIncomeButton` in
  `src/components/ui/QuickActions.tsx`) now shows a required client
  picker whenever the category is "Freelance" (case-insensitive), backed
  by `validateFreelanceIncomeInput` at the app layer AND
  `transactions_freelance_requires_client_check` at the DB layer (added
  last round, unchanged).
- **Operating cost reserve** (§11): minimal single-target extension —
  `operating_reserve_settings` (one row: target amount + currency) plus a
  DERIVED "reserved so far" (sum of expense transactions tagged category
  = `Operating Reserve`). NOT a treasury subsystem, NOT a Wise
  integration — a compact card on `/finance` (`OperatingReserveControl`).

**Not touched, still correct:** Tax Reserve (`TaxReserveControl`, still
labeled "experimental," still just one editable percentage), RMEDIA
Cash / Owner Pay flow (`getRmediaCashSummary`).

---

## Sensor / Screen Time

**Sensor P1.1**: audited, not modified. Migration `0020_sensor_inbox_p11`
(concurrent work, present before this round started) remains untouched;
`sensor_sessions.approval_state` gate, the `MAC_SENSOR_APPROVED`
provenance rewrite, and the one-Ledger-session-per-approval invariant are
all unchanged. Full test suite green with this migration in the chain —
no regression introduced.

**Screen Time / Sensor dedup (§13)**: **DEFERRED, explicitly.** A
defensible dedup between Apple Screen Time snapshots and Sensor-derived
desktop activity was not attempted this round — summing them risks
inventing a combined total that double-counts overlap on the primary
Mac, which the brief explicitly forbids. Per the brief's own stated
fallback ("present the sources separately"), `/health/screen-time` now
links to `/productivity/sensor` with an explicit note that the two are
NOT summed. A real dedup (by day, by overlapping time window, with
provenance) is future work, not implemented here.

---

## CRM / Projects

- **Client rename** (§7, REQUIRED FIX): `RenameClientButton.tsx` — inline
  rename control next to the client header on `/crm/[id]`, using the
  existing `updateClient({name})` action. Client ID and every child
  record (projects, videos, contracts, transactions) are untouched by a
  rename.
- **Project filtering** (§8): `/projects?client=<id>` via `ClientFilter`,
  a plain query-param dropdown — no new Projects surface, no redesign.
- **CRM / Leads** (§15): audited, not modified — `clients.status = 'lead'`
  + `opportunityStage` (existing `OPPORTUNITY_STAGES` enum) already
  supports tracking a real lead through a status lifecycle without fake
  fields. Judged sufficient as-is; no changes made this round.

---

## Tests

Before this round: 218 passing (0 failing).
After this round: **227 passing (0 failing)**.

New this round: 8 asset/source-media validation tests
(`src/modules/assets/core.test.mjs`), 1 Look Studios end-to-end fixture
integration test, 1 new productivity core test (the
`READY_FOR_REVIEW` review-URL invariant), plus 2 existing tests updated
to account for the new invariant/fields rather than left broken
(`productivity/core.test.mjs`'s transition-vocabulary test now supplies a
`reviewUrl`; `client-portal/core.test.mjs`'s portal-projection deepEqual
now expects `reviewUrl`/`publishedUrl: null`).

Every acceptance criterion from the brief's §21 that requires an
automated check has one:
A (client rename — manual UI, not unit-tested, low risk: thin wrapper
over an already-tested action), B (project filtering — UI-only), **C/D**
(asset multiplicity/independence — `assets/core.test.mjs` +
Look-Studios fixture), **E** (review invariant —
`productivity/core.test.mjs`), F (provider independence — by
construction, no provider string anywhere in schema/validation), **G**
(source media — `assets/core.test.mjs` + fixture), H (Sensor — unchanged,
still covered by its own existing suite), I (Screen Time — deferred, see
above), **J/K/L** (Finance separation / Debt / Subscription — carried
over from last round's `finance/core.test.mjs`, still green), M (Tax —
unchanged), **N** (client safety — `client-portal/core.test.mjs` strip
test, unchanged, still green), **O** (Look Studios fixture — new
integration test), P (existing behavior — full suite green).

---

## Build

- `npx tsc --noEmit` — **clean**, run repeatedly through this round after
  every schema/type change.
- `npx eslint` on every touched file — **clean**, zero warnings.
- `git diff --check` — **clean**, no whitespace errors.
- `npx next build` — **could not be completed in this sandboxed session.**
  Both the Turbopack and webpack backends were SIGKILL'd partway through
  compilation across five separate attempts (fresh `.next`, reduced
  `--max-old-space-size`, `--experimental-build-mode compile`), on a
  sandbox reporting 3.8GB total RAM. This reads as an environment memory
  ceiling in this particular bridge session, not a code defect —
  typecheck, lint, and all 227 tests pass cleanly, and the same
  FUSE-related `.next` unlink issue from prior rounds also reappeared
  before the OOM kills. **This is the one item in this round that could
  not be independently verified end-to-end; Emmanuel should run
  `npm run build` directly on the Mac outside this bridge session before
  Monday's Codex handoff.**

---

## Local Runtime

Not started this round (`next dev` was not run) — build verification was
prioritized given the token budget; typecheck/lint/tests stood in as the
available proxy for code health. Recommend Emmanuel run `npm run dev`
locally as part of his own QA pass below.

---

## Human QA — ordered checklist for the real Tuesday workflow

1. **Client** — open Taryn (or create if needed). Try the new ✎ Rename
   control; confirm the client's projects/videos still show correctly
   after a rename.
2. **Projects** — open `/projects`, use the client filter dropdown to
   isolate Taryn's projects among others.
3. **Project → Look Studios Session** — create the project if not already
   present. Add a Source Media reference (~800 GB / NAS or Dropbox /
   LOG). Add a few Assets of different types (a `CLIENT_REVIEW` cut, a
   `UTILITY_ASSET`) at project level — confirm no video is required.
4. **Video** — plan the "Full Cut" video (or similar). Open it, paste a
   review URL, try moving it to "Ready for review" — confirm it's
   blocked without the URL and succeeds with it. Add a `publishedUrl`
   once content is live.
5. **View as client** — from the client header, click "👁 View as
   client." Confirm nothing financial is visible and the review/delivery
   links behave as expected for each video's status.
6. **Contract** — confirm/create the Upwork Hourly $25/hr contract (now
   reachable directly from the main sidebar under Contracts).
7. **Billing** — register the real Upwork billing evidence (Aug 10-16,
   910 min, $379.17), then record the platform fee ($37.92). Confirm the
   reconciliation view shows gross/fee/derived-net honestly, without
   assuming the actual cash figure.
8. **Cash** — when the real Wise deposit lands, record it as its own
   event and confirm the discrepancy (if any) stays visible rather than
   being silently "corrected."
9. **Finance → Debts** — add one real debt, record one payment, confirm
   the remaining balance is correct.
10. **Finance → Subscriptions** — add one real subscription (e.g. Adobe),
    confirm the monthly-equivalent math, add an annual one and confirm
    it is NOT treated as monthly.
11. **Finance → Operating Reserve** — set a target if useful, record a
    contribution, confirm the "remaining to target" number.
12. **Sensor** — confirm Sensor Inbox / approval flow is unaffected by
    this round (unchanged; spot-check one approval produces exactly one
    Ledger session).

---

## Production Candidates

Nothing was deployed. Candidates for Codex's Monday production pass, in
rough priority order: migration `0021_easy_jocasta` (Assets, Source
Media, video review/published URLs, operating reserve settings); the
Freelance-requires-client fix (already DB-enforced from last round, now
also UI-enforced); the debts/subscriptions Finance surfaces; the client
preview route; the review-URL invariant in `planVideoTransition`.

## Deferred

- Screen Time ↔ Sensor dedup (§13) — presented separately, not merged.
- Project Economics full read model (§12) — only the domain groundwork
  (Assets, Source Media) is in place; no aggregated time/revenue-per-hour
  view was built this round.
- Quote generation / Lead → Quote → Contract promotion (§15) — documented
  direction only, not built.
- Operating reserve treasury automation (no Wise API — by design, §19).
- `next build` end-to-end verification in this bridge session (see
  Build section above) — needs to be run on the Mac directly.

## Files Changed

Schema: `src/db/schema.ts`, `src/db/migrations/0021_easy_jocasta.sql` (+
`meta/0021_snapshot.json`, `meta/_journal.json`).

New modules: `src/modules/assets/{config,core,actions,core.test,
look-studios-fixture.integration.test}.{ts,mjs}`.

Finance: `src/modules/finance/{actions,core}.ts` extended (debts,
subscriptions, platform fees, billing allocations, reconciliation notes,
operating reserve, Freelance wiring); new UI at
`src/app/finance/{debts,subscriptions}/**`,
`src/app/finance/OperatingReserveControl.tsx`.

Productivity: `src/modules/productivity/{core,actions}.ts` (reviewUrl
invariant + field threading), `src/app/productivity/{VideoEditor,
VideoOperationsCard}.tsx`, `src/modules/productivity/core.test.mjs`.

Client Portal: `src/modules/client-portal/{core,data}.ts`,
`src/app/client/dashboard/VideoCard.tsx`,
`src/app/client/[token]/page.tsx`,
`src/app/crm/[id]/preview/page.tsx` (new),
`src/modules/client-portal/core.test.mjs`.

CRM / Projects: `src/app/crm/[id]/{page,RenameClientButton}.tsx` (new
component), `src/app/projects/{page,ClientFilter}.tsx` (new component),
`src/app/projects/[id]/{page,AssetsPanel,SourceMediaPanel}.tsx` (2 new
components).

Health: `src/modules/caffeine/core.ts` (reconciliation helper),
`src/modules/analytics/service.ts` (caffeine ratio bug fix),
`src/app/health/screen-time/page.tsx` (Sensor-separate note).

Nav: `src/components/layout/Sidebar.tsx` (Contracts entry),
`src/components/ui/QuickActions.tsx` (Freelance client picker).
