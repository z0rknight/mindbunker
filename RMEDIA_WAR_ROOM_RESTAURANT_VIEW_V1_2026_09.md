# RMEDIA OS — War Room Restaurant View V1
**Date:** 2026-09-14 · **Status: DEPLOYED, live.**

---

## 1. Visual Architecture

DOM/CSS layers only, no Canvas, no game engine, no `requestAnimationFrame`.
`WarRoomRestaurantStage` (`src/app/war-room/restaurant/WarRoomRestaurantStage.tsx`,
client component) fills the exact `position:relative; aspect-ratio:16/9;
overflow:hidden` region War Room had already reserved for this
(`data-testid="war-room-live-stage"` from the 14SEP Patch Sniper wave),
composed of:

- **RoomBackground** — warm/dark plank-floor gradients + a lamp glow, pure
  CSS (`.wr-floor`, `.wr-vignette`, `.wr-lamp-glow` in `globals.css`), no
  reference image baked in (moodboard only, per the mission's own rule).
- **CommandaRail** — top strip, horizontal ticket rail.
- **EditorStation** — center-top, reflects the canonical open Work Session.
- **ClientTables** — up to 8 clickable markers, positioned via a
  presentation-only slot map (`table-layout.ts`), never persisted.
- **ClientDetailPanel** — slide-in side panel on table click.

All ambient motion (`wr-lamp-flicker`, `wr-editor-pulse`,
`wr-ticket-pulse`, live-ring on REVIEW/BLOCKED markers) is cheap CSS
`@keyframes`, guarded by the same `prefers-reduced-motion` pattern already
used elsewhere in `globals.css` — reduced-motion strips every loop to a
static state.

## 2. Data Mapping

One new pure module, `src/modules/war-room/restaurant-core.ts` — computes
nothing new, invents no money, reuses existing canonical reads:

- `selectRestaurantClients` — bounds the table set from `clients` +
  `videoLogs` (already fetched for the execution queue) + blocker IDs +
  last-active-by-client. No new N+1: `videos` and `blockerMap` are the
  exact same objects War Room's queue section already fetched.
- `attachRestaurantCommercials` — sums `billing_allocations` per currency
  per client, reusing `ClientBillingProjectBreakdown` from the Operator
  Project Commercial Attribution wave verbatim.
- `buildRestaurantTickets` — maps open `production_orders` (state=OPEN,
  phase≠DELIVERED) to comanda cards, reusing `deriveProductionOrderPhase`'s
  existing phase vocabulary.
- `buildRestaurantActiveSession` — reflects `getWorkSessionOverview()`'s
  `openSession`/`openSessionElapsedSeconds` directly; starts no second
  timer.
- `buildRestaurantViewModel` — composes the above into one
  `{activeSession, clients, tickets}` projection.

The only new query is `getRestaurantClientCandidates()`
(`src/modules/war-room/data.ts`) — a single unbounded `select id, name,
archivalState from clients`, filtered down to the bounded table set
entirely in the pure layer.

## 3. Client Selection Rule

Candidate pool = clients with ≥1 current `CLIENT_WORK` deliverable
(active/review) **or** a recent Work Session — never the full historical
client list. RMEDIA's own internal client row and GELADEIRA-archived
clients are excluded. Ranking: current active/review work first, then
most-recent activity, then a stable name/id tiebreak — deterministic for
identical input (tested). Bounded to 8 tables.

## 4. Comanda Queue

Sourced from `getProductionOrders()` (existing "LET'S COOK" read model),
filtered to `state=OPEN` and `phase≠DELIVERED`, sorted by urgency
(REVIEW → IN_PRODUCTION → RECEIVED) then received date. No new ticket
entity, no expected-value dollar figure shown on a ticket — comandas
display CLIENT / PROJECT / ITEM COUNT / PHASE only, keeping the stated
`expectedValueCents` (a business expectation, never realized revenue)
out of the visual layer entirely.

## 5. Active Session Behavior

The editor station glows and pulses only when `workSessionOverview.openSession`
is non-null, showing the same client/video/elapsed values NowFocusPanel
already computes — read, never recomputed. Idle state ("EDITOR IDLE") when
no session is open.

## 6. Client Table Interaction

Clicking a table opens a compact side panel covering: client, health
state, current projects, active/review video counts (+ blocked count),
open comandas for that client, confirmed attributable billing per
currency (with minutes, when known), an "unallocated historical billing
exists" flag when applicable, and Open CRM / Open project links. Clicking
the same table again, or the panel's ✕, closes it.

## 7. Commercial Semantics

Money labels are strictly "Confirmed attributable billing" — never
"Revenue," "Total value," or "Total cost." A client with zero canonical
allocations shows **no dollar figure at all** on either the table marker
or the panel (verified: Dave in local QA, who has no billing_evidence,
correctly renders with no `$` anywhere). Unallocated historical evidence
(e.g. Bonnie's January \$75, from the prior wave) is flagged as existing
but not folded into the per-project "confirmed attributable" figure —
exactly the false-total-risk boundary the mission requires.

## 8. Future Sprite Anchors

Table markers are stable, deterministically-keyed elements
(`client.id`-addressed) with a fixed presentation slot from
`table-layout.ts` — a future `clientSpriteUrl` (or equivalent
presentation-only asset) can be layered onto an existing marker without
touching selection or data logic. No such column was added to the
database this wave.

## 9. Performance

Zero new N+1 patterns. `videos` and `blockerMap` are the same objects
already fetched for the execution queue; `getRestaurantClientCandidates`,
`getProductionOrders`, and `getLastActiveByClient` are three flat,
single-purpose queries added to the page's existing `Promise.all`;
commercial attribution is fetched only for the bounded (≤8) selected
client set via one follow-up `Promise.all`, not for every client in the
database. No WebSockets, no new polling — the stage refreshes on War
Room's existing cadence (`WarRoomRefreshControl`).

## 10. Tests

11 new targeted tests in `src/modules/war-room/restaurant-core.test.mjs`:
bounded selection, active/review-work prioritization over idle recency,
internal/GELADEIRA exclusion, deterministic table mapping, blocked-status
override, cross-client commercial isolation, absent-not-`$0` for unknown
attribution, correct multi-row summation, production-order ticket
mapping (bounded, excludes delivered/cancelled/closed), active-session
reflection, and full `buildRestaurantViewModel` composition.

| Gate | Result |
|---|---|
| `git diff --check` | clean |
| Targeted tests (11 new) | pass |
| `npm test` | **1103/1103 pass** |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 errors (3 pre-existing unrelated warnings) |
| `npm run build` | succeeds |
| `rm -rf .next .open-next` + fresh build | succeeds, `basePath: /mindbunker` confirmed |
| `npx opennextjs-cloudflare build` | succeeds |

## 11. Visual QA

Local dev fixture (Taryn Dubreuil, Dave DeMink, Moritz-Alexander Germann,
Regression Test Client) verified live in-browser:

- **1920×1080 / 1440×900 / 1180×820** — stage prominent, no scroll
  required to see it, side panel readable, comanda rail readable, no
  console errors.
- **1024×768** — stage scales, no horizontal overflow.
- **375×812 (mobile)** — panels stack below the stage per the grid's
  existing `xl:` breakpoint; one initial layout issue found and fixed
  (two outer table slots clipped a client name against the stage's own
  `overflow:hidden` edge at this width) — slot map retuned to keep every
  table's `xPct` between 16–84%, re-verified clean afterward, and
  confirmed `document.documentElement.scrollWidth === clientWidth` (no
  page-level horizontal scroll at any width tested).
- Clicked Taryn Dubreuil → panel showed only Taryn's projects/videos/
  comandas/billing; clicked Dave DeMink → panel showed only Dave's,
  correctly BLOCKED (matching Dave's real open client-blocker signal) —
  confirmed no cross-client leakage.
- Existing War Room controls (LET'S COOK CTA, refresh control, Active
  Signals, Decisions, Daily Ledger, collapsed BI section) all still
  present and functional, unchanged.
- One transient dev-server `ReferenceError` was observed once mid-edit
  (a stale Turbopack HMR artifact from a concurrent file save) and did
  not recur on any subsequent fresh navigation — confirmed non-issue.

## 12. Deploy

| | |
|---|---|
| Pre-deploy Operator version | `b0c2bf37-8e73-4987-b51b-7c4dbbfd89b1` |
| **New Operator version** | **`c896a5dd-b405-492c-a7f6-dd92f91b27d5`** |
| Traffic | 100% |
| Client Worker | **not touched, not redeployed** |

## 13. Live Smoke

`wrangler tail` live during checks — `/mindbunker`, `/mindbunker/war-room`,
`/mindbunker/crm`, `/mindbunker/projects`, `/mindbunker/productivity` all
returned `Ok` (redirecting to `/mindbunker/login`, correctly gated —
production credentials weren't available for authenticated verification,
consistent with every prior wave's limitation). Zero `exceededCpu`, zero
`exceededResources`, zero 500s.

## 14. Remaining Art Work

- No client character sprites (explicitly deferred, per the mission).
- No animated dishes/video-item sprites on tables (explicitly deferred).
- Table markers currently render as plain bordered cards, not pixel-art
  furniture shapes — the mission's own §4 explicitly deprioritizes
  elaborate CSS art in favor of a replaceable, working visual
  architecture, which is what shipped.
- Authenticated production verification of the real Bonnie/Taryn dollar
  figures rendering inside the actual restaurant stage was not performed
  (no safe production credentials) — local QA fixture verification stands
  in, same limitation pattern as prior waves.

---

## Final Structured Output

```
RESTAURANT STAGE:     GREEN
CLIENT TABLES:        GREEN
TABLE INTERACTION:    GREEN
COMANDA QUEUE:        GREEN
ACTIVE SESSION:       GREEN
COMMERCIAL VALUES:    GREEN
CLIENT ISOLATION:     GREEN
RESPONSIVE:           GREEN

TESTS: 1103/1103
MIGRATIONS: NONE
D1 MUTATION: NONE
CLIENT DEPLOY: NONE
OPERATOR DEPLOY: c896a5dd-b405-492c-a7f6-dd92f91b27d5
ROLLBACK: NOT REQUIRED
```

**FINAL VERDICT:**

**GREEN — RESTAURANT VIEW V1 LIVE.** The War Room's reserved 16:9 stage is
now a working, clickable restaurant floor grounded entirely in existing
canonical data — clients as tables, open Production Orders as the comanda
rail, the real Work Session as the editor station — with no schema
change, no fabricated money, and no cross-client leakage.

STOP.
