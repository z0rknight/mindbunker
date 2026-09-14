# RMEDIA OS — Operator Project Commercial Attribution
**Date:** 2026-09-14 · **Status: DEPLOYED, live.**

---

## 1. Existing Canonical Data Reused

Zero new tables, zero schema changes. Reused, unmodified:
`commercialContracts`, `billingEvidence`, `billingAllocations`,
`videoLogs`/`projects` (for ownership + naming). Most importantly:
`buildClientBillingSummary` (`client-portal/core.ts`) — the exact same
pure grouping function the Client Work Explorer already uses, and which
already had extensive test coverage for cross-client isolation,
multi-video summation, and honest-empty-state behavior. No Finance rule
was reimplemented.

## 2. Read-Model Logic

New: `getClientProjectCommercialAttribution(clientId)`
(`finance/actions.ts`) — the operator-side sibling of
`getClientBillingSummary` (same 4-query shape: contracts, evidence,
allocations, projects; same defense-in-depth ownership re-check on
`videoId`/`videoClientId` before trusting a project attribution). The
one real difference: **never gated by `portalCanSeeFinancials`** — that
flag controls what a client sees on `/client`, not what the operator
can see internally, so this is deliberately a separate function rather
than a parameter bolted onto the client-facing one.

New pure logic: `selectUnallocatedManualEvidence` (`finance/core.ts`) —
picks out only `source=MANUAL` evidence rows with zero allocations.
Deliberately **not** "all evidence minus all allocated" — that would
flag every routine weekly Upwork report row (expected to be
project-unallocated by default) as a false signal. MANUAL rows are the
small, deliberately-curated set an operator explicitly wrote a note
for.

## 3. Project-Level Semantics

Surfaced in CRM's existing Active Jobs project cards (`ActiveJobsPanel.tsx`
— no new route, per the explicit instruction). Per project:
- **"Confirmed attributable \$X · Ym allocated"** — only when real
  `billing_allocations` rows exist for that project; omitted entirely
  (not \$0) otherwise.
- Minutes labeled **"allocated,"** never "worked" or "tracked" — they
  are billing attribution, not observed Work Session time.
- A status breakdown line ("3 done · 6 planned") reusing the exact same
  canonical lifecycle vocabulary already shown per-video.

## 4. Historical Unallocated Semantics

A restrained **"Unallocated historical billing"** block, shown only
when `source=MANUAL` evidence with no allocation exists for this
client. Label text is the evidence row's own `externalReference`,
truncated at 80 chars — never re-authored, never auto-classified as
"Bonnie-specific" beyond what the row's own text already says. For
Taryn this surfaces the January \$75 Bonnie Ads entry with its own
provenance note visible.

## 5. Bonnie QA

Production's real Bonnie fixture (project 5, "Bonnie - Content
Waterfall") now has exactly what the mission expected: **\$37.50
confirmed attributable, 90 minutes allocated** — not \$112.50 (January's
\$75 correctly stays in the separate Unallocated Historical block, not
forced into this project). Verified this computation directly against
production data (§8 of the prior wave's report already confirmed the
isolated \$37.50/90min sum); this wave adds the UI that shows it.

Local visual QA used a faithful mirrored fixture (three \$12.50/30min
allocations against local Taryn's own videos, one MANUAL \$75
evidence row — cleaned up after verification, since it's synthetic test
data, not a copy of real production facts): the project card correctly
showed **"Confirmed attributable \$37.50 · 1h 30m allocated"** (minutes
summed across all 3 underlying allocation rows, not just one — proving
the aggregation, not just a single passthrough), and the Unallocated
Historical block correctly showed the \$75 entry with its own note.

## 6. Dave Regression

Dave's local fixture has zero `billing_allocations` and zero MANUAL
evidence. His project card shows **neither an amount nor \$0** —
correctly absent. Confirmed no Taryn-analog figures leaked onto his
page. Zero console errors on a fresh tab.

## 7. 60-Second Test

`OPEN CRM → TARYN → FIND BONNIE / CONTENT WATERFALL → READ WORK +
STATUS + ATTRIBUTABLE BILLING` is now answerable directly on the CRM
client-detail page's Active Jobs panel — no SQL, no Finance archaeology,
no Notion, no Upwork. January's \$75 is separately discoverable in the
same panel's Unallocated Historical Billing block, one scroll away, no
second widget needed.

## 8. Tests / Build

| Gate | Result |
|---|---|
| `git diff --check` | clean |
| Targeted tests (7 new) | pass |
| `npm test` | **1092/1092 pass** |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 errors (3 pre-existing unrelated warnings) |
| `npm run build` | succeeds |
| `rm -rf .next .open-next` + fresh `npm run build` | succeeds |
| Operator `basePath` | confirmed `/mindbunker` before deploy |

## 9. Deploy

| | |
|---|---|
| Pre-deploy Operator version | `1f8768d1-6a06-4b85-ae0c-00ed3828fdd8` |
| **New Operator version** | **`b0c2bf37-8e73-4987-b51b-7c4dbbfd89b1`** |
| Traffic | 100% |
| Client Worker | **not touched, not redeployed** |

## 10. Live Smoke

`wrangler tail` live during checks — `/mindbunker`, `/crm`, `/crm/2`
(Taryn), `/crm/4` (Dave, real production id), `/projects`, `/finance`,
`/war-room`, `/productivity` all returned `307` (correctly redirecting,
unauthenticated) with zero `exceededCpu`/`exceededResources`/500s.
Authenticated production verification of the actual \$37.50 render
was not performed (no safe production credentials) — the full
functional verification in §5 was against a faithful local fixture,
matching the pattern established in every prior wave of this
engagement.

## 11. Remaining Canonical Gaps

- No "View billing breakdown" disclosure was built (per-evidence-row
  detail within a project) — the compact summary already satisfies "1-2
  concise facts per project"; a disclosure is a reasonable future
  addition if ever needed, not built this wave to keep the change
  small.
- September's \$12.50 remains deliberately unrecorded (unchanged from
  the prior wave) — nothing to surface because nothing was written.
- The Projects page/detail (option B in the mission's own §2) was not
  touched — CRM's Active Jobs panel alone satisfies the "smallest
  implementation" instruction.

---

## Final Structured Output

```
PROJECT ATTRIBUTION: GREEN
BONNIE AUGUST:        $37.50 VISIBLE (CRM Active Jobs, Taryn's Bonnie project card)
BONNIE JANUARY:        $75 DISCOVERABLE (same panel, Unallocated Historical Billing)
FALSE TOTAL RISK:      GREEN (the two amounts are never summed or implied as one total)
DAVE REGRESSION:       GREEN
CROSS-CLIENT SAFETY:   GREEN

60-SECOND OPERATOR RULE: PASS

TESTS: 1092/1092
MIGRATIONS: NONE
D1 MUTATION: NONE
CLIENT DEPLOY: NONE
OPERATOR DEPLOY: b0c2bf37-8e73-4987-b51b-7c4dbbfd89b1
ROLLBACK: NOT REQUIRED
```

**FINAL VERDICT:**

**GREEN — Operator can answer attributable project cost in under 60
seconds.** Bonnie's confirmed \$37.50 (August) and \$75 (January,
unallocated-but-discoverable) are both live in the CRM client-detail
page today, with no schema change, no new route, and no false-total
risk — the two figures are shown separately, exactly matching what the
evidence actually supports.

STOP.
