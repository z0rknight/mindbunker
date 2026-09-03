# Equipment QA Ledger & Deferred Scope

Companion to the project-level `MINDBUNKER_MASTER_QA_LEDGER.md` /
`MINDBUNKER_QA_COVERAGE.md` reconciliation (tracked in the MindBunker
Claude Project, not this repo — those cover the whole application's prior
QA history). This file is scoped to the Equipment module across every
implementation wave so Wave N+1 planning has one authoritative, in-repo
home instead of being reconstructed from a chat transcript. Update this
file for future Equipment waves rather than creating a parallel document
(this file itself replaces the earlier `EQUIPMENT_WAVE_1_QA_LEDGER.md`,
renamed here once Wave 2 made "Wave 1" in the filename inaccurate — all
Wave 1 content below is preserved verbatim, nothing was dropped).

## Status as of Wave 3: implemented, locally verified, NOT deployed, NOT committed

Branch `codex/tuesday-operator-intelligence` throughout all three waves. No
production D1 migration was applied at any point. No commit was made —
this file and the rest of the Equipment diff are working-tree changes
pending review.

---

## WAVE 1 — Foundation + Command Center + Asset Registry

## What shipped

- One master `equipment_assets` table (`ownership` is a classification
  column — PERSONAL/RMEDIA/FAMILY/THIRD_PARTY — never a separate table).
- `equipment_systems` table, structurally distinct from `category`
  (Domain/Category answers "what kind of thing"; System answers "what
  operational setup").
- Self-referencing `parentAssetId` for component composition (e.g. a NAS
  unit with HDD/motherboard children), with anti-double-count aggregation
  (`selectCountableAssets` in `src/modules/equipment/core.ts`) applied
  identically at registry-wide, per-domain, and per-system scope.
- Deterministic, concurrency-safe `assetCode` derived from the DB-assigned
  autoincrement id (`RM-COMP-000042` shape) — see `buildAssetCode` in
  core.ts and the two-step insert-then-derive flow in
  `createEquipmentAsset` (actions.ts). Chosen over a per-domain counter
  specifically because a counter query is racy under D1's concurrent-write
  model; the autoincrement id is the one value D1 already hands out
  atomically. Trade-off: codes don't reset to 001 per domain.
- Coverage-aware financial aggregation (Total Invested / Current Value /
  Replacement Exposure) that never silently treats missing `currentValue`
  as `purchasePrice`, or missing `replacementCost` as zero — each figure
  carries its own `valuedCount / countableCount` alongside the total.
- `/equipment` Command Center, `/equipment/assets` (+ `[id]` detail),
  `/equipment/systems` (+ `[id]` detail), all under the existing
  `max-w-7xl` dense-page convention (same as Finance/War Room), reusing
  `StatCard` and a `ProjectStatusBadge`-style badge pattern
  (`src/components/equipment/EquipmentBadges.tsx`).
- Sidebar nav entry (desktop-only, OPERATIONS group) — deliberately
  desktop-only to preserve the mobile bottom tab bar's fixed 7-slot count,
  same discipline already applied to Sessions/Pricing Lab/Subscriptions/
  Debts/Contracts/All History.
- Add/Edit modal forms for both Assets and Systems, minimum required
  fields (Name/Ownership/Domain/Category for assets; Name/Ownership for
  systems), everything else behind a collapsed "More details" disclosure.

## EQUIP-001 — Live-rendered functional verification (not full visual QA)

**Severity:** informational / scope note, not a defect.

The local dev environment for this wave runs inside a sandboxed VM whose
background processes do not survive between tool calls, and no browser or
screenshot capability is available inside it. This blocked literal
pixel-level inspection at 390/768/1024/1440/1920px as the Wave 1 brief's
§17 asks for.

What WAS verified, in a single persistent session against a real local
D1 database seeded with clearly-labeled `[TEST FIXTURE]` rows (deleted
before this wave closed — local D1 only, never touched anything remote):

- All five Equipment routes return HTTP 200 behind auth, with zero
  server-side errors, both empty and populated.
- Investment totals rendered correctly in the live HTML: a priced parent
  (NAS, R$2,000) with one priced child (HDD, R$600) summed to R$2,000 at
  system level and contributed only R$2,000 (not R$2,600) to the
  registry-wide Total Invested — confirming the anti-double-count logic
  holds outside of unit tests too.
- Ownership filtering (`?ownership=PERSONAL`) correctly excluded the
  RMedia NAS and its component from both the list and the financial
  totals.
- The Needs Attention panel correctly surfaced the one ATTENTION-condition
  fixture asset and none of the others.
- Asset code derivation produced `RM-STOR-000001` for a RMEDIA/STORAGE
  asset with id 1, matching `buildAssetCode`'s documented shape.

**DEFERRED — WAVE 2**: a real pixel-level responsive pass (390/768/1024/
1440/1920px) using an actual browser against this app, the first time
that tooling is available in-session. The Tailwind classes used were
chosen to mirror already-shipped, already-QA'd patterns exactly (StatCard
grid breakpoints, the AddDebtButton bottom-sheet-on-mobile modal shape,
Finance's `overflow-x-auto` table wrapper), which lowers but does not
eliminate the risk of a real layout issue this wave didn't catch.

## EQUIP-002 — Pre-existing baseline test failures, unrelated to Equipment

**Severity:** informational — not introduced by this wave.

`node --test` on the full suite: 708/710 passing. The 2 failures are both
in `src/modules/finance/owner-pay-bridge.integration.test.mjs`
("recordOwnerPay builds the exact Drizzle INSERT SELECT shape accepted by
D1" and "Owner Pay correction builds two identity-preserving Drizzle
updates"), both failing with `ERR_MODULE_NOT_FOUND` on a `tsx`-loader
`?namespace=...` resolution of `src/db/schema.ts` — a module-loader
artifact, not a test-logic failure. Reproduced deterministically in
isolation, before and independent of any Equipment file. No file under
`src/modules/finance/` or `src/modules/equipment/` interaction exists.
Left exactly as found; not in scope to fix under this wave's brief.

## EQUIP-003 — Local dependency install used `--ignore-scripts --package-lock=false`

**Severity:** informational — local verification only, does not affect
what would be committed or deployed.

`bun` (the repo's specified package manager) could not be installed
(egress-blocked). Plain `npm install` against the committed
`package-lock.json` crashed inside npm's own arborist dedup logic
(`Invalid Version:` TypeError) reproducibly across a clean cache and an
alternate npm version. Resolving fresh (`--package-lock=false`) avoided
the crash; `--ignore-scripts` was additionally required to skip
`rclone.js`'s postinstall, which tries to reach an egress-blocked host.
This means local `npm run typecheck` / `npm run test` / `npm run build`
for this wave ran against a freshly-resolved `node_modules` tree, not the
exact versions pinned in `package-lock.json`. Nothing under
`package-lock.json` or `node_modules` was modified in git's view
(confirmed via `git status`) — this is purely a local verification
workaround.

## Wave 2 seams (explicitly prepared, not built)

- **Maintenance Event schema** — DEFERRED — WAVE 2. Brief §12 allowed
  adding this "if cheap and clean after the Asset foundation is
  complete"; Wave 1 prioritized Asset Registry + Systems + Command Center
  quality over adding a fourth table. The intended shape (id, assetId,
  type, date, cost/issue/action/result/nextInspection/notes) is already
  specified in the Wave 1 brief and should attach to `equipmentAssets.id`
  the same way `equipment_assets` attaches to `equipment_systems.id`.
- **Acquisitions pipeline** (IDEA→RESEARCH→APPROVED→BUDGETED→ORDERED→
  RECEIVED→DEPLOYED) — DEFERRED — WAVE 2/3 per brief §13. No schema for
  this exists yet; it was intentionally not started this wave.
- **Recursive composition tree editor** — DEFERRED — WAVE 2+. The schema
  supports arbitrary parent/child nesting (`parentAssetId` self-reference)
  today; the UI only renders one level of nesting cleanly (System detail
  page groups top-level members with their direct children indented). A
  grandchild component would still be linkable/visible via its own detail
  page but would not visually nest under its grandparent on the System
  page.
- **Out of scope, per brief §14, none attempted**: SMART disk telemetry,
  NAS polling, automated device discovery, camera shutter-count
  integration, UPS telemetry, automated/accounting depreciation, ROI
  engine, revenue attribution, Finance transaction sync, invoice OCR,
  barcode/QR, vendor API integration, warranty scraping, replacement
  forecasting, notification engine, elaborate maintenance scheduler.

## No data fabrication

No hardware specifications, purchase prices, serial numbers, warranty
dates, or current values belonging to Emmanuel/RMedia were invented.
Local D1 test fixtures used during the live-rendering check above were
prefixed `[TEST FIXTURE]`, used placeholder numbers, and were deleted
before this wave closed (confirmed via `SELECT COUNT(*)` returning 0 for
both `equipment_assets` and `equipment_systems` afterward). Nothing was
applied to a remote D1 instance at any point.

---

## WAVE 2 — Operator Loop + Maintenance + Acquisitions + Visual Hardening

### Status: implemented, locally verified, NOT deployed, NOT committed

Started from the exact Wave 1 worktree state (same HEAD, same branch, no
unrelated modifications). Wave 1's foundation was preserved and extended,
never redesigned.

### What shipped

- `equipment_maintenance_events` table (8 free fields + id/assetId/
  createdAt/updatedAt), cascade-deleted with its asset. Maintenance
  posture (`OVERDUE`/`DUE_SOON`/`SCHEDULED`/`NONE`) is derived purely from
  the most recent event's `nextInspection` vs. today — `NONE` (no history
  at all) is its own visible state, never rendered as healthy.
- `equipment_acquisitions` table: a restrained, non-accounting pipeline
  (IDEA→RESEARCH→APPROVED→BUDGETED→ORDERED→RECEIVED→DEPLOYED, plus
  CANCELLED). `resultingAssetId` records explicit provenance once
  "Create Asset from Acquisition" is used — never set automatically on
  reaching DEPLOYED.
- Asset Detail rebuilt around the brief's exact hierarchy: an "at a
  glance" strip (Location / Assigned To / Part Of / What's Next) above
  Identity, then Operational Context / Financial Context / History /
  Audit-Notes sections, each with a single job.
- Recorded TCO (`purchasePrice + Σ logged maintenance cost`), shown only
  when purchase price is known, explicitly labeled "recorded, not an
  estimated lifetime cost" — never a projected/depreciated figure.
- Command Center Attention broadened from condition-only to
  `computeAttentionItems`: condition CRITICAL/ATTENTION, overdue/due-soon
  maintenance, and expired warranty, ranked CRITICAL > ATTENTION >
  DUE_SOON, every item listing every reason it's flagged.
- Command Center "Next Acquisitions" section, ranked deterministically
  (priority → requiredBy → age) via `rankAcquisitions` — no AI/ML
  recommendation engine.
- Systems list/detail extended with `computeSystemFinancials` (invested /
  current value / replacement exposure, all three anti-double-count) and
  `summarizeSystemConditions` (worst condition + full count breakdown,
  never averaged into a score).
- Parent-cycle prevention (`wouldCreateParentCycle`): a direct
  self-reference or any transitive cycle is rejected server-side before
  reaching the DB.
- `/equipment/acquisitions` (+ `[id]` detail) route: stage-columns on
  desktop (horizontal scroll, not a heavyweight Kanban board), a flat
  stacked list on mobile; Cancelled acquisitions collapse into a
  `<details>` so they don't compete for attention with the active
  pipeline.
- Migration `0039_tiny_ben_urich.sql`: two new tables, fully additive,
  applied to **local** D1 only. A from-scratch replay of all 40
  migrations (0000–0039) against a wiped local D1 succeeded; `PRAGMA
  foreign_key_check` returned zero violations.

### EQUIP-W2-001 — Visual QA gap persists; same environment constraint as Wave 1, confirmed exhausted

**Severity:** informational / scope note, not a defect.

The Wave 2 brief asked, pointedly, not to claim a visual PASS without
actual browser inspection at 390/768/1024/1440/1920px. That inspection
was attempted again this wave and again blocked: this sandboxed
environment tears down background processes (including a `next dev`
server) at the end of every tool call, so no dev server can stay up long
enough for a separate browser tool to reach it, and no headless-browser
binary can be installed here — both `playwright.azureedge.net` and
`storage.googleapis.com` returned `403 blocked-by-allowlist` when tested
directly this wave. This is the same root cause disclosed as EQUIP-001 in
the Wave 1 section above, now confirmed exhausted rather than merely
suspected: there is no browser-based QA path available inside this
specific execution environment as currently configured.

What WAS verified instead, more thoroughly than Wave 1: every Wave 1 AND
Wave 2 Equipment route (`/equipment`, `/equipment/assets(+[id])`,
`/equipment/systems(+[id])`, `/equipment/acquisitions(+[id])`) returns
HTTP 200 with zero server-side errors against a local D1 seeded with
`[TEST FIXTURE]`-prefixed rows covering every new Wave 2 code path:

- An overdue maintenance event (`nextInspection` in the past) correctly
  produced a `Maintenance Overdue` badge and an `OVERDUE`-severity
  Attention entry.
- An expired `warrantyUntil` correctly added a second, independent
  "Warranty expired" reason to the same asset's Attention entry, without
  ever downgrading or replacing the maintenance reason.
- Recorded TCO rendered as `R$2,150.00` for an asset with `purchasePrice
  = R$2,000` and one `R$150` maintenance event — confirmed against the
  formula by hand.
- `rankAcquisitions` ordered a CRITICAL-priority, no-deadline acquisition
  above a HIGH-priority, dated one in the live-rendered "Next
  Acquisitions" section, matching the documented priority-first rule.
- `computeSystemFinancials`/`summarizeSystemConditions` rendered
  correctly on both the Systems list card and the System detail page for
  a system with one priced parent (NAS) and one unpriced,
  ATTENTION-condition child (HDD) — current value and replacement
  exposure both showed the parent's own figures, not inflated by the
  child.
- The ownership tab correctly excluded RMEDIA-owned attention items when
  filtered to PERSONAL, while the Next Acquisitions section — which has
  no ownership dimension by design — stayed unchanged across tabs.

**DEFERRED — WAVE 3**: a real pixel-level responsive pass, the first time
browser tooling is available to this session. Until then, every new Wave
2 layout (Acquisitions board/list, the rebuilt Asset Detail hierarchy,
the maintenance log modal) reuses Tailwind patterns already used
elsewhere in Equipment or MindBunker at large (the `<details>` disclosure
pattern from `AssetFormModal`, the bottom-sheet modal shape, the
`overflow-x-auto` scroll-column pattern) rather than inventing new
responsive behavior, which lowers but does not eliminate the risk.

### EQUIP-W2-002 — Baseline test/lint state unchanged from Wave 1

Full suite: 735/737 passing. The 2 failures are the exact same
pre-existing, unrelated `owner-pay-bridge.integration.test.mjs` module-
resolution failures documented as EQUIP-002 in the Wave 1 section — still
untouched by any Equipment file, still reproducible in isolation. Lint:
clean except the same pre-existing `ProductivityQuickActions.tsx`
baseline error from Wave 1 (still an untouched file). The
`--ignore-scripts --package-lock=false` local-install caveat from
EQUIP-003 still applies identically this wave.

### EQUIP-W2-003 — Acquisitions have no ownership dimension by design

Not a defect — a deliberate design call worth recording so it isn't
mistaken for an oversight later. The Acquisitions pipeline schema has no
`ownership` column: a considered purchase isn't yet a classified asset,
so the Command Center's [ALL]/[PERSONAL]/[RMEDIA] tabs only filter
Assets/Systems/Attention, never Next Acquisitions. If a future wave finds
operators want to scope the pipeline by intended ownership, that's an
additive nullable column, not a rework.

### EQUIP-W2-004 — Acquisition stage-transition rule is intentionally coarse

The brief left "acquisition stage transitions" underspecified beyond
listing the stages. Wave 2 implements the cheapest rule that still
protects data integrity: DEPLOYED and CANCELLED are terminal (no further
stage change once reached); every other stage can move to any other
non-terminal stage freely, including backward (e.g. BUDGETED → RESEARCH
if a decision is revisited). This was a deliberate choice over building a
full allowed-transition graph, consistent with "restrained, not
procurement accounting." Documented here per the brief's request to
"explain the choice."

### Wave 3 seams (explicitly prepared, not built)

- **Real pixel-level visual QA** — DEFERRED — WAVE 3 (or whenever browser
  tooling first becomes available to this session; see EQUIP-W2-001).
- **Recursive multi-level composition UI** — DEFERRED — WAVE 3, carried
  over unchanged from Wave 1's equivalent note. The schema still supports
  arbitrary depth; the UI still renders only direct parent/children.
- **Maintenance/Acquisition ownership-aware filtering, cost-trend charts,
  or reminders** — DEFERRED — WAVE 3. Nothing beyond what Wave 2 §17
  explicitly listed as out-of-scope was attempted (SMART polling, device
  discovery, telemetry of any kind, depreciation, ROI, Finance sync, OCR,
  barcode/QR, vendor APIs, warranty scraping, forecasting, a
  notifications daemon, or an elaborate maintenance scheduler beyond the
  deterministic OVERDUE/DUE_SOON/NONE states already shipped).

## No data fabrication (Wave 2)

No hardware specifications, purchase prices, serial numbers, warranty
dates, maintenance costs, or acquisition estimates belonging to
Emmanuel/RMedia were invented. All Wave 2 local D1 test fixtures were
prefixed `[TEST FIXTURE]`, used placeholder numbers, and were deleted
before this wave closed — confirmed via `SELECT COUNT(*)` returning 0 for
`equipment_assets`, `equipment_systems`, `equipment_maintenance_events`,
and `equipment_acquisitions` afterward. Nothing was applied to a remote
D1 instance at any point.

---

## WAVE 3 — Hardening + Operator Intelligence + Release Prep

### Status: implemented, locally verified, NOT deployed, NOT committed

Started from the exact Wave 2 worktree (HEAD unchanged across all three
waves). Migrations 0038/0039 untouched, replayed clean twice this wave
(once at preflight, once after functional QA fixture cleanup). No new
migration was added — every Wave 3 addition is a pure derivation from
fields Wave 1/2 already recorded.

### What shipped

- **Command Center (§2)**: the Attention panel now carries a
  severity-colored border (red when any CRITICAL item present, amber for
  ATTENTION-only, neutral otherwise) and an explicit `(N)` count in the
  heading; the empty state reads exactly "No equipment needs attention."
  in a calm emerald tone rather than a generic muted message or a blank
  panel. A new compact Maintenance strip shows overdue count, due-soon
  count, and recorded cost over the trailing 12 months, in the same
  "N overdue / N due soon / RECORDED_COST · 12 months" shape the brief
  specified. Investment by Domain now shows Current Value and
  Replacement Exposure coverage (with valued/countable counts) alongside
  the existing invested total per domain. Section order confirmed:
  Summary, Systems, Attention, Maintenance, Next Acquisitions, Investment
  by Domain, Registry Access.
- **Asset Detail (§3)**: a top-priority red banner now surfaces directly
  under Identity whenever an asset has OVERDUE maintenance or CRITICAL
  condition, stating exactly what needs action (e.g. "Condition: Critical
  · Maintenance overdue by 33 days") -- never buried below Financial
  Context. The "What's Next" at-a-glance tile now also shows the signed
  day count ("33 days overdue" / "12 days until due" / "Due today").
  Financial Context now renders a "Replacement Exposure -- High Context"
  label -- a single-tier fact conjunction, not a score -- only when
  replacement cost, criticality, and condition all independently
  qualify.
- **Systems (§8)**: both the Systems list cards and the System Detail
  page now show a compact, derived Attention summary -- worst condition
  among members plus overdue/due-soon maintenance counts cross-referenced
  from the same per-asset maintenance-status map Command Center uses.
  System Detail additionally shows an explicit "No members need
  attention." banner when clean, matching Command Center's own empty-
  state discipline. No system health score was introduced anywhere.
- **Search / Filter (§10)**: the Asset Registry gained a lightweight,
  deterministic substring search (name, asset code, serial number,
  category, and the asset's system name) via a plain GET form -- no
  client JS required, composes with existing ownership/domain filters --
  plus new Status and Condition filter chip rows. No fuzzy ranking, no
  saved-filter engine, no combinatorial filter builder.
- **core.ts additions**, all pure and unit-tested: `daysUntilIsoDate`
  (signed day count from two recorded/derived ISO dates),
  `computeMaintenanceCommandSummary` (overdue/due-soon counts + trailing-
  365-day recorded cost and event count), `isHighReplacementExposureContext`
  (single-tier boolean fact conjunction), `computeSystemAttentionSummary`
  (per-system worst condition + overdue/due-soon counts, reusing
  `summarizeSystemConditions`), `matchesEquipmentSearch` (case-insensitive
  substring match across the registry's scannable fields), and
  `computeInvestmentByDomain` extended non-destructively with
  `currentValue`/`replacementExposure` `MoneyCoverage` fields alongside
  the pre-existing `coverage` field.
- **Tests**: 23 new tests added to `core.test.mjs` (61 total in that
  file, all passing) covering every function above: 12-month maintenance
  cost aggregation and its window boundary, overdue/due-soon day-count
  sign conventions, the replacement-exposure-context truth table
  (including "unknown replacement cost is never treated as either zero or
  high exposure"), system-level attention summary (including the empty-
  system and no-maintenance-recorded cases), domain investment coverage
  anti-double-counting for the two new fields, and registry search
  matching (including the "a null serial number is not the literal
  string 'null'" unknown-value case).

### EQUIP-W3-001 — Visual QA conclusively proven impossible in this environment (not merely blocked)

**Severity:** informational / scope note, not a defect -- but escalated
from "blocked" (Wave 1/2 framing) to "proven impossible under the
current configuration," because this wave tested the constraint itself
rather than re-attempting the same workaround a third time.

Three independent findings, gathered before any UI work began this wave:

1. `ip addr show` inside this session's execution environment reports
   only the `127.0.0.1/8` loopback interface -- there is no LAN-reachable
   network interface at all, so nothing outside this exact process can
   reach a server bound here even if one could be kept alive.
2. A maximally robust daemonization test was run and observed to fail:
   `setsid bash -c 'trap "" HUP; exec >/tmp/persist_test.log 2>&1 </dev/null; while true; do date >> /tmp/persist_test.log; sleep 2; done' &` followed by `disown -a` -- combining every standard Unix
   technique for surviving a parent's exit (new session via `setsid`,
   ignored `SIGHUP`, closed stdio, `disown`). Checked in the very next
   tool call, only 2 log lines existed; the loop had been killed within
   2-4 seconds. This directly confirms background processes (including a
   `next dev` server) do not survive past the end of the tool call that
   started them, under any technique available from inside the sandbox.
3. The remote-device browser preview tool's own description states
   explicitly that it opens "a fresh browser tab; no dev server on this
   surface" -- confirming independently, from the tool vendor's own
   documentation, that even the one available in-conversation browser
   surface cannot reach a locally-running dev server.

Together these three close off every variant of "start a server, keep it
alive, point a browser at it" available in this specific execution
environment as currently configured. This is not a temporary blocker to
retry in Wave 4 -- it is a structural property of the sandbox that will
reproduce identically unless the environment itself changes (e.g. a
persistent background-process surface, or a browser tool that can reach
this container's loopback). Future waves should not re-attempt this path
without first confirming the environment has changed.

**What was verified instead** (same discipline as EQUIP-W2-001, extended
to every Wave 3 addition): local D1 was seeded with fixtures covering
every new Wave 3 code path -- an ATTENTION-condition, CRITICAL-criticality
asset with an expired warranty (RMedia NAS); a CRITICAL-condition,
PRODUCTION-criticality asset with an OVERDUE maintenance event and an
expired warranty (Mac Mini Edit Bay); a GOOD-condition child asset with a
DUE_SOON maintenance event (NAS HDD#01); and one RESEARCH-stage
acquisition -- then a `next dev` server was started, logged in via
`qa-login`, and every route was fetched with `curl` and the *rendered
HTML* (not just HTTP status) was inspected for the exact expected
strings, all within the one tool call the environment allows:

- Command Center: `Needs Attention (3)` listed all three fixtures with
  the correct, fully-combined reasons (`Condition: Critical · Maintenance
  overdue · Warranty expired` for the Mac Mini; `Condition: Attention ·
  Warranty expired` for the NAS; `Maintenance due soon` for the HDD). The
  Maintenance strip rendered `1 overdue`, `1 due soon`, and `R$650.00
  recorded cost · 12 months (3 events)` -- matching the seeded events'
  costs (R$450 + R$200) by hand. Investment by Domain rendered
  `Current Value R$6,000.00 (1/1 assets valued)` for STORAGE (the priced
  child HDD correctly excluded as a countable asset since its parent NAS
  was in the same list) and `R$9,000.00 (1/1)` for COMPUTE, with matching
  Replacement Exposure lines -- confirming the new domain coverage fields
  inherit the existing anti-double-count discipline correctly in a live
  render, not just in unit tests.
- Asset Detail (Mac Mini, id 3): top banner rendered exactly `Condition:
  Critical · Maintenance overdue by 33 days` (event's `nextInspection` of
  2026-08-01 against a QA run date of 2026-09-03); the What's Next tile
  showed a `Maintenance Overdue` badge plus `33 days overdue`; the
  Replacement Exposure -- High Context label rendered given
  replacementCost=14000, criticality=PRODUCTION, condition=CRITICAL.
- Asset Detail (HDD#01, id 2): What's Next tile showed `12 days until
  due` for a `nextInspection` of 2026-09-15.
- Systems list: the RMedia Editing Suite card rendered `1 maintenance
  overdue · 1 due soon`. Systems Detail (system 1): the new Attention
  banner rendered `Needs attention: 1 maintenance overdue · 1 due soon ·
  2 assets below Good condition`.
- Asset Registry search (`?q=NAS`): header read `2 of 3 assets shown`
  (RMedia NAS + NAS HDD#01 matched; Mac Mini correctly excluded).
  Condition filter (`?condition=CRITICAL`): header read `1 of 3 assets
  shown` (Mac Mini only).
- All 8 routes touched this wave (`/equipment`, `/equipment/assets` with
  and without search/filter params, `/equipment/assets/[id]` x2,
  `/equipment/systems`, `/equipment/systems/[id]`, `/equipment/acquisitions`)
  returned HTTP 200 with no server-side errors in the dev log.

This is real evidence the logic and data plumbing are correct end to end
against live-rendered HTML. It is explicitly NOT a substitute for real
browser QA at 390/768/1024/1440/1920px -- responsive layout, overflow,
touch-target sizing, and modal usability remain unverified by human or
automated visual inspection, and Definition of Done criterion (1) is not
met this wave for that reason.

**DEFERRED again -- WAVE 4 (or whenever this constraint changes)**: real
pixel-level responsive QA. Every Wave 3 layout addition (the top banner,
the Maintenance strip, the search form, the filter chip rows, the
per-system Attention banner) reuses Tailwind patterns already used
elsewhere in Equipment (colored-border alert panels, the existing
domain-progress-bar rows, the existing ownership/domain chip-filter row
pattern) rather than inventing new responsive behavior, for the same
risk-lowering reason given in EQUIP-W2-001 -- but this remains a lowered
risk, not an eliminated one.

### EQUIP-W3-002 — Baseline test/lint/build state

Equipment test file: 61/61 passing (38 carried over from Wave 1/2 + 23
new this wave). Full repo suite: 754/756 passing -- the 2 failures are
the same pre-existing, unrelated `owner-pay-bridge.integration.test.mjs`
module-resolution failures documented as EQUIP-002/EQUIP-W2-002,
reconfirmed this wave to fail identically in isolation (a `tsx`/Node ESM
loader namespace-resolution quirk unrelated to Equipment; that file and
its module were not touched this wave, confirmed via `git status`).
TypeScript: clean. ESLint: clean except the same two pre-existing,
unrelated warnings/error (`ProductivityQuickActions.tsx`, `error.tsx`,
`global-error.tsx`, `FxMonthRatePanel.tsx`) -- none of which are
Equipment files. `next build` and `opennextjs-cloudflare build` both
completed successfully with every Equipment route listed as a dynamic
(`ƒ`) route. `git diff --check` reported no whitespace errors on tracked
changes.

A stale, zero-byte `.git/worktrees/prod-worktree/index.lock` was found in
the worktree at the start of this wave's git-hygiene checks (no `git`
process was running; the lock predates this wave's own work). This
session's file tools cannot delete files on the linked device without an
explicit user-granted permission this wave did not request, since no
Wave 3 work required staging or committing. It does not affect any
read-only git command (`status`, `diff`, `log`) used for this wave's
verification, but it will block the *next* `git add`/`git commit` in
this worktree until removed -- flagged here so a future session or the
user clears it (`rm .git/worktrees/prod-worktree/index.lock`) before
attempting to commit the accumulated Equipment diff.

### Wave 4 seams (explicitly prepared, not built)

Carried forward from Wave 2 §17/§16, unchanged and still not attempted:
SMART / NAS telemetry, UPS telemetry, camera telemetry, device discovery,
QR / barcode labels, Finance linkage, ROI, capability intelligence,
replacement forecasting. Also still deferred: a full allowed-transition
graph for acquisition stages (EQUIP-W2-004's coarse rule was not revisited
since no new operator need surfaced this wave), recursive multi-level
composition UI (Wave 3 §4 allowed "one additional presentation level if
useful" -- the existing one-level indent tree on System Detail and Asset
Detail's Components panel already satisfies the two-levels-max goal
example, so nothing new was built here), and real pixel-level visual QA
(EQUIP-W3-001 above).

## No data fabrication (Wave 3)

No hardware specifications, purchase prices, serial numbers, warranty
dates, maintenance costs, or acquisition estimates belonging to
Emmanuel/RMedia were invented. All Wave 3 local D1 test fixtures used
placeholder numbers and generic labels (e.g. "Mac Mini M2 Edit Bay",
"Backup NAS") and were deleted before this wave closed -- confirmed by
wiping `.wrangler/state/v3/d1` and replaying migrations 0038/0039 clean
into a fresh empty local database as the wave's final step. Nothing was
applied to a remote D1 instance at any point.
