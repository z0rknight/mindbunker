# RMEDIA OS — Wave 5: CRM Pilot Truth QA + Operator Release
**Branch:** `codex/p0-video-workspace-hotfix` (worktree `mindbunker-video-workspace-hotfix`)
**Date:** 2026-09-14
**Status: DEPLOYED to Operator Worker. `production/current` update BLOCKED — needs Emmanuel's push.**

---

## 1. Source Baseline

| | |
|---|---|
| Wave 4 candidate commit | `aa778c3` |
| Known production source before Wave 4 | `0de8a93d2ca88f3cbd3665a6e3ff7b08cba67079` (= `origin/production/current`, confirmed by direct fetch) |
| D1 migration head (local + remote) | `0049_certain_frog_thor.sql` — confirmed identical; `wrangler d1 migrations list mindbunker --remote` → "No migrations to apply!" |
| Workers Paid | Active (confirmed via earlier P0 closure wave) |
| P0 1102 | Closed |
| git HEAD at start of this wave | `aa778c3` (clean, no uncommitted work) |
| git HEAD after this wave's fixes | `1c253c6` |
| Branch | `codex/p0-video-workspace-hotfix` |
| Pre-deploy Operator version | `cf8b54bc-d0ce-42ad-ad74-acbcfb4af81b` ("MindBunker House Cleaning Wave 2", 2026-09-14T10:15) |

---

## 2. Wave-4 Fixture Discrepancy (root cause, confirmed)

Wave 4's local dev D1 was stale, exactly as flagged. Reading **production
D1 directly, read-only**, surfaced the actual root cause and it is bigger
than "the numbers are stale":

> **Dave DeMink is production `client_id = 4`, not `client_id = 1`.**
> Production `client_id = 1` is **Shelley Riutta**, an unrelated client.

Local dev D1 happens to seed Dave at local `client_id = 1` — a coincidence
of independent local/production autoincrement sequences, not a data bug.
But it meant Wave 4's local fixture had Dave's *local* id=1 wearing
Taryn's-shape commercial data (`Upwork/Hourly/$25`) purely because the one
local contract row (`client_id=1`) had been seeded with the wrong
platform. Verified against production (read-only, `--remote`, no
`--local` mutation for this read):

| Client | Production `client_id` | Contract row | Platform / Type / Rate | Status |
|---|---|---|---|---|
| Taryn Dubreuil | 2 | `commercial_contracts.id=1` | Upwork / HOURLY / $25 | ACTIVE |
| Dave DeMink | **4** | `commercial_contracts.id=2` | Direct / HOURLY / $25 | ACTIVE |
| (unrelated) Shelley Riutta | 1 | `commercial_contracts.id=3` | Direct / HOURLY / $25 | ACTIVE |

Dave's historical $100 landing-page job is real and present in
production, but it is **not a second contract row** — it's
`billing_evidence.id=1` (`gross_amount=100`, `source=MANUAL`,
`external_reference` = a Wise payment link), attached to his current
contract id. There is no data contradiction in production; Wave 4's local
fixture simply didn't reflect any of this.

---

## 3. Faithful Dave QA

Local dev D1 (`--local` only) was corrected to match the canonical facts,
without copying any secret material (no password hashes, no session
tokens, nothing from `auth_*`/`portal_*_hash` columns):
- `commercial_contracts.id=1` (local Dave, `client_id=1`): `platform`
  corrected `Upwork → Direct`.
- Added `commercial_contracts.id=2`: `client_id=1`, `Direct / FIXED /
  NULL`, `status=ENDED`, dated 2026-06-01, `notes` documenting it as the
  historical landing-page job — so the "does not override current" rule
  has a real local fixture to prove itself against, not just a unit test.

**Live result** (`http://localhost:3014/mindbunker/crm/1`, screenshot-verified at all 5 breakpoints):
```
COMMERCIAL RELATIONSHIP
Direct · Hourly · $25.00/hr
```
The ENDED/FIXED historical row never appears and never wins. Active Jobs
correctly shows "Short Form Videos" (active, 6 videos) first; Unassigned
Deliverables stays bounded to 4 shown of 5 total; Portal Manager reflects
Dave's actual local flags (all visible, matching his existing
configuration — no flags were changed for Dave this wave).

---

## 4. Faithful Taryn QA

Local dev D1 corrected: inserted `commercial_contracts` row for local
`client_id=2`: `Upwork / HOURLY / $25 / ACTIVE` (previously she had **no**
contract row at all locally, hence Wave 4's "No contract on file").
Portal flags updated to the Wave-3-reconciled production truth (see §8
for the full table — verbatim match, live-screenshot-confirmed).

**Live result** (`http://localhost:3014/mindbunker/crm/2`):
```
COMMERCIAL RELATIONSHIP
Upwork · Hourly · $25.00/hr
```
Active Jobs shows "Mini Series" (23 local videos, active) with 5 shown +
"+18 more in this project →" — a real, live demonstration of the dense-
queue bounding behavior the reconciled 31-video count also proves
deterministically in §12's unit tests.

---

## 5. Lead QA

Wave 4 left this as code-inspection only. Closed for real this wave: one
local-only sparse lead fixture created (`INSERT INTO clients (name)
SELECT 'QA Sparse Lead'` — every other column left at its schema
default, so `status` defaults to `'lead'`). Live-screenshot-verified at
all 5 breakpoints (`http://localhost:3014/mindbunker/crm/5`):

- Identity Rail: renders correctly, `LEAD` badge, `—` for missing
  email/phone/client-since (createdAt is genuinely `NULL` for this raw
  insert — handled gracefully, no crash).
- Dossier: neutral empty states throughout — "No next action set", "No
  interaction recorded", "No contract on file", "Not set up". Nothing
  fabricated.
- Active Jobs: "No active or in-review projects right now." — useful,
  not blank.
- **Dashboard Manager does not render at all** — confirmed absent from
  the page between the Quotes panel and the tab bar, at every breakpoint.
- No portal controls of any kind appear.
- Zero console errors, zero server errors (checked via a fresh browser
  tab with no prior console history).

Per §9's closing instruction, the fixture was **left in local dev D1**
rather than removed: this repo has no committed seed/fixture script
convention to add it to (verified — no `seed.ts`/`fixtures/` anywhere in
the tree), and `.wrangler/` is gitignored, so leaving it costs nothing
and is available for future local QA in this worktree.

---

## 6. Active Jobs Selections (exact, observed)

| Client | Cards shown | Videos shown per card | Hidden-count affordance |
|---|---|---|---|
| Dave (local) | "Short Form Videos" (ACTIVE, 6 videos) | 5 of 6 | "+1 more in this project →" |
| Dave — Unassigned Deliverables | — | 4 of 5 | "(5)" header count + 4 chips shown |
| Taryn (local) | "Mini Series" (ACTIVE, 23 videos) | 5 of 23 | "+18 more in this project →" |
| Lead | none | — | "No active or in-review projects right now." |

No historical/delivered/archived/planned-only project was ever
reconstructed into Active Jobs for either pilot — confirmed both live and
by the `selectActiveJobs` unit tests (§12), which explicitly assert
`planned`/`delivered`/`archived` projects are excluded regardless of
video-status composition inside them.

---

## 7. Contract-Selection Semantics (the real fix this wave)

`selectActiveContractForClient` previously used `Array.find()`, correct
today only because `getCommercialContracts()` happens to sort
`desc(createdAt)` — an accidental dependency the pure function had no
control over and could not enforce. **Fixed**: the function now filters
to this client's `ACTIVE` contracts itself and explicitly resolves ties
(most-recently-created wins; highest `id` breaks an exact-timestamp tie),
independent of whatever order the caller's array happens to be in.

Proven with new tests (§12) using Dave's real shape — an ENDED/FIXED
historical contract alongside his current ACTIVE/HOURLY one — passed to
the function in **both array orders**, asserting the same (current)
contract wins either way. Also covers the case of two simultaneously
ACTIVE contracts for one client (not a real state in production today —
every client currently has at most one ACTIVE contract, verified by
direct query — but the function is now correct regardless).

---

## 8. Portal Manager Truth

Live screenshot of Taryn's Dashboard Manager
(`http://localhost:3014/mindbunker/crm/2`) against the corrected local
fixture, compared field-by-field to the mission's canonical table:

| Field | Required | Observed |
|---|---|---|
| Search | VISIBLE | VISIBLE ✓ |
| Active Work | VISIBLE | VISIBLE ✓ |
| Recent Deliveries | VISIBLE | VISIBLE ✓ |
| Video Library | VISIBLE | VISIBLE ✓ |
| Current Account | HIDDEN | HIDDEN ✓ |
| Summary | HIDDEN | HIDDEN ✓ |
| Completed by Type | HIDDEN | HIDDEN ✓ |
| Financial summary | HIDDEN | HIDDEN ✓ |
| Review actions | VISIBLE | VISIBLE ✓ |
| Priority request | VISIBLE | VISIBLE ✓ |

All 10/10 match exactly. No production flag was read from or written to
during this verification — only the local fixture was set up to mirror
them (§4), then screenshotted.

---

## 9. Client/Server Boundary Audit

- `ClientDashboardManager.tsx` carries `"use client"` (Wave 4's fix,
  reverified this wave).
- Its imports: `next/link` (safe), `PortalControl` (already
  `"use client"`), `setClientDashboardSection`/`setClientPortalCapability`
  from `admin-actions.ts` (starts with `"use server"` — Next.js compiles
  these to opaque action references in the client bundle, not their real
  DB-touching implementation; this is the standard safe pattern, already
  used by the pre-Wave-4 `ClientTabs.tsx`), `PortalAccessPanel` (already
  `"use client"`, imports only `next/navigation`, `react`, a plain string
  constant from `@/lib/auth-core`, and two more `"use server"` actions).
- **No server-only DB code, secrets, or large server modules enter the
  client bundle.** Nothing here needed to change; Wave 4's fix already
  produced a correct tree.
- Live re-verification: fresh browser tab, zero console errors across
  Dave/Taryn/lead page loads and the Search-toggle interaction test.

---

## 10. Query / Data Exposure Audit

Traced every use of the two reused global queries in `page.tsx`:

```
allUnassignedVideos, allContracts  (from Promise.all)
  → only ever passed into filterVideosForClient() / selectActiveContractForClient()
  → the *raw global arrays* are never passed as a prop to any component, client or server
  → only the already-filtered/selected results (unassignedVideos: this client's videos,
    activeContract: one contract or null) ever reach a component
```

`grep` confirms `allUnassignedVideos`/`allContracts` appear in `page.tsx`
only in the `Promise.all` destructure and the two filter/select calls —
nowhere else. `ClientDashboardManager` receives only scalar per-client
fields (`clientId`, `clientEmail`, `portalPasswordSetAt`, ten booleans) —
no array, no other client's data, confirmed by reading its full prop
list. No N+1: total query count for the page is unchanged from Wave 4
(same `Promise.all` shape). No rewrite was needed — this was a
verification pass, not a defect.

---

## 11. Responsive QA

Full breakpoint sweep (1920×1080 / 1440×900 / 1180×820 / 768×1024 /
375×812) repeated for **all three** pilots (Dave, Taryn, lead) against
the corrected fixture — 15 live screenshots total. Findings:

- **Fixed a real regression**: at 1180×820, the Identity Rail's name +
  Rename button shared one row and `truncate`'d the name down to a
  single letter (e.g. "D…" for "Dave DeMink") — materially degraded
  identification, not cosmetic. Fixed by stacking name above the Rename
  button and letting the name wrap (`break-words`) instead of truncating
  — a small layout/wrapping change, not a redesign. Re-verified at all 5
  breakpoints for all 3 pilots post-fix: full names now legible
  everywhere, including "QA Sparse Lead" and "Taryn Dubreuil" wrapping to
  two lines cleanly at 1180px, and no regression at 1920/1440 where names
  still fit on one line.
- No horizontal overflow at any breakpoint.
- No duplicated old/new UI blocks anywhere.
- No 500s, no hydration warnings, no console errors (verified via fresh
  tabs to avoid stale console history).
- Narrow-screen stacking order (**Identity → Dossier → Active Jobs →
  Metrics → …**) reconfirmed for all three pilots at 768px, including the
  lead (whose Dashboard Manager correctly never appears in that stack at
  all).

---

## 12. Tests

`spatial-composition.test.mjs` expanded **10 → 18 tests**, all passing.
New coverage, mapped directly to the mission's required semantics:

| Requirement | Test |
|---|---|
| Dave Direct active contract wins | "Dave: current Direct/Hourly contract wins over a superseded historical Fixed contract, regardless of array order" |
| Taryn Upwork active contract | "Taryn: current Upwork/Hourly contract is selected" |
| Historical does not override current | (same Dave test, asserts `billingType === "HOURLY"` on the winner) |
| No cross-client contract | "selectActiveContractForClient only matches this client's ACTIVE contract" (pre-existing, kept) |
| No cross-client unassigned video | "filterVideosForClient never leaks another client's rows" + new sparse-safe variant |
| Taryn dense planned queue stays bounded | "boundedSlice: Taryn's reconciled 31-video project stays bounded to the display cap" — literally 31 synthetic items → 5 shown / 26 hidden |
| Review/in-progress projects selected correctly | "selectActiveJobs: review and in-progress work is selected, planned/delivered/archived is not" |
| Lead/sparse composition safe | "sparse/lead composition: every helper degrades to an empty, non-crashing result" |
| Deterministic tie-breaking (new, §7) | two dedicated tests: most-recent-wins regardless of order, and id-tiebreak on equal timestamps |

No React/DOM test framework was introduced — this repo has none
(confirmed: no `@testing-library/react`, jsdom, jest, or vitest in
`package.json`; `npm test` only runs `node --test` over plain `.mjs`
files). Component-level interaction (a real toggle → server action → D1
write → UI refresh) was instead verified live in the browser, as in
Wave 4.

---

## 13. Build Gates

| Gate | Result |
|---|---|
| `git diff --check` | clean |
| targeted spatial tests | **18/18 pass** |
| `npm test` (full suite) | **1073/1073 pass** |
| `npx tsc --noEmit` | clean, exit 0 |
| `npx eslint .` | 0 errors, 3 pre-existing unrelated warnings (unchanged from Wave 4) |
| `npm run build` | succeeds |
| `rm -rf .next .open-next` + fresh `npm run build` | succeeds from a clean slate |
| `npx opennextjs-cloudflare build` | succeeds, `.open-next/worker.js` produced |
| basePath check | `routes-manifest.json` and `required-server-files.json` both confirm `"basePath": "/mindbunker"` (Operator target) — verified before deploy, as required |

No migration was generated or needed — `src/db/schema.ts` was never
touched (confirmed via `git diff`).

---

## 14. Files Changed (this wave, commit `1c253c6`)

```
src/app/crm/[id]/ClientIdentityRail.tsx      |  14 +++-   (§11 truncation fix)
src/modules/crm/spatial-composition.test.mjs | 115 ++--   (§12 expanded tests)
src/modules/crm/spatial-composition.ts       |  35 ++--   (§7 determinism fix)
3 files changed, 147 insertions(+), 17 deletions(-)
```
No production data files, no migrations, no schema changes.

---

## 15. Production Deploy

Deployed via `npx opennextjs-cloudflare deploy` (Operator target,
`wrangler.jsonc`, unchanged config). Result: 47 assets uploaded (34
already cached), Worker uploaded and routed to
`emmanueldarosa.com/mindbunker*` at 100% traffic.

⚠ **Note on deploy output**: the CLI's binding summary printed
`env.DB (mindbunker-local)`. Investigated before trusting it: `wrangler
d1 list` confirms no database named `mindbunker-local` exists anywhere in
the account (only `mindbunker` and `rmedia_book_db`, both real). `git
diff origin/production/current -- wrangler.jsonc` shows this project's
`d1_databases` config (which sets both `database_id` — the real
production UUID — and `preview_database_id: "mindbunker-local"`, a
label, not a UUID) is **byte-identical** to every prior production
deploy, including the one live before this session. This is a pre-
existing, cosmetic Wrangler CLI display quirk (it echoes
`preview_database_id` as the binding's friendly name even on a real
non-preview deploy), not a new defect and not evidence of a wrong D1
binding — confirmed further by the live smoke in §17 completing with no
D1 errors of any kind.

| | |
|---|---|
| Pre-deploy Operator version | `cf8b54bc-d0ce-42ad-ad74-acbcfb4af81b` |
| **New Operator version** | **`fb07f165-cfe8-4922-88f9-adb9b819345a`** |
| Traffic | 100% |
| Deployed at | 2026-09-14T17:08:26Z |
| Source SHA | `1c253c6dc810d63fac64e0df4ea57971a4532d0d` |
| Client Worker | **not touched, not redeployed** (no `src/app/client/**` changes this wave) |

---

## 16. Worker Version

See table in §15. Confirmed via `npx wrangler deployments list --name
mindbunker` immediately after deploy — the new version is the sole entry
at 100%, no canary split.

---

## 17. Production Smoke

Authenticated CRM smoke (viewing real client data) was **not performed —
no safe production credentials available to this agent**, per the
mission's own instruction not to fabricate credentials. What *was*
verified, live, against the real deployed Worker:

| Route | Result |
|---|---|
| `/mindbunker` | 307 (redirects to login — correct, auth-gated) |
| `/mindbunker/crm` | 307 (redirects to login — correct, auth-gated) |
| `/mindbunker/projects` | 307 |
| `/mindbunker/productivity` | 307 |
| `/mindbunker/war-room` | 307 |
| `/mindbunker/login` | 200 (renders) |

`wrangler tail` was live during all six requests (plus one incidental
Sensor `catalog` poll, unrelated to this smoke). Every request logged
`Ok` — no exceptions, no D1 errors, no `exceededCpu`, no
`exceededResources`.

```
AUTHENTICATED CRM SMOKE: NOT PERFORMED — NO SAFE AUTH
ROUTE-LEVEL SMOKE: GREEN (6/6 routes respond correctly, worker healthy)
```

Emmanuel can perform the final authenticated visual check himself against
`https://emmanueldarosa.com/mindbunker/crm/4` (Dave) and
`https://emmanueldarosa.com/mindbunker/crm/2` (Taryn) — **note the
production client id for Dave is 4, not 1** (§2).

---

## 18. CPU Health

All 6 smoke requests plus the incidental Sensor poll returned `Ok` in
`wrangler tail` with no `exceededCpu`, no `exceededResources`, and no
1102-shaped failures. Workers Paid remains active. The Cloudflare
forensic investigation was **not** restarted — no error recurred that
would warrant it.

```
1102 HEALTH: GREEN
```

---

## 19. Remaining Cosmetic Issues

- The Wrangler CLI's `env.DB (mindbunker-local)` label on every deploy
  (§15) — pre-existing, cosmetic, not introduced or fixed this wave;
  worth a future `wrangler.jsonc` cleanup pass (e.g. giving
  `preview_database_id` a real preview-DB UUID or removing it) purely for
  CLI-output clarity, not because anything is functionally wrong.
- Local dev D1's `QA Sparse Lead` fixture (`client_id=5` locally) and the
  corrected Dave/Taryn contract rows remain in local dev D1 going
  forward (§5) — harmless, gitignored, not a repo change.

---

## 20. Final Accepted SHA

```
1c253c6dc810d63fac64e0df4ea57971a4532d0d
```

This is the SHA deployed to the Operator Worker as version
`fb07f165-cfe8-4922-88f9-adb9b819345a`. **`production/current` was NOT
updated to this SHA** — the push (`git push origin HEAD:production/current`)
was blocked by this session's own permission guardrail (out-of-place
publication to a shared branch). Emmanuel should run this himself:

```bash
git push origin 1c253c6dc810d63fac64e0df4ea57971a4532d0d:production/current
```

(A plain fast-forward — `origin/production/current` at `0de8a93d` is a
direct ancestor of `1c253c6`, confirmed via `git merge-base
--is-ancestor`.)

---

## Final Structured Output

```
CRM SPATIAL MODEL:      GREEN
DAVE CANONICAL QA:      GREEN  (Direct · Hourly · $25/hr, historical FIXED correctly excluded)
TARYN CANONICAL QA:     GREEN  (Upwork · Hourly · $25/hr, all 10 portal flags match exactly)
LEAD QA:                GREEN  (live-verified, not code-inspection-only this time)
ACTIVE JOBS:            GREEN  (correct selection for both pilots, bounded correctly)
COMMERCIAL RELATIONSHIP: GREEN  (deterministic selection, order-independent, regression-tested)
PORTAL MANAGER:         GREEN  (10/10 fields match Taryn's canonical truth)
CLIENT/SERVER BOUNDARY: GREEN  (audited, no server-only code in client bundle)
RESPONSIVE:             GREEN  (1180px truncation regression found and fixed; full 15-screenshot sweep clean)

TESTS:                  1073/1073 (18/18 targeted)
MIGRATIONS:              NONE
PRODUCTION D1 MUTATIONS: NONE
OPERATOR DEPLOY:         fb07f165-cfe8-4922-88f9-adb9b819345a  (100% traffic)
CLIENT DEPLOY:           NOT PERFORMED
1102 HEALTH:             GREEN
AUTHENTICATED CRM SMOKE: NOT PERFORMED — NO SAFE AUTH  (route-level smoke: GREEN, 6/6)
PRODUCTION/CURRENT:      NOT UPDATED — blocked by permission, needs Emmanuel's push (see §20)
```

**CRM SPATIAL RELEASE: YELLOW — one blocker: `production/current` still
points at the pre-Wave-4 SHA (`0de8a93d`) because the fast-forward push
was blocked by this session's permission guardrail, not by any test,
build, or data-safety failure. Everything else — code, tests, build,
deploy, smoke, CPU health — is GREEN. Emmanuel needs to run the one
`git push` command in §20 (or approve it) to close this out.**

STOP.
Not beginning Dashboard AS IT IS.
Not beginning War Room Sidecar.
Not writing the next Wave.
