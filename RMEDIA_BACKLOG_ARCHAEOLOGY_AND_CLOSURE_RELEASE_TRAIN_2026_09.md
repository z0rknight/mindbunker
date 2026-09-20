# Backlog Archaeology, Closure & Pre-Reset Release Train (2026-09-20)

Goal: fewer open concepts, clearer boundaries, one clean source/deploy state, one canonical handoff. Two proven root fixes shipped; everything else is classified.

## 1. Source snapshot
Start: HEAD = release = `production/current` = `6c33814f0`; migration head 0052, none pending; Operator `51dc1808…`, Client `6a619197…`; `main` is an old, unrelated branch (`d3b528b3a`). Verified live, not assumed. End: product commit `eb568bb`, Operator `b7130cac-b455-4d85-9bc6-8a3c224f024e` (rollback `51dc1808-da15-42b4-b50a-8b6f0cb30118`), Client unchanged, Sensor/public untouched, no migration, **0 production writes**.

## 2. Evidence reviewed
The seven recent release reports; the Sep 16 handoff (stale, now replaced); Sep 16–18 patch reports and the Sep 18 refinement ledger (which had already classified Quick Switch / Commitments / Finance duplication / labs); LET'S COOK exercise and health reports; the Saturday material. `MINDBUNKER_QA_COVERAGE.md` and `SEPTEMBER_LOCAL_FEATURE_HARVEST_REPORT.md` are not present in any workspace folder, so they were not read (their known contents are covered by the Sep 18 ledger). Every "closed" claim below was re-checked against current source, not taken from a report.

## 3. Original 18-item list, reconciled
1 Production Order final state — **DONE**. 2 PDBM referral intake — **DONE**. 3 Canonical referral attribution — **DONE**. 4 Referral end-to-end proof — **DONE** (production data path; the CRM label was never seen in the live authenticated UI). 5 Client Production Memory — **DONE**. 6 Taryn recipes — **PARTIAL** (3 records; template/reference/use-case facts are human input). 7 Pre-export QA — **DONE** (lightweight; automation deferred). 8 Client vocabulary — **PARTIAL** (3 terms; uncertain spellings await the operator). 9 Source readiness / production context — **DONE** (read-only context; first-class fields not justified). 10 Content Waterfall economics — **PARTIAL** (evidence checkpoint delivered; profitability waits for data). 11 Quick Notes harvest — **DONE**. 12 Revision provenance — **DONE** (control shipped; samples accumulate). 13 Production-mode interruption rule — **DONE** (three root patterns fixed). 14 App/work intelligence — **DONE** (browser surface needs an operator setting). 15 Pricing Lab — **WAIT**. 16 PDBM conversion learning — **WAIT** (0 real leads). 17 Outbound marketing — **DEFERRED**. 18 Personal-performance systems — **REJECTED**.
Totals: DONE 11 · PARTIAL 3 · WAIT 2 · DEFERRED 1 · REJECTED 1.

## 4. Master leftover ledger (41 items)
**Closed / superseded / already correct (20)** — Production Order truth; PDBM + attribution + proof; Production Memory; pre-export QA + vocabulary; Production Context + nav patterns 1–2; revision cause control; app usage / coverage / timer re-sync; batch evidence + explicit attribution (no auto-spread); Dave delivery_url; **Quick Switch** (no such code exists; superseded by Sensor start/stop/correct); **Commitments / nextAction** (canonical and live: War Room, card, OVERDUE_PROMISE signal, 76 references); **`/lab` and flags** (no lab routes, no flag mechanism; `pricing-lab` is a promoted route); **Finance `getReconciliation` vs `getContractReconciliation`** (two different questions: cash-account vs ledger, operational vs billed; the old "net cash" concept no longer exists); **Sessions readability** (rows already show kind, activity, Sensor origin, open, corrected, overlap; non-client Sensor time lives on Sensor Activity by design); **Long-session flow** (non-client sessions included, detail page carries `returnTo` and forwards it, correction is derived at read time, no auto-truncate, no fake Work Session); **Source readiness fields** (NOT_JUSTIFIED: links in notes are now clickable in Production Context; a field would be schema ceremony); **Google Calendar V1** (one-way link exposed in CRM and the gateway booking panel); client-visible recipes / version history / DAM (no longer current); personal-performance BI (out of product); finish-active-video shortcut (`FinishedVideoButton` exists).
**Safe fixes (2, both shipped)** — (a) Finance "unallocated" drift; (b) third navigation root pattern (§9).
**Observe (4)** — one-off scripts (`august-2026-*`, `curated-production-import`, `local-only-import-historical`): dead but harmless; untracked `_to_delete/` workspace clutter outside git; 6 legacy APPROVED Sensor sessions (Aug 24–25) with no back-link, each with an exact matching Work Session, so no missing work; 4 Sensor sessions > 12 h visible in Long Session Review for the operator to correct.
**Wait for evidence (9)** — video↔Production Memory association; project-level external attribution; work phase; automated pre-export QA; PDBM conversion learning; Pricing Lab; outbound marketing; Markdown in notes; Sensor-native container labeling.
**Human input required (5)** — Production Memory NULLs (template locations, approved references, use cases, approval evidence); uncertain vocabulary (Jannalee, 100 Lead Game, Buy Line; CEO Strong and "Taryn" deliberately omitted); browser window titles (privacy decision plus enabling Accessibility titles in Sensor Preferences); the 4K-detail Quick Note (whether still relevant); Sensor live GUI/sleep QA and stable signing identity.
**Domain decision (1)** — comma-separated tags. **Migration required now: 0.** Conditional candidates, none approved: nullable `billing_allocations.project_id`; a first-class cut-sheet/audio field; a video→memory FK; a work-phase tag.

## 5. Stale items closed
Quick Switch, Commitments-as-lab, old lab/flags, Finance "net cash" duplication, Sessions redesign, Long-session doubts, source-readiness fields, Calendar OAuth, client-visible recipes, personal BI.

## 6. Waiting for real use — see §15 for triggers.

## 7. Human input required
See ledger. Nothing here is engineering debt; do not build UI to compensate for absent facts.

## 8. Migration-required
None active. Rationale and trigger for each conditional candidate are in §15.

## 9. Implemented slices (2 of max 4; zero others were justified)
1. **One definition of "unallocated."** Root cause: last week's explicit partial attribution made "has any allocation" (used by the CRM "unallocated historical billing" surface) disagree with the Finance panel's minute-aware unallocated. Fix: shared `unallocatedShareOfEvidence` built on the same summary; a partly attributed manual row still shows with only its remaining share; a fully attributed row drops out; legacy amount-only rows still count as allocated. Today's output is unchanged (2 manual rows, no allocations); it prevents drift.
2. **Third navigation root pattern.** Root cause: inspection/summary surfaces linked to the Video Workspace with no origin, so closing it landed on the default instead of the operator's view. Fix: Dashboard, CRM client notes, and the Sessions inspector + history table now pass a validated `returnTo` (Sessions carries its exact view and filters). Verified locally: Sessions table → open video → close → back on `?view=table`.
Audit result for the corrective journeys: War Room / Needs Attention / commitments (fixed last train), Sensor long-session review (already origin-safe), missing review URL (clear inline error at the point of action), project overdue/blocked and client-waiting (routed through the signal helper). No remaining raw video links on hot paths; the 5 that remain are in-context (Productivity's own board, quick-create redirects, orders list).

## 10. Browser surface capture: CHEAP_EXISTING_CAPABILITY
The native Sensor already supports optional focused-window-title capture (Accessibility permission plus a "Capture active window titles" preference); the server column and the Safari-vs-ChatGPT-web classifier exist. Production has 0 titles, so it is off or the permission was lost on the ad-hoc-signed rebuild. This is an operator privacy decision plus a settings toggle, not engineering. Safari + a ChatGPT page stays APP=Safari with an optional web surface, never the native ChatGPT app.

## 11. Production integrity sweep (read-only): GREEN
0 open Work Sessions; 1 open Sensor session (the live one), no device with multiple; 0 non-client closed rows stuck pending; 0 cross-client order children; every order has exactly one container; 0 broken client/project/video references; 0 allocations over evidence; 0 cross-client allocations; allocations 9 derived / 0 explicit; approved Sensor sessions with no link 6 (legacy, explained); 4 Sensor sessions > 12 h; 0 Work Sessions > 12 h; 0 DONE/delivered mismatches; 1 complete-but-active project (Project 8, correctly not shown overdue). Real PDBM leads: **0**. Revisions: **0**. Production Memory 3, protected terms 3, export reminders 3, Quick Notes 37, orders 1.
Quick Notes: actionable left **0** (1 UNKNOWN for the operator: the 4K-detail observation).

## 12. Tests and gates
New: 9 (origin/links) + 5 (unallocated) targeted. Full gate once: `git diff --check` clean; **1385/1385**; `tsc` clean; `eslint` 0 errors, 3 pre-existing warnings; build exit 0.

## 13. Deploy and source authority
One deploy (Operator). Local QA: Sessions round-trip, Dashboard link, CRM page. Production: reachability confirmed (login redirects, PDBM 200, portal 200); authenticated UI not required (deterministic, proven locally). HEAD = release = `production/current` after the docs commit; no production-ahead-of-source state.

## 14. What should NOT be worked on next
Pricing Lab; outbound marketing; a BI dashboard; automated caption/B-roll QA; a Sessions redesign; a project-level allocation migration; first-class cut-sheet/audio fields; video→format FKs; work-phase logging; personal scoring; a Quick Notes manager; Google OAuth; more referral infrastructure. Do not add generic QA checks or terms without evidence.

## 15. Reopen triggers (operational, no arbitrary sample sizes)
- **Pricing Lab:** a few completed real batches/jobs that each have tracked time, an explicit external-time attribution to the batch, billing evidence, a client payment for the period, and revisions recorded where they happened, spanning more than one kind of work. Then run the read-only readiness snapshot again.
- **Project-level attribution:** the operator hits two real cases of "this time is Project X but there is no order/video". Then the nullable `project_id` proposal (at most one of `video_id`/`project_id`; existing rows stay valid).
- **Video↔memory association:** the operator repeatedly states which format a batch uses (two or more batches), or a pre-export miss is format-specific.
- **Work phase:** a real quote/capacity decision depends on rough-cut vs captions. Prefer an app-mix hint before any field.
- **Browser surface:** the operator enables titles; verify production `window_title` counts before touching the classifier.
- **Automated QA:** the same reminded error class ships again after the reminders existed (two or more repeats).
- **PDBM:** the first real lead: verify `clients.source = 'referral:pdbm'` and the CRM label, then decide on conversion tracking.
- **Outbound:** only after an offer with proven economics exists.
