# RMEDIA OS — House Cleaning Wave 1
## Solo Editor Operating Model + System Simplification Research
**Date:** 2026-09-14 · **Type:** Research / product-architecture only. **No code was changed, deployed, or migrated.**

**Method:** five parallel read-only codebase audits (Video Workspace; CRM+Projects; Productivity+War Room+LET'S COOK; Sessions+Finance+Health; Dashboard+Equipment+Pricing Lab) with exact file:line citations, cross-checked against a direct schema/nav audit of my own, plus external research into IPTC NewsML-G2/Photo/Video metadata standards, kitchen display system (KDS) UX principles, and DAM canonical-record practice. Every claim below traces to a real file, table, or commit — nothing here is guessed.

---

## 1. Executive verdict

MindBunker is not one product anymore. It is roughly **fourteen** primary nav destinations and **fifty-eight** database tables built for a business with one employee, one client at a time in front of him, and one editing bay. Most of the actual engineering effort of the last three weeks went into a single surface — the per-video "Operational Memory" panel — that was built in **one week** (2026-09-01 → 2026-09-08) largely in reaction to a checklist audit document, not to observed daily friction. That panel now carries **65-75+ interactive controls**, several of which contradict each other by the codebase's own admission (a revision counter with permanently-accepted drift; two independently-maintained blocker taxonomies that differ by one category each).

The good news: the commercial core (Finance's three-truths model: operational / billing / financial, kept deliberately unmerged) is disciplined and should mostly be left alone. The bad news: everything wrapped around that core — the video workspace, CRM's client detail page, video creation, and Dashboard — has been growing by accretion, one patch at a time, each patch individually reasonable and each one adding a few more things Emmanuel has to read before he can start editing.

**Verdict: SIMPLIFY, not rebuild.** The data model underneath is largely fine (three separate money truths, revisions-with-provenance, blockers). The problem is almost entirely in the *surface* — what's shown, when, and how many places do the same thing. Five root changes (§32) would remove most of the felt complexity without touching Finance's core discipline or Health at all.

---

## 2. Emmanuel's actual operating model

He is not managing a system. He is:
- Sitting at an editing bay (Premiere/Resolve/After Effects) with a second screen or iPad beside it.
- Working through one video at a time, mostly alone, for one client at a time.
- The one person who edits, replies to clients, quotes prices, delivers, and gets paid.

The correct question for every control on every screen is the one the mission states: **would he actually touch this while editing a video?** The audits below show that the honest answer, for most of what currently sits on the video workspace and the CRM client page, is no — and the system currently does not distinguish "things he touches while editing" from "things he touches once a month."

---

## 3. Restaurant "cash register + order ticket" model

**COMANDA (operations — what's cooking right now):**
- What am I working on right now (current video / active session)
- What's queued next, in priority order
- What just arrived (new intake/batch)
- What's blocked — one line, not a form
- What needs a decision or review
- What just got delivered

This is Productivity + War Room's live command grid. It should be the *entire* surface visible beside the editing machine. Kitchen display systems solve exactly this: glanceable digital tickets replacing paper, organized by station/priority, one-tap "mark complete," visual (not textual) status differentiation, and automatic overdue-surfacing rather than a manual "mark as late" step. War Room's own recent boundary patch (this repo, `war-room/page.tsx:127-139`) already states this goal in almost identical language — "what is active now / what needs attention / what just changed" — and correctly demoted five BI layers behind a disclosure. The remaining work is making sure what's *left* on the live grid earns a glance, not a read (§20).

**CAIXA (administration — cash register / commercial truth):**
- Who is the client (identity, relationship)
- What are we charging (contracts, quotes)
- What's been paid (transactions, billing evidence)
- What portal settings exist
- What history/provenance matters

This is CRM + Finance + the Chain-of-Custody/Commercial-Truth panels. It's fine for CAIXA to be denser — Emmanuel walks up to it deliberately, the way a manager opens the register at day's end, not while plating a dish. The failure mode found repeatedly in this audit is CAIXA-density leaking into COMANDA surfaces (Dashboard restating Finance/CRM/Health numbers; the video workspace carrying an 8-stage production checklist and a full revision-provenance form).

---

## 4. Journalist / IPTC mental model

The mapping the mission proposed holds up well against the actual schema:

| MindBunker | Newsroom concept | Fit |
|---|---|---|
| Client | Source / account | Good — a client is a stable, named counterparty, exactly like a wire-service source. |
| Project | Story / assignment package | Good — `projects` groups related content items under one client, one status, one deadline. |
| Production Order / Batch | Assignment / coverage plan (Planning Item) | Good in concept, poor in implementation (§6, §18) — it should be a lightweight assignment record, but currently spins up a parallel video-creation path. |
| Video | Editorial/content item | Good — this is the actual unit of value; everything should ultimately be "about" a video the way a wire story is "about" an event. |
| Asset | Media resource | Good, and already correctly kept separate from Video per an explicit "VIDEO ≠ DELIVERABLE ≠ ASSET" comment (`AssetsPanel.tsx`, per audit). |
| Session | Production evidence/activity record | Good — exactly analogous to a reporter's timesheet/activity log. |
| Delivery | Published/delivered rendition | Good — versioned, linked to a commitment. |
| Revision | Editorial version/change | Good concept, undermined by a second, un-synced "revision count" control (§13). |

**Does it improve the mental model? Yes, selectively.** The newsroom framing is most useful for exactly two things: (1) confirming that a Video, not a Project or a Batch, is the real canonical unit of value — everything else exists to give it context; (2) validating that "assignment" (batch/production order) should stay a thin wrapper *around* video creation, never a second way to create videos. It should not be force-mapped everywhere — MindBunker does not need Concept Items, Knowledge Items, or a formal Package/News/Planning item-type taxonomy (§22).

---

## 5. Current entity map

**58 database tables**, categorized:

| Domain | Tables | Count |
|---|---|---|
| Core business | clients, projects, video_logs, production_orders, revisions, deliveries, production_checklist_items, blockers, friction_events, commitments | 10 |
| CRM/leads | crm_events, intake_submissions, gateway_invitations, booking_settings, availability_windows, bookings | 6 |
| Commercial/billing | quotes, payment_requests, commercial_contracts, billing_evidence, billing_allocations, finance_settings, platform_fees, reconciliation_notes, debts, subscriptions, transactions, personal_transactions, cash_balance_snapshots, cash_accounts, cash_movements, cash_account_snapshots, operating_reserve_settings, fx_conversions, fx_manual_rates | **19** |
| Work/time | work_sessions, sensor_devices, sensor_sessions, device_activity_observations, activitywatch_imports, activitywatch_events | 6 |
| Health | health_logs, caffeine_events, screen_time_snapshots | 3 |
| Historical import (one-off) | hist_import_batches, hist_identities, hist_identity_source_labels, hist_facts, hist_source_coverage | 5 |
| Assets/media | assets, source_media_references | 2 |
| Equipment | equipment_systems, equipment_assets, equipment_maintenance_events, equipment_acquisitions | 4 |
| Decisions, Auth, Captures | decisions, auth_attempts, captures | 3 |

Nineteen tables just for money, for a business with one bank relationship and a handful of clients, is itself a complexity signal — though, per §15, it is a *disciplined* nineteen (§9's Finance audit), not a redundant one.

**Navigation:** 14 top-level destinations (`src/components/layout/Sidebar.tsx`) in 5 groups: OPERATIONS (War Room, Dashboard, Productivity, Projects, LET'S COOK, Sessions, Equipment), COMMERCIAL (CRM, Pricing Lab), MONEY (Finance, Subscriptions, Debts, Contracts), INTELLIGENCE (All History), HEALTH (Health). Nearly every entry's placement is justified by a comment citing one specific past patch/sprint ("Brief C," "LET'S COOK Wave 1," "Monday Real-Operation Pre-Freeze," "FX + Business Operating Cash Patch") — good evidence this grew by many independent, individually-reasonable additions rather than one IA design pass. Subscriptions/Debts/Contracts were each promoted from Finance sub-pages to top-level items one at a time.

---

## 6. Current feature inventory

See §8 for the classified version. Full raw inventory by surface:

- **Video Workspace** (`VideoOperationsCard` + `VideoEditor` modal): 12-field details form, lifecycle transitions, portal-visibility toggle, cover upload, Work Session panel, Project References (read-only), Commercial Terms panel, Video Memory (freeform notes), and the "Operational Memory" umbrella — Promise & Delivery (13+ controls), Production Ticket (8 dropdowns, expanded by default), Friction & Blockers (7+ controls, two taxonomies), Revision Provenance (5 controls), Log Manual Time (5 controls), Email/Schedule-call/Copy-Context/Client-follow-up (4-11 controls).
- **CRM**: list page (add-client modal, needs-attention feed, 4 status buckets + internal + Geladeira archive, 5 KPI cards, per-row 6-action `ClientWorkbench`); client detail page (~20 named sections across Operational Dossier, Client Intelligence, Opportunity/Gateway, Commercial Truth, Geladeira control, Portal Access, Quotes panel, Chain of Custody, plus a 4-tab `ClientTabs` — Overview with 9 more subsections, Projects, Notes, Activity).
- **Projects**: list (filters, Unassigned Deliverables, 3 grouped sections); detail (11 top-level sections including 3 separate video-creation entry points and a Cards/List/Bulk-edit triad).
- **Productivity**: 10 sections, 8 parallel queries per render, ~16 control types.
- **War Room**: live command grid (5 sections, 5 mutation surfaces) + 5 collapsed BI layers (~35-45 fixed stat values, Daily Ledger table alone up to 50-80 data points).
- **LET'S COOK**: 12-field batch-intake form; batch detail page; a video-creation path structurally separate from the other three.
- **Sessions**: two sub-views (table/ledger, timeline/week/month), overlap/gap detection, raw-vs-wallclock dual totals, correction flow; one canonical manual-time action reachable from 4 different places.
- **Finance**: hub with 3 tabs + 6 sub-pages (contracts, contract detail w/ reconciliation, debts, debt detail, subscriptions, subscription detail, FX, Personal Finance) across 19 tables.
- **Health**: daily habit tracker, caffeine quick-log, stat cards, timeline, 30-day ledger with correction, Screen Time sub-section.
- **Equipment**: overview + systems + assets + acquisitions, 4 tables, 2,436 lines, zero links to/from any business workflow.
- **Pricing Lab**: pure client-side calculator, zero DB reads/writes, produces copy-paste text only.
- **Dashboard**: ~30 stat cards, ~25 of them (in two collapsed `<details>`) verbatim restatements of War Room/Productivity/CRM/Finance/Health, by the code's own admission.
- **All History**: a one-time historical-reconstruction subsystem (5 tables, its own module, its own test suite, its own artifact JSON files), explicitly "not live data," gated behind a manual import that may not currently be active.

---

## 7. Feature classification (CORE / SUPPORT / ADMIN / HISTORY / HOBBY / AUTOMATABLE / DUPLICATE / DEBT / REMOVE CANDIDATE)

| Feature cluster | Classification | Why |
|---|---|---|
| Video status/lifecycle transitions | CORE | The one thing that must always be right; touched every session. |
| Video details (title/client/project/links/type) | CORE | Minimum canonical record (§7 of mission / §11 here). |
| Work Session start/stop (live timer) | CORE | The primary daily action besides editing itself. |
| Execution Queue (Productivity board) | CORE | "What can I edit next" — the single most important question. |
| War Room live command grid | CORE | Glance-and-know state. |
| Promise/deadline (single date + note) | CORE | Real commercial obligation. |
| Delivery link recording | CORE | The actual handoff fact. |
| CRM client identity/relationship/next-action | CORE | Who am I dealing with, what do I do next. |
| Video Memory (freeform notes) | SUPPORT | Genuinely used (comment evidence: capped specifically because volume grew), but blocks deletion forever — needs a size/lifecycle rule. |
| Blocked flag + one-line reason | SUPPORT | Useful, but as ONE fact, not two taxonomies. |
| Client Portal visibility toggles (data-level) | SUPPORT | Real, occasional, correctly server-enforced. |
| Client Dashboard section toggles (presentation-level) | SUPPORT, but see DEBT | Legitimate feature, arrived same week as this audit — watch for further accretion. |
| CRM Opportunity/Gateway/Briefing panel | ADMIN | Only relevant for leads mid-conversion, not daily. |
| Commercial Terms / Chain of Custody | ADMIN | Correct to exist, wrong to be always-open on two different pages. |
| Quotes / Pricing Lab | ADMIN | Occasional, deliberate, not daily-editing-adjacent. |
| Finance (all sub-pages) | ADMIN | Entered deliberately at bookkeeping time, not while editing. |
| Equipment (all) | ADMIN | Confirmed zero coupling to daily work; correctly desktop-only already. |
| Sessions history/correction | HISTORY | Reviewed after the fact, not during. |
| Recent Deliveries / Completed archive | HISTORY | Correctly already collapsed. |
| Chain of Custody, Evidence panels | HISTORY | Provenance, read occasionally. |
| War Room's 5 BI layers | HISTORY | Correctly already demoted behind a disclosure. |
| All History (hist_* subsystem) | HISTORY, borderline REMOVE CANDIDATE | One-time reconstruction, not live, possibly inactive. |
| Health (all) | HOBBY — protected, do not simplify | Per explicit instruction; cleanly isolated already. |
| Project/batch/client "last activity," "progress %," "delivered count" | AUTOMATABLE | Already computed from facts in most places — the remaining manual-adjacent risk is the revision counter (§13). |
| Dashboard's Historical Context + Detailed Statistics blocks | DUPLICATE | Code's own comments confirm 1:1 restatement of War Room/Productivity/CRM/Finance/Health. |
| CRM `ClientWorkbench` (list-row 6-action mini-CRM) | DUPLICATE | Explicit "faster door" duplicate of the full client page's own actions. |
| 3-4 video-creation entry points | DUPLICATE | Same table, different validation paths, one (LET'S COOK) structurally divergent. |
| Manual time entry (video panel vs. Sessions vs. Backfill vs. ⌘K) | DUPLICATE (surface, not code) | One action, four doors. |
| Production Ticket (8-stage checklist) | DEBT | No evidence of real use; expanded-by-default; only test asserts the table starts empty. |
| Friction vs. Blocker (two taxonomies) | DEBT | Independently maintained, one category apart, doubles the maintenance surface for one concept. |
| Revision count vs. revisions table drift | DEBT | Codebase's own comment admits this is permanent and accepted. |
| "Copy Context" button | DEBT (symptom) | Exists because the panel itself is too dense to communicate from directly — treat the cause, not this symptom. |
| "Schedule call" shortcut | DEBT | Doesn't create anything; a disguised prefill of the Promise form. |
| ⌘K Quick Capture triplicating panel actions | DEBT | Third entry point for actions that already have two. |
| 3 separate client-status-change paths (CRM) | DEBT | Metadata tab, Opportunity stage select, Convert button — all can move the same fact. |
| Pricing Lab ↔ Quotes manual re-entry | REMOVE CANDIDATE (as separate step) | Field shapes already match; the gap is pure wasted motion. |

---

## 8. Video Workspace deep audit

This is where the mission's own screenshot complaint lives, and the audit confirms it is not an exaggeration.

**Structure:** collapsed `VideoOperationsCard` → "Open workspace" click → `VideoEditor` modal. Inside the modal: `CommercialTermsPanel`, `VideoMemoryPanel`, `OperationalMemoryPanel`, and a 12-field details form, all stacked and all visible at once (left column adds cover/status/portal-toggle/WorkSessionPanel/ProjectReferences). One click reveals everything — there is no single master collapse; the modal itself is the only gate.

**The single most important fact from this audit:** nearly the entire "Operational Memory" subsystem — commitments, friction, blockers, deliveries, the production checklist, and revisions-with-provenance — was built in **one week** (commit `01f5012`, 2026-09-01, migration `0036`), and the UI panel that exposes it was built **the next day**, with its own commit message stating *"no new primitives invented, per the 'use what exists' rule"* — meaning the backend tables existed before any demonstrated UI need. Several of the panel's remaining features (Email, Schedule-call, Client follow-up, Log Manual Time) were added a week later, on 2026-09-08, explicitly to *"close every PARTIAL/MISSING item that traced back to the user's own wording... from the acceptance audit"* — i.e., built to satisfy a checklist document, not repeated observed friction. This is the textbook shape of "engineering built it because it could be built," which the mission explicitly says not to protect.

**What earns its place (per the mission's own likely-essential list, §10):**
- What video, who for, what project, what status, source/reference/delivery links, deadline, "what next" — all present in the 12-field form and the lifecycle box. **Keep.**
- Start/stop work — `WorkSessionPanel`, always visible. **Keep.**
- Revision exists (a fact happened) — **keep as one line: note + date.**
- Blocked (a fact) — **keep as one line: reason.**

**What does not earn its place:**
- **Production Ticket** (Assembly/Color/Audio/Motion/Captions/QA/Export/Delivery, 8 dropdowns, expanded by default): no test or comment anywhere demonstrates real usage; the only integration test confirms the table starts *empty*. It answers a question ("which of 8 sub-stages is this video in") nobody asked for in the mission brief and the code shows no evidence Emmanuel asked for either. **Remove from daily UI; if kept at all, one optional field, not eight.**
- **Two "memory" features with the same name** (Video Memory = freeform notes in `crm_events`; Operational Memory = the whole umbrella): confusing on its face. **Rename/merge: one "Notes" concept.**
- **Friction vs. Blockers**: two independently-maintained taxonomies (9 vs. 8 categories, one apart) for what the mission itself suggests is one fact — "BLOCKED + short reason." **Merge into one.**
- **Revision Provenance panel** (cause/category/minutes/note, 5 controls) sitting beside a *second*, drifting revision-count display the codebase's own comments admit will "legitimately disagree" forever. **Simplify to note+date; let provenance be derived from the existing audit trail (`crm_events`) rather than a second manual data-entry form.**
- **Manual time entry**: a second, redundant entry point into the exact same `work_sessions` table the always-visible timer already writes to — built in reaction to one missed day. **Move out of the daily panel** (§15).
- **Email / Schedule-call / Copy Context**: Email is a `mailto:` link (fine, cheap, keep). Schedule-call creates nothing — it is UI theater. Copy Context's own existence is an admission the panel is too dense to read from directly. **Fix the density; the copy-button becomes unnecessary once the panel is actually simple.**
- **Client follow-up**: a per-video quick action that silently rewrites the *client's* entire opportunity record. **Move to CRM only, or make it obviously client-scoped, not video-scoped.**

**Cost/frequency estimate (mission §9 test) for the worst offenders:**

| Control | Frequency | Cognitive cost | Failure cost if ignored | Verdict |
|---|---|---|---|---|
| Production Ticket (8 dropdowns) | unproven, likely near-zero | High (8 independent 3-state fields) | None (nothing reads it downstream except its own progress math) | Primary surface removal |
| Revision Provenance form | low-moderate | Moderate (4 selects/inputs) | Low (simple note+date covers 90% of value) | Simplify |
| Log Manual Time (panel copy) | rare (built for one incident) | Low | Low (Sessions/Backfill already cover it) | Remove from this panel |
| Schedule-call button | rare, and misleading | Low | None | Remove (fold into "Add promise") |
| Friction log | low-moderate | Low | Low | Merge into Blocked |

---

## 9. CRM deep audit

**List page**: 1 add-client modal + 4 status-bucketed lists (+internal +Geladeira archive) + 5 KPI cards + 1 needs-attention feed + a per-row `ClientWorkbench` carrying its **own** 6 actions (Email, Schedule call, Create quote, Add follow-up, Add note, Create project) — explicitly documented as a deliberate duplicate "faster door" onto the same actions the full client page already has. Two parallel action surfaces for the same primitives is exactly the kind of complexity the mission asks to eliminate (§27: "keep data, remove manual control" or "merge").

**Client Detail page**: ~20 named sections across `page.tsx` + a 744-line `ClientTabs.tsx` + 9 panel components (Operational Dossier, Client Intelligence, Opportunity panel with embedded Gateway link generator, Commercial Truth, Geladeira control, Portal Access, Quotes panel, Chain of Custody, then a 4-tab area whose Overview tab alone unpacks into 9 more subsections: Instagram card, default cover, portal capability toggles, portal *section* toggles, payment requests, briefing, contact info, statistics, metadata). Sixteen-plus distinctly-named "Patch/Round/Sprint/Brief §" comment tags appear in CRM files alone — a direct paper trail of accretion, including one feature (dashboard section toggles) added the same day as this audit.

**Three independent places can change a client's lifecycle status/stage**: the Metadata tab's status select, the Opportunity panel's stage select, and the list page's Convert button. None of these is wrong individually; together they mean "what stage is this client at" has no single source of truth in the *UI*, even though the DB itself is fine.

**Three separate, easy-to-conflate visibility/permission concepts** live on one page: `portalCan*` capabilities (can the client see financials/review/set priority), `portalShow*` dashboard-section toggles (is a section rendered at all), and Geladeira archival (is this client hidden from default views). All three are individually well-reasoned in code comments — the problem is density, not correctness.

**Newsroom-clarity test (mission §16):** a client record should answer identity / relationship / contact / projects / commercial relationship / portal settings / recent activity / next action / notes. Every one of those is present — buried among roughly twice as many sections that don't map to that list (Instagram auto-import, Gateway briefing display, Chain of Custody, multiple stat-tile blocks). **Recommendation: fold Client Intelligence + Commercial Truth + Chain-of-Custody into one "Recent activity / context" panel, collapsed by default; remove ClientWorkbench; unify the 3 status-change paths into 1.**

**Lead vs. Client:** no separate template — the exact same ~20-section page renders for a brand-new lead as for a long-standing client, including portal password issuance and dashboard-layout toggles that mean nothing until there's a real production relationship. A lead's page should be visibly smaller than a client's.

---

## 10. Projects deep audit

Schema itself is lean — `projects` has only 10 columns. The complexity is entirely in the surrounding surface: the Project Detail workspace carries 11 top-level sections, including **three** separate "add a video" entry points (`AddVideoButton`, `BulkAddVideosButton` with its own 413-line sequence-generator mode, and the global `PlanVideoButton`), a Cards/List/Bulk-edit triad for the same video roster, and its own Assets + Source Media + Chain-of-Custody panels (the last shared verbatim with CRM, rendered on *both* pages). Fields like status, delivery URL, review URL, and batch label are editable from three different surfaces post-creation (inline create, `BulkEditVideosButton`'s selective-field patch, and the video workspace itself).

**Its most important job, per the mission, is to give content context — not become an admin database.** It mostly succeeds at the former (the newly-added Unassigned Deliverables section is a good example: bounded, honest about a real gap, links out rather than duplicating) but the video-creation triad and the Assets/Source-Media/Custody trio push it toward the latter. **Recommendation: unify video creation (§32 root #3); keep Assets/Source-Media/Custody but default them collapsed.**

Project filter semantics are clean: all 5 real statuses map into 3 displayed groups, nothing is silently hidden except one pre-existing, intentional, unrelated Geladeira exclusion.

---

## 11. Productivity deep audit

10 sections, 8 independent queries fanned into 5 derived views on every render (force-dynamic, no caching — this is a genuinely CPU/DB-heavy page for what it shows). Roughly 16 distinct control *types* on the page itself, before counting anything inside a video's own workspace. This is largely the CORE surface the mission wants: "what can I edit next," not "what does the database know." The Execution Queue's recent layout fix (this repo, same session as the earlier patch) already addressed the worst visual complaint. The remaining opportunity is trimming the "Quick actions" and header stat strip to only what changes hour-to-hour, and making sure the per-card control count stays low now that the workspace-panel audit (§8) has identified where the real bloat lives (inside the modal, not on this page).

---

## 12. War Room deep audit

Already substantially improved by the prior patch in this engagement: 5 BI layers correctly collapsed behind one disclosure, live command grid (NowFocusPanel, Active Commitments, Active Signals, Decisions, Daily Ledger) correctly kept above the fold. Remaining findings:

- Even collapsed, the 5 BI layers carry **35-45 fixed stat values**, and the always-visible **Daily Ledger table alone can pack 50-80+ individual data points across 7 days** (Capacity/Work/Output/Quality/Money columns, several with 2-4 sub-values each) — this table is closer to a spreadsheet than a glanceable KDS ticket.
- War Room is **not** read-only: 5 real mutation surfaces exist (session finish/start, commitment snooze/complete/cancel, decision record/result/cancel), plus 30-second auto-refresh. That's appropriate for a COMANDA screen — the KDS analogy explicitly wants one-tap actions here.
- Every BI-layer number is a verbatim duplicate of numbers shown on Dashboard, Productivity, or Finance (§20's cross-reference). **Recommendation: War Room should be the one canonical home for these numbers; Dashboard's copies should be removed, not just hidden (§32 root #2).**

**Second-monitor / iPad-landscape fit:** the live command grid is close to the KDS ideal already. The Daily Ledger table is the one component that would not survive a genuine "glance sideways" test — it rewards reading, not glancing.

---

## 13. LET'S COOK deep audit

12-field batch-intake form (client, project, contract, label, channel, received date, pricing model, expected value, currency, notes, repeatable video-title rows with paste-to-fill, idempotency key) — reasonably tight for what it does. Batch detail page is clean: derived phase badge, 4 commercial metrics, time-tracked breakdown, per-item cancel.

**The structural problem, not a UI problem:** LET'S COOK does not reuse the app's one existing video-creation chokepoint (`createVideoLog`/`createVideoLogsBulk` → shared validation). It has its own separate validator and inserts directly into `video_logs`, always creating one extra hidden "container" row, and introduces a second, order-scoped "cancel a video" concept (`cancelled_at`) that doesn't exist anywhere else in the app — a plain Plan-Video or Add-Video video can only be deleted or transitioned, never "cancelled with history preserved." Every deliverable it creates is otherwise a perfectly ordinary `video_logs` row (same status, same kind, same `batch_label` column the other paths already use), so this is fixable without touching the batch concept itself (§32 root #3).

---

## 14. Sessions relationship

Clean historical surface: two sub-views (table/ledger for filtered deep-links; timeline/week/month as the default), real overlap/gap detection, and a raw-vs-wallclock dual-total system that only surfaces when an actual overlap exists — good restraint. Manual time entry is **one canonical server action** reused correctly by four different callers (video workspace panel, `/productivity/backfill`, global ⌘K, Captures promotion) — not code duplication, but real surface-area complexity: four different places in the product can trigger the identical mutation. Optimize for the normal path (§15/§32 root #1): the timer is the normal path; manual entry should live in exactly one obvious place (Backfill, or the global capture), not also inline on every video.

---

## 15. Finance/admin relationship

Genuinely disciplined, not duplicated. `commercial_contracts` + `billing_evidence` (billing truth) are kept permanently separate from `transactions` (financial truth) and from `work_sessions` (operational truth) by explicit design — reconciliation only ever *reports* the difference between the three, never rewrites one to match another. `debts.remainingBalance`, `subscriptions.monthlyEquivalent`, and "operating reserve saved so far" are all correctly derived-not-stored.

Two real gaps found:
1. **Quotes and Payment Requests are financially significant but live entirely outside `/finance`**, administered instead from CRM and Productivity — and nothing in the schema or actions layer tracks whether an approved Quote ever actually turns into a real contract/billing-evidence/transaction. Not urgent to fix, but worth knowing: an approved quote can silently vanish without ever reconciling against real money.
2. **Personal Finance page holds two coexisting "how much money do I have" concepts** (Wise-pocket custody vs. recorded ledger net) that the page's own copy admits are not expected to match — a real, if contained, source of operator confusion.

---

## 16. Health boundary

Confirmed clean: zero imports, either direction, between `modules/health` and any of `projects`/`crm`/`productivity`/`finance`. Health cannot break billing, client management, project management, or editing, and nothing there depends on it. The one real coupling is **War Room**, which reads `health_logs`/`caffeine_events` directly for its Biological Correlation layer and the Daily Ledger's "capacity" column — via three *independent* direct-schema-import paths (Health's own module, the analytics service, and the daily-ledger module) that each separately re-derive the same "health facts by day," rather than going through Health's own existing public API. This is a backend tidiness note about how **War Room** reads Health data — it is not a recommendation to touch Health itself, and it is explicitly out of scope per the mission's own instruction. If Health were ever removed, only War Room's BI disclosure and one Daily Ledger column would need to change; nothing else in the app would notice.

---

## 17. Vocabulary audit

| Current term | Would a video editor/journalist say this naturally? | Recommendation |
|---|---|---|
| "Operational Memory" | No — sounds like a database concept, and collides with the *other* "Video memory" feature | Split and rename: "Notes" (freeform) + no separate umbrella name needed once §8's simplification lands |
| "Production Ticket" | Mildly — but the 8-substage version doesn't match how Emmanuel actually talks about a video's state | Replace with the mission's own suggested 5-state model: Not started / Working / Review / Revision / Done |
| "Revision Provenance" | No — pure architecture vocabulary | "Revision history" or just "Revisions" |
| "Friction" (as distinct from Blocker) | No — nobody says "log a friction event," they say "this took longer because X" | Merge into "Blocked" |
| "Execution Queue" | Somewhat — "Queue" alone would read more naturally | Minor: "Queue" |
| "Batch-equivalent" (time) | No — internal accounting term leaking into UI copy in places | Replace with plain "batch time" or drop from operator-facing copy |
| "Chain of Custody" | No, but harmless — it's in an admin-only, collapsed panel | Keep as-is (low exposure) |
| "Geladeira" | Yes — this is Emmanuel's own word (Portuguese for "fridge"), already natural to him | Keep |
| "Comanda" / "Caixa" | Yes — Emmanuel's own restaurant vocabulary, should be adopted directly in any future IA rename | Adopt |

General finding: most vocabulary problems live inside the Operational Memory panel (§8) — fixing that panel fixes most of the vocabulary problem for free.

---

## 18. Duplicate/manual-fact audit

Every place a fact is entered or restated more than once:

1. **Video status/URLs/batch label** — editable from 3 surfaces (inline create, bulk-edit patch, video workspace).
2. **Revision count** — two systems (`revisionsCount` int vs. `revisions` table), one older control (+1/-1 quick action) writes only the int, causing admitted permanent drift.
3. **Client lifecycle stage** — 3 independent write paths (CRM Metadata tab, Opportunity stage select, Convert button).
4. **Client follow-up/next-action** — writable from CRM's Opportunity panel *and* from every individual video's workspace (the video-scoped control round-trips the client's entire opportunity record to avoid blanking hidden fields).
5. **Dashboard stat cards** — ~25 of ~30 are verbatim restatements of War Room/Productivity/CRM/Finance/Health numbers, confirmed by the code's own comments.
6. **Manual time entry** — one action, four doors (§14).
7. **Pricing Lab output → CRM Quote** — matching field shapes, zero code connection; 100% manual retype.
8. **"Schedule call"** — writes nothing new; it's a relabeled Promise.
9. **Friction categories vs. Blocker categories** — two vocabularies for one underlying "something slowed me down" concept.

Every one of these is a simplification target per the mission's own instruction (§23: "find places where Emmanuel enters the same fact twice").

---

## 19. Current freelancer lifecycle

```
LEAD → CLIENT → PROJECT → INTAKE/BATCH → VIDEO → WORK SESSION → REVIEW → REVISION → DELIVERY → BILLING EVIDENCE → PAYMENT → HISTORY
```

Walking the transitions against the real code:

| Transition | Input | Canonical fact created | Automatic derivation | Operator action required | Next surface |
|---|---|---|---|---|---|
| Lead → Client | CRM Convert button OR Opportunity stage reaching a threshold | `clients.status` | none | 1 click | CRM detail |
| Client → Project | New Project form (CRM Projects tab, or Projects page) | `projects` row | none | fill 3-4 fields | Projects |
| Project → Intake/Batch | LET'S COOK Fire Order, **or** Plan Video, **or** Add Video(s) — three different forms | `production_orders` row (LET'S COOK only) + `video_logs` rows (all three) | phase badge (derived) | fill form (varies by path) | Productivity/Project Detail |
| Batch → Video | (same insert as above) | `video_logs` rows | queue membership, stats | — | Productivity |
| Video → Work Session | Start Work (timer) or Log Manual Time (4 entry points) | `work_sessions` row | tracked time totals | 1 click (timer) or a 5-field form (manual) | video workspace / Sessions |
| Session → Review | Status transition to READY_FOR_REVIEW | `video_logs.status` | — | requires reviewUrl filled first | client portal |
| Review → Revision | Register Correction (5-field form) | `revisions` row + `revisionsCount` sync | — | fill cause/category/minutes/note | video workspace |
| Revision → Delivery | Record delivery (4-field form) | `deliveries` row, overwrites `videoLogs.deliveryUrl` | commitment auto-marked DONE if linked | fill URL/note | video workspace / client portal |
| Delivery → Billing Evidence | Record Billing Evidence (contract detail page) | `billing_evidence` row | reconciliation vs. tracked minutes | fill period/minutes/rate | Finance/contracts |
| Billing Evidence → Payment | "Link Income" button | `transactions` row | — | 1 click, but **manual, not automatic** | Finance |
| Payment → History | (automatic) | — | shows up in Sessions/Finance history views | — | Sessions/Finance |

**Where the same fact gets entered twice:** the Batch→Video step (3 different forms for the same insert), and nowhere does an approved Quote automatically become a Project/commitment — that handoff is entirely manual and untracked (§15).

---

## 20. Proposed simplified lifecycle

```
CLIENT → PROJECT → VIDEO (created one way, from anywhere) → WORK (timer) → DELIVER → BILL → HISTORY
```

Collapse Intake/Batch into "how a Video gets created" rather than a parallel entity with its own rules — a batch becomes a *label* attached at creation time (client + project + batch name + deadline + paste titles → same creation path everything else uses), not a second table with its own container-video and cancellation semantics. Collapse Review/Revision into the Video's own status + a lightweight revision note, not a 5-step separate lifecycle. Keep Billing Evidence → Payment as a deliberate, manual "Link Income" click (this is correct — money should never move without a human decision), but consider surfacing "this contract has unreconciled evidence" more prominently so it isn't only visible on a page Emmanuel visits rarely.

---

## 21. IPTC principles worth adopting

1. **Stable identifier, used consistently** — MindBunker already has `video_logs.id`; the fix is *discipline* (always route through the canonical `videoWorkspaceHref`/id-based link, never re-derive a title-based reference), not a new ID scheme.
2. **Separation of admin metadata from content metadata** — NewsML-G2's `itemMeta` (who/when/status/internal notes) vs. `contentMeta` (what it's about, headline, description) maps cleanly onto splitting the video's "internal admin facts" (status, client, dates) from "content facts" (title, type, notes) — currently blurred across ~8 panels instead of two clear groups.
3. **Small controlled lifecycle vocabulary** — NewsML-G2's `pubStatus` is exactly 3 values (usable/canceled/withheld). Direct precedent for collapsing the Production Ticket's 8 stages to the mission's own suggested 5.
4. **Relationships instead of duplication** — video belongs-to project belongs-to client; a batch is a relationship/label, not a duplicate creation path.
5. **Planning/Assignment as a distinct, lightweight concept** — validates LET'S COOK conceptually, as long as it stops being a second way to create the content item itself (§13, §32 root #3).
6. **Controlled vocabulary where useful, not everywhere** — content type and blocker reason benefit from a small fixed list; notes should stay free text.
7. **Canonical record / single source of truth** (also a DAM principle, not just IPTC) — every other surface should *read from* the video's own record, never re-enter the same fact.

## 22. IPTC concepts to reject as overkill

1. **Globally-unique URN-style GUIDs** — unnecessary for a single-tenant app; the integer PK already is the stable identifier.
2. **Full incrementing version-number-per-edit history** — Emmanuel doesn't need "version 3 of video 42"; a revision note + date covers the real need (mission's own §13 suspicion, confirmed).
3. **Full `rightsInfo`/licensing schema** — not relevant; RMEDIA isn't licensing footage to third parties.
4. **The full NewsCodes taxonomy tree** (50+ vocabularies) — wildly overkill; the existing 5-value content-type enum is already sufficient.
5. **Multiple formal Item types** (News/Package/Concept/Knowledge/Planning/Catalog as separate schemas) — one video record + one lightweight assignment/batch relationship is enough; do not build six formal entity types.

---

## 23. Candidate features to remove

- **Production Ticket 8-stage checklist** from the daily video workspace (no evidence of use; §8).
- **"Schedule call" button** (creates nothing; a disguised Promise prefill).
- **Dashboard's Historical Context + Detailed Statistics blocks** — not demote further, actually remove; the numbers already live on their real pages.
- **CRM `ClientWorkbench`** row-level duplicate action surface — keep the full client page as the one action surface.
- **Per-video "Log Manual Time" control** inside the workspace panel (keep the capability in Backfill/⌘K only).

## 24. Candidate features to merge

- **Friction + Blockers** → one taxonomy, one "Blocked: [reason]" fact.
- **Video Memory + Operational Memory's note-adjacent bits** → one "Notes" concept.
- **Revision count display + Revision Provenance form** → one simple note+date control; retire the separate `+1/-1` quick action or route it through the same write path so drift stops accumulating.
- **3 client-status-change paths** (CRM) → 1.
- **Pricing Lab → CRM Quote** → one "Create quote from this calculation" action instead of manual retype.
- **3-4 video-creation entry points** → 1 shared creation path, with LET'S COOK and Project-detail forms as thin wrappers over it (§32 root #3).

## 25. Candidate features to automate

- Project "next action" text — already derived in most places; extend the same logic everywhere it's currently a manual field.
- Batch/order phase badge — already derived, correctly, from item statuses; no change needed.
- "Last activity" timestamps across Projects/CRM — already derived from Work Sessions in the audited code; confirm this pattern is used consistently rather than re-implemented per surface.
- Revision "provenance" — instead of a dedicated 5-field manual form, derive a lightweight history view from the existing `crm_events`/audit trail plus one note field, rather than asking Emmanuel to also categorize cause/category/minutes by hand every time.

## 26. Candidate features to move to History/Admin

- Chain of Custody / Evidence panels — already collapsed on CRM; should be collapsed (not removed) on Project Detail too, for symmetry.
- Client Intelligence + Commercial Truth (CRM) — fold into one collapsed "Recent activity" panel.
- **All History** (`hist_*` subsystem) — demote from primary nav entirely; it is a one-time reconciliation artifact, not a daily or even monthly surface, and may not be active at all right now.
- Friction log (post-merge with Blockers) — the resolved/historical record stays, just not as a live daily taxonomy.

---

## 27. Proposed operational surface (COMANDA)

War Room (primary, glanceable) + Productivity (execution queue) + a **radically thinner** video workspace containing only: title/client/project/status, source/reference/delivery links, one deadline, one blocked-reason line, start/stop timer, one revision note+date, and "what do I do next." Everything else currently on that panel moves to CRM/Finance/Sessions or is removed outright.

## 28. Proposed administrative surface (CAIXA)

CRM (simplified per §9) + Finance (kept as-is, it's already disciplined) + Equipment (kept as-is, already correctly scoped) + Pricing Lab (merged into Quote creation, §24) + the demoted All History.

## 29. Proposed simplified information architecture

```
OPERATIONS         COMMERCIAL          MONEY              HOBBY
War Room           CRM                 Finance            Health
Productivity       Pricing→Quote       (Contracts/Debts/
Projects                                Subscriptions stay
LET'S COOK                              sub-pages, not
Sessions                                top-level nav)
Equipment (admin,
 desktop-only,
 unchanged)
```

All History drops out of primary nav entirely (reachable via a link from Sessions or Finance if ever needed again, not a sidebar item). Subscriptions/Debts/Contracts fold back under Finance as sub-pages rather than three additional top-level items — nothing is lost, they're one click deeper.

---

## 30. Risks of simplification

- **Revision provenance simplification** could lose real analytics value if Emmanuel *is* actually using cause/category data somewhere not surfaced in this audit — verify with him directly before removing fields, not just collapsing them.
- **Merging Friction into Blockers** loses the "time lost but not blocking" signal if that distinction turns out to matter for billing/negotiation conversations — confirm it doesn't before deleting the table, not just the UI.
- **Removing Dashboard's duplicate stat blocks** could momentarily feel like "losing" a view Emmanuel has muscle memory for, even though the same numbers exist one click away — sequence this as a redirect/link, not a silent disappearance, for the first few weeks.
- **Unifying video creation** touches the one part of LET'S COOK's container/cancellation model that other code depends on (time-tracking rollups distinguish container vs. per-video time) — this needs careful, incremental implementation, not a single sweeping change, in whatever wave actually builds it.
- **CRM simplification** risks hiding a genuinely load-bearing field behind a collapsed panel if Emmanuel checks Commercial Truth or Client Intelligence more often than this audit's static analysis can detect — same caveat as above, verify against his real usage before deleting anything, only demote first.

## 31. What must NOT be lost

- The three-truths discipline in Finance (operational/billing/financial kept separate) — this is the single most correct piece of architecture found in the whole audit; do not "simplify" it into one merged ledger.
- Health's clean isolation — do not add new cross-imports while simplifying other surfaces.
- The revision *fact* itself (something changed, when, roughly why) — simplify the form, not the fact.
- Client-visible data gating (`visibleToClient` on projects/videos, `portalCan*` capabilities) — these are security boundaries, not presentation choices; nothing in this simplification should weaken them.
- Geladeira and the Wise-pocket custody reconciliation — both are real, deliberate, correctly-scoped features that happen not to be over-built.
- The Execution Queue's recent stage-grid layout fix and the Unassigned Deliverables surface — both landed this same engagement and are already right-sized; don't re-complicate them chasing this report's other findings.

---

## 32. Recommended Wave 2 scope — 5 ROOT SIMPLIFICATIONS

1. **Rebuild the video workspace's "Operational Memory" down to three concepts: Deadline, Note, Delivery link.** Remove the Production Ticket 8-stage checklist from daily UI. Merge Friction into Blockers (one taxonomy). Simplify Revision Provenance to note+date. Remove the in-panel "Log Manual Time" control and the "Schedule call" button. This single change removes the majority of the ~65-75 controls currently on one video's workspace and directly answers the mission's own screenshot complaint.

2. **Delete (not just collapse) Dashboard's duplicate stat blocks**, and make War Room the one canonical home for the income/production/biological/momentum numbers it already owns. Dashboard keeps only: now-tracking, top attention item, today's numbers, quick actions.

3. **Unify video creation into one path.** Plan Video, Add Video, Add Multiple Videos, and LET'S COOK's Fire Order all call the same validated creation function. LET'S COOK becomes a thin "assignment" wrapper (client + project + batch label + deadline + paste titles) over that one path, removing the separate container-video mechanism and the second "cancelled" concept it currently introduces.

4. **Simplify CRM's Client Detail page to the newsroom-clarity model**: identity, relationship, contact, projects, commercial relationship, portal settings, recent activity, next action, notes — with Client Intelligence + Commercial Truth + Chain-of-Custody folded into one collapsed "Recent activity" panel, `ClientWorkbench` removed in favor of the one full detail page, and the 3 independent client-status-change paths reduced to 1.

5. **Connect Pricing Lab directly to CRM Quote creation** (one "Create quote from this calculation" action) and **demote All History out of primary navigation** — two small, cheap, high-confidence fixes bundled together because each is individually too small to be its own root item, but both eliminate real, needless manual/navigational friction.

---

## Final classification, by cluster

| Cluster | Classification |
|---|---|
| Video status/details/timer | KEEP AS-IS |
| Execution Queue / Productivity board | KEEP AS-IS |
| War Room live command grid | KEEP AS-IS |
| War Room BI layers | KEEP BUT DEMOTE (already done; keep it that way) |
| Production Ticket (8-stage) | REMOVE FROM DAILY UI |
| Friction taxonomy | MERGE (into Blockers) |
| Revision Provenance form | SIMPLIFY |
| Revision count / revisions-table drift | AUTOMATE (single write path) |
| Manual Time (in-panel) | MOVE TO HISTORY / REMOVE FROM DAILY UI (keep only in Backfill/⌘K) |
| "Schedule call" | REMOVE ENTIRELY |
| "Copy Context" | REMOVE ENTIRELY (symptom disappears once panel is simplified) |
| Client Follow-up (video-scoped) | MOVE (to CRM only) |
| Dashboard duplicate stat blocks | REMOVE ENTIRELY |
| Dashboard core (now/attention/today) | KEEP AS-IS |
| CRM identity/relationship/next-action | KEEP AS-IS |
| CRM ClientWorkbench (list-row duplicate) | REMOVE ENTIRELY |
| CRM Client Intelligence / Commercial Truth / Custody | MERGE + MOVE TO HISTORY (one collapsed panel) |
| CRM 3-way status-change paths | MERGE |
| Projects Assets/Source-Media/Custody | KEEP BUT DEMOTE (default-collapsed) |
| 3-4 video-creation entry points | MERGE |
| LET'S COOK batch form | KEEP AS-IS (form itself is fine) |
| LET'S COOK container/cancel mechanism | SIMPLIFY (via merge above) |
| Sessions (table + timeline views) | KEEP AS-IS |
| Finance (all sub-pages) | KEEP AS-IS |
| Quotes ↔ Pricing Lab gap | MERGE |
| Equipment | KEEP AS-IS |
| Health | KEEP AS-IS (protected) |
| All History | REMOVE FROM DAILY UI (demote out of primary nav) |

**This research is complete. No implementation, deployment, migration, or production mutation was performed.**
