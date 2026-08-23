# Sprint 1.2 P0 — Historical Reference Layer + All History — Round Report

Date: 2026-08-22
Scope: MINDBUNKER — SPRINT 1.2 P0 / Historical Reference Layer + All History,
per the approved Sprint 1.2 architecture review (design intent) and the real
MindBunker repository (implementation ground truth).

## 1. Repository verification

Phase 0 inspected the real repository at
`/Users/emmanueldarosadillenburg/Documents/New project/mindbunker` before any
code was written, per the mandatory brief. Findings that shaped this round:

- Stack: Next.js 16 (App Router) + React 19 + TypeScript 5.9 (strict) +
  Tailwind CSS 4, deployed via OpenNext to Cloudflare Workers, persisted via
  Drizzle ORM (`drizzle-orm/d1`) over Cloudflare D1. Bun for package
  management, Wrangler 4.124 for D1/Worker tooling.
- 11 existing tables in `src/db/schema.ts`, 11 prior migrations
  (`0000`–`0011`), the latest being the Work Session P0
  (`0011_brainy_ultimo.sql`), already active in production per
  `.kilocode/rules/memory-bank/context.md`.
- House conventions confirmed and followed throughout this round: module
  layout `src/modules/{name}/{config,core,data,actions}.ts` +
  `*.test.mjs`/`*.integration.test.mjs`; Server Components by default,
  `"use server"` actions for mutations; `getAuthenticatedDb()` as the DB
  entry point; partial unique indexes for single-row invariants (the
  `work_sessions_one_open_idx` pattern); `CONSTRAINT ... CHECK(...)` for
  domain invariants; `node --test` (not Jest/Vitest) with `node:sqlite`
  `DatabaseSync` for integration tests run directly against the real
  migration SQL.
- No `.github/` workflows exist — no CI auto-deploy-on-push risk from this
  branch's changes.

**Critical environment constraint, confirmed empirically this round and
material to what "Local Validation" and "Production Policy" can mean here:**
this session's `device_bash` bridge runs in a Linux ARM64 VM, not the actual
macOS machine, but reads the same `node_modules` `bun install`'d on the real
Mac (compiled for darwin-arm64). Any tool that shells out to a native binary
fails:

- `npx next build` → fails downloading `@next/swc-linux-arm64-gnu` (no
  network egress from this bridge to `registry.npmjs.org`):
  `TypeError: fetch failed ... getaddrinfo EAI_AGAIN registry.npmjs.org`.
- `npx wrangler d1 migrations list mindbunker --local` (and by the same
  mechanism, `d1 execute --local`, `d1 migrations apply --local/--remote`,
  `preview`, `deploy`, `whoami`) → fails inside `workerd`'s own loader:
  `@cloudflare/workerd-darwin-arm64 present but this platform needs
  @cloudflare/workerd-linux-arm64`.
- `npx drizzle-kit generate` fails the same way on `@esbuild/darwin-arm64`
  vs `@esbuild/linux-arm64` (confirmed in Phase 0, not re-run this round
  since the migration below was hand-written specifically because of this).

Pure-JS tooling is unaffected: `node --test`, `eslint`, `tsc --noEmit` all
ran correctly against the real repository and gave trustworthy signal (see
§6). I did not attempt to work around the native-binary gap (e.g. by
running `bun install` inside this bridge), since that would overwrite the
real Mac's darwin-arm64 binaries with Linux ones on a mounted filesystem
shared with your actual dev environment.

## 2. Schema

Five new tables, strictly additive, appended to `src/db/schema.ts`
(`hist_import_batches`, `hist_identities`, `hist_identity_source_labels`,
`hist_facts`, `hist_source_coverage`). None of the 11 existing tables were
modified. Design notes, since these deviate in one respect from the
Sprint 1.2 review's originally *proposed* names/shapes (per your instruction
that the review is design intent, not a blueprint to implement blindly):

- **One ACTIVE batch at a time**, enforced at the DB level by a partial
  unique index (`hist_import_batches_one_active_idx`), the same structural
  pattern already used for `work_sessions_one_open_idx`.
- **`client_hist_identity_link` was dropped**, per your explicit P0 scope
  reduction — nothing here links a `hist_identity` to a real `clients` row.
- **Identity linkage is by `(batch_id, canonical_id)`, not an internal
  autoincrement FK.** I designed this against the artifact shape itself:
  `hist_facts` and `hist_identity_source_labels` reference identities by the
  same natural key the JSON artifact already uses
  (`canonical_id`, e.g. `"client:sean_go"`), via a composite foreign key to
  a unique index on `hist_identities(batch_id, canonical_id)`. This was a
  deliberate correction I made mid-implementation: an internal-ID-based FK
  would have forced the importer to insert identities first, read back
  DB-generated IDs, and only then build fact/label rows — breaking single-
  transaction atomicity. The natural-key design lets every row for a batch
  be constructed up front and inserted atomically (see §3).
- CHECK constraints enforce every enum (batch status, identity type,
  resolution status, period granularity, source, confidence, coverage
  status) at the DB level, matching house convention.
- Coverage status strings are stored as DB-safe enum values
  (`DATA_PRESENT` / `UNKNOWN_NO_SOURCE_DATA`) rather than the contract's
  space/slash-containing display strings (`"DATA PRESENT"` /
  `"UNKNOWN / NO SOURCE DATA"`); `mapCoverageStatus()` in `core.ts` is the
  single point of translation, and the UI layer (`HIST_COVERAGE_STATUS_LABELS`
  in `config.ts`) can translate back for display without meaning drift.

**Migration** `src/db/migrations/0012_historical_reference_layer.sql` was
**hand-written**, matching `drizzle-kit`'s exact output conventions observed
in `0004` and `0011` (backtick-quoted identifiers, tab-indented columns,
`--> statement-breakpoint` separators, `CONSTRAINT "name" CHECK(...)`,
composite `FOREIGN KEY (...) REFERENCES ...(...)` syntax) — `drizzle-kit
generate` cannot run in this environment (see §1). The corresponding entry
was appended to `src/db/migrations/meta/_journal.json` (idx 12, tag
`0012_historical_reference_layer`).

**Gap I could not close in this environment, and did not attempt to fake:**
`drizzle-kit` also maintains a per-migration schema snapshot
(`src/db/migrations/meta/0011_snapshot.json` is 1,373 lines — a full
internal representation of every table, with UUIDs chaining each snapshot
to the previous one via `id`/`prevId`). I did **not** hand-write
`0012_snapshot.json`. Getting this subtly wrong would not break anything
today, but could cause `drizzle-kit generate` to produce a corrupt or
spurious diff the next time you add a migration, since it uses the last
snapshot as its diff baseline. **Before your next schema change, please run
`bun run db:generate` once in your own terminal** — with `schema.ts` already
containing the five new tables, drizzle-kit should either (a) produce the
matching `0012_snapshot.json` with no SQL diff (confirming my hand-written
migration matches what it would have generated), or (b) surface a
discrepancy for us to reconcile. Either outcome is informative and safe;
skipping it is the one place this round leans on your local machine rather
than fully closing the loop itself.

## 3. Import

`src/modules/historical/` — a new module, following house layout:

- **`config.ts`** — enums/constants mirroring `ARTIFACT_CONTRACT.md`
  (supported contract version `0.1.0`, sources, confidence levels, identity
  types, resolution statuses, period granularities, the fixed
  `ALL_HISTORY_YEARS = [2023, 2024, 2025, 2026]`).
- **`core.ts`** — pure functions only, no DB/network access:
  `validateHistArtifactBundle()` checks contract-version compliance and all
  three of the artifact contract's numbered hard rules that are mechanically
  checkable from the JSON shape (EXPERIMENTAL facts must be
  `canonical:false`; `tracked_hours_upper_bound` must be `canonical:false`;
  `effective_billed_rate` must come from `upwork_weekly_summary`).
  `computeHistArtifactFingerprint()` hashes the four source documents'
  content with `crypto.subtle.digest("SHA-256", ...)` (the same
  edge-compatible primitive the gateway module already uses for token
  hashing) for idempotency detection.
- **`data.ts`** — `getActiveHistBatch()` and `getAllHistorySummary()`,
  read-only, `"server-only"`, used by the All History page.
- **`actions.ts`** — `"use server"` `importHistoricalArtifact()`. It:
  1. Validates the embedded artifact bundle; refuses to proceed if invalid.
  2. Computes the content fingerprint. If a batch with that exact
     fingerprint already exists and is `ACTIVE` or `SUPERSEDED`, it returns
     immediately with `skipped: true` and makes **no writes** — re-running
     the importer against unchanged content is a true no-op.
  3. Otherwise inserts (or reuses, if a prior attempt left one `PENDING`) a
     `hist_import_batches` row, then builds every `hist_identities` /
     `hist_identity_source_labels` / `hist_facts` / `hist_source_coverage`
     row from the embedded JSON and the two status-transition updates
     (supersede the previous `ACTIVE` batch, activate the new one) as a
     **single `db.batch()` call** — D1's atomic multi-statement transaction,
     the same primitive already used elsewhere in this codebase. Row arrays
     are chunked at 40 rows/statement to stay well clear of SQLite's
     999-bound-parameter ceiling on the widest table (`hist_facts`, ~15
     columns × 40 = 600 params). Either the whole batch lands, or none of it
     does — there is no state where facts exist without their batch, or a
     batch is `ACTIVE` with only some of its rows present.

**The four artifact JSON files + `ARTIFACT_CONTRACT.md` were embedded
verbatim** at `src/modules/historical/artifact/v0_1_0/`, re-fetched fresh
from the project docs immediately before writing (not transcribed from
memory) specifically to guarantee byte-for-byte fidelity, and imported as
static JSON modules (`resolveJsonModule` is already `true` in
`tsconfig.json`) — a Cloudflare Worker has no runtime filesystem, so this is
the only way for the importer to read them.

**`importHistoricalArtifact()` is not wired to any UI trigger in this
round.** No button, no auto-run-on-page-load. Running it against this
database is exactly the kind of production mutation your Data Safety
protocol gates (see §7) — I built the mechanism and validated it (§6), but
did not invoke it, and it should only be run deliberately after that
protocol is followed.

## 4. Reconciliation

Before writing the module, I re-verified the embedded `historical_facts_v0.json`
is internally consistent (this also catches any transcription error from
hand-authoring ~150KB of JSON):

- Yearly Upwork `revenue` and `billed_hours` facts equal the sum of that
  year's monthly facts, for all of 2023–2026, to the cent/hundredth (all
  diffs `0.00`).
- Clockify `tracked_hours`: 2023 sums to **150.17h across 6 known months**
  (Apr, May, Jun, Jul, Aug, Dec) and 2024 sums to **138.69h across 7 known
  months** (Jan, Feb, Jul, Aug, Oct, Nov, Dec) — matching the correction I
  made during the Phase 1 architecture review (an earlier draft of that
  review had these wrong; the corrected figures are what's in the DB-bound
  artifact now).
- Record counts: 209 facts, 47 identities, 44 coverage-months — matching
  the freshly re-fetched project docs exactly (identity count is 47, not
  the ~41 an earlier compacted summary of this conversation estimated; 47
  is what the source `identity_map_v0.json` actually contains: 1
  `HUMAN_CONFIRMED` + 24 `SINGLE_SOURCE_ONLY` Upwork clients + 20 Clockify
  labels (`SINGLE_SOURCE_ONLY`/`INTERNAL` mixed) + 2 `NOT_AN_IDENTITY`
  extraction artifacts).

## 5. All History

`src/app/all-history/page.tsx` — read-only Server Component, YEAR |
REVENUE | BILLED HOURS | TRACKED HOURS | COVERAGE for 2023–2026, sourced
only from the currently `ACTIVE` `hist_import_batches` row via
`getAllHistorySummary()`.

- Tracked Hours renders as `N.NNh · X/Y mo. known` (matching the corrected
  Phase 1 mockup), never fabricating a full-year figure from partial
  months.
- Coverage renders as `Upwork X/Y · Clockify X/Y · AFK X/Y` per year, from
  `hist_source_coverage`, so a reader can see at a glance which sources
  actually have data for that year without inferring it from figures being
  present or absent.
- If no batch is `ACTIVE` yet (true right now — nothing has been imported,
  see §3/§7), the page renders a clear "not yet imported" empty state
  instead of a table of zeros or blanks.
- A permanent banner frames every figure as reconstructed historical
  evidence, not native MindBunker data, and points to
  `ARTIFACT_CONTRACT.md`.

**Nav:** added to the desktop sidebar only (`src/components/layout/Sidebar.tsx`),
via a `desktopOnly` flag on the nav item and a filter on the mobile
bottom-tab-bar map, so the mobile tab bar stays at its existing 7
destinations rather than growing to 8. This follows the brief's framing
directly: a reference/reporting surface, reachable, but not inserted into
the mobile bar you use for daily Productivity execution.

## 6. Regression

All commands below were run against the real repository in this round,
after the schema/migration/module/page/nav changes above, and before
writing this report.

| Check | Result |
|---|---|
| `node --test src/modules/**/*.test.mjs` | **73/73 pass** (59 pre-existing + 14 new: 7 unit tests in `historical/core.test.mjs`, 7 integration tests in `historical/integration.test.mjs`) |
| `npx eslint .` (repo-wide) | **clean**, no output |
| `npx tsc --noEmit` | **clean**, no output |
| `git status --short` | 3 files modified (`Sidebar.tsx`, `schema.ts`, `_journal.json`), 3 new paths (`src/app/all-history/`, `src/db/migrations/0012_historical_reference_layer.sql`, `src/modules/historical/`) — nothing else touched |

The new integration tests apply **all 13 migrations, `0000` through `0012`,
in order** via `node:sqlite` `DatabaseSync` against a fresh in-memory
database (not just the new one in isolation), and additionally exercise:
the one-`ACTIVE`-batch partial unique index actually rejecting a second
concurrent `ACTIVE` row; the fingerprint unique index rejecting a duplicate;
the composite `(batch_id, canonical_id)` foreign key actually rejecting a
fact that references a nonexistent identity; cascading delete from
`hist_import_batches` correctly clearing every dependent table; and that an
`UNKNOWN_NO_SOURCE_DATA` coverage month has no corresponding fact row to
accidentally sum as zero.

`next build` and `opennextjs-cloudflare build/preview/deploy` were **not**
run to a working result — see the environment constraint in §1. This is a
sandbox limitation, not a defect signal from the code itself; `tsc --noEmit`
already confirms every file in this round type-checks under the same
`tsconfig.json` Next's own build would use.

## 7. Production

**No production database was touched in this round.** Specifically:

- `importHistoricalArtifact()` was written and unit/integration-tested
  against fixture databases, but **never invoked against your real D1
  database** (local or remote) — nothing in this round called it.
- `wrangler d1 migrations apply` (local or remote) was **not** run — it
  cannot run in this sandbox (§1), and even if it could, applying it
  without your Data Safety steps first would violate the brief.
- The Data Safety protocol you specified (pre-migration backup, current
  Client/Project/Video/WorkSession count comparison, a D1 Time Travel
  bookmark before any mutation) **could not be executed from this session**
  — `wrangler d1 execute --local/--remote` and `d1 time-travel` both depend
  on the same native `workerd` binary that fails here. This has to happen
  in your own terminal.

**Runbook for you, in order, before this goes anywhere near production:**

1. In your own terminal (real macOS, not this bridge): `bun run db:generate`
   to get drizzle-kit's own `0012_snapshot.json` and confirm it produces no
   SQL diff against my hand-written `0012_historical_reference_layer.sql`
   (see the gap noted in §2).
2. Record current production counts: `Client`, `Project`, `Video`,
   `WorkSession` row counts, via `wrangler d1 execute mindbunker --remote
   --command "SELECT ..."` — these must be identical after this migration,
   since it is purely additive.
3. Take a D1 Time Travel bookmark (or your usual pre-migration backup step)
   immediately before applying.
4. `wrangler d1 migrations apply mindbunker --local` first, confirm the
   local DB looks right, then `--remote`.
5. Re-check the four counts from step 2 are unchanged.
6. Only then, deliberately, decide whether/when to call
   `importHistoricalArtifact()` (there's no UI button for it yet by design
   — see §3) — that's the point where the five `hist_*` tables actually get
   rows, and it's still trivially reversible (`DELETE FROM
   hist_import_batches WHERE id = ...` cascades everything away, per the
   integration test in §6).

I did not `git commit` these changes — they're on disk, staged for your
review, per the framing of this whole round.

## 8. Deferred (explicitly out of scope for this P0, not forgotten)

Per your brief's stated scope reduction, none of the following were
attempted: identity-linking to real `clients` rows (`client_hist_identity_link`
was dropped from the schema entirely, not just left unused), Geladeira,
XP, or dashboards beyond the single All History table. Also deferred,
noted for a future round rather than silently dropped:

- The `drizzle-kit`-generated `0012_snapshot.json` (§2) — needs your local
  machine.
- Actually running the importer against any real database (§7) — needs
  your Data Safety steps first.
- A UI affordance to trigger the import (deliberately not built this round).
- `next build` / `opennextjs-cloudflare build` verification (§1, §6) — needs
  your local machine or a CI runner that isn't this sandbox.

---

SPRINT 1.2 P0 ALL HISTORY READY FOR HUMAN REVIEW
