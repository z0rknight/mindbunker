# RMEDIA Guided Lead Engine — Production Release Closure

## Sep 20–21 operator-handling extension

The write contract below remains unchanged. A new authenticated `CRM → Inbound` read model projects canonical Leads plus immutable `guided_intake.submitted` events; manual Leads with no registered system-intake event are excluded. Multiple legitimate submissions remain separate events but group under one canonical Lead. The durable notification count is the number of unread system-intake events. First explicit open appends one idempotent `system_intake.seen` CRM event per unread intake **of the selected Lead** whose `payload_json` references `{ "sourceEventId": <intake event id> }`; it never mutates the intake event and ordinary GET routes write nothing. PDBM is one source inside this same custody model. No notification table, duplicate Lead store, generic notification framework or migration was added. The Sep 21 production extension was E2E-verified and QA-cleaned; see `RMEDIA_OS_NIGHT_CLOSURE_PRODUCTION_RELEASE_2026_09.md`. All baseline/version details below document the earlier Sep 20 release, not current production.

**Date:** 2026-09-20

**Status:** GREEN — released, production-verified, synthetic QA cleaned

**Scope:** closure only from the post-E2E checkpoint; no feature work, Card UX change, M5/M6 work, or redeploy in this closure pass.

## 1. Final matrix

| Gate | Result | Evidence |
|---|---|---|
| SOURCE AUTHORITY | **GREEN** | Canonical product commit `8989ccce9fb32571b33e83c79cd0e9ced61077ec`; clean public source commit `4d792ade021cfec1dc513dcbea0dd78e8e0e235a`; release and `production/current` closed in §9. |
| MIGRATION 0053 | **GREEN** | Production D1 ledger head `0053_slow_shen.sql`, id 55, applied `2026-09-20 19:06:51`; FK check empty. |
| ROUTE | **GREEN** | `/start` and `/start?ref=pdbm` load from the public Worker; visual flow verified; GET-only checks previously proved zero writes. |
| CANONICAL LEAD | **GREEN** | Live E2E created one canonical Lead id 7 with normalized identity and `source=referral:pdbm`; exact record was re-read before cleanup. |
| IMMUTABLE INTAKE EVENT | **GREEN** | Event 268 preserved schema v1 evidence and server-derived `REPEATABLE_PRODUCTION`; replay produced no duplicate. |
| CRM READABILITY | **GREEN** | Authenticated production CRM visibly rendered the Guided Intake evidence projection; exact fields in §5. |
| PRODUCTION E2E | **GREEN** | Lead 7 + events 267/268, server recomputation and idempotency already passed before this closure; downstream relationships re-proved zero. |
| QA LEAD | **CLEANED** | One guarded parent delete matched; D1 reported 3 rows changed (Lead + two cascading events). Post-cleanup exact selectors return zero. |
| CURRENT HANDOFF | **UPDATED** | `RMEDIA_CURRENT_HANDOFF_2026_09.md` and memory-bank context now carry the live release state. |

## 2. Released behavior

The public site owns `/start`; the Operator Worker owns the narrow same-origin `/mindbunker/api/start` persistence endpoint. GET page views remain static and create no Lead. A successful submission:

1. validates the closed answer vocabulary and referral allowlist;
2. re-derives dimensions and starting path on the server;
3. reuses or creates exactly one canonical `clients` row;
4. appends one immutable `guided_intake.submitted` event with a schema-versioned `payload_json` snapshot;
5. creates `lead_created` only for a new Lead;
6. creates no Project, Video, Production Order, quote, booking, Work Session, billing evidence, transaction, or payment.

The CRM reads the structured event through a safe projection. Raw JSON remains evidence; the operator sees human-readable fields.

## 3. Source artifacts

### Operator / canonical MindBunker

- Repository: `github.com/z0rknight/mindbunker`
- Release worktree branch: `codex/guided-lead-live-release`
- Product commit: `8989ccce9fb32571b33e83c79cd0e9ced61077ec` — `Add production Guided Lead Engine`
- Source was ported cleanly on top of the canonical motion M1–M4 line (`d833b4384cdc25f8d45afd784ee55b8a7f4bf92e`).
- Migration: `src/db/migrations/0053_slow_shen.sql`
- Core: `src/modules/guided-intake/`
- API: `src/app/api/start/route.ts`
- CRM projection: `src/modules/gateway/data.ts` + `src/app/crm/[id]/ClientTabs.tsx`

### Public site

- Repository: local `rmedia-public-site` (no remote configured)
- Commit: `4d792ade021cfec1dc513dcbea0dd78e8e0e235a` — `Launch Guided Lead start experience`
- Public source: `public/start/`
- Worktree clean at closure.

## 4. Migration and database integrity

Production D1: `mindbunker` (`d6ada5db-1f36-4ee9-9a05-01d131abf219`).

Fresh closure query:

| Ledger id | Migration | Applied |
|---:|---|---|
| 55 | `0053_slow_shen.sql` | `2026-09-20 19:06:51` |
| 54 | `0052_worried_mandarin.sql` | `2026-09-20 10:16:21` |
| 53 | `0051_narrow_living_tribunal.sql` | `2026-09-20 09:46:55` |

`0053` is additive only:

```sql
ALTER TABLE `crm_events` ADD `payload_json` text;
```

`PRAGMA foreign_key_check` returned zero rows both immediately before and after cleanup.

## 5. Production E2E evidence

### Canonical Lead

Before cleanup, a fresh production read returned exactly:

- `id=7`
- `name=QA GUIDED LIVE SEP20 — DELETE`
- `email=qa-guided-live-20260920@emmanueldarosa.com`
- `status=lead`
- `converted=0`
- `contacted=0`
- `opportunity_stage=new`
- `service_interest=short-form`
- `source=referral:pdbm`

### Events

Event 267:

- `type=lead_created`
- `actor=gateway`
- PDBM referral description
- no payload and no idempotency key

Event 268:

- `type=guided_intake.submitted`
- `actor=gateway`
- `idempotency_key=guided-live-qa-20260920-001`
- `schemaVersion=1`
- server-derived `recommendedStartingPath=REPEATABLE_PRODUCTION`
- `referralContext.source=referral:pdbm`
- short-form, 5–10 videos, recurring
- immutable context explicitly named the authorized synthetic E2E

The earlier replay with the same idempotency key created no second event. The public result and server recomputation agreed on `REPEATABLE_PRODUCTION`.

### Exact downstream relationship proof

Immediately before cleanup, all of these counts for Lead 7 were zero:

`projects`, `video_logs`, joined `work_sessions`, joined `billing_evidence`, `transactions`, `payment_requests`, `gateway_invitations`, `intake_submissions`, `quotes`, `bookings`, `production_orders`, `commercial_contracts`, `decisions`, promoted `captures`, `client_production_memory`, `client_protected_terms`, and `client_export_reminders`.

This proves the submission created only the intended Lead and immutable CRM evidence.

## 6. CRM production projection

Authenticated production visual verification at `/mindbunker/crm/7` passed before cleanup. The page visibly showed:

- Lead identity and `Referral · PDBM (Taryn / CEO Clubhouse)`;
- zero active jobs/projects/revisions and no contract;
- a **LATEST GUIDED INTAKE** evidence section;
- What they want: **Short clips**;
- Volume: **5–10 videos**;
- Recurrence: **recurring**;
- What is ready: **Materials and editorial direction ready**;
- Definition: **Clear, repeatable direction**;
- Timing: **Ongoing cadence**;
- Recommended starting path: **Repeatable production**;
- Referral source: **Perfect Day Business Mentorship (PDBM)**;
- Additional context: the authorized synthetic-E2E cleanup note.

The projection is readable without exposing raw JSON, scores, internal IDs, callbacks, or automatic commercial decisions.

## 7. Live public visual verification

### `/start`

- HTTP/live page rendered as **Start with RMEDIA**.
- First card showed 1 of 9, five choices and the privacy/human-next-step note.
- Selecting “A few videos” auto-advanced to “What kind of videos are they?” without a Next button.
- Back returned to card 1 and visibly restored the selected answer.
- No submission was made during closure.

### `/start?ref=pdbm`

- Same Card UX rendered successfully.
- Referral banner visibly read: “You came through PDBM. Emmanuel will keep that context with your request.”
- Existing answer restoration remained intact across navigation.
- No submission was made during closure.

The earlier production GET checks proved both routes produced zero D1 writes.

## 8. Guarded cleanup

Cleanup was a single parent-row delete guarded by all of the following:

- exact Lead id, name, normalized email and canonical lead state;
- exact source/service/stage/contacted/converted values;
- exactly two CRM events for Lead 7;
- exact identity and semantics of event 267;
- exact idempotency key, schema version, recomputed path and referral source of event 268;
- `NOT EXISTS` guards for every downstream relation enumerated in §5.

Because `crm_events.client_id` is `ON DELETE CASCADE`, deleting the exact synthetic Lead removed only Lead 7 and events 267/268 atomically from the relationship graph. D1 reported `changes=3`, `rows_written=3`.

Post-cleanup proof:

| Check | Result |
|---|---:|
| `clients` count | **5** |
| `crm_events` count | **263** |
| max client id | **5** |
| max event id | **263** |
| exact QA Lead selectors | **0** |
| exact QA event/idempotency selectors | **0** |
| FK violations | **0** |

This matches the pre-E2E baseline: **5 clients and 263 CRM events**.

## 9. Deployment and source authority

No redeploy occurred during closure.

### Operator

- Worker: `mindbunker`
- Active version: `8a8cb33d-8246-4a14-b0c7-1468ae2dfd4f`
- Traffic: 100%
- Created: `2026-09-20T19:07:44.178Z`
- D1 binding: canonical `d6ada5db-1f36-4ee9-9a05-01d131abf219`
- Deployed from the clean product commit `8989ccc` build.

### Public

- Worker: `late-disk-3e57`
- Active version: `2a147edf-87b5-453b-9871-ed7a7f791de9`
- Traffic: 100%
- Created: `2026-09-20T19:08:05.912Z`
- Service binding: `MINDBUNKER → mindbunker`
- Deployed from clean public commit `4d792ad`.

The Operator release branch and `production/current` are advanced together to the closure documentation commit, a docs-only descendant of product commit `8989ccc`. The deployed application source is therefore reproducible from canonical history; the public deployment is reproducible from its clean local commit.

## 10. Explicit non-actions

- No feature added.
- No Card UX changed.
- No M5 or M6 work started.
- No second migration created.
- No redeploy performed.
- No real Lead/client record modified.
- No Project, Video, Production Order, quote, booking, Work Session, commercial, finance or payment record created or deleted.

## 11. Final state

The Guided Lead Engine release is closed. Future work should observe real leads rather than extend this implementation without new evidence.
