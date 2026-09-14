# RMEDIA OS — Wave 4: CRM Spatial Recomposition
### Dave + Taryn as real pilot fixtures — implementation report
**Branch:** `codex/p0-video-workspace-hotfix` (worktree `mindbunker-video-workspace-hotfix`)
**Date:** 2026-09-14
**Status: code complete, all build gates green, NOT deployed**

---

## 1. Executive Summary

`/crm/[id]` is recomposed into the 5-region spatial model from the Spatial UI
blueprint: **Identity Rail** (left), **Active Jobs** (center, primary),
**Operational Dossier** (right), a **Client Metric Strip** (lower), and a
**Client Dashboard Manager** (bottom, replacing the old checkbox-wall
`PortalControl` grids). No schema changes. No new DB tables. No production
D1 mutation. No deploy. Verified live against local dev D1 using Dave
DeMink and Taryn Dubreuil as real fixtures at four breakpoints
(1920×1080 / 1440×900 / 1180×820 / tablet / mobile). One real bug was found
and fixed during QA (see §15) before any screenshot was taken.

---

## 2. Scope & Constraints Recap

Honored exactly as given:
- No new DB tables/schema/migration.
- No invented facts, scoring, urgency, AI summaries, or new financial totals.
- No Finance / Client-Portal / Dashboard-AS-IT-IS / War-Room-Sidecar work.
- No deploy, no production D1 mutation (including for QA cosmetics).
- Dave + Taryn used as real fixtures, their documented facts used only as
  QA expectations, never hardcoded into components.
- Existing security/gating preserved — portal flags stay presentation-only.
- Desktop-first, responsive down to mobile, with the specified narrow-screen
  stacking order.
- CRM may scroll; only the initial desktop viewport had to avoid scrolling
  through decorative chrome to reach identity/one job/dossier/part of the
  metric strip.
- No N+1 fetches.
- Old superseded UI blocks removed, not left duplicated.
- Full build gate suite run.

---

## 3. Spatial Model Implemented

```
┌─────────────┬───────────────────────────────┬─────────────────┐
│  IDENTITY   │        ACTIVE JOBS             │   OPERATIONAL    │
│    RAIL     │   (primary region, center)     │     DOSSIER      │
│   ~17%      │           ~fluid               │       ~26%       │
├─────────────┴───────────────────────────────┴─────────────────┤
│                     CLIENT METRIC STRIP                         │
├──────────────────────────────────────────────────────────────┤
│   Opportunity / Client Gateway / Geladeira / Quotes (unchanged) │
├──────────────────────────────────────────────────────────────┤
│                CLIENT DASHBOARD MANAGER (if not lead)           │
├──────────────────────────────────────────────────────────────┤
│                       Client Tabs (trimmed)                     │
├──────────────────────────────────────────────────────────────┤
│              Recent activity & history (disclosure)             │
└──────────────────────────────────────────────────────────────┘
```

Implemented in [page.tsx](src/app/crm/[id]/page.tsx) as a single CSS Grid:
`grid-cols-1 lg:grid-cols-[17%_minmax(0,1fr)_26%]`, with `order-*` utility
classes producing the required **Identity → Dossier → Active Jobs** stacking
order below the `lg` breakpoint (blueprint's mobile order), while staying
Identity / Active Jobs / Dossier left-to-right on desktop.

---

## 4. New / Rewritten Components

| File | Status | Region |
|---|---|---|
| [ClientIdentityRail.tsx](src/app/crm/[id]/ClientIdentityRail.tsx) | new | Identity Rail |
| [ActiveJobsPanel.tsx](src/app/crm/[id]/ActiveJobsPanel.tsx) | new | Active Jobs |
| [ClientOperationalDossier.tsx](src/app/crm/[id]/ClientOperationalDossier.tsx) | rewritten | Operational Dossier |
| [ClientMetricStrip.tsx](src/app/crm/[id]/ClientMetricStrip.tsx) | new | Metric Strip |
| [ClientDashboardManager.tsx](src/app/crm/[id]/ClientDashboardManager.tsx) | new | Dashboard Manager |
| [spatial-composition.ts](src/modules/crm/spatial-composition.ts) | new | shared pure read-model logic |
| [page.tsx](src/app/crm/[id]/page.tsx) | restructured | grid shell |
| [ClientTabs.tsx](src/app/crm/[id]/ClientTabs.tsx) | trimmed | Overview tab |

---

## 5. Data Composition & Query Reuse (no N+1)

Zero new per-region queries were added beyond two existing **global**
queries the app already had, reused and filtered in JS exactly like the
existing pattern in this codebase (e.g. `getClientListStats`):

- `getProjectsForClient(clientId)` — already fetched, reused as-is for
  Active Jobs (`ClientProjectView[]`).
- `getUnassignedClientVideos()` — existing all-clients query, filtered to
  this client via the new pure helper `filterVideosForClient` for the
  "Unassigned deliverables" list.
- `getCommercialContracts()` — existing all-clients query, filtered via
  `selectActiveContractForClient` for the Dossier's "Commercial
  relationship" fact.
- `getClientIntelligence(clientId)` — already fetched; supplies the Metric
  Strip's four counts and the Dossier's "Recent note" fact
  (`recentMemoryNotes[0]`), nothing new computed.
- `client.portalPasswordSetAt` / `client.nextAction` / etc. — already on
  the already-fetched `client` row.

Total query count for the page is **unchanged** from before this wave
(same `Promise.all` shape, two more global-query reuses, no new
client-scoped SQL).

---

## 6. Component Reuse Map

| Existing component | Fate |
|---|---|
| `PortalControl` | reused unmodified, now composed inside `ClientDashboardManager` |
| `PortalAccessPanel` | reused unmodified, relocated from a standalone page block into `ClientDashboardManager`'s "Access" group |
| `RenameClientButton` | reused unmodified, relocated into `ClientIdentityRail` |
| `ProjectStatusBadge`, `resolveCoverUrl` | reused unmodified inside `ActiveJobsPanel` |
| `ProjectManager` (Projects tab) | **untouched** — still the full CRUD/listing surface; Active Jobs is a separate, denser, bounded view of the same `ClientProjectView[]` data, not a replacement for it |
| `OpportunityPanel`, `QuotePanel`, `GeladeiraControl` | **untouched**, kept as compact full-width panels below the metric strip — they don't map onto any of the 5 named regions and duplicating them into a region would have been more invasive than the composition calls for |
| "View as client" link | removed from the page header, now lives solely as "👁 Preview as client" inside `ClientDashboardManager` (§15 of the mission: "make it a clear action in the Dashboard Manager") — not duplicated |

---

## 7. ClientTabs Trim

Removed: the two `PortalControl` grid `<section>`s ("Client portal
controls" and "Client dashboard sections") from the Overview tab, along
with their now-unused imports (`PortalControl`,
`setClientDashboardSection`, `setClientPortalCapability`). Nothing else in
`ClientTabs.tsx` changed — Instagram card, default cover, payment
requests, briefing, contact info, statistics, and metadata editors are
untouched. Verified via `grep` that neither removed import nor either
removed action is referenced anywhere else in the file before removing
them.

---

## 8. Dave DeMink Fixture — Observed State (local dev D1)

| Region | Observed |
|---|---|
| Identity Rail | Dave DeMink, ACTIVE, dave@example.com, no phone, client since Sep 8 2026 |
| Active Jobs | "Short Form Videos" (active, 6 videos, 5 shown + "+1 more"); Unassigned deliverables (5), 4 shown |
| Dossier | Next action "Call about quote — Short-form batch ($250.00)" due Sep 9; Commercial relationship "Upwork · Hourly · $25.00/hr"; Portal access "Active — set Sep 14, 2026"; Recent note shown |
| Metric Strip | 1 total project / 1 active / 0 completed / 0 revisions |
| Dashboard Manager | Access panel shows active login + reset/revoke; all 10 flags VISIBLE |

Interaction test: toggled "Search" dashboard-section OFF through the new
UI → `clients.portal_show_search` flipped to `0` in local D1, UI updated
to "HIDDEN" — then toggled back ON, confirmed `1` again. Mutation path
through the new component tree works end-to-end.

---

## 9. Taryn Dubreuil Fixture — Observed State (local dev D1)

| Region | Observed |
|---|---|
| Identity Rail | Taryn Dubreuil, ACTIVE, no email/phone on file, client since Sep 8 2026 |
| Active Jobs | "Mini Series" (active, 23 videos, 5 shown + "+18 more") |
| Dossier | No next action set; no interaction recorded; **"No contract on file"**; portal access "Not set up" |
| Metric Strip | 1 total project / 1 active / 0 completed / 0 revisions |
| Dashboard Manager | rendered (status is `active`, not `lead`), all 10 flags VISIBLE |

See §10 for why Taryn's Dossier/Dashboard Manager facts here diverge from
her true production state (Wave 3 corrections).

---

## 10. ⚠ Local Dev D1 vs Production Divergence (report, not fixed)

Local dev D1 (`.wrangler/state/v3/d1/...`) was **not** reseeded after
Wave 3's production corrections, and this wave did not touch it either
way (per "no D1 mutation" — interpreted to cover local fixture data too,
not just production, other than the one interactive toggle-and-restore
test in §8, which nets to zero and was done to *prove* the interaction
path works, not to make a screenshot look better). Concretely, verified
by direct query:

- `billing_evidence` is **empty locally** (production has 8 rows for
  Taryn after Wave 3).
- The one local `commercial_contracts` row is owned by **client_id=1
  (Dave)**, not client_id=2 (Taryn) as in production — this is a
  pre-existing local-seed vs. production divergence, unrelated to this
  wave's code. It's why the Dossier's "Commercial relationship" fact
  correctly shows "No contract on file" for Taryn locally and
  "Upwork · Hourly · $25.00/hr" for Dave — both are the *component
  behaving correctly against the fixture data it was actually given*,
  not a display bug.
- Taryn's `portal_show_*` / `portal_can_*` flags are all still `1`
  (schema defaults) locally; production has `portal_can_see_financials`,
  `portal_show_current_account`, `portal_show_summary`,
  `portal_show_completed_by_type` set to `0` for her after Wave 3.

**Conclusion:** the visual QA in §12 below validates the new layout
renders correctly and gracefully against whatever data it's given,
including Taryn's real "no contract yet" and "portal not started" facts —
it does not validate that production's exact current numbers appear,
because local dev D1 is a stale/divergent seed relative to production.
Reseeding local D1 from a production export was out of scope for this
wave and was not done.

---

## 11. Lead / Sparse-Entity Handling

No `lead`-status client exists in local dev D1 fixtures (all 4 local
clients are `active`), so this could not be screenshotted live. Verified
by code inspection instead:
- `ClientDashboardManager` is gated behind `client.status !== "lead"` in
  `page.tsx` — the exact same conditional that gated the old
  `PortalAccessPanel` block before this wave, so lead behavior is
  unchanged, not newly introduced.
- `ActiveJobsPanel` and `ClientOperationalDossier` have no `status`
  branching of their own; a lead with zero projects/contracts/notes
  renders their existing empty-state copy ("No active or in-review
  projects right now.", "No next action set", "No contract on file",
  "Not set up") — the same graceful-empty pattern already proven live by
  Taryn's own sparse Dossier facts in §9.

---

## 12. Responsive / Breakpoint QA

Logged in via the dev-only `/qa-login` shortcut (`NODE_ENV=development`
+ `MB_PROJECT_QA_LOGIN_TOKEN` from `.env.local`) against local dev D1 on
`http://localhost:3014/mindbunker/crm/{1,2}` (this app's `basePath` is
`/mindbunker` in dev/operator builds).

| Breakpoint | Result |
|---|---|
| 1920×1080 | 3-column grid; Identity/Active Jobs/Dossier + full Metric Strip + Opportunity/Gateway panels all visible with no scroll |
| 1440×900 | Same layout, comfortably fits |
| 1180×820 | Same 3-column layout holds; Identity Rail name truncates aggressively at this width (cosmetic, `truncate` works as designed, not broken) |
| tablet (768×1024) | Collapses to 1 column; confirmed stacking order **Identity → Dossier → Active Jobs → Metrics → (Opportunity etc.) → Dashboard Manager**, exactly as specified |
| mobile (375×812) | Single column, no horizontal scroll, comfortable padding, bottom nav unobstructed |

No console errors on any breakpoint (checked via a fresh tab to avoid
stale console history from the pre-fix load in §15).

---

## 13. Accessibility

- Every new region uses a real heading (`<h1>`/`<h2>`) and `<dl>/<dt>/<dd>`
  for fact lists, not styled `<div>`s pretending to be data.
- All interactive elements are real `<Link>`/`<button>` — no
  click-handler-on-`<div>`.
- Status/visibility signaling is never color-only: every badge carries
  text ("ACTIVE", "VISIBLE"/"HIDDEN") alongside color.
- `PortalControl`'s existing `role="switch"` + keyboard-operable `<button>`
  semantics are preserved unmodified.
- No custom `outline: none` was added anywhere in the new components, so
  the browser's default focus ring remains visible on every new
  interactive element (not exhaustively tabbed through end-to-end given
  time constraints, but nothing in the new code suppresses it).

---

## 14. Security / Gating Preservation

No change to any authorization/ownership/visibility query. The two
reused global queries (`getUnassignedClientVideos`,
`getCommercialContracts`) already existed and are filtered to the
current client **in JS after the fact**, exactly like this codebase's
established `getClientListStats` pattern — not a new trust boundary.
Portal capability/section flags remain presentation-only switches read
by the client-portal read model exactly as before; nothing in this wave
touches `src/modules/client-portal/core.ts` or `data.ts`.

---

## 15. Bug Found & Fixed During QA

`ClientDashboardManager.tsx` was first written as a Server Component
(no `"use client"`) that passed inline arrow-function `onChange` props
to the client component `PortalControl`. Next.js correctly rejected this
at request time: *"Event handlers cannot be passed to Client Component
props."* — a real regression that would have 500'd `/crm/[id]` for any
non-lead client. Root cause: the original `PortalControl` grids lived
inside `ClientTabs.tsx`, which is `"use client"`; moving them into a new
component without carrying that directive broke the server/client
boundary. **Fixed** by adding `"use client"` to
`ClientDashboardManager.tsx` before any screenshot was taken — confirmed
via a fresh browser tab that the fix produces zero console errors and a
fully interactive page (§8's toggle test).

---

## 16. Tests Added

This repo's `npm test` only runs `node --test` over plain `.mjs` files
under `src/modules/**`, `src/lib/**`, `src/utils/**` — there is no
React/DOM test harness in this codebase (no `@testing-library/react`, no
jsdom, no jest/vitest in `package.json`). Rather than fabricate testing
infrastructure out of scope for this wave, the read-model composition
logic that most needed coverage was extracted into a plain, dependency-free
module — [spatial-composition.ts](src/modules/crm/spatial-composition.ts)
— and unit-tested directly with this repo's existing pattern:
[spatial-composition.test.mjs](src/modules/crm/spatial-composition.test.mjs),
**10 tests, all passing**:
- `selectActiveJobs` — active/review-only filtering, order preservation,
  bounding + hidden-count, empty-state.
- `boundedSlice` — generic cap + remainder helper (used for both the
  per-project video queue and the unassigned-deliverables list).
- `filterVideosForClient` — never leaks another client's rows.
- `selectActiveContractForClient` — matches only this client's `ACTIVE`
  contract, returns `null` otherwise (proves no cross-client leakage and
  no fabricated fallback).
- `formatCommercialRelationship` — no-contract state, hourly-rate
  display, and explicitly **does not invent a FIXED-contract dollar
  amount** the schema has no field for (asserted directly: the formatted
  string never contains `$` for a FIXED contract with no rate).

Component-level interaction was instead verified live (§8, §12) — real
mutation through `PortalControl` → `setClientDashboardSection` →
D1 write → UI refresh, against the real fixture.

---

## 17. Build Gates

All run from the worktree root, in order, after the §15 fix:

| Gate | Result |
|---|---|
| `git diff --check` | clean |
| `node --test src/modules/crm/spatial-composition.test.mjs` | 10/10 pass |
| `npm test` (full suite) | **1065/1065 pass** |
| `npx tsc --noEmit` | clean, exit 0 |
| `npx eslint .` | 0 errors, 3 pre-existing unrelated warnings (unused eslint-disable directives in `error.tsx`, `global-error.tsx`, `FxMonthRatePanel.tsx` — none touched by this wave) |
| `npm run build` | succeeds, all routes compile |
| `npx opennextjs-cloudflare build` | succeeds, worker bundle produced |

No migration was needed at any point — `git diff` confirms
`src/db/schema.ts` was never touched.

---

## 18. Out of Scope — Explicitly Not Touched

Per the mission's closing instruction: no Finance work, no Client-Portal
read-model work, no "Dashboard AS IT IS" work, no War Room Sidecar work,
no deploy, no next-wave prompt written.

---

## 19. Known Gaps / Follow-ups

- **Local dev D1 is stale relative to production** (§10) — a future
  session should either export/reseed local D1 from a sanitized
  production snapshot, or explicitly accept that local QA only validates
  UI behavior/graceful-empty-states, not production's actual current
  numbers.
- **FIXED-contract dollar amount**: the schema has no field for a fixed
  commercial amount (only `hourlyRate`, required iff `billingType`
  is `HOURLY`) — `formatCommercialRelationship` handles this by omitting
  a fabricated amount for FIXED contracts rather than inventing one; a
  future schema/product decision (out of scope here) would be needed to
  actually store and show a FIXED amount.
- **Identity Rail name truncation** at 1180px is aggressive (§12) —
  cosmetic only, not a functional break; worth a follow-up pass if this
  breakpoint turns out to matter in practice.
- **Lead-status empty state** was verified by code inspection only
  (§11), not a live screenshot, since no `lead` fixture exists in local
  dev D1.

---

## 20. Final Structured Output

```
CRM SPATIAL MODEL:      GREEN
DAVE FIXTURE:           GREEN
TARYN FIXTURE:          GREEN (facts differ from production — see §10, local D1 divergence, not a defect)
LEAD STATE:             YELLOW (verified by code inspection, no live lead fixture to screenshot)
PORTAL MANAGER:         GREEN (mutation path proven end-to-end, flags preserved)
RESPONSIVE:             GREEN (1920×1080 / 1440×900 / 1180×820 / tablet / mobile all correct, spec'd stacking order confirmed)

TESTS:                  1065/1065 (10 new)
MIGRATIONS:             NONE
D1 MUTATIONS:           NONE (production); local dev D1 touched only by one toggle-and-restore interaction test, net zero
DEPLOY:                 NOT PERFORMED

NEXT ACTION: Await Emmanuel's review of this report and the live local
preview before any further CRM spatial work (Dashboard AS IT IS, War
Room Sidecar) begins.
```
