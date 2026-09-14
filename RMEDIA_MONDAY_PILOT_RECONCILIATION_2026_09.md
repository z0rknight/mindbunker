# RMEDIA OS — MONDAY PILOT PROGRAM WAVE 1
## Claude Handoff + Operational Archaeology + Dave/Taryn Reconciliation

**Date:** 2026-09-14 (Monday)
**Mode:** Read-only archaeology + reconciliation. No implementation. No deploy. No production mutation.

---

## 1. Executive Verdict

**Codex's War Room Sidecar work is NOT STARTED at the code level — and that is correct, not a shortfall.** Codex's session produced exactly one artifact: `RMEDIA_SPATIAL_UI_SIDECAR_BLUEPRINT_2026_09.md`, a 587-line research/discovery document. Its own final line reads: *"Hard gate: discovery and blueprint complete. No application code, CSS, component, schema, migration, or deployment change is authorized by this document."* Codex did exactly the job it was given — research and specification — and stopped exactly where its own mandate stopped. There is zero sidecar code, zero new routes, zero new components, zero new tests anywhere in this worktree or any sibling worktree. Codex did not "run out of steam mid-implementation"; it completed a research deliverable and correctly declined to self-authorize the next one.

**Dave DeMink and Taryn Dubreuil are real, already-active clients with substantial real production history** — not fixtures. Both have real projects, real deliverables, real work sessions, real commercial agreements, and (in Dave's case) real client-portal engagement, verified directly against production D1 (`served_by: v3-prod`). Both are close to Monday-ready; each has a small number of concrete, fixable issues, none of which are code bugs — all are either stale/leftover data or presentation gaps.

**One real, findable root cause was traced, not just observed:** Dave's 10 "Unassigned Deliverables" are not a mystery — the CRM event log shows their two parent projects ("Short Form Video" and "Long Form Videos") were created and then deleted within the same session on 2026-09-03, and project deletion does not cascade to or reassign child videos. This is expected, documented system behavior working as designed, not a bug.

No code was written this wave. No production data was changed. The only artifact created is this report plus one local checkpoint commit that preserves Codex's blueprint file (previously untracked).

---

## 2. Codex Handoff State

**HANDOFF_BASE_SHA:** `0de8a93d2ca88f3cbd3665a6e3ff7b08cba67079` (= accepted production baseline, = `origin/production/current`)
**CURRENT_HEAD (before this wave's checkpoint):** `0de8a93d2ca88f3cbd3665a6e3ff7b08cba67079`
**CHECKPOINT_SHA:** `8e8be0fe6ff466c152858cb752d63e45dde955f9`
**CURRENT_BRANCH:** `codex/p0-video-workspace-hotfix`
**WORKTREE_STATUS:** Clean after checkpoint (one untracked file — Codex's blueprint doc — committed; nothing else was present)

`git log --oneline --decorate -15` shows the worktree's HEAD sitting exactly on the House Cleaning Wave 2 commit, tagged `origin/production/current`. Codex worked **on top of** this accepted baseline and left it completely unmodified — `git diff --stat` against HEAD was empty before the checkpoint. The one thing Codex added was the blueprint markdown file, untracked.

**Inventory of what Codex actually did:**
- Modified files: **0**
- New source files: **0**
- Deleted files: **0**
- New tests: **0**
- Route changes: **0**
- Shell/component changes: **0**
- New reports: **1** (`RMEDIA_SPATIAL_UI_SIDECAR_BLUEPRINT_2026_09.md`)

A repo-wide search (`find . -iname "*sidecar*"`, across this worktree and every sibling `mindbunker-*` worktree) turned up nothing except the blueprint's own filename. No stash entries exist. No other local branch contains sidecar code.

**Conclusion:** Codex was not "near session exhaustion mid-implementation" in the sense of abandoned code — it was asked to research and specify, it researched and specified thoroughly (587 lines covering all three surfaces, exact component reuse mapping, responsive behavior at 6 breakpoints, performance budget, risk list, and an explicit "what must not change" list), and it stopped at its own explicitly stated gate. The handoff is clean.

---

## 3. Spatial Sidecar Implementation Status

Since there is no code, every checklist item is **NOT STARTED**. Restating this as a checklist per the mission's own list, for the record:

| Item | Status |
|---|---|
| `/war-room/sidecar` route | NOT STARTED |
| Private auth on sidecar route | NOT STARTED (blueprint specifies it must reuse existing operator auth — correctly identified as a risk in blueprint §33.6) |
| Chrome-less shell | NOT STARTED |
| Open Sidecar / Exit Sidecar links | NOT STARTED |
| `100dvh` / no-scroll shell | NOT STARTED |
| 12-column spatial grid | NOT STARTED |
| Today panel | NOT STARTED |
| Active Session panel | NOT STARTED |
| Batches panel | NOT STARTED |
| Quick Notes panel | NOT STARTED |
| Restaurant View | NOT STARTED |
| Videos/Queue panel | NOT STARTED |
| Command Dock | NOT STARTED |
| Session Clock | NOT STARTED |
| Streaks | NOT STARTED |
| Project/Queue context link | NOT STARTED |
| One coordinated refresh | NOT STARTED |
| Portrait fallback | NOT STARTED |
| Phone fallback | NOT STARTED |
| Tests | NOT STARTED |
| Performance limits | NOT STARTED (budget specified in blueprint §31, unimplemented) |

What **IS** done, and is genuinely valuable groundwork: a complete component-reuse map (blueprint §24–26) naming the exact existing read models (`getWorkSessionOverview`, `getProductionOrders`, `getProjectStreaks(3)`, `selectExecutionQueue`, etc.) each future panel should call, and an explicit list of things that must never be re-created (no new timer table, no new notes table, no schema change). This means Wave 2 (whenever it runs) does not need to re-derive the data-source mapping — it can go straight to `src/app/war-room/page.tsx` and the modules the blueprint already named and start building against them.

The worktree remains buildable and testable as-is (it's the accepted, deployed baseline); no repair was needed to inspect it.

---

## 4. Current Source / Production Reality

| Fact | Value | Verified how |
|---|---|---|
| `production/current` / accepted baseline | `0de8a93d2ca88f3cbd3665a6e3ff7b08cba67079` | `git log`, matches mission brief exactly |
| Current worktree HEAD | same, then `8e8be0f` after checkpoint | `git rev-parse HEAD` |
| D1 database | `mindbunker` (`d6ada5db-1f36-4ee9-9a05-01d131abf219`) | `wrangler d1 list` |
| Remote D1 migration state | **No migrations to apply** (fully current) | `wrangler d1 migrations list mindbunker --remote` |
| Remote D1 read access | **Working** (`served_by: v3-prod`) | direct `wrangler d1 execute --remote` queries, several dozen this wave |
| Remote D1 write access | Not attempted (out of scope; read-only mandate) | — |
| Total clients in production | 5: Shelley Riutta (id 1), Taryn Dubreuil (id 2), RMEDIA (id 3, internal), Dave DeMink (id 4), **RMEDIA Capture Release Test (id 5)** | direct query |

**Finding, out of pilot scope but worth flagging:** client id 5, `"RMEDIA Capture Release Test"`, `status: active`, is a leftover QA fixture sitting in production. It does not affect Dave or Taryn, but it is real clutter an operator would eventually see in a full client list. Not a Monday blocker; noted for a future cleanup pass.

---

## 5. Operational-Surface Boundary Audit

One sentence each, then up to 3 findings, based on the current (Wave 2/Hardening-simplified) source.

### Dashboard
**What is this page for?** A quiet personal/business overview — "what's my situation right now" — not a second operational console.
1. Its "Momentum" (project streak) block and War Room's Streaks are the same underlying `getProjectStreaks` fact shown twice on two surfaces — low-risk duplication today, but the blueprint's spatial War Room adds a third Streaks region, which would make it a genuine triplication unless one surface is designated the canonical streak display and the others link to it.
2. "Attention" here and War Room's "Active Signals" both surface blockers/overdue items from the same `getActiveSignals`/attention module — currently fine (Dashboard's is a small subset), but worth watching as a duplication risk once the spatial War Room's own "Today" context strip is built.
3. Spatial opportunity: the blueprint's "AS IT IS" dominant card (open session or next executable) maps directly onto Dashboard's existing `NowFocusPanel`-adjacent data — this is presentation reuse, not new logic, exactly as the blueprint states.

### War Room
**What is this page for?** Live execution/COMANDA — what's cooking right now, in the editing bay, glanceable in seconds.
1. Currently still a scrollable report page (post-Wave-2 collapsed Daily Ledger, but not yet the fixed-viewport sidecar) — this is expected; the blueprint explicitly says "standard `/war-room` may retain its current scrollable report mode until the spatial recomposition deliberately replaces it."
2. Its "Business & health analytics (historical, not live ops)" collapsed section is the right place for that content per House Cleaning, but it sits on the same route as the live-execution content — the sidecar's hard "no historical analytics in primary DOM" rule (blueprint §14) would need War Room's own page, not just the future `/war-room/sidecar` route, to eventually converge on this separation, or the two routes will diverge in what "War Room" means.
3. Spatial opportunity: Active Signals + Next Objective already carry almost the exact payload the blueprint's "Today" and "Active Session" panels want — a genuinely low-risk first slice.

### Productivity
**What is this page for?** The complete production floor — every video, its full lifecycle, and where it stands, for the operator managing all work in flight.
1. This is explicitly the "full unbounded queue" owner per the blueprint (§18: "keep full stage grids, bulk controls, filters, reorder tooling, and complete queues in Productivity") — currently correctly the only place the full stage grid lives, post-Wave-2.
2. The `?video=` deep-link mechanism (hardened this wave for malformed/nonexistent IDs) is the shared entry point CRM, Projects, and the future sidecar Queue panel all already rely on or will rely on — it is quietly load-bearing infrastructure for the whole spatial plan and should stay stable.
3. No overlap issue found beyond the above; this page's boundary is already clean post-House-Cleaning.

### Projects
**What is this page for?** Give one client's work content, context, and structure — the canonical container for videos.
1. Confirmed live in production data: Dave has one internal-only project (`OPERATION / ADMIN / PRE-FLIGHT`, `visible_to_client=0`) correctly hidden from his portal — the visibility boundary works as designed.
2. Confirmed: 10 of Dave's videos are project-less ("Unassigned Deliverables") — traced to two now-deleted projects (§9 below), not a Projects-page bug; the page already has a dedicated, documented surface for this exact situation.
3. Spatial opportunity: the blueprint's CRM "Active Jobs" region explicitly reuses Projects' existing `getProjectsForClient`/project-card logic rather than forking it — Projects stays the single source of "what does this client's work structure look like," CRM only gets a bounded window into it.

### LET'S COOK
**What is this page for?** The Production Order (batch/comanda) factory — client/project/contract/label → many deliverables created and tracked together.
1. **Neither Dave nor Taryn has ever used it** — `production_orders` for client_id IN (2,4) returns zero rows. Every one of Taryn's 5–9-video batches (Bonnie Content Waterfall, September Content Waterfall, etc.) and Dave's 5-video VSF/HSF batches were created via ordinary bulk video creation with a shared `batch_label` string, not via a Production Order. This is not wrong — `batch_label` is a legitimate lighter-weight grouping mechanism — but it means the atomicity/idempotency hardening done to `ingestProductionOrder` this cycle has had zero real-world exercise against these two pilot clients yet.
2. The Hardening Round's atomicity fix (container + items now one all-or-nothing `db.batch()`) is a code-correctness improvement completely independent of whether Dave/Taryn ever touch this feature — it's ready whenever Emmanuel does use it for them.
3. No boundary conflict with Productivity/Projects found; LET'S COOK's role (batch factory) versus Projects' role (structure) versus Productivity's role (execution) remains distinct.

### CRM
**What is this page for?** Relationship truth — who this client is, what's next, what's commercial, what they can see — for one client at a time.
1. Confirmed live: Dave's `next_action` ("Review submitted briefing") and `next_action_date` (2026-08-25) are **three weeks stale** relative to today (2026-09-14) — the CRM Dossier's "next action" field is exactly the kind of durable fact the blueprint elevates to primary emphasis (§6.1), and right now it's wrong for an actively-working client.
2. Taryn's `portal_password_hash` is `NULL` — she has never set up persistent portal login, only ever used single-use Gateway links (several `gateway_created`/`gateway_opened` events exist for her). The CRM's "Portal state" dossier fact needs to distinguish this ("token-link only, no persistent account") from Dave's fully-configured state, which it already can (the underlying flag exists) — just worth confirming the copy doesn't say something misleadingly binary like "Portal: Off."
3. Spatial opportunity: the blueprint's Active Jobs region (project cards + small nested video queue) maps cleanly onto both pilots' real data — see §16–17 below for exact per-client population.

### Client Portal
**What is this page for?** The client-safe external view — what Dave or Taryn is allowed to see of their own work, on their own.
1. Confirmed live: Dave has actually used it — the CRM event log shows him logging in and moving 10 of his own videos to "Done" on 2026-09-13 (`Client moved 3SEP - DAVEDEMINK - VSF__1 to Done`, etc.). This is real client engagement, not hypothetical — a strong Monday-readiness signal for Dave specifically.
2. All portal capability flags (`portal_can_see_financials/review/set_priority`) and all dashboard-section flags (`portal_show_*`) are `true`/default for both Dave and Taryn — no client-specific personalization has been configured yet; §7 and §11 below propose a first real configuration.
3. Taryn's portal readiness is unverified by direct use (no persistent account, no observed "client did X" events) — her portal experience needs manual verification before Monday if she's meant to log in, versus continuing to use Gateway links.

---

## 6. Dave Canonical Relationship Map

All facts below are direct production D1 query results (`served_by: v3-prod`), not derived from prior reports.

**CLIENT ROW** — id 4, name "Dave DeMink", status `active`, email `damink.dave@gmail.com`, source `"Taryn's Ref"`, opportunity stage `active`, service interest `short-form`, next action `"Review submitted briefing"` due **2026-08-25 (STALE — 20 days past)**, last interaction `2026-08-25T19:51:46`, Instagram `@davedemink` (profile picture + bio synced, last updated today 2026-09-14T10:38), default cover set, portal password **set** (2026-09-13, reissued once before on 2026-09-06), archival state `ACTIVE_SURFACE`, all 3 portal capability flags and all 7 dashboard-section flags `true`.

**PROJECTS** (4 total, matching `clients.total_projects`):
| Project | Status | Visible to client | Deadline | Videos |
|---|---|---|---|---|
| Website Videos (id 6) | active | yes | 2027-12-31 | 1 (DONE, delivered) |
| Meta Ads - September (id 8) | active | yes | 2026-09-04 | 2 (DONE, delivered) |
| OPERATION / ADMIN / PRE-FLIGHT (id 9) | active | **no** | 2027-02-28 | 1 (internal-only, see §12) |
| Short Form Videos (id 12) | active | yes | 2028-08-11 | 10 (all DONE, delivered — VSF batch ×5, HSF batch ×5) |

**Plus 10 project-less videos** ("3SEP-DaveDeMink-SF_1..5", "3SEP-DaveDeMink-LF_1..5"), all `PLANNED`, `visible_to_client=1`, no work sessions, no content type set — these are Projects' "Unassigned Deliverables" surface's exact use case (root cause: §12 below).

**VIDEOS:** 24 real deliverables total (+ 10 unassigned = 24 shown here; is_operational_container excludes none since Dave has zero containers). 14 DONE/delivered, 10 PLANNED (all unassigned). Zero `is_priority` flags currently set. Content type set on essentially none (1/24). Batch labels present on 17/24.

**PRODUCTION ORDERS:** none.

**WORK SESSIONS:** 18 sessions, 54,570 seconds tracked (≈15.2 hours), spanning 2026-08-26 to 2026-09-09. Several sessions were operator-corrected (visible in `crm_events` as `work_session.corrected`) — normal, expected Sessions-flow usage, not a red flag.

**COMMERCIAL:**
- Quote id 1: "Landing Page Video," $100.00 USD, APPROVED 2026-08-26 — this is the **fixed $100 initial work** the mission asked to verify. Confirmed real.
- Contract id 2: platform `Direct`, `HOURLY`, $25.00/hour USD, `ACTIVE`, created 2026-09-03 — this is the **later hourly contract**. Confirmed real. Both facts coexist legitimately, exactly as the mission anticipated ("fixed historical quote + later hourly contract can both be legitimate").
- Transactions: 1 income row, $100.00, 2026-08-27, matching the Landing Page quote (unattributed to any contract, correctly, since it predates the hourly contract).
- Payment request: **1 OPEN**, $372.66 USD, created 2026-09-13 — pending, unpaid, recent, real.

**CLIENT PORTAL:** Password-based persistent login active. Dave has genuinely used it — see §5's Client Portal boundary finding. All capability and section-visibility flags default-on; no personalization configured yet.

---

## 7. Dave Client-Dashboard Configuration (proposed)

Using only existing controls:

| Section | Proposed | Why |
|---|---|---|
| Current Account | **ON** | He has an OPEN $372.66 payment request — this is exactly what this section is for. |
| Search | **ON** | 24 real videos across 4 projects; search is genuinely useful at this volume. |
| Summary | **ON** | Stat tiles are cheap and honest here — 14 done, 10 planned is a real, useful count. |
| Active Work | **ON** | 10 planned-but-unassigned SF/LF videos need somewhere visible once they're re-attached to a project (see §21) — Active Work is the natural home. |
| Recent Deliveries | **ON** | He already uses this — he marked 10 recent deliveries Done himself on 2026-09-13. |
| Completed by Type | **OFF (recommend, pending fix)** | Content type is set on only 1 of his 24 videos — this section would currently render as an almost-empty/misleading breakdown. Turn on once content types are backfilled (§21). |
| Video Library | **ON** | 14 delivered videos is a real, browsable library. |

Financial/Review/Priority capabilities: keep all **ON** — he already sees and acts on his payment request and has already exercised the Review capability (marking videos Done).

---

## 8. Taryn Canonical Relationship Map

**CLIENT ROW** — id 2, name "Taryn Dubreuil", status `active`, email `taryn-test@emmanueldarosa.com` (see §10 — this email is a strong presentation-issue signal, likely a placeholder, not necessarily her real inbox), source `Upwork`, opportunity stage `active`, no next action set, no last interaction timestamp recorded, no Instagram data, no default cover, **portal password NOT set** (`null`), archival state `ACTIVE_SURFACE`, all portal capability/section flags `true`.

**PROJECTS** (6 total, matching `clients.total_projects`):
| Project | Status | Visible | Deadline | Videos |
|---|---|---|---|---|
| MINI SERIES (id 1) | active | yes | 2026-09-25 | 1 (READY_FOR_REVIEW, long-form) |
| Horizontal Short Form (id 3) | active | yes | 2026-12-31 | 6 (all PLANNED, zero progress) |
| Studio Session Arizona ft C (id 4) | active | yes | 2026-12-31 | 4 (all DONE, delivered) |
| Bonnie - Content Waterfall (id 5) | active | yes | 2027-08-24 | 9 (all PLANNED, zero progress) |
| September Content Waterfall (id 15) | active | yes | 2026-09-14 (**today**) | 6 (all IN_PROGRESS, batch "CW-September") |
| Bonnie @ Content Waterfall September (id 16) | active | yes | 2026-09-30 | 5 (all DONE, delivered, batch "Bonnie Content Waterfall") |

**VIDEOS:** 31 real deliverables (no operational containers, no cancellations). 10 DONE/delivered, 6 READY_FOR_REVIEW-or-IN_PROGRESS-mixed (1 review + 6 in-progress = 7 active), 15 PLANNED with zero tracked work (6 in Horizontal Short Form + 9 in Bonnie - Content Waterfall). Content type set on only 2/31. Batch labels present on 11/31.

**PRODUCTION ORDERS:** none.

**WORK SESSIONS:** 19 sessions, 94,582 seconds tracked (≈26.3 hours), spanning 2026-08-22 to **2026-09-13 (yesterday)** — Taryn is Emmanuel's most recently and most heavily worked-on pilot client by tracked time.

**COMMERCIAL:**
- No quotes on file.
- Contract id 1: platform `Upwork`, `HOURLY`, $25.00/hour USD, `ACTIVE`, created 2026-08-25.
- Transactions: 5 income rows totaling $1,372.50 (Aug 3 – Aug 31). **3 of the 5 are explicitly unattributed** — their own `notes` field literally says "commercial client/contract/earning period unresolved." Only 1 (`$438.75`) is attributed to her contract.
- No payment requests.

**CLIENT PORTAL:** No persistent password — access has only ever been via single-use Gateway links (multiple `gateway_created`/`gateway_opened` events exist, so she has visited). No observed "client acted" events (no self-service Done-marking, no reviews recorded from her side, unlike Dave).

---

## 9. Taryn Chronological Relationship Story

Sourced entirely from `crm_events` (174 rows total for both pilots) and the tables above — every date below is a real, queried timestamp, not an inference.

**2026-08-22 — Relationship begins.** Client record created (source: Upwork). Within 14 minutes, her first project (MINI SERIES) and first video are created; the video moves to In Progress the same session.

**2026-08-23 to 2026-08-24 — Early production and structure.** Video 1 gets a delivery URL and moves to Ready for Review (Aug 23). The next day, three more projects go active in one session: Studio Session Arizona ft C, Horizontal Short Form, Bonnie - Content Waterfall — Taryn's work footprint expands fast in her first 48 hours.

**2026-08-25 onward — Gateway access, heavy use.** Repeated `gateway_created`/`gateway_opened` pairs through late August show Taryn actively opening her work via magic links (at least 6 distinct gateway sessions Aug 22–28) — she is engaged, just never converts to a persistent password login.

**Late August — commercial cash starts arriving, partially unattributed.** Between Aug 3 and Aug 31, five income transactions totaling $1,372.50 land (Upwork escrow receipts + one plain "Freelance" entry). Only the last one (Aug 31, $438.75) gets cleanly attributed to her Upwork contract; the other three are flagged by the system itself as unresolved attribution.

**Work sessions throughout, with several operator corrections** (Aug 30, Sep 1 ×2, Sep 3 ×3, Sep 8) — normal Sessions-flow usage, not anomalies.

**2026-09-11 — A new work cycle: September Content Waterfall.** Two new projects created back-to-back (02:48 and 02:51): "September Content Waterfall" (6 videos, bulk-created, batch "CW-September") and "Bonnie @ Content Waterfall September" (5 videos, bulk-created).

**2026-09-13 — Delivery.** All 5 videos in "Bonnie @ Content Waterfall September" get review/published URLs and move to Done within one minute (08:33:07–08:33:36) — a clean, fast batch delivery.

**Today, 2026-09-14** — "September Content Waterfall" (6 videos) is IN_PROGRESS, deadline is today; "Horizontal Short Form" (6 videos) and "Bonnie - Content Waterfall" (9 videos) sit untouched at PLANNED with zero work sessions against them.

**What is still active:** September Content Waterfall (6 videos, in progress, due today) is the live work. Horizontal Short Form and Bonnie - Content Waterfall (15 videos combined) are planned but dormant.

**What has been billed/paid:** $1,372.50 recorded as income against her; only $438.75 of it is cleanly attributed to her contract in the finance system.

**Current commercial model:** Upwork, hourly, $25/hour, active since 2026-08-25.

**What should Taryn see today:** her September Content Waterfall batch's progress (6 in flight, due today), her 15 delivered/recently-done videos, and — if Emmanuel wants her to see it — her $25/hr Upwork relationship. She should not see the two stalled 15-video planned batches presented as if they were equally "current," since neither has a single tracked minute against it.

---

## 10. Taryn Data-Quality Findings

| Finding | Classification |
|---|---|
| `email = "taryn-test@emmanueldarosa.com"` — an `@emmanueldarosa.com` address with "-test" in the local part, not a plausible client-owned inbox | **PRESENTATION ISSUE** (likely a placeholder set during initial setup, never replaced with her real email) |
| `portal_password_hash = null` — no persistent portal login ever configured, despite 6+ months of active, heavily-tracked work | **MISSING SOURCE** / operator decision needed, not a bug — Gateway links have worked for her so far |
| 3 of 5 income transactions ($300 + $120 + $170 = $590 of $1,372.50, i.e. 43%) explicitly unattributed to any contract, per the system's own transaction notes | **STALE DATA** — a real, existing finance-reconciliation gap, self-flagged by the app, not newly discovered |
| Three separately-named projects (id 5 "Bonnie - Content Waterfall," id 15 "September Content Waterfall," id 16 "Bonnie @ Content Waterfall September") all clearly relate to the same recurring "Bonnie" content-waterfall workflow, with confusingly overlapping names | **PRESENTATION ISSUE** — human-legible naming drift across a recurring workflow, not a code defect |
| Project id 5 "Bonnie - Content Waterfall" has 9 videos, ALL PLANNED, ZERO work sessions, created back in August, while two more specifically-September-dated "Bonnie" projects (15, 16) exist and are actively worked/delivered | **EXPECTED HISTORY, pending Emmanuel confirmation** — likely superseded by the September batches, but this reconciliation wave cannot determine that without asking; do not assume and do not auto-archive |
| content_type set on only 2/31 videos (6%); orientation set on only 2/31 (6%); batch_label present on 11/31 (35%) | **MISSING SOURCE** — metadata was never entered at creation time for most of her work, a real IPTC-completeness gap (§17) |
| No `next_action`/`next_action_date` ever set on her client row, despite months of active relationship | **MISSING SOURCE** — CRM Dossier's primary emphasis fact would currently render as empty for her |

Nothing here rises to **CODE BUG** — every finding is either stale/incomplete data entry or an operator-side naming/attribution decision waiting on Emmanuel.

---

## 11. Taryn Client-Dashboard Configuration (proposed)

| Section | Proposed | Why |
|---|---|---|
| Current Account | **OFF** | No payment request exists for her; this section would render empty. Turn on if/when one is created. |
| Search | **ON** | 31 videos across 6 projects — genuinely searchable volume. |
| Summary | **ON** | Honest, cheap counts (10 done / 7 active / 15 planned). |
| Active Work | **ON** | Her one genuinely live batch (September Content Waterfall, due today) is exactly this section's job. |
| Recent Deliveries | **ON** | 5 videos delivered in the last 48 hours — highly relevant right now. |
| Completed by Type | **OFF** | Content type is set on only 2/31 videos — would render as an almost-entirely-"Unclassified" breakdown today. |
| Video Library | **ON** | 10 delivered videos is a real library, worth browsing. |

Financial capability: this needs an explicit Emmanuel decision before enabling — no persistent login exists yet, so this is moot until portal access is configured; when it is, the 43%-unattributed transaction gap (§10) means any financial figures shown to her right now would be visibly incomplete. Recommend leaving `portal_can_see_financials` as-is (on) but not actively directing her to a persistent login until that reconciliation gap closes, or being upfront that shown figures are partial.

---

## 12. Dave vs Taryn — Product Comparison

| Fact / Need | Dave | Taryn | Shared? | Should product support generically? |
|---|---|---|---|---|
| Commercial history shape | Fixed $100 quote → later $25/hr Direct contract | $25/hr Upwork contract from day one, no quote | No | **Yes** — both paths (quote-first, contract-first) are already first-class; no change needed. |
| Work structure | Single/batch mix, several small projects | Batch-heavy, larger recurring waterfalls | No | Already supported — `batch_label` + Projects handles both without a schema change. |
| Review flow | Client actively self-reviews via persistent portal login (moved 10 videos to Done himself) | No observed self-review; Gateway-link-only access | No | **Yes, generically supported already** — the gap is configuration (password vs. link-only), not product capability. |
| Unassigned/orphaned work | 10 project-less videos (traced to deleted parent projects) | None observed | No | The existing "Unassigned Deliverables" surface already generically handles this; no new feature needed. |
| Payment requests | 1 open ($372.66) | None | No | Already generic; just unused by Taryn so far. |
| Finance attribution completeness | 1/1 transactions attributed (though it predates the hourly contract, correctly) | 2/5 attributed, 3/5 flagged unresolved by the system itself | No | Attribution UX for Upwork escrow receipts could be a future, separate improvement — out of scope this wave. |
| Metadata completeness (content type/orientation) | ~4% complete | ~6% complete | **Yes — both are bad** | This is the strongest shared finding: neither pilot has real content-type/orientation data. A default-at-creation nudge (not a schema change) could help both; flagged for a future wave, not this one. |
| Project naming clarity | Clean, distinct project names | 3 overlapping "Bonnie"/"Content Waterfall" project names | No | Not a product gap — naming discipline is an operator habit, not something the schema can enforce without over-constraining legitimate recurring work. |
| Client portal state | Persistent password, actively used | Gateway-link-only, never upgraded | No | Already generic (both mechanisms exist); the gap is which one Emmanuel offers each client, not a missing capability. |

**Common product model:** Client → Project → Video → Work Session, with an optional Production Order for genuine batch orders, already fully supports both of these very differently-shaped real relationships without any schema change. That is the single most important finding of this comparison: **the product does not need two modes.** The differences between Dave and Taryn are entirely data-shape differences the existing generic model already absorbs.

---

## 13. Shared Pilot Product Model

Confirmed: one product model, exercised two different ways.

- **Attribution graph** (`Client → Project → Video → Work Session`) holds for both without exception.
- **Commercial flexibility** (fixed quote OR hourly contract, coexisting historically) already works for Dave; Taryn's pure-contract path is simply the other branch of the same `commercial_contracts`/`quotes` pair, already supported.
- **Batch grouping** via `batch_label` (informal) already covers both pilots' actual recurring-batch usage; neither has needed the heavier `production_orders`/LET'S COOK mechanism yet, which remains available for when a real client order needs that atomicity/tracking (e.g., a formally-scoped multi-video commission with its own received-date and contract binding).
- **Portal access** flexibility (persistent password vs. Gateway link) already covers both engagement styles.

No new entity, no new table, no new status enum is indicated by this pilot data.

---

## 14. Client-Facing Naming Audit

Confirmed bad operator-facing titles that are directly client-visible today (all have `visible_to_client = 1`):

**Dave:**
- `3SEP - DAVEDEMINK - VSF__1` through `_5` (5 videos, Short Form Videos project)
- `3SEP - DAVEDEMINK - HSF__1` through `_5` (5 videos, same project)
- `3SEP-DaveDeMink-SF_1` through `_5` (5 unassigned videos)
- `3SEP-DaveDeMink-LF_1` through `_5` (5 unassigned videos)
- `3Sep_Dave-MetaAds_1`, `_2` (2 videos, Meta Ads project)

**Taryn:**
- `Taryn - HF_1` through `_6` (Horizontal Short Form project)
- `Bonnie Content Waterfall_1` through `_9` (Bonnie - Content Waterfall project)
- `11SEP-CONTENT WATERFALL_1` through `_6`
- `11SEP-Bonnie Content Waterfall_1` through `_5`
- `Studios Sesh Taryn's-1`, `-2`, `-3` (typo: "Studios Sesh" — likely meant "Studio Session")

That is **20 of Dave's 24 videos and 26 of Taryn's 31 videos** (83% and 84% respectively) using an internal file-naming convention (date prefix, client-name concatenation, underscore-index suffix) as their only title — exactly the pattern the mission flagged as bad client-facing naming.

**Recommendation, per mission constraint (no schema this wave):** `video_logs.title` is currently doing double duty as both the internal/file identity and the only client-visible display string. Rather than adding a new column, first determine whether `content_type` + a short manually-entered descriptor could serve as a display label wherever the client portal renders a title — but this is exactly the kind of decision the mission says not to make in this wave. Flagging the affected item count precisely (46 videos across both pilots) is the deliverable here; the fix is a Wave-3-or-later CRM/Portal presentation decision.

---

## 15. IPTC/Newsroom Metadata Gaps

For each of the 10 "what is this" questions, checked against real Dave/Taryn video rows:

| Question | Answerable today? |
|---|---|
| WHAT IS THIS? (title) | Yes, but see §14 — often not client-legible |
| WHO IS IT FOR? (client) | **Yes, always** — `client_id` is set on every video |
| WHAT PROJECT? | Yes for 45/55 videos; **10 of Dave's are unassigned** (§14, §21) |
| WHAT BATCH? | Only 28/55 (51%) have a `batch_label` |
| WHAT STATUS? | **Yes, always** — canonical `status` enum is never null |
| WHAT TYPE? (content type) | **Only 3/55 (5%)** — the single weakest field across both pilots |
| WHEN RECEIVED? | Yes — `date`/`created_at` always populated |
| WHEN DELIVERED? | Yes for delivered videos — `delivered`/status transition events are logged in `crm_events` |
| WHERE IS THE DELIVERY? | Yes for delivered work — `delivery_url`/`review_url`/`published_url` populated on completed items |
| WHAT SHOULD THE CLIENT CALL IT? | **No** — no separate client-facing display title exists (§14) |

**Two genuine, consistent gaps across both real pilots:** content type (WHAT TYPE?) and a client-safe display title (WHAT SHOULD THE CLIENT CALL IT?). Everything else already meets the newsroom bar. Both gaps are content/data gaps, not missing product capability — `content_type` already exists as a field, it is simply rarely filled in at creation time.

---

## 16. CRM Spatial Pilot — Dave

Mapping real data into the blueprint's 5 regions (§18 of the blueprint):

- **LEFT (identity, max 4 links):** Avatar/cover (default cover set), status `active` since 2026-08-25, source "Taryn's Ref." Four links: Open client portal, View Projects, Preview client view, Create quote. All populated.
- **CENTER (Active Jobs — active/review projects only):** 3 qualifying projects (Website Videos, Meta Ads - September, Short Form Videos — the 4th, PRE-FLIGHT, is internal-only and would be excluded from a client-facing "active jobs" framing but shown to the operator). Short Form Videos is fully DONE (10/10) so it would rank low under "sort by exception then active work then recency." Meta Ads - September is fully DONE too. **Currently, none of Dave's projects have any IN_PROGRESS or READY_FOR_REVIEW video** — every video is either DONE or PLANNED-and-unassigned. This means the Active Jobs center would currently show **completed** project cards, not live-moving work, for Dave. Worth noting for whoever implements this: the region needs a defined behavior for "client with no currently-in-flight project" (likely: show the most-recently-completed as context, or explicitly state "nothing in active production").
- **RIGHT (Operational Dossier, 4–6 facts):** Next action (STALE — flag this loudly, see §6/§21), relationship state `active`, last interaction 2026-08-25 (also stale relative to his 2026-09-13 portal activity — this timestamp field is not being updated by client-side portal actions, a real gap), commercial model ($25/hr Direct, active), portal state (persistent login, active).
- **STRIP (3–4 client-specific facts):** Total tracked hours (15.2h), open payment request ($372.66), 14 delivered videos, 0 revisions recorded.
- **BOTTOM (Client Dashboard Manager):** See §7's proposed configuration — this region would show 6 of 7 sections ON, all 3 capabilities ON.

No region would be empty for Dave.

---

## 17. CRM Spatial Pilot — Taryn

- **LEFT (identity):** No avatar/cover set (empty — genuinely nothing to show; the region should degrade to initials/placeholder, which the existing component already does). Status `active` since 2026-08-22, source "Upwork." Four links: Open Gateway (no persistent portal login to link to directly), View Projects, Preview client view, Log a quote.
- **CENTER (Active Jobs):** 5 of 6 projects qualify as active-status; by "current work" ranking, September Content Waterfall (6 IN_PROGRESS videos, due **today**) would dominate — this is the correct, live "what's cooking" signal the blueprint wants. MINI SERIES (1 READY_FOR_REVIEW video) would rank second by exception (needs a decision). Horizontal Short Form and Bonnie - Content Waterfall (15 combined PLANNED videos) would rank lowest, correctly reflecting that they are dormant.
- **RIGHT (Dossier):** Next action — **empty** (never set; region must render "No next action set" honestly per blueprint §6.1's own instruction, not fabricate one). Relationship state `active`. Last interaction — **empty** (`last_interaction_at` is null despite 6+ months of activity — this field appears to not be wired to work-session or portal activity at all, a real gap worth a future investigation, not fixed this wave). Commercial model ($25/hr Upwork, active). Portal state (Gateway-link-only, no persistent account).
- **STRIP:** Total tracked hours (26.3h — highest of the two pilots), $1,372.50 recorded income (43% unattributed — the strip should show currency-safe attributed figures only, per blueprint §6.4's explicit "no invented realized attribution" rule, which would currently mean showing a lower, partial number, or flagging the gap directly), 10 delivered videos, 0 revisions recorded.
- **BOTTOM (Client Dashboard Manager):** See §11 — 5 of 7 sections ON.

**One region would render meaningfully differently for Taryn than Dave:** her identity avatar/cover is genuinely empty (no filler should be invented, per the blueprint's own instruction), and her Dossier's next-action and last-interaction facts are both genuinely absent — these are honest gaps, not implementation bugs, and the blueprint's own density contract already anticipates this ("Absence should not create a blank permanent panel").

---

## 18. Operational Dossier — Final Recommendation

Based on what actually varies and matters across both real pilots, the 4–6 permanent facts should be:

1. **Next action + due date** (dominant) — even when empty (Taryn today), this is the single highest-value slot; an empty state should prompt the operator, not just render blank.
2. **Relationship state** (status + opportunity stage for leads) — always populated, cheap, load-bearing.
3. **Commercial model** — contract/quote summary, currency-explicit — both pilots have a clean, single answer here.
4. **Portal state** — persistent vs. link-only vs. none; this single fact would have surfaced Taryn's gap immediately if it had been glanceable before this wave.
5. **Last interaction** — recommend investigating why this field doesn't reflect Dave's 2026-09-13 portal activity before relying on it as a dossier fact; until fixed, display it with an honest "as of" framing rather than implying it's always current.
6. Recent operational note — only when present (per blueprint instruction); neither pilot currently has a recent video-memory note, so this slot would be empty for both today, which is fine.

Avoid duplicating: active project count, tracked hours, revenue — these belong in the metric strip (§16/§17), not the dossier, exactly as the blueprint specifies.

---

## 19. Active Jobs Validation

The blueprint's "project card + small nested active-video queue" model was validated against both pilots' real data:

- **Dave:** 3 client-visible active-status projects, but **zero** currently-in-flight videos (everything is DONE or unassigned-PLANNED) — the model works, but needs an explicit "nothing moving right now" state, which the blueprint's own §7 does not fully specify. This is a genuine, real gap surfaced by pilot data that a future implementation wave should resolve before assuming every client always has something "in flight."
- **Taryn:** 5 active-status projects, 7 genuinely in-flight videos (6 IN_PROGRESS + 1 READY_FOR_REVIEW), 15 dormant PLANNED videos across 2 projects — the model works well here and is exactly the scenario the blueprint was designed for.

**Numbers, both pilots combined:** 8 active-status projects (7 of which are client-visible), 7 in-flight videos, 1 in review, 15 dormant-planned, 24 done, 10 unassigned/orphaned.

**Conclusion:** the project-card-with-nested-queue model does **not fail** for either pilot, but Dave's current all-done-or-unassigned state is exactly the edge case that proves the model needs an explicit empty/completed state, not just a "current video" happy path. This should be added to the blueprint's own spec before implementation, not discovered mid-build.

---

## 20. Monday Readiness

**DAVE: READY (with 3 non-blocking fixes recommended before onboarding him further)**

Blockers that truly matter:
1. `next_action`/`next_action_date` is 20 days stale — will mislead the operator glancing at the Dossier. **5-minute fix, Emmanuel's own judgment call.**
2. 10 unassigned videos (SF/LF batches) need to either be reassigned to a real project or explicitly acknowledged as intentionally standalone — currently invisible risk of looking "lost." **Requires Emmanuel decision, not a code fix.**
3. Internal "OPERATION / ADMIN / PRE-FLIGHT" / "DAVE - PREFLIGHT" QA artifact is correctly hidden from Dave but visible to the operator in his project list — cosmetic-only, low priority, cleanup whenever convenient.

**TARYN: NEEDS DATA CLEANUP (small, non-blocking) before wider portal use**

Blockers that truly matter:
1. Placeholder-looking email (`taryn-test@emmanueldarosa.com`) — if she is meant to receive anything by email (reset links, notifications), this needs to be her real address first. **Confirm with Emmanuel.**
2. No persistent portal login configured — fine if Gateway links remain the intended access model; a blocker only if Emmanuel wants her using a password login like Dave.
3. 43% of her recorded income is unattributed to her contract — only matters if/when financial visibility is turned on for her portal; not urgent otherwise.
4. Two stalled 15-video PLANNED batches (Horizontal Short Form, Bonnie - Content Waterfall) with zero progress — worth a 2-minute "still relevant?" check before Monday so they don't quietly rot.
5. No `next_action` set at all — same recommendation as Dave's fix #1.

**Neither pilot has a code-level blocker.** Everything above is a data/configuration decision for Emmanuel, exactly the kind of finding this read-only wave was designed to surface.

---

## 21. Data Corrections Requiring Emmanuel Approval

None of the following were performed — all require Emmanuel's explicit decision:

1. Set/refresh Dave's `next_action`/`next_action_date`.
2. Decide the fate of Dave's 10 unassigned SF/LF videos: reassign to an existing or new project, or confirm they're intentionally standalone.
3. Decide whether to delete/archive Dave's internal "OPERATION / ADMIN / PRE-FLIGHT" project and "DAVE - PREFLIGHT" video (already client-hidden; purely operator-list clutter).
4. Confirm or correct Taryn's email address.
5. Decide whether Taryn should be moved to a persistent portal login or remain Gateway-link-only.
6. Reconcile the 3 unattributed Upwork escrow transactions for Taryn ($590 total) against her contract.
7. Confirm whether Taryn's "Bonnie - Content Waterfall" (project 5, 9 videos, zero progress) is superseded by the two newer September Bonnie projects, and if so, archive/cancel it explicitly.
8. Set Taryn's `next_action`/`next_action_date`.
9. Decide whether/how to backfill `content_type`/`orientation` on the ~95% of both pilots' videos missing it (may warrant a lightweight bulk-edit pass rather than per-video correction).
10. Decide whether client-facing video titles need a separate display-title treatment (§14) — a design decision, not a data correction, flagged here because it affects 46 real videos.

---

## 22. Codex Work Safe to Keep

- The entire `RMEDIA_SPATIAL_UI_SIDECAR_BLUEPRINT_2026_09.md` document — thorough, internally consistent, cross-checked against the actual scanned drawings (independently re-read this wave; the "AS IT IS" vs. "ASSETS" reading is confirmed legible as "AS IT IS" on direct visual inspection of page 2, matching the blueprint's own conclusion and the mission brief's pre-confirmation).
- Its component-reuse table (§24–26 of the blueprint) — accurately names real, current functions/components (`getWorkSessionOverview`, `getProductionOrders`, `getProjectStreaks`, `NowFocusPanel`, `WarRoomRefreshControl`, etc.), verified to exist in the current source tree.
- Its "what must not change" list (§34) — correctly reflects House Cleaning Wave 2's actual boundaries as implemented (Work Session one-open invariant, Production Order atomicity, Client Portal auth, Finance currency-safety).

Nothing needs to be discarded or rewritten. This is a clean, usable specification.

---

## 23. Codex Work Needing Completion/Rework

None — Codex's actual deliverable (the blueprint) is complete on its own terms. What remains is **implementation**, which was never Codex's assigned task for this artifact (its own hard gate says so). The one substantive addition this wave's audit would recommend before implementation starts: explicitly specify the "client with no in-flight video" empty state for the Active Jobs region (§19 above) — a real gap the blueprint doesn't yet cover, surfaced only by testing it against Dave's actual current data.

---

## 24. Recommended Next 2–3 Waves

### Wave 2 — War Room Sidecar (implementation)
**Mission:** Build the `/war-room/sidecar` route per the blueprint's own spec — route/shell + tests, bounded sidecar read model, factual panels, commands/quick capture, restaurant projection, responsive/performance QA, in that order (blueprint §35's own suggested slicing).
**Surfaces:** War Room only (new route, additive).
**Why now:** Clearest drawing, strongest operator need, smallest blast radius (new route, not a rewrite of the accepted `/war-room`), and it establishes the shared spatial/panel/refresh conventions the other two waves will reuse.
**Not in scope:** CRM or Dashboard changes; Pomodoro (explicitly deferred by the blueprint itself); the "Assets" ambiguity (already resolved as "AS IT IS," not applicable to this wave anyway).
**Success test:** sidecar route passes the blueprint's own no-scroll/performance/density budgets at all 5 specified landscape breakpoints, reuses only existing read models/actions (no new domain logic), and does not alter the standard `/war-room` route's current accepted behavior.

### Wave 3 — CRM Spatial Recomposition + Pilot Dashboard Reconciliation
**Mission:** Recompose `/crm/[id]` into the blueprint's 5 regions using Dave and Taryn as the acceptance test, and apply this wave's proposed dashboard configurations (§7, §11) for both — pending Emmanuel's sign-off on §21's data corrections first.
**Surfaces:** CRM client detail page; client dashboard section/capability flags for Dave and Taryn specifically.
**Why now:** Reuses the density/panel conventions Wave 2 will have proven; real pilot data (this report) is now available as the concrete acceptance test instead of hypothetical personas.
**Not in scope:** War Room or Dashboard changes; onboarding additional clients beyond Dave/Taryn; the video display-title design decision (§14) — flag it but don't resolve it in this wave unless Emmanuel explicitly prioritizes it.
**Success test:** every region specified in §16/§17 of this report renders correctly (including the honest-empty-state cases) for both Dave and Taryn without any region needing invented filler data.

### Wave 4 — Dashboard "AS IT IS" HUD
**Mission:** Recompose the Dashboard per blueprint §9–11, now that "AS IT IS" is confirmed and War Room/CRM boundaries are visually proven.
**Surfaces:** Dashboard only.
**Why now:** Blueprint's own recommendation — implementing it last avoids recreating War Room or CRM in miniature, since their real shapes will already be known from Waves 2–3.
**Not in scope:** Any restoration of removed stat cards/History; anything not in the blueprint's §11 target hierarchy.
**Success test:** Dashboard's dominant card and 4 observed-numbers facts render correctly using only existing data for both Dave-shaped (mostly-done, unassigned-heavy) and Taryn-shaped (batch-heavy, in-flight) operator states, without needing a third client to validate against.

---

## 25. Exact Recommended Next Action

**Before any further implementation wave:** get Emmanuel's decisions on the 10 items in §21 (all data/config, zero code) — most take under 5 minutes each and directly determine whether Dave and Taryn's CRM/Dashboard pages will look correct once Wave 3 recomposes them. Everything else in this report is already actionable without further input.

---

## 26. Required Final Table

**WAR ROOM SIDECAR:** NOT STARTED
**DAVE PILOT:** GREEN
**TARYN PILOT:** YELLOW
**CRM SPATIAL MODEL:** VALIDATED
**CLIENT DASHBOARD MODEL:** VALIDATED
**PRODUCTION MUTATIONS:** NONE
**DEPLOY:** NOT PERFORMED

**RECOMMENDATION:** Proceed to Wave 2 (War Room Sidecar implementation) now, in parallel with Emmanuel resolving the 10 non-blocking Dave/Taryn data items in §21, since neither workstream blocks the other.

---

## 27. Stop

Read-only archaeology and reconciliation complete. No implementation performed. No deploy performed. No production data reconciled/mutated. No next-wave prompt written, per instruction.
