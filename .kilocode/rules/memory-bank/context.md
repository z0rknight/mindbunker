# Active Context: RMEDIA MindBunker

## Current State

**Project Status**: ✅ Live mobile-ready Cloudflare/D1 MVP at `emmanueldarosa.com/mindbunker`, protected by a verified single-user login

RMEDIA MindBunker is a personal life metrics and professional performance tracker for a video editor. Built with modular architecture, SQLite database via Drizzle ORM, and a dark cyberpunk UI.

The original February 2026 visual design is the canonical interface. The separate August `Site-Mindbunker` operational-telemetry prototype is not part of this application.

## Recently Completed

- [x] **Great Reset Commercial Operating Layer (2026-10-08, production / pre-dogfood ready)**
  - [x] Added one canonical commercial path from segment landing context through `/start`, immutable Lead evidence, human Offer-fit decision, canonical Quote, optional public Offer projection, and existing Quote → Project/Video/Recipe production conversion
  - [x] Added additive migration `0058_commercial_operating_layer.sql`: one manually owned capacity singleton plus revocable/expiring public projection fields on canonical Quotes; no automatic capacity, pricing, payment, acceptance, Lead promotion, or Finance mutation
  - [x] Added operator CRM surfaces that keep acquisition context, user evidence, derived suggestion, and human commercial decision distinct; capacity exposes OPEN/LIMITED/WAITLIST/PAUSED, recurring 0–3, Hero 0–1, actor/reason/timestamp
  - [x] Added anonymous token-gated `/offer/[token]` projection with explicit price, scope, assumptions, expiry and optional external HTTPS payment link; only token hashes persist and external clicks do not imply payment or acceptance
  - [x] `/start` now preserves allowlisted landing/offer/ref context, desired outcome, approval owner and budget readiness/range as immutable intake evidence while retaining one canonical Lead by email
  - [x] 1,614 tests, typecheck, production build, migration `0057 → 0058`, FK/quick checks, and ESLint with 0 errors / 3 pre-existing warnings GREEN; automated browser visual QA remained unavailable due saved browser policy
  - [x] Production D1 backed up before writes (`218ffd97014b68355c5cbc2e6ba57ce64cdaabbc8e6bd2d206e5ca2093d36094`), migrated once to `0058`, and verified with empty `foreign_key_check`, `quick_check = ok`, unchanged Client/CRM-event/Quote counts and zero public Offers
  - [x] MindBunker commit `cc477692545074bec757ec741cad19d1c04e5240` deployed as Worker version `85a7dfcf-aec2-4455-8bc7-b47853c44b44`; public commit `a1443e3c4efc16774178a45c6e3d070b895d6974` deployed as Worker version `ae3be0b7-574c-4e65-a411-f5425144e869`; HTTP/runtime smoke GREEN and rollback was not required
  - [ ] Human visual QA and real-world commercial dogfood remain the next gate; no further coding wave is authorized by this closure

- [ ] **Delivery Recipe / Quality Custody Wave 1 (2026-10-08, local candidate / real dogfood pending)**
  - [x] Added additive migration `0057_delivery_recipes.sql`: reusable Recipe templates, ordered/enabled steps, immutable per-Video snapshots and append-only transition history with actor/source/provenance
  - [x] Preserved canonical ownership: Video owns the deliverable; Work Sessions own time; review/revisions own client feedback; Sensor and Quick Capture are unchanged
  - [x] Added low-friction Video Workspace controls for `NOT_STARTED → ACTIVE → DONE`, `N_A`, and truthful `DONE → ACTIVE` reopen; one active step at a time and no required notes/duration/reason
  - [x] Added primitive `/recipes` management and a client-safe projection limited to Editing, Finishing, Quality review and Ready for you
  - [x] Legacy production checklist remains under Advanced / history and is neither migrated nor reinterpreted
  - [x] 1,605/1,605 tests, typecheck, production build, isolated `0000 → 0057`, production-shaped `0056 → 0057`, FK and quick checks GREEN; lint has 0 errors / 3 pre-existing warnings
  - [x] Local authenticated HTTP smoke passed and exact QA fixture was removed; browser visual automation was blocked by saved localhost policy and no bypass was attempted
  - [ ] Exit remains blocked only on one real Video dogfood proving naturally low tracking friction; no deploy or production migration performed

- [x] **Pre-deploy refinement wave (2026-10-07, release candidate / no deploy)**
  - [x] Closed the native workspace-link contract drift: RMEDIA now opens `/war-room/workspace?video=<id>` and the test suite guards the canonical query name; Start copy now says clearly that Project/Client text only filters a canonical Video list
  - [x] Finished the existing Film Rolls interaction without new domain/schema: strict line-level subject validation, atomic parent+subject creation, edit/archive, Current/Archived status views, readable dates, soundtrack/notes retrieval, dialog/Escape/error semantics
  - [x] Made Pricing Lab evidence follow the selected content type, mapped Custom to canonical `other`, removed the 24-row confidence truncation, exposed revision count and stated both off-Video exclusion and the missing billed-value boundary for realized EHR
  - [x] Human Safari dogfood proved invalid-line rejection, 18-shot atomic creation, edit/archive, default archived exclusion, archived recovery, exact local QA cleanup and Short-form→Long-form evidence switching
  - [x] Full web suite 1,591/1,591, typecheck, operator/client production builds, lint 0 errors / 3 pre-existing warnings; native 53/53 plus debug/release builds; isolated 0000→0055 and production-shaped 0054→0055 both FK-clean / quick-check ok
  - [x] MindBunker source `9b8cc6e`; RMEDIA source `93c8c1c`; separate stable-signed build 16 SHA-256 `b9cdcfb1…890d`; installed app SHA remains `047dad65…23e`
  - [x] Production remains Worker source `9b94855`, D1 head 0054. No deploy, remote migration/write, installed-app replacement or production credential mutation

- [x] **07 Oct Reality / Intelligence / Client Proof Pass (2026-10-07, local candidate / no deploy)**
  - [x] Reconciled the 07 Oct dump, 48 scanned notebook pages, repository/source authority and read-only production D1 before implementation; ambiguous handwriting stayed qualitative/uncertain and produced no writes
  - [x] Added a read-only Pricing Lab reality dataset over canonical closed Work Sessions with recorded-vs-inferred content classification, completed/active sample counts, confidence disclosure and an explicit operator hour override; formula and config remain unchanged
  - [x] Proved Geoff Front Door Video 1 at 14.37 canonical hours / 11 Sessions / still IN_PROGRESS; the reported extra Upwork hour and ~20h final remain non-canonical context/forecast until manually reconciled and completed
  - [x] Confirmed `work_sessions.source = MANUAL` is the existing canonical untracked-time path; no duplicate adjustment table added
  - [x] Audited native permission behavior as truthful/privacy-preserving and added bundle version/build/source provenance plus a documented deliberate candidate-update path; 52/52 native tests and stable-signed release build pass
  - [x] Added local-only Film Rolls reference inventory with month/search/rating filters and counted subjects, backed by additive migration 0055; no media hosting and no production migration
  - [x] Human local Safari QA passed for Film Rolls list/form and Pricing Lab evidence/override; implementation commit `fca957d`, Sensor source `496f42a`, stable-signed build 15 SHA-256 `384ceae…c8cb`
  - [x] Classified current Dashboard redundancy as NOT A BUG; deferred Before/After approval, native URL mutation and updater network infrastructure until their canonical contracts can be implemented coherently
  - [x] Production stayed at migration 0054; no deploy, remote write, installed-app replacement or credential change

- [x] **Pré-Wave 1 human QA closeout (2026-10-07, BLOCKED / no corrective implementation)**
  - [x] Proved the exact native candidate `69978acc…a419` launches under the normal user context, reads the current Offer Doc catalog, preserves local Quick Notes across relaunch, and leaves canonical execution idle when no Work Session is active
  - [x] Read-only D1 checks reconfirmed Capture 8 → Session 105 → Offer Doc, occurred-at one second before recorded-at, 5,423s canonical tracked time, no promotion links, no active Session, and Offer Doc still IN_PROGRESS
  - [x] Human UI found the direct Notes control absent from Home and found synchronized notes omitting both `Synced` and canonical Session association despite those values existing in local SQLite
  - [x] Launching the separate candidate repeatedly co-launched the installed app because both share the same bundle identity; exact-process isolation was required to avoid inspecting the wrong binary
  - [x] Source-authority audit proved `ef42ed0` and `a3cca63` are ancestors of deployed housekeeping source `9b94855`; therefore the MindBunker Pré-Wave code is already present in the current production Worker and the stated non-deployed premise cannot be certified
  - [x] Start/ACTIVE/End, a new meaningful Offer Doc capture, Pending/Failed/Local-only visual states, and the MindBunker browser surface remain unproven; no synthetic editing Session was created and the saved browser policy blocked the production page
  - [x] No product code, schema, migration, deploy, rollback, or production cleanup performed during closeout

- [x] **Taryn legacy cleanup + passwordless portal alignment (2026-10-07, production)**
  - [x] Archived the five exact historical Taryn projects (1, 4, 5, 15, 16), including all three Content Waterfalls, and removed 41 preserved legacy videos from client visibility, priority, and active queue placement without deleting rows or rewriting editorial status
  - [x] Preserved current DFY execution: Videos 85 `Front Door Video 11` and 86 `Offer Doc` remain IN_PROGRESS and visible in active Project 19
  - [x] Extended the explicit Taryn canonical identity registry so Client 2 portal projections include owned work under operational alias 12; archived projects and unrelated clients remain excluded, and client actions fail closed on archived work
  - [x] Made active operator queue membership require a non-archived Project, keeping historical unassigned Taryn rows in evidence/history rather than execution
  - [x] Promoted the existing expiring, revocable Gateway capability URL as the simple no-password portal path that can be sent manually through Slack/email; password login remains a fallback and no Slack bot/OTP subsystem was added
  - [x] Deployed source `9b94855`: Operator Worker `b74835a8-c22e-4243-bb02-98f65a016bc0`, Client Worker `313a3368-a8c3-43af-8cd2-918a163fc043`
  - [x] Pre-write D1 export SHA-256 `b55f802e5e96b75d649d0f8a7ea3e2422246be84d056448ec78c87b378df6222`; production head stayed 0054, no migration, FK check empty, quick check ok
  - [x] 1584/1584 tests, typecheck, operator/client builds, lint 0 errors / 3 pre-existing warnings and public HTTP smoke pass

- [x] **Pre-Wave 1 — RMEDIA capture custody and operator-flow reconciliation (2026-10-07, local candidate)**
  - [x] Added a read-only RMEDIA Quick Captures lane that preserves occurred time versus ingestion time, canonical Session association, captured Client/Project/Video path, observed app, and fail-closed integrity warnings
  - [x] Removed native operational notes from generic promotion actions and stale unresolved-capture signaling without rewriting or promoting any evidence
  - [x] Added explicit Bulk Add guidance separating Project Source Media from delivery, review, and published URLs; confirmed `Source Media = 0` was caused by source footage being entered as `published_url`, not a projection defect
  - [x] Added a visible native Notes route plus sync-state and canonical Session evidence; capture, credential, privacy, API, and sync contracts remain unchanged
  - [x] Deferred universal internal-work execution because canonical Start still accepts only `video_id`; no speculative entity or schema was added
  - [x] Read-only production reconciliation proved Session 105 closed at 5,423s against Offer Doc, the Video remained IN_PROGRESS, Quick Capture 8 preserved occurred-at versus ingestion and the canonical relationship path, Source Media stayed zero because the Drive source was stored in `published_url`, and D1 FK/quick checks were green; writes remained zero
  - [x] 1581/1581 web tests, typecheck, production build, lint with 0 errors / 3 pre-existing warnings, 52/52 native tests, debug/release native builds, isolated migrations through 0054, FK and integrity checks pass
  - [x] Separate signed candidate executable SHA-256 `69978acc06c375eac7f21058a9de63a390e69b6df4406246d30ee06e0065a419`; installed app, production Worker/D1, credentials, and production migration state untouched

- [x] **Wave 5 — Dashboard / Operating Reality (2026-10-04, local candidate)**
  - [x] Replaced the action-heavy Home dashboard with one observational Operating Reality composition; War Room remains the sole execution owner and Dashboard exposes only bounded links and global entity drawers
  - [x] Composed canonical Wave 1 execution, Wave 4 Project membership/progress/integrity, Finance received/receivable/expected evidence, Work Sessions, Sensor observation, timestamped output events and War Room signals without introducing a second source of truth
  - [x] Kept received cash, open payment requests and expected/registered billing separate; kept recorded Sessions, observed Sensor activity and telemetry coverage separate; availability remains explicitly unknown instead of becoming a fabricated capacity score
  - [x] Rendered explicit no-evidence states, provenance/coverage disclosures, Client load, individual Project progress and drawer-first Client/Project/Video/Session inspection; Taryn DIRECT/DFY work continues to roll up to canonical Taryn
  - [x] Authenticated local QA passed IDLE, canonical ACTIVE session reflection, Project and Client drawers, refresh, desktop and 390×844 with zero horizontal overflow and no console warnings/errors; the exact QA session/event were guard-deleted and baseline returned to 8 Work Sessions / 33 CRM events
  - [x] Applied existing migration 0053 locally only after a recoverable D1 checkpoint; local head is `0053_slow_shen.sql`, `crm_events.payload_json` exists, FK check is empty and integrity is `ok`
  - [x] 1563/1563 tests, typecheck, production build, diff check and lint with 0 errors / 3 pre-existing warnings pass; no deploy, remote D1 write, new migration, schema design, or feature expansion

- [x] **Wave 4 — Projects Structural Convergence (2026-10-03, local candidate)**
  - [x] Reframed Projects as the structural owner — Client → Project → explicit Batch when present → Deliverable — while War Room remains the sole execution surface and full Project pages remain the management surface
  - [x] Added URL-state semantic views (Current default, By Client, Waiting, Completed, Internal, All) plus Cards/Rows density; Recurring is deliberately deferred because no canonical Project recurrence primitive exists
  - [x] Canonicalized portfolio grouping through the Wave 0 identity registry, preserving Taryn DIRECT/DFY work mode while presenting one Taryn relationship; project search now matches canonical Client and contained Deliverable titles
  - [x] Derived Client/Internal work class from exact canonical ownership, kept lifecycle separate from condition, fixed DONE progress to count all deliverable kinds, and counted batches only from explicit production order / stored batch-label evidence
  - [x] Evolved Unassigned Client Work into a Data Integrity inbox composed with the Wave 0 scanner; no Project, Batch, cycle, estimate, commercial, or activity fact was fabricated
  - [x] Enriched the existing Global Project Drawer with work class, lifecycle, condition and explicit batch count; Project → Deliverable drawer switching and Open full page remain intact
  - [x] Authenticated local QA passed Current, By Client, Cards, Rows, deliverable search, empty Completed/Internal states, structural inbox, Project Drawer, Deliverable Drawer, desktop and 390×844 mobile; Current showed 4 projects / 34 open deliverables / 5 structural issues in the local evidence set
  - [x] 1559/1559 tests, typecheck/build, diff check and lint with 0 errors / 3 pre-existing warnings pass; no production deploy, production D1 write, schema change, or new migration
  - [ ] Repository migration head remains 0053, but this pre-existing local dev D1 is only applied through 0052; Wave 4 did not mutate it

- [x] **Wave 3 — War Room Consolidation / Productivity absorption (2026-10-03, local candidate)**
  - [x] Made War Room the sole primary execution surface: dominant canonical IDLE / ACTIVE / BLOCKED objective, visible WHY NOW, compact live context, actionable signals, bounded NOW / NEXT / LATER queue, collapsed daily ledger, and collapsed historical intelligence
  - [x] Retired `/productivity` as a page while preserving compatibility: the old root redirects to `/war-room`, old video deep links redirect to `/war-room/workspace`, and Plan Video / project context survives the transition
  - [x] Preserved full production administration inside a large War Room queue sheet with search, stage filters, canonical reorder, Start Work, Orders, Backfill, and Capture Inbox; no second recommendation, queue, or lifecycle owner was created
  - [x] Preserved VideoEditor as deep management in `/war-room/workspace`; client, project, video, and session context remains drawer-first through the Wave 2 global inspection contract
  - [x] Removed Productivity from desktop/mobile navigation and changed specialist return paths and shared quick-action labeling to War Room without moving structural Project management into execution UX
  - [x] Visual QA passed desktop and 390×844 for IDLE, ACTIVE, End → IDLE, full queue/search, Client/Project/Video/Session drawers, workspace, old-route compatibility, and six-item mobile nav; the exact synthetic local QA session and its two events were guard-deleted afterward
  - [x] No migration, schema change, production D1 write, deploy, duplicate business logic, or unrelated cleanup; migration head remains 0053 by repository contract
  - [x] 1551/1551 tests, typecheck, production build, diff check, and lint with 0 errors / 3 pre-existing warnings pass

- [x] **Wave 2 — Global Entity Inspection / App Shell (2026-10-03, local candidate)**
  - [x] Added one App Shell-owned, URL-addressable Entity Drawer for canonical Client, Project, Video, and Work Session inspection; `?inspect=type:id` survives refresh, Back/Forward closes/reopens, Escape restores trigger focus, and full pages remain the management destinations
  - [x] Kept business truth in canonical owners: CRM identity/integrity, Projects progress, Productivity lifecycle, Execution recommendation, Work Sessions, Sensor evidence, and Finance received value are composed on demand into read-only inspection DTOs
  - [x] Migrated Dashboard and War Room Next Objective, supported Active Signals, War Room client stage, Projects cards, CRM client rows, and Sessions timeline/table without redesigning those surfaces; removed the two route-local client/session inspectors
  - [x] Video Start/Resume/End remains delegated to canonical `startWork` / `endWorkSession`; the drawer owns no lifecycle mutation, schema, persistence, migration, or financial derivation
  - [x] Added loading, unavailable, missing, inactive and relationship-integrity states plus focus trap, body-scroll lock, independent scrolling, deep links, rapid contextual switching, and a 390×844 bottom-sheet layout
  - [x] Typecheck, 1545/1545 tests, production build, diff check, and lint with 0 errors / 3 pre-existing warnings pass; visual QA passed on Dashboard, War Room, Projects and Sessions. CRM surface-level QA is blocked by the pre-existing local D1 missing `crm_events.payload_json`; no forbidden migration was applied
  - [x] No deploy, production D1 write, migration, Card UX change, or M5/M6 visual work

- [x] **Wave 0 — Truth, integrity & canonical domain foundation (2026-10-03, local candidate)**
  - [x] Established `clients` as canonical Account/Relationship identity while preserving Taryn DFY as an operational alias of canonical Taryn; CRM project counts, current work and realized revenue now roll up to the canonical row without erasing DIRECT/DFY evidence
  - [x] Root-caused the apparent Taryn disappearance to the intentional operational-alias filter introduced by `24b37ed`: the canonical relationship remained visible, but alias work was not projected into it
  - [x] Added a read-only CRM relationship-integrity scanner for missing canonical aliases, exact duplicate identities, project/video ownership drift, unassigned active client work and archived relationships with active commercial/operational children
  - [x] Removed permanent deletion from the normal CRM row surface, expanded protected-history custody across operational, commercial and memory tables, and made identity/status changes atomic with append-only audit events
  - [x] Preserved Finance boundaries: Work Sessions are operational truth, contracts/payment requests are commercial evidence, and transactions are received-value truth; no financial schema or projection rewrite
  - [x] No migration, D1 write, production data repair or deploy. Fresh production D1 verification was blocked by Cloudflare authorization code 7403, so this remains `DEPLOY READY — NOT DEPLOYED`
  - [x] Focused 32/32, full 1525/1525, typecheck/build green, lint 0 errors/3 pre-existing warnings; isolated migrations through 0053 and FK integrity green

- [x] **October Commercial Intelligence Train — production closure (2026-10-03)**
  - [x] Added fail-closed Expected Commercial Value Level 1: Direct hourly work starts after the strongest effective request cutoff; fixed, mixed, unknown and external-platform relationships never derive new owed value from hours
  - [x] Accepted Dave at USD 468.33 OPEN with USD 0 new expected / 0m after cutoff and USD 68.33 / 2h44m historical support inside the current request; preserved Taryn/Upwork as external value authority without double counting Direct/DFY time
  - [x] Derived compact Lead Intent from existing `/start` answers only, persisted immutable `rmedia-guided-intake-v1` evidence, and preserved legacy-v0 readability without a persona question or Card UX change
  - [x] Kept client feedback at contract-only because 0 revision rows / 0 delivery rows / 28 finish events were insufficient evidence; no form, taxonomy or automatic memory promotion shipped
  - [x] Focused 32/32, full 1508/1508, typecheck/build green, lint 0 errors/3 pre-existing warnings; September USD 611.54 / BRL -523.48 regression green
  - [x] Operator source `235c9a3`, Worker `26ba5530-84d8-4d7c-ab1c-17f5c40ad35a`; Public, Client and Sensor untouched; no migration, head 0053 and FK clean
  - [x] Production PDBM E2E proved Lead 13/events 303–304, server recomputation, idempotent replay, CRM/Inbound readability and zero downstream relationships; guarded cleanup restored 9 Leads / 293 CRM events

- [x] **October Admin Reality Patch — production closure (2026-10-02)**
  - [x] Added concise October operating summaries to Dashboard/Productivity, a readable weekly Sessions strip, and explicit captured-versus-Unknown Health semantics
  - [x] Preserved six real Taryn HF deliverables as unassigned while excluding `RELEASE_TEST` fixtures from Unassigned, Productivity, Projects, CRM, and aggregate Project counts without deleting canonical rows
  - [x] Verified Taryn and Dave commercial projections, Finance separation, and both existing Pricing Lab modes; Pricing Lab activation remains NO and Content Waterfall remains a separate curation track
  - [x] Full suite 1503/1503, targeted 132/132, typecheck/build green, ESLint 0 errors/3 pre-existing warnings, migration 0053 and FK integrity green, D1 writes 0
  - [x] Operator-only final runtime source `227895a`, Worker `08ef740a-b7fc-40fe-a195-040bb9d20b7f`; Public, Client and Sensor untouched

- [x] **October Operational Reality Integration — live Operator read models (2026-10-02)**
  - [x] Added reusable client Reality blocks and current/closed monthly Finance blocks without schema or D1 writes
  - [x] Closed Dave request chronology at USD 400 prior / USD 68.33 supported delta / USD 468.33 open / USD 0 paid, with per-video allocation still unknown
  - [x] Closed Taryn at one commercial relationship with 23h51 DIRECT, 10h00 DFY, 33h40 external registered and the reconciled gross/fee/cash chain
  - [x] Preserved Sensor as a coverage source rather than a definition of work; added explicit Finance/time/attribution/delivery/review/source coverage dimensions
  - [x] Fixed client-scoped reconciliation and canonical alias derivation after authenticated live QA; Operator `f06d02e` / `88a657cf-221f-4966-813b-b0a8bc323489`; 1500 tests; migration 0053/FK green

- [x] **Taryn September final close — evidence reconciliation (2026-10-01)**
  - [x] Reconciled the September chatlog against the canonical Upwork close, MindBunker Work Sessions/video lifecycle, and Notion production logs
  - [x] Preserved one commercial Taryn relationship with DIRECT/DFY separation: 33h40m Upwork work-date time and 33h51m25s intentional MindBunker time
  - [x] Closed client-level commercial truth at USD 841.67 work-date gross, USD 729.17 posted gross, USD 72.92 service fees, USD 11.96 withdrawal fees and USD 644.29 Wise cash
  - [x] Kept asset-level delivery/approval YELLOW: 20 September-created client-work records currently DONE versus 12 finish events, one rejected/DONE contradiction, Mini Series changes requested and Geoff in progress
  - [x] Preserved the Bonnie inventory question as unresolved; no production, schema, D1 or deployment changes

- [x] **September 2026 truth closure — MindBunker reconciliation (2026-10-01)**
  - [x] Recovered the post-write checkpoint, applied the later human-input close once, and verified it read-only afterward; no replay, migration, or deploy was performed
  - [x] Closed the seven BRL movements as BRL 603.44 operating + BRL 234.90 personal; September BRL operating total is 923.48 and unknown BRL is zero
  - [x] Closed the Upwork bridge at USD 729.17 posted gross, USD 72.92 service fees, USD 11.96 withdrawal fees and USD 644.29 net proceeds/Wise cash
  - [x] Preserved Work Session 83 as an unresolved 41.0533h interval and excluded it from the read model; final current September read is 153.8425h raw / 112.7725h admissible (CLIENT 72.0350, INTERNAL 28.7931, ADMIN 11.4594, LEAD 0.4850)
  - [x] Preserved Taryn DFY as an `ACTIVE_SURFACE` operational alias mapped to canonical Taryn with work mode DFY; commercial client count remains one and DIRECT/DFY time stays separable
  - [x] Added guarded reconciliation SQL/tests, the read-only projection, and finalized all four month-close artifacts plus the existing Notion human-input card
  - [x] Focused tests 56/56, full suite 1489/1489, typecheck and production build pass; migration head 0053, FK clean, duplicates zero. Deployed Operator source authority remains YELLOW

- [x] **Red as signal, not surface — Operator visual correction (2026-09-21)**
  - [x] Production Dashboard's 11 action tiles unified on neutral surfaces; New Work alone uses a narrow `#FF0000` edge, not a red fill. Sidebar active state, NOW, Attention and Today cards are neutral-first; semantic amber/red/green facts remain distinct.
  - [x] Public Home, `/book`, `/start` inspected and intentionally unchanged; Client and Sensor untouched.
  - [x] 1481 tests, Next build/TypeScript, scoped lint and desktop live QA passed. Operator Worker `d85487b6` only. D1 stayed 6 Leads/267 CRM events, migration 0053, FK clean, read-only queries wrote zero rows.
  - [ ] 390×844 live screenshot remains unverified: in-app browser viewport override stayed at 1280×720. See `RMEDIA_OS_RED_AS_SIGNAL_VISUAL_CORRECTION_2026_09.md`.

- [x] **Night closure — Public motion, YouTube Red, System Inbound custody (2026-09-20–21)**
  - [x] Public + MindBunker primary brand/interactive accent converged to YouTube Red `#FF0000`; semantic success/warning/unknown/derived treatments preserved; Client palette explicitly bounded and unchanged
  - [x] Home and recovered `/book` source use finite one-shot entrance motion with reduced-motion immediate state; `/book` has a deterministic `href="/"` return action
  - [x] `/start` decision model and write contract unchanged; accent tokens only changed to red for Home→intake continuity
  - [x] Added authenticated `CRM → Inbound` read model over canonical Leads + immutable `guided_intake.submitted` events, grouped per Lead, with manual Leads excluded
  - [x] Durable unread count = unread system-intake events; explicit open appends one idempotent `system_intake.seen` event referencing the immutable source event; no GET write, table or migration
  - [x] Live Workers: Public `e3e35906`, separate `/book` `06bd4bd2`, Operator `c87dba7e`; Client `cf5be8f8` unchanged. Operator code `88252f6`, public/book source `1ce6259` (local no-remote repo). One PDBM QA Lead 9 + events 273–275 was exact-guard cleaned; baseline 6 Leads / 267 events / 1 pre-existing unread restored, migration head 0053 and FKs clean.
  - [ ] Separate observed issue: Sensor Activity web page emitted React hydration warning `#418` on fresh load; page renders, causation not established, not changed in this release. Do not claim zero operator console errors until diagnosed separately.

- [x] **Guided Lead Engine — production release closed (2026-09-20)**
  - [x] Shipped public `/start` and `/start?ref=pdbm` card flow plus narrow same-origin Operator API; GET/page views create zero writes
  - [x] Added migration `0053_slow_shen.sql` (`crm_events.payload_json`) for immutable schema-versioned intake evidence
  - [x] Server validates canonical answers, resolves the closed referral allowlist, recomputes the starting path, deduplicates by normalized email and idempotency key, and creates no downstream production/commercial entities
  - [x] CRM dossier renders the latest Guided Intake as human-readable evidence; production visual QA confirmed the complete projection
  - [x] Production E2E proved Lead 7, events 267/268, `schemaVersion=1`, `REPEATABLE_PRODUCTION`, `referral:pdbm`, replay idempotency and zero downstream relationships
  - [x] Guarded cleanup removed exactly the synthetic Lead and two events; baseline restored to 5 clients / 263 CRM events, migration head 0053, zero FK violations
  - [x] Operator `8a8cb33d-8246-4a14-b0c7-1468ae2dfd4f` and public `2a147edf-87b5-453b-9871-ed7a7f791de9` remain active at 100%; closure performed no redeploy

- [x] **House Cleaning Wave 2 micro-hardening — local candidate (2026-09-14)**
  - [x] Distinguished malformed `video` query parameters from an omitted parameter so malformed IDs fail explicitly while numeric nonexistent IDs retain their existing not-found behavior
  - [x] Unified single, Project-bulk, and LET'S COOK child preparation through one canonical validation/defaulting helper
  - [x] Restored LET'S COOK order + operational container + child-video atomicity with one D1 batch and retry-safe ingest-key handling
  - [x] Proved five-child success, injected rollback, retry idempotency, queue exclusion, defaults, and legacy readability against an isolated D1 migration chain
  - [x] Passed 1055 tests, TypeScript, ESLint (0 errors), Next build, OpenNext build, and diff check; no migration, deploy, or production mutation

- [x] **🧭 Master QA Implementation Wave 1 — local candidate (2026-09-02)**
  - [x] Unified Finance on one currency-safe Economic Ledger Net and made `NOT WISE CASH` visually prominent while leaving observed Wise custody/reconciliation intact
  - [x] Renamed contract/work reconciliation to `getContractReconciliation`, preserving the cash/Wise domain name
  - [x] Made canonical RMEDIA-owned Video creation default to `INTERNAL` while preserving explicit operator overrides and historical rows
  - [x] Split Dashboard intentional work into Client Production, Internal Operations, and Total Intentional with exact no-double-count invariant; labeled internal Momentum
  - [x] Moved revision editing from normal Productivity cards into Video Workspace; compacted Project progress/CTA and added 2xl four-column comparison
  - [x] Added a factual CRM operational dossier and moved Chain of Custody under collapsed Evidence & Provenance without removing it
  - [x] Added durable Master QA/coverage ledgers; no migration, D1 mutation, upload, or deploy

- [x] **🧭 Tuesday Operator Intelligence patch — code-only candidate (2026-09-02)**
  - [x] Added deterministic Dashboard NOW and ATTENTION projections over existing Work Sessions, Promises, blockers, and video lifecycle facts
  - [x] Made Promise entry and correction explicitly America/Sao_Paulo → UTC, runtime-timezone independent, and rejected due dates before creation; historical invalid rows remain unchanged and surface as DATA ISSUE
  - [x] Corrected seven-day windows to exactly today plus six prior operator days and month trends to comparable elapsed MTD spans with small-sample guards
  - [x] Replaced the Health history surface with a union-derived daily ledger from health logs, quick coffee events, and closed intentional Work Sessions; missing evidence stays unknown rather than zero
  - [x] Labeled quick-coffee caffeine as estimated, preserved manual mg as precise override, and quarantined untrustworthy Sensor input counters from intelligence
  - [x] Consolidated Health reads, added focused operator-intelligence tests, and verified synthetic local dogfood plus 390×844 / 768×1024 / 1440×900 QA with no global overflow or console errors
  - [x] No schema/migration change; 671/671 tests, TypeScript, ESLint (0 errors), Next build, OpenNext build, and diff check pass

- [x] **🩹 Live correction sprint — local release gate (2026-08-27)**
  - [x] Fixed Owner Pay's Drizzle `INSERT … SELECT` projection/order crash while preserving one atomic, idempotent Business → Personal bridge
  - [x] Added truthful historical Health dates and stable-ID correction; `created_at` is preserved and `updated_at` records the edit
  - [x] Made Project-native Plan Video lock to the current Project and derive Client ownership server-side
  - [x] Split CRM commercial truth into realized Finance revenue, open pipeline, and approved/closed value without mixing currencies
  - [x] No migration; 601/601 tests, TypeScript, source ESLint, Next build, OpenNext build, responsive QA, and local FK check passed
  - [x] Full repository lint remains red only because it traverses pre-existing generated `.round-logs/` and `_to_delete/.next*` artifacts; sprint/source scope has zero lint errors
  - [x] Production unchanged; awaiting explicit live-patch approval

- [x] **🛰️ Sensor P1.1 Inbox + observation sync audit — local only (2026-08-24)**
  - [x] Split native intentional evidence into `sensor_sessions` review state while preserving passive observations as an independent stream
  - [x] Added explicit Approve → exactly one `MAC_SENSOR_APPROVED` canonical Work Session; Archive and confirmed manual soft Delete preserve evidence
  - [x] Added session detail with timestamp-overlap app totals, idle time, and NULL-safe aggregate input counters
  - [x] Diagnosed missing apps as legacy `LOCAL_ONLY` observations without outbox rows plus absent active local sync configuration, not a web projection bug
  - [x] Added native outbox repair and local/uploaded/pending/rejected/last-success diagnostics; proved Notion, Claude, ChatGPT, Finder, Safari, and Premiere end to end locally
  - [x] Added migration `0020_sensor_inbox_p11.sql`; clean isolated `0000`–`0020`, FK check, 217 web tests, 19 native tests, typecheck, and scoped ESLint pass
  - [x] Production remained untouched; no deploy or remote migration

- [x] **🧭 Dogfooding infrastructure consolidation — local only (2026-08-23)**
  - [x] Added Home Start Tracking through the canonical Work Session Server Action and global one-open-session invariant; no second timer or schema change
  - [x] Added lightweight inline Stop confirmation without changing server timestamps, SQL, or lifecycle
  - [x] Added authenticated Client Portal total-video visibility and canonical content-type filtering over the existing client-safe projection
  - [x] Added orientation-aware operator cover rendering and a validated external Preview / Watch affordance
  - [x] Fixed a browser-discovered Video workspace render loop in idle Work Session synchronization
  - [x] Verified Work Session Ledger, Video → filtered sessions, Video Memory collapse/narrative, client auth boundaries, covers, and Client Intelligence
  - [x] Deferred coffee Quick Log because daily aggregate `health_logs` cannot store a timestamped coffee event honestly; deferred Pricing Lab because the canonical calculator is not in this repository
  - [x] Passed 135 tests, scoped source ESLint, typecheck, Next build, OpenNext build, clean isolated migrations `0000`–`0015`, and zero FK violations
  - [x] Rendered Home, Video workspace, and client login at 390×844, 768×1024, and 1440×900 with zero overflow and clean post-fix console; one fictitious local QA session was closed and left zero active sessions
  - [x] Production/remote D1 remained untouched; **LOCAL ONLY — NOT DEPLOYED**

- [x] **🎬 Productivity / Video Operations P1 local implementation (2026-08-22)**
  - [x] Reorganized Productivity around exclusive Current Work, Attention, Planned Queue, and Recent/Completed groups with no schema change
  - [x] Elevated the globally active Work Session, closed tracked time, session count, project deadline, next operational action, and Client → Project links
  - [x] Replaced duplicate hidden mobile/desktop Video Editor instances with one responsive operational card per video
  - [x] Expanded the desktop Video workspace into a two-column content-manager composition while preserving the compact mobile bottom sheet
  - [x] Kept revisions and Finished Video reachable as secondary utilities without using them as the page's mental model
  - [x] Added deterministic grouping/action tests; 52 tests, lint, typecheck, Next build, and OpenNext build pass
  - [x] Verified 390×844, 768×1024, and 1440×900 with QA-only local fixtures, zero overflow, zero console errors, correct relationship links, and no lifecycle mutation; fixtures were removed
  - [x] Production D1/Worker remained untouched; no migration or deploy was performed

- [x] **⏱️ Work Session → Video P0 discovery and migration candidate (2026-08-22)**
  - [x] Confirmed production remains exactly through `0010`; no work-session, timer, or Activity Sensor table exists
  - [x] Traced the mobile Quick Log: it launches video/revision/finance/health actions but records no work interval
  - [x] Confirmed `video_logs.started_at` is lifecycle onset, `crm_events` is audit history, Health is daily aggregate, and Finance is transaction-level; none can truthfully store editing sessions
  - [x] Added local-only candidate `0011_brainy_ultimo.sql` for canonical `work_sessions` attached only to `video_logs.id`; client/project remain derived
  - [x] Applied `0000`–`0011` to an isolated D1 and verified FK/check constraints, per-video/project/client aggregation, zero-session behavior, zero FK violations, and no temporary tables
  - [x] Production migration, data, Worker, Vault, lifecycle, `/book`, and routing remain untouched pending explicit migration review

- [x] **🔐 The Vault — Taryn client pilot local implementation (2026-08-22)**
  - [x] Reused the existing hashed, expiring, revocable Gateway capability token for a read-only `/client/[token]` portal
  - [x] Added additive local migration `0010_old_morgan_stark.sql` for nullable `video_logs.delivery_url`; no table rebuild or production mutation
  - [x] Added a strict client-safe projection scoped only by the token-derived client identity; internal notes, IDs, CRM events, revenue, health, and productivity data are excluded
  - [x] Added manual HTTPS-only delivery URL editing in Video Editor and a separate Vault link copy action in the CRM
  - [x] Verified invalid, expired, revoked, and cross-client tokens fail closed; validated 390×844, 768×1024, and 1440×900 without overflow or console errors
  - [x] Applied migrations `0000`–`0010` to an isolated local D1 with zero foreign-key violations; tests, lint, typecheck, Next build, and OpenNext build pass
  - [x] Production migration `0010` and Worker version `f528d5fe-691b-48c5-93a4-75487de61676` were activated through a controlled 0% Version Override rollout
  - [x] Pre-migration backup: `mindbunker-d6ada5db-20260822T065321Z-pre-0010.sql`, SHA-256 `11638326553ae34abe4455ff69b3940a578707eb9968806c9d62aad20c970111`, Time Travel bookmark `00000040-00000000-000050cf-0cf89b265e30987e1ae0905816514a98`
  - [x] Post-activation D1 invariants remained `2 clients / 1 project / 3 videos / 0 gateway invitations`, all existing delivery URLs null, and zero FK violations

- [x] **📁 First-class Projects surface — local implementation (2026-08-22)**
  - [x] Added authenticated `/projects` overview using the existing `0000`–`0009` schema with no migration
  - [x] Grouped active/review, planned, and delivered/archived projects and derived video progress from lifecycle status
  - [x] Reused CRM as the project editor and Productivity as the video editor through stable deep links
  - [x] Added Projects to desktop/mobile navigation; validated 390, 768, and 1440 px and corrected mobile labels/tablet breakpoints found during QA
  - [x] Added project aggregation/unit coverage; 32 tests, lint, typecheck, Next build, and OpenNext build pass
  - [x] Added Work Session integration-readiness and Video analytics data-gap documentation without authorizing future schema
  - [x] Confirmed production D1 is already through `0009` and the lifecycle Worker version is active; this Projects build was not deployed

- [x] **🎬 Canonical video lifecycle — Gates 3–10 local (2026-08-21)**
  - [x] Added `PLANNED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `CHANGES_REQUESTED`, and `DONE`; legacy rows backfill to `DONE`, future rows default to `PLANNED`
  - [x] Kept `video_logs.id` stable through editing, review, completion, reopening, and re-completion
  - [x] Added editable title/client/project/notes, explicit validated transitions, and status badges to Productivity and project inventory
  - [x] Restricted completed-output and revision-drag analytics to `DONE`
  - [x] Linked compact video audit events through nullable `crm_events.video_id`; standalone/legacy videos are auditable through nullable `client_id`
  - [x] Added local migrations `0007`–`0009`, applied the full chain to an isolated D1, and confirmed no foreign-key violations
  - [x] Passed 27 tests, lint, typecheck, Next build, and OpenNext Cloudflare build
  - [x] Exercised the full lifecycle at 390×844 and 1440×900; fixed stale cross-viewport editor state found during QA
  - [x] Production remains at `0006`; no new migration or application code was deployed

- [x] **🗓️ Client Gateway — Milestone 2 local implementation (2026-08-19)**
  - [x] Added editable booking availability with timezone, call duration, buffer, minimum notice, booking horizon, and one simple window per weekday
  - [x] Added incremental D1 migration `0005_amused_roughhouse.sql` for `booking_settings`, `availability_windows`, and `bookings`
  - [x] Added a deliberately small `CalendarProvider` interface and deterministic local mock; no Google account, OAuth token, or external calendar was connected
  - [x] Added booking, rescheduling, and cancellation to the private Gateway with iPhone-first slot selection and attendee email autofill
  - [x] Synchronized booking state into the correct CRM opportunity, next action, invitation expiry, and append-only timeline using D1 batch writes
  - [x] Kept non-linear stages intact: booking advances only early opportunities, and cancellation remains explicit without fabricating an earlier stage
  - [x] Derived the public client identity only from the hashed Gateway token and kept attendee email, provider IDs, CRM data, and other clients out of the public DTO
  - [x] Added six booking tests; the combined Gateway/booking suite passes 12/12
  - [x] Demonstrated locally: CRM → Gateway → briefing → book → CRM → reschedule → cancel; then removed the exact fictitious fixture and restored default availability
  - [x] Verified 390×844 and 1440×900 UI, no horizontal overflow or browser console errors, local migration, lint, typecheck, tests, Next build, and OpenNext Cloudflare build
  - [x] Confirmed the private availability page still redirects to login, invalid Gateway tokens fail safely, the temporary QA route is absent, and production remains unchanged

- [x] **🚪 Client Gateway — Milestone 1 local implementation (2026-08-19)**
  - [x] Reused `clients` as the opportunity source of truth; added stage, service interest, qualification notes, next action/date, and last interaction
  - [x] Added incremental D1 migration `0004_wonderful_karen_page.sql`
  - [x] Added `gateway_invitations`, `intake_submissions`, and append-only `crm_events` tables with targeted indexes and cascading cleanup
  - [x] Added a public `/g/[token]` route that renders without the private CRM shell and returns a deliberately narrow public DTO
  - [x] Added 256-bit URL-safe invitation tokens; only a SHA-256 hash is stored, with 14-day expiry, replacement, and explicit revocation
  - [x] Added CRM controls to update an opportunity, generate/copy/revoke a Gateway, view a submitted briefing, and inspect the timeline
  - [x] Added a short iPhone-first briefing with three essential fields and optional context behind disclosure
  - [x] Made Gateway opened/submitted writes idempotent and added server-side validation for public and administrative actions
  - [x] Added six Node tests covering token shape/hash, invalid/expired/revoked access, non-linear stage handling, and briefing validation
  - [x] Demonstrated locally: authenticated CRM → fictitious lead → Gateway → briefing → same CRM record; then removed the fictitious data
  - [x] Verified 390×844 and 1440×900 UI, no browser console errors, local migration, lint, typecheck, tests, Next build, and OpenNext Cloudflare build
  - [x] Confirmed unauthenticated `/crm` redirects to `/mindbunker/login`, unknown/revoked Gateway tokens fail safely, and no production configuration or data changed

- [x] **🔐 Production login and private route (2026-08-19)**
  - [x] Attached the Worker only to `emmanueldarosa.com/mindbunker*`; the rest of the domain remains untouched
  - [x] Added a CRM-matched Portuguese login screen with iPhone password-manager and Face ID-friendly fields
  - [x] Added server-side authorization to every data access path, not only UI route gating
  - [x] Added a signed 30-day `HttpOnly`, `Secure`, `SameSite=Strict` session cookie scoped to `/mindbunker`
  - [x] Added D1-backed login throttling: five failures per 15-minute window
  - [x] Added HMAC-SHA256 password verification with a separate 256-bit pepper and digest stored as Cloudflare secrets; PBKDF2 remains as a fallback verifier
  - [x] Removed the temporary plaintext secret after the safer verifier was installed
  - [x] Verified the real production login opens the Dashboard and that unauthenticated requests receive a 307 redirect to `/mindbunker/login`
  - [x] Verified production D1 is responsive, all four personal-data tables remain empty, and `auth_attempts` is zero after successful login
  - [x] Final verified Worker version: `eac0831e-312f-4619-bbfa-4e0cfe6686ac`

- [x] **☁️ Cloudflare Workers + D1 migration (2026-08-19)**
  - [x] Removed the Kilo-hosted `DB_URL`/`DB_TOKEN` database adapter
  - [x] Added request-scoped Drizzle D1 access through the `DB` binding
  - [x] Added OpenNext and Wrangler configuration for Next.js 16 on Workers
  - [x] Added local and remote D1 migration scripts
  - [x] Generated strongly typed Cloudflare bindings
  - [x] Upgraded Next.js and ESLint configuration to 16.3.1
  - [x] Marked data-backed pages dynamic so they always read current D1 state
  - [x] Fixed the Next.js 16 async route-params bug on `/crm/[id]`
  - [x] Verified CRM create, refresh persistence, lead conversion, notes update, and refresh persistence against local D1
  - [x] Verified the OpenNext Workers preview with all routes returning HTTP 200
  - [x] Created the remote D1 database and applied all migrations
  - [x] Uploaded the production Worker with `workers_dev: false` and `preview_urls: false`
  - [x] Verified all four remote personal-data tables contain zero records
  - [x] Added the `/mindbunker` base path for a path-scoped private deployment
  - [x] Added fixed iPhone navigation, global Quick Log, safe-area spacing, 44px inputs, numeric keyboard hints, and installable web-app metadata
  - [x] Verified the Quick Log and income capture flow in a 390×844 browser viewport
  - [x] Uploaded mobile build version `6b33f2e8-5783-4e4d-97e3-18a7e4893f5c` with `No targets deployed`
  - [x] Connected the Worker to the correct Cloudflare account and attached the `/mindbunker*` route
  - [x] Confirmed `emmanueldarosa.com/mindbunker` is live while the rest of the site remains unchanged
  - [x] Prepared a CRM-matched Access login logo and Portuguese branding specification
  - [x] Replaced the blocked Cloudflare Access checkout path with a verified application-level single-user login

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] **Full RMEDIA MindBunker MVP**
  - [x] Database setup with Drizzle + SQLite (5 tables → 4 after investments removal)
  - [x] Modular folder structure (/modules, /components, /utils)
  - [x] All data models defined (Finance, Health, Productivity, CRM)
  - [x] Core layout with sidebar navigation
  - [x] Dashboard page with all module stat cards
  - [x] Quick Action buttons (Finished Video, Add Income, Add Expense, Log Today)
  - [x] Productivity module (VideoLog + Finished Video button)
  - [x] Finance module (Income/Expense tracking with table)
  - [x] Health module (DailyLog with 7-day averages)
  - [x] CRM module (Clients & Leads with convert flow)
  - [x] Investments module removed (per user request)
- [x] **💎 Performance Stats gamified section**
  - [x] `src/utils/statistics.ts` — isolated derived metrics calculation
  - [x] `src/components/ui/PerformanceStats.tsx` — gamified UI component
  - [x] Dashboard updated to render Performance Stats below Health section
- [x] **💎 War Room — Strategic Performance Intelligence**
  - [x] `src/modules/analytics/service.ts` — full analytics service layer (5 metric domains)
  - [x] `src/app/war-room/page.tsx` — War Room page with 5 strategic layers
  - [x] War Room placed at TOP of sidebar navigation with cyan styling
  - [x] Layer I: Income Intelligence (R$20k trajectory, flat-rate yield, client ranking)
  - [x] Layer II: Efficiency & Friction (Revision Drag Index, client drain ranking)
  - [x] Layer III: Biological Correlation (sleep/output, caffeine/revenue, crash detector)
  - [x] Layer IV: Momentum & Trajectory (revenue streak, growth trends)
  - [x] Layer V: Leverage Score (XP system, 10 levels from Rookie → Elite)
  - [x] Crash Detector banner (sticky warning when burnout risk detected)
- [x] **🚴 Health Module — Cycling & Walking Tracking**
  - [x] Schema updated: `cycling_km`, `cycling_minutes`, `walking_minutes` fields added
  - [x] Migration `0002_add_cycling_walking_to_health.sql` generated
  - [x] Health actions updated to support new fields
  - [x] Health page updated with cycling/walking columns in table
  - [x] `LogBikeRideButton` and `LogWalkButton` added to QuickActions
  - [x] Dashboard quick actions expanded to 6 buttons (2-col → 6-col grid)
  - [x] Dashboard health section shows cycling/walking stats
  - [x] Walking logging now cumulative (adds to existing instead of overwriting)
- [x] **🌍 Brazil Timezone Support**
  - [x] `nowBrazil()` helper function added to `src/utils/date.ts`
  - [x] All date functions updated to use GMT-3 timezone
  - [x] `todayISO()`, `startOfMonthISO()`, `daysAgoISO()`, `currentMonthName()` all use Brazil time
- [x] **📊 War Room Enhancements**
  - [x] Physical activity timeline (last 7 days) with progress bars
  - [x] Motivational quote system based on mood/status (recovery, momentum, focused, motivated, building)
  - [x] Quote selection based on leverage score, crash detection, revenue streak, and level
- [x] **🎯 Dashboard Reorganization**
  - [x] Insights & Correlations section moved to top (prioritized over raw data)
  - [x] Detailed statistics moved below insights
  - [x] `AddRevisionButton` added to quick actions (7 total buttons)
- [x] **📝 Productivity Enhancements**
  - [x] `AddRevisionButton` added to Productivity page
  - [x] Revision button logs a finished video with `revisionsCount: 1`
- [x] **👥 CRM Client Detail Pages**
  - [x] Dynamic route `/crm/[id]/page.tsx` for individual client details
  - [x] `ClientTabs` component with 4 tabs: Overview, Projects, Notes, Activity
  - [x] Notes tab allows editing and saving client notes
  - [x] Client names in CRM table are clickable links to detail pages
  - [x] `getClientById()` action added to CRM module

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/war-room/page.tsx` | War Room intelligence dashboard | ✅ Ready |
| `src/app/page.tsx` | Dashboard overview | ✅ Ready |
| `src/app/layout.tsx` | Root layout with sidebar | ✅ Ready |
| `src/app/productivity/` | Current Work operations floor and responsive Video workspace | ✅ P1 local review candidate |
| `src/app/projects/` | Cross-client project commitments, derived video progress, and dedicated Project workspace | ✅ Live overview + P1.1 local workspace |
| `src/app/finance/` | Income/expense tracker | ✅ Ready |
| `src/app/health/` | Daily habit tracker (+ cycling/walking) | ✅ Ready |
| `src/app/crm/` | Clients & leads | ✅ Ready |
| `src/app/crm/[id]/` | Client detail, opportunity, Gateway/booking status, briefing, and timeline | ✅ Milestone 2 local |
| `src/app/crm/availability/` | Authenticated weekly call availability settings | ✅ Milestone 2 local |
| `src/app/g/[token]/` | Narrow public Client Gateway, briefing, and optional call management | ✅ Milestone 2 local |
| `src/app/client/[token]/` | Read-only, token-scoped client delivery portal (“The Vault”) | ✅ Live, awaiting first real pilot setup |
| `src/modules/gateway/` | Gateway config, validation/token core, DAL, actions, and tests | ✅ Milestone 1 local |
| `src/modules/client-portal/` | Strict client-safe projection and token-scoped D1 reads | ✅ Live, awaiting first real pilot setup |
| `src/modules/work-sessions/` | Video-attributed Start/Stop, global active-session recovery, and closed-time aggregation | ✅ P0 live |
| `src/modules/execution/` | Canonical current-execution and explainable next-work projections derived from Work Sessions and the Video queue | ✅ Wave 1 local |
| `src/modules/sensor/` | Scoped native-device auth, Sensor Inbox review, idempotent observation ingestion, explicit Work Session approval, and overlap projections | ✅ P1.1 local candidate |
| `src/app/productivity/sensor/` | Sensor Inbox, session detail, passive evidence, diagnostics, and device credential management | ✅ P1.1 local candidate |
| `src/app/all-history/` | Authenticated reconstructed-history dashboard plus fingerprinted, idempotent operator import control | ✅ Production batch 1 active |
| `src/modules/booking/` | Availability/slot core, provider boundary, D1 DAL, actions, and tests | ✅ Milestone 2 local |
| `src/db/schema.ts` | All table definitions including Gateway and booking | ✅ Ready |
| `src/db/index.ts` | Request-scoped Drizzle client over Cloudflare D1 | ✅ Ready |
| `wrangler.jsonc` | Worker, assets, D1 binding, and `/mindbunker*` production route | ✅ Live |
| `src/lib/auth-core.ts` | Session signing plus HMAC/PBKDF2 password verification | ✅ Production verified |
| `src/lib/auth-server.ts` | Cloudflare secret access, D1 throttling, cookies, and authorization | ✅ Production verified |
| `src/app/login/` | CRM-matched single-user login UI and Server Actions | ✅ Production verified |
| `src/components/ui/MobileQuickCapture.tsx` | Global iPhone Quick Log sheet | ✅ Verified at 390×844 |
| `src/app/manifest.ts` | Add-to-Home-Screen metadata | ✅ Ready |
| `open-next.config.ts` | OpenNext Cloudflare adapter configuration | ✅ Ready |
| `src/modules/analytics/service.ts` | War Room analytics service | ✅ Ready |
| `src/modules/*/actions.ts` | Server actions per module | ✅ Ready |
| `src/components/layout/Sidebar.tsx` | Navigation sidebar (War Room at top) | ✅ Ready |
| `src/components/ui/QuickActions.tsx` | Quick action buttons (7 total) | ✅ Ready |
| `src/utils/statistics.ts` | Legacy performance stats | ✅ Ready |

## Database Tables

| Table | Module | Key Fields |
|-------|--------|------------|
| `transactions` | Finance | type, amount, category, date |
| `health_logs` | Health | date (unique), sleepHours, caffeineMg, screenTimeHours, cyclingKm, cyclingMinutes, walkingMinutes |
| `clients` | CRM | name, status (lead/active/inactive), totalRevenue |
| `gateway_invitations` | Client Gateway | clientId, tokenHash, expiry, revocation, first open |
| `intake_submissions` | Client Gateway | clientId, invitationId, short briefing fields |
| `crm_events` | CRM / Gateway / Video audit | nullable clientId, nullable videoId, event type, actor, description, timestamp |
| `booking_settings` | Booking | enabled, timezone, duration, buffer, minimum notice, horizon |
| `availability_windows` | Booking | weekday, enabled, start and end minute |
| `bookings` | Booking | client/invitation, provider event, status, times, attendee, cancellable slot key |
| `video_logs` | Productivity | stable ID, title, client/project, status, startedAt, revisionsCount, delivered compatibility flag, optional HTTPS delivery URL (local `0010`) |
| `work_sessions` | Productivity economics | live `0011`: videoId, startedAt, nullable endedAt, activityType, optional note; client/project derived |
| `sensor_devices` | Native Sensor auth | public device UUID, token hash, fixed scopes, last seen, revocation; local `0017` only |
| `device_activity_observations` | Passive Mac evidence | stable device/local UUID, app/bundle/title, raw interval, idle, optional aggregate input counts; local `0017` only |

## Architecture

- **Modular**: Each feature in `/src/modules/{name}/actions.ts` (server actions)
- **Analytics Service**: `/src/modules/analytics/service.ts` — isolated War Room logic
- **No cross-module coupling**: Dashboard aggregates via independent module calls
- **Server Components by default**: All pages are server components
- **Client Components**: Only for interactive UI (buttons, modals, forms)
- **Cloudflare runtime**: OpenNext deploys Next.js 16 to Workers
- **Persistence**: Drizzle ORM over a request-scoped Cloudflare D1 binding
- **Authentication**: Single-user Server Action login; HMAC-SHA256 verifier with separate Cloudflare-secret pepper and PBKDF2 fallback
- **Session**: Signed 30-day cookie (`HttpOnly`, `Secure`, `SameSite=Strict`) scoped to `/mindbunker`
- **Authorization**: Request-time checks protect routes and the data access layer; D1 records and rate limits are inaccessible without a valid session
- **Public Gateway boundary**: `/g/[token]` bypasses only the private chrome, looks up a hash of a high-entropy capability token, and returns no email, phone, internal notes, revenue, or unrelated client data
- **Gateway state**: Normal row-based state plus a small append-only operational timeline; no event sourcing or workflow engine
- **Booking provider boundary**: The deterministic `CalendarProvider` mock is local/test-only. Production fails closed and directs visitors to the truthful manual request intake until a real external calendar provider is explicitly configured; Google Calendar/Meet remains deferred.
- **Booking consistency**: Confirmed D1 bookings are the local busy-time source, unique slot keys prevent double booking, and booking/CRM/timeline changes are grouped in D1 batches
- **Work-session authority**: A work session stores only `videoId` plus raw timestamps/activity; project/client context is derived through the canonical video. Start keeps its atomic conditional insert, while the partial unique expression index `work_sessions_one_open_idx` structurally permits only one globally open session
- **Canonical execution contract**: `startWork` is the sole browser-side start operation; `getCurrentExecution()` derives current work from the one open Work Session; `getExecutionRecommendation()` applies explicit, deterministic Video priority/status/deadline/queue rules and returns factual signals. Dashboard, Productivity, and War Room project this same contract. End Session closes time only; Video finish/delivery/approval remain separate mutations.
- **Video operational memory**: Durable manual notes reuse append-only `crm_events` rows (`video.note_added`) linked only to the canonical video; project/client context is derived, notes stay out of CRM client activity, and videos with operational memory are protected from app-level deletion
- **Sensor truth boundary**: Native `MAC_SENSOR` Work Sessions reuse the canonical `work_sessions` table and global-open invariant; passive device observations use a separate append-only table, sync by stable UUID through a durable local outbox, and correlate only as a timestamp-derived projection
- **Sensor privacy**: device secrets live in macOS Keychain and only their SHA-256 hashes reach D1; title upload and aggregate key/mouse-count upload are independently opt-in, while raw keys/text/coordinates are neither represented nor accepted

## War Room Metric Domains

| Domain | Key Metrics |
|--------|-------------|
| Income Intelligence | R$20k trajectory, flat-rate yield, client revenue ranking |
| Efficiency & Friction | Revision Drag Index (Elite/Normal/Friction), client drain ranking |
| Biological Correlation | Sleep/output correlation, caffeine/revenue ratio, crash detector, physical activity timeline |
| Momentum & Trajectory | Revenue streak, MoM growth trends |
| Leverage Score | XP system, 10 levels (Rookie → Elite), score breakdown |

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-02-24 | Full RMEDIA MindBunker MVP built — 5 modules, dashboard, quick actions |
| 2026-02-24 | War Room intelligence layer + cycling/walking health tracking added |
| 2026-02-25 | Brazil timezone, activity timeline, motivational quotes, revision button, cumulative walking, client detail pages |
| 2026-08-19 | Recovered original design, migrated persistence to D1, verified local CRM CRUD and Workers preview |
| 2026-08-19 | Created production D1, uploaded Worker, disabled public and preview URLs, and verified the remote database is empty |
| 2026-08-19 | Added `/mindbunker` base path and iPhone-first capture/navigation; uploaded a new no-target Worker version |
| 2026-08-19 | Attached the production route, added the branded private login, implemented D1 throttling and signed sessions, and verified the real production login end to end |
| 2026-08-19 | Completed Client Gateway Milestone 1 locally: opportunity state, secure invitations, briefing sync, timeline, mobile/desktop QA, and Cloudflare build; production unchanged |
| 2026-08-19 | Completed Client Gateway Milestone 2 locally: editable availability, mock-backed booking/rescheduling/cancellation, CRM/timeline synchronization, responsive QA, and Cloudflare build; production unchanged |
| 2026-08-21 | Completed canonical video lifecycle Gates 3–10 locally: truthful DONE-only analytics, stable-ID editing/transitions/reopen, video audit linkage, responsive QA, and Cloudflare build; production remains at 0006 pending approval |
| 2026-08-21 | Activated canonical lifecycle in production after applying and verifying migrations 0007–0009 |
| 2026-08-22 | Implemented first-class Projects locally with schema-free aggregation, CRM/Productivity drill-down, responsive QA, and telemetry-readiness documentation; deployment pending review |
| 2026-08-22 | Promoted Projects to production, then implemented The Vault Taryn pilot locally with capability-link access, strict client projection, and optional HTTPS delivery URL; production remains at 0009 pending review |
| 2026-08-22 | Applied production migration 0010, staged and smoke-tested The Vault through Version Override, activated Worker `f528d5fe-691b-48c5-93a4-75487de61676`, and stopped before Taryn's real URL/token setup |
| 2026-08-22 | Implemented Work Session P0 locally: atomic Start/Stop plus a structural one-open partial unique index, refresh recovery, Video Editor timer and closed-time summary, concurrency regression coverage, responsive QA, and clean isolated migrations through 0011; production remains at 0010 |
| 2026-08-22 | Activated Work Session P0 in production, then completed Productivity / Video Operations P1 locally with Current Work grouping, active-session prominence, one responsive card per video, and a wider desktop Video workspace; production remained untouched during P1 |
| 2026-08-22 | Completed Productivity / Project Navigation P1.1 locally without schema changes: Client remains mandatory for Project, `/projects/[id]` owns Project operations, Client/Project/Video links follow the canonical hierarchy, Plan Video requires an existing Project with a safe create-and-return path, and Finished Video transitions an existing identity to DONE instead of inserting a duplicate; tests/builds/responsive QA green, production untouched |
| 2026-08-22 | Completed Video Operational Memory P1.2 locally without schema changes: the Video Workspace can append durable chronological notes through `crm_events.video_id`, deterministic newest-first history preserves lifecycle/work-session boundaries, operational memory blocks app-level video deletion, temporary QA notes were removed, and production remained untouched |
| 2026-08-24 | Implemented MindBunker Sensor P1 locally: revocable scoped device credentials, cached canonical Client → Project → Video hydration, Keychain storage, durable offline outbox, idempotent MAC_SENSOR Work Sessions, separate passive observation batches, derived correlation, optional privacy-safe aggregate key/mouse counters, and Sensor Activity diagnostics; production remains exactly 0000–0015 |
| 2026-08-25 | Activated reconciled Worker `82aefdcc-eb7c-4dc5-9ccc-19540dbd3e8c`, imported canonical All History fingerprint `932047bd8bdbf0f3b14672ce7fa9bf88a18e83e4de76e25fa30df3f74d987390` as active batch 1, proved rerun idempotency, preserved operational counts/FKs and known videos, and verified live operator/client-auth surfaces; production schema remains 0000–0028 |
| 2026-08-29 | Trust-restoration patch: production booking mock fails closed, War Room/Performance keep currencies separate, operator calendar uses America/Sao_Paulo, Active Clients exclude archived/internal records, Consistency Streak derives only from closed Work Sessions, normal Finance rows are editable in place, and Owner Pay corrections atomically preserve both paired ledger identities. No schema or production mutation. |
| 2026-09-13 | Emergency video-workspace hotfix: a requested DONE/delivered video now opens its completed archive disclosure instead of remaining hidden inside a closed `<details>`; requested videos outside the bounded recent list remain available, while queue eligibility stays independent from canonical workspace access. |
| 2026-10-01 | September final truth close: 33h40 Taryn external time; USD 729.17 posted gross, 72.92 service fees, 11.96 withdrawal fees and 644.29 Wise cash; BRL operating 923.48, personal excluded 234.90, unknown 0; Taryn DFY mapped as a distinct operational work mode under one canonical Taryn relationship; Work Session 83 preserved/excluded; D1 migration 0053/FK/duplicates green; 1489 tests, typecheck and build green; no migration or deploy. |
| 2026-10-01 | Operating Intelligence baseline documented without product or production changes: 112.7725h admissible September time; explicit Sensor active/idle/no-telemetry matrix; Taryn weekly multi-calendar review; Dave USD 400 open balance and USD 348.66 supported Sep 6 sprint with unresolved deltas; BI/readiness, workflow and rest-inference boundaries recorded in five RMEDIA reports. Fresh live D1 read was blocked by expired Cloudflare authentication, so current database counts use the verified post-close local reconstruction. |
| 2026-10-01 | Dave commercial close updated from operator evidence: prior USD 372.66 and USD 400 requests cancelled; replacement Wise/MindBunker request USD 468.33 OPEN at `https://wise.com/pay/r/eZKtOZK7w-f3xJo`; USD 68.33 increment is the Sep 25/30 three-video batch (2h44 client-facing at USD 25/h). Latest cuts were sent for review, but final approval and payment settlement remain open. |
| 2026-10-02 | October Operational Reality Integration released read-model-first: generic CRM Reality, Finance October current + September fixture, Taryn DIRECT/DFY weekly view, Dave guarded hourly position and explicit coverage matrix. Authenticated live QA fixed cross-client reconciliation leakage and canonical-alias parsing before final Operator `f06d02e` / Worker `88a657cf-221f-4966-813b-b0a8bc323489`; 1500 tests; D1 9 clients/293 events, migration 0053, FK clean, no D1 writes. |
| 2026-10-03 | `/startvideo` V2 released as a separate, unpromoted public experiment: problem-first flow, five core questions, conditional specialist context, server-recomputed lead intent, the same canonical Lead plus immutable `guided_intake.submitted` custody, and readable CRM/System Inbound projection. `/start` source and Card UX remained unchanged. Operator `b034a26` / Worker `d42213f3-5370-41da-8542-bf508206d5b3`; Public `5a0f7c0` / Worker `3d17ba6a-3208-4d46-a102-a4b7e6ac8b79`; 1516 Operator + 32 Public tests green; no migration; production E2E Lead 14/events 305–306 replayed idempotently, proved 17 downstream families zero, and was guard-cleaned back to 9 clients/293 events with head 0053/FK clean. Browser permission blocked live visual QA, so viewport rendering and authenticated CRM visual readability remain explicitly unverified. |
| 2026-10-03 | Saturday Build Wave 1 established the local canonical execution contract on top of Wave 0: one `startWork` action with relationship/alias validation, global-session safety and minimal start/end events; current execution derived from the open Work Session; deterministic, explainable recommendation shared by Dashboard, Productivity and War Room; minimal Client/Project/Video/Session inspection href contract; no migration, production write or deploy. Local authenticated visual QA showed the same Waterfall Cut 15 recommendation and rationale on all three surfaces. |
| 2026-10-07 | September sleep reconciliation preserved all 14 existing `health_logs` values and added the source-supported 24 Sep approximate 4h interval from the operator's explicit 03:00–07:00 event account. At the operator's subsequent explicit direction, the remaining 15 dates were populated with the 15-day source mean of 6.83h and documented as `DERIVED / IMPUTED`, not observed sleep. September now has 30 numeric dates / 204.95h / 6.83h mean. Both remote D1 writes were guarded and preceded by exports (`c02b119...`, then `b1862d97...`); FK checks stayed clean. RMEDIA permission diagnosis found the active local candidate and installed app share bundle ID `com.rmedia.mindbunker-sensor` and the same stable signing requirement; Accessibility and Input Monitoring remain denied in macOS TCC pending an operator-confirmed System Settings action. |
| 2026-10-08 | Delivery Recipe Wave 2 connected the canonical `0057` Recipe execution to the standalone RMEDIA App without a second checklist: device-authenticated current-Recipe read, guarded current-step transition, `RMEDIA_APP` event provenance, and a compact native checklist under the canonical active Video. Recipe writes remain online-only and never write or infer Work Session time. Local candidate only; production remains `0056`. |
