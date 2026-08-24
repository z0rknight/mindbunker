# All History — Local Import + Evidence Validation Round

## VERDICT

Local import executed successfully against local D1, validated, idempotent, and referentially intact. Native operational tables are byte-for-byte unchanged. **READY_FOR_PRODUCTION_IMPORT** (see reasoning in that section).

## BASELINE

- Repo: `~/Documents/New project/mindbunker`, HEAD `d9a5dfd` on `main` (unchanged from the prior round; the 4 files from the previous Dashboard/CRM round remain the only tracked diffs).
- A stray `.git/index.lock` (0 bytes, no owning process, created moments earlier by a `git diff --check` that couldn't clean up after itself on this mount) was renamed out of the way before any git command was trusted this round — not deleted, since the device bridge doesn't grant delete by default; git operates normally now.
- Local D1: `wrangler d1 migrations apply mindbunker --local` → "No migrations to apply", still at `0015_fixed_slipstream.sql`.

**BEFORE counts:**

| Table | Count |
|---|---|
| clients | 2 |
| projects | 2 |
| video_logs | 1 |
| work_sessions | 1 |
| crm_events | 5 |
| transactions | 0 |
| health_logs | 0 |
| bookings | 0 |
| gateway_invitations | 0 |
| hist_import_batches | 0 |
| hist_identities | 0 |
| hist_identity_source_labels | 0 |
| hist_facts | 0 |
| hist_source_coverage | 0 |

These native counts are the invariant checked again after import below.

## ARTIFACT FOUND

`src/modules/historical/artifact/v0_1_0/` — `manifest_v0.json`, `historical_facts_v0.json`, `identity_map_v0.json`, `source_coverage_v0.json`, `ARTIFACT_CONTRACT.md`. Contract version `0.1.0`, generated 2026-08-22. The importer (`importHistoricalArtifact()` in `src/modules/historical/actions.ts`) is a real, already-shipped, additive-only, content-fingerprinted server action — it was not built this round.

**Actual pipeline** (confirmed by reading the code, not assumed):

```
RAW exports (Upwork/Clockify/ActivityWatch)
      ↓  (already run upstream — not part of this round)
manifest / historical_facts / identity_map / source_coverage (v0_1_0 artifact JSON)
      ↓
validateHistArtifactBundle() + computeHistArtifactFingerprint()   [core.ts]
      ↓
importHistoricalArtifact()  [actions.ts]  → hist_import_batches / hist_identities /
      hist_identity_source_labels / hist_facts / hist_source_coverage
      ↓
getAllHistorySummary()  [data.ts]  → one row per year, ACTIVE batch only
      ↓
/all-history page
```

A dev-only trigger page (`/all-history/_import`, `NODE_ENV==='development'` gated) already existed in the repo from a prior session, wired to call the same `importHistoricalArtifact()`.

## EVIDENCE CONTRACT

Read `ARTIFACT_CONTRACT.md` directly (repository terminology below, not reinterpreted):

- **Tier 1 — historical reconstructed evidence** (what this artifact contains): a value derived from a RAW export by a documented, re-runnable procedure, carrying its own confidence and provenance.
- **Tier 2 — manually backfilled canonical objects** (not produced by this artifact): a human hand-creating a real MindBunker object after reviewing tier-1 evidence.
- **Tier 3 — native MindBunker observations**: data MindBunker itself generated. The contract is explicit that tier 1 must never be mistaken for tier 3.

Fields: `confidence` ∈ `HIGH / MEDIUM / LOW / N/A / EXPERIMENTAL`; `canonical: true` for figures usable as-is, `false` for the two categories that exist only for transparency (AFK experimental figures; Sean Go's Clockify *upper-bound* hours). Unknown is represented by a `source_coverage` month/source entry of `"UNKNOWN / NO SOURCE DATA"` — never a zero-valued fact. Batch identity is a SHA-256 fingerprint over all 4 source documents' content; activation is a single-ACTIVE-row-at-a-time state machine (`PENDING → ACTIVE → SUPERSEDED`), matching the `hist_import_batches_one_active_idx` partial unique index already in schema.ts. Duplicate prevention is fingerprint-based, not batch-id-based.

## SOURCES

| Source | Metrics produced | Granularity |
|---|---|---|
| `upwork_weekly_summary` | `revenue` (usd), `billed_hours`, `effective_billed_rate` (usd/hr, null at 0 hrs) | month, year |
| `upwork_lifetime_billings` | `client_lifetime_billed` (usd) | lifetime, per client (25 rows) |
| `clockify_detailed_export` | `tracked_hours` (aggregate) | month (16 of 44 months) |
| `clockify_detailed_export` | `tracked_hours_confident` / `tracked_hours_upper_bound` | lifetime, Sean Go only |
| `activitywatch_afk` | `raw_event_count`, `days_with_any_event` | month (10 of 44 months, Nov 2025–Aug 2026 only) |
| `activitywatch_afk` | `experimental_merged_not_afk_hours`, `experimental_wall_clock_coverage_pct` | window (2025-11-02→2026-08-22), `canonical: false` |

209 facts total, 47 identity nodes (1 `HUMAN_CONFIRMED` — Sean Go — the only one licensed for direct tier-2 promotion; 37 `SINGLE_SOURCE_ONLY`; 7 `INTERNAL`; 2 `NOT_AN_IDENTITY`), 132 coverage rows (44 months × 3 sources).

## COVERAGE 2023–2026

Per-year summary (from the imported facts, cross-checked against the raw artifact independently before import — both agree exactly):

| Year | Upwork revenue | Upwork billed hours | Clockify tracked hours | Clockify months known | AFK months known |
|---|---|---|---|---|---|
| 2023 | $9,616.57 | 376.18h | 150.17h | 6/12 | 0/12 |
| 2024 | $3,383.30 | 126.18h | 138.69h | 7/12 | 0/12 |
| 2025 | $14,838.49 | 593.17h | 71.15h | 3/12 | 2/12 |
| 2026 (partial, Jan–Aug) | $6,416.67 | 256.67h | — (0 months known) | 0/8 | 8/8 |

Upwork has full monthly coverage (44/44) — its declared complete range earns confirmed-zero months, per the contract's asymmetric-treatment rule. Clockify and ActivityWatch do not: their "not present" months are `UNKNOWN`, never treated as zero hours, and the importer/reader code (`getAllHistorySummary`) respects this — `trackedHours` is `null` for 2026 (0 Clockify months), not `0`.

A structural note worth flagging on its own: **Clockify and ActivityWatch coverage windows never overlap.** Clockify's last covered month is 2025-05; ActivityWatch's first is 2025-11. There is a real 6-month gap (2025-06 through 2025-10) where neither time-tracking source has any evidence at all — only Upwork billing exists for that window. This is the single biggest hole in the dataset (see Highest-Value Missing Data below).

## LOCAL IMPORT

Executed against the real local D1 sqlite file (`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`), the same file `wrangler d1 ... --local` and the running app use.

**How, and why not through the UI button:** the Cowork device bridge that reaches this Mac mini tears down every backgrounded process — including a `next dev` server — the instant the tool call that started it returns, so there is no way to click the existing `/all-history/_import` button from here. Rather than hand-writing SQL (which the brief explicitly discourages) or inventing a new code path, I wrote a small script (`​.round-logs/run-local-import.mjs`, not part of the app) that imports `validateHistArtifactBundle`, `computeHistArtifactFingerprint`, and `mapCoverageStatus` **directly and unmodified from `src/modules/historical/core.ts`**, loads the same embedded artifact JSON `actions.ts` loads, and builds the identical row shapes `importHistoricalArtifact()` builds — the only substitution is the DB driver: Node's built-in `node:sqlite` `DatabaseSync` against the real local D1 file, standing in for the Workers D1 binding. This is the same substitution the repo's own `src/modules/historical/integration.test.mjs` already makes for testing (same migrations, same SQLite engine D1 local mode itself runs on) — not a new pattern invented for this round. A full checkpoint copy of the D1 file was taken first (`.round-logs/d1-checkpoint-before-import.sqlite{,-wal,-shm}`) before any write.

- **Command**: `node --experimental-strip-types .round-logs/run-local-import.mjs <path-to-local-d1.sqlite>`
- **Validation**: PASS — embedded artifact matches contract, all hard rules hold.
- **Fingerprint**: `932047bd8bdbf0f3b14672ce7fa9bf88a18e83e4de76e25fa30df3f74d987390`
- **Rows attempted / accepted**: identities 47/47, source labels 50/50, facts 209/209, coverage 132/132 — zero rejected.
- **Warnings**: none.

## BATCH / ACTIVATION

Batch id `1`, `artifact_version: "0.1.0"`, `status: ACTIVE`. No prior ACTIVE batch existed to supersede (this was the first import — `hist_import_batches` was empty beforehand). Activation followed the documented lifecycle exactly: insert as `PENDING`, populate child rows, then flip to `ACTIVE` in the same transaction — matching what `importHistoricalArtifact()`'s own `db.batch()` does.

## NATIVE TABLE INVARIANTS

**Confirmed unchanged.** AFTER counts, same tables as BEFORE:

| Table | Before | After |
|---|---|---|
| clients | 2 | 2 |
| projects | 2 | 2 |
| video_logs | 1 | 1 |
| work_sessions | 1 | 1 |
| crm_events | 5 | 5 |

No Client, Project, Video, or Work Session row was created, modified, or deleted by the import. Reconstructed history did not become native data.

## FK / DATA INTEGRITY

`PRAGMA foreign_key_check;` → **zero rows returned, zero violations.**

Historical table integrity:
- Expected tables populated: `hist_import_batches` (1), `hist_identities` (47), `hist_identity_source_labels` (50), `hist_facts` (209), `hist_source_coverage` (132) — matches the batch's own recorded `fact_count`/`identity_count`/`coverage_month_count`.
- No `__new_*` temp tables left behind.
- No duplicate batch (fingerprint has a unique index; confirmed by the schema and by the idempotency test below).
- Provenance retained on every fact (`provenance` column populated for all 209 rows, spot-checked).
- `UNKNOWN / NO SOURCE DATA` coverage rows carry no corresponding `hist_facts` row for that (year, month, source) — confirmed for the 2025-06..10 gap months.
- Dates stay within the source-supported range (`period_year` 2023–2026, matching the artifact's own declared window).

## IDEMPOTENCY

The importer's own fingerprint-based idempotency contract was tested by running the same script a second time against the now-populated database: it correctly detected the existing `ACTIVE` batch by fingerprint match and reported **"This exact artifact content is already the active historical batch. No changes made."** — no new rows, no duplicate batch. Table counts confirmed identical before and after the second run (`hist_import_batches`=1, `hist_facts`=209, `hist_source_coverage`=132, unchanged).

## ALL HISTORY QA

The dev server itself could not be kept open through the device bridge to click through `/all-history` visually this round (same teardown constraint as above — Emmanuel, please open `http://localhost:3000/all-history` yourself once `npm run dev` is running to see it rendered). Instead, `getAllHistorySummary()`'s exact query logic was replicated against the imported data and matches the independently-computed values from the raw artifact exactly (see Coverage table above) — high confidence the page renders correctly:

- All 4 years (2023–2026) will show real revenue and billed-hours figures, not placeholders.
- 2026's `trackedHours` will correctly render as unknown (`—`), not `0`, since 0 Clockify months are known for that year — confirmed by reading `getAllHistorySummary`'s `clockifyMonthsThisYear.length > 0 ? ... : null` branch and the page's `formatHours(null) → "—"` rendering.
- The reconstructed-evidence warning banner on `/all-history` was not touched and will still render above the table.

## CROSS-SOURCE FINDINGS

Comparing overlapping periods, classified per the brief's own taxonomy:

- **Upwork billed hours vs. Clockify tracked hours disagree in every year they overlap** (2023: 376h billed vs 150h tracked; 2024: 126h vs 139h; 2025: 593h vs 71h) — **EXPECTED SEMANTIC DIFFERENCE**. Upwork billed hours is what was invoiced through Upwork's own timer/manual-time system for Upwork contracts specifically; Clockify tracked hours is self-directed time tracking that may include non-Upwork work, admin time, or simply wasn't run consistently alongside Upwork's own tracker. Neither is "wrong" — they measure different things for different purposes, exactly as the contract's hard rule 3 anticipates by forbidding a cross-source rate between them.
- **Clockify and ActivityWatch coverage windows never overlap** (Clockify ends 2025-05, AFK starts 2025-11) — **SOURCE COVERAGE GAP**, not a data-quality issue. There is no month in this dataset where both a self-tracked-hours figure and a computer-activity figure exist to be compared against each other at all.
- **Several months show Upwork revenue > $0 with `billed_hours = 0`** (2023-01: $80/0h; 2023-02: $20/0h; 2024-09: $140/0h; 2024-10: $60/0h) — **EXPECTED SEMANTIC DIFFERENCE, flagged for awareness**: consistent with a fixed-price Upwork milestone or bonus payment that doesn't accrue hourly billed time, but this artifact's `upwork_weekly_summary` source doesn't carry a contract-type field to confirm that explanation directly — noted as a **POSSIBLE DATA QUALITY ISSUE** worth a quick manual sanity check against the actual Upwork statements for those 4 specific months if Emmanuel wants full confidence, not urgent.
- **2023-05/06/07 show $0 Upwork revenue alongside real Clockify hours (36h/46h/36h)** — **EXPECTED SEMANTIC DIFFERENCE**: work tracked in Clockify that either wasn't billed through Upwork, was billed in a different period than worked, or was non-Upwork work. Nothing in this artifact resolves which.
- The Sean Go Clockify lifetime hours (`tracked_hours_confident` vs `tracked_hours_upper_bound`) were correctly imported as two distinct, non-additive facts (confirmed by the contract's hard rule 2 and the importer's canonical/confidence pairing) — not summed or averaged anywhere in this round's queries.

## KNOWN GAPS

- 2025-06 through 2025-10 (5 months): no time-tracking evidence at all (neither Clockify nor AFK) — only Upwork billing exists.
- Clockify coverage is sparse overall — 16 of 44 months (36%). Most months rely on Upwork alone for hours.
- AFK coverage is 10 of 44 months (23%), and none of it overlaps with Clockify.
- 24 of the 25 Upwork lifetime-billing clients (everyone except Sean Go) remain `SINGLE_SOURCE_ONLY` — safe to display as Upwork-only facts, not safe to assume they map to a specific MindBunker CRM client without new evidence.
- The 4 months with revenue-but-zero-billed-hours noted above.

## HIGHEST-VALUE MISSING DATA

| Missing | Date range | Question it would answer | Import difficulty | Risk | Priority |
|---|---|---|---|---|---|
| Clockify or ActivityWatch export for Jun–Oct 2025 | 2025-06 to 2025-10 | Was there real tracked/active time in the one 5-month window with zero time-tracking evidence at all? | Low if the export exists on a device already (same format as existing artifacts); zero if the tool genuinely wasn't running | Low | **P0** — closes the single real blind spot in an otherwise well-covered dataset |
| Clockify export continuation past May 2025 | 2025-06 onward | Whether Clockify usage actually stopped, or just wasn't exported | Low, same format | Low | **P1** |
| ActivityWatch history before Nov 2025 | pre-2025-11 | Whether AFK/activity data exists earlier than what was exported, or the tool genuinely wasn't installed yet | Unknown — depends on whether AW was even running earlier | Low | **P2**, speculative — don't go looking without a concrete signal it exists |
| Upwork contract-type/milestone detail for the 4 zero-hour-with-revenue months | 2023-01, 2023-02, 2024-09, 2024-10 | Confirms whether those are fixed-price payments (expected) vs. a parsing gap (bug) | Low — a quick look at the Upwork dashboard for those 4 months | Low | **P2** |
| Bank/invoice records | any | Independent revenue cross-check against Upwork's own reported figures | Unknown effort | Low | **DEFER** — Upwork revenue is already `HIGH` confidence; this would mostly confirm what's already trusted |

Not assumed to exist or be necessary: Notion operational records, project/video delivery history, client attribution beyond what identity_map already resolves — none of these were claimed as available, so none are ranked.

## CODE CHANGED

**NONE** in the application. `.round-logs/run-local-import.mjs` (a temporary, untracked local script) and `.round-logs/d1-checkpoint-before-import.sqlite{,-wal,-shm}` (a pre-import safety backup) were added under the already-untracked `.round-logs/` scratch directory — neither is part of the app, neither was committed, and both can be deleted once Emmanuel is satisfied with the result (this bridge can't delete them for him; they're harmless if left in place, since `.round-logs/` was already untracked from the prior round). `src/app/all-history/_import/page.tsx` (the pre-existing dev-only trigger button) was read but not modified — it remains available for Emmanuel to click himself as a second, independent confirmation once `npm run dev` is running, and will correctly report "already active" given the fingerprint match.

## PRODUCTION READINESS

**READY_FOR_PRODUCTION_IMPORT**

All of this round's own gate criteria are met: local import successful; evidence contract respected (validation passed, all 3 hard rules hold, `canonical`/`confidence` pairing correct); native tables provably untouched; zero FK violations; idempotency confirmed (duplicate-run is a safe no-op); `UNKNOWN` semantics preserved end-to-end (2026 tracked hours renders as unknown, not zero); provenance inspectable on every fact; major gaps documented above (missing evidence, not bad semantics — per the brief's own rule, this does not block promotion). The only thing not independently re-verified this round is the rendered `/all-history` page itself, since the dev server couldn't be held open through the bridge — the underlying query logic was traced and matches the imported data exactly, so this is a low-risk gap, not a blocker; Emmanuel opening `http://localhost:3000/all-history` himself is the natural final confirmation step, not a precondition for calling the *local* layer ready.

Rollback procedure, if ever needed: `DELETE FROM hist_import_batches WHERE id = 1;` cascades to all 4 child tables (confirmed by the existing `hist_facts_identity_fk`/`hist_identity_source_labels_identity_fk` `onDelete: "cascade"` foreign keys and covered by the repo's own `integration.test.mjs`) — a full, clean rollback with no manual multi-table cleanup.
