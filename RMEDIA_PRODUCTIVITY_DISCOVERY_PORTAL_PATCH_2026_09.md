# RMEDIA OS — Operator Discovery + Client Portal Personalization Patch
**Date:** 2026-09-14 · **Worktree:** `mindbunker-video-workspace-hotfix` (branch `codex/p0-video-workspace-hotfix`, base `5c8404f`) · **Status:** LOCAL ONLY, not deployed, not pushed, `production/current` untouched

---

## 1. Current source state

Verified before any edit:

| | |
|---|---|
| Branch | `codex/p0-video-workspace-hotfix` |
| HEAD | `5c8404f` — "Fix completed video workspace access" (the live Operator baseline) |
| Remote custody | `origin/release/video-workspace-hotfix` (from the prior round) |
| Working tree | 7 modified files + 4 untracked files, all from the prior **Global Health Bounded Fix Round** — Productivity density reduction, War Room boundary cleanup, timezone/hydration fix, `src/app/projects/[id]/not-found.tsx`, and that round's two reports |
| Local D1 (`.wrangler/state`, this worktree) | At migration 0044, holding a small hand-built fixture unrelated to the health round's own testing — **not** the state used for the prior round's QA |

**Checkpoint taken before this patch:** full working-tree diff saved to `/tmp/health-round-checkpoint.diff`, plus raw copies of all 8 previously-modified files saved to this session's scratchpad, before touching anything. Nothing from the prior round was reset, stashed, or overwritten — every file this patch touches is either a *new* file or an *additional* edit layered on top of the health round's own edits in the same file.

**Local D1 fixture rebuilt for this patch's QA:** the worktree's local D1 was behind (migration 0044) and held unrelated fixture data. Re-synced from a copy of the adjacent `mindbunker` worktree's own local D1 (a realistic, production-shaped local dataset — 4 real clients, real project/video shapes), replayed forward through migrations 0045→0049 (clean, `PRAGMA foreign_key_check` empty both times), then seeded with additional **local-only** QA rows: 5 Dave `LF` videos with `project_id = NULL` (the exact real-world shape reported), plus ~25 additional `PLANNED`/`IN_PROGRESS` videos to reproduce the real "33 queued / 7 in production / 1 review" scale the mission brief itself named (production's real current counts, confirmed read-only: 33/6/1). **Never touched production.**

---

## 2. Productivity — visual root cause (confirmed, not assumed)

The Execution Board's outer container was `grid grid-cols-1 md:grid-cols-3` — the **three stages side by side as CSS grid columns**, each stage internally a single-file vertical stack (`space-y-3`, one card per row). CSS grid stretches every column in a row to the height of the tallest one. With the real shape of this queue (many Queued, few In Production, very few Review), the Queued column's height became every column's height — In Production and Review each rendered 2 real rows of cards and then **12,000+px of pure empty space** below them, because their own column was force-stretched to match Queued's.

This was verified empirically, not inferred: temporarily reverting to the pre-patch file and measuring the live DOM (§4) showed all three stage columns forced to an **identical 12,675px**, even though only two of them had enough cards to fill roughly 850px of that space. That is exactly Emmanuel's own diagram — a short stage ending after one real row, then `card | card | empty` repeating for the rest of the page.

---

## 3. New Productivity layout

Each of the three stages (Queued / In production / Review) is now its own **full-width section**, stacked top to bottom, with its own internal responsive card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — 1 column phone, 2 tablet, 3 desktop where width permits). A short stage is now simply a short section; it no longer inherits a tall stage's height. No stage data, status grouping, queue eligibility, or reorder behavior changed — only the container structure around the exact same `QueueTile` cards.

Two more redundant per-tile controls were removed as part of the same pass, preserving the prior health round's control-count win: **"Move to top"** (redundant with ↑/↓, which already cover ordinary reordering — jumping to position 1 in a bounded queue is rare enough not to need a dedicated button on every one of 40+ tiles) and the **per-tile ⌘K quick-capture button** (redundant with the globally-available ⌘K shortcut, already documented in the page header). No capability was removed — `moveInOrder`'s own `"top"` direction still exists in `modules/productivity/queue.ts` for any future caller; only the duplicate button is gone.

A bounded initial-slice/"show all" mechanism for very long stages (suggested as optional in the brief) was **not** added: the grid-wrapping fix alone cuts the tallest stage's row count by ~3× (§4), nothing is hidden, items are already priority-ordered (`queue_position`), and adding a slice/expand control would be new UI complexity for a problem the layout fix already resolves. Noted as a possible future refinement if the Queued lane grows substantially larger — not needed for this round.

---

## 4. Before / after metrics (measured live, same 39/5/4-item fixture, 1440×900)

The pre-patch `ExecutionQueueSection.tsx` was temporarily restored from `git show HEAD:...` (the true, currently-live Operator source — not a hypothetical), the page was re-measured against the identical seeded dataset, then the patched file was restored. Both measurements are on the exact same data.

| Metric | Before (live source, reproduced) | After (this patch) | Change |
|---|---|---|---|
| Execution board height | **12,675px** (all 3 columns forced equal) | **6,285px** (Queued 4,364 / In production 937 / Review 937) | **‑50%** |
| Total Productivity page height (1440px) | 13,908px | 7,518px | **‑46%** |
| Buttons (DOM count) | 199 | 121 | **‑39%** (Move-to-top + per-tile ⌘K removed × 48 tiles) |
| Links (DOM count) | 71 | 71 | unchanged |
| Stage column heights | 12,675 / 12,675 / 12,675 (visually broken — 2 of 3 mostly empty) | 4,364 / 937 / 937 (each sized to its own content) | fixed |

At 768px (tablet): confirmed live, stage cards render 2-per-row, no overflow, 8,691px page height. At 390px (phone): stage cards render 1-per-row (unchanged from before this patch at this width — the outer 3-column layout was already `grid-cols-1` below the `md:` breakpoint, so mobile was never the "broken grid" case Emmanuel reported; this patch doesn't regress it, but a single, very long Queued lane at 1-per-row is still a long scroll on a 33-45 item real queue — same as before this patch, not made worse). Measured 18,530px at 390px on this same enlarged 48-item fixture — not compared directly against the health round's own 7,352px figure, since that was measured on a much smaller 12-item production dataset at the time; item count, not layout, dominates that number.

No regression toward the original 315-button/156-link/~20k-px state: both before and after this patch already reflect the prior health round's duplication fix.

---

## 5. Dave LF — exact data trace (read-only, production)

| id | title | client_id | project_id | production_order_id | is_operational_container | status | cancelled_at | visible_to_client | batch_label | project client_id | project status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 35 | 3SEP-DaveDeMink-LF_1 | 4 | **NULL** | NULL | 0 | PLANNED | NULL | 1 | NULL | — | — |
| 36 | 3SEP-DaveDeMink-LF_2 | 4 | **NULL** | NULL | 0 | PLANNED | NULL | 1 | NULL | — | — |
| 37 | 3SEP-DaveDeMink-LF_3 | 4 | **NULL** | NULL | 0 | PLANNED | NULL | 1 | NULL | — | — |
| 38 | 3SEP-DaveDeMink-LF_4 | 4 | **NULL** | NULL | 0 | PLANNED | NULL | 1 | NULL | — | — |
| 39 | 3SEP-DaveDeMink-LF_5 | 4 | **NULL** | NULL | 0 | PLANNED | NULL | 1 | NULL | — | — |

All 5 are `video_kind = CLIENT_WORK`, sequential `queue_position` (11000-15000, genuine queue membership, not orphaned data), `content_type = NULL`. Every field is exactly what a real, legitimate, currently-queued Dave deliverable looks like — **except `project_id`, which is null on all five.**

---

## 6. Dave LF — root cause classification

**Class B: VIDEO HAS NO PROJECT.** Confirmed directly from the data (§5), not assumed. These are not misattributed to the wrong client (`client_id = 4` is correct), not cancelled, not samples/internal, not hidden from the client.

Compounding root cause, confirmed by reading `src/app/projects/page.tsx`: **Class G — PROJECTS READ MODEL CANNOT REPRESENT UNASSIGNED DELIVERABLES.** `getProjectsOverview()` is entirely project-shaped (`from(projects).innerJoin(clients)...leftJoin(videoLogs, eq(videoLogs.projectId, projects.id))`) — a video with no `project_id` has no project row to ever appear under, and the client filter dropdown itself was built only from clients who already have a project. This is not a query bug (no query anywhere was filtering these out incorrectly) — it's an architectural gap: there was never a path for a real, client-attributed, project-less video to surface in Projects at all, regardless of filter state.

---

## 7. Projects discovery fix

New read-only query `getUnassignedClientVideos()` (`src/modules/projects/actions.ts`), mirroring `getProjectsOverview`'s own exclusions (`isOperationalContainer = 0`, `cancelledAt IS NULL`, non-GELADEIRA), scoped to `videoKind = 'CLIENT_WORK'` and `projectId IS NULL`. Exposed as a new, bounded, operator-only **"Unassigned deliverables"** section on `/projects` — an amber-bordered card, never a project, listing each video's title and client with an **Open →** link into `videoWorkspaceHref(id)`, the exact same canonical URL every other "open this video" link in the app already uses. No fake project is ever created; the section is entirely absent when there is nothing unassigned (`visibleUnassignedVideos.length === 0` short-circuits the whole block).

- Shown filtered to just that client's unassigned videos when `?client=` is set (verified live: filtering by Dave shows exactly his 5 LF videos and nothing else).
- Shown for every client with unassigned work when no client filter is set (verified live).
- The client filter dropdown itself was widened to include clients who have unassigned videos but zero projects (a client who has ONLY unassigned work would otherwise never be selectable at all).
- Clicking **Open →** on `3SEP-DaveDeMink-LF_1` navigates to `/productivity?video=15` (the video's real local id) and opens its full workspace card — verified live, screenshot-equivalent confirmed via DOM inspection (`#open-workspace-title` present, correct title, no "Video not found").

Pure predicate `isUnassignedClientVideo()` was added to `src/modules/productivity/core.ts` as a unit-testable mirror of the query's real WHERE clause (the query itself stays raw SQL for the aggregate case, per this codebase's existing pattern in `getProjectsOverview`).

### Project filter semantics audit (Section 9)

`PROJECT_STATUS_GROUPS` (in `src/modules/projects/config.ts`) maps all five real statuses (`planned`, `active`, `review`, `delivered`, `archived`) into one of three displayed groups (`active`, `planned`, `completed`) — **every status is shown somewhere; none is silently dropped.** The only pre-existing, intentional exclusion is `ne(clients.archivalState, "GELADEIRA")` in `getProjectsOverview` (a client explicitly archived into Geladeira, unrelated to this mission, pre-existing, documented in its own comment). No status-based filter bug was found. A project that is 100% video-complete but still `active` is **not** hidden by this patch or by anything audited here — that is the pre-existing, separately-reported data-hygiene finding from the prior round's reconciliation report, out of scope here per the brief's own instruction not to fix data hygiene in this patch.

---

## 8. Client dashboard personalization — architecture

**Audited first, before any schema change:**
- Existing capability flags on `clients`: `portalCanSeeFinancials`, `portalCanReview`, `portalCanSetPriority` — all plain booleans, `DEFAULT true`.
- Existing data-visibility flags: `projects.visibleToClient`, `videoLogs.visibleToClient`.
- No existing section/layout preference mechanism of any kind.
- An existing, pre-built **"View as client"** preview flow was found at `/crm/[id]/preview` (calls the same `getClientDashboardView` the real dashboard uses). Preserved and used, not replaced (§9 below) — no new impersonation infrastructure was built.

**Decision:** followed the existing capability-flag pattern exactly. Seven new explicit boolean columns on `clients`, `DEFAULT true NOT NULL` (every existing client keeps its current dashboard exactly as-is after migration), added via one additive migration (`0049_certain_frog_thor.sql`, 7 plain `ALTER TABLE ADD`). No generic layout-builder JSON, no arbitrary component identifiers — a small, stable, named set, matching the brief's own "explicit booleans if the set is small" guidance.

---

## 9. Exact section toggles

Mapped to the **real** Client Dashboard source (`src/app/client/dashboard/page.tsx`), not a guessed name list:

| Toggle | Column | Gates (real section) |
|---|---|---|
| Current account | `portalShowCurrentAccount` | `<CurrentAccount>` (payment request card) |
| Search | `portalShowSearch` | `<DashboardSearch>` |
| Summary | `portalShowSummary` | both `StatTile` rows + the "completed this week" banner |
| Active work | `portalShowActiveWork` | "In production now" batch card + "Needs your attention" + "Current work" + the "Previous batches" archive (all share the same `batches` data source — see §11 on the perf angle) |
| Recent deliveries | `portalShowRecentDeliveries` | "Recent deliveries" section (left visually and functionally untouched, per the brief — only made toggle-aware) |
| Completed by type | `portalShowCompletedByType` | "Completed by type" chip section |
| Video library | `portalShowVideoLibrary` | `<VideoGallery>` (the full filterable gallery) |

`BillingSummary` ("Current recorded spend") was deliberately **not** added as an eighth toggle — it wasn't in scope, already self-gates on `billing.visibility`, and adding it would have gone beyond the brief's own candidate list without a reported need.

Operator control surface: a new **"Client dashboard sections"** card in the existing CRM Client Detail page (`src/app/crm/[id]/ClientTabs.tsx`), directly below the pre-existing "Client portal controls" card, reusing the exact same `PortalControl` toggle component (no new UI primitive). No new Settings page, no modal.

---

## 10. Security / data-visibility semantics

- **Capability beats presentation, provably:** `resolveDashboardSections()` (`src/modules/client-portal/core.ts`) is a pure function — `showCurrentAccount: prefs.showCurrentAccount && permissions.canSeeFinancials` — unit tested directly (§13). `getClientDashboardView` now computes `dashboardSections` through this resolver, not a raw pass-through of the columns.
- **Verified live, not just by unit test:** with Dave's `portalCanSeeFinancials` set to `false` and `portalShowCurrentAccount` left `true`, a real authenticated login to `/client/dashboard` as Dave (local-only test password, generated and later not needed again — never asked Emmanuel for a real credential, never touched production) showed **no Current Account section at all**. The underlying `paymentRequest` was already forced `null` server-side when financials are off (pre-existing code, unchanged) — the toggle only adds a second, independent gate on top.
- **Record visibility beats section visibility:** every dashboard query was already scoped to `visibleToClient = true` records before this patch (`CLIENT_VISIBLE_VIDEO`, `projects.visibleToClient` joins) — this patch adds no new data-fetching path that could leak a hidden record, and the perf change (§11) only skips a query for a section that's off, never skips a visibility filter.
- **Search cannot reveal hidden records:** `DashboardSearch` continues to search exactly `view.allVideos` (already client-visibility-filtered upstream) regardless of whether Video Library is shown — unchanged by this patch, confirmed by reading `DashboardSearch`'s own props and the pre-existing test `search results only ever come from the input array`.
- **One client's preferences never leak to another's:** `resolveDashboardSections` is a pure function of its own arguments (proven by test, §13); `getClientDashboardView` is always called with one `clientId` and reads that client's own row.
- **Malformed values:** the schema constrains every `portalShow*` column to `NOT NULL boolean`; `setClientDashboardSection` rejects a non-boolean `visible` argument and an unrecognized `section` key before touching the database.

---

## 11. Migration

`src/db/migrations/0049_certain_frog_thor.sql` — 7 additive `ALTER TABLE clients ADD ... DEFAULT true NOT NULL` statements, nothing destructive.

- Fresh replay from empty, full history (migrations 0001→0049), in an isolated throwaway local D1: **clean, all ✅.**
- Upgrade path 0044→0049 (this worktree's actual starting state) and 0048→0049 (the mission's named starting point): **clean, all ✅**, tested via two separate real replays this session.
- `PRAGMA foreign_key_check`: **empty (clean)** on every replay.
- `PRAGMA integrity_check`: not evaluable — D1's own driver returns `SQLITE_AUTH` for this PRAGMA via `wrangler d1 execute`, on both `--local` and previously against `--remote` (a platform restriction, not something introduced by this migration).
- **Not applied to remote/production**, per instruction.
- A small performance angle, not a schema change: `getClientDashboardView` now skips the `getClientBatchViews` query entirely when `portalShowActiveWork` is off for that client, rather than fetching and discarding it.

---

## 12. Responsive QA (measured live against the seeded fixture)

| Surface | 390×844 | 768×1024 | 1440×900 |
|---|---|---|---|
| Productivity | clean, no overflow, 1-col stage grids, 18,530px (item-count-driven, see §4) | clean, no overflow, 2-col stage grids, 8,691px | clean, no overflow, 3-col stage grids, 7,518px |
| Projects (Unassigned deliverables + Active projects) | clean | clean | clean, Unassigned section correctly scoped per `?client=` filter |
| Client Dashboard | clean, no overflow, sections cleanly absent when off (no empty headings) | not separately screenshotted; same component tree as 390/1440, no breakpoint-specific section logic | clean |

No console errors, no React #418, on any of the above. `/projects/999999` and `/projects/abc` still resolve to the prior round's intentional Not Found state (regression-checked, unaffected by this patch).

---

## 13. Tests

`npm test`: **1038/1038 passing** (was 1030 at this patch's start; +8 new).

- `stageForQueueItem` (2 new tests, `queue.test.mjs`) — the pure status→lane mapping `ExecutionQueueSection.tsx` now delegates to, extracted from a local closure so it's independently testable. Covers all three stages and the DONE/queue-ineligible fallback.
- `isUnassignedClientVideo` (1 new test, 7 assertions, `core.test.mjs`) — every branch of the real query's WHERE clause: no project, has a client, is CLIENT_WORK, isn't a container, isn't cancelled.
- `resolveDashboardSections` (5 new tests, `client-portal/core.test.mjs`) — defaults preserve prior behavior; **financial capability beats the Current Account preference** (the mission's named Config D, as a deterministic unit test, not just a live click-through); an operator-disabled section stays disabled regardless of capability; every other toggle passes through unaffected; two calls with different inputs never observe each other's state (per-client isolation, as a pure-function proof).
- Pre-existing `getVideoWorkspaceGroup(groups, 999) === null` test (unchanged) continues to cover the "queue eligibility != workspace access" invariant this patch's layout change never touches.
- Pre-existing `isQueueEligible` container-exclusion test (unchanged) continues to cover container exclusion from the execution queue.
- Pre-existing `searchClientDashboardVideos` test (unchanged) already proves search results only ever come from its input array.

No React component-rendering test infrastructure was introduced — this repo has none (pure-logic tests only, no jsdom/RTL), so route-resilience, layout, and personalization claims that need a real render are backed by the live manual QA in §4/§10/§12, not new component tests, consistent with the prior round's own documented convention.

---

## 14. Build gates

| Gate | Result |
|---|---|
| `git diff --check` | clean |
| `npm test` | **1038/1038** |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | **0 errors** (3 pre-existing warnings, unrelated files, unchanged from before this patch) |
| `npm run build` | clean, all routes built |
| `npx opennextjs-cloudflare build` | clean, worker bundle produced |
| Migration | see §11 — additive, fresh-replayed clean, not applied remotely |

---

## 15. Known limitations

- The 5 Dave LF videos remain unassigned in production — this patch makes them **discoverable and openable** from Projects; it does not assign them to a project, per the explicit "do not fabricate fake projects" / "no production data mutation" instruction. Emmanuel decides per-video whether to attach a project.
- The `/crm/[id]/preview` "View as client" page was extended only to gate the two sections it already rendered (Active work, Recent deliveries) with the new toggles — it still does not show Current Account, Search, Summary, Completed-by-type, or Video Library, exactly as before this patch. Expanding it to show all seven would be a larger, separate change.
- A very large Queued lane (30-45+ items, matching production's real current size) is still a long single scroll on mobile at 1-per-row — unchanged from before this patch (mobile was already 1-column), not a regression, but a candidate for a future bounded-slice mechanism if the queue keeps growing.
- `PRAGMA integrity_check` could not be run against this migration due to a D1 platform restriction (`SQLITE_AUTH`), independent of anything in this patch.

## 16. Recommended release scope

This patch is layout/discovery/presentation only:
- Productivity's stage-grid fix and duplicate-control removal are pure rendering changes — safe to ship alongside the prior health round as one combined release.
- The Unassigned Deliverables surface is additive and read-only from the Projects page's perspective — no behavior change for any client with fully-assigned videos.
- Client dashboard personalization defaults every existing client to today's exact behavior — zero visible change for any client until an operator explicitly toggles a section for them.
- Recommend deploying this together with the prior Global Health Bounded Fix Round changes (same worktree, same uncommitted diff) as one release, once Emmanuel has QA'd both — no reason to split them.

---

## Final verdict

| | |
|---|---|
| **PRODUCTIVITY LAYOUT** | GREEN — broken-grid root cause reproduced, fixed, and measured (‑50% execution-board height, ‑39% controls); regression rule (queue eligibility ≠ workspace access) verified live via a real completed-video open. |
| **DAVE LF DISCOVERY** | GREEN — exact data trace obtained, root cause classified (B + G), fixed with a bounded, non-fabricating "Unassigned deliverables" surface, verified live end-to-end (Projects → Open → real Productivity workspace). |
| **CLIENT PORTAL PERSONALIZATION** | GREEN — 7 real, source-verified section toggles; capability-beats-preference proven both by unit test and by a real authenticated login; migration additive and fresh-replay clean; defaults preserve every existing client's current behavior. |

**Overall: GREEN — READY FOR EMMANUEL QA.**

No deploy performed. No production data touched or mutated (every production query this round was a read-only `SELECT`). `production/current` untouched. All prior Global Health Bounded Fix Round changes preserved intact. No new feature wave started beyond what this mission asked for.
