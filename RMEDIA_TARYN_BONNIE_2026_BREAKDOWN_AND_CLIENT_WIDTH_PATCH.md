# RMEDIA OS — Taryn/Bonnie 2026 Breakdown + Client Portal Width Patch
**Branch:** `codex/p0-video-workspace-hotfix` · **Date:** 2026-09-14
**Status: Bonnie answer ready to send. Client Worker deployed, live, smoke-clean.**

---

## Baseline (verified before work)

| | |
|---|---|
| git HEAD at start | `79e59f3` (clean) |
| `production/current` | `1416201` |
| Client Worker (`white-wave-1af9`) pre-deploy | `b9d0e462-3838-40e2-b543-d62dc44c2b9a` |
| D1 migration head | `0049_certain_frog_thor.sql`, no pending migrations |

---

## Part A — Taryn / Bonnie 2026 Breakdown

### 1. Bonnie Scope

Read-only inspection of production D1 (Taryn = client_id 2), cross-checked
against the existing `RMEDIA_TARYN_EVIDENCE_RECONCILIATION_2026_09.md`
(Wave 2's chat/Drive evidence audit). Taryn has 6 projects total; exactly
two are Bonnie's, identified by project name, video title, and batch
label all agreeing (not by filename substring alone):

- **Project 5 — "Bonnie - Content Waterfall"** (created 2026-08-24)
- **Project 16 — "Bonnie @ Content Waterfall September"** (created
  2026-09-11)

**Explicitly checked and ruled out**: Project 15 ("September Content
Waterfall") looks adjacent by name but its 6 videos are titled
"11SEP-CONTENT WATERFALL_1…6" with batch label `CW-September` — no
Bonnie reference anywhere in title, batch label, or notes. This is
Taryn's own separate content-waterfall work, not Bonnie's. Confirmed via
direct query, not assumed. No Bonnie reference exists anywhere else in
Taryn's projects, video titles, or video notes.

**Known but out of scope**: Wave 2's evidence audit found a "Bonnie -
Ads" Drive folder dating to January 2026, described as an "ongoing
weekly Upwork billing" relationship that predates MindBunker's CRM
entirely — explicitly "Not represented" in D1. That earlier Bonnie work
existed and was billed, but there is no video-level or project-level
system record of it to include here.

### 2. Included Projects/Videos

| Project | Videos | Created | Status | Delivered |
|---|---|---|---|---|
| Bonnie - Content Waterfall | 9 (ids 6–14) | 2026-08-24 | **PLANNED** (all 9) | No (0/9) |
| Bonnie @ Content Waterfall September | 5 (ids 63–67) | 2026-09-11 | **DONE** (all 5) | Yes (5/5), 2026-09-13 |

**14 Bonnie pieces total.** The September 5 all moved to Done within
~30 seconds of each other (`crm_events` timestamps 30s apart) — the
signature of a batch export/repurposing pass, not 5 separately-edited
pieces.

### 3. Tracked Hours

**MindBunker tracked hours**: checked `work_sessions` against all 14
Bonnie video ids. Result: **one session, 13 minutes, on video 63 only.**
The other 13 Bonnie videos (all 9 August pieces + 4 of the 5 September
pieces) have **zero** logged work sessions in MindBunker, despite 4 of
those being complete and delivered.

This number is **not representative of real effort** — it's a tracking
gap, not a true 13-minute total for 5 delivered pieces. Flagging this
honestly rather than presenting it as "Bonnie's MindBunker hours."

**Upwork-evidenced hours specific to Bonnie**: **none available.**
`billing_evidence` (Taryn's weekly Upwork totals) has no `video_id` or
`project_id` column — it is structurally a per-week, whole-contract
number. A real allocation mechanism exists in the schema
(`billing_allocations` — one evidence row can be split across specific
videos) but **zero allocation rows have ever been created for Taryn's
contract** (checked directly, read-only). So there is no path — from
MindBunker or from Upwork — to a Bonnie-specific hours or dollar figure
beyond the 13-minute tracking gap above.

### 4. Billed Amount

**NOT SAFELY DERIVABLE FROM CURRENT DATA.**

Taryn's 7 billing-evidence rows (2026-07-27 through 2026-09-13, all
`UPWORK_REPORT`, $25/hr) are 100% weekly aggregates covering *everything*
worked on her account that week — Bonnie, Mini Series, Studio Session,
her own Content Waterfall, all mixed together. No allocation was ever
recorded splitting any week's total by project or client. The week
covering the September Bonnie delivery (Sep 7–13, $166.67 gross) also
covers 6+ other September Content Waterfall videos worked the same week
— so even that week's number cannot honestly be called "Bonnie's."

Inventing a split (e.g. tracked-minutes × rate) would produce $5.42 for
13 minutes — technically computed correctly, but actively misleading as
a stand-in for 5 delivered pieces. Not reported as a dollar figure for
that reason.

### 5. Unbilled Amount

**NOT SAFELY DERIVABLE FROM CURRENT DATA** — depends on §4, which isn't
derivable either. What *is* true and useful: no billing evidence, no
transaction, and no allocation anywhere in the system is tagged to
Bonnie's work specifically, in either direction.

### 6. Total Supported Value

**NOT SAFELY DERIVABLE FROM CURRENT DATA** in dollar terms. The
confidently-known total is a **count and status**, not a dollar figure:
14 pieces (9 not started, 5 delivered).

### 7. Evidence Limitations

- MindBunker's own session-tracking essentially wasn't used for this
  batch of work (13 of 14 videos have zero sessions) — this is a real
  gap in *how the work was logged*, not evidence the work didn't happen.
- Taryn's billing is 100% weekly-lump-sum via Upwork; nothing in
  MindBunker or Upwork ever recorded a per-client/per-project split of
  any invoice.
- The `billing_allocations` table exists specifically to solve this and
  is unused — going forward, allocating each week's evidence across the
  videos actually worked that week (a real, existing, read-write
  MindBunker feature) would make a real Bonnie-specific dollar answer
  possible next time. Nothing was allocated this pass — this task was
  read-only per its own instruction.
- Bonnie work from before MindBunker's CRM existed (Jan–Aug 2026, the
  "Bonnie - Ads" Drive folder) is real but has no video/project-level
  system record at all.

### 8. Ready-to-Send Slack Message

> Hey Taryn! Pulled this apart for you.
>
> For Bonnie's stuff this year, there are two batches in the system:
> - The **August Content Waterfall batch** — 9 pieces, still sitting in
>   the queue, haven't started on those yet.
> - The **September Content Waterfall batch** — 5 pieces, all delivered
>   Sep 13.
>
> So **14 Bonnie pieces total** so far this year.
>
> On the money side, honest answer: my Upwork billing runs as one weekly
> total covering everything on your account, not broken out per
> sub-client. So based on the work I can cleanly attribute to Bonnie
> specifically, I can't hand you a clean "this much has already been
> billed for her" number. What I *can* tell you: nothing's been invoiced
> as a Bonnie-specific line item — it's all just folded into the regular
> weekly total, same as everything else.
>
> If you want a running Bonnie-only total going forward, I can start
> tracking that separately from here — just say the word.

---

## Part B — Client Portal Width Patch

### 9. Client Width Root Cause

Same root cause as the Operator patch, confirmed by reading
`src/app/client/layout.tsx`: it's metadata-only, no wrapper markup, and
`AppShell` already renders every `/client/*` route bare (no Sidebar —
see `route-classification.ts`). The width problem was each page's own
`mx-auto max-w-5xl` wrapper, same pattern, different app.

### 10. Files Changed

| File | Change |
|---|---|
| `components/layout/workspace.ts` | added `CLIENT_PORTAL_WORKSPACE_CLASS` (same reasoning as the Operator's constant, kept separate so each import stays self-documenting) |
| `app/client/dashboard/page.tsx` | header + main content wrapper widened (2 spots) |
| `app/client/dashboard/VideoGallery.tsx` | video grid gains `xl:grid-cols-4` |
| `app/client/dashboard/DashboardSearch.tsx` | search results grid gains `xl:grid-cols-4` |
| `app/client/[token]/page.tsx` | legacy Vault wrapper widened `max-w-4xl → max-w-6xl` (bounded, not full-bleed — secondary surface, not fully audited this pass) |

**Deliberately left narrow**: `/client/login`, `/client/reset` (forms —
verified still centered/narrow after this patch), and
`/client/dashboard/videos/[id]` (a single-video focused view, not a
grid — same reasoning as leaving the Operator's video-detail modal
bounded rather than full-bleed).

**Not touched**: `requireClientAuth`, `getClientDashboardView`'s
per-client scoping, `visibleToClient` filtering,
`dashboardSections`/`permissions` flags, any query. Confirmed by
`git diff` — every change in this patch is a Tailwind class string.

### 11. Responsive QA

Verified live against **both** real portal fixtures via actual
`/client/login` sessions (local dev D1 — not Preview-as-Client, the real
route), at 1920×1080, 1440×900, 1180×820, 768×1024, 375×812:

- **Taryn**: her exact intended flag set (`Current Account`/`Summary`/
  `Completed by Type` OFF, `Search`/`Active Work`/`Recent Deliveries`/
  `Video Library` ON, `Financials` OFF, `Review`/`Priority` ON) rendered
  correctly at every width — no `$` amounts visible anywhere (Financials
  OFF, confirmed), Review actions and priority star both present. No
  overflow, no squeezed cards, correct single-column stacking on mobile.
- **Dave** (regression only, not re-reconciled): logged in, dashboard
  rendered with his own (different, all-ON) section set, own videos
  only, no cross-client content, zero console errors.

Zero console errors across every check. Zero data/security regression —
this was a layout-only patch and it was verified as one.

### 12. Tests / Build

| Gate | Result |
|---|---|
| `git diff --check` | clean |
| Targeted Client layout tests | none exist as a pattern in this repo (confirmed by search) — layout-only changes verified via live browser QA per this repo's own established convention |
| `npm test` | **1078/1078 pass** |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 errors (3 pre-existing unrelated warnings) |
| `npm run build` | succeeds |
| `rm -rf .next .open-next` + `npm run build:client` (fresh, Client target only) | succeeds |
| `opennextjs-cloudflare build --skipNextBuild --config wrangler.client.jsonc` + `prepare-client-assets.mjs` | succeeds |
| Client `basePath` | confirmed `""` in `routes-manifest.json` before deploy |

### 13. Client Deploy

| | |
|---|---|
| Pre-deploy Client version | `b9d0e462-3838-40e2-b543-d62dc44c2b9a` |
| **New Client version** | **`758ae308-8fd6-418a-be4f-6208e1e5cc1f`** |
| Traffic | 100% |
| Operator Worker | **not touched, not redeployed** |

### 14. Live Smoke

`wrangler tail` live during checks; all requests returned `Ok`, no
`exceededCpu`/`exceededResources`, no 500s:

| Route | Result |
|---|---|
| `/client` | 307 (correctly redirects unauthenticated) |
| `/client/login` | 200 |
| `/client/reset` | 200 |
| static asset (`rmedia-client-logo.svg`) | 200 |
| `/client/media/<fake-path>` | 404 (correctly not-found, not a leak or a 500) |

Authenticated Taryn/Dave sessions were **not** exercised against the
live production Worker (no safe production credentials available to
this agent) — the full authenticated verification in §11 was performed
against local dev D1 with real login sessions, the closest safe
equivalent. Route-level production smoke above confirms the deployed
Worker itself is healthy.

### 15. Rollback Status

**Not required.** No 500s, no auth regression, no broken assets, no
cross-client exposure found at any point.

---

## Final Structured Output

```
BONNIE SCOPE:            GREEN
BONNIE TRACKED HOURS:    ~13 minutes (MindBunker only; not representative — 13/14 videos have zero logged sessions)
BONNIE BILLED:            NOT SAFELY DERIVABLE
BONNIE UNBILLED:          NOT SAFELY DERIVABLE
BONNIE TOTAL:             NOT SAFELY DERIVABLE (in dollars) — 14 pieces (9 not started, 5 delivered) is the confidently-known total
CLIENT-FACING MESSAGE:    READY

CLIENT WIDTH: GREEN

TESTS: 1078/1078
MIGRATIONS: NONE
PRODUCTION D1 MUTATION: NONE
OPERATOR DEPLOY: NONE
CLIENT DEPLOY: 758ae308-8fd6-418a-be4f-6208e1e5cc1f
ROLLBACK: NOT REQUIRED
```

**FINAL VERDICT:**

**YELLOW — Client width fix is fully GREEN and live. Bonnie's exact
billed/unbilled dollar split is genuinely NOT SAFELY DERIVABLE from
current data (weekly-aggregate Upwork billing, zero per-video
allocation ever recorded) — the Slack draft above is honest about that
and still gives Taryn a real, useful answer (14 pieces, what's done vs.
not). Send it as written, or hold if you'd rather build the exact
dollar split first using the existing (currently-unused)
`billing_allocations` mechanism — that's a real, small follow-up, not
started here since this task was read-only.**

STOP.
