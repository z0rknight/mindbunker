# RMEDIA OS — Spatial UI / Sidecar Blueprint

Source date: 2026-09  
Visual authority: `~/Desktop/Scanned Document.pdf` (three hand-drawn pages)  
Scope: spatial recomposition only; no implementation, migration, deployment, or new product model

## 1. Executive interpretation

The drawings describe one operating system seen at three distances:

- **CRM is relationship context:** one client, the work currently attached to that relationship, a concise dossier, and explicit control over what the client sees.
- **Dashboard is personal context:** a quiet summary of the operator's present reality, recent evidence, and momentum—not a second War Room.
- **War Room is live execution context:** a landscape, no-scroll kitchen display for the editing bay, where the active session, current orders, immediate queue, notes, and a few commands can be understood in seconds.

The change is primarily composition. Existing canonical data and actions already cover nearly every rectangle. The implementation should extract bounded projections from current read models and place them according to frequency, urgency, and operator attention. It must not resurrect the dense, duplicated surfaces removed by House Cleaning Wave 2.

The governing distinction is:

- **COMANDA:** what has been ordered and what must move next.
- **CAIXA:** relationship and commercial truth, without mixing currencies or inventing attribution.
- **SIDECAR:** a glanceable operational surface beside the editing machine.

## 2. Current production/source reality

Accepted source and production baseline supplied for this blueprint:

| Fact | Accepted value |
|---|---|
| Source commit / `production/current` | `0de8a93d2ca88f3cbd3665a6e3ff7b08cba67079` |
| Operator Worker | `cf8b54bc-d0ce-42ad-ad74-acbcfb4af81b` |
| Client Worker | `b9d0e462-3838-40e2-b543-d62dc44c2b9a` |
| D1 migration head | `0049_certain_frog_thor.sql` |
| Repository inspected | `mindbunker-video-workspace-hotfix` |
| Worktree at discovery start | clean |

The source already has distinct canonical surfaces and models for clients, projects, videos, production orders, work sessions, commitments, blockers, captures, decisions, finance, health, and portal presentation controls. The blueprint does not require a schema change.

Important existing boundaries to preserve:

- `Client → Project → Video → Work Session` remains the canonical attribution graph.
- `production_orders` are batch/comanda records; their deliverable videos remain canonical video entities.
- Work Sessions are intentional work facts; the War Room must not create another timer.
- Finance remains currency-safe and independent from inferred commercial attribution.
- Client portal controls remain explicit capabilities and presentation visibility flags, not a page-builder.
- Productivity remains the place to manage the complete production state; War Room only projects the current slice.

## 3. Page 1 visual interpretation — CRM

Page 1 makes the relationship legible by giving most area to current work, not metadata. The portrait/profile presence anchors identity; the center answers “what am I doing for this client?”; the right rail answers “what must I remember or do next?”; the lower manager answers “what can the client see?”

```text
┌──────────────┬──────────────────────────────────────┬──────────────────┐
│  PORTRAIT    │  PROJECTS / ACTIVE JOBS              │ OPERATIONAL      │
│  identity    │                                      │ DOSSIER          │
│              │  ┌──────────┐ ┌──────────┐           │ relationship     │
│ MENU /       │  │ project  │ │ project  │           │ next action      │
│ QUICK LINKS  │  │ cover +  │ │ cover +  │           │ last contact     │
│              │  │ active   │ │ queue    │           │ commercial mode  │
│ small,       │  │ videos   │ │ context  │           │ portal state     │
│ contextual   │  └──────────┘ └──────────┘           │                  │
├──────────────┴──────────────┬──────────────┬─────────┴──────────────────┤
│ ACTIVE PROJECTS             │ COMPLETED    │ TRACKED TIME / REVENUE     │
│ compact fact                │ VIDEOS       │ currency-safe facts         │
├─────────────────────────────┴──────────────┴────────────────────────────┤
│ CLIENT DASHBOARD MANAGER — WHAT THIS CLIENT SEES                       │
│ [portal access] [capabilities] [visible section map / restrained preview]│
└─────────────────────────────────────────────────────────────────────────┘
```

This is a spatial recomposition of `/crm/[id]`, not a new route and not a second Productivity page.

## 4. CRM spatial hierarchy

Desktop hierarchy:

1. **Identity rail, 16–18% width:** avatar/default cover, relationship status, and at most four contextual links/actions.
2. **Active Jobs center, 55–60% width:** active/review projects, each containing only its current or next few deliverables.
3. **Operational Dossier, 24–28% width:** four to seven durable facts; next action receives strongest emphasis.
4. **Metric strip:** three or four derived, client-specific facts; no health data.
5. **Client Dashboard Manager:** a visibly separate “external view” zone with portal access, capabilities, and section visibility.
6. **Progressive disclosure below:** opportunity/briefing, custody, quotes, payments, historical intelligence, and event history remain reachable but do not compete with current work.

On small screens, the order becomes identity → next action → active jobs → compact facts → client-view manager → disclosed history. The right rail becomes an early full-width card, not a narrow column.

## 5. Exact existing CRM data/components mapped to each region

| Region | Existing component/read model/action/data | Reuse decision |
|---|---|---|
| Identity | `/src/app/crm/[id]/page.tsx`; client row from `getAdminGatewayWorkspace`; `instagramProfilePictureUrl`; `defaultCoverUrl`; `status`; `source` | Presentation change; no new data |
| Left shortcuts | Existing links to preview, projects, portal login, Instagram refresh, and existing client actions | Curate to max four; do not duplicate full menus |
| Active Jobs | `getProjectsForClient`; `ProjectManager`; project covers; video status/cover/priority; project workspace links | New bounded presentation component over existing result |
| Dossier | `ClientOperationalDossier`; `getClientIntelligence`; opportunity fields; portal access state | Recompose existing facts; keep one canonical calculation |
| Metric strip | `getClientIntelligence`: total/active projects, in-progress/completed videos, tracked seconds, revisions; revenue grouped by currency | New compact presentation only |
| Dashboard Manager | `ClientTabs`; `PortalAccessPanel`; `PortalControl`; `setClientPortalCapability`; `setClientDashboardSection`; `/crm/[id]/preview` | Reuse actions as-is; presentation change and mini section map |
| Commercial/history disclosure | `QuotePanel`, `PaymentRequestPanel`, `ChainOfCustodyPanel`, `ClientCommercialValuePanel`, activity/history details | Keep below fold/collapsed; do not move permanently into dossier |

No server action should be called merely to render the composition. Existing mutations remain attached to their current explicit controls.

## 6. CRM Operational Dossier proposed contents

Permanent right-rail facts, in order:

1. **Next action + due date** — `clients.nextAction`, `clients.nextActionDate`; primary fact and only dominant action cue.
2. **Relationship state** — `clients.status` (`lead`, `active`, `inactive`) and, for leads only, the current opportunity stage.
3. **Last interaction** — `clients.lastInteractionAt`; display “No interaction recorded” honestly when absent.
4. **Commercial relationship** — restrained summary of existing contract/quote context. Currency must remain explicit; no cross-currency total and no invented realized attribution.
5. **Portal state** — persistent login active/not configured plus Vault/Gateway availability, without exposing credentials.
6. **Recent operational note** — only when an existing recent video-memory note is present; truncate visually and link to its video. Absence should not create a blank permanent panel.

Active project count, current production count, tracked hours, and revenue belong in the center/metric strip; repeating them in the dossier would spend space twice. Chain of Custody, full client intelligence, briefing, and complete history stay in progressive disclosure.

**Density contract:** one highlighted next action, up to five supporting facts, one contextual “edit relationship” action. No graphs, tables, or scrolling inside the rail.

## 7. CRM Active Jobs proposed contents

The center should show **project cards containing a small active-video queue**.

Why this wins over the alternatives:

- Project-only cards do not answer which deliverable is moving now.
- A flat video wall turns CRM into another Productivity and loses project context.
- Project cards with a bounded queue preserve Projects as the canonical container while answering the operator's immediate question.

Each active/review project card should contain:

- project cover, name, status, deadline;
- progress derived from deliverable videos (`DONE / total`), excluding operational containers/cancelled items according to existing helpers;
- current video chosen by the existing current-work/queue semantics;
- at most two following video rows with lifecycle badges;
- batch/comanda label when a linked `production_order` exists;
- one primary action: open Project; video title links may open the existing Video Workspace.

Sort active/review first by exception (overdue/blocked), then active work/priority, then recent activity. Planned and completed projects remain collapsed or below the dominant active area. Never persist counters that can be derived from project videos.

## 8. Client Dashboard Manager interpretation

This lower area is an external-view control plane, not a page builder. It should visually separate three concepts:

1. **Access:** login enabled, reset/revoke, and open client login/preview.
2. **Capabilities:** Financial summary, Review actions, Priority request.
3. **Visible sections:** Current account, Search, Summary, Active work, Recent deliveries, Completed by type, Video library.

Recommended presentation: a restrained client-dashboard silhouette containing named section tiles. Visible tiles appear solid; hidden tiles appear outlined/dimmed. Selecting a tile uses the existing `PortalControl` mutation. A “Preview client view” action opens the existing preview route. The visualization is fixed to the real portal sections; it must not support arbitrary layout, dragging, resizing, or new content blocks.

Primary fact: what the client currently sees.  
Secondary fact: access/capability status.  
Primary action: preview client view.  
Maximum density: ten known toggles grouped in three zones, with no database terminology in the visible copy.

## 9. Page 2 visual interpretation — Dashboard

Page 2 is a personal operating HUD with a large “state of the operator/business now” region, a single contextual band, and two quiet evidence zones below. It is deliberately less dense than the current Dashboard.

```text
┌───────────────────────────────────────────────────────────────────────┐
│ identity/context        AS IT IS — CURRENT OPERATIONAL STATE         │
│ avatar / current mode   current session or next executable work      │
│                         active project context / concise cover         │
├───────────────────────────────────────────────────────────────────────┤
│ ONE CONTEXT STRIP: urgent promise · attention item · quick capture    │
├───────────────────────────────┬───────────────────────┬───────────────┤
│ LEGACY / RECENT EVIDENCE      │ CURRENT OBSERVED      │ STREAKS       │
│ a small recent-history door   │ hours · output · cash │ project days  │
│ not a history dump            │ few truthful facts    │ max 3         │
└───────────────────────────────┴───────────────────────┴───────────────┘
```

“Legacy / old data” is best treated as a small door into recent evidence/history, not a permanent feed or restoration of All History to primary navigation.

## 10. Meaning of "Assets"

### Best interpretation

The handwriting in the scan appears more likely to read **“AS IT IS”** than “ASSETS.” In product terms, the strongest interpretation is **current operational context**: the honest present state of Emmanuel's work, capacity, and immediate next move.

### Evidence

- The surrounding shapes behave like identity/context anchors rather than equipment thumbnails or balance-sheet categories.
- The lower regions already separate historical evidence, current observed numbers, and streaks.
- Literal equipment assets already have a dedicated `/equipment` surface; project media assets live inside Projects.
- Finance already owns cash context. Moving either into the Dashboard's dominant region would reverse House Cleaning.
- The present Dashboard already has the correct candidates for an “as it is” projection: current open Work Session, recommended next executable video, urgent commitment, a bounded attention summary, and project streaks.

### Ambiguity requiring one Emmanuel decision

Confirm the handwritten phrase: **is it “AS IT IS” or “ASSETS”?**

Until confirmed, implementation must use the “current operational state” interpretation and must not create an asset registry, equipment gallery, or financial-assets panel. If Emmanuel confirms literal “Assets,” a second design clarification is required because three different existing domains could qualify; the blueprint should not silently choose among them.

## 11. Dashboard target hierarchy

1. **Current operational state:** open Work Session if present; otherwise the existing recommended next executable video/project. This is the dominant card.
2. **One context strip:** highest-ranked urgent commitment or attention fact plus one Quick Capture entry point. Never show both a large urgent card and a duplicated attention list.
3. **Current observed numbers:** maximum four facts: intentional time today, completed videos today, income today grouped by currency, and current client/internal split. A missing fact displays absence, not zero certainty.
4. **Streaks:** existing project streaks, max three; no “Elite” labels or confidence theater.
5. **Recent evidence / legacy door:** a compact link to Sessions/All History context, not rows of historical data.
6. **Health:** at most one capacity cue (for example last recorded sleep) when it changes today's operating context; full health remains on Health.

The existing Quick Actions grid can become a single Quick Capture/Log entry plus at most two high-frequency shortcuts on desktop. Mobile may retain capture priority, but it should not put every domain action on the Dashboard.

## 12. Page 3 visual interpretation — War Room

Page 3 is a kitchen display system for a solo editing bay. It must privilege the currently cooked item, current comandas, next dishes, and exceptional conditions. Historical BI stays outside the primary viewport.

```text
┌──────────────────┬──────────────────────────────────┬──────────────────┐
│ TODAY            │ ACTIVE SESSION                   │ BATCHES          │
│ 3–5 facts        │ video · client/project · timer   │ max 3 comandas   │
│                  │ [Stop]                           │ progress/risk    │
├──────────────────┼──────────────────────────────────┼──────────────────┤
│ QUICK NOTES      │                                  │ VIDEOS / QUEUE   │
│ scratch inbox    │ RESTAURANT PIXEL VIEW            │ current + next   │
│ max 3 recent     │ tables = projects/client context │ review/blocked   │
│                  │ tickets = batches                │ max 5 rows       │
│                  │ dishes = videos                  │                  │
├──────────────────┼────────────────────┬─────────────┼──────────────────┤
│ COMMAND          │ SESSION / POMODORO │ DAY STREAKS │ PROJECT / QUEUE  │
│ 3–4 actions      │ truthful timer     │ max 3       │ contextual link  │
└──────────────────┴────────────────────┴─────────────┴──────────────────┘
```

The center is not decoration. It is an alternate spatial projection of the same active projects, production orders, videos, and Work Session already shown in text around it.

## 13. War Room 16:9 spatial grid

Use a 12-column, three-row CSS grid in sidecar mode:

- **Row 1 (22%):** Today columns 1–3; Active Session columns 4–9; Batches columns 10–12.
- **Row 2 (53%):** Quick Notes columns 1–3; Restaurant View columns 4–9; Videos/Queue columns 10–12.
- **Row 3 (25%):** Command columns 1–3; session clock/Pomodoro columns 4–6; streaks columns 7–9; project/queue context columns 10–12.

The actual available height subtracts a compact 48–56px sidecar header. Panels use `minmax(0, ...)`, internal line clamping, and bounded lists. The center owns the most visual area; Active Session is the strongest factual block.

## 14. War Room no-scroll rule

In landscape sidecar mode at 1920×1080, 1440×900, 1180×820, and 1024×768:

- the sidecar root is exactly `100dvh` with `overflow: hidden`;
- no primary grid region creates page-level vertical scroll;
- lists enforce explicit item caps and an “Open …” link to their specialist route;
- detailed commitments, decisions, signals, notes, sessions, and analytics open in a drawer/modal or existing route;
- historical analytics do not render in the primary sidecar DOM;
- internal panel scrolling is avoided; if unavoidable at 1024×768, only a user-opened drawer may scroll.

Standard `/war-room` may retain its current scrollable report mode until the spatial recomposition deliberately replaces it. Sidecar mode itself must satisfy the hard rule.

## 15. Today panel specification

Primary fact: intentional Work Session time today.  
Secondary facts: completed deliverables today; nearest deadline risk; income today by separate currency.  
Primary action: open Sessions or the relevant commitment, not an inline analytics editor.  
Maximum density: one large duration plus three short rows.

Canonical sources:

- `getTodayWorkSessionStats()` for time and client/internal split;
- `getDailyLedger(1)` for delivered evidence and deadline facts;
- `getTodayIncomeByCurrency()` for currency-safe income;
- ranked open commitments for the one nearest risk.

Do not show a score, classification, growth percentage, or cross-currency total.

## 16. Active Session specification

Primary fact: current video/title and elapsed time.  
Secondary facts: client, project, activity type, device, stale state.  
Primary action: Stop; when no session exists, Start Work.  
Maximum density: one identity line, one timer, two context lines, one button.

Use `getWorkSessionOverview()` and the existing `NowFocusPanel`/Work Session actions. The server-provided `startedAt` remains truth; a client clock may animate elapsed presentation without writing every second. Opening or stopping a session must use the existing global-one-open-session invariant. No War Room timer table or duplicate lifecycle exists.

## 17. Batches specification

Primary fact: production-order label and phase.  
Secondary facts: client/project, done/active item counts, risk/deadline when already derivable.  
Primary action: open the existing LET'S COOK order detail.  
Maximum density: three open batches, each with two numeric facts and one status badge.

Use `getProductionOrders()` and filter `state === OPEN`. Its existing read model already exposes phase, client, project, active/done/cancelled counts, expected value/currency, and contract label. The sidecar should not reproduce order creation, billing allocation, item editing, or close/cancel controls.

## 18. Videos / Queue specification

Primary fact: next executable video.  
Secondary facts: lifecycle, client/project, blocker/review state.  
Primary action: open Video Workspace; one compact “Start” action is acceptable only through the existing Work Session mutation.  
Maximum density: one current/next highlight plus four rows.

Use `getAllVideoLogs()`, `getOpenBlockersByVideo()`, `getSoonestOpenCommitmentByVideo()`, `selectExecutionQueue()`, `selectNextExecutable()`, and `getVideoNextAction()`. Keep full stage grids, bulk controls, filters, reorder tooling, and complete queues in Productivity.

## 19. Quick Notes specification

The current generic `captures` infrastructure is the closest canonical scratch-pad primitive. It accepts low-ceremony Lead, Client, Internal, and Admin context without forcing Client/Project/Video attribution, has unresolved/resolved/archive semantics, and already supports an Inbox.

Recommended first spatial version:

- one single-line or compact two-line input opening the existing Capture flow;
- default context `INTERNAL` or require one quick context choice, using the existing `createCapture` action;
- show at most three recent unresolved captures from a bounded read projection;
- “Open Inbox” links to `/productivity/captures`.

Do not use `video.note_added` for a generic scratch note because that requires a video and writes permanent operational memory. Do not create another notes table. A faster inline capture form may be a **presentation-only interaction over the existing Capture action**, but its default context/copy should be explicitly confirmed in implementation review.

Primary fact: most recent unresolved note/capture.  
Secondary fact: age/context.  
Primary action: capture.  
Maximum density: input + three rows.

## 20. Command specification

Permanent commands should be limited to:

1. Start Work / Stop Work (context-sensitive, never both competing visually).
2. Quick Capture.
3. Open or clear a blocker for the active video when applicable.
4. Mark Ready for Review or Finished only when it is the valid next lifecycle action and confirmation semantics remain intact.

All commands must call existing actions and preserve server-side validation. Deadline creation, revisions, follow-up, backfill, queue reorder, finance, health, and order administration stay behind Quick Capture or specialist routes.

Primary fact: the currently valid action.  
Secondary fact: why it is valid.  
Primary action: exactly one dominant button.  
Maximum density: four buttons, only one visually primary.

## 21. Pomodoro / Streak specification

**Streaks can ship from existing data:** `getProjectStreaks(3)` derives consecutive project work days from closed Work Sessions. Show max three, using factual language such as “3 working days,” without gamified performance rank.

**Pomodoro is not canonical today.** Recommendation: **B — defer it** from the first spatial implementation. The active Work Session elapsed clock already occupies the truthful time role. If real operator QA later proves a focus countdown useful, implement it as an explicitly separate, ephemeral local UI timer; never persist it as a Work Session, never mutate lifecycle, and never infer productivity from it.

Primary fact: active-session elapsed time or top project streak.  
Secondary fact: today/yesterday activity.  
Primary action: open Sessions; no streak maintenance action.  
Maximum density: one clock plus three streak rows.

## 22. Restaurant Pixel View specification

Smallest useful first version:

- **Tables:** up to three active/review projects, labeled by project with client context.
- **Tickets:** linked open production orders/batches, shown as small comanda markers.
- **Dishes/plates:** aggregate deliverable video states on the table (`in flight`, `review`, `done`), not one sprite for every historical video.
- **Character/action marker:** the table/video currently receiving the open Work Session.
- **Problem marker:** existing blocker or overdue commitment.
- **Pass/exit marker:** DONE/delivered count, subordinate to unfinished work.

Selection is derived from the same queue and project data as the text panels. Clicking/tapping a table opens Project Workspace; clicking an explicitly represented active dish opens Video Workspace. No drag/drop, pathfinding, XP, inventory, animation state, or simulated restaurant economy.

Accessibility: the map must have an equivalent concise text summary and meaningful link labels. Color/sprite alone cannot encode lifecycle or risk.

## 23. Canonical data source for every region

| Surface / region | Read source | Canonical entities | Mutation source |
|---|---|---|---|
| CRM identity/dossier | `getAdminGatewayWorkspace`, `getClientIntelligence`, client row | `clients`, `commercial_contracts`, `quotes`, `transactions` | existing CRM/Gateway/portal actions |
| CRM active jobs | `getProjectsForClient` plus existing video fields | `projects`, `video_logs`, `production_orders` | existing Project/Video actions |
| CRM portal manager | client portal flags and preview | `clients` portal capability/layout columns | `setClientPortalCapability`, `setClientDashboardSection`, access actions |
| Dashboard current state | `getWorkSessionOverview`, execution queue selectors | `work_sessions`, `video_logs`, `projects`, `clients` | existing Work Session actions |
| Dashboard attention | `getDashboardOperatorIntelligence`, ranked commitments | canonical commitments/blockers/captures/clients | link to owner surface; existing actions only |
| Dashboard observed facts | `getTodayWorkSessionStats`, `getTodayIncomeByCurrency`, `getDailyLedger(1)` | sessions, videos, transactions | none in fact tiles |
| War Room Today | same bounded today sources | sessions, videos, commitments, transactions | none except navigation |
| War Room Active Session | `getWorkSessionOverview` | `work_sessions` → video/project/client | existing Start/Stop actions |
| War Room Batches | `getProductionOrders` | `production_orders`, `video_logs` | order detail owns mutations |
| War Room Queue | video list + blocker/commitment maps + queue selectors | `video_logs`, blockers, commitments | existing lifecycle/session actions |
| War Room Notes | new bounded `getUnresolvedCaptures(limit)` projection | `captures` | existing `createCapture`; Inbox owns resolution |
| War Room Streaks | `getProjectStreaks(3)` | closed Work Sessions joined through video/project | none |
| Restaurant view | composed bounded projection from projects/orders/videos/open session | no new entity | navigation only |

The implementation should create a page-level sidecar read model that coordinates these existing calls and caps results server-side. It should not copy SQL into presentation components.

## 24. Existing components reusable as-is

- `WarRoomRefreshControl` — retain its visibility-aware 30-second refresh and explicit São Paulo timestamp formatting.
- `PixelIcon`, `PixelDivider`, existing cover resolution helpers, status badges.
- `ActiveCommitmentCard` inside a detail drawer or linked specialist view, not repeated wholesale in the compact grid.
- `PortalControl` mutations and accessibility behavior.
- `PortalAccessPanel` behavior, though its outer layout should be embedded in the new manager region.
- Existing Start/Stop Work Session server actions and global invariant.
- Existing Video/Project workspace routes and safe link helpers.
- Existing queue/core selectors, production-order phase/count helpers, currency formatters, and date helpers.
- Existing `QuickCaptureProvider` and global keyboard trigger in normal shell mode.

“As-is” refers to behavior and logic; compact sidecar presentation may wrap these components rather than copy them.

## 25. Existing components reusable with presentation changes

- `ClientOperationalDossier` → narrow prioritized rail with fewer non-duplicated facts.
- `ProjectManager`/Project cards → client-scoped Active Job cards with a bounded nested video queue.
- `ClientTabs` portal-control blocks → visual Client Dashboard Manager section map.
- `NowFocusPanel` → compact/dominant Active Session panel suited to fixed height.
- `ExecutionQueueSection`/Productivity video cards → read-only compact queue rows.
- Production order list cards → three-row Batch Stack.
- Dashboard Today/Momentum blocks → four factual cells and max-three streak strip.
- Quick Capture → small command entry and capture-specific scratch input.
- Current War Room commitment/signal/decision sections → concise counts/one urgent item plus drawer or specialist links.

Presentation changes must call the same core/read/action functions rather than fork their business logic.

## 26. New presentation-only components needed

Names should follow existing component conventions; recommended boundaries:

| Component | Runtime | Data/mutation | Refresh | Responsive role |
|---|---|---|---|---|
| `WarRoomSidecarShell` | Client shell around Server content | mode toggle only; no business write | parent refresh | 12-col landscape; priority stack portrait |
| `WarRoomTodayPanel` | Server | bounded today projection; read-only | 30s parent | compact facts |
| `WarRoomActiveSessionPanel` | mixed | existing session data/actions; client elapsed clock | 1s visual clock, 30s server refresh | dominant everywhere |
| `WarRoomBatchStack` | Server | `getProductionOrders`; navigation only | 30s parent | max 3 / max 2 narrow |
| `WarRoomRestaurantView` | Server-rendered data + minimal client links | composed bounded projection; no mutation | 30s parent | hidden/replaced by text summary on phone |
| `WarRoomQueuePanel` | Server, existing action islands where needed | existing queue selectors/actions | 30s parent | max 5 / max 3 narrow |
| `WarRoomQuickCapturePanel` | Client action island | existing `createCapture` | refresh after success | input collapses to button on phone |
| `WarRoomCommandDock` | Client action islands | existing validated actions | action-triggered refresh | 4 max |
| `WarRoomStreakStrip` | Server | `getProjectStreaks(3)` | 30s parent | row or chips |
| `ClientActiveJobsPanel` | Server + link/actions islands | existing client-project/video projection | request-time | center grid → stack |
| `ClientPortalMap` | Client | existing portal flags/actions | action refresh | fixed section map → grouped list |
| `DashboardCurrentState` | Server + session action island | existing state/queue | request-time | dominant card |

No new domain module is required. A small page-level view-model function is acceptable where it only composes and bounds existing domain results.

## 27. Any genuine missing product features

Only two gaps are genuine, and neither blocks the first spatial wave:

1. **Pomodoro countdown:** absent. Defer; if later justified, keep ephemeral and local to presentation.
2. **Inline generic War Room scratch capture:** the canonical Capture entity/action exists, but the current modal interaction is more ceremonial than the sketch. A compact input is a new interaction over existing data, not a new domain feature. It requires copy/default-context review, not schema work.

The “Assets” interpretation is a design-decision gap, not a product-feature gap. The restaurant view itself is a visualization, not a new feature or entity.

## 28. Responsive behavior: 1920, 1440, 1180, 1024, tablet portrait, phone

### 1920×1080

- War Room uses the full 12-column grid with 20–24px gaps, three batches, five queue rows, three project tables, and visible text labels.
- CRM uses 2/7/3 approximate columns plus full-width metric/portal regions.
- Dashboard uses dominant state area with three lower zones.

### 1440×900

- Same topology with 16px gaps, slightly shorter labels, three batches, four queue rows, max three tables.
- This is the primary design target and screenshot baseline.

### 1180×820

- Same topology; side rails narrow, supporting copy disappears, typography and covers step down.
- Restaurant view keeps project/table labels but reduces decorative sprites.
- Queue max drops to three rows; Batches max two plus count.

### 1024×768

- Same no-scroll landscape topology with compact 12px content type, 44px minimum interactive targets, two batches, three queue rows, two tables plus overflow count.
- Secondary labels become tooltips/accessible names, not hover-only facts.
- Header is 48px and analytics/history remain absent from DOM.

### Tablet portrait — 768×1024

- War Room becomes a prioritized scrollable stack: Active Session → Today/Command → Queue → Batches → Restaurant text/map → Notes → Streaks. No claim of 16:9 no-scroll.
- CRM becomes identity+dossier, Active Jobs, facts, portal manager, disclosures.
- Dashboard becomes state, context strip, observed facts, streaks, recent-evidence door.

### Phone — 390×844

- Do not preserve the restaurant map. Render the equivalent textual “Now / Next / Waiting” summary.
- Primary actions are full-width or paired at most two per row; minimum 44×44px touch target.
- Active Session and Stop remain above the fold; Quick Capture stays reachable via the existing global mobile affordance.
- Batches and queue show max two rows plus route link.
- CRM prioritizes next action and active jobs; portal layout controls become grouped lists below work context.

## 29. Sidecar/fullscreen mode architecture

Use an explicit application mode, recommended route: `/war-room/sidecar`.

- Add it to `classifyAppShellRoute` as a private **chrome-less operator route**, distinct from public/bare routes. It still passes the same authentication boundary; only AppShell presentation changes.
- The route can share a `getWarRoomSidecarModel()` composition and panel components with normal `/war-room`.
- The normal War Room gets an explicit “Open Sidecar” link; sidecar gets “Exit sidecar.”
- Use CSS `100dvh`, not automatic browser Fullscreen API. Optionally offer a separate user-triggered browser-fullscreen button later, but it is not required.
- Preserve the root base path and existing Cloudflare routing. No new Worker, API, or middleware rule.
- Avoid query-parameter-only shell classification: path-based mode is easier to test, link, recover, and classify without teaching AppShell to parse search state.

Security requirement: “bare/chrome-less” must never mean public. Authentication stays server-side and identical to other operator routes.

## 30. Refresh strategy

- One coordinated route refresh every 30 seconds while the document is visible, reusing `WarRoomRefreshControl` behavior.
- Refresh immediately on visibility return and after successful business mutations.
- Active elapsed time animates locally once per second from server `startedAt`; it does not poll or write.
- Today, active session truth, batches, queue, notes, and streaks refresh together.
- CRM and Dashboard remain request/action refreshed; they do not need persistent polling.
- No WebSockets, Durable Objects, server-sent events, or independent per-panel timers.
- Guard against overlapping refreshes and preserve explicit `America/Sao_Paulo` formatting to prevent hydration drift.

## 31. Performance budget

For the sidecar primary viewport:

- one server composition request with bounded parallel reads;
- one 30-second coordinated refresh loop;
- one 1-second in-memory elapsed-clock update only when a session is active;
- no more than ~250 meaningful DOM elements in the primary view;
- max 3 project tables, 3 batches, 5 queue rows, 3 notes, 3 streaks;
- max 8 visible raster images/covers; lazy-load noncritical images and size them explicitly;
- target initial transferred page assets under 500KB excluding cached framework chunks and under 1MB of newly decoded imagery;
- no unbounded history, full project/video arrays, hidden analytics trees, or off-screen galleries in sidecar DOM;
- no layout shift from covers, timers, or status changes; all regions have reserved dimensions;
- no new dependency for pixel rendering; use CSS/current pixel primitives.

Implementation QA should sample idle CPU/memory over a 30-minute open sidecar session and inspect query count per refresh. A steady sidecar must not accumulate intervals, event listeners, or DOM nodes.

## 32. Interaction density limits

| Region | Primary fact | Secondary fact | Primary action | Maximum density |
|---|---|---|---|---|
| CRM Identity | client identity | relationship status | edit/open profile action | 4 shortcuts |
| CRM Active Jobs | current project/video | progress/deadline | open Project | 3 projects × 3 video rows |
| CRM Dossier | next action | 5 durable facts | edit relationship | 6 facts, 1 action |
| Portal Manager | what client sees | access/capabilities | preview | 10 fixed controls in 3 groups |
| Dashboard State | active/next work | client/project | Start/Stop/Open | 1 dominant item |
| Dashboard Context | urgent fact | reason/due | open owner surface | 1 alert + 1 capture |
| Today | time today | output/risk/cash | open detail | 4 facts |
| Active Session | current video + timer | context/activity | Stop/Start | 1 primary button |
| Batches | order + phase | progress/client | open order | 3 cards |
| Queue | next video | state/risk | open/start | 5 rows |
| Quick Notes | newest capture | context/age | capture | input + 3 rows |
| Command | valid next operation | short reason | current dominant action | 4 buttons |
| Streaks | project day streak | active today/yesterday | open Sessions | 3 rows |
| Restaurant | active project tables | ticket/dish state | open Project/Video | 3 tables, no drag controls |

No region may acquire another permanent fact/action without removing or demoting one of equal weight.

## 33. Risks

1. **Surface duplication:** showing complete projects/videos in CRM or War Room would compete with Projects/Productivity. Enforce caps and route links.
2. **Query multiplication:** composing current War Room calls plus projects/orders/captures could become expensive every 30 seconds. Build one bounded read model, reuse promises, and measure query count.
3. **Misleading metaphor:** restaurant imagery can obscure canonical meaning. Every visual state needs visible text and accessible labels.
4. **Hidden urgency:** strict list caps can conceal critical items. Selection must be severity/priority aware, with explicit overflow counts.
5. **Mutation density:** too many inline commands make the sidecar fragile. Keep one dominant valid action and specialist management elsewhere.
6. **Shell/auth regression:** chrome-less sidecar route could accidentally be classified as public. Add route-classification/auth tests.
7. **Hydration/timezone drift:** timers and formatted timestamps can mismatch Worker/browser. Continue explicit São Paulo formatting and server start-time truth.
8. **Image cost/layout shift:** project/client covers and pixel art can overload an always-open page. Size, cap, and lazy-load images.
9. **“Assets” misinterpretation:** literal implementation could duplicate Equipment, Project Assets, or Finance. Resolve the handwritten label first.
10. **House Cleaning reversal:** reorganizing must not make all previous BI/history permanently visible again.
11. **Tiny-sample authority:** streaks and counts must remain factual; avoid grades, predictions, “Elite” labels, or percentages unsupported by the sample.
12. **Touch discoverability:** hover-only tooltips or tiny pixel controls will fail on iPad. All essential facts/actions must be visible/tappable.

## 34. What MUST NOT change

- No schema migration, new table, cached counter, duplicated timer, or rewritten canonical terminology.
- No change to video lifecycle, project ownership, production-order atomicity, Work Session one-open invariant, Client Portal authentication, or Finance truth boundaries.
- No restoration of the old dense Dashboard, CRM panel stack, or War Room BI wall.
- No duplicate Productivity stage grid, Projects manager, LET'S COOK detail, Session ledger, or Client Portal page builder.
- No automatic fullscreen trap, new realtime infrastructure, WebSockets, or per-panel polling.
- No invented Health-in-client facts, fake revenue attribution, cross-currency sum, XP/economy/game mechanics, or performance score.
- No change to `/book`, `/client`, root site, DNS, Access, Workers, D1, production data, or migration `0049`.
- No deletion or hiding of historical truth; specialist routes and progressive disclosure remain available.

## 35. Recommended implementation order

The proposed order is validated:

### 1. War Room fullscreen / sidecar

It has the clearest drawing, strongest operator need, and best-defined data boundary. It can be introduced as a private, separate presentation route while leaving the accepted normal surfaces intact. It also establishes the shared spatial panel, fixed-viewport, refresh, and pixel-map conventions with limited blast radius.

Suggested implementation slices: route/shell and tests → bounded sidecar read model → factual panels → commands/quick capture → restaurant projection → responsive/performance QA.

### 2. CRM spatial recomposition

It can reuse the visual/panel conventions proven by sidecar, but it carries more mutation and information-boundary risk. Implement after the sidecar establishes density rules. Preserve `/crm/[id]`, progressively move current components into identity/active-jobs/dossier/portal-manager regions, and regression-test every existing action.

### 3. Dashboard HUD recomposition

Dashboard is the most semantically ambiguous drawing because of “AS IT IS/ASSETS.” It should wait for Emmanuel's label confirmation and for the War Room/CRM boundaries to be visually proven. Implementing it last reduces the risk of recreating either surface in miniature.

### Coherence verdict

**YES — the three wireframes form a coherent single product model.**

- **COMANDA:** War Room shows live orders, queue, active dish, and exceptions; CRM center shows the comandas attached to one relationship.
- **CAIXA:** CRM dossier and the restrained Dashboard observed facts preserve relationship/commercial truth without turning the live kitchen into Finance.
- **SIDECAR:** War Room is the always-open editing-bay display; CRM and Dashboard are deeper contextual views reached when needed.
- **NEWSROOM/IPTC:** canonical metadata, provenance, client/project/video identity, lifecycle, and source facts remain underneath every visual projection. The metaphor never replaces the record.
- **HOUSE CLEANING:** each specialist surface keeps one job, while spatial hierarchy exposes only the smallest current slice and routes detail back to its owner.

The three views therefore describe one OS, not three dashboards: personal overview → live execution → relationship context. The only unresolved visual-language decision is whether Page 2 literally says “AS IT IS” or “ASSETS.”

---

**Hard gate:** discovery and blueprint complete. No application code, CSS, component, schema, migration, or deployment change is authorized by this document.
