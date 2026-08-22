# MindBunker Video Lifecycle — Gate 11 Checkpoint

Date: 2026-08-21

## Production reconciliation

- Existing migrations `0004`–`0006` were applied and verified before this implementation round.
- Production remains at `0006`; no lifecycle migration and no application build from this round was deployed.
- The single production client and both legacy `video_logs` rows (IDs 2 and 3) survived the reconciliation with their historical values intact.
- Recoverable D1 export: `/Users/emmanueldarosadillenburg/Desktop/Prototipos/backups/mindbunker-d1-d6ada5db-1f36-4ee9-9a05-01d131abf219-20260821T222533Z.sql`
- Backup size: 3,008 bytes. SHA-256 reverified unchanged: `334994cb552a3f808f64eea57f787bc5a5c5b517a65779f2eed5f0607f93e554`.

## Local schema changes

- `0007_overrated_landau.sql`: adds authoritative `video_logs.status`, defaults future rows to `PLANNED`, explicitly backfills existing rows to `DONE`, and adds nullable `started_at`.
- `0008_nappy_skrulls.sql`: adds nullable `crm_events.video_id` with `ON DELETE SET NULL` and an audit lookup index.
- `0009_colossal_phantom_reporter.sql`: makes `crm_events.client_id` nullable while preserving existing rows and indexes, allowing legacy and standalone videos to remain auditable.
- The full migration chain `0000`–`0009` applied successfully to a fresh isolated local D1. `PRAGMA foreign_key_check` returned no violations.

## Lifecycle semantics

- States: `PLANNED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `CHANGES_REQUESTED`, `DONE`.
- Status changes use an explicit validated transition action with stale-write rejection. Metadata updates cannot change status.
- `DONE → CHANGES_REQUESTED` reopens the same stable `video_logs.id` and emits `video.reopened`.
- `started_at` is set on the first transition to `IN_PROGRESS` and retained afterward.
- Only `DONE` contributes to completed-output and completed revision-drag analytics.
- `delivered` remains compatibility debt. Every application write derives it from status (`DONE = true`, all other states = false); new business logic uses `status` only. The inherited SQL default on `delivered` remains `true`, but all active application write paths set it explicitly.

## Operator workflow

- Productivity now supports creating a planned video or logging an already-finished video.
- Clicking a video title opens its editor. Title, client, project, and notes are editable without replacing the row.
- Lifecycle buttons are separate from metadata save controls.
- Project/client ownership and archived-project rules are validated server-side.
- Mobile cards and desktop rows show lifecycle status. Finished Video warns the operator to finish an existing in-progress identity instead of creating a duplicate.
- A responsive-state bug found during QA was fixed: opening either the mobile or desktop editor now rehydrates from the latest server props, preventing stale metadata from overwriting a newer edit.

## Audit history

- Stable event types added: `video.created`, `video.started`, `video.ready_for_review`, `video.changes_requested`, `video.finished`, `video.reopened`, and `video.updated`.
- One submission changing multiple metadata fields emits one compact `video.updated` event.
- A no-op metadata save emits no event. A replayed lifecycle target emits no duplicate event.
- Events link to the stable video ID. Deleting a video leaves historical events and sets `video_id` to `NULL`.

## Analytics consumers corrected

- `src/modules/analytics/service.ts`
- `src/utils/statistics.ts`
- `src/modules/productivity/actions.ts`
- `src/modules/projects/actions.ts` and the project UI now expose status without filtering useful inventory.

Regression coverage uses the same date range with one row in each of the five lifecycle states and asserts completed output equals one.

## Validation

- Tests: 27 passed, 0 failed.
- ESLint: passed.
- TypeScript: passed.
- Next.js production build: passed.
- OpenNext Cloudflare runtime build: passed; no deploy command was run.
- Fresh local D1 migration chain `0000`–`0009`: passed.
- Default local D1: migrations `0007`–`0009` applied; no remote flag used.
- Browser QA: full stable-ID lifecycle exercised at 390×844 and 1440×900, including edit, changes requested, finish, reopen, and finish again. Completed counters changed only while status was `DONE`; browser warnings/errors were empty.
- Exact fictitious browser-QA video, project, and client rows were deleted afterward and their absence verified.

## Deferred debt and scope

- Revision history remains deferred; `revisions_count` is still mutable compatibility state.
- `delivered` remains until every old consumer is proven removed.
- Calendar/Meet, Wise/offers, Slack/onboarding, `/client` integration, Drive/YouTube sync, Health, Finance, Smart Brief, Brand Log, Approval Pattern Memory, and advanced BI were not changed.

## Production status

Migrations `0007`, `0008`, and `0009` and the new application bundle are pending explicit approval. Before any remote mutation: reverify `wrangler whoami`, take a fresh D1 export, verify its SHA-256, apply migrations through Wrangler's migration mechanism, verify data and audit invariants after each new migration, then deploy only after a separate application-code approval.

## Gate 11.5 rollout review

- Migration `0009` now uses D1-compatible `PRAGMA defer_foreign_keys=ON/OFF`; it no longer attempts to disable `foreign_keys` inside D1's implicit transaction.
- `0008` and `0009` remain separate. `0008` is additive and does not rebuild `crm_events`; `0009` is the only rebuild. Combining them would not remove a rebuild and would erase the clearer additive/rebuild audit boundary.
- A populated isolated D1 was migrated through `0008`, seeded with three fictitious `crm_events` rows using IDs `7`, `12`, and `13`, and then migrated through corrected `0009`. All values and IDs survived; `sqlite_sequence` remained `13`; both indexes were recreated with their original column order; `client_id` became nullable; client deletion remains `CASCADE`; video deletion remains `SET NULL`; no `__new_crm_events` table remained; `PRAGMA foreign_key_check` returned zero rows.
- A second clean isolated D1 applied the complete `0000`–`0009` chain through Wrangler. Its migration ledger contains exactly those ten migrations in order and its final foreign-key check is clean.
- `ops/maintenance-worker.js` and `wrangler.maintenance.jsonc` provide the write freeze for production. The maintenance version returns `503`, `Retry-After`, `Cache-Control: no-store`, and `X-MindBunker-Maintenance: active` for every HTTP method. Its Wrangler version-upload dry run and GET/POST behavior checks pass.
- The lifecycle OpenNext version and maintenance version must be uploaded before the freeze. Production then switches atomically to 100% maintenance traffic, waits for repeated GET and POST `503` checks plus an in-flight-request drain, and applies the migrations. The lifecycle version is then added to the deployment at 0% and smoke-tested through Cloudflare's explicit version-override header while ordinary traffic remains 100% on maintenance. Only after data and application checks pass does lifecycle move to 100%. The legacy Worker must never be restored against schema `0007+`; rollback after the first migration requires keeping maintenance active, restoring D1 to the pre-flight bookmark, and only then restoring the legacy Worker.
