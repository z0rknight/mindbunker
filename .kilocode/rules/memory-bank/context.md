# Active Context: RMEDIA MindBunker

## Current State

**Project Status**: ✅ MVP Complete + War Room Intelligence Layer

RMEDIA MindBunker is a personal life metrics and professional performance tracker for a video editor. Built with modular architecture, SQLite database via Drizzle ORM, and a dark cyberpunk UI.

## Recently Completed

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
| `src/app/crm/[id]/` | Client detail pages with tabs | ✅ Ready |
| `src/db/schema.ts` | All table definitions (health updated) | ✅ Ready |
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
| `video_logs` | Productivity | date, clientId, revisionsCount, delivered |

## Architecture

- **Modular**: Each feature in `/src/modules/{name}/actions.ts` (server actions)
- **Analytics Service**: `/src/modules/analytics/service.ts` — isolated War Room logic
- **No cross-module coupling**: Dashboard aggregates via independent module calls
- **Server Components by default**: All pages are server components
- **Client Components**: Only for interactive UI (buttons, modals, forms)

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
