# RMEDIA Pre-Wave 1 — Local execution closure

Date: 2026-10-07  
Verdict: **GREEN — LOCAL CANDIDATE / NO DEPLOY**

## Boundary

This pass reconciles the current RMEDIA capture path before Wave 1. It does not deploy MindBunker, apply migration `0054` to production, replace the installed RMEDIA app, write production D1 data, or introduce a new execution entity.

Canonical source checkpoints at start:

- MindBunker: `86df8b823d3989dd2d8f165323c8d6a10983ca45`
- RMEDIA native app: `2a28ea4e01d06be60bba8f388e611fd9b4fb4fbf`
- Production source authority remains outside this local candidate.

## Findings

### Quick Capture custody

Native Quick Captures already synchronize to the canonical `captures` table. The note's `started_at` is the occurrence time, `created_at` is ingestion time, `canonical_work_session_id` is the preferred Session association, `context_snapshot_json` preserves the observed context, and `local_capture_id` provides idempotency.

The web Inbox existed, but it did not expose those distinctions. Native operational notes also inherited generic Client / Project / Video promotion actions and stale-inbox signaling, which could misclassify evidence as a commercial or structural decision.

The local candidate adds a read-only **RMEDIA Quick Captures** lane that shows:

- occurred time separately from recorded/synced time;
- canonical Session association when present;
- captured Client → Project → Video path when supported by the snapshot;
- observed application;
- explicit integrity warnings for malformed or contradictory evidence.

RMEDIA Quick Captures no longer expose promotion actions and do not create stale unresolved-capture signals. No note is transformed into another entity.

### Native discoverability

The native Timeline already contained a Notes view, but it was hidden behind the Timeline surface. The local candidate adds a visible **Notes** action in the app header and preserves the selected Timeline/Notes mode. Notes show sync state and canonical Session association without changing capture, sync, credential, privacy, or API contracts.

### Source Media semantics

`Source Media = 0` was not a projection failure. A source Drive URL had been entered in `video_logs.published_url`; the Source Media counter correctly reads only canonical `source_media_references`.

The Bulk Add helper copy now makes the boundary explicit:

- source footage: Project → Source Media;
- delivery URL: delivered file/private watch link;
- review URL: feedback destination;
- published URL: final public destination.

Existing data was not rewritten.

### Internal work

The domain already recognizes INTERNAL and ADMIN work contexts, but the canonical Start API still accepts only a `video_id`. A universal execution target would therefore be a new contract, not a small UI patch. It is deliberately deferred until the Live Editing Lab and at least one real internal operation provide enough repeated evidence.

## Local proof

### MindBunker

- focused tests: 39/39 passed;
- full suite: 1581/1581 passed;
- TypeScript: passed;
- scoped ESLint: passed;
- full ESLint: 0 errors, 3 pre-existing warnings;
- production build: passed;
- diff check: passed.

The reconciliation integration test applies the complete migration chain through `0054` in memory and proves:

- `published_url` does not count as Source Media;
- an explicit Source Media reference does count;
- ending a Session reconciles its duration and does not finish the Video;
- occurrence time remains distinct from ingestion time;
- a no-session capture invents no Session, Client, Project, or Video;
- foreign-key and SQLite quick checks pass.

### Isolated local D1

Migrations `0000`–`0054` were applied only to an isolated directory under `/tmp`. Production D1 and the normal local database were not touched. Final head and integrity were checked before closure.

### RMEDIA native app

- native tests: 52/52 passed;
- Debug build: passed;
- separate Release candidate: passed;
- signing identity: `MindBunker Sensor Local Dev`;
- candidate path: `mindbunker-sensor-release/build/RMEDIA.app`;
- candidate executable SHA-256: `69978acc06c375eac7f21058a9de63a390e69b6df4406246d30ee06e0065a419`.

The installed app was not replaced or launched. Its executable SHA-256 remained `047dad65aa4aa68e7ded0e16ca3687781e01712e81870f077737547f15a4623e`.

## Refined operating scope

### CRM / MindBunker

- CRM owns relationship and commercial evidence.
- Projects own structural production context and Source Media custody.
- War Room owns execution.
- Work Sessions own intentional time.
- Quick Captures are immutable operational evidence until a separate, explicit process supports another interpretation.

### RMEDIA app

- Capture quickly under the normal macOS user context.
- Preserve human text, occurrence time, Session association, snapshot, sync state, and idempotency.
- Offer a visible local route back to Notes.
- Do not infer commercial, structural, or lifecycle facts from a note.

### Operator flow for the next days

1. Continue the Live Editing Lab with canonical Video + Session context.
2. Use Quick Capture for observations without stopping the edit.
3. Review native Notes or MindBunker → Capture Inbox → RMEDIA Quick Captures.
4. Store source footage only under Project → Source Media.
5. Close the Lab by comparing notes, Session evidence, screenshots, delivery/review state, and actual output.

## Deferred gates

- Human visual/runtime dogfood of the separate native candidate.
- Installation or replacement of the current RMEDIA app.
- Production migration/deploy.
- Universal internal-work execution target.
- Automatic note promotion, classification, summarization, or feature backlog.

The next implementation wave should start only after the current editing operation is closed with real evidence.
