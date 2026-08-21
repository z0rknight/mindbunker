# Active Context: RMEDIA MindBunker

## Current State

**Project Status**: ✅ Live mobile-ready Cloudflare/D1 MVP at `emmanueldarosa.com/mindbunker`, protected by a verified single-user login

RMEDIA MindBunker is a personal life metrics and professional performance tracker for a video editor. Built with modular architecture, SQLite database via Drizzle ORM, and a dark cyberpunk UI.

The original February 2026 visual design is the canonical interface. The separate August `Site-Mindbunker` operational-telemetry prototype is not part of this application.

## Recently Completed

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
| `src/app/productivity/` | Video editing tracker | ✅ Ready |
| `src/app/finance/` | Income/expense tracker | ✅ Ready |
| `src/app/health/` | Daily habit tracker (+ cycling/walking) | ✅ Ready |
| `src/app/crm/` | Clients & leads | ✅ Ready |
| `src/app/crm/[id]/` | Client detail, opportunity, Gateway/booking status, briefing, and timeline | ✅ Milestone 2 local |
| `src/app/crm/availability/` | Authenticated weekly call availability settings | ✅ Milestone 2 local |
| `src/app/g/[token]/` | Narrow public Client Gateway, briefing, and optional call management | ✅ Milestone 2 local |
| `src/modules/gateway/` | Gateway config, validation/token core, DAL, actions, and tests | ✅ Milestone 1 local |
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
| `crm_events` | CRM / Gateway | clientId, event type, actor, description, timestamp |
| `booking_settings` | Booking | enabled, timezone, duration, buffer, minimum notice, horizon |
| `availability_windows` | Booking | weekday, enabled, start and end minute |
| `bookings` | Booking | client/invitation, provider event, status, times, attendee, cancellable slot key |
| `video_logs` | Productivity | date, clientId, revisionsCount, delivered |

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
- **Booking provider boundary**: A four-operation `CalendarProvider` currently uses a deterministic, side-effect-free mock; Google Calendar/Meet remains a future explicitly authorized integration
- **Booking consistency**: Confirmed D1 bookings are the local busy-time source, unique slot keys prevent double booking, and booking/CRM/timeline changes are grouped in D1 batches

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
