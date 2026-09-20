# PDBM Referral Intake V1 (Wave 2, 2026-09-20)

**Link for Taryn: `https://emmanueldarosa.com/mindbunker/quoteavideo?ref=pdbm`**

## 1. Source authority
GREEN. Before the patch: HEAD `0ab6c9f` = release = `production/current`; product code identical to deployed `42b7415` (later commits report-only). Remote D1: no pending migrations (head 0050). Operator `4263be80…`, Client `6a619197…` (untouched), public site untouched (it only links to the Operator route).

## 2. Taryn / PDBM evidence
Business input from the brief: Taryn (CEO Clubhouse / Perfect Day Business Mentorship) intends to mention Emmanuel as an editor to her clients and tell him who came through her. Repo evidence only confirms Taryn/CEO Clubhouse as an existing client; no partnership, pricing or endorsement terms exist, so none are claimed.

## 3. Funnel archaeology (verified against current source)
- `/mindbunker/quoteavideo` is the canonical public intake (`quote-intake/actions.ts`). `/book` redirects to it; the call-request form is embedded in it ("Need to talk first?", `booking/actions.ts`).
- Lead = `clients` row (`status=lead`) via lookup-or-create by lowercased email; intake evidence = immutable `crm_events` row with an idempotency key. Honeypot `company_website` returns fake success and writes nothing. No Project/Video/Quote/Client is created at intake.
- Lead → quote: "+ Log a quote" on the lead page. Lead → booking: gateway Invite panel (operator-led). Both unchanged.

## 4. Chosen architecture
Reuse the existing route with `?ref=pdbm`; a hidden `ref` field rides the existing forms; the server actions resolve it against a closed allowlist (`modules/referrals/core.ts`). No parallel form, no new table, no migration.

## 5. Canonical attribution rule
`clients.source` ("where they came from") = `referral:pdbm` for new referred leads (category + program). The referrer/context ("Perfect Day Business Mentorship (PDBM) — Taryn / CEO Clubhouse") is written at the start of the immutable `lead_created` and intake events. Unknown/hostile `ref` values are ignored, never stored. UTM is not used. Trade-off: single-program, single-string. If several referrers or reporting are needed later, propose a structured column then.

## 6. Dedup / source precedence
Unchanged idempotency and email dedup. An existing client's `source` is never overwritten (PDBM survives a later generic visit; a generic origin is not rewritten by a later PDBM visit); it is only filled if empty. The referral is still recorded in the immutable event either way. Downstream (quote/booking/project) hangs off the same client row, so origin is derived, not copied.

## 7. External copy
Referred visitors see one understated line: "You were referred through Perfect Day Business Mentorship." No partnership, discount, pricing, availability or endorsement claim. Page copy remains RMedia video-editing language; MindBunker stays backstage. No new form fields, no tracking.

## 8. CRM visibility
List badge and lead-page rail show "Referral · PDBM (Taryn / CEO Clubhouse)" (not the slug); the Activity timeline shows the full origin statement plus the inquiry.

## 9. Tests
21 new (`referrals/`): allowlist/hostile input, attribution, neutral copy, precedence (both directions + empty), dedup (same key / same email), honeypot with valid ref, lead isolation, no downstream entities, page GET imports no DB/action, no tracking, `/book` forwards only a resolved key. Targeted 47/47; full 1243/1243; `tsc` clean; `eslint` 0 errors (3 pre-existing warnings); build OK; `git diff --check` clean. Note: as in the existing intake tests, the SQL is mirrored while calling the real helpers, with source-level pins on the real actions.

## 10. Local/sandbox end-to-end (real form, real server action, local D1)
Page view: no rows. PDBM submit: exactly 1 Lead (`referral:pdbm`), 2 events, inquiry preserved. Generic re-visit, same email: still 1 Lead, source unchanged, 2nd inquiry event appended. Call-request path with `?ref=PDBM`: Lead + `book_request_submitted`, source `referral:pdbm`. Projects/videos/quotes/work sessions/billing unchanged. CRM list/detail readable. Hostile `ref` not rendered.

## 11. Cleanup
Local sandbox: the 2 QA leads (ids 7, 8, `qa-pdbm-*@example.com`) and their events were deleted by id after proving zero related projects/quotes/videos; counts returned to baseline. **Production: no QA record created, nothing to clean.**

## 12. Deploys
Operator Worker only: `6f490b8e-199b-48aa-a1b6-326b0ec74d90` (from `0fd54cc`). Rollback: `4263be80-c688-45b0-8765-d15b470359e7`. Client, Sensor, public site untouched; no migration; no D1 mutation.
Production checks (read-only GET): `?ref=pdbm` → 200 with the referral line and two hidden `ref=pdbm` inputs; plain page → no referral line; `/book?ref=pdbm` → 307 to the referral URL; `/crm` unauthenticated → login. **Production authenticated end-to-end QA was NOT run** (it would create a real production Lead and need operator login).

## 13. Link
`https://emmanueldarosa.com/mindbunker/quoteavideo?ref=pdbm`

## 14. Deliberately deferred
Marketing automation, referral platform, conversion dashboard, multi-referrer schema, cold outreach, analytics, Vault/Production Memory, pricing/economics, and everything else on the do-not-implement list.
