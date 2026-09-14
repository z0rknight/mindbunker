# RMEDIA — Production Data Hygiene Reconciliation
**Date:** 2026-09-13/14 · **Method:** read-only `wrangler d1 execute mindbunker --remote` queries (SELECT only — every query below was a plain `SELECT`, never an `INSERT`/`UPDATE`/`DELETE`) · **Mutations performed: ZERO**

This report documents four investigations required by the Global Health Bounded Fix Round brief. Every row below is a factual finding from production. **No row was changed, deleted, or reassigned.** Every recommendation is either "no action needed" or a decision left explicitly to Emmanuel.

---

## 1. QA residue

### Finding 1.1 — client id 5, "RMEDIA Capture Release Test"
- **CURRENT FACTS:** Client `id=5`, name **"RMEDIA Capture Release Test"**, no email, `archival_state=ACTIVE_SURFACE`, created `2026-09-09`. Owns one project (`id=13`, name **"Wave 2.2 Smoke"**, `status=active`) and 7 videos.
- **WHY SUSPICIOUS:** The client name and the project name both explicitly self-identify as a test/smoke artifact from what is almost certainly the "Wave 2.2" capture-flow release referenced elsewhere in this engagement's history. One of the seven videos (`id=50`) is titled **"RMEDIA Capture Release Test — Sample"** — unambiguously synthetic.
- **CANONICAL SOURCES:** `clients`, `projects`, `video_logs` tables, read directly.
- **SAFE RECOMMENDED ACTION:** Video `id=50` ("...— Sample") — **SAFE TO REMOVE**, pending Emmanuel's confirmation. It is self-labeled test data with no real-world referent.
- **AUTO-FIX:** NO.

### Finding 1.2 — the other six videos under client id 5
- **CURRENT FACTS:** Videos `id=51..56`, titled **"10SEP-Taryn Content Waterfall_1"** through **"_6"**, all `status=PLANNED`, all attached to client `id=5` ("...Test") / project `id=13` ("Wave 2.2 Smoke") — **not** to the real Taryn Dubreuil client (`id=2`), who has an active, ongoing "Content Waterfall" content series of her own (6 real projects, 31 real videos).
- **WHY SUSPICIOUS:** The titles name a real client (Taryn) and match her real, ongoing content-naming convention exactly, but the rows sit under a client/project pair whose own names say "Test"/"Smoke." This looks like either (a) six genuine planned videos for Taryn that were created against the wrong client while testing the capture flow and never re-filed under her real client record, or (b) six purely synthetic rows that happen to reuse a realistic naming pattern for test purposes. The data alone cannot distinguish these two explanations.
- **CANONICAL SOURCES:** `video_logs` (`client_id`, `project_id`, `title`, `status`), cross-referenced against client `id=2`'s real project set.
- **SAFE RECOMMENDED ACTION:** **NEEDS HUMAN CONFIRMATION.** If (a) — Emmanuel should reassign `client_id`/`project_id` on videos 51-56 to Taryn's real client/project. If (b) — they are SAFE TO REMOVE like video 50. This round makes no assumption either way.
- **AUTO-FIX:** NO.

### Finding 1.3 — client id 2, "Taryn Dubreuil", email `taryn-test@emmanueldarosa.com`
- **CURRENT FACTS:** Real, heavily-used client — 6 projects, 31 videos, active ongoing production (Mini Series, Content Waterfall). Email domain uses a `-test@emmanueldarosa.com` pattern.
- **WHY IT LOOKED SUSPICIOUS:** The `-test@` local part pattern matches how synthetic/QA accounts are usually named elsewhere in this system.
- **CANONICAL SOURCES:** `clients`, cross-referenced project/video volume.
- **CLASSIFICATION: REAL DATA — FALSE POSITIVE.** 31 real videos of ongoing, non-trivial production work is not consistent with test residue; this is very likely just Emmanuel's own placeholder email convention for a real client relationship, not evidence the client itself is fake.
- **AUTO-FIX:** NO (no action needed at all).

### Finding 1.4 — client id 3, "RMEDIA"
- **CURRENT FACTS:** Client `id=3`, name "RMEDIA" (Emmanuel's own brand), no email, one project ("DESENVOLVIMENTO MINDBUNKER" / "MindBunker development"), one video ("overview do site", `status=IN_PROGRESS`, actively worked).
- **WHY IT LOOKED SUSPICIOUS:** A business appearing as its own "client" looks unusual at a glance.
- **CLASSIFICATION: REAL DATA — legitimate internal-use pattern** (self-tracking MindBunker's own development through the same client/project/video model used for real clients). Not test residue; no action needed.
- **AUTO-FIX:** NO.

---

## 2. The five ACTIVE-but-100%-complete projects

Query (read-only, mirrors the exact `totalVideos`/`doneVideos` SQL the app itself uses in `src/modules/projects/actions.ts`, so this reconciliation checks the same definition the UI shows Emmanuel):

| Project | id | Status | Deadline | Done / Total |
|---|---|---|---|---|
| Studio Session Arizona ft C | 4 | active | 2026-12-31 | 4/4 |
| Website Videos | 6 | active | 2027-12-31 | 1/1 |
| Meta Ads - September | 8 | active | 2026-09-04 | 2/2 |
| Short Form Videos (Dave DeMink) | 12 | active | 2028-08-11 | 10/10 |
| Bonnie @ Content Waterfall September | 16 | active | 2026-09-30 | 5/5 |

**Root cause determination:** the app's own read model is **already correct** — `getProjectNextAction` (`src/modules/projects/core.ts`) explicitly does *not* conflate "all videos done" with "project complete." It keeps `project.status` as the one canonical lifecycle field and, when `doneVideos === totalVideos && status === "active"`, surfaces the honest next action **"Move to review"** rather than silently implying completion. This is not a bug and was not touched this round.

Per-project video inspection (all 22 underlying videos across these 5 projects, checked individually): every one is `status=DONE`, `delivered=1`, and carries a real client-facing `review_url`/`published_url` (Google Drive folders) — not placeholder or test URLs. No open decisions reference any of these five projects. This is **genuinely stale project-stage data**, not a code defect: the work is finished, but nobody has advanced `project.status` from "active" to "review"/"delivered" yet.

- **SAFE RECOMMENDED ACTION:** list for Emmanuel (this table). Each of these 5 projects is a candidate for a manual status transition to "review" or "delivered" — exactly what the app's own UI already suggests via "Move to review." **No project status was changed by this investigation.**
- **AUTO-FIX:** NO.

---

## 3. Revision state divergence

Checked, across all 66 production `video_logs` rows, for any row where the four related signals (status, `delivered` flag, `revisions_count`, and the review/delivery URL fields) disagree with each other — specifically: `delivered=1` with `status != 'DONE'`, `status='DONE'` with `delivered=0`, and `revisions_count > 0` on a video whose status implies no review ever happened.

**Result: zero divergent rows found.** The full status/`revisions_count` distribution:

| Status | revisions_count | Count |
|---|---|---|
| DONE | 0 | 23 |
| DONE | 2 | 1 |
| IN_PROGRESS | 0 | 7 |
| PLANNED | 0 | 34 |
| READY_FOR_REVIEW | 0 | 1 |

The one `DONE` video with `revisions_count=2` is a legitimate historical fact (real rework happened before delivery) and is exactly the kind of row War Room's "Rework Evidence" metric is supposed to surface — not an inconsistency. No dedicated `revisions`/`video_revisions` detail table exists in the schema at all (`revisions_count` is a plain integer column on `video_logs`); the audit's "0 detailed revisions" note reflects that a more granular revision-log feature was simply never built or populated, not a data-integrity problem.

- **CLASSIFICATION:** No divergence found. **No code or data change needed.**
- **AUTO-FIX:** N/A (nothing to fix).

---

## 4. Dave DeMink — fixed quote vs. hourly contract

Full timeline reconstructed from production, read-only:

| Date (UTC) | Event |
|---|---|
| 2026-08-26 | Quote `id=1` (client 4 / Dave), **APPROVED**, **$100.00 fixed**, tied to project `id=6` / video `id=25` ("Landing Page Video," a specific one-off scope) |
| 2026-08-27 | The $100 payment is actually received (Wise link `.../TskcPNLK43Bscbw`) |
| 2026-09-03 | Commercial contract `id=2` (client 4), **HOURLY**, **$25.00/hr**, `status=ACTIVE` — created |
| 2026-09-06 | `billing_evidence` row `id=1` is manually recorded, `contract_id=2` (the hourly contract), `gross_amount=$100`, `period 2026-08-27`, `billable_minutes=18` |

**Is this a commercial contradiction?** **No.** The fixed $100 quote (2026-08-26) predates the hourly contract (2026-09-03) by 8 days and is tied to a specific, separate scoped deliverable (project 6/video 25). This is exactly the benign "historical one-off, then an ongoing hourly relationship began later" pattern the brief anticipated — not a conflict in the real commercial relationship with Dave.

**What *is* worth flagging (presentation only, not history):** the `billing_evidence` schema has no way to represent "a flat-fee quote payment" — its only shape is a contract + time period + billable minutes. So when the historical $100 payment was recorded on 2026-09-06, it was attached to the *only* contract that existed for Dave at that time (the hourly one), with `billable_minutes=18` and an implied rate of $333.33/hr — a number reverse-engineered to make $100 fall out of `18min × rate`, not a real tracked-work entry. Read literally, this row currently misrepresents an 8-day-old fixed-fee payment as 18 minutes of hourly work at over 13× Dave's real $25/hr rate.

- **ENTITY:** `billing_evidence` row `id=1` (contract_id=2, Dave DeMink)
- **WHY SUSPICIOUS:** implied rate ($333.33/hr) is wildly inconsistent with the contract's actual rate ($25/hr); the billing period (2026-08-27) predates the contract's own creation (2026-09-03) by a week — it could not have been genuine work performed under that contract.
- **CANONICAL SOURCES:** `quotes` (id=1), `commercial_contracts` (id=2), `billing_evidence` (id=1) — cross-referenced above.
- **SAFE RECOMMENDED ACTION:** this is very likely the same $100 fixed-quote payment recorded into the wrong schema slot (the app has no "quote payment" record type, only contract-linked billing evidence). Emmanuel should confirm; if so, the underlying commercial history (one $100 fixed job, then an ongoing $25/hr relationship) needs **no correction** — only, at his discretion, a clearer future representation. **The $100 amount itself and the payment's reality are not in question and should not be altered.**
- **AUTO-FIX:** NO. Commercial history was not rewritten.

---

## Summary

| # | Investigation | Mutation performed |
|---|---|---|
| 1.1 | Client 5 / video 50 (self-labeled test sample) | None — SAFE TO REMOVE flagged for Emmanuel |
| 1.2 | Client 5 / videos 51-56 (Taryn-named, wrong client) | None — NEEDS HUMAN CONFIRMATION |
| 1.3 | Client 2 (Taryn, `-test@` email) | None — false positive, no action |
| 1.4 | Client 3 (RMEDIA internal) | None — false positive, no action |
| 2 | 5 active/100%-done projects | None — listed for Emmanuel, read model already correct |
| 3 | Revision state divergence | None — zero divergent rows found, nothing to fix |
| 4 | Dave's quote vs. contract | None — confirmed legitimate history, presentation note only |

**Zero rows were inserted, updated, or deleted by this investigation, at any point.**
