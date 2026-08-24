# MindBunker — Monday Local Intelligence Lab

Heavy Local Prototype Round · Sprint 1.2 · 2026-08-24
Mode: LOCAL IMPLEMENTATION · Production: not touched

## Verdict

**MONDAY LOCAL INTELLIGENCE LAB READY FOR HUMAN REVIEW**, with two explicit
gaps: `npm run build` could not be completed through the Cowork device
bridge (same FUSE/Turbopack limitation documented in the Post-Release
Round), and responsive QA at the three named breakpoints was not visually
verified — no dev server could be kept alive through the bridge to look at.
Everything else below (schema, migrations, unit tests, typecheck, lint,
git hygiene) passed cleanly. See **Local Runtime** and **Human QA Script**
for what Emmanuel needs to do himself before trusting this on-screen.

## Existing Baseline

Confirmed unchanged since the All History Local Import round: `git status`
showed the same 4 modified files from the Post-Release round
(`HomeTrackingPanel.tsx`, `crm/page.tsx`, `page.tsx`,
`ProductivityQuickActions.tsx`), HEAD still `d9a5dfd`, local D1 FK/integrity
clean. The Work Session Ledger already existed at `/productivity/sessions`
with no nav entry anywhere — confirmed by inspecting the route before
touching Sidebar.tsx.

## A. Pricing Lab — À La Carte (hourly estimator) — IMPLEMENTED / EXPERIMENTAL

Pricing Lab is now two tabs, `[À la carte] [Monthly Package]`. À la carte
was rebuilt from scratch around an **experimental $50/effective-production-
hour internal target** — explicitly not a client-facing hourly rate. Inputs:
content type (short-form/long-form/mini-doc/testimonial/custom, each with a
baseline hour estimate), a complexity multiplier (simple ×0.8 → very complex
×1.6, labeled "experimental adjustment"), an optional rush toggle (+25%),
extra revision rounds beyond the 2 included, and a thumbnail count. Output
is a single suggested flat price with a full line-by-line breakdown (base
hours → complexity-adjusted hours → revision hours → total hours → labor →
rush → thumbnails → total). No persistence — pure client state, resets on
reload. New config: `A_LA_CARTE_HOURLY_RATE_CENTS`,
`A_LA_CARTE_CONTENT_TYPES`, `A_LA_CARTE_COMPLEXITY_LEVELS`,
`A_LA_CARTE_RUSH_SURCHARGE_RATE`, `A_LA_CARTE_REVISION_ROUND_HOURS`,
`A_LA_CARTE_INCLUDED_REVISION_ROUNDS` in `pricing/config.ts`; math lives in
`computeALaCarteHourlyEstimate()` in `pricing/core.ts` (pure, deterministic,
sanitizes bad input to 0, 7 unit tests).

The old per-unit "À la carte" quantity-stepper section was retired — the
new hourly estimator supersedes it as the tab's purpose this round. If
Emmanuel wants the old per-unit list-price calculator back as a third mode,
that's a follow-up, not a regression: `computeALaCarteLineCents()` in
`pricing/core.ts` is untouched and still fully tested.

## B. Monthly Package — VERIFIED unchanged

`computePackagePricing`, `buildPackageSummaryText`, `PRICING_PRODUCTS`,
`PACKAGE_DISCOUNT_RATE` — byte-for-byte untouched. Same $400/$75/$15 line
items, same 20% discount, same Copy Package Summary button. Only its JSX
moved into the "Monthly Package" tab.

## C. Sessions Nav — IMPLEMENTED

`/productivity/sessions` (Work Session Ledger, already fully built) now has
a Sidebar entry — desktop sidebar only (`desktopOnly: true`), same pattern
as Pricing Lab and All History, so the mobile bottom tab bar keeps its
fixed 7 destinations rather than squeezing in an 8th.

## D. All History — Visuals — IMPLEMENTED

Five lightweight SVG/CSS visuals render above the existing table
(`AllHistoryVisuals.tsx`, plain server component, no chart library, no new
DB queries — everything is derived from the same `getAllHistorySummary()`
rows the table already uses):

- **Annual revenue** and **annual Upwork billed hours** — bar charts; a
  year with `null` renders as a dashed "?" placeholder, never a
  zero-height bar.
- **Tracked hours** — bars only for years with actual Clockify coverage;
  years with no coverage show the same "?" placeholder with an explicit
  caption explaining why.
- **YoY revenue change** — a chip per year; `—` whenever either side of
  the comparison is unknown (never treated as 0%).
- **Cumulative revenue** — an SVG line, honestly gapped: `computeCumulative
  Revenue()` (new pure function, `historical/core.ts`) stops the running
  total at the first year with unknown revenue and stays `null` after that,
  rather than silently treating the gap as $0 and continuing.
- **Source coverage per year** — a compact proportion bar per source
  (Upwork/Clockify/AFK) per year, from the existing `coverage` array.

7 new unit tests cover `computeYoYRevenueChange` and
`computeCumulativeRevenue`, including the div-by-zero and "unknown in the
middle" edge cases. No new hist_* reads, no writes anywhere in this file.

## E. All History — Historical Review Reminder — IMPLEMENTED

A persistent card (`HistoricalReviewReminder.tsx`) above the visuals,
red-bordered, in Portuguese, explicitly calling out: (1) Jun–Out 2025 — no
Clockify coverage at all for 5 months; (2) the four zero-billed-hours-with-
revenue months (Jan/2023, Fev/2023, Set/2024, Out/2024). Explicitly a
reminder/QA card, not a task-management system — no checkboxes, no state,
nothing that blocks any other surface.

## F. Health — Last Night's Sleep — IMPLEMENTED

Audited `health/actions.ts` and `health_logs` first, per the brief's
instruction not to bend semantics around the old form. Conclusion: the
existing date-keyed upsert (`upsertHealthLog`, one row per `date`) already
has correct semantics — an entry made today writes onto today's row, i.e.
"the night leading into today." No schema change, no logic change needed —
only a new, faster entry point (`LastNightSleepButton`, 9 preset buttons +
custom input) with copy that makes the date semantics explicit ("logs the
night leading into today ({date}) — not tonight's sleep") so there's no
ambiguity the old multi-field form didn't already resolve.

## G. Caffeine Events — IMPLEMENTED / LOCAL MIGRATION

Audited `health_logs.caffeineMg` first: it's a daily aggregate, overwrite-
on-upsert — it cannot honestly represent individual timestamped events. Per
the brief's explicit authorization, added the smallest correct model: a new
`caffeine_events` table (`id`, `occurred_at`, `servings` default 1, `source`
default `QUICK_LOG` with no CHECK — same open-vocabulary pattern as
`work_sessions.source`, `note`, `created_at`). Deliberately not a universal
life-event architecture — just a coffee event. `health_logs.caffeineMg`
is completely untouched.

- **☕ +1 Coffee** (Home, secondary to Start Work/Finished Video, and on
  Health) — one click, one row, instant visual feedback via optimistic
  local state that re-syncs to the server count via `router.refresh()`.
- **Coffees Today / Coffees This Week** — exposed as a StatCard on Health
  and inline on Home. 1 event = 1 serving, intentionally coarse, no mg
  inference.
- Data is prepared for a *future* "coffees while producing Video X"
  correlation purely via real timestamps (`caffeine_events.occurred_at`,
  `work_sessions.started_at/ended_at`) — no coffee→video foreign key was
  added, and no correlation feature was built. That stays explicitly
  deferred per the brief.

Pure logic (`caffeine/core.ts`: day-key bucketing in America/Sao_Paulo,
Monday-start week sums) has 7 unit tests.

## H. Activity Timeline — IMPLEMENTED

A GitHub-activity-calendar-style grid on Health (`ActivityTimeline.tsx`,
12 weeks / 84 days, padded back to the nearest Monday) answering "when did
I walk or bike" — teal for walk days, cyan for bike days, gradient for
both, plain zinc for neither. Tapping a day opens a compact drawer showing
that day's walk minutes, bike km, sleep hours, and coffee count — all real
recorded values, nothing fabricated (a day with no log shows `—`, never an
inferred duration). The grid-building logic (`health/core.ts`,
`buildActivityTimelineDays` / `groupTimelineDaysIntoWeekColumns`) is pure
and has 4 unit tests, including the "final week can be a partial column"
edge case.

## I. Screen Time — Manual Import — IMPLEMENTED / LOCAL MIGRATION

`/health/screen-time/import`: a textarea accepting a structured JSON paste
(periodStart/periodEnd/device/totalHours/categories/apps — an example
payload is one click away via "Fill with example payload"). No OCR, no
automatic collector anywhere in this path — every surface is labeled
**MANUAL APPLE SCREEN TIME SNAPSHOT**.

Schema audit found no honest existing place for this, so per the brief's
authorization: a new `screen_time_snapshots` table (`period_start`,
`period_end`, `device`, `total_minutes`, `source` default
`MANUAL_APPLE_SCREEN_TIME_SNAPSHOT`, `raw_payload` — the original validated
JSON preserved verbatim, `created_at`), with CHECK constraints
`period_end >= period_start` and `total_minutes >= 0`.

Validation (`screen-time/core.ts`, 11 unit tests): rejects a non-object
payload, missing/malformed dates, `periodEnd < periodStart`, negative
`totalHours`, negative app/category hours. Per §N, app hours summing higher
than the reported total is a **warning**, never silently substituted as the
canonical total. Duplicate-period imports are idempotent (an exact repeat —
same period + device + total — is skipped with a message) or warned (same
period + device, different total is stored anyway with a warning, never
silently overwritten or discarded).

`/health/screen-time`: latest snapshot's total, top 5 apps, top 5
categories, and a list of all past snapshots. No morality scoring anywhere.

## J. Dashboard Integration — IMPLEMENTED

Start Work / Finished Video remain the two primary actions, untouched. A
small "today" block was added below them: the ☕ +1 Coffee quick action
(secondary, smaller than the primary actions) and, only when data exists,
"😴 Last night: Xh". Nothing else was added to Home — no new stat grids, no
Screen Time or activity-timeline surface on Home.

## Internal-Only Boundary — REAFFIRMED

Caffeine events, sleep, Screen Time, the activity timeline, Work Sessions,
Pricing Lab, and all historical evidence live only under authenticated
internal routes (`/health`, `/pricing-lab`, `/all-history`,
`/productivity/sessions`). Nothing in this round touches `/client` or any
client-portal code path. No client-facing derived statement (e.g. "this
video required N coffees") was built.

## Historical / Native Boundary — REAFFIRMED

`AllHistoryVisuals.tsx` reads only the existing `getAllHistorySummary()`
projection — no new `hist_*` query, no write anywhere in
`src/modules/historical/`. `historical/core.ts`'s own test suite still
asserts the module never references `work_sessions` (test #187, still
passing).

## Schema / Local Migrations — IMPLEMENTED

One migration this round: `0016_graceful_the_enforcers.sql`, purely
additive (`git diff --stat src/db/schema.ts`: 77 insertions, 0 deletions) —
`caffeine_events` and `screen_time_snapshots` only. Generated via
`drizzle-kit generate`, applied via `wrangler d1 migrations apply
mindbunker --local`. Per the brief's explicit policy: **no Work Session
schema change this round** — confirmed via diff, `work_sessions` is
byte-identical.

Post-migration checks against the real local D1 file (`node:sqlite`
`DatabaseSync`, same technique as Round 2's import):

```
PRAGMA foreign_key_check  -> []
PRAGMA integrity_check    -> ok
d1_migrations             -> 0000 .. 0016, all applied, in order
```

## Tests — IMPLEMENTED

36 new tests added, targeted per feature area, existing suites untouched:

| Area | File | Tests |
|---|---|---|
| Caffeine day-bucketing/summary | `caffeine/core.test.mjs` | 7 |
| Health activity-timeline grid | `health/core.test.mjs` | 5 |
| Screen Time validation/dedup | `screen-time/core.test.mjs` | 11 |
| Pricing à la carte hourly math | `pricing/a-la-carte-hourly.test.mjs` | 7 |
| All History YoY/cumulative | `historical/all-history-visuals.test.mjs` | 7 |

The historical importer's own tests were not touched (untouched files,
per the brief). Work Session nav needed no new domain tests (none added).

```
npm test        -> 187 pass, 0 fail (151 prior baseline + 36 new)
npm run typecheck -> clean, no errors
npx eslint <changed files> -> clean (one issue found and fixed: a
                                react-hooks/set-state-in-effect violation
                                in CoffeeQuickLogButton, resolved by
                                switching to React's documented
                                "adjust state during render when a prop
                                changes" pattern instead of a useEffect)
git diff --check -> clean, no whitespace errors
```

## Builds — PARTIAL / BLOCKED BY BRIDGE

`npm run build` (Turbopack) could not complete through the Cowork device
bridge: it fails partway through with `EPERM: operation not permitted,
unlink '.../.next/...'`, reproduced twice after clearing `.next`. This is
the same FUSE-mount delete-restriction limitation documented in the
Post-Release round's local dev-server smoke test — Turbopack's incremental
build process needs to unlink/replace its own cache files mid-build, and
the bridge's mount doesn't permit that. It is not a code regression:
`tsc --noEmit` and the full test suite both pass cleanly on the exact same
changes. OpenNext/Cloudflare build (`opennextjs-cloudflare build`) was not
attempted, since it depends on a successful `next build` first.
**Recommendation: run `npm run build` directly on the Mac, outside the
bridge, before treating this as production-buildable.**

## Local Runtime

No stray Node/Next processes were found; nothing is currently listening on
any port (expected — the bridge cannot keep a background process alive
across tool calls, so a dev server started this way is torn down the
instant the call returns; see prior rounds' write-ups for the mechanism).
Stale `.next` build artifacts from this round's failed build attempts were
renamed out of the way (`mv`, not `rm` — the mount doesn't allow deletes),
so the next `next dev`/`next build` starts from a clean cache.

**To actually run this locally, on the Mac itself (not through Cowork):**

```bash
cd "/Users/emmanueldarosadillenburg/Documents/New project/mindbunker"
rm -rf .next .next-stale-* .next-stale-precache   # safe to delete locally
npm run dev
```

Then open whatever URL the terminal prints (typically `http://localhost:3000`).

## Human QA Script

1. **Pricing Lab** (`/pricing-lab`, desktop nav) — À la carte tab: pick a
   content type, change complexity, toggle rush, add a revision round and
   a thumbnail; confirm the breakdown and suggested price update live and
   "Copy Estimate" works. Switch to Monthly Package tab — confirm it's
   identical to before (steppers, $400/$75/$15, 20% discount, Copy Package
   Summary).
2. **Sessions nav** (desktop sidebar) — click "Sessions", confirm it opens
   the existing `/productivity/sessions` ledger.
3. **All History** (`/all-history`, desktop nav) — confirm the reminder
   card and 5 visuals render above the table, with `?` placeholders (not
   zero bars) for any year missing data; hover a bar for its tooltip.
4. **Health** (`/health`) — tap "Last Night's Sleep", pick a preset, confirm
   today's row updates. Tap "+1 Coffee" a few times, confirm the count
   increments instantly and persists after a refresh. Scroll the activity
   timeline, tap a day cell, confirm the drawer shows real walk/bike/sleep/
   coffee data for that day.
5. **Screen Time** (`/health/screen-time/import`) — click "Fill with
   example payload", submit, confirm it imports; submit the exact same
   payload again and confirm it's reported as already-imported
   (idempotent), not duplicated. Visit `/health/screen-time` and confirm
   the totals/top apps/top categories render.
6. **Dashboard** (`/`) — confirm Start Work/Finished Video are still the
   two primary actions, with the coffee button and "last night" chip below
   them as a secondary, small block.
7. **Responsive** — resize (or use device emulation) at 390×844, 768×1024,
   and 1440×900 across all of the above. **This was not done by me this
   round** (no dev server reachable through the bridge) — please check
   these yourself; the components use the same responsive Tailwind
   patterns (`grid-cols-2 md:grid-cols-3`, `overflow-x-auto`, the
   established bottom-sheet `Modal`) as the rest of the app, but that's a
   pattern match, not a verified screenshot.
8. **`npm run build`** on the Mac directly (see Local Runtime above) —
   confirm it completes; it could not be verified through the bridge.

## Deferred (unchanged from the brief — none of these were built)

Automatic Apple Screen Time collector, ActivityWatch desktop sensor, Apple
Watch integration, universal life-event architecture, Work Session
internal-ops redesign, client-facing caffeine intelligence, AI pricing,
Pricing Lab persistence/quote database, CRM pricing integration, automatic
historical reconciliation, Notion integration, coffee→video correlation
feature (data is timestamp-ready, feature itself not built).

## Files Changed

**New:**
`src/modules/caffeine/{core.ts,actions.ts,core.test.mjs}`,
`src/modules/health/{core.ts,core.test.mjs}`,
`src/modules/screen-time/{core.ts,actions.ts,core.test.mjs}`,
`src/modules/pricing/a-la-carte-hourly.test.mjs`,
`src/modules/historical/all-history-visuals.test.mjs`,
`src/app/all-history/{AllHistoryVisuals.tsx,HistoricalReviewReminder.tsx}`,
`src/app/health/screen-time/{page.tsx,import/page.tsx,import/ScreenTimeImportClient.tsx}`,
`src/components/ui/HealthQuickActions.tsx`,
`src/components/health/ActivityTimeline.tsx`,
`src/db/migrations/0016_graceful_the_enforcers.sql` (+ meta snapshot/journal).

**Modified:**
`src/db/schema.ts` (additive only — 2 new tables),
`src/components/layout/Sidebar.tsx` (Sessions nav entry),
`src/modules/pricing/{config.ts,core.ts}` (additive — new À la carte
hourly exports, Monthly Package exports untouched),
`src/app/pricing-lab/PricingLabClient.tsx` (tab restructure),
`src/modules/historical/core.ts` (additive — 2 new pure functions),
`src/app/all-history/page.tsx` (renders the 2 new components),
`src/app/health/page.tsx` (sleep/coffee quick actions, activity timeline,
Screen Time link, new stats),
`src/app/page.tsx` (today info block).

**Not investigated / left alone**, pre-existing untracked files not created
by this or any prior round in this session (`docs/architecture/
MAC_MINI_REPOSITORY_CLEANUP_AUDIT.md`, `MINDBUNKER_CANONICAL_MAP.md`,
`PRICING_INTELLIGENCE_AUDIT.md`, `pricing-intelligence.v0.json`,
`mindbunker-map.v0.json`, `docs/notion-archaeology/`) — flagged again this
round, same as before, in case Emmanuel wants them reviewed or cleaned up
separately.
