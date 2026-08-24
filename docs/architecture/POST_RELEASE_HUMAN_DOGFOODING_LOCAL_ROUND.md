# Post-Release Human Dogfooding — Local Round (Sprint 1.2.x)

Local-only implementation round. No production deploy, no remote D1, no Cloudflare traffic changes, no production secrets touched. Executed against the repo at `~/Documents/New project/mindbunker` on Emmanuel's Mac mini via the Claude device bridge (Cowork), commit `d9a5dfd` on `main` as baseline.

## Baseline

- `git status --short` at start: clean tracked tree, several untracked docs/artifacts from a prior session (`docs/architecture/*.md`, `docs/notion-archaeology/`, `src/app/all-history/_import/`, `src/db/migrations/0015.integration.test.mjs`) — none touched or deleted this round.
- HEAD: `d9a5dfd` "Add Pricing Lab P0 for commercial dogfooding", branch `main`, no `.git/index.lock`.
- `git diff --check`: clean, no whitespace errors, then or after this round's edits.
- Local D1 (`wrangler d1 migrations apply mindbunker --local`): **no migrations to apply** — local D1 already at migration `0015_fixed_slipstream.sql`, matching the committed migration chain exactly.
- Toolchain: Node v22.23.2, npm (the repo's `bun.lock` is present but `bun` is not installed in this environment; all scripts run through the `package.json` npm scripts, which is what `next dev`/`next build`/`wrangler` actually use).

## Human findings mapped to repository — Implementation Matrix

| # | Feature | Current reality | Human request | Data exists? | Schema needed? | Decision | Risk |
|---|---|---|---|---|---|---|---|
| A | War Room quote maintenance | Static phrase in `war-room/page.tsx`; no persistence or admin surface found anywhere in the repo | Hidden `/mindbunker-backstage`-style maintenance UI for a phrase bank | No | Only if a config-only prototype proves insufficient | **RESEARCH ONLY** | Low if config-backed; grows if given persistence prematurely |
| B | Dashboard Start Work UX | `HomeTrackingPanel` permanently exposed a 4-field inline form on the Dashboard | Two primary actions `[Start Work] [Finished Video]`, Start Work opens a compact modal | Yes (`startWorkSession`, `getProductivityQuickOptions`) | No | **IMPLEMENTED** | Low — pure UI reuse of existing server actions |
| C | Dashboard correlations/metrics | Revenue Trend, Output Trend, Sleep, Caffeine, Streak, Revision Drag, Leverage all present and wired to `getWarRoomData()` | Keep as-is | Yes | No | **VERIFIED, no change** | — |
| D | Productivity Current Work | `groupOperationalVideos()` already groups by `video.status === "IN_PROGRESS"`, not by timer presence; `READY_FOR_REVIEW` already routes to "attention", not "current" | Current Work must mean active production state, not "timer running" | Yes | No | **VERIFIED CORRECT, no change needed** — the semantic the audit asked for was already the implemented one | — |
| E | Operational/internal work tracking | `work_sessions.video_id` is `NOT NULL` with `onDelete: "restrict"`; every read path (`OPEN_WORK_SESSION_SQL`, `WORK_SESSION_HISTORY_SQL`, `WORK_SESSION_BY_ID_SQL`, `CORRECT_WORK_SESSION_SQL`) uses `INNER JOIN video_logs` | Track internal RMEDIA ops without fake client/video records | Partially — video-level client/project are already nullable, session-level video is not | Yes — nullable `video_id` + a parallel `activity/category` concept | **DEFERRED** — see reasoning below | High if forced this round |
| F | CRM / Geladeira placement | CRM order was Stats → Add Client → Active → Leads → Inactive → Geladeira (collapsed, bottom) | Leads → Metrics → Geladeira | Yes | No | **IMPLEMENTED** | Low — pure reorder, no data/query change |
| G | CRM → Projects navigation | Productivity page already links to CRM; CRM had no reciprocal link to Projects | Small nav control from CRM to `/projects` | Yes (`/projects` route exists) | No | **IMPLEMENTED** | Low |
| H | Pricing Lab evolution | Monthly Package Builder is the only surface; canonical config ($400/$75/$15, 20% package discount) confirmed intact | A-la-carte tab alongside Monthly Package | Config yes; old friction-multiplier semantics unconfirmed | No | **DEFERRED** (see §16 archaeology note) | Low to defer, medium to invent factors |
| I | All History | `/all-history` page renders "No historical batch has been imported and activated yet."; a dev-only `/all-history/_import` trigger page already exists (gated on `NODE_ENV==='development'`) calling the additive, idempotent `importHistoricalArtifact()` | See it populated locally | Yes — artifact JSON + importer already in repo | No | **READY FOR HUMAN QA** — not run automatically (Data Safety protocol requires the human to press the button), documented as the first local QA step below | Low — importer is additive-only, hits only `hist_*` tables, never writes Client/Project/Video/WorkSession |
| J | Video metadata / IPTC | `video_logs` already has `coverUrl`, `orientation`, `contentType` (nullable, Sprint 1.2.2); no tags/keywords field | Audit against IPTC/XMP/Dublin Core/platform conventions | Yes (partial) | Only if tags are added | **RESEARCH ONLY** | — |
| K | Session Ledger | Grouping, correction, notes, source, Session Narrative, video filter all present in `work-sessions/core.ts` + `productivity/sessions/*` | Preserve, fix only verified defects | Yes | No | **VERIFIED, untouched** | — |
| L | Client Portal regression risk | No file under `src/app/client/`, `src/modules/client-portal/`, `src/modules/gateway/` was touched this round | Re-run isolation checks | — | No | **VERIFIED — no touched surface** | — |

## Implemented

### Dashboard (P0)

`src/app/HomeTrackingPanel.tsx`, `src/app/page.tsx`, `src/components/ui/ProductivityQuickActions.tsx` — added `StartWorkButton` (new export, same `ActionSheet` modal pattern already used by `FinishedVideoButton`/`PlanVideoButton`). It fetches `getProductivityQuickOptions()` on open, offers Client → Project → Video → Activity exactly as the old inline form did, and calls the same `startWorkSession()` server action — no new timer, no new table. `HomeTrackingPanel` now renders `[Start Work] [Finished Video]` side by side when nothing is running, and still shows the existing "Tracking now" banner (unchanged) when a session is active. `FinishedVideoButton` was removed from the Dashboard's smaller Quick Actions grid since it is now one of the two primary actions, avoiding a duplicate control.

### Productivity — Current Work semantics

No code change. `groupOperationalVideos()` in `src/modules/productivity/core.ts` already derives the "current" group from `video.status === "IN_PROGRESS"`, and routes `READY_FOR_REVIEW`/`CHANGES_REQUESTED`/overdue-planned videos to "attention", never "current" — exactly the production-state projection the audit asked for, with no dependency on timer presence. Verified by reading the projection logic and the Productivity page's use of it; also covered by the existing `lifecycle.integration.test.mjs` suite (152/152 passing).

### Internal Operations

Not implemented this round. `work_sessions.video_id` is `NOT NULL` with `onDelete: "restrict"`, and four separate raw-SQL read paths (`OPEN_WORK_SESSION_SQL`, `WORK_SESSION_HISTORY_SQL`, `WORK_SESSION_BY_ID_SQL`, `CORRECT_WORK_SESSION_SQL`) hard-code `INNER JOIN video_logs`. Making `video_id` nullable is a real, small-looking migration that in practice cascades into every one of those queries (each `INNER JOIN` would need to become a `LEFT JOIN`, and every caller that assumes `video_id`/`video_title` exist would need an internal-session branch), plus the Session Ledger UI, the correction flow, and the Dashboard/Productivity projections that key off `video_id`. This matches the brief's own instruction: "If changing this would cascade dangerously through the domain: DEFER and keep the RMEDIA temporary fixture for this week." The RMEDIA / Development MindBunker / Overview do Site fixture Emmanuel is already using was not touched.

### CRM / Geladeira

`src/app/crm/page.tsx` reordered to Add Client → **Leads** → Active Clients → Inactive → **Metrics** → **Geladeira** (Geladeira was already last/collapsed and stays that way — "it is the fridge"). Added a "Projects & videos →" link next to "Call availability" in the page header, pointing at the canonical `/projects` route (no new Projects view created). Geladeira's own archive/reactivate/history/Vault-warning behavior in `GeladeiraControl.tsx` was not touched.

## War Room — metric audit (research only, no formula changes made)

| Metric | Current formula (from `analytics/service.ts` + `war-room/page.tsx`) | What it claims to measure | Evidence quality | Decision |
|---|---|---|---|---|
| R$20K Trajectory, Revision Drag Index, Videos This Month, Revenue/Video, Videos/Active Client, Momentum & Trajectory, Leverage Score | Unchanged this round | (per existing docs) | Not re-derived this round | **KEEP as-is** per the audit's own instruction |
| Effective Flat-Rate Yield, All-Time Revenue/Video, Top Clients by Revenue, Output Trend interpretation, Leverage Score formula | Unchanged this round | — | Needs a dedicated formula-by-formula reading of `analytics/service.ts` against real data, not done this round | **DEFERRED to next round** — reviewing and possibly relabeling ~5 formulas honestly needs its own focused pass, not a rushed one inside an already-large round |
| Drain Ranking | Does not exist yet | Rank clients/projects by "what's draining time relative to revenue" | Would combine `work_sessions` (time) with `transactions`/`clients.totalRevenue` (money) — both exist | **DEFERRED** — same reasoning: a new ranking deserves its own verification pass rather than being bolted on at the end of an already-large round |

Recommendation: run §10 (War Room metric audit) and Drain Ranking as their own focused local round, not appended to this one.

## Pricing Lab

Canonical config verified unchanged and correct: Long-form $400 / Short-form $75 / Thumbnail $15, 20% experimental package discount, integer-cent math, single source of truth (`src/modules/pricing/config.ts`), no persistence. The A-la-carte tab was **not** built this round.

`~/Desktop/rmedia-pricing-recovery` (the old artifact referenced in the brief) could not be reached this round — the folder-access grant for it was declined by the device bridge (only the `mindbunker` repo folder was grantable in this session). Without being able to read that artifact, inventing a-la-carte friction/complexity factors would mean guessing at formulas rather than reconstructing them, which the brief explicitly forbids ("If the old formula cannot be confidently reconstructed: do not invent it"). **Deferred** — if Emmanuel wants this pursued, the fastest path is connecting that folder specifically in a follow-up session so it can be read as archaeological evidence.

## All History

The importer (`importHistoricalArtifact()` in `src/modules/historical/actions.ts`) is additive-only, idempotent (content-fingerprinted), and only ever writes to `hist_*` tables — never to Client/Project/Video/WorkSession. A dev-only trigger page already exists at `/all-history/_import` (gated on `NODE_ENV === "development"`), from a prior session. It was **not** run automatically this round (per the Data Safety protocol, this needs a deliberate human action) — running it is the first item in the Human QA script below. The reconstructed-evidence warning banner on `/all-history` itself was not touched.

## Metadata / IPTC audit (research only)

| Current field | Current semantics | Industry analog | Decision |
|---|---|---|---|
| `title` | Free text | IPTC Title / Dublin Core `dc:title` | Keep |
| `notes` | Free text, internal | Not a standard descriptive field — closer to an internal production note | Keep, internal-only |
| `coverUrl` | Nullable HTTPS URL | Platform thumbnail/poster convention (YouTube, Vimeo) | Keep |
| `orientation` | LANDSCAPE / VERTICAL / SQUARE | Not an IPTC field — closer to a platform delivery-format convention | Keep, rename not needed |
| `contentType` | short-form / long-form / mini-doc / testimonial / other | Closer to Dublin Core `dc:type` than IPTC (IPTC is photo-first) | Keep |
| `deliveryUrl` | Nullable HTTPS URL | Platform/asset-management "asset location" | Keep, internal |
| tags/keywords | **Does not exist** | IPTC Keywords / Dublin Core `dc:subject` | Add later only if a real workflow need shows up — not built this round |
| creator, rights, language | **Do not exist** | IPTC Creator/Copyright, Dublin Core `dc:language` | Not relevant yet — single-operator shop, no rights-clearance workflow today |

No schema change made. This table is the full deliverable for §19–20 this round.

## Schema decision

**No schema changes this round.** Every item that could have justified one (internal-operation tracking, a phrase-bank table) was evaluated and deferred per §22's own default ("NO SCHEMA CHANGES" unless small, additive, low-blast-radius, and clearly justified) — internal-ops nullable `video_id` is additive-looking but cascades through four raw-SQL joins and the Ledger/correction UI, and the phrase bank has no proven need for persistence yet (a config-file prototype was not built this round either, given time spent on the P0 items and audits above).

## Tests

- `npm run typecheck` (`tsc --noEmit`): **clean**, no output.
- `npx eslint` on the four changed files: **clean**, no output.
- `npm test` (152 unit tests across every `*.test.mjs` module, work-sessions/productivity/CRM/pricing/booking/gateway/instagram/historical/client-portal/auth-core): **152 pass, 0 fail**.
- `git diff --check`: clean before and after.
- Local D1 migration chain: `wrangler d1 migrations apply mindbunker --local` → "No migrations to apply" (already current).
- Integration tests (`*.integration.test.mjs`) were not run — they are intentionally excluded from `npm test`'s glob and were not exercised separately this round since no schema or query changed.

## Builds

`npm run build` / OpenNext build were **not run** this round. A `next dev` smoke test was attempted through the device bridge and surfaced a filesystem limitation specific to that bridge's FUSE mount (Turbopack's persistent cache had a stale `.del` tombstone from an earlier ungracefully-terminated `next dev` process, and this mount does not permit deleting files by default — a stale `.next` was renamed to `.next-stale-precache` rather than deleted; `npm run dev` will recreate a fresh `.next` next time it runs). A second attempt after clearing the cache showed a Turbopack "Failed to benchmark file I/O: Operation not permitted" warning and served a 404 for `/`, which is consistent with the mount's restricted file-I/O semantics interfering with Turbopack's route discovery — not with anything in the four files this round touched (which pass `tsc`, `eslint`, and the full test suite cleanly). This category of issue is specific to running the dev server *through the Cowork device bridge*; it should not reproduce when `npm run dev` is run directly in a terminal on the Mac mini itself, outside the bridge.

## Local runtime

Run directly on the Mac mini (not through the device bridge, which cannot hold a long-running dev server open — every background process started through it is torn down when that tool call returns):

```
cd "/Users/emmanueldarosadillenburg/Documents/New project/mindbunker"
npm run dev
```

Then open **http://localhost:3000** in a browser. Local D1 is already migrated and does not need `db:migrate:local` run again unless new migrations land. If `.next-stale-precache/` bothers you, it's safe to delete by hand — I renamed the old cache dir out of the way rather than deleting it, since the bridge doesn't have delete permission on your folder by default.

## Human QA script

1. **All History**: with the dev server running, open `http://localhost:3000/all-history/_import`, click "Import historical artifact" once. Then open `/all-history` and confirm the year-by-year table now renders with the reconstructed-evidence warning banner still showing above it.
2. **Dashboard**: open `/`. Confirm you see two buttons, Start Work (left) and Finished Video (right), not a permanently-open form. Click Start Work → modal opens → pick Client → Project → Video → Activity → Start → you land on `/productivity?video=<id>` with that video's workspace open. Go back to `/` and confirm it now shows the "Tracking now" banner instead of the two buttons. Stop the session from the Productivity page and confirm the Dashboard reverts to the two-button state.
3. **Productivity**: confirm "Current Work" only shows videos whose status is In Progress, and that a video sitting in Ready for Review appears under "Attention," not "Current Work." Confirm Session Ledger (`/productivity/sessions`) looks and behaves exactly as before.
4. **CRM**: open `/crm`. Confirm the order reads Leads, then Active Clients, then Inactive, then the Metrics grid, then Geladeira collapsed at the very bottom. Confirm the new "Projects & videos →" link in the header goes to `/projects`.
5. **War Room / Pricing Lab / metadata**: unchanged this round — nothing new to click, formulas and A-la-carte are deferred to a follow-up round (see Deferred below).

## Deferred

- Internal-operation (non-client) work tracking, and the operational-hours projection built on top of it — needs its own schema-design pass given the cascade through `work_sessions`' raw SQL, not a same-round add-on.
- War Room metric-by-metric audit (Effective Flat-Rate Yield, All-Time Revenue/Video, Top Clients by Revenue, Output Trend interpretation, Leverage Score formula) and Drain Ranking — deserves a dedicated, careful pass against real data rather than being rushed at the end of this round.
- War Room phrase-bank backstage maintenance UI — no persistence exists yet; a config-file prototype is the recommended next step, not attempted this round.
- Pricing Lab A-la-carte tab — blocked on reading `~/Desktop/rmedia-pricing-recovery`, which this session could not get folder access to.
- Video tags/keywords — audited (see Metadata table above), not built; no concrete workflow need identified yet.

## Files changed

- `src/app/HomeTrackingPanel.tsx` — rewritten: renders the two primary actions when idle, unchanged "Tracking now" banner when active.
- `src/app/page.tsx` — Dashboard: dropped the now-unused `getProductivityQuickOptions` prefetch/props, removed `FinishedVideoButton` from the Quick Actions grid.
- `src/app/crm/page.tsx` — reordered sections (Leads → Active → Inactive → Metrics → Geladeira), added the Projects nav link.
- `src/components/ui/ProductivityQuickActions.tsx` — added the `StartWorkButton` export.

No migration files, no `wrangler.jsonc`, no client-portal/gateway files touched.
