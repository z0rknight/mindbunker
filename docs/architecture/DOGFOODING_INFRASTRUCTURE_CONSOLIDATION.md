# Dogfooding Infrastructure Consolidation

## Executive verdict

The local MindBunker candidate now connects Home to the canonical Work Session path, protects Stop from accidental taps, exposes a safe operator preview, and makes the authenticated Client Portal's existing client-safe video projection navigable by canonical content type. The browser QA also found and fixed a pre-existing Video workspace render loop in idle Work Session state.

Status: **LOCAL ONLY — NOT DEPLOYED**.

## Repository baseline

- Branch: `main`
- Starting HEAD: `97e83ff`
- Worktree was already dirty with approved Sprint 1.2 work, migrations `0012`–`0015`, Historical, Geladeira, Session Ledger, Portal Identity, and Client Intelligence.
- `.git/index.lock` remains owned by the active macOS Virtualization environment. It was not removed and no Git index write was attempted.
- Production and remote D1 were not inspected or changed in this round.

## Already implemented before this round

**ALREADY PRESENT / VERIFIED**

- Canonical Work Session actions, global one-open-session index, recovery, closed-time aggregation, and corrections.
- Work Session Ledger with day/week grouping, provenance, notes, correction timestamps, and `?video=` filtering.
- Video → filtered Session Ledger link.
- Video Memory newest-first ordering, five-entry collapse, expand/collapse, and Session Narrative correlation.
- Persistent client login/logout/session expiry primitives plus capability-token fallback and strict client-safe projection.
- Client review actions for `READY_FOR_REVIEW → DONE | CHANGES_REQUESTED`.
- Video `coverUrl`, `orientation`, and `contentType` metadata with HTTPS validation and client cards using bounded 16:9, 9:16, or 1:1 frames.
- Internal Client Intelligence on CRM detail.

## Changes made

**CHANGED THIS ROUND**

- Added Home Start Tracking with Client → Project → Video → Activity selection.
- Added a compact confirm/cancel guard before normal Work Session Stop.
- Added total-video visibility and a canonical content-type Video Library to the authenticated Client Portal.
- Added operator-side cover rendering and an external Preview / Watch action when a validated HTTPS delivery URL exists.
- Fixed the Video workspace's idle-session render loop by normalizing the absent session ID and comparing a stable server-state signature instead of object identity.
- Added focused client-filter/isolation regression coverage.

## Home / Tracking

Home receives the existing Productivity options and current Work Session overview. Starting calls the existing `startWorkSession(videoId, activityType)` Server Action, then opens that video's existing Productivity workspace. There is no second timer, no new table, and no client/project attribution persisted on the session. When a global session is already open, Home shows it and only offers navigation to the active workspace.

## Session controls

Normal Stop now requires one lightweight inline confirmation: **Keep working** or **Confirm stop**. Server Stop SQL, timestamps, lifecycle behavior, and the one-open-session invariant are unchanged. Browser QA proved Start, refresh recovery, cancel, confirmed Stop, closed aggregation, and unchanged `PLANNED` lifecycle.

The QA exposed two render-loop conditions in pre-existing synchronization code:

1. comparing a freshly materialized Server Component state object by identity;
2. comparing `undefined` from `openSession?.id` against stored `null`.

Both now use stable scalar state.

## Video Memory

**VERIFIED; NO CHANGE.** Newest-first, five-entry default collapse, expand/collapse, and Session Narrative are already the smallest coherent organization pattern. No taxonomy, pagination, or new table was added.

## Preview

The internal Video workspace now renders the canonical cover with the same orientation-aware constraints as the Client Portal. When `deliveryUrl` passes the existing HTTPS-only validator, **Preview / Watch** opens it in a new tab with `noopener noreferrer`.

Embedding was deferred because `deliveryUrl` intentionally accepts arbitrary validated HTTPS destinations, not only a proven YouTube URL contract. An external link is truthful and avoids remote fetching or unsafe embed assumptions.

## Client Portal

**VERIFIED / EXTENDED.** Persistent client auth remains separate from admin auth. The capability-token portal remains available. The dashboard reads only a token/session-derived client ID and constructs a second ownership-checked allowlist projection. Notes, revenue, revisions, CRM events, health, productivity time, and unrelated client rows are not selected or serialized.

Password-reset token generation exists locally, but production email transport does not. This remains a production blocker for self-service reset; no provider was added.

## Content filters

The authenticated dashboard now exposes a Video Library with `ALL` plus the existing canonical categories: Short-form, Long-form, Mini-doc / Storytelling, Testimonial, and Other. Filtering happens only after the server has produced the client-scoped `allVideos` allowlist. A regression test proves another client's video never enters that list or any filtered result.

## Covers

**VERIFIED / EXTENDED.** Client cards already used safe HTTPS covers, missing-image fallback, `next/image`, and bounded aspect containers. This round added the corresponding operator Video workspace cover. QA at 390, 768, and 1440 px showed no horizontal overflow and a bounded missing-cover fallback.

## Coffee quick log

**DEFERRED — requires Quick Event / Health-domain decision.** `health_logs` is one aggregate row per day with `caffeine_mg`; it cannot honestly represent a one-tap timestamped coffee event without dosage. Reusing it would destroy the requested event semantics.

## Pricing Lab

**DEFERRED.** Repository audit found no canonical calculator implementation, only audit/report references indicating the calculator is elsewhere or inaccessible. It was not recreated inside MindBunker.

## Tests

- `npm test`: **135 passed, 0 failed**.
- Added client content-filter/isolation coverage.
- Existing auth, capability revocation, lifecycle, Projects, Work Sessions, URL validation, cover metadata, and migration tests remain green.
- `npm run typecheck`: passed.
- Scoped ESLint for all touched source/test files: passed.
- `git diff --check`: passed.
- Full `npm run lint`: failed only because ESLint traverses pre-existing generated bundles under untracked `_to_delete/.next...` (486 generated-file errors, 132 warnings). No source-file lint failure was found, and `_to_delete` was preserved.

## Builds

- Next.js production build: passed.
- OpenNext / Cloudflare build: passed; `.open-next/worker.js` generated locally.

## Local DB status

- Existing local migrations `0000`–`0015`: all applied.
- Clean isolated D1 migration `0000`–`0015`: passed.
- `PRAGMA foreign_key_check`: zero violations in both isolated and active local D1.
- Browser QA created one closed `WEB_TIMER` session on fictitious local video `9209` (`Cliente Teste → MINI SERIES → Epiosode 1`). It left zero open sessions and did not change video lifecycle.
- No new migration or schema change was created in this round.
- Remote D1 was never contacted.

## Human QA

1. Open `/mindbunker`; choose Client → Project → Video → Activity and Start.
2. Confirm the active Video workspace opens and the timer runs.
3. Reload; confirm the same timer recovers and a second Start is unavailable/blocked.
4. Tap Stop, cancel with **Keep working**, then Stop → **Confirm stop**.
5. Confirm the Video lifecycle did not change and the session count/closed time updated.
6. Open the session-count link; confirm `?video=<id>`, client, project, activity, provenance, note, and correction state.
7. Add 6+ Video Memory notes; confirm newest-first capture and Show more / Show fewer.
8. Add a valid HTTPS cover/delivery URL to a local test video; confirm cover ratio/fallback and Preview / Watch.
9. Login through `/mindbunker/client/login`; confirm greeting, five summary tiles, content-type filters, Watch, and review actions.
10. Repeat Home, Video workspace, Ledger, client login/dashboard at 390×844, 768×1024, and 1440×900; confirm no horizontal overflow.
11. On two devices, start on one, observe the other, stop on either, and allow up to 20 seconds for active-work convergence.

## Deferred

- Production password-reset email transport.
- YouTube-specific privacy embed contract.
- Timestamped coffee/Quick Event domain.
- Pricing Lab until the canonical calculator repository is available.
- Separate `DONE` (production complete) from independently evidenced client delivery; current client label remains known lifecycle ambiguity.
- Full-lint hygiene for the user-owned `_to_delete` archive.

## Production readiness

The local functionality is ready for human review. Deployment, remote migrations, remote configuration, customer credentials, and email were explicitly excluded.

**LOCAL ONLY — NOT DEPLOYED**

## Files changed

This round directly changed:

- `src/app/HomeTrackingPanel.tsx`
- `src/app/page.tsx`
- `src/app/productivity/WorkSessionPanel.tsx`
- `src/app/productivity/VideoEditor.tsx`
- `src/app/client/dashboard/VideoGallery.tsx`
- `src/app/client/dashboard/page.tsx`
- `src/modules/productivity/actions.ts`
- `src/modules/client-portal/core.ts`
- `src/modules/client-portal/core.test.mjs`
- `docs/architecture/DOGFOODING_INFRASTRUCTURE_CONSOLIDATION.md`
- `.kilocode/rules/memory-bank/context.md`

All other dirty files predated this round and were preserved.
