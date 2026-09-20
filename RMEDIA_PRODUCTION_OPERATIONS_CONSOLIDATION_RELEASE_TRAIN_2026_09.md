# Production Operations Consolidation — Release Train (backlog 9→13, 2026-09-19 operator-local)

One source-authority snapshot, one archaeology pass, one implementation slice, one full gate, one deploy, one report. Note on scope: the brief I received ended at §13 (revision gate); sections on the economics/Quick Notes analyses, gates, deploy, report and final output were not in the message, so those follow the brief's own header ("ANALYSIS A / B", one gate, one deploy, one report) and this report's structure is mine.

## 1. Source authority (start snapshot)
GREEN. HEAD = release = `production/current` = `b46c2efbe`; migration head 0052, none pending; Operator `27626530…`, Client `6a619197…`. Verified from D1: Taryn has exactly Content Waterfall / Lecture Format / Client Success Format, terms CEO Clubhouse · PDBM · Perfect Day Business Mentorship, 3 export reminders; 0 revisions, 77 work sessions. Wave 1 status headline, Wave 2 referral, Waves 3–4 all present.

## 2. Shared archaeology map
| Class | Facts |
|---|---|
| EXISTING CANONICAL | `production_orders.notes`; `projects.notes`; `source_media_references` (project); `video_logs.review_url / delivery_url / published_url / notes`; `client_production_memory`; `revisions.caused_by/category/minutes_rework/note`; video `crm_events` notes (`video.note_added`) |
| DERIVED | batch phase/state; order time breakdown (container vs deliverables); formats-for-client |
| FREE-TEXT ONLY | cut sheet / script / source links (live in project notes, order notes, and Quick Notes: e.g. project 15 "Source: … Clips: …", order 1 clip-4 tip, Dave's Meta-ads brief with Canva/Dropbox links) |
| MISSING | a first-class "cut sheet", audio link, per-video↔format association, rough-cut vs captions phase |
| DUPLICATED | project source references shown in the Video Workspace by a standalone panel AND in the Project page; order notes buried at the bottom of the order page |
| CURRENTLY UNREACHABLE | project notes and order notes from the Video Workspace; the Production Order from a video; client/project from the order header; origin from signal/commitment actions |

## 3. Subsystem A — Production context (no migration)
Read-only `ProductionContextBlock`, rows only for recorded facts (no empty placeholders; one honest "no source or cut-sheet context is recorded" line when none). **Order page:** batch notes, project notes (links made clickable, text unchanged), project source media, format names; per-deliverable Review ↗ / Delivery ↗; header links up to client and project; notes moved out of the page footer. **Video Workspace:** the same inherited context plus the video's own review/delivery/published links, and "Part of batch: … →". Batch data stays on the order, video data on the video, project data on the project — derived at read, never copied. There is deliberately **no "cut sheet" row** (no field means that; it would invent a fact). The old standalone "Project source references" panel was removed (same table, now shown once). Acceptance (local sandbox, realistic Content Waterfall fixture): from the order in one screen: batch notes, project notes with source + cut-sheet links, source media, the 3 formats, per-deliverable review link; opening a child video shows its own review plus the inherited context.

## 4. Subsystem B — Production-mode continuity (two root patterns)
Paths audited: War Room→current work OK; Projects→Video OK; Project→Order OK; Order→child Video OK; Video→origin (close) OK; **Video→Order missing**; **Order→Project/Client missing**; **exception→action dropped origin**. Fixed:
1. **Exception/obligation actions carry their origin.** `signalActionHref` appends a validated `returnTo` for destinations that honour it (video workspace, Production Order); applied at both signal render sites (War Room, Needs Attention) and to the War Room commitment card's "Open workspace". Unsafe returnTo is ignored; other destinations untouched.
2. **Containment links preserve origin.** Video→its Production Order returns to that video (carrying the video's own origin); Order header links to client and project.
Verified live locally: Project→Order (returnTo) → child video → "Part of batch" → order "← Back" returns to the same video (chain intact) → close → order → back → project; War Room "Open video" → close → back on `/war-room`. Not audited in depth: Sensor long-session and missing-review-URL exception surfaces (the review-URL rule already returns a clear message).

## 5. Subsystem C — Revision provenance: IMPLEMENTED (no migration)
The existing `revisions.caused_by` (UNKNOWN / OUR_ERROR / CLIENT_CHANGE / SCOPE_CHANGE, default UNKNOWN) and `recordDetailedRevision` already supported provenance; the UI hard-coded UNKNOWN. Added one optional select where revisions are recorded ("Not sure" default, Client changed something, Scope changed, Our error). Saving needs only the note; category/minutes untouched; no invented categories (NORMAL_ITERATION is not supported by the model and was not added). OUR_ERROR now feeds the existing REVISION_DRAG signal (needs 5+ records). Verified locally in the real UI (chosen cause persisted; default stays UNKNOWN; status unchanged).

## 6. Analysis A — Content Waterfall economics (read-only; no code)
Data reality (production, Taryn; periods not aligned, so these are magnitudes not reconciliations):
- **Upwork evidence** (contract 1, $25/h, Jul 27–Sep 13): 4,170 min = **69.5 h**, of which only **90 min (2.2%)** are allocated to videos (all on project 5 week Jul 27–Aug 2).
- **Tracked Work Sessions** (all Taryn videos, closed): **≈36.8 h** (EDITING 32.6 h, OTHER 4.0 h, REVIEW 0.2 h) ≈ 53% of Upwork hours. **Approved Sensor time on deliverables ≈57 h** (+3.1 h on the 17SEP batch container) ≈ 87%.
- **17SEP batch (order 1):** 4 deliverables (3 done); 3.10 h tracked at batch level = 3.10 h Sensor (agree) → ≈47 min per deliverable batch-equivalent, **n = 1 batch**. **Project 15** (15 videos, 14 done): 10.66 h tracked / 14.66 h Sensor → 0.76 h / 1.05 h per finished video; **project 16** (5 done): only 13 min tracked (tracking incomplete).
- **Rough-cut vs captions/composition:** no such dimension exists (activity types are EDITING / MOTION / COLOR / AUDIO / REVIEW / ADMIN / OTHER), so it cannot be answered from current data.
**Verdict:** a per-batch economics number is not yet trustworthy: one Production Order, mixed tracking, 97.8% of billed hours unallocated, no phase data. What to capture next (deferred, not built): allocate weekly Upwork minutes to batches, and a per-session phase tag if phase split matters.

## 7. Analysis B — Quick Notes harvest (read-only; nothing created)
37 notes (`video.note_added`), Aug 23–Sep 6: 27 on one Taryn Mini Series video (Aug 23) in a single session, 9 on Dave videos, 1 internal. Classified: **26 process breadcrumbs**, **2 time evidence** (tracked 1h53m / Upwork 1h10 registered), **2 product-bug notes** (a timer that kept counting on other devices after stop — same issue twice; *verify against current Sensor/Work Session behaviour, likely superseded*), **1 quality observation** (4K detail/lighting, no follow-up recorded), **2 ideas/decisions** (camera-movement plan; text glow, later confirmed done), **1 commitment** (Dave: send final audio after approval — likely resolved, the delivery link was posted the same day), **2 facts stranded in free text** (Dave's full Meta-ads brief with Canva/Dropbox links; a delivery + payment link pair), **1 internal work log**. Relevant finding: notes are used as a cheap production diary and as the only home for briefs/links — supporting the context block above. The 2 `captures` rows are smoke-test artifacts. No backlog auto-created.

## 8. Deliberately deferred
First-class cut-sheet / audio source fields (would need migration); per-video↔format association; Upwork→batch allocation and session phase tags; auditing Sensor long-session and other exception surfaces; a third navigation root pattern.

## 9. Tests, gates
New: 11 (context core) + 10 (context integration/boundary/revision pins) + 5 (signal/commitment origin) targeted; final full gate once: `git diff --check` clean; **1329/1329**; `tsc` clean; `eslint` 0 errors (3 pre-existing warnings); build exit 0. Tests cover: rows only for recorded facts; batch/project/video separation and no copying; linkify safety; safe nested returnTo; client isolation; zero side effects (statuses, sessions, sensor, billing, money, events); operator-only/read-only; no Client Portal reach; lifecycle controls unchanged; revision cause default/optional/no new categories; no new migration.

## 10. Deploy and source authority
One deploy: Operator `7bacbe7c-c712-44f3-abba-706326352666` (from `4b54d06`); rollback `27626530-2200-4730-999d-5d6177728fb5`. No migration, no D1 writes; Client Worker (`6a619197…`), Sensor, public site, PDBM referral untouched. HEAD = release = `production/current` at `4b54d06` before this report-only commit. Production reachability (unauthenticated): order/video/war-room/project → 307 to login; PDBM page 200; portal login 200; production data identical to the start snapshot.

## 11. Functional QA
Local sandbox only (real pages/actions, fixtures restored to the recorded originals): context on order and child video, one source row (duplicate gone), Project→Order→Video→batch link→Back chain, War Room signal→video→close returns to War Room, revision cause persisted/default. **Production authenticated UI: NOT RUN** (no operator session).
