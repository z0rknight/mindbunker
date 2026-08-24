# MindBunker — Canonical System Map

Date: 2026-08-23
Scope: Sprint 1.2 architecture cartography. This document maps the system
**as it actually exists in the repository today** — every claim below was
verified by reading the real file (`schema.ts`, the module's `actions.ts` /
`data.ts` / `core.ts`, the actual route file, or a real test). Nothing here
is inferred from earlier conversation. No code was changed to produce this
document; no migration, deploy, or D1 mutation happened in this round.

North star this document serves: MindBunker is becoming the operational
memory of Rosa Media. Canonical production hierarchy: **CLIENT → PROJECT →
VIDEO → WORK → REVIEW → RESULT**. This document shows how that hierarchy and
every adjacent domain actually fit together in code, not in discussion.

---

## 1. Repository inventory

**`src/app`** — 19 routes (full list and classification in section 6).
Three access boundaries are enforced not just by auth checks but by
`AppShell.tsx` itself: `/login`, `/g/[token]`, and `/client/[token]` render
**without** the Sidebar/operator shell; every other route renders inside it.
That one `if` statement in `AppShell.tsx` is the single place the
public/operator boundary is drawn at the UI layer.

**`src/modules`** — 15 modules: `analytics`, `booking`, `client-portal`,
`crm`, `finance`, `gateway`, `health`, `historical`, `instagram`,
`productivity`, `projects`, `video-memory`, `work-sessions`, plus
`src/lib/auth-core.ts` + `auth-server.ts` for the operator auth boundary
(not a `modules/` entry, but load-bearing for every module).

**`src/db/schema.ts`** — 18 tables across 597 lines, in five commented
sections: Private Access, Finance, Health, CRM (which also contains
Gateway/Booking), Productivity, and the Sprint 1.2 P0 Historical Reference
Layer. Full ERD in section 3.

**Migrations** — 13 files, `0000` through `0012`. `0012` (the Historical
Reference Layer) was originally hand-written by a prior Claude session and
has since been superseded on disk by a `drizzle-kit`-generated file of the
same content (`0012_melted_mole_man.sql`) after `bun run db:generate` was
run locally — this is expected, already-reconciled state, not a discrepancy.

**Navigation** — `Sidebar.tsx`: 8 desktop items (War Room, Dashboard,
Productivity, Finance, Health, CRM, Projects, All History), 7 of which also
appear in the mobile bottom tab bar (All History is desktop-only). Confirmed
by reading the file directly, not assumed from a past round.

**Authentication boundaries — three, not one:**
1. **Operator** (`src/lib/auth-server.ts` + `auth-core.ts`): a signed,
   HMAC-verified session cookie (`mb_session`), backing a PBKDF2/HMAC
   password check. Every `getAuthenticatedDb()` call in every module sits
   behind this. In production this stacks under Cloudflare Access as an
   outer boundary (per `README.md`); locally it's the only gate.
2. **Gateway / Client Portal capability token** (`gateway_invitations.
   tokenHash`, `src/modules/gateway/core.ts`'s `getGatewayContext()`): a
   32-byte random token, SHA-256-hashed at rest, 14-day TTL, revocable,
   tracks `openedAt`. No password, no session cookie — knowledge of the URL
   token is the entire access control. **This one token and one table power
   two different UI surfaces** — see section 4.
3. Every `getDb()` call (as opposed to `getAuthenticatedDb()`) is
   intentionally unauthenticated at the DB layer, because the token check
   above is the actual gate for those code paths (`getGatewayContext`,
   `getClientPortalView`, `submitBriefing`, `recordGatewayOpened`).

**A finding this cartography pass surfaced, not carried over from prior
rounds:** `src/app/all-history/_import/page.tsx` exists in the working tree
(untracked in git). It is a `NODE_ENV === "development"`-gated page that
calls `importHistoricalArtifact()` from a form button. Two prior round
reports (Sprint 1.2 P0, Sprint 1.2.1) both stated no UI trigger for the
historical import exists, "by design." That statement is **no longer fully
accurate as written** — code for a UI trigger does exist on disk. It is
currently inert: Next.js App Router excludes any folder prefixed with `_`
from routing entirely (a "private folder"), so `/all-history/_import` is not
reachable at any URL today, in development or production, unless someone
renames the folder. This document doesn't attempt to determine who added it
or when (it postdates the last round's git-status snapshot and wasn't
flagged then); it is reported here because "inspect the actual repository,
don't rely on what was previously discussed" is this round's explicit
instruction, and this is exactly the kind of thing that instruction is for.
See section 8, P1.

---

## 2. Canonical domain map

Rows are derived from the actual modules/actions/schema, not invented.
"Owner / Parent" is the entity's real foreign key parent, not a conceptual
guess.

| Domain | Entity | Owner / Parent | State | Action | Event / Mutation | Data source | Surface | Consumer | Status |
|---|---|---|---|---|---|---|---|---|---|
| CRM | Client | — (root entity) | `status`: lead/active/inactive; `opportunityStage`: 10-value pipeline | `addClient`, `updateClient`, `convertLeadToClient`, `deleteClient` | `crm_events` (lead_created, client_created, client_activated, stage_changed, ...) | native | `/crm`, `/crm/[id]` | operator | WORKING |
| Production | Project | Client | `status`: planned/active/review/delivered/archived | `createProject`, `updateProject`, `deleteProject` | `crm_events` (`project_deleted` only — creation/update not logged) | native | `/crm/[id]` (ProjectManager), `/projects`, `/projects/[id]` | operator | WORKING |
| Production | Video | Project (nullable), Client (nullable, independent FK) | `status`: PLANNED→IN_PROGRESS→READY_FOR_REVIEW⇄CHANGES_REQUESTED/DONE (DONE can loop back to CHANGES_REQUESTED) | `createVideoLog`, `updateVideoMetadata`, `transitionVideoStatus`, `changeRevisionCount`, `deleteVideoLog` | none (no `crm_events` row on status change) | native | `/productivity` | operator | WORKING |
| Production | Work Session | Video (required FK, `onDelete: restrict`) | `OPEN` (one globally, DB-enforced) / `CLOSED` | `startWorkSession`, `stopWorkSession`, `stopWorkSessionAt`, `correctWorkSession` | `crm_events` (`work_session.corrected`, new Sprint 1.2.1) | native | `/productivity`, `/productivity/sessions` | operator | WORKING — evolved into a ledger this round, see addendum |
| Production | Video Memory (operational note) | Video (via `crm_events.video_id`, `onDelete: set null`) | append-only note list | `addVideoOperationalNote` | is itself a `crm_events` row (`type: "video.note_added"`) | native | `/productivity` (VideoMemoryPanel) | operator | WORKING |
| CRM | Gateway Invitation | Client (`onDelete: cascade`) | `active`/`expired`/`revoked` (derived from `expiresAt`/`revokedAt`, not stored) | `generateGatewayInvitation`, `revokeGatewayInvitation` | `crm_events` (`gateway_created`, `gateway_revoked`, `gateway_opened`) | native | `/crm/[id]`, `/g/[token]`, `/client/[token]` | operator (create/revoke) + prospective client (consume) | WORKING |
| CRM | Intake Submission | Client + Gateway Invitation (1:1 via unique index) | submitted once, immutable | `submitBriefing` | `crm_events` (`briefing_submitted`) | native, client-authored | `/g/[token]` | prospective client → operator | WORKING |
| Booking | Booking | Client + Gateway Invitation (both required) | `confirmed`/`cancelled` | `createGatewayBooking`, `rescheduleGatewayBooking`, `cancelGatewayBooking` | none dedicated (no `crm_events` entries observed for booking create/cancel) | native | `/g/[token]` (BookingPanel), `/crm/availability` | prospective client + operator | WORKING |
| Client Portal / Vault | Client Portal view | Client (via the same Gateway Invitation token) | read-only projection of that client's Projects→Videos | `getClientPortalView` (read-only, no mutation) | `crm_events` (`gateway_opened`, shared with Gateway) | derived from native | `/client/[token]` ("The Vault") | client | WORKING |
| Finance | Transaction | — (root, no client/project link at all) | income/expense | `addTransaction`, `deleteTransaction` | none | native | `/finance` | operator | WORKING (basic — no audit trail, no client/project attribution) |
| Health | Health Log | — (root, one per day, operator-only) | daily metrics snapshot | `upsertHealthLog` | none | native, manual daily entry | `/health` | operator | WORKING |
| Historical | Import Batch | — (root) | PENDING→ACTIVE→SUPERSEDED (exactly one ACTIVE, DB-enforced) | `importHistoricalArtifact` (never invoked against any real DB) | none (batches are the event) | external import (reconstructed evidence) | `/all-history` | operator (read), importer (write, unused) | FOUNDATION ONLY |
| Historical | Fact / Identity / Source Coverage | Import Batch | immutable once imported | (import-only, no per-row edits) | none | external import (reconstructed evidence, tiered confidence) | `/all-history` | operator | FOUNDATION ONLY |
| Analytics | War Room / Dashboard metrics | reads `transactions`, `video_logs`, `clients`, `health_logs` directly | fully recomputed on every request | `getWarRoomData` | none — pure read, nothing persisted | derived (cross-domain) | `/`, `/war-room` | operator | WORKING |

---

## 3. Entity relationship map

**Foreign keys (real, from `schema.ts`):**

| Relationship | Type | onDelete |
|---|---|---|
| `projects.client_id → clients.id` | OWNERSHIP | cascade |
| `video_logs.client_id → clients.id` | REFERENCE (nullable) | set null |
| `video_logs.project_id → projects.id` | REFERENCE (nullable) | set null |
| `work_sessions.video_id → video_logs.id` | OWNERSHIP | **restrict** (only hard-blocking FK in the schema) |
| `gateway_invitations.client_id → clients.id` | OWNERSHIP | cascade |
| `intake_submissions.client_id → clients.id` | OWNERSHIP | cascade |
| `intake_submissions.invitation_id → gateway_invitations.id` | OWNERSHIP (1:1, unique index) | cascade |
| `crm_events.client_id → clients.id` | EVENT / HISTORY (nullable) | cascade |
| `crm_events.video_id → video_logs.id` | EVENT / HISTORY (nullable) | set null |
| `bookings.client_id → clients.id` | OWNERSHIP | cascade |
| `bookings.invitation_id → gateway_invitations.id` | OWNERSHIP | cascade |
| `hist_identities.batch_id → hist_import_batches.id` | OWNERSHIP | cascade |
| `hist_identity_source_labels.(batch_id, identity_canonical_id) → hist_identities.(batch_id, canonical_id)` | OWNERSHIP (composite, natural key) | cascade |
| `hist_facts.(batch_id, identity_canonical_id) → hist_identities.(batch_id, canonical_id)` | OWNERSHIP (composite, natural key, nullable) | cascade |
| `hist_source_coverage.batch_id → hist_import_batches.id` | OWNERSHIP | cascade |

**Relationships enforced only in application code, not by any foreign key:**

- `video_logs.client_id` "should" equal `projects.client_id` for the video's
  own `project_id` — there is no CHECK constraint or trigger for this.
  `client-portal/core.ts`'s `buildClientPortalProjects()` re-validates it
  itself in a comment it calls "defense-in-depth," which is the tell that
  the database does not guarantee it. REFERENCE, application-enforced only.
- Video deletion being blocked by existing Work Sessions is enforced
  **twice** — once by the DB (`onDelete: restrict`) and once redundantly in
  `deleteVideoLog()`. Video deletion being blocked by existing Video Memory
  notes is enforced **only** in `deleteVideoLog()` — the FK
  (`crm_events.video_id`) is `set null`, not `restrict`, so nothing in the
  schema itself prevents a video with memory from being deleted through any
  other code path. ACCESS/CAPABILITY-adjacent guard, application-only.
- `analytics/service.ts` reads `transactions`, `video_logs`, `clients`,
  `health_logs` directly with no join table — DERIVED, recomputed per
  request, not persisted anywhere.

**Explicitly NO relationship (verified absence, not oversight):**

- `hist_identities` ↔ `clients`. This is the P0 round's own deliberate
  scope cut (`client_hist_identity_link` was designed, then dropped). A
  historical identity like `"client:sean_go"` and the real `clients` row
  for Sean Go are not linked anywhere in the schema or in any query. They
  are two separate authorities today (see section 4).
- `work_sessions` ↔ `transactions`. Worked time and revenue are never
  joined anywhere in the codebase. No "revenue per hour" or "cost of this
  video" metric exists for native data.
- `hist_facts` ↔ `work_sessions` / `transactions`. Historical reconstructed
  hours/revenue and native hours/revenue are never unioned or compared in
  any query — by design (P0's explicit tier-separation requirement), but
  worth stating plainly since nothing currently even offers a side-by-side
  view of "historical Aug 2024" next to "native Aug 2026."

---

## 4. Authority map

| Concept | Canonical authority | Secondary / derived consumers |
|---|---|---|
| Current Video state (status, delivery) | `video_logs` | Client Portal/Vault (filtered read), War Room analytics (aggregate read) |
| Operational Video memory | `crm_events` where `type = 'video.note_added'` | `deleteVideoLog()`'s deletion guard |
| Worked time (native, 2026-forward) | `work_sessions` | `/productivity` aggregate, `/productivity/sessions` |
| Reconstructed historical worked time (2023–2026 backfill) | `hist_facts` (source = `clockify_detailed_export` / `activitywatch_afk`) | `/all-history` (once imported — currently empty) |
| Native financial data | `transactions` | Dashboard, War Room |
| Reconstructed historical revenue | `hist_facts` (source = `upwork_*`) | `/all-history` (once imported) |
| Client identity | `clients` | everything else in the app |
| Historical "identity" (client-like entities in old evidence) | `hist_identities` | nothing yet — unlinked to `clients` by design |
| Client-facing access authority | `gateway_invitations.token_hash` | consumed identically by `/g/[token]` (Gateway) and `/client/[token]` (Vault/Client Portal) — **one token, two surfaces** |
| Operator authority | `mb_session` cookie (HMAC) + password hash in `.dev.vars`/env, with Cloudflare Access as the outer boundary in production | every `getAuthenticatedDb()` call, i.e. nearly the whole admin-side app |
| CRM opportunity/lead state | `clients.opportunity_stage` | `/crm`, `/crm/[id]`, Gateway (advances the stage on invitation) |
| Booking availability & state | `bookings` + `availability_windows` + `booking_settings` | `/g/[token]`, `/crm/availability` |
| Cross-domain performance metrics (War Room, Dashboard "insights") | nothing — `analytics/service.ts` recomputes on every request | `/`, `/war-room` |

**Concepts with two authorities by explicit design (not a conflict, but
flagged per the brief's own instruction to surface this):**

- **Worked time** has two authorities that must never merge:
  `work_sessions` (native) and `hist_facts` (historical reconstruction).
  This separation is the entire point of the Sprint 1.2 P0 tier model —
  correct as built, listed here because "flag any concept with competing
  authorities" was explicitly asked for.
- **Revenue** has the same two-authority split: `transactions` (native) vs.
  `hist_facts` (historical). Same verdict: correct by design, not a defect.

**No accidental competing authorities were found** — every table with
overlapping subject matter (Video status vs. Video Memory, CRM events vs.
Video Memory events) turned out, on inspection, to be one authority wearing
two hats (`crm_events` serving both CRM and Video Memory), not two tables
disagreeing about the same fact. That sharing is itself flagged as
architectural debt in section 8, but it is not a truth-conflict.

---

## 5. Workflow map

**Lead / CRM flow.** ENTRY `addClient({status: "lead"})` → ACTIONS
`updateOpportunity`, `convertLeadToClient` → STATE `clients.status`,
`clients.opportunity_stage` (10-stage pipeline) → PERSISTENCE `clients` +
`crm_events` → EXIT: either stays a lead indefinitely, or converts to an
active client and becomes eligible for Project creation and Gateway
invitations.

**Client creation.** ENTRY `addClient({status: "active"})` → same table,
`opportunityStage` starts at `"active"` → EXIT: ready for Project creation.

**Project creation.** ENTRY `createProject(clientId, ...)` → `projects` row
→ EXIT: ready for Video planning.

**Video planning.** ENTRY `createVideoLog(...)`, default `status:
"PLANNED"` → `video_logs` row → EXIT: enters the Video lifecycle below.

**Video lifecycle.** ENTRY any `video_logs` row → ACTIONS
`transitionVideoStatus` under `VIDEO_STATUS_TRANSITIONS`: `PLANNED →
IN_PROGRESS`; `IN_PROGRESS → READY_FOR_REVIEW | DONE`; `READY_FOR_REVIEW →
CHANGES_REQUESTED | DONE`; `CHANGES_REQUESTED → IN_PROGRESS |
READY_FOR_REVIEW`; `DONE → CHANGES_REQUESTED` → STATE `video_logs.status` +
`delivered`/`delivery_url` → PERSISTENCE `video_logs` only (no event log
entry on transition, unlike almost every other domain) → EXIT: `DONE` feeds
the Client Portal/Vault "Delivered" view and War Room analytics. **Not a
strictly linear pipeline by design** — `DONE → CHANGES_REQUESTED` is a real,
intentional loop (post-delivery revisions), not a bug.

**Work Session lifecycle.** ENTRY `startWorkSession(videoId, activityType)`
→ `work_sessions` row (`started_at`) → `stopWorkSession` sets `ended_at`, OR
(new, Sprint 1.2.1) `stopWorkSessionAt(videoId, endedAtIso)` closes it at an
operator-chosen past time for stale-session recovery → PERSISTENCE
`work_sessions` → EXIT: aggregated into the video's tracked time and into
`/productivity/sessions`, now grouped by day/week (Sprint 1.2.1); **still
does not feed Finance or Analytics anywhere** — a dead end relative to
revenue, unchanged this round, noted in section 3. A closed session may
additionally be corrected via `correctWorkSession(sessionId, input)`
(video/times/activity/note), which writes a `crm_events`
(`type: "work_session.corrected"`) audit row for any field that actually
changed — the open session remains structurally uncorrectable (the
correction SQL's own WHERE guard excludes `ended_at IS NULL` rows).

**Video Memory.** ENTRY `addVideoOperationalNote(videoId, note)` → one
`crm_events` row (`type: "video.note_added"`) → EXIT: shown in
`VideoMemoryPanel`; also permanently blocks that video's deletion at the
application layer (not the database layer — see section 3).

**Review / completion.** Folded into the Video lifecycle above —
`READY_FOR_REVIEW` is a state, not a separate table or workflow; there is
no distinct "review" entity.

**Client-facing access.** ENTRY `generateGatewayInvitation(clientId)` →
one `gateway_invitations` row (any prior un-revoked invitation for that
client is auto-revoked first) → the SAME token is handed out as two
separate paths: `/g/{token}` (Gateway: briefing intake + booking) and
`/client/{token}` (Vault: read-only ongoing status) → EXIT: Gateway path
can mutate (`submitBriefing`, booking actions); Vault path is pure read.
`recordGatewayOpened` logs a `crm_events` row the first time either
surface is opened.

**Booking / intake.** ENTRY (from the Gateway surface only — a booking
requires both a `client_id` and a `gateway_invitations.id`, both `NOT
NULL`, so a booking cannot currently be created for a client with no
invitation) → `createGatewayBooking` → `bookings` row (`status:
"confirmed"`) → `rescheduleGatewayBooking`/`cancelGatewayBooking` mutate it
in place → EXIT: visible to the operator via `getAdminGatewayWorkspace`,
to the client via `getPublicGatewayView`.

**Historical reference flow.** ENTRY the four embedded JSON artifact files
(`src/modules/historical/artifact/v0_1_0/`) → `importHistoricalArtifact()`
(fingerprint-checked, batched) → `hist_*` tables → EXIT `/all-history`.
**Currently a workflow with no live entry point in production or local
dev** — the Server Action exists and is tested, but nothing has ever
called it against a real database, and its one on-disk UI trigger
(`_import/page.tsx`) is unreachable by routing (section 1). This is the
one workflow in the map with zero real executions to date.

**Duplicated/inconsistent action found:** "delete a Client" and "delete a
Project" are not equivalent operations despite both existing.
`deleteProject()` is guarded: it keeps that project's videos (explicitly,
per its own success message), recomputes `clients.total_projects`, and
logs a `crm_events` `project_deleted` entry. `deleteClient()` has **no
guards, no recount, and no event log at all** — it is a single
`db.delete(clients).where(...)` call, and because `projects.client_id` is
`onDelete: cascade`, it silently hard-deletes every Project belonging to
that client (bypassing `deleteProject()`'s own logic entirely), while
`gateway_invitations`, `intake_submissions`, `bookings`, and every
`crm_events` row for that client cascade-delete too. See section 8, P0.

---

## 6. Surface map

| Route | Classification | Notes |
|---|---|---|
| `/` | OPERATIONAL | Dashboard — quick actions + cross-domain insights |
| `/war-room` | OPERATIONAL | Motivational/gamified analytics view, same `analytics/service.ts` data as Dashboard |
| `/productivity` | OPERATIONAL | The production floor — Video + Work Session + Video Memory all surface here; global status banner is now stale-session-aware (Sprint 1.2.1) |
| `/productivity/sessions` | REFERENCE | Rewritten this round (Sprint 1.2.1) from a flat list into a day/week-grouped ledger with inline correction |
| `/projects` | RELATIONSHIP | Client→Project structure browsing |
| `/projects/[id]` | RELATIONSHIP | Single project workspace (still relationship-shaped: deadline, status, notes) |
| `/crm` | RELATIONSHIP | Lead/client list and pipeline |
| `/crm/[id]` | RELATIONSHIP | Single client's full picture: opportunity, projects, Instagram, Gateway |
| `/crm/availability` | ADMIN / INFRASTRUCTURE | Booking-window configuration, not client- or production-specific |
| `/all-history` | REFERENCE | Read-only historical reconstructed evidence (empty until imported) |
| `/finance` | OPERATIONAL | Native transaction logging |
| `/health` | OPERATIONAL | Native daily health logging |
| `/g/[token]` | CLIENT-FACING | Gateway: briefing intake + booking, no operator shell |
| `/client/[token]` | CLIENT-FACING | "The Vault" — read-only client portal, no operator shell |
| `/login` | ADMIN / INFRASTRUCTURE | Operator password login, no operator shell |
| `/qa-login` | ADMIN / INFRASTRUCTURE | Dev-only (`NODE_ENV` + token-gated) session shortcut, returns 404 otherwise |

**Does the app accidentally expose relationship-management surfaces during
operational work?** Yes, by direct design, not accident: `/productivity`'s
own header links to both `/projects` ("Review projects →") and `/crm`.
That's one click from daily production execution into relationship
management. Not flagged as a defect — it reads as an intentional
convenience — but it is exactly the kind of thing this section exists to
surface plainly rather than assume.

---

## 7. Data provenance map

| Class | Datasets | Notes |
|---|---|---|
| NATIVE OPERATIONAL | `video_logs`, `work_sessions`, `transactions`, `health_logs`, `bookings`, `availability_windows`, `booking_settings` | Written by the running app in real time. `work_sessions` now carries its own `source` column (Sprint 1.2.1) — see addendum. |
| MANUAL | `clients` (mostly hand-entered), Instagram fields on `clients` when saved via `saveInstagramProfile` (as opposed to imported) | Operator-typed data |
| HISTORICAL RECONSTRUCTED | `hist_facts`, `hist_identities`, `hist_identity_source_labels`, `hist_source_coverage` | Tier-1 evidence per `ARTIFACT_CONTRACT.md`; confidence-tagged (`HIGH`/`MEDIUM`/`LOW`/`N/A`/`EXPERIMENTAL`); explicitly never auto-creates native entities |
| EXTERNAL IMPORT | Instagram bio/photo via `importInstagramProfile` (Meta Business Discovery, when configured); the four historical artifact JSON files themselves | Both are one-way pulls from outside MindBunker |
| DERIVED | `analytics/service.ts`'s War Room/Dashboard metrics; `client-portal`'s filtered project/video view; `hist_source_coverage` status labels | Computed on read, nothing persisted for these specifically |
| FUTURE SENSOR OBSERVATION | none exist yet | `analytics/service.ts`'s own header comment says it is "Future-ready: designed for ActivityWatch API webhook integration" — the only hook of any kind toward a live sensor anywhere in the repo, and it's a comment, not code. Sprint 1.2.1 (see addendum) proposes a concrete `activity_observations` contract for this, still unimplemented. |

Historical reconstructed evidence remains structurally distinct from native
operational data at every layer checked: separate tables, separate tier
naming, no shared foreign keys, and (per section 3) no query anywhere joins
them. The confidence/provenance distinction inside the historical tier
itself (`confidence`, `canonical`, `provenance`, `derivation_note` columns
on `hist_facts`) is preserved at the schema level, not flattened into a
single number anywhere in the code inspected.

---

## 8. Architectural pressure points

**P0 — threatens data integrity**

1. **`deleteClient()` has no guard rails and silently cascades.** Deleting
   a client hard-deletes every `projects` row for that client (via FK
   cascade), bypassing `deleteProject()`'s own logic (which keeps videos
   and logs the deletion) entirely — plus cascades `gateway_invitations`,
   `intake_submissions`, `bookings`, and the client's whole `crm_events`
   history. No confirmation step, no dependency check, no event log survives
   it. This is a real, irreversible-in-practice action reachable from the
   CRM page today. (See section 5.) **Unchanged by Sprint 1.2.1** — this
   round touched only the Work Session domain.

**P1 — likely operational bottleneck**

2. **The dormant `_import` historical-trigger page contradicts documented
   state.** Currently inert (unreachable by routing), but its presence
   means "no UI trigger exists, by design" — stated in two prior round
   reports — is not something this document can repeat as fact without the
   caveat now on record. Worth a deliberate decision (keep it disabled and
   documented, wire it up properly, or delete it) rather than leaving it as
   an undocumented loose end. (Section 1.) **Unchanged by Sprint 1.2.1.**
3. **Video status transitions are not logged anywhere.** Every other
   domain (CRM stage changes, Gateway events, Instagram updates, Video
   Memory notes, Project deletion, and now Work Session corrections — see
   below) writes a `crm_events` row. Video status transitions (`PLANNED →
   IN_PROGRESS → ...`) do not. As historical backfill and dogfooding both
   increase video volume, "when did this video actually move to review"
   becomes unanswerable from data alone. **Unchanged by Sprint 1.2.1**, but
   worth noting Work Session corrections closed the analogous gap in their
   own domain this round, which sharpens the contrast with Video status.
4. **Worked time and revenue are never correlated.** No query joins
   `work_sessions` to `transactions`. There is no "cost to produce this
   video" or "revenue per hour" for native data, even though the raw
   numbers to compute it already exist in two separate tables.
   **Unchanged by Sprint 1.2.1** — explicitly listed as deferred work in
   the Work Session Ledger P1 report.
5. ~~**`work_sessions` has no `source`/`capture_type` column, so a second
   capture source arriving later would be silently indistinguishable from
   the first.**~~ **RESOLVED by Sprint 1.2.1.** `work_sessions.source`
   (open vocabulary, no CHECK constraint, `WEB_TIMER` today) now exists —
   see addendum below and `docs/architecture/WORK_SESSION_LEDGER_P1.md`
   §5. This item is kept here, struck through, rather than deleted, so the
   history of "this was flagged, then fixed" stays visible.

**P2 — architectural debt**

6. **`crm_events` is a shared, overloaded table.** It is simultaneously the
   CRM activity timeline (client-scoped), the entire Video Memory note
   system (video-scoped, `client_id: null`), and — as of Sprint 1.2.1 —
   the Work Session correction audit trail (`type:
   "work_session.corrected"`), distinguished only by a free-text `type`
   string, not by schema. This round added a *third* consumer to an
   already-flagged overload rather than a new table, deliberately: the
   brief for this round explicitly asked for the smallest audit mechanism
   that fits the existing house pattern, not new event-sourcing
   infrastructure. The overload itself remains real debt, restated rather
   than resolved.
7. **Video Memory's deletion protection has no database backstop.** Work
   Session's protection is enforced twice (DB `restrict` + app check).
   Video Memory's is enforced exactly once, in `deleteVideoLog()`'s
   application code, because its FK is `set null`. A future second
   deletion code path (a bulk-cleanup script, a different action) would not
   automatically inherit this protection. **Unchanged by Sprint 1.2.1.**
8. **Historical identities are unlinked to native Clients (by design, but
   worth restating here).** `"client:sean_go"` in `hist_identities` and the
   real `clients` row for Sean Go share no foreign key and no query joins
   them. This is the P0 round's deliberate scope cut, not new debt — listed
   here because as more historical data gets backfilled (100+ videos per
   the brief's own framing), the gap between "this reconstructed evidence"
   and "this real client" will be felt more, not less. **Unchanged by
   Sprint 1.2.1.**
9. **Two different "delete" philosophies coexist without a stated
   convention.** `deleteProject()` is soft in effect (keeps children,
   logs, recomputes counters). `deleteClient()` is hard (cascades
   silently). `deleteVideoLog()` is guarded (blocks on dependents). There
   is no house rule visible in code for which pattern a new "delete"
   action should follow. **Unchanged by Sprint 1.2.1** — note that Work
   Session *correction* (as opposed to deletion) established its own
   convention this round: never delete/overwrite silently, always log what
   changed via `crm_events`. A future "delete" convention discussion could
   reasonably borrow this shape.

**P3 — cosmetic / naming**

10. **UI terminology vs. schema terminology diverges for the Client Portal.**
    The schema, module, and every internal comment call it "Client Portal"
    / "capability token." The actual rendered page brands itself "The
    Vault" (`<title>The Vault | RMedia</title>`, `VaultFrame`, "Welcome to
    your vault"). Both names are correct — the module is the mechanism, the
    Vault is the product name — but a search for "vault" in the codebase
    finds almost nothing outside this one file, which is exactly what
    caused the previous round's misclassification. Worth a one-line comment
    in `client-portal/core.ts` cross-referencing the Vault branding so this
    doesn't happen a third time. **Unchanged by Sprint 1.2.1.**
11. **`WorkSessionActivityType` and `VIDEO_STATUS_TRANSITIONS` live in
    different modules' `config.ts`/`core.ts` with no cross-reference,**
    despite Work Sessions existing entirely to describe activity *on* a
    Video. Not a bug — just a seam to know about before building anything
    that needs both (e.g., "how long was this video actually IN_PROGRESS
    vs. how much tracked time does it have"). **Unchanged by Sprint
    1.2.1.**

**Backfill-scale and future-sensor-specific pressure points:**

- Backfilling 100+ historical videos/projects will hit **P1 #3** hardest —
  without a `crm_events`-style trail for video status, there is no way to
  reconstruct "when did this move" for anything backfilled after the fact
  the way there would be for a client's opportunity stage.
- A future Activity Sensor correlating against Work Sessions will now find
  `work_sessions.source` already in place (former P1 #5, resolved this
  round) — but will still need to design the correlation mechanism itself
  from scratch. Sprint 1.2.1 proposes a contract (`activity_observations`,
  a separate table, correlated by timestamp overlap, never merged into
  `work_sessions`) — see the addendum and
  `docs/architecture/WORK_SESSION_LEDGER_P1.md` §9–§11. Nothing here is
  implemented.

---

## 9. Future domain reservations

Preparation only — none of the below is designed or implemented this round.

**ACTIVITY SENSOR**
- Touches: `work_sessions` (correlation target, must not merge into it —
  see the Sprint 1.2.1 readiness doc's boundary section), `analytics/
  service.ts` (its own header comment already names this as the intended
  integration point).
- Must NOT replace: `work_sessions` as the canonical record of intentional
  work. A sensor observation is evidence *about* a Work Session, never a
  Work Session itself.
- Likely integration boundary: a new, separate table of dense
  timestamped observations, correlated to Work Sessions only by
  timestamp overlap computed on read — never a foreign key from
  `work_sessions` to it. Sprint 1.2.1 names this table
  `activity_observations` and proposes its shape in
  `docs/architecture/WORK_SESSION_LEDGER_P1.md` §10 (device_id,
  started_at, ended_at, application_name, window_title, is_idle,
  url_domain, captured_at) — proposed only, nothing implemented.
- Open questions: what happens to a correlation when a Work Session
  spans a sensor gap (laptop asleep, sensor not running)? Does a
  correlation get recomputed if a Work Session's `started_at`/`ended_at`
  could ever be edited (as of Sprint 1.2.1, they now can be, via
  `correctWorkSession` — this open question sharpened, not resolved, by
  this round)? Who is "the user" when there's only one operator but
  possibly multiple machines?

**GELADEIRA**
- Touches: `clients` (the archival/dormant-lead lifecycle it would
  presumably manage), `crm_events` (as its own event source, per the
  pattern every other CRM-adjacent feature already uses).
- Must NOT replace: `clients.status`/`opportunity_stage` as the live
  pipeline authority. If Geladeira introduces its own status concept, it
  needs a stated relationship to the existing 10-stage
  `opportunity_stage` enum, not a parallel one.
- Likely integration boundary: unclear until designed next round — this
  document deliberately stops here per the brief's explicit instruction
  not to design Geladeira yet.
- Open questions: is a "Geladeira'd" client still a `clients` row (with a
  new status value) or a separate archival table? What un-archives a
  client — manual action only, or some automatic re-engagement signal?

**CLIENT XP / LOYALTY**
- Touches: `clients` (whatever the scoring target is), potentially
  `transactions` and `projects` as scoring inputs if it's revenue/volume
  based.
- Must NOT replace: `clients.total_projects`/`total_revenue`, which are
  already-existing, already-consumed running totals maintained by
  `deleteProject()` and elsewhere. Any XP/loyalty score needs to be
  additively derived from these, not a second competing total. Sprint
  1.2.1's brief explicitly named "XP derived from time" as
  DESIGN-ONLY/deferred — no change here.
- Likely integration boundary: a derived, read-time score (like
  `analytics/service.ts`'s pattern) rather than a new persisted table,
  unless historical trend tracking is explicitly required.
- Open questions: does this concern the client experience (a "Vault"-side
  loyalty display) or purely internal prioritization (operator-side)? That
  single decision determines whether it's a Client Portal feature or a CRM
  feature.

**ADVANCED ANALYTICS / AI INSIGHTS**
- Touches: potentially every domain — `analytics/service.ts` is already
  the one place cross-domain reads happen.
- Must NOT replace: any domain's own canonical authority (section 4).
  Anything here is inherently DERIVED, never a new source of truth.
- Likely integration boundary: extend `analytics/service.ts`'s existing
  pattern (compute on read, no persistence) rather than introducing a
  separate analytics-storage layer, unless query cost eventually forces
  that.
- Open questions: once Historical data is actually imported, does this
  layer read `hist_facts` at all, and if so, does it visually distinguish
  reconstructed-evidence-derived insights from native-data-derived ones,
  or does that distinction quietly disappear the moment two numbers get
  averaged together?

## Current system in one page

MindBunker runs on 18 D1 tables behind three access boundaries: an
operator session (password + HMAC cookie, Cloudflare Access in production),
a single reusable capability token that powers two different client-facing
surfaces (`/g` for onboarding, `/client` — branded "The Vault" — for
ongoing status), and dev-only routes gated by `NODE_ENV`. The canonical
production spine — Client → Project → Video → Work Session — is fully
native, fully working, and fully tested, with one genuinely dangerous gap
(`deleteClient()`'s unguarded cascade) and one quieter one (Video status
changes leave no trail). CRM Events doubles as both the CRM timeline and
the entire Video Memory system — functional, but an overloaded table
wearing two names; Sprint 1.2.1 added a third consumer (Work Session
corrections) to that same table rather than building new infrastructure,
restated as debt rather than resolved. The Historical Reference Layer
(Sprint 1.2 P0) is fully built and tested but has never been run against
any real database, local or remote, and one of its own UI triggers exists
in the tree but is unreachable by routing — a loose end this pass surfaced
rather than inherited. Worked time and revenue, and historical identities
and real clients, are each two separate, never-joined authorities today —
the former by careful design, the latter by an explicit, not-yet-revisited
scope cut. Nothing about Activity Sensor, Geladeira, or XP exists in code
yet beyond a single comment pointing at where a sensor would eventually
plug in, plus (as of Sprint 1.2.1) a proposed, unimplemented sensor
contract and privacy model documented in
`docs/architecture/WORK_SESSION_LEDGER_P1.md`.

## Top 10 architectural pressure points

1. **P0** — `deleteClient()` has no guard rails; cascades hard-delete every
   Project, Gateway Invitation, Intake Submission, Booking, and CRM Event
   for that client with zero confirmation or logging.
2. **P1** — `src/app/all-history/_import/page.tsx` is a live-but-unreachable
   historical-import trigger that contradicts two prior rounds' "no UI
   trigger exists" statements.
3. **P1** — Video status transitions are never logged; no audit trail for
   "when did this video move," unlike every other domain (including, as of
   Sprint 1.2.1, Work Session corrections).
4. **P1** — Worked time (`work_sessions`) and revenue (`transactions`) are
   never correlated anywhere in the codebase.
5. **P2** — `crm_events` is simultaneously the CRM timeline, the entire
   Video Memory system, and (new, Sprint 1.2.1) the Work Session correction
   audit trail, distinguished only by a string, not by schema.
6. **P2** — Video Memory's delete-protection is application-code-only (no
   DB `restrict`), unlike Work Session's, which is enforced twice.
7. **P2** — Historical identities and native Clients share no foreign key
   and no query joins them (a deliberate P0 scope cut, restated here as it
   will be felt more at backfill scale).
8. **P2** — No stated convention for what "delete" should do across
   domains; three different entities implement three different
   philosophies (Work Session *correction*, new this round, established its
   own "never silent, always logged" convention that a future "delete"
   discussion could borrow).
9. **P3** — "Client Portal" (code/schema) and "The Vault" (product
   branding) are the same feature under two names, which is exactly what
   caused a prior round's misclassification.
10. **P3** — Work Session activity types and Video status live in sibling
    modules with no cross-reference, despite one existing entirely to
    describe activity on the other.

## Canonical authorities

- Client identity → `clients`
- Current Video state → `video_logs`
- Operational Video memory → `crm_events` (`type = 'video.note_added'`)
- Native worked time → `work_sessions` (now with `source`/`updated_at`
  provenance columns, Sprint 1.2.1)
- Historical reconstructed worked time → `hist_facts` (Clockify/AFK sources)
- Native revenue → `transactions`
- Historical reconstructed revenue → `hist_facts` (Upwork sources)
- Client-facing access → `gateway_invitations.token_hash` (shared by
  Gateway and Vault/Client Portal)
- Operator access → `mb_session` cookie + password hash (+ Cloudflare
  Access in production)
- CRM pipeline state → `clients.opportunity_stage`
- Booking state → `bookings` + `availability_windows` + `booking_settings`
- Cross-domain metrics → nothing persisted; `analytics/service.ts`
  recomputes on every read

## Future domain boundaries

Activity Sensor, Geladeira, Client XP/Loyalty, and Advanced Analytics/AI
Insights are all **unimplemented**. Each has a stated integration boundary
and a canonical authority it must not replace in section 9. None should be
treated as designed, scoped, or started by this document — this is
cartography, not a plan. Activity Sensor now additionally has a proposed
(unimplemented) schema and privacy model — see the addendum below.

## Questions for human dogfooding

1. Does `deleteClient()`'s unguarded cascade need a confirmation step, an
   audit log, or both — before or after real client data starts
   accumulating this week?
2. Should Video status transitions start writing to `crm_events`, given
   every sibling domain already does (Work Session corrections now among
   them)?
3. Is the `_import` dev page something to keep (disabled, documented),
   formalize into a real admin action, or delete outright?
4. Is "worked time vs. revenue, never correlated" a gap worth closing soon,
   or is it fine as two separate concerns indefinitely?
5. When historical identity linking eventually happens, should it live in
   the Historical module (linking outward to `clients`) or the CRM module
   (linking inward to `hist_identities`) — does that choice matter for how
   Geladeira and XP get designed next?
6. *(New, Sprint 1.2.1)* Does the 6-hour stale-session threshold
   (`STALE_SESSION_WARNING_SECONDS`) feel right after a real week of
   dogfooding, or does it need tuning up or down?
7. *(New, Sprint 1.2.1)* Now that Work Session correction exists, is
   `crm_events` as a shared audit table starting to feel like it needs its
   own schema-level distinction between event types, or is a free-text
   `type` string still sufficient?

---

## Addendum — Sprint 1.2.1 (Work Session Ledger P1), 2026-08-23

This addendum records what materially changed in the Work Session domain
since this map's original cartography pass (same date, earlier round). It
does not re-verify or re-date the rest of the document — every claim above
that isn't specifically called out as changed here is unchanged and was not
re-checked as part of this addendum. Full detail, including the human QA
protocol for the Aug 23–28 dogfooding week, lives in
`docs/architecture/WORK_SESSION_LEDGER_P1.md`.

**Schema:** `work_sessions` gained two additive columns via migration
`0014_first_shockwave.sql`: `source` (text, `NOT NULL DEFAULT 'WEB_TIMER'`,
deliberately no CHECK constraint — open vocabulary, SQLite cannot `ALTER` a
CHECK) and `updated_at` (nullable integer timestamp, set only by a
correction). No existing column changed or was dropped; no existing row's
data changed.

**New Server Actions:** `stopWorkSessionAt(videoId, endedAtIso)` (closes
the open session at a chosen past time — stale-session recovery, not a
correction) and `correctWorkSession(sessionId, input)` (edits a **closed**
session's video/times/activity/note; open sessions are structurally
unreachable by this path; every field change is logged as a `crm_events`
row, `type: "work_session.corrected"`).

**New UI:** `/productivity`'s global banner and the per-video
`WorkSessionPanel` both now surface a stale-session warning once an open
session crosses 6 hours, with "keep going" / "correct end time" recovery
actions. `/productivity/sessions` was rewritten from a flat list into a
day → week grouped ledger with inline correction and an explicit
provenance note about the `source` column.

**Domain-map and authority-map rows updated above** to reflect the new
actions, the new `crm_events` event type, and the `source`/`updated_at`
columns. **Pressure point P1 #5** ("no source/capture_type column") is
resolved and struck through rather than deleted. **Pressure point P2 #6**
(`crm_events` overload) gained a third consumer this round and is restated,
not resolved — this round explicitly chose to reuse the existing audit
table rather than build new event-sourcing infrastructure, per its own
brief.

**What did not change:** `startWorkSession`/`stopWorkSession` and their SQL
are byte-identical to before this round. No desktop sensor, activity
observer, or any form of automatic capture was implemented — `§9`'s
Activity Sensor entry gained a proposed (unimplemented) contract, nothing
more. No production database was touched.

---

## Final status

MINDBUNKER CANONICAL MAP READY FOR REVIEW (amended 2026-08-23, Sprint 1.2.1
addendum)
