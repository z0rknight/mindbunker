# MindBunker — Sprint 1.2 Native Intelligence Audit

Date: 2026-08-23
Scope: Audit-first round. Repository is ground truth; the Aug 23, 2026 real production session (Taryn video, multi-device) is the newest operational evidence and outranks older brainstorms, including "(documento antigo) o teto.pdf" — see §13. Two small, narrow, reversible code fixes were made this round (§4, §17); everything else is analysis and recommendation, not implementation.

---

## 1. Executive verdict

MindBunker's native domain model — `work_sessions`, Video Memory (via `crm_events`), the Historical Reference Layer (`hist_*`), and All History as a per-year query rather than a universal table — is fundamentally sound and does not need a schema change this round. The real production session on Aug 23 stress-tested this model under actual multi-device, multi-tool conditions for the first time, and it held: no duplicate sessions were possible (the database enforces exactly one open session globally), no historical evidence leaked into native tables, and the correction mechanism built in the immediately preceding round turned out to be exactly what was needed for the 3-minute Upwork/MindBunker gap that actually occurred.

What the session exposed were two real, narrow, code-level defects — not schema gaps. First, `WorkSessionPanel`'s client-side React state never re-synced with fresh server data delivered by `router.refresh()`, and `revalidatePath` (called after every mutation) only invalidates the *server's* cache, never reaches an already-open browser tab on a different device. The result: a device that wasn't the one pressing Stop could keep a stale "active" clock ticking indefinitely, materially misrepresenting whether time was still being tracked. Second, Video Memory's read path had no upper bound — every note ever written to a video rendered inline, in the same component that also handles fast capture, exactly reproducing the "the list distorted the page" complaint from real use. Both are fixed this round (§4, §17): a targeted, low-frequency poll plus a render-time state sync for the first; a client-side collapse for the second. Neither required a migration or touched a single data model.

Everything else this round surfaces is either already correctly deferred (the desktop Activity Sensor, Apple Watch quick-logging, a universal event table) or genuinely needs more operational evidence before a decision is justified (a richer client-review lifecycle state, a formal Production Run/Session Narrative entity). The one legacy artifact named in the brief, "(documento antigo) o teto.pdf," could not be located in any connected folder or project document this round (§13) — its ideas are neither adopted nor rejected here, because they were never actually read.

## 2. Repository ground truth

Verified directly this round, not carried over from prior documents:

- **`work_sessions`** (9 columns as of migration `0014`): `id`, `video_id` (FK → `video_logs.id`, `onDelete: restrict`), `started_at`, `ended_at` (nullable = open), `activity_type` (CHECK-constrained 8-value enum), `note`, `created_at`, `source` (open vocabulary, `WEB_TIMER` only in practice), `updated_at` (nullable, set only on correction). One global open session enforced by a partial unique index (`work_sessions_one_open_idx` on `(1) WHERE ended_at IS NULL`); `ended_at > started_at` enforced by a CHECK constraint. Actions: `startWorkSession`, `stopWorkSession`, `stopWorkSessionAt` (stale-session recovery), `correctWorkSession` (closed-session-only edit, audited via `crm_events`).
- **Video Memory**: not its own table — `crm_events` rows with `type: "video.note_added"`, `client_id: null`, `video_id` set. `getVideoOperationalMemory(videoId)` fetches **every** matching row with no `LIMIT`, ordered newest-first. `VideoMemoryPanel.tsx` is one client component doing both capture (a textarea + submit at the top) and full-history display (an unbounded `<ol>` below it) — confirmed by direct read, no pagination, no collapse, prior to this round's fix.
- **All History / Historical Reference Layer**: `hist_import_batches` (exactly one `ACTIVE` row enforced by a partial unique index), `hist_identities`, `hist_identity_source_labels`, `hist_facts`, `hist_source_coverage`. `getAllHistorySummary()` returns `[]` (not zeroed rows) when no batch is active — confirmed by reading `data.ts` directly. `importHistoricalArtifact()` exists, is tested, and has never been invoked against any real database — its one on-disk UI trigger (`src/app/all-history/_import/page.tsx`) sits in a Next.js "private folder" (`_import`) and is unreachable by routing at any URL, confirmed unchanged from the prior round's canonical map finding.
- **Video lifecycle**: `VIDEO_STATUS_TRANSITIONS` — `PLANNED → [IN_PROGRESS]`, `IN_PROGRESS → [READY_FOR_REVIEW, DONE]`, `READY_FOR_REVIEW → [CHANGES_REQUESTED, DONE]`, `CHANGES_REQUESTED → [IN_PROGRESS, READY_FOR_REVIEW]`, `DONE → [CHANGES_REQUESTED]`. Five states, confirmed unchanged from the prior round. No distinct "internal production" vs. "client review" split exists in code.
- **Analytics** (`src/modules/analytics/service.ts`): a `LeverageScore.breakdown.deepWorkBonus` field exists, computed as `Math.min(thisMonthVideoCount * 2, 100)` — an **output** count (videos delivered), with its own code comment reading `// Deep work bonus: placeholder (ActivityWatch integration future) // For now: +2 per video this month`. It does not read `work_sessions` at all today. No query anywhere in the codebase joins `work_sessions` to `transactions`, confirmed by direct search.
- **Client-side revalidation mechanics** (confirmed by reading every `router.refresh()` / `revalidatePath()` call site in the app, 13 files): `revalidatePath()` invalidates the Next.js server-side cache for a path — it affects what the *next* request to that path receives, on any device, but does nothing to a browser tab that is already rendered and sitting idle. `router.refresh()` is the client-side call that actually re-fetches a route's Server Component data for the tab that calls it. No `setInterval`-based polling existed anywhere in the app prior to this round's fix (grep confirmed one hit, the pre-existing 1-second UI clock tick in `WorkSessionPanel`, unrelated to server data freshness). No `useSWR`, no websocket, no realtime subscription of any kind exists in this codebase.
- **Tests**: 112/112 passing in the module suite (`src/modules/**/*.test.mjs`) both before and after this round's two fixes. Full-repo `tsc --noEmit`: clean. Scoped `eslint src/app/productivity`: clean. `git diff --check`: clean. Local production build (`next build`) and OpenNext/Cloudflare build: both clean, run against a plain-filesystem copy per the established FUSE-mount workaround.

## 3. Source precedence used

Applied per the brief's own hierarchy: the real repository (§2) outranked every prior document, including this session's own immediately preceding reports. Where the Aug 23 evidence and the repository agreed (the correction mechanism's value, the single-open-session invariant holding under real multi-device use), both are cited together. Where the brief's brainstorm sections (§4, §6, §7, §8 of the prompt) proposed future concepts, they were evaluated against the repository and current evidence, not implemented on the strength of the brainstorm alone. "(documento antigo) o teto.pdf" was sought and not found (§13) — it was given zero weight, not negative weight; nothing here was rejected *because* it might resemble something in that document, only accepted or deferred on independent evidence.

## 4. What the August 23 operation actually proved

Evidence-backed conclusions only, cross-referenced against the actual code:

- **The single-open-session invariant holds under real multi-device pressure.** The operator worked across a Mac Mini, a MacBook Air, and an iPhone with MindBunker open on more than one of them simultaneously. `work_sessions_one_open_idx` is a database-level partial unique index, not an application-level check — it is structurally impossible for two open sessions to exist regardless of how many devices race to start one. No duplicate-session defect exists or occurred. What the operator *did* experience is presentation staleness (below), which is a different failure mode from data corruption.
- **The 3-minute Upwork/MindBunker gap independently validates last round's correction mechanism.** The operator started Upwork's timer before starting MindBunker's, by roughly three minutes. This is exactly the class of honest, human-timing imprecision `correctWorkSession()` (built the previous round) exists to fix: the session's `started_at` can be corrected after the fact, with the correction logged as a `crm_events` row rather than silently overwriting history. This round did not need to build anything new for this — it needed to confirm the mechanism already fit the real failure mode, and it does.
- **Multi-device staleness is a real, demonstrated defect — and it is a presentation bug, not a persistence bug.** Confirmed by code reading (§2): `WorkSessionPanel` initializes its own React state from an `initialState` prop exactly once (`useState(initialState)` does not react to later prop changes), and nothing in the app previously re-fetched that state on an idle device. A device that wasn't used to press Stop had no mechanism — none — to learn the session had ended, short of a full page reload or its own next interaction. This is now fixed (§17).
- **Video Memory's write pattern was genuinely spontaneous, not schema-forced.** The operator used the existing free-text note field to log editing decisions, render attempts, an After Effects crash, aesthetic calls, and next-step reminders — categories the schema does not distinguish and was never asked to. This is real evidence that the field's current shape (one unstructured text blob per note) is being used exactly as intended, and that forcing structure onto it now would work against how it is actually being used.
- **Video Memory's read path breaking down under real volume was also directly observed**, not speculated: the operator's own account was that the growing note list distorted the video page. Confirmed independently by code reading — the list was genuinely unbounded (§2). Now fixed (§17).
- **Coarse activity classification friction was reported, not measured this round** — the operator's account that repeatedly stopping to reclassify activity would cost more than it's worth is a stated preference, consistent with (and not contradicted by) the existing `activity_type` model, which already asks for exactly one declaration per session, not per context switch. No code change follows from this because no code currently *requires* micro-reclassification — the concern is preventative, not a fix to a defect.

## 5. What it did NOT prove

Equally important, listed explicitly per the brief's instruction not to treat useful-eventually as sprint-worthy:

- It did **not** prove that a Production Run / Making-of / Session Narrative entity is needed. One operator, one video, one day of use is not evidence that the existing relationships (`work_sessions.video_id`, `crm_events.video_id` for notes) are insufficient to derive "how was this video made" as a read-time projection later. See §10.
- It did **not** prove a richer client-facing review lifecycle (internal production / ready for client review / client review / changes requested / approved / final) is needed. No client interaction happened during this session at all — it was pure internal production. The existing five-state lifecycle was not stressed in any direction that would justify expanding it. See §11.
- It did **not** prove a maximum-session-duration cutoff is needed — no session ran unreasonably long or was left open by accident this round (this echoes the same finding from the immediately preceding round's stale-session design, §7 of `WORK_SESSION_LEDGER_P1.md`, and remains true).
- It did **not** prove the Activity Sensor, Apple Watch integration, or any quick-logging device feature is ready to build. The operator's own exploration of lower-friction capture ideas is a stated future interest, not a demonstrated current bottleneck with real friction data behind it. See §12.
- It did **not** prove `analytics/service.ts`'s `deepWorkBonus` is currently producing a wrong or misleading number — it doesn't touch `work_sessions` today, so no output/input conflation is actually happening yet. What it proved is that the *name* is a latent risk for the day someone wires it to real tracked-time data (§9).

## 6. Historical/native boundary audit

No violation found, and no code from this round touches the boundary. Re-verified directly: `getAllHistorySummary()` queries only `hist_facts`/`hist_import_batches`/`hist_source_coverage`, scoped to the single `ACTIVE` batch; nothing in `work-sessions/`, `video-memory/`, or `crm/` imports from or writes to any `hist_*` table (confirmed by the existing structural test, still green: "Historical module code never references work_sessions — the tier boundary is structural, not just convention"). `canonical`/`confidence`/`EXPERIMENTAL` semantics on `hist_facts` are untouched. `UNKNOWN != ZERO` holds structurally: `getAllHistorySummary()` returns an empty array rather than a table of zeroes when nothing is imported, and `hist_source_coverage` status values (`DATA_PRESENT` / `UNKNOWN_NO_SOURCE_DATA`) are read as-is by the (currently unbuilt-against-real-data) All History page rather than being collapsed into a number. 2026 remains the one year where both reconstructed (`hist_facts`, still unimported) and native (`work_sessions`) evidence will eventually coexist — they are queried through entirely separate code paths today, with no shared table and no summation anywhere in the codebase.

## 7. Work Session audit

Correction semantics (built last round, re-verified this round against real use): only a **closed** session is editable — `CORRECT_WORK_SESSION_SQL`'s own `WHERE ended_at IS NOT NULL` guard makes the open session structurally unreachable by this path, so there is no code path where a live session's data can be quietly rewritten out from under it. Every correction that actually changes a field writes one `crm_events` row (`type: "work_session.corrected"`) describing only the fields that changed. This is sufficient provenance for "was this session ever corrected, and roughly what changed" — it is not a full before/after audit log, and that tradeoff (stated explicitly in the prior round's report) is unchanged and, per the Aug 23 evidence, adequate: the one real correction this data model needed to support (a 3-minute start-time adjustment) is exactly what it supports.

Duplicate/concurrent active sessions: **structurally impossible**, confirmed at the database level (§4), not merely believed to be impossible at the application level. This is the strongest invariant in the whole domain and nothing this round found threatens it.

Multi-device stale UI: real defect, root-caused precisely (§4), fixed narrowly (§17). Worth stating plainly what the fix does and does not do: it makes a device that currently believes it is showing the active session re-check with the server every 20 seconds. It does not make MindBunker realtime, it does not add any server push mechanism, and it deliberately does not poll for the (lower-severity) inverse case of "another device started a session I don't know about yet" — that case self-corrects immediately and loudly the moment this device tries to start its own session, via the existing database guard.

## 8. Video Memory audit

Write path: low-friction, unstructured, exactly as designed, and exactly as used in real production (§4) — no change made or recommended. Read path: was unbounded prior to this round (§2), now collapses to 5 entries with a "Show N more" expand, a pure client-side rendering change with zero data-layer or schema impact (§17). This directly matches the brief's own instruction ("Do NOT create a giant knowledge-management system... propose the smallest improvement") — the fix is intentionally not pagination with server round-trips, not search, not categorization; it is the smallest thing that stops a long note history from crowding the page.

One thing this audit explicitly did not do, per the brief's own caution: it did not normalize any note content into structured categories. The operator's crash reports, aesthetic decisions, and technical notes all remain one undifferentiated text field. Nothing observed this round justifies breaking that apart yet.

## 9. Multi-device consistency audit

Full diagnosis, stated once precisely: MindBunker's persistence layer (D1/SQLite via Cloudflare Workers) is not the source of the multi-device problem — every write is atomic, single-statement, and guarded (§4, §7). The problem lived entirely in the browser: React's `useState(initialState)` pattern intentionally ignores prop changes after first mount (this is standard React behavior, not a bug in React), and nothing in this codebase previously gave a mounted `WorkSessionPanel` a reason to re-render with fresh props on its own. `revalidatePath()` — called after every mutation across the whole app, correctly — only ever affects the *next* request to a path; it has no channel to reach a tab that isn't making a new request. This round's fix (§17) closes the loop for the one case with real operational cost (a phantom ticking clock), using the smallest mechanism that does so: a 20-second `setInterval` calling `router.refresh()`, paired with a render-time state sync (matching the same "adjust state during render" pattern already established in this exact file for the stale-session dismissal state) so the freshly-fetched server data actually overwrites the stale local belief instead of being silently ignored by `useState`'s first-mount-only semantics.

Explicitly not built, per the brief's own instruction: no websocket, no Server-Sent Events, no realtime subscription, no broadcast channel. If 20 seconds of possible staleness proves too slow in practice during the Aug 23–28 dogfooding week, the next escalation is a shorter interval, not a different architecture — that is a tuning question, not a design question, and should be evaluated against real friction, not assumed.

## 10. All History projection analysis

The existing design is already exactly what the brief asks for: "one view does not require one storage model." `getAllHistorySummary()` is a read-time projection over `hist_*` tables, scoped by year, sourced from whichever batch is currently `ACTIVE` — it is not, and was never, a universal event table, and nothing in this round's evidence argues for building one. The brief's speculative future list (native work sessions, Video Memory events, video lifecycle events, CRM events, health logs, future sensor aggregates, all visible through "one lens") remains exactly that — speculative — and should stay that way until there is a real question a human is trying to answer that the current per-domain surfaces (`/productivity/sessions` for work sessions, the Video Memory panel for notes, `/crm/[id]` for CRM history) cannot answer well enough on their own. Classification: **NEEDS MORE EVIDENCE.** The one concrete, low-risk preparatory fact worth recording: `crm_events` already has both `clientId` and `videoId` nullable, meaning it could technically host a future "personal/context event" with both null — but doing so would add a *fourth* consumer to a table already flagged as overloaded (CRM timeline, Video Memory notes, Work Session corrections), which is a reason for caution, not a reason to do it.

## 11. Temporal/provenance analysis

The provenance model this codebase actually needs already substantially exists, built incrementally across the last two rounds rather than in one sweep: `work_sessions` has `started_at`/`ended_at` (occurred_at, in the brief's terms), `created_at` (recorded_at), `updated_at` (correction metadata), and `source` (open vocabulary, single real value today). `hist_facts` has `confidence`, `canonical`, `provenance`, and `derivation_note` — a fully separate, deliberately incompatible provenance model for reconstructed evidence, which is correct given tier-1 and tier-3 facts mean different things and should carry different metadata shapes, not be forced into one. `crm_events` (serving CRM history, Video Memory, and now Work Session corrections) has only `createdAt` — no separate occurred-at/recorded-at split — but every event type it currently logs is created at the moment it describes (a note is written the instant it happens; a correction event is written the instant the correction is saved), so `createdAt` already functions as both without any actual gap between the two concepts for this table's current uses. This is not a defect to fix preemptively; it would become one only if `crm_events` were ever asked to log something that happened at one time and was recorded at a materially different one — no current use case does that. No new provenance columns are recommended this round.

## 12. Analytics semantic risks

One real, specific finding (§2, §5): `LeverageScore.breakdown.deepWorkBonus` is named for a concept (focused, uninterrupted work time) it does not currently measure (it measures videos delivered — pure output). Today this is harmless — it's honestly commented as a placeholder and doesn't touch `work_sessions`. The risk is entirely forward-looking: the name is an invitation for a future engineer (or a future round of this same assistant) to "complete" the placeholder by wiring it to `work_sessions` duration, at which point the score would start blending input (hours worked) and output (videos shipped) into one number under a name that already sounds like it measures effort rather than results — precisely the "OUTPUT != INPUT" conflation the brief's product principles warn against. Recommendation: when `deepWorkBonus` is eventually implemented for real, it should be renamed to reflect exactly what it computes (e.g., separate an actual time-based metric from the existing output-based one, or rename the existing field honestly), not implemented under its current name. No code change made this round — this is a naming/design note for a future implementer, not a demonstrated present-day bug, and does not meet this round's own bar for a narrow safe fix.

## 13. Legacy document conflicts

"(documento antigo) o teto.pdf" could not be located this round. Both folders connected to this session (`mindbunker` and `rmedia-historical-data-lab`) were searched recursively by filename and by extension (`find ... -iname "*teto*"`, `find ... -iname "*.pdf"`) — zero PDF files of any name exist in either. The project's 19 attached documents were searched by content (`project_search`) for related terms — no match. This document was not attached to the conversation this round either. Per the brief's own instruction, this file is historical design context only, never automatically authoritative — but that instruction presumes the file can be read and weighed. It could not be. **No claim in this audit is based on, or contradicts, "o teto"'s actual content**, because that content was never seen. If a future round has access to it, a dedicated pass comparing its specific proposals against the current repository (using the same precedence rules this brief lays out) would be the correct way to resolve this, rather than this document guessing at what it might contain.

## 14. Current invariants

Restated from what this round verified as still true, not new claims:

1. At most one `work_sessions` row may be open globally, enforced by a database-level partial unique index — not an application check.
2. A closed `work_sessions` row is editable only through `correctWorkSession()`, which cannot touch the open session and always writes a `crm_events` audit row for any field that actually changes.
3. Historical reconstructed evidence (`hist_*`) never writes to, and is never queried alongside, native tables (`clients`, `projects`, `video_logs`, `work_sessions`, `crm_events`).
4. `getAllHistorySummary()` returns absence (`[]`), never zero, when no historical batch is active.
5. `canonical: false` and `confidence: "EXPERIMENTAL"` facts are never summed into anything presented as a canonical aggregate (verified: no aggregation code exists yet at all for `hist_facts` beyond the per-year pass-through, so there is nothing today that could violate this — the invariant holds vacuously and should be re-checked the moment any new aggregation is built).
6. `importHistoricalArtifact()` has never been run against a real database, local or remote.

## 15. Proposed new invariants

New this round, based on what was actually found and fixed:

1. **A client-rendered panel that displays live, mutable server state (an open Work Session, an active timer) must not rely on `useState(initialState)` alone to stay correct across a multi-device session.** Either the component must sync from prop changes at render time, or it must not claim to represent live cross-device truth. `WorkSessionPanel` now does the former (§17); any future panel with the same shape (live state, multiple devices, mutation from elsewhere) should follow the same pattern rather than reinventing it.
2. **A read path over an unbounded, human-generated log (notes, events, history) must have a visible bound by default**, with an explicit action to see more. This is now true of Video Memory (§17); it should be the default assumption for any future similar surface (a future Session Narrative view, per §10, would need the same discipline from day one).
3. **A metric's name must not claim to measure something it does not yet measure.** `deepWorkBonus` (§12) is the counterexample this round found; it is flagged, not fixed, because renaming it now is out of this round's narrow-fix scope, but any future implementation of it must resolve the name before wiring it to real time data.

## 16. P0 / P1 / P2 / Deferred / Rejected roadmap

**P0 — correctness / data integrity**

None found this round requiring action. The single-open-session invariant, the correction-audit mechanism, and the historical/native boundary all held under real production use. This is a genuinely clean result, not an oversight — it reflects the prior two rounds' work being tested by real conditions for the first time and passing.

**P1 — immediate low-friction UX supported by real use (both implemented this round)**

1. **Multi-device Work Session staleness.**
   - Observed problem: a device not used to press Stop could show a session as active and ticking indefinitely after it was actually closed elsewhere.
   - Evidence: Aug 23 real multi-device session (Mac Mini / MacBook Air / iPhone, MindBunker open on more than one) plus direct code confirmation that no re-sync mechanism existed (§2, §9).
   - Affected files: `src/app/productivity/WorkSessionPanel.tsx`.
   - Proposed/implemented smallest intervention: a 20-second `setInterval` calling `router.refresh()`, scoped to only run while this panel's local state believes its own video's session is active; paired with a render-time sync of local `state` from the `initialState` prop (mirroring the file's existing `seenSessionId` pattern) so the refreshed data actually takes effect.
   - Schema impact: none. Migration impact: none.
   - Risk: very low — bounded to one panel at a time (only one video can ever show as locally-active), 20-second cadence, no new dependency, no server load beyond what `router.refresh()` already costs for a normal navigation.
   - Rollback: revert the two `WorkSessionPanel.tsx` edits; no data or schema to unwind.
   - Acceptance test: (manual, dogfooding week) start a session on device A, let device B load the same active video, stop the session on device A, confirm device B's clock and Stop button reflect the stop within ~20 seconds without any interaction on device B. Automated test coverage was not added for this because it's a pure client-rendering/timing behavior with no server-side logic branch to unit test — the existing 112 module tests (server/DB-focused) are unaffected and still pass.
   - Why now: directly demonstrated, real operational cost (a misleading "still tracking" signal) during actual paid production work. Why not deferred: the fix is a few lines, no risk, matches the brief's own explicitly-permitted narrow-fix category verbatim ("clearly stale query invalidation after stop/start").

2. **Video Memory unbounded read list.**
   - Observed problem: every note ever written to a video renders inline in the same panel used for fast capture, and the list grows without bound.
   - Evidence: Aug 23 operator's own account that the growing list "distorted the video page," plus direct code confirmation of the unbounded query (§2, §8).
   - Affected files: `src/app/productivity/VideoMemoryPanel.tsx`.
   - Proposed/implemented smallest intervention: collapse the rendered list to the 5 newest entries with a "Show N more" / "Show fewer" toggle — pure client-side rendering, the data fetch itself is unchanged.
   - Schema impact: none. Migration impact: none.
   - Risk: very low — no data ever becomes unreachable (expand always shows everything the query already fetched), no new request path.
   - Rollback: revert the `VideoMemoryPanel.tsx` edit.
   - Acceptance test: (manual) a video with more than 5 notes shows exactly 5 with a "Show N more" button; clicking it reveals the rest; a video with 5 or fewer notes shows no toggle at all.
   - Why now: directly demonstrated during real production, matches the brief's explicitly-permitted "obvious pagination/collapse UI issue" category verbatim. Why not deferred: same reasoning — trivial, safe, already-observed friction.

**P2 — observability / queryability**

3. **`deepWorkBonus` naming risk.** Not fixed this round (§12) — documented as a note for whoever eventually wires it to real data. No files changed.

**DEFERRED — useful but not yet earned**

4. Production Run / Session Narrative projection (§10) — existing relationships (`work_sessions.video_id`, Video Memory `crm_events.video_id`) already appear sufficient to derive this later as a read-time view; no new entity justified by one day of evidence.
5. Richer client-facing review lifecycle states (§11) — no client interaction occurred this round to stress the existing five-state model in either direction.
6. A dedicated quick-event/context-log table for future coffee/walk/cycling/Apple Watch capture (§12 of the brief, §10 of this doc) — `crm_events`'s nullable `clientId`/`videoId` already make this technically possible without a schema change, which is enough to defer a decision, not enough to justify building it before a real capture mechanism exists.
7. Renaming/rebuilding `deepWorkBonus` into an honest time-based metric — deferred until an actual Activity Sensor or `work_sessions`-derived signal exists to back it.

**REJECTED — complexity without evidence**

8. A universal historical/native event table for All History (§10) — the brief's own instruction already assumes the opposite by default, and nothing this round found argues otherwise.
9. Realtime/websocket multi-device sync (§9) — 20-second polling directly and adequately addresses the one demonstrated failure mode; a persistent connection would be new infrastructure to solve a problem a `setInterval` already solves.
10. A maximum Work Session duration cutoff — re-affirmed rejected for the same reason the immediately preceding round rejected it: zero observed forgotten-session incidents across two consecutive real dogfooding periods now.

## 17. Schema recommendation: NONE / SMALL ADDITIVE / DOMAIN CHANGE

**NONE.** Every finding this round that required a code change (§16, P1 #1 and #2) was resolvable entirely in client-side rendering and revalidation logic, with zero schema or migration impact. The two fixes actually made:

- `src/app/productivity/WorkSessionPanel.tsx`: added a render-time sync of local `state` from the `initialState` prop (so fresh server data actually overwrites stale local belief instead of being ignored by `useState`'s first-mount-only semantics), and a 20-second polling `useEffect` (`router.refresh()`) scoped to only run while this panel's local state currently shows its own video as the active session.
- `src/app/productivity/VideoMemoryPanel.tsx`: collapsed the rendered note list to 5 entries by default with an expand/collapse toggle; the underlying data fetch is unchanged.

Both verified: `npx tsc --noEmit` clean (full repo), `npx eslint src/app/productivity` clean, `git diff --check` clean, full module test suite 112/112 passing (unaffected, as expected — neither change touches tested server/DB logic), local Next.js production build clean, OpenNext/Cloudflare Workers build clean.

No table was added, altered, or dropped. No migration was generated. No historical/native boundary was touched. No lifecycle semantics changed.

## 18. Exact recommended next round

**Narrow execution prompt for the next round**, scoped tightly per this audit's own DEFERRED list — do not expand it without new evidence:

> "Run the Aug 23–28 dogfooding week's remaining human QA tests (per `docs/architecture/WORK_SESSION_LEDGER_P1.md` §14) with this round's two fixes in place. Specifically confirm: (a) the 20-second multi-device refresh actually resolves the stale-clock problem in real cross-device use, and whether 20 seconds feels right or needs tuning; (b) whether the Video Memory 5-entry collapse is the right default count once a video accumulates a full week of real notes. Do not build the Activity Sensor, Apple Watch integration, Production Run entity, or any richer video-review lifecycle unless this week's real use produces concrete evidence that one of them is now blocking real work — report what was and wasn't needed, don't build ahead of the evidence."

## 19. Open questions that genuinely require more operational evidence

1. Is 20 seconds the right multi-device refresh cadence, or does real cross-device dogfooding show it's too slow (operator notices staleness) or unnecessarily frequent (no one is actually watching a second device closely enough to notice)?
2. Does the Video Memory 5-entry collapse feel right once a video has accumulated a realistic week's worth of notes (not just this round's small test volume), or should the default be higher/lower?
3. Does the operator's stated friction with activity micro-classification (§4) ever become acute enough to justify a UI change, or does the current "declare once per session" model remain sufficient indefinitely?
4. Will a real client review cycle (once one actually happens) reveal that the current five-state video lifecycle is too coarse, or does `READY_FOR_REVIEW` → `CHANGES_REQUESTED` already carry enough information for how Rosa Media actually works with clients?
5. Is there a concrete, near-term Apple Watch / quick-logging use case forming, or does that remain a stated future interest with no real friction behind it yet? This determines whether §12/§16's deferred quick-event table decision needs revisiting soon or can stay open indefinitely.
6. Can "(documento antigo) o teto.pdf" be made available to a future round (uploaded to the conversation or placed in a connected folder)? Its ideas remain fully unevaluated against current evidence until it can actually be read.
