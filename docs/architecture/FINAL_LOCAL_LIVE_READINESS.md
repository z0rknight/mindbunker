# MindBunker — Final Local Ingest / Live Readiness Round

**Scope:** local-implementation-only round. No production deploy, no remote D1 mutation, no `--remote` flag used anywhere, no application redesign, no speculative systems. This document is the required deliverable for that round.

---

## 1. Forensic starting state (§0)

Before any edit, the repository and local D1 were inspected directly (not from memory):

- `git status`: working tree had **96 pending changes** (42 modified, 54 untracked) already present from prior, unrelated rounds (Sunday Systems, Monday Money Lab, Pricing Lab, Sensor P1, Client Portal Identity, Geladeira, All-History, Taryn August Ingest Readiness — the immediately preceding round). None of these were touched, reverted, or overwritten by this round; all edits in this round are additive on top of that pre-existing dirty state.
- `git log --oneline -10`: HEAD is `02e52bc` ("WIP: full Monday Local Intelligence Lab"), on `main`.
- Migration chain: `0000_ancient_callisto.sql` … `0022_pale_forge.sql` were already applied and in sync (`drizzle-kit generate` reported "No schema changes, nothing to migrate" before this round's schema edit). `wrangler d1 migrations list mindbunker --local` reported **no pending migrations**.
- Local D1 (`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`) was read directly with `node:sqlite` (bypassing D1's PRAGMA restriction on `wrangler d1 execute`). Confirmed the real client **Taryn Dubreuil** (id 990002) with five real Projects, including **Bonnie - Content Waterfall** (id 990020) holding the 9 real videos referenced in §18 — 3 already had delivery URLs (Bonnie Content Waterfall_1, _3, _9), 6 did not. This matched §18's fixture description exactly.
- A fresh **local D1 checkpoint** was taken before any schema change: `.round-logs/d1-checkpoint-before-briefC-schema-20260824-120825.sqlite`.
- Confirmed and preserved: local dev port assumption unchanged (no script/config in this repo hardcodes a port; nothing in this round touched `package.json`'s `dev`/`start` scripts or any port-related config). Sensor endpoint/config/ingestion code was not opened or modified. No `--remote` flag was used at any point.

---

## 2. Root causes identified

| Symptom (from real QA) | Root cause |
|---|---|
| Operator forgot where Projects was, twice | Projects sat between Pricing Lab and All History in the sidebar, far from Productivity; `/projects` had no creation entry point at all — the only way to create a Project was via a specific Client's CRM tab. |
| 9 Bonnie videos typed as `_1`…`_9` by hand | "Add Multiple Videos" only supported manual repeatable rows; no sequence generator existed. |
| Only 3 of 9 links entered | Bulk creation had no URL fields at all; entering a link required opening each Video individually, saving, and navigating back into Productivity — the loop the operator described as unacceptable at volume. |
| Bulk-created videos always `PLANNED` | `createVideoLogsBulk` hardcoded `status: "PLANNED"`, and `validateVideoCreateInput` rejected any other status unconditionally — a deliberate invariant from the immediately preceding round that this round's brief explicitly and more precisely asked to widen for the bulk path only. |
| Bonnie videos appeared in a confusing order | `getProjectWorkspace` ordered videos by `updatedAt`/`createdAt`, not by name; no natural (numeric-aware) sort existed. |
| Closing a Video opened from a Project workspace always landed on Productivity | `VideoEditor.closeEditor()` hardcoded `router.replace("/productivity")` whenever the editor was opened via a `?video=` query param, regardless of where that link originated. |
| Client header showed "ACTIVE" twice | `crm/[id]/page.tsx`'s header rendered `OPPORTUNITY_STAGE_LABELS[client.opportunityStage]` as its own badge, and `OpportunityPanel` (rendered immediately below) rendered the *exact same* label again in its own header. When a client's opportunity stage is literally `"active"` (label "Active") — the common state for an established client like Taryn — both badges read "Active" side by side. |
| Active Projects felt buried | Reachable only inside the Projects tab of the CRM client page, several clicks/scrolls down. |

---

## 3. Implementation by priority

### P0

- **§1A/B — Projects as a primary work surface.** Sidebar: `Projects` moved immediately after `Productivity` (`src/components/layout/Sidebar.tsx`) — a one-line reorder, no other item moved. `/projects`: added `NewProjectButton` (new file), a client-picker wrapped around the **existing** `ProjectForm` + `createProject(clientId, values)` action — no parallel project model. On success it redirects straight into the new Project workspace. The CRM's own project-creation path (`ProjectManager`) is untouched and still works.
- **§2 — Bulk ingest sequence generator.** `BulkAddVideosButton.tsx` rewritten with a Mode A (Manual rows, unchanged) / Mode B (Generate sequence: prefix, quantity, starting number, separator, optional zero-pad, live preview, "Generate rows") toggle. Generated rows populate the same editable `rows` state Mode A uses — not a separate persistence path.
- **§3 — Explicit historical status for bulk ingest.** `validateVideoCreateInput` (`modules/productivity/core.ts`) now takes an optional `allowExplicitStatus` flag. Unset/false (every existing single-create call site: `createVideoLog`, `NewWorkButton`, `PlanVideoButton`) behaves **exactly as before** — PLANNED-only. `createVideoLogsBulk` now passes `allowExplicitStatus: true` and accepts a per-row status (falling back to a batch default, itself defaulting to `PLANNED`). An invalid/missing status is still rejected outright — never silently inferred as completion. The test this round's brief explicitly authorized changing (`"new video status is explicit and cannot silently become completed"`) was **not weakened**, only kept scoped to the single-create path; a new, additional test (`"explicit historical/bulk ingest may set a later canonical status, but never silently"`) covers the widened bulk path.
- **§4/§5 — Links + shared batch link.** Bulk rows carry an expandable "Status & links" section with Delivery/Watch URL and Review URL, reusing the existing `deliveryUrl`/`reviewUrl` columns and validators — no new URL fields. A batch-level "Link mode" toggle (Individual / Shared batch link) lets the operator enter one URL once; on submit it is written to every row's `deliveryUrl` (the existing canonical field), with no new storage abstraction.
- **§6 — Batch label.** Added a nullable `batch_label` column to `video_logs` (migration `0023_panoramic_firedrake.sql`, a single additive `ALTER TABLE`). An optional "Batch label" field on the bulk-create form is inherited by every row in that submission. The Project workspace video list displays it as a small badge next to each video that has one.
- **§7 — Project workspace bulk-edit.** New `ProjectVideoList` (selection UI, checkboxes + "Select all") and `BulkEditVideosButton` (modal) components, backed by a new `updateVideoLogsBulk` action. Every field in the edit modal is **off by default**; the operator must explicitly turn a field on before it is included in the patch. Delivery URL, Review URL, and Batch label additionally offer an explicit "Clear" control, distinct from leaving the field off — an empty text box with the field off never erases anything. The action performs a single `UPDATE ... WHERE id IN (...)` — it never inserts or deletes, so video IDs and row count are always preserved, and the UI shows the affected row count before save.
- **§8 — Post-save navigation.** New `src/utils/navigation.ts` with `isSafeInternalPath()` — the single gate for the `returnTo` mechanism (rejects protocol-relative `//`, embedded `://`, backslashes, control characters, and anything not starting with a bare `/`). Project video links now carry `&returnTo=/projects/{id}`; `/productivity/page.tsx` validates it server-side before ever forwarding it; `VideoEditor.closeEditor()` honors it when present and otherwise falls back to `"/productivity"` exactly as before — the Productivity → Video → close path is unchanged.

### P1

- **§9 — Natural video ordering.** `sortProjectWorkspaceVideos` + `naturalCompare` (new, in `modules/projects/core.ts`) order by batch label, then historical date, then a numeric-aware natural string comparator, then id as a final deterministic tiebreak. `getProjectWorkspace` now returns videos through this sort. Verified `_2` sorts before `_10`.
- **§10 — Read-only Project references in the Video workspace.** New `ProjectReferencesPanel`, rendered inside `VideoEditor` whenever the video has a project. Fetches lazily (only while the editor is open) via the exact same `getSourceMediaForProject` action the Project workspace's own `SourceMediaPanel` already uses — no duplication, no copy into the Video, no desktop-app deep linking (documented below as future work).
- **§11 — CRM client page.** (A) Removed the duplicate opportunity-stage badge from the page header (root cause above); `OpportunityPanel` remains the single place that stage renders. (B) Added a compact "Active projects" block right below the header, reusing the `projects` data already fetched for `ProjectManager` — no new query — each entry links straight into its Project workspace. Compact operational metrics (active project count, videos, tracked hours) already existed via `ClientIntelligencePanel` and needed no new work. No new Clients module, no CRM redesign, no health scoring.
- **§13 — Work Session Ledger → Sensor detail link (trivial, done).** `sensor_sessions.approved_work_session_id` is a unique reverse-lookup already in the schema. Added one `LEFT JOIN` to `WORK_SESSION_HISTORY_SQL`, threaded `sensorSessionId` through `mapHistoryEntry`, and added one conditional link in `WorkSessionHistoryTable.tsx` to the existing `/productivity/sensor/sessions/[id]` route. No Sensor UI duplicated, no Sensor ingestion/endpoint/approval code touched.

### Explicitly deferred (per the brief)

- **§12 — "View as client" auth parity.** Not touched. No obvious tiny bug was found; true client-context preview / login parity is recorded as post-live product work.
- Batch analytics, throughput metrics, a client batch portal, and a separate batches table were **not built** — the batch label is a single nullable scalar column, exactly as directed.
- Desktop-app deep linking from the Video workspace's Project References panel — documented as future work, not built.

---

## 4. Schema & migrations

One additive migration this round:

```sql
-- 0023_panoramic_firedrake.sql
ALTER TABLE `video_logs` ADD `batch_label` text;
```

Verification performed, in order:
1. `npx drizzle-kit generate` — produced exactly this one file; re-run afterward reports **"No schema changes, nothing to migrate."**
2. Full migration chain (`0000`…`0023`) replayed against a scratch **in-memory** `node:sqlite` database from scratch: all 24 files applied cleanly, `PRAGMA foreign_key_check` returned 0 rows, `PRAGMA integrity_check` returned `ok`.
3. Applied for real: `wrangler d1 migrations apply mindbunker --local` — succeeded, one migration applied.
4. Re-read the live local `.sqlite` file directly: `batch_label` column present on `video_logs`; `PRAGMA foreign_key_check` still 0 rows; row counts unchanged from before the migration.

No table recreation was needed (D1's `PRAGMA foreign_keys=OFF` limitation, documented in an earlier round, was avoided the same way as before — additive `ALTER TABLE`/`CREATE INDEX` only).

---

## 5. Test results

- `npm test` (Node's built-in test runner, now also covering `src/utils/**/*.test.mjs` — added because the new `isSafeInternalPath` helper lives there): **255 passing, 0 failing** (up from 243 before this round: 12 new tests added — 2 for `isSafeInternalPath`, 1 widened status test, 3 natural-sort tests, 6 bulk-ingest/bulk-edit integration scenarios).
- One pre-existing, unrelated integration test (`work-sessions/integration.test.mjs`) hand-rolls a minimal schema and broke when §13's new `LEFT JOIN sensor_sessions` was added to `WORK_SESSION_HISTORY_SQL`, because that fixture's schema didn't include a `sensor_sessions` table. Fixed by adding the minimal shape of that table to the fixture (not by removing the join) — the fix is additive to the test fixture, not a weakening of any assertion.
- All 20 of §17's required scenarios are covered — either by a new/updated test or, where the scenario is a UI-only or already-covered regression, by an explicit code-inspection note in the new integration test file's coverage map (`src/modules/productivity/bulk-ingest-brief-c.integration.test.mjs`).
- `npx tsc --noEmit`: **clean, zero errors.**
- `npx eslint src --quiet`: **clean, zero errors/warnings**, full repo.
- `next build --webpack`: attempted twice. The build worker did not complete within this environment's per-command execution ceiling, and — as documented in the previous round — background processes do not persist across separate tool invocations in this device-bridge environment, so an end-to-end build could not be run to completion here. This reconfirms, rather than newly discovers, the FUSE-related dev/build limitation already recorded in `docs/architecture/TARYN_AUGUST_INGEST_READINESS.md`. It is not evidence of a code defect: typecheck, lint, and the full test suite are all clean, and the same limitation applied identically before this round's changes.

---

## 6. Local D1 integrity & real data preserved

Post-migration direct read of the live local `.sqlite` file:

- `PRAGMA integrity_check`: `ok`. `PRAGMA foreign_key_check`: 0 rows.
- Row counts unchanged from before this round for every table (`video_logs`: 17, `clients`: 3, `projects`: 7, `sensor_sessions`: 8, `work_sessions`: 9, etc.).
- The real **Bonnie - Content Waterfall** videos (ids 9211–9219) are byte-for-byte as they were: same titles, same statuses (`PLANNED`), the same 3 of 9 `delivery_url` values populated and the same 6 left `null`, `batch_label` still `null` on all of them (nothing was fabricated or backfilled onto pre-existing rows — the new bulk-ingest/bulk-edit features only affect data an operator explicitly submits through them going forward).

No existing real or QA data was deleted, mutated, or backfilled by this round.

---

## 7. QA / test artifacts observed (not touched)

- Client **Taryn Dubreuil** has a project named **"Taryn - Content Waterfall"** (id 990019) with zero videos — appears to be a leftover from QA experimentation, distinct from the real "Bonnie - Content Waterfall" project. Left exactly as-is; flagged here for the operator's awareness, not silently cleaned up.
- The two phantom finance transactions reported in the previous round's document remain exactly as previously documented — not re-touched this round (out of scope; Finance was frozen except for regression testing).

---

## 8. Sensor regression status (§14 freeze)

Sensor ingestion, endpoint, port behavior, approval semantics, evidence correlation, and provenance rules were **not opened or modified**. The only Sensor-adjacent change is §13's one-column `LEFT JOIN` reverse-lookup in a Ledger query, which reads `sensor_sessions.approved_work_session_id` — it does not write to Sensor tables and does not touch `src/modules/sensor/*` or `src/app/productivity/sensor/*`. All existing Sensor-related tests pass unchanged as part of the 255-test green suite.

---

## 9. Production / remote confirmation

- No `wrangler ... --remote` command was run.
- No `deploy`, `upload`, or `preview` npm script was run.
- No production D1 (`d6ada5db-1f36-4ee9-9a05-01d131abf219`) was touched — every migration and query in this round targeted `.wrangler/state/v3/d1/...` (the local Miniflare D1 file) exclusively, verified by re-reading that exact file directly after every mutation.

---

## 10. Human QA checklist

1. Open `/projects` — confirm "+ New Project" is visible without navigating through CRM; create a project for an existing client and confirm redirect into its workspace.
2. Open the Project workspace for **Bonnie - Content Waterfall** — confirm the 9 videos appear in natural order (`_1`…`_9`, not lexical), and that the 3 real delivery links are still exactly the ones entered during the original QA session.
3. In that same Project, use "+ Add Multiple Videos" → Generate sequence → prefix `Test Batch`, quantity 5, starting number 1 → confirm the live preview and generated rows are correct and individually editable before submit.
4. Set a batch default status other than Planned (e.g. Delivered), submit, and confirm every generated row lands in that status while one manually-overridden row keeps its own choice.
5. Try both Link modes: enter a shared batch link once and confirm it lands on every created row; then create a second batch with Individual links and confirm each row's own link is used.
6. Select several videos in the Project workspace → "Edit selected" → change only the status → save → confirm delivery/review URLs on those videos are untouched.
7. Open a Video from inside a Project, close it, and confirm you land back in that Project (not Productivity). Then open a Video directly from Productivity, close it, and confirm you land back in Productivity.
8. Open a Video that belongs to a project with Source Media References already entered — confirm the read-only "Project source references" panel shows them with a clickable source URL.
9. Open the Taryn Dubreuil CRM page — confirm "ACTIVE" (or the current opportunity stage) now appears only once, and that an "Active projects" block is visible near the top linking directly into each active project.
10. Open the Work Session Ledger — for any session captured via Sensor, confirm a "Sensor detail →" link is present and opens the existing Sensor Session detail page.

---

## 11. Live-readiness audit (report only — the plan below is NOT executed)

### A. Code
- Working tree still carries the pre-existing 96 pending changes from prior rounds (see §1) plus this round's edits, all uncommitted on `main`. Nothing in this round was committed to git (no `git commit` was run — none was requested).
- `.dev.vars` (local secrets, git-ignored) vs `.dev.vars.example` (template, checked in): the template names exactly two required variables — `AUTH_PASSWORD_HASH`, `AUTH_SESSION_SECRET`. No local-only assumption beyond that was found in code touched this round.
- No new hardcoded `localhost` or port literal was introduced by this round; `package.json`'s `dev`/`start` scripts are untouched.
- `wrangler.jsonc` already declares the production route (`emmanueldarosa.com/mindbunker*`) and the D1 binding (`DB` → database `mindbunker`); neither was edited this round.
- Auth/session: unchanged — this round added no new authenticated surface; all new actions (`createVideoLogsBulk` extensions, `updateVideoLogsBulk`, `createProject` reuse) go through the existing `getAuthenticatedDb()` gate exactly like every other admin action in the codebase.

### B. Data
- Local D1 currently holds a mix of real business data (Taryn Dubreuil and her real Projects/Videos, the two other real clients) and clearly-synthetic QA/integration fixtures from prior rounds (the Taryn August Reality Test fixtures, the empty "Taryn - Content Waterfall" project noted in §7, historical-import test rows under `hist_*` tables — 209/47/50/132 rows respectively, whose provenance as real-vs-test data was not re-audited this round and should be confirmed before any import).
- IDs/FKs: the real Taryn data uses a distinct, high, deliberately-separated ID range (990000s for clients/projects, 9200s for videos) that appears to have been chosen specifically to avoid collision with lower-numbered synthetic/seed rows — this makes a curated, ID-preserving import plausible, but was not re-verified against every table this round.
- Importing local D1 wholesale would also import the QA/test artifacts noted in §7 and any other synthetic fixtures — **not recommended**. The safest strategy is a curated export (by explicit client/project ID allow-list) rather than a full-file copy.

### C. Sensor
- Must remain local/Mac-side: the physical Sensor device credential flow, keychain-stored token, and local capture process.
- Must target live after deployment (config only, not executed): the Sensor's configured ingestion endpoint would need to point at the deployed Worker URL instead of `localhost`. This round did not locate or modify that configuration — it should be identified and documented (variable name only) before the live-promotion round touches it.
- Must NOT be copied to production: any local sensor device registration rows tied to this specific Mac's hardware identity, unless deliberately re-registered against production.

### D. Secrets
Required environment variables/bindings identified by **name only** (values never read or printed):
- `AUTH_PASSWORD_HASH`
- `AUTH_SESSION_SECRET`
- D1 binding `DB` (already configured in `wrangler.jsonc`, database id present in that checked-in file, not a secret value)
- Any Sensor-endpoint-target variable (name not yet located this round — flagged for the next round to identify, per §C above)

### E. Deployment plan for the NEXT round (NOT executed here)
1. Back up production (D1 export + current deployed Worker version reference).
2. Apply production migrations (`wrangler d1 migrations apply mindbunker --remote`) — after this round's `0023` migration is reviewed.
3. Deploy code (`opennextjs-cloudflare build && opennextjs-cloudflare deploy`).
4. Verify health/auth on the deployed URL before any data migration.
5. Migrate/import curated data — a client/project ID allow-list export (not a wholesale local-D1 copy, per §B above).
6. Reconcile IDs/FKs between local and production if any collision is found.
7. Point the Sensor at the live endpoint (config change only, on the Mac side).
8. Smoke test the full ingest workflow end-to-end against production.
9. Establish rollback checkpoints (D1 backup + Worker version pinning) before declaring the promotion complete.

**This plan is not executed. No production deploy, no remote D1 mutation, and no `--remote` flag were used anywhere in this round.**

---

## 12. Stop condition

The round's target workflow is now achievable end-to-end: Projects → New Project → Add Multiple Videos → Generate "Bonnie Content Waterfall_1…9" → set historical date → set explicit historical lifecycle status → paste individual or shared delivery/review links → optional batch label → Create → remain in Project → bulk-correct metadata later without opening nine workspaces → open one Video and see its Project references → return to Project. No further polishing, redesign, Sensor expansion, batch analytics, or dashboard work was added beyond this scope.

**MINDBUNKER FINAL LOCAL INGEST READY FOR LIVE PROMOTION REVIEW**
