# RMEDIA OS — Client 60-Second Answers: Work Explorer
**Date:** 2026-09-14 · **Status: Live on Client Worker.**

---

## 1. Product Principle

Every client-facing fact should answer one of: what are we working on,
what's delivered, what did a project/campaign include, what did it
cost, what's unbilled, what needs review, where's the file, what's the
evidence for a number. Nothing was added just because the database
happened to contain it.

## 2. Existing Client Portal Reused

Before writing anything, inventoried what the dashboard already fetches
(`getClientDashboardView` + `getClientBillingSummary`, called together
in `page.tsx`). Both were already:
- scoped by `authenticatedClientId` at the SQL level,
- already financials-gated server-side (`getClientBillingSummary`
  returns `byProject: []` the moment `portalCanSeeFinancials` is off),
- already the exact shape needed — `allVideos` cards carry `projectId`/
  `projectName`/`batchLabel`/delivery links; `byProject` is a real,
  already-built per-project billing breakdown sourced from
  `billing_allocations` (not work_sessions, not an estimate).

Result: **the Work Explorer needed zero new database queries.** It's a
pure client-side reshape of two objects the page already had in hand.

## 3. New Work Explorer Behavior

Extended the existing Search (the one entry point, per Dave Monday
Release) rather than adding a second search surface. A query now
returns results **grouped by project/work-family**, each group showing:
deliverable count, a lifecycle-state summary (delivered / in review /
in production / planned, using the same client-safe vocabulary already
established), and — only when applicable — a billed line. Each video
inside a group is the existing `VideoCard`, unchanged, so delivery/
review links work exactly as before.

## 4. Search / Grouping Semantics

Grouping key is each video's own canonical `projectId`/`projectName` —
the same fields already rendered on every card. No new "Bonnie" entity,
no semantic tagging, no fuzzy matching. A search for "Bonnie" works
because that word is literally in two real project names — nothing
more, nothing magical. `groupClientWorkByProject` and
`indexClientBillingByProject` (`client-portal/core.ts`) are pure
functions, unit tested directly.

## 5. Financial Semantics

- Billed line only appears when `billing.byProject` actually has a row
  for that project (sourced from real `billing_allocations`, not
  invented).
- Zero rows → **"No billing recorded for this work yet"** — shown only
  when financials are visible at all; never a fabricated `$0`.
- When `portalCanSeeFinancials` is off, `byProject` arrives **empty
  from the server**, unchanged from before this wave — no financial
  value is ever serialized to that client's page, in search results or
  anywhere else. This was true before this feature existed and remains
  true; the feature only ever reflects what it's handed.
- Never labeled generically as "Cost," "Revenue," or "Total" — always
  "Billed \$X" or the neutral no-attribution message.

## 6. Security Boundary

No new query, so no new attack surface at the data layer. Verified:
- A video with no owning project (`projectId === null`) is dropped, not
  silently grouped (can't happen today anyway — the dashboard's video
  query INNER JOINs `projects`, structurally excluding unassigned
  videos from ever reaching a client — confirmed, unchanged).
- Search results are a pure filter over an already-client-scoped array;
  they cannot introduce a row that wasn't already there (tested).
- Malformed/nonsense queries (`zzz_nonexistent`) produce a correct empty
  state, not an error.

## 7. Taryn QA

Financials OFF. Searched "Mini Series" (her local fixture's project
name — the real "Bonnie" projects only exist in production data, not
the local dev seed): 21 matches, correctly grouped into one project
card with a live status breakdown (17 planned / 3 in production / 1 in
review). **Zero dollar figures anywhere** on the page — confirmed via
both visual inspection and raw page text extraction. Full breakpoint
sweep (1440, mobile) clean, zero console errors on a fresh tab.

## 8. Dave QA

Financials ON, zero `billing_allocations` recorded for him locally.
Searched "Batch": 1 match, correctly grouped, and — because financials
are visible for him — the neutral **"No billing recorded for this work
yet"** line appeared, proving the distinction between "hidden" (Taryn:
nothing shown) and "visible but empty" (Dave: an honest empty state) is
real and correctly wired, not just theoretical.

## 9. Bonnie Question Simulation

Production Taryn has two real Bonnie projects ("Bonnie - Content
Waterfall," "Bonnie @ Content Waterfall September") and **zero**
`billing_allocations` rows recorded against either one (confirmed
read-only against production D1). Searching "Bonnie" in the live Work
Explorer would correctly show: 2 project groups, 14 deliverables total,
accurate delivered/planned counts, delivery links for the completed
batch — and, if her financials were ever turned on, "No billing
recorded for this work yet" for both groups, because no allocation
exists yet. **The tool cannot currently reproduce the $75/$37.50/$112.50
figures from the prior manual reconstruction** — those live in Notion
and Upwork, and the one MindBunker-native piece of evidence for them
(the Aug 2 session) was deliberately never persisted as a real
`billing_allocations` row this wave (read-only mission).

## 10. 60-Second Test

**PARTIALLY.**
- **Work discovery** (what was done, current status, where the files
  are) — **YES**, under 60 seconds, from MindBunker alone, today, live.
- **Cost attribution** ("what did it cost") — **NO**. The exact missing
  canonical fact: **no `billing_allocations` rows exist for Taryn's
  Bonnie work** (or for any of her work — the mechanism is real and
  unused for her contract entirely). Until at least the January and
  Aug 2 amounts are recorded as real allocations, MindBunker's own
  billed/unbilled numbers for Bonnie stay empty, correctly so — an
  honest gap, not a bug.

## 11. Files Changed

```
src/modules/client-portal/core.ts             groupClientWorkByProject, indexClientBillingByProject
src/modules/client-portal/core.test.mjs        7 new tests
src/app/client/dashboard/DashboardSearch.tsx   grouped-by-project rendering
src/app/client/dashboard/page.tsx              passes `billing` into DashboardSearch
```
No schema changes, no new tables, no migration.

## 12. Tests / Build

| Gate | Result |
|---|---|
| `git diff --check` | clean |
| Targeted tests (7 new) | pass |
| `npm test` | **1085/1085 pass** |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 errors (3 pre-existing unrelated warnings) |
| `npm run build` | succeeds |
| `rm -rf .next .open-next` + `npm run build:client` (fresh, Client target only) | succeeds |
| Client `basePath` | confirmed `""` before deploy |

## 13. Client Deploy

| | |
|---|---|
| Pre-deploy Client version | `758ae308-8fd6-418a-be4f-6208e1e5cc1f` |
| **New Client version** | **`cc3befd0-f2bc-4282-bd6e-78a53ca9435a`** |
| Traffic | 100% |
| Operator Worker | **not touched, not redeployed** |

## 14. Live Smoke

`wrangler tail` live during checks — `/client` (307, correctly
redirects), `/client/login` (200), static asset (200), `/client/media/
<fake-path>` (404, correctly not-found). Incidentally captured several
real RSC prefetch requests from an active visitor browsing real video
detail pages during the smoke window — all `Ok`, no `exceededCpu`, no
`exceededResources`, no 500s. Authenticated production verification of
the new grouping specifically was not performed (no safe production
credentials) — the full functional verification in §7-8 was against
real local-dev portal logins, the closest safe equivalent, matching the
pattern from the prior Client Portal waves.

## 15. Missing Canonical Facts / Next High-Value Attribution Gap

**No `billing_allocations` rows have ever been recorded for Taryn's
contract.** This is the single fact standing between "MindBunker can
show deliverables and status in under a minute" (true today) and
"MindBunker can show cost in under a minute" (not yet true). The
mechanism to fix this already exists and needs no new code: record the
January ($75) and August 2 ($37.50) amounts as real `billing_allocations`
rows against their respective Bonnie videos/contract evidence. That is
a real, small, separate follow-up — deliberately not done this wave,
which was scoped to the read-model/UI, not to writing new commercial
attribution.

---

## Final Structured Output

```
WORK EXPLORER:          GREEN
SEARCH:                 GREEN
PROJECT GROUPING:       GREEN
DELIVERABLE DISCOVERY:  GREEN
FILE ACCESS:            GREEN
BILLING SEMANTICS:      GREEN
CLIENT SECURITY:        GREEN
TARYN:                  GREEN
DAVE:                   GREEN

BONNIE QUESTION:        PARTIALLY ANSWERABLE
60-SECOND RULE:         PARTIAL (work discovery: PASS · cost: not yet)
MISSING CANONICAL FACT: No billing_allocations rows exist for Taryn's Bonnie work

TESTS: 1085/1085
MIGRATIONS: NONE
PRODUCTION D1 MUTATION: NONE
OPERATOR DEPLOY: NONE
CLIENT DEPLOY: cc3befd0-f2bc-4282-bd6e-78a53ca9435a
ROLLBACK: NOT REQUIRED
```

**FINAL VERDICT:**

**YELLOW — Work discovery answers real client questions in under 60
seconds today, live. Cost attribution doesn't yet, for one specific,
fixable reason: Taryn's Bonnie work was never recorded in
`billing_allocations`. That's a data-entry follow-up, not a product
gap — the read model, UI, and security boundary are all done and
correct.**

STOP.
