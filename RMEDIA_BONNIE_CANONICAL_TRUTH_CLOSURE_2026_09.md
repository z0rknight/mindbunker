# RMEDIA OS — Bonnie Canonical Truth Closure
**Date:** 2026-09-14 · **Status: Data-only. No deploy. Production D1 mutated (evidence-gated, backed up first).**

---

## 1. Backup

| | |
|---|---|
| Path | `mindbunker-d1-backups/mindbunker-pre-bonnie-canonical-20260914T203637Z.sql` |
| SHA-256 | `a0e281ad04b1ab5cd3a20abbd4549f946ccd67379f652bc90dcd592b1ee6a78b` |
| billing_evidence (before) | 8 |
| billing_allocations (before) | 0 |
| Taryn allocation count (before) | 0 |
| Taryn video status (before) | DONE 9 · IN_PROGRESS 6 · PLANNED 15 · READY_FOR_REVIEW 1 (31 total) |

## 2. January Evidence Decision

**WRITTEN.** Documented, itemized hour breakdown (1.5h initial cut + 0.7h
captions + 0.8h final polish = 3.0h, Jan 19–22) is strong enough to
record. No MindBunker project/video exists for this era (predates CRM
onboarding — confirmed, unchanged finding from the prior wave). Per the
mission's own §6: recorded as `billing_evidence` only, **no**
`billing_allocations` row — there is nothing canonical to attach it to,
and no video was fabricated to give it somewhere to point.

- Classification: **EXTERNAL EVIDENCE** (Notion production log) +
  **OPERATOR-CONFIRMED** (rate assumption — no contrary historical rate
  found, flagged explicitly in the row's own notes).
- Rate: $25/hr assumed for January — no evidence of a different
  historical rate exists anywhere this agent can check; documented as
  an assumption in the row itself, not silently applied.

## 3. August Evidence / Allocation

**WRITTEN**, using the **existing** `billing_evidence.id=2` row
(period 2026-07-27–2026-08-02, 320 min / $133.33 — verified by direct
query before writing, not assumed) — no new evidence row created,
exactly as instructed. A real Upwork Work Diary entry (1h30, Sunday)
falls inside this exact week.

- Method: **DERIVED_PROPORTION**, split across all 9 real videos in
  project 5 ("Bonnie - Content Waterfall," ids 6–14) — 90 minutes ÷ 9 =
  exactly 10 min/video (no remainder); $37.50 = 3750¢ ÷ 9 = 6 videos at
  417¢ ($4.17) + 3 videos at 416¢ ($4.16), summing to exactly $3750/90
  min with zero drift (verified by direct `SUM()` query post-write).
  Every allocation row's `notes` field states explicitly this is a
  project/batch-level derived share, not observed per-video time.
- Classification: **EXTERNAL EVIDENCE** (Upwork Work Diary) +
  **SYSTEM EVIDENCE** (cross-validated against real MindBunker
  billing_evidence for the same week) + **DERIVED ALLOCATION** (the
  per-video split itself).

## 4. September $12.50 Evidence Decision

**NOT WRITTEN.** Searched for independent corroboration: no Notion
block was ever provided for September (unlike January/June/July/
August), no Upwork Work Diary entry was given, and MindBunker's own
September evidence is only 13 minutes on one video (already established
as a known tracking gap, not a basis for $12.50 — $25/hr × 13min =
$5.42, which doesn't match the stated figure anyway). The $12.50 figure
has **no source beyond being stated** — writing it would mean
canonicalizing a number with the exact same circularity the mission's
own §9 explicitly warns against ("Do NOT automatically canonicalize it
only because it was stated"). Classified: **OPERATOR-CONFIRMED MANUAL
FACT, insufficient independent provenance to write.** If a specific
source surfaces later (a Notion note, a Work Diary entry, anything with
its own independently-checkable artifact — matching how Dave's existing
$100 MANUAL entry has a real Wise payment link as its own provenance),
this becomes writable then.

## 5. Exact billing_evidence Writes

| id | contract | period | minutes | rate | gross | source |
|---|---|---|---|---|---|---|
| **9** (new) | 1 (Taryn) | 2026-01-19 – 2026-01-22 | 180 | $25 | **$75.00** | MANUAL |

## 6. Exact billing_allocation Writes

9 rows, ids 1–9, `billing_evidence_id=2`, one per video id 6–14, method
`DERIVED_PROPORTION`, 10 minutes each, amount $4.17 (ids 6,7,8,9,10,11)
or $4.16 (ids 12,13,14). Verified sum: **$37.50 / 90 minutes exactly.**

## 7. Allocation Methodology

See §3. Deterministic remainder distribution (first 6 of 9 videos by id
get the extra cent) — arbitrary but deterministic, since the amount is
explicitly a derived batch share, not a claim about which specific
video took longer.

## 8. No-Double-Count Checks

- `billing_allocations` for evidence id=2: sum $37.50 ≤ evidence gross
  $133.33 ✓. Sum 90 min ≤ evidence 320 min ✓.
- Table was empty before this write (verified) — no prior allocation to
  collide with.
- Idempotency: both inserts use `WHERE NOT EXISTS` guards (period+source
  for evidence; evidence_id+video_id for allocations); the status
  UPDATE only matches rows still `PLANNED`. Re-running the exact same
  script would write zero additional rows — verified by construction,
  not executed twice against production to avoid unnecessary write load.

## 9. 9 August Video Status Reconciliation

| id | Notion says | MindBunker first-party evidence | Decision |
|---|---|---|---|
| 6 | finished/delivered | real Drive share link | **DONE, delivered=true** |
| 8 | finished/delivered | real Drive share link | **DONE, delivered=true** |
| 14 | finished/delivered | real Drive share link | **DONE, delivered=true** |
| 7, 9, 10, 11, 12, 13 | finished/delivered (same batch narrative) | **none** — no URL, no crm_events | **Left PLANNED — UNKNOWN** |

Only corrected where **two independent lines of evidence converge**
(the Notion production narrative *and* a real, still-live MindBunker
delivery artifact). The other 6 have zero corroborating evidence in
MindBunker itself — a batch-level Notion narrative alone wasn't treated
as proof for videos with no individual trace, per the mission's own
"narrowest truthful state" instruction. No crm_events row was
fabricated for the 3 corrected videos (would have implied a false
"finished today" timestamp) — only `status`, `delivered`, and
`updated_at` were touched directly.

**Taryn's video status, before → after:** DONE 9→**12**, PLANNED
15→**12**, IN_PROGRESS 6 (unchanged), READY_FOR_REVIEW 1 (unchanged).
Total still 31.

## 10. Historical Jan/June Import Decision

**Not imported this wave**, per explicit instruction. January's billing
fact is now recorded (§2) without a backing project/video. June's
6-video library and the general Jan/June work-family history remain
**read + classified only** — real work, confirmed by Notion, but no
video-level import performed. Recommend importing only if a future need
depends on it (e.g. Taryn asks for the full library list specifically);
importing solely to make a dashboard count reach a rounder number would
be exactly the fake precision the mission warns against.

## 11. Operator Answer Path

- **January's $75**: visible today on the existing `/finance/contracts/1`
  page's Billing Evidence list (real UI, unchanged, already lists every
  `billing_evidence` row for the contract — the new row appears there
  automatically).
- **August's $37.50 project split**: **no existing Operator UI shows
  this.** `grep` across `src/app` confirms nothing renders
  `billingAllocations` today. This is the one real gap. Verified via
  direct query that the correct isolated number ($37.50, project 5
  only) is real and retrievable — Emmanuel can get it via a DB query or
  this report today; a small future reuse of the already-built,
  already-tested `buildClientBillingSummary`/`groupClientWorkByProject`
  pure functions (client-portal/core.ts) on an operator-authorized path
  would surface it in the UI without inventing new logic. **Not built
  this wave** — reported per the mission's own explicit "report the gap"
  option, to avoid adding UI to an already data-focused wave.

## 12. Client Work Explorer Regression

Read-only simulation against the new production data (direct SQL,
reproducing exactly what `groupClientWorkByProject` would compute):
searching "Bonnie" would now return project 5 with **3 delivered + 6
planned** (previously 0 delivered + 9 planned) and project 16 unchanged
(5 delivered). Financial payload: confirmed **still absent** for Taryn
— `portalCanSeeFinancials` was not touched (verified: still `false`).
No Client code was changed this wave; no redeploy needed or performed.

## 13. Database Integrity

`PRAGMA foreign_key_check` — clean, zero violations. No duplicate
`billing_allocations` per video. No duplicate `idempotency_key` in
`billing_evidence`. `work_sessions` count for the 9 August videos:
unchanged (0 new rows — no fake sessions). `transactions`: 19, unchanged.
`commercial_contracts`: 3 rows, unchanged. No schema change (`git diff`
confirms `src/db/schema.ts` untouched, no migration file added).

## 14. Tests

Data-only wave, no code changed. `npm test`: **1085/1085 pass**
(unchanged from before this wave — confirms nothing in the app's own
logic was disturbed).

## 15. Deploy

**None.** Data-only. Neither Operator (`1f8768d1-...`) nor Client
(`cc3befd0-...`) worker was touched or redeployed.

## 16. Final 60-Second Simulation

- **"What was done for Bonnie?"** — PASS, unchanged from the prior wave
  (Work Explorer already answered this).
- **"What is still open?"** — **now PASS**, where it was PARTIAL before:
  the 9 August videos' status is now accurate (3 real deliveries
  correctly shown, 6 honestly still PLANNED) instead of all 9 misleadingly
  reading "planned."
- **"What can we substantiate as cost?"** — **now PASS for the
  confirmed-attributable floor** ($112.50 = $75 + $37.50), which is now
  a real, queryable, DB-backed fact (via Finance for January, via direct
  query or a future small operator-UI reuse for August) — not just a
  number sitting in a markdown report.
- **True lifetime Bonnie cost** — still **PARTIAL**: September's $12.50
  deliberately unwritten (no independent evidence), June's library and
  the January/July production hours remain real-but-uncosted work.

---

## Final Structured Output

```
JANUARY $75:                 CANONICAL (billing_evidence id=9, no allocation -- no video to attach to)
AUGUST $37.50:                CANONICAL (9 billing_allocations rows against existing evidence id=2)
SEPTEMBER $12.50:             NOT SUPPORTED -- not written

CONFIRMED ATTRIBUTABLE FLOOR: $112.50

AUGUST 9 VIDEO STATUS:        GREEN (3 corrected on real evidence, 6 honestly left PLANNED/UNKNOWN)
BILLING ALLOCATIONS:          0 → 9
FAKE WORK SESSIONS:           0
TARYN FINANCIALS:             OFF (unchanged)
CLIENT WORK EXPLORER:         GREEN (verified correct via read-only simulation, no code changed)

60-SECOND WORK:                PASS
60-SECOND STATUS:              PASS
60-SECOND COST:                PASS (for the confirmed floor, from Finance/DB -- not yet from a dedicated Operator UI for the August split)
TRUE LIFETIME BONNIE COST:     PARTIAL

MIGRATIONS: NONE
CLIENT DEPLOY: NONE
OPERATOR DEPLOY: NONE
D1 MUTATION: 1 billing_evidence row (id=9), 9 billing_allocations rows (ids 1-9), 3 video_logs status corrections (ids 6, 8, 14)
```

**FINAL VERDICT:**

**GREEN — MindBunker can now answer the defensible Bonnie question**
(work, status, and a confirmed-attributable $112.50 floor), with one
remaining, precisely-named gap: **no Operator UI surfaces the August
per-project allocation yet** (a small future reuse of already-built
code, not a new feature), and September's $12.50 stays deliberately
unrecorded until it has real, independent evidence of its own.

STOP.
