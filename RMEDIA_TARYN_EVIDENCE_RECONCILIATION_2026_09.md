# RMEDIA OS — MONDAY PILOT PROGRAM
## Wave 2: Taryn Evidence Reconciliation

**Mode:** Read-only evidence reconciliation. No mutation, no deploy, no redesign, no Sidecar work.

---

## 0. Incident Gate

Checked before starting, per explicit instruction:

| Check | Result |
|---|---|
| Operator Worker version | `cf8b54bc-d0ce-42ad-ad74-acbcfb4af81b`, 100% traffic — unchanged since the incident's last-known-good state |
| Sensor catalog polling | 35/35 success over the preceding ~25 minutes (13:43–14:07 UTC), continuing clean through this wave's start (14:08 UTC) |
| One active-ish video route opens | `/mindbunker/productivity?video=2` → 307 (healthy redirect), no 1102 |
| One DONE video route opens | `/mindbunker/productivity?video=1` → 307 (healthy redirect), no 1102 |
| Current 1102 pattern | None observed |

**Incident remains closed. Proceeding.**

---

## 1. Executive Verdict

Taryn Dubreuil is a **real, long-standing Upwork client whose actual commercial relationship is far larger and older than MindBunker's canonical record currently shows.** Upwork's own Work Diary reports **856 hours 40 minutes** tracked "since start" and **$19,027.50** in lifetime earnings — MindBunker's `clients.created_at` for her is `2026-08-22`, and her 5 recorded transactions total only $1,372.50 (about 7% of her real lifetime Upwork earnings). This is not a data-quality failure in the way a bug is: MindBunker was simply **started partway through an already-mature relationship**, and nobody has gone back to backfill the history — exactly the situation this wave exists to characterize, not to fix by itself.

The good news: everything that **is** in MindBunker for Taryn checks out. Every one of her 5 recorded income transactions matches, with high confidence, to a specific real Upwork weekly payout (§11). Her current $25/hr Upwork contract is correctly represented. Her project/video structure maps cleanly onto real, evidenced work families from her chat history and Drive folder structure (§8). No fabricated history was found; no code bug was found in her data. The gaps are entirely **missing history**, not **wrong history** — a materially easier problem, and one this report deliberately does not try to fully close in one pass, per the mission's own instruction not to manufacture the past.

**Bonus finding:** MindBunker's schema already has a purpose-built table (`billing_evidence`, with an explicit `source: "UPWORK_REPORT"` enum value) designed to hold exactly this kind of external Work Diary evidence, completely separate from Work Sessions or Transactions — and it currently has **zero rows** for Taryn. This is the correct, low-risk place to import the 7 weeks of Work Diary data this wave directly evidenced via screenshot (§13, correction #1), without touching canonical intentional-time truth (Work Sessions) at all.

---

## 2. Evidence Sources Available

All located and read this wave, outside the git worktree (on the local filesystem, not committed to any repo):

| Source | Path | Size | Coverage |
|---|---|---|---|
| **A1. Chat log ("starting 8 May")** | `~/Desktop/Taryn Dashboard, reality check/taryn chat log starting 8 may.txt` | 2,143 lines | May 8, 2026 onward |
| **A2. Chat log ("Jan Feb")** — found, not explicitly named in the mission brief but clearly the same relationship | `~/Documents/Overview Primeiro Trimestre 2026/Taryn Chat Log Jan Feb.txt` | 2,016 lines | January 2026 (references "february's workshop" as upcoming) |
| **B. Upwork Work Diary** | `~/Desktop/Taryn Dashboard, reality check/Screenshot 2026-09-14 at 10.00.{17,24,33,38,43,48,54}.png` + `10.01.25.png` | 8 screenshots | 7 weekly Work Diary views (Jul 27 – Sep 13, 2026) + 1 Drive folder view |
| **C. Upwork transaction report** | `~/Desktop/Taryn Dashboard, reality check/taryn@upwork-transactions report.txt` | 355 lines, 50 entries | Jul 21, 2025 – Sep 23, 2026 (partial — see §3) |
| **D. MindBunker D1** | production, read-only, via `wrangler d1 execute --remote` | — | Current canonical state |
| **Supporting: chat screenshot** | `~/Desktop/Taryn Dashboard, reality check/chat screenshot for date information .png` | 1 image | A Sep 7–8, 2026 exchange in a separate "media-projects" workspace (Taryn tagged VIP) |
| **Prior report** | `RMEDIA_MONDAY_PILOT_RECONCILIATION_2026_09.md` (this worktree) | — | Wave 1's read-only D1 snapshot, used as a baseline |

All four evidence types the mission named (A. chat log, B. Work Diary, C. transactions, D. D1) were available and used. The Google Drive folder screenshot referenced in mission §8 is the same file as the 8th Work Diary screenshot (`10.01.25.png`) — it shows the `@TARYN → Taryn - 2026` Drive hierarchy.

---

## 3. Evidence Limitations

Stated explicitly, per instruction not to invent missing material:

1. **The Upwork transaction report is a partial export.** Summing its 50 rows gives **$13,713.75 settled + $150.00 pending = $13,863.75**. Upwork's own Work Diary UI reports **$19,027.50 "since start"** — a gap of **$5,163.75 (27% of lifetime earnings)** not present in any file available to this session. The report's earliest row is "Earnings for Jul 21–Jul 27, 2025"; whatever precedes that is unaccounted for by any source this wave had access to.
2. **Only 7 weeks of Work Diary screenshots exist** (Jul 27 – Sep 13, 2026), against a lifetime total of 856:40 hours. The 7 evidenced weeks sum to **69.5 hours** — roughly 8% of the lifetime total. No Work Diary evidence exists for any week before Jul 27, 2026.
3. **No chat evidence covers Aug 2025 – Dec 2025**, the period the Upwork transaction report's earliest rows fall in, despite that being clearly an active, billed period (multiple hundred-dollar weekly payouts throughout).
4. **No chat evidence covers March–April 2026 or June–July 2026** — there is a gap between the "Jan Feb" file (ends some time in February) and the "starting 8 May" file, and nothing between the "8 May" file's own internal coverage and September.
5. **The "media-projects" chat screenshot is from a separate messaging surface** than the two `.txt` chat log exports — it's unclear whether it's the same underlying channel exported differently, or a genuinely separate channel Emmanuel and Taryn also use. Not resolved this wave; noted as a possible additional evidence source for the future.
6. `billing_evidence`/`billing_allocations` for Taryn's contract are **empty** in D1 — there is no MindBunker-side evidence trail to cross-check the transactions against beyond the 5 `transactions` rows already known from Wave 1.

None of these gaps were filled by inference, estimation, or extrapolation. Where a number could not be evidenced, it is marked `UNKNOWN` below, not guessed.

---

## 4. Taryn Relationship Timeline

| Date | Source | Event | Project/Video | Commercial Fact | Current MindBunker Representation |
|---|---|---|---|---|---|
| **~Jul 21–27, 2025 or earlier** | C (earliest transaction row) | Earliest evidenced Upwork earning period found | UNKNOWN | $90.00 earned, Added Aug 1, 2025 | Not represented — predates `clients.created_at` by 13 months |
| **Aug 2025 – Dec 2025** | C only (weekly payouts, $18.75–$847.50/week) | Continuous weekly Upwork billing | UNKNOWN | ~13 weekly payouts evidenced by transaction rows alone | Not represented |
| **Jan 2026** | A2 (chat), D (Drive folder dates) | Active, routine workflow already well-established: "workshop ad assets," recurring monthly "workshop," LF/short-form editing, established shorthand ("thanks fam," casual tone) | Drive folders `RAW FILES`/`Long Forms-VSLs`/`Short Form`/`Ads` created 13 Jan; `Bonnie - Ads` 22 Jan | Ongoing weekly Upwork billing (per C) | Not represented |
| **Feb 2026** | A2 (chat: "i will be more on top of this for february's workshop"), D | Drive folders `Workshop Ads` (6 Feb), `Workshop Videos` (9 Feb), `Motion Graphics` (26 Feb) created — confirms recurring monthly workshop content cycle predates MindBunker | Same work families | Ongoing weekly Upwork billing | Not represented |
| **May 8, 2026 onward** | A1 (chat) | Detailed day-to-day workflow visible: ad color-grading iteration, Dropbox/Drive delivery pattern, first explicit mention of **Bonnie** as a distinct sub-client whose content gets repurposed ("Content Waterfall Bonnie 26 July" Notion doc referenced) | Ads, workshop long-forms, Bonnie content | Ongoing weekly Upwork billing (per C) | Not represented |
| **2026-08-22** | D | `clients` row created in MindBunker — this is the **operator's MindBunker adoption date for an already 13-month-old relationship**, not the relationship's actual start | — | — | `clients.id=2`, `created_at=2026-08-22` |
| **2026-08-22 to 2026-08-25** | D (crm_events) | First MindBunker project (MINI SERIES) + video created same day; 3 more projects go active within 48h (Studio Session Arizona, Horizontal Short Form, Bonnie - Content Waterfall) | 4 projects created | — | Confirmed in D1 |
| **Jul 27 – Sep 13, 2026 (7 weeks)** | B (Work Diary) | 69.5 hours directly evidenced across 7 weekly screenshots — see §5 | — | $120.00–$438.75/week (Added, net of Upwork's fee) | MindBunker Work Sessions for the overlapping Aug 22–Sep 13 portion: **26.3 hours** — a real, evidenced ~7-hour gap (§10) |
| **2026-09-11** | D | Two new projects created (September Content Waterfall, Bonnie @ Content Waterfall September), 11 videos bulk-created | Projects 15, 16 | — | Confirmed in D1 |
| **2026-09-13** | D | All 5 videos in "Bonnie @ Content Waterfall September" delivered within 1 minute | Project 16 | — | Confirmed in D1 |
| **2026-09-14 (today)** | D, B | September Content Waterfall (6 videos) in progress, due today; latest Work Diary week (Sep 7–13) shows 6:40h, $150.00 pending | Project 15 | $150.00 pending payout | Confirmed in D1 |

---

## 5. Work Diary Weekly Reconstruction

Every visible weekly total, transcribed directly from the 7 screenshots (no weeks inferred or estimated):

| Week | Tracked | Manual | Overtime | Rate | Diary Total (gross) |
|---|---|---|---|---|---|
| Jul 27 – Aug 2, 2026 | 5:20 | 0:00 | 0:00 | $25.00/hr | $133.33 |
| Aug 3 – Aug 9, 2026 | 7:40 | 0:00 | 0:00 | $25.00/hr | $191.67 |
| Aug 10 – Aug 16, 2026 | 15:10 | 0:00 | 0:00 | $25.00/hr | $379.17 |
| Aug 17 – Aug 23, 2026 | 19:30 | 0:00 | 0:00 | $25.00/hr | $487.50 |
| Aug 24 – Aug 30, 2026 | 5:00 | 0:00 | 0:00 | $25.00/hr | $125.00 |
| Aug 31 – Sep 6, 2026 | 10:10 | 0:00 | 0:00 | $25.00/hr | $254.17 |
| Sep 7 – Sep 13, 2026 | 6:40 | 0:00 | 0:00 | $25.00/hr | $166.67 |
| **Sum of evidenced weeks** | **69:30 hrs** | 0:00 | 0:00 | — | **$1,737.51** |

Also directly read from the same screenshots: **Since start: 856:40 hours**, **Since start (earnings): $19,027.50**.

**The reconciling mechanism, found and confirmed:** every Diary weekly gross amount, multiplied by 0.9 (a 10% deduction), lands within a few cents of the corresponding Upwork transaction's "Added" amount:
- $487.50 × 0.9 = $438.75 — matches the Aug 17–23 transaction **exactly**.
- $379.17 × 0.9 = $341.25 — matches the Aug 10–16 transaction **exactly**.
- $191.67 × 0.9 = $172.50 — matches the Aug 3–9 transaction **exactly**.
- $133.33 × 0.9 = $120.00 — matches the Jul 27–Aug 2 transaction **exactly**.

This is consistent with a **10% Upwork service fee** applied between the Diary's gross hours×rate figure and the actual transaction credited. Classified as **ROUNDING/FEE MECHANISM, resolved** — not an unexplained discrepancy.

**Compared to MindBunker Work Sessions:** see §10 (kept separate per instruction — hours and money are never merged in this report).

---

## 6. Upwork Transaction Reconstruction

All 50 rows from the (partial — see §3) transaction report, condensed to the period materially overlapping MindBunker's existence (Jul 2026 onward); earlier rows are summarized as totals only:

| Date (Added) | Amount | Earning Period | Status |
|---|---|---|---|
| Sep 23, 2026 | $150.00 | Sep 7–13, 2026 | Pending |
| Sep 11, 2026 | $228.75 | Aug 31–Sep 6, 2026 | Added |
| Sep 4, 2026 | $112.50 | Aug 24–30, 2026 | Added |
| Aug 28, 2026 | $438.75 | Aug 17–23, 2026 | Added |
| Aug 21, 2026 | $341.25 | Aug 10–16, 2026 | Added |
| Aug 14, 2026 | $172.50 | Aug 3–9, 2026 | Added |
| Aug 7, 2026 | $120.00 | Jul 27–Aug 2, 2026 | Added |
| Jul 31, 2026 | $300.00 | Jul 20–26, 2026 | Added |
| **… 42 earlier weekly rows, back to Jul 21–27, 2025** | | | |
| **Sum (Added/settled)** | **$13,713.75** | | |
| **Sum (Pending)** | **$150.00** | | |
| **Sum in this export** | **$13,863.75** | | |
| **Upwork's own "since start" figure (§5)** | **$19,027.50** | | **not fully covered by this export — see §3** |

**Relationship to MindBunker `transactions`:** every one of Taryn's 5 recorded MindBunker income transactions matches a specific row above — see §11 for the exact pairing and confidence assessment.

**No duplicates found.** No transaction amount appears twice in the export.

---

## 7. Current MindBunker State (D1, read-only, refreshed this wave)

**CLIENT** — id `2`, "Taryn Dubreuil", status `active`, email `taryn-test@emmanueldarosa.com` (flagged in Wave 1 as likely a placeholder — unchanged, still worth Emmanuel's confirmation), source `Upwork`, `created_at = 2026-08-22`, no `next_action` set, no `last_interaction_at`, no default cover, no Instagram data, portal password **not set** (Gateway-link-only access), all portal capability/section flags default-`true`.

**PROJECTS** — 6 (unchanged from Wave 1): MINI SERIES (1 video), Horizontal Short Form (6 videos, all PLANNED), Studio Session Arizona ft C (4 videos, all DONE), Bonnie - Content Waterfall (9 videos, all PLANNED), September Content Waterfall (6 videos, IN_PROGRESS), Bonnie @ Content Waterfall September (5 videos, all DONE).

**VIDEOS** — 31 total. Full detail:

| id | Project | Title | Status | Type | Batch | Priority | Visible | Review URL | Delivery URL | Cover |
|---|---|---|---|---|---|---|---|---|---|---|
| 4 | MINI SERIES | Video 1 - MINI SERIES | READY_FOR_REVIEW | long-form | — | no | yes | ✓ | ✓ | ✓ |
| 15–20 | Horizontal Short Form | Taryn - HF_1…6 | PLANNED | — | — | no | yes | — | — | — |
| 21–23 | Studio Session Arizona | Studios Sesh Taryn's-1…3 | DONE | — | — | no | yes | — | ✓ | — |
| 24 | Studio Session Arizona | Arizona Session - Full Cut | DONE | long-form | — | no | yes | — | ✓ | — |
| 6,8,14 | Bonnie - Content Waterfall | Bonnie Content Waterfall_1,3,9 | **PLANNED** | — | — | no | yes | — | **✓ (has a delivery URL despite being PLANNED)** | — |
| 7,9–13 | Bonnie - Content Waterfall | Bonnie Content Waterfall_2,4-8 | PLANNED | — | — | no | yes | — | — | — |
| 57–62 | September Content Waterfall | 11SEP-CONTENT WATERFALL_1…6 | IN_PROGRESS | — | CW-September | no | yes | — | — | — |
| 63–67 | Bonnie @ CW September | 11SEP-Bonnie Content Waterfall_1…5 | DONE | — | Bonnie Content Waterfall | no | yes | ✓ | — | — |

**PRODUCTION ORDERS** — 0 (unchanged; LET'S COOK never used for Taryn).

**WORK SESSIONS** — 19 sessions, 94,582 seconds (26.27 hours), spanning 2026-08-22 to 2026-09-13 (unchanged from Wave 1, re-confirmed).

**QUOTES** — 0.

**CONTRACTS** — 1: `commercial_contracts.id=1`, platform `Upwork`, `HOURLY`, $25.00/hr USD, `ACTIVE`, created 2026-08-25.

**BILLING EVIDENCE** — **0 rows** for contract_id=1 (see §1 and §13 correction #1 — this is the canonical UPWORK_REPORT-shaped table, currently empty).

**BILLING ALLOCATIONS** — 0 (follows from zero billing evidence).

**TRANSACTIONS** — 5, totaling $1,372.50 (see §11 for full reconciliation).

**PAYMENT REQUESTS** — 0.

**PORTAL SETTINGS** — all capability flags (`portalCanSeeFinancials/Review/SetPriority`) and all dashboard-section flags (`portalShowCurrentAccount/Search/Summary/ActiveWork/RecentDeliveries/CompletedByType/VideoLibrary`) default `true`; no persistent login configured.

---

## 8. Project / Work-Family Map

Cross-referencing D1 projects against the chat evidence and the Drive folder structure (§2, source D — `@TARYN → Taryn - 2026`: `RAW FILES`, `Long Forms / VSLs`, `Short Form`, `Ads`, `Bonnie - Ads`, `Workshop Ads`, `Workshop Videos`, `Motion Graphics`):

| Work family | Evidence | Classification |
|---|---|---|
| **Bonnie / Content Waterfall** | Chat (A1, extensively — Bonnie is explicitly a separate person/business whose raw footage Taryn repurposes: "her program is called CEO Strong, like mine is CEO Clubhouse"); Drive folder `Bonnie - Ads`; Notion doc "Content-Waterfall-Bonnie-26-July" | **REAL, RECURRING CAMPAIGN** — confirmed as a genuine, named, recurring monthly content-repurposing workflow, not filename noise. MindBunker's 3 separate Bonnie/Content-Waterfall projects (5, 15, 16) are a real reflection of this recurring cycle running monthly (project 5 = an earlier/possibly superseded cycle — see Wave 1 finding, still unresolved and correctly flagged there, not re-litigated here) |
| **Long Forms / VSLs** | Drive folder (Jan 13); chat references to "LF - LECTURE" | REAL CONTENT TYPE — matches MindBunker's `long-form` content_type enum value, used on 2 of Taryn's 31 videos (both in D1) |
| **Short Form** | Drive folder (Jan 13); MindBunker project "Horizontal Short Form" | REAL CONTENT TYPE / project name, consistent between Drive and D1 |
| **Ads** | Drive folder (Jan 13); chat, extensively (ad color-grading, hooks, retargeting vs. cold) | REAL, RECURRING WORK TYPE — no dedicated MindBunker project currently named "Ads"; ad work appears folded into other batches in D1 rather than its own project. Not necessarily wrong (ads may legitimately belong inside whichever campaign they support), but worth Emmanuel confirming whether ads deserve their own project going forward |
| **Workshop Ads / Workshop Videos** | Drive folders (Feb 6, Feb 9); chat ("workshop stuff for Monday," "february's workshop") | REAL, RECURRING MONTHLY CAMPAIGN — no explicit "Workshop" project currently exists in D1 for the Sep 2026 period; this may mean September's workshop cycle hasn't been MindBunker-ingested yet, or its content landed inside one of the Content Waterfall projects instead |
| **Motion Graphics** | Drive folder (Feb 26) | CONTENT TYPE / FILE ORGANIZATION ONLY — no corresponding MindBunker project or video; likely a Drive-side asset category, not a client-facing deliverable category |
| **Studio Session Arizona** | D1 project name; chat (§4, "In all the Arizona content that you got...") | REAL PROJECT — a specific, one-off filming session, not a recurring campaign; correctly represented as its own project in D1 |
| **MINI SERIES** | D1 project name | REAL PROJECT — no strong chat corroboration found this wave (may simply not have come up in the excerpted portions read), but nothing contradicts it either; classified UNKNOWN pending further chat review, not disputed |

**Conclusion:** the Drive folder structure is organized by **content type** (Long Forms, Short Form, Ads, Motion Graphics), while MindBunker's Projects are organized by **campaign/client-of-client** (Bonnie's stuff, a specific studio session, a workshop cycle). These are genuinely different, both-valid organizing principles — confirming the mission's own framing that folder structure is supporting evidence, not canonical project truth. No mutation proposed here; this is a finding for future CRM/Projects design consideration, not a correction.

---

## 9. Video Reconciliation

Comparing D1 (§7) against chat/Drive evidence:

| Issue | Videos affected | Classification |
|---|---|---|
| Internal/file-oriented titles shown as the only title (see §14 for full list) | 20 of 31 videos | PRESENTATION ONLY |
| `content_type` unset | 29 of 31 videos (94%) | DATA CORRECTION candidate (low urgency — see §12) |
| `Bonnie Content Waterfall_1/_3/_9` (ids 6, 8, 14) carry a `delivery_url` while `status=PLANNED` and `delivered=false` | 3 videos | **DATA CORRECTION** — either a premature/placeholder link was entered, or the status was never advanced after real delivery; genuinely worth a quick manual look, not urgent |
| `Bonnie @ Content Waterfall September` batch (ids 63–67) is `status=DONE, delivered=true` but has no `delivery_url`, only a `review_url` | 5 videos | **PRESENTATION ONLY / needs verification** — Wave 1's `crm_events` audit showed these videos were updated with `reviewUrl` and `publishedUrl` (not queried directly this wave); if `published_url` is functioning as the actual client-facing link, this is expected, not a bug — recommend confirming rather than correcting |
| Batch label missing on an evidently-batched project | 9 videos (Bonnie - Content Waterfall, project 5) | PRESENTATION ONLY — the September equivalents (projects 15, 16) do carry batch labels; project 5 predates that convention or was created differently |
| Project 5 ("Bonnie - Content Waterfall," 9 videos, all PLANNED, zero work sessions) vs. projects 15/16 (the active September equivalents) | 9 videos | **EXPECTED HISTORY, pending Emmanuel confirmation** — same open question flagged in Wave 1, not re-resolved here; do not auto-archive |
| No videos found with a wrong client or wrong project assignment | — | none found |

No `CODE BUG` classification applies to anything found this wave — every issue above is either presentation, a small data-entry gap, or an open question requiring Emmanuel's judgment, not application logic malfunctioning.

---

## 10. Hours Reconciliation

Kept strictly separate, per instruction:

**UPWORK-EVIDENCED HOURS** (Work Diary screenshots, Aug 22 – Sep 13, 2026 — the portion overlapping MindBunker's existence, computed from daily breakdowns within the 7 weekly screenshots):
- Aug 22–23 (partial week): 11:40 (Sat 22 = 5:40, Sun 23 = 6:00)
- Aug 24–30 (full week): 5:00
- Aug 31–Sep 6 (full week): 10:10
- Sep 7–13 (full week): 6:40
- **Total: 33.5 hours**

**MINDBUNKER-RECORDED HOURS** (Work Sessions, same window, Aug 22 – Sep 13, 2026): **26.27 hours** (19 sessions, 94,582 seconds — unchanged from Wave 1).

**DIFFERENCE:** ~7.2 hours (Upwork shows more tracked time than MindBunker for the same 3-week window).

**LIKELY EXPLANATION:** UNKNOWN with confidence — plausible candidates include work tracked via Upwork's own desktop timer/screenshot app that never had a corresponding MindBunker Work Session started (the two systems are entirely independent trackers), a work session that was corrected/shortened in MindBunker after the fact (Wave 1's `crm_events` showed several `work_session.corrected` entries for Taryn), or simply that not every Upwork-tracked minute maps 1:1 to MindBunker session-open/close discipline. **Not resolved this wave — flagged, not explained away.**

**Full-lifetime comparison (context only, not a reconciliation target):** Upwork "since start" = 856:40 hours; MindBunker Work Sessions only exist from Taryn's `clients.created_at` (2026-08-22) onward — MindBunker has no mechanism to represent the ~800+ hours of pre-MindBunker Upwork-tracked work, and per instruction, **this report does not recommend backfilling Work Sessions to close that gap.**

---

## 11. Commercial Reconciliation

**UPWORK OBSERVED TRANSACTIONS** (weekly Added/Pending rows, §6): $13,863.75 captured in the available export; $19,027.50 per Upwork's own lifetime total (§3 gap).

**MINDBUNKER TRANSACTIONS:** 5 rows, $1,372.50 total (§7).

**Exact pairing, with confidence:**

| MindBunker txn | Amount | Date | Matched Upwork week | Upwork amount | Match confidence |
|---|---|---|---|---|---|
| id 16 | $438.75 | 2026-08-31 | Aug 17–23 (Added Aug 28) | $438.75 | **Exact** — already correctly attributed to `contract_id=1` in D1 |
| id 2 | $343.75 | 2026-08-24 | Aug 10–16 (Added Aug 21) | $341.25 | High — $2.50 off, direction inconsistent with a flat fee (see below), currently unattributed (`contract_id=null`, category "Freelance") |
| id 8 | $170.00 | 2026-08-17 | Aug 3–9 (Added Aug 14) | $172.50 | High — $2.50 off, currently unattributed, flagged by MindBunker's own transaction notes as "unresolved" |
| id 9 | $120.00 | 2026-08-10 | Jul 27–Aug 2 (Added Aug 7) | $120.00 | **Exact**, currently unattributed |
| id 10 | $300.00 | 2026-08-03 | Jul 20–26 (Added Jul 31) | $300.00 | **Exact**, currently unattributed |

The two $2.50 discrepancies run in **opposite directions** (one MindBunker-recorded amount higher, one lower, than the matched Upwork "Added" figure) — not consistent with a single flat fee or rounding rule. Most plausible explanation: the Wise bank-transfer arrival amount (what Emmanuel actually saw land and manually recorded) can differ slightly from Upwork's own "Added" ledger figure due to Wise's own FX/transfer spread, which can move either direction depending on rates at the moment of each transfer — noted as **UNKNOWN with a plausible, non-alarming explanation**, not asserted as fact.

**BILLING EVIDENCE:** 0 rows (§7) — no independent MindBunker-side evidence trail exists to further corroborate beyond the transactions themselves.

**Amount currently attributed to Taryn's contract:** $438.75 (1 of 5 transactions).
**Amount currently unattributed:** $933.75 (4 of 5 transactions) — but see §13 correction #2: all 4 now have strong-to-exact evidence for attribution.
**Duplicates:** none found.

**Does the active $25/hr contract correctly represent the relationship?** **Yes** — both the Work Diary screenshots and every matched transaction consistently reflect $25.00/hour, and the contract's own `created_at` (2026-08-25) sits right at the start of MindBunker's involvement, which is a reasonable, non-fabricated representation of "the commercial arrangement as MindBunker has known it," even though the underlying Upwork relationship itself is 13+ months older.

---

## 12. Data-Quality Findings

Consolidated from §9 and §11, classified per mission's taxonomy:

| Finding | Classification |
|---|---|
| `clients.created_at` (2026-08-22) represents MindBunker adoption date, not real relationship start (Upwork evidence: Jul 2025) | EXPECTED HISTORY — not a bug; MindBunker was never meant to be a historical system of record before it existed |
| 4 of 5 income transactions unattributed to the Upwork contract despite strong/exact evidence now available | DATA CORRECTION (see §13 #2) |
| 3 PLANNED videos carry a `delivery_url` | DATA CORRECTION or PRESENTATION — needs a quick manual look (see §9) |
| `email = "taryn-test@emmanueldarosa.com"` | PRESENTATION ISSUE (carried over from Wave 1, unchanged, unresolved) |
| No `next_action`/`next_action_date` ever set | MISSING SOURCE (carried over from Wave 1) |
| `content_type` unset on 94% of videos | MISSING SOURCE |
| No persistent portal login configured | MISSING SOURCE / operator decision, not a bug |
| `billing_evidence` empty for an active hourly contract with 13+ months of real history | MISSING SOURCE — the correct table exists and is simply unused (see §13 #1) |
| Project 5 (9 PLANNED videos, zero progress) vs. active September equivalents | EXPECTED HISTORY, pending confirmation (carried over from Wave 1) |

---

## 13. Proposed Correction Set

Maximum 10, fewer preferred. **6 proposed.** None have been applied — all require Emmanuel's explicit approval.

### 1. Import 7 weeks of Work Diary evidence into `billing_evidence`
**Entity:** `billing_evidence` (new rows, `contract_id=1`)
**Current value:** 0 rows
**Proposed value:** 7 rows, one per screenshotted week (Jul 27–Sep 13, 2026), `source="UPWORK_REPORT"`, using the exact hours/amounts in §5
**Evidence:** direct screenshot transcription, this wave
**Why it matters:** populates the canonical, purpose-built table for exactly this evidence type, without touching Work Sessions (intentional-time truth) at all — the safest possible way to record "Upwork says this is what happened"
**Risk:** low — additive only, no existing row touched; the only judgment call is whether 7 weeks is enough to be useful or whether Emmanuel wants to gather more historical screenshots first

### 2. Attribute 4 unattributed transactions to Taryn's Upwork contract
**Entity:** `transactions.contract_id` for ids 2, 8, 9, 10
**Current value:** `null` (ids 8, 9, 10 also carry "unresolved" language in their own notes)
**Proposed value:** `contract_id = 1`, with each transaction's note updated to reference its matched Upwork earning period (§11)
**Evidence:** exact or near-exact amount + date-adjacency match to specific Upwork "Added" transactions, this wave
**Why it matters:** closes a finance-reconciliation gap the system already flagged itself; makes "amount currently attributed to Taryn" accurate before any financial figure is ever shown to her
**Risk:** low — same amounts, same client, just adding the missing link; the two $2.50-variance cases should be attributed with a note about the small discrepancy rather than silently corrected to the Upwork figure

### 3. Investigate the 3 PLANNED-but-has-delivery-URL videos
**Entity:** `video_logs` ids 6, 8, 14 (Bonnie Content Waterfall_1, _3, _9)
**Current value:** `status=PLANNED`, `delivered=false`, `delivery_url` set
**Proposed value:** either clear the stale `delivery_url` (if it's a leftover/placeholder) or advance `status`/`delivered` to match reality (if the video was in fact delivered)
**Evidence:** direct D1 query, this wave
**Why it matters:** an inconsistent status/delivery-link pairing is exactly the kind of thing that would look wrong the moment Taryn's portal shows her these videos
**Risk:** low, but requires Emmanuel to actually check which of the two directions is correct — this wave found the inconsistency, not the resolution

### 4. Confirm or correct `taryn@emmanueldarosa.com`-style placeholder email
**Entity:** `clients.email` for id 2
**Current value:** `taryn-test@emmanueldarosa.com`
**Proposed value:** her real email, if different
**Evidence:** carried over from Wave 1; not newly re-evidenced this wave
**Why it matters:** any future password-reset or notification flow depends on this being real
**Risk:** none if simply confirmed correct; low if changed

### 5. Set `next_action`/`next_action_date`
**Entity:** `clients.next_action`/`next_action_date` for id 2
**Current value:** both null
**Proposed value:** something reflecting the live state, e.g. "September Content Waterfall batch due" / 2026-09-14, or whatever Emmanuel's actual next step is
**Evidence:** D1, this wave and Wave 1
**Why it matters:** this is the CRM Dossier's single highest-emphasis fact (per the Spatial Blueprint) and it currently renders empty for Taryn
**Risk:** none — additive, operator-authored

### 6. Add `batch_label` to Bonnie - Content Waterfall (project 5) videos
**Entity:** `video_logs.batch_label` for ids 6–14
**Current value:** null
**Proposed value:** a label consistent with the project's own convention (e.g. matching how projects 15/16 are labeled)
**Evidence:** D1, this wave
**Why it matters:** consistency with how the same recurring work family is labeled elsewhere; low materiality, included because it's a one-line, zero-risk fix
**Risk:** none

**Explicitly not proposed:** backfilling historical Work Sessions to match Upwork's 856-hour lifetime total; converting the full $19,027.50 lifetime Upwork figure into MindBunker revenue rows; resolving whether project 5 is superseded (Wave 1's open question, still open); renaming any project or folder; deciding the email correction's actual new value (that requires Emmanuel, not evidence this session has).

---

## 14. Client-Friendly Naming Findings

Operator/file-oriented titles currently shown as Taryn's only video title (client-visible, since all carry `visible_to_client=1`):

- `Taryn - HF_1` through `_6` (6 videos)
- `Bonnie Content Waterfall_1` through `_9` (9 videos)
- `11SEP-CONTENT WATERFALL_1` through `_6` (6 videos)
- `11SEP-Bonnie Content Waterfall_1` through `_5` (5 videos)
- `Studios Sesh Taryn's-1`, `-2`, `-3` (3 videos — also contains an apostrophe/typo pattern, "Studios Sesh" likely meant "Studio Session")

**20 of 31 videos (65%)** use an internal batch/index naming convention as their only visible title.

**Does an existing field already support a client display title without a schema change?** `video_logs.title` is the only title field; there is no separate `displayTitle`/`clientTitle` column. Per instruction, **no migration is proposed**. If Emmanuel wants a friendlier client-facing title without schema work, the only zero-schema-change option available today is manually rewriting `title` itself (which would then also change the internal/operator-facing label — there is currently no way to have both without a new field). This is flagged as a genuine, real gap for future CRM/Portal design consideration, not something this wave can resolve.

---

## 15. Taryn Dashboard Configuration

Using only current capabilities, based on the reconciled data quality above (unchanged conclusions from Wave 1, now with stronger evidence behind them):

| Section | Recommendation | Why |
|---|---|---|
| Current Account | **OFF** | No payment request exists for her; would render empty |
| Search | **ON** | 31 videos, genuinely searchable |
| Summary | **ON** | Honest counts (10 done / 7 active / 15 planned) remain accurate |
| Active Work | **ON** | September Content Waterfall (6 in-progress, due today) is exactly this section's job |
| Recent Deliveries | **ON** | 5 videos delivered in the last 48 hours |
| Completed by Type | **OFF** | `content_type` set on only 6% of her videos — would render as almost entirely "Unclassified" |
| Video Library | **ON** | 10 delivered videos, real library |
| Financial summary capability | **OFF (recommend, upgrade from Wave 1's "leave on" default)** — with the new evidence, this wave's reconciliation shows only 1 of 5 transactions ($438.75 of $1,372.50, 32%) is currently correctly attributed pending correction #2; showing her a financial figure before that correction lands would show an incomplete, misleading number even though the underlying capability flag has been "on" by default |
| Review capability | **ON** | No evidence of misuse; she has engaged with review-style feedback in chat |
| Priority capability | **ON** | No evidence against it |

**Change from Wave 1:** this wave downgrades the financial-visibility recommendation from "leave as-is" to "explicitly turn off until correction #2 lands," because the reconciliation now quantifies exactly how incomplete the attributed figure currently is (32% of her recorded transactions) — this is new evidence, not a reversal of judgment.

---

## 16. Monday Client-View Recommendation

**WHAT ARE WE WORKING ON?** September Content Waterfall — 6 videos in progress, due today. Answerable, accurate, real.

**WHAT WAS RECENTLY DELIVERED?** Bonnie @ Content Waterfall September — 5 videos delivered Sep 13. Answerable, accurate.

**WHAT NEEDS MY REVIEW?** MINI SERIES / Video 1 — `READY_FOR_REVIEW` status, has a review URL. Answerable.

**WHERE CAN I FIND MY VIDEOS?** Video Library (10 delivered) + Search (31 total). Answerable.

**WHAT DO I CURRENTLY OWE / WHAT HAS BEEN PAID?** — **Should stay OFF for now.** Per §15, only 32% of recorded transactions are correctly attributed today; showing a financial figure now would understate her real payment history relative to both MindBunker's own eventual-corrected total and (far more so) her real Upwork lifetime total. Revisit after correction #2.

**Section that should temporarily remain OFF:** Financial summary / Current Account (both already covered above), and Completed by Type (data-quality reason, not commercial-sensitivity reason).

---

## 17. CRM Spatial Pilot Rendering (Taryn)

Testing the Spatial Blueprint's 5 regions against this wave's reconciled facts — an update to Wave 1's version, now evidence-backed rather than D1-only:

- **IDENTITY:** Still no avatar/cover — genuinely empty, should render as a placeholder, not invented filler. Four links: Gateway access, View Projects, Preview client view, Log a quote.
- **ACTIVE JOBS:** September Content Waterfall (6 in-progress, due today) dominates correctly — this is now confirmed by BOTH D1 and the Work Diary (the Sep 7–13 week shows real tracked hours against this exact window). MINI SERIES ranks second by exception (needs review). The two dormant PLANNED batches (Horizontal Short Form, Bonnie - Content Waterfall) correctly rank lowest.
- **OPERATIONAL DOSSIER:** Next action — still empty (correction #5 pending). Relationship state `active`. Commercial model: $25/hr Upwork, now confirmed by Work Diary evidence to be an accurate, currently-in-use rate, not just a D1 assertion. Portal state: Gateway-link-only. Last interaction — still empty (unresolved gap, same as Wave 1).
- **METRIC STRIP:** Tracked hours (26.27 MindBunker-recorded / 33.5 Upwork-evidenced for the same window — **this wave reveals the strip would need to pick ONE hours figure and be honest that it's a partial view**, since the two now provably disagree by ~7 hours for the exact same 3-week window). Attributed income ($438.75 today, $1,372.50 once correction #2 lands) — **must not show the $19,027.50 Upwork lifetime figure** per the blueprint's own "no invented realized attribution" rule.
- **CLIENT DASHBOARD MANAGER:** Per §15, 5 of 7 sections ON, financial capability now recommended OFF pending correction #2.

**Region flagged before implementation:** the METRIC STRIP's "tracked hours" fact is not a clean single number for Taryn — this wave is the first to prove, with real evidence, that MindBunker's own hours and Upwork's own hours meaningfully diverge for the same window. Whoever implements the CRM spatial recomposition needs to decide up front which hours figure the strip shows (and probably label it explicitly, e.g. "MindBunker-tracked" vs. "Upwork-tracked"), rather than silently picking one.

---

## 18. Dave vs. Taryn Comparison

Dave was not re-reconciled this wave (per instruction — used only as comparison). New context from this wave's Taryn-specific evidence:

| Fact | Dave (Wave 1) | Taryn (this wave) | Genuinely different? |
|---|---|---|---|
| Relationship age vs. MindBunker adoption | Both roughly coincide (~Aug 25, 2026) | **13+ months older** than MindBunker adoption (Upwork evidence to Jul 2025) | **Yes — materially different.** Dave appears to be a genuinely new relationship; Taryn is a mature one MindBunker joined late. |
| Commercial model | Fixed $100 quote → later $25/hr Direct contract | $25/hr Upwork contract, evidenced continuously since Jul 2025 | Different platform (Direct vs. Upwork), same rate |
| Self-service portal use | Confirmed — marked 10 videos Done himself | No evidence of self-service use (Gateway-link-only, no persistent account) | Yes |
| Batch structure | Real but recent (VSF/HSF batches, ~10 videos) | Real, recurring monthly (Bonnie/Content Waterfall cycle, evidenced back to at least Jan 2026) | Yes — Taryn's batching is a long-running pattern, Dave's is new |
| Finance attribution completeness | 1/1 transactions attributed | Pre-correction: 1/5 (20%); post-correction #2: 5/5 | Both improvable, Taryn's gap was larger and now has a clear evidence-backed fix |
| Data-quality root cause pattern | Orphaned videos traced to a deleted project (a MindBunker-side event) | Missing history traced to relationship pre-dating MindBunker (an adoption-timing fact, not a MindBunker-side event) | **Yes — different root-cause category entirely** |

**Does this change the "generic pilot model" conclusion from Wave 1?** No — the underlying `Client → Project → Video → Work Session` + optional `Production Order` + `commercial_contracts`/`quotes` model still absorbs both relationships without a schema change. What this wave adds is a new, generically-relevant lesson: **the model needs to gracefully represent "we adopted MindBunker partway through an existing relationship,"** which neither pilot's `clients.created_at` currently communicates — worth keeping in mind for any future CRM display, since it will likely recur with other real clients too.

---

## 19. What NOT to Reconcile

Explicitly out of scope for correction in this wave, carried forward as decisions requiring more than evidence review:

- The ~$5,163.75 gap between the transaction export and Upwork's lifetime total (§3) — no more evidence is available this wave to close it; would require a fuller Upwork export.
- The ~800 hours of pre-MindBunker Upwork-tracked work — never proposed for Work Session backfill, per explicit instruction.
- Project 5's stale/superseded status — same open question as Wave 1, still requires an Emmanuel decision, not new evidence.
- Whether "Ads" and "Workshop" deserve their own MindBunker projects going forward — a product/organization decision, not a correction to existing data.
- The video-title/display-title schema gap (§14) — flagged, not solved, per explicit "do not create migration" instruction.
- The `media-projects` chat screenshot's relationship to the two `.txt` exports — unresolved, noted as a possible future evidence source.

---

## 20. Exact Human Approvals Required

Before any of §13's 6 corrections are applied, Emmanuel needs to:

1. **Approve or reject correction #1** (import 7 Work Diary weeks into `billing_evidence`) — and confirm whether 7 weeks of evidence is enough, or whether more historical Work Diary screenshots should be gathered first.
2. **Approve or reject correction #2** (attribute 4 transactions to the Upwork contract) — including how to annotate the two $2.50 variances.
3. **Resolve correction #3** (which of the 3 inconsistent Bonnie Content Waterfall videos are actually delivered vs. not) — this requires Emmanuel's own knowledge, not just evidence matching.
4. **Confirm or correct Taryn's real email** (correction #4).
5. **Provide the actual text for `next_action`** (correction #5) — this report can identify that the field is empty but not author Taryn's real next step.
6. **Approve correction #6** (batch label backfill) — lowest-stakes, likely a quick yes/no.
7. **Confirm the dashboard configuration in §15**, especially the financial-visibility downgrade from Wave 1's recommendation.

---

## Final Output

**INCIDENT: GREEN**

**TARYN DATA: YELLOW** — nothing found is a code bug; several real, evidence-backed gaps exist (missing pre-MindBunker history, unattributed transactions, a few inconsistent video records), all bounded and all with a clear approval path.

**TARYN COMMERCIAL: YELLOW** — the $25/hr Upwork contract itself is correctly represented and evidence-confirmed accurate; the transaction attribution gap (currently 20% attributed) is real but has a ready, evidence-backed fix pending approval.

**TARYN PORTAL: READY AFTER CORRECTIONS** — specifically after corrections #2 (transaction attribution) and #5 (next action) land; the underlying project/video data is otherwise sound enough to show her today.

**CORRECTIONS RECOMMENDED: 6**

**PRODUCTION MUTATIONS: NONE**

**DEPLOY: NOT PERFORMED**

**NEXT ACTION:** Emmanuel reviews and approves/adjusts the 6 proposed corrections in §13, especially #1 (Work Diary import) and #2 (transaction attribution), since those two alone would resolve most of this wave's findings.

**STOP.**
