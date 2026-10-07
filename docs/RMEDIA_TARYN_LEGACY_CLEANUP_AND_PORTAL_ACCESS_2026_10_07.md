# RMEDIA — Taryn Legacy Cleanup + Portal Access

Date: 2026-10-07  
Verdict: **GREEN — DEPLOYED / LEGACY PRESERVED**

## Outcome

Taryn's historical production remains recoverable in the canonical database but no longer occupies the active operator queue or Client Dashboard. The live portal projection now includes Taryn's current DFY work through the established explicit canonical identity relationship.

No video was deleted, cancelled, or reclassified editorially. No schema or migration changed.

## Exact data scope

- Archived and client-hidden projects: 1, 4, 5, 15, 16.
- Preserved legacy videos removed from client visibility, priority, and queue placement: 41.
- Content Waterfall portion: Projects 5, 15, 16, containing 30 videos.
- Preserved orphan history: Videos 15–20 remain unassigned records but no longer qualify for the active operator queue.
- Current work preserved: Videos 85 (`Front Door Video 11`) and 86 (`Offer Doc`) remain `IN_PROGRESS`, visible, and attached to active Project 19.

## Projection rules shipped

- Canonical Taryn Client 2 explicitly owns the portal projection for operational alias Client 12.
- This relationship is registry-based; no client is inferred by name.
- Client views exclude archived projects.
- Client review and priority actions accept the canonical relationship scope and reject archived projects.
- Client work enters the operator queue only when it has a non-archived Project.
- Historical rows remain available to integrity and history surfaces.

## Authentication decision

The existing Gateway capability link is the preferred simple path:

- no password for the client;
- private, cryptographically random, expiring, and revocable;
- copied from CRM and sent manually through Slack or email;
- existing password login retained as fallback.

No Slack OTP, bot, webhook, or new credential store was introduced. Automating delivery would add a dependency without improving the security or usability of the current pilot enough to justify it. Revisit only if manual sending becomes a repeated operational friction.

## Source and deployments

- Branch: `codex/taryn-legacy-cleanup`
- Source commit: `9b94855`
- Operator Worker: `b74835a8-c22e-4243-bb02-98f65a016bc0`
- Operator created: `2026-10-07T03:43:02.215365Z`
- Client Worker: `313a3368-a8c3-43af-8cd2-918a163fc043`
- Client created: `2026-10-07T03:43:49.281451Z`

## Recovery and integrity

- Pre-write export: `/tmp/rmedia-taryn-legacy-cleanup/mindbunker-pre-taryn-legacy-2026-10-07.sql`
- Export size: 6,683,305 bytes
- SHA-256: `b55f802e5e96b75d649d0f8a7ea3e2422246be84d056448ec78c87b378df6222`
- D1 migration head: `0054_thick_sheva_callister.sql`
- Migration applied by this release: none
- `PRAGMA foreign_key_check`: zero rows
- `PRAGMA quick_check`: `ok`

## Verification

- Focused tests: 56/56
- Full test suite: 1584/1584
- TypeScript: green
- Operator build/deploy build: green
- Client build/deploy build: green
- Lint: zero errors, three pre-existing warnings
- Operator login: HTTP 200
- Client login: HTTP 200
- Unauthenticated client dashboard: HTTP 307 to client login
- Dedicated Client Worker login: HTTP 200
- Final active Taryn projection: exactly Videos 85 and 86

## Notion custody

Closure appended to `Pré-Wave 1` under section **Taryn housekeeping + portal access — produção (07 Oct 2026)**.
