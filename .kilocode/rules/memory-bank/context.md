# Active Context: RMEDIA MindBunker

## Current State

**Project Status**: ✅ Live mobile-ready Cloudflare/D1 MVP at `emmanueldarosa.com/mindbunker`, protected by a verified single-user login

RMEDIA MindBunker is a personal life metrics and professional performance tracker for a video editor. Built with modular architecture, SQLite database via Drizzle ORM, and a dark cyberpunk UI.

The original February 2026 visual design is the canonical interface. The separate August `Site-Mindbunker` operational-telemetry prototype is not part of this application.

## Recently Completed

- [x] **Night closure — Public motion, YouTube Red, System Inbound custody (2026-09-20–21)**
  - [x] Public + MindBunker primary brand/interactive accent converged to YouTube Red `#FF0000`; semantic success/warning/unknown/derived treatments preserved; Client palette explicitly bounded and unchanged
  - [x] Home and recovered `/book` source use finite one-shot entrance motion with reduced-motion immediate state; `/book` has a deterministic `href="/"` return action
  - [x] `/start` decision model and write contract unchanged; accent tokens only changed to red for Home→intake continuity
  - [x] Added authenticated `CRM → Inbound` read model over canonical Leads + immutable `guided_intake.submitted` events, grouped per Lead, with manual Leads excluded
  - [x] Durable unread count = unread system-intake events; explicit open appends one idempotent `system_intake.seen` event referencing the immutable source event; no GET write, table or migration

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
