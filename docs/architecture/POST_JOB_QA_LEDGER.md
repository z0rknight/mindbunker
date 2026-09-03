# POST-JOB QA LEDGER — Post-Job Commercial + Delivery Sniper

Compiled 2026-09-03. Covers every item from the mission brief's post-job
diary, per §16's explicit instruction that no diary item may be silently
dropped. Status vocabulary: `IMPLEMENTED` / `PARTIAL` / `DEFERRED` /
`REJECTED`, each with a reason.

## Contract attribution (§1)

**Status: IMPLEMENTED.** `projects.contract_id` and `video_logs.contract_id`
added (migration `0040_wakeful_paladin`, additive, FK to
`commercial_contracts`, nullable, `onDelete: set null`). Resolution order
in `getCommercialTermsForVideo`: explicit video contract → explicit
project contract → legacy client-single-ACTIVE-HOURLY-contract fallback
(preserved for backward compatibility) → none. `setVideoContract`/
`setProjectContract` validate same-client ownership server-side
unconditionally. See `docs/architecture/POST_JOB_COMMERCIAL_DELIVERY_SNIPER_REPORT.md`
for the full writeup and `src/modules/quotes/contract-attribution.integration.test.mjs`
for regression coverage.

## Commercial value engine (§2)

**Status: IMPLEMENTED.** `computeRateEquivalent` (`modules/finance/core.ts`)
is now the single canonical formula behind every HOURLY "estimated
accrued value" display (Video Workspace, Project Commercial Summary,
Client Dashboard). Two independent recomputations were found and removed:
`CommercialTermsPanel.tsx`'s own inline `(trackedSeconds/3600)*hourlyRate`,
and `quotes/core.ts`'s unused duplicate `computeRateEquivalent`. FIXED
never derives from hours. Unknown shows "—" (billingModel NONE), never
$0. Currency stays explicit per bucket, never summed across currencies
(`aggregateProjectCommercialSummary`).

## Billing policy / safe margin (§3)

**Status: DEFERRED — COMMERCIAL POLICY BACKLOG**, exactly as the brief's
own escape hatch anticipates. Investigated: `commercial_contracts` has no
`billableIncrementMinutes`/`minimumBillableDuration`/`administrativeAllowance`
field, and adding one that isn't wired to real per-contract policy would
be inventing a default the brief explicitly forbids ("do NOT invent a
default policy or sneak in a universal e.g. 20% margin"). This wave's
math stays factual duration x factual rate only, as instructed. A future
wave should design this with the operator present to set explicit
per-contract policy values, not guess at one.

## Video Workspace (§4)

**Status: IMPLEMENTED.** `CommercialTermsPanel` now shows Tracked
production time / Contract rate / Estimated accrued value (relabeled from
"Rate-equivalent") together, plus which link produced the attribution
(video/project/inferred). A "Link contract" control appears when
unattributed and the client has contracts on file.

## Project Commercial Summary + Notes demotion (§5)

**Status: IMPLEMENTED.** New "Commercial summary" section (tracked work,
per-currency Agreed/Estimated accrued, unattributed-video count) inserted
near the top of the Project workspace page, above the collapsed Notes.
Project Notes is now a closed-by-default `<details>` element instead of
an always-open block competing with commercial/state information for the
first viewport.

## Productivity output (§6)

**Status: DEFERRED.** Not touched this round -- the existing Productivity
page (`src/app/productivity/page.tsx`) already surfaces tracked time,
Planned/Current/Ready-for-review counts, and per-video commercial terms
via `CommercialTermsPanel` (fixed this round). A dedicated "what did I
produce" output-summary card (turnaround, deliverables, accrued value in
one place) was in scope but not built this round given time spent on the
higher-priority attribution/engine/delivery-bug work underneath it --
flagged for the next wave, now that the canonical engine it would consume
already exists.

## Dashboard (§7)

**Status: ALREADY LARGELY IMPLEMENTED, confirmed not touched.**
`getTodayRateEquivalents` (`modules/finance/actions.ts`) already computes
today's per-client attributable work value via the same canonical
`computeRateEquivalent`, correctly currency-separated, correctly omitting
$0 when no attributable time exists, correctly never labeled
"earned"/"revenue". This predates this mission and was verified, not
rebuilt.

## War Room (§8)

**Status: DEFERRED.** Not touched this round. War Room's existing
Commercial Truth / Top Clients by Revenue panels were verified (in a
prior mission) to already keep currencies separate and distinguish
accrued from realized cash at the client-revenue level; wiring the
per-video Estimated Accrued Value (this round's new field) into a War
Room monthly rollup was not attempted this round due to time.

## Client Dashboard (§9)

**Status: PARTIAL.** Client video detail page now shows hourly
rate/tracked time/estimated accrued for HOURLY-attributed videos
(`buildClientHourlySummary`, client-safe: no contractId, no platform
name, no Upwork billing-evidence totals). Paid/Unpaid deliberately
OMITTED, as instructed -- investigation found no deterministic link
from a `transactions` row to a specific project/video/contract period
that would let "paid" be computed safely; inventing one was correctly
out of scope. Period views (this month/project total) not added --
flagged for a future wave.

## Client video click/delivery bug (§10)

**Status: IMPLEMENTED — root cause found and fixed.** Two real,
independent bugs: (1) the Lab's "Deliver Video" flow
(`modules/deliveries/actions.ts`) wrote only to the internal `deliveries`
audit table, never to `video_logs.delivery_url` -- the one field the
client portal reads. (2) `setPublishedUrl`
(`modules/delivery-outcome/actions.ts`) accepted plain `http://` URLs
with its own looser regex, while the client-facing read path
(`toCard`/`validateDeliveryUrl`) is HTTPS-only -- an `http://` URL would
save, look present in the Lab, and then be silently nulled out on every
client-facing card. Both now route through the one canonical
`validateDeliveryUrl`. Regression tests:
`src/modules/deliveries/client-visibility-bug.integration.test.mjs`.

## Delivery generator (§11)

**Status: IMPLEMENTED.** New `modules/delivery-message` module (pure
`formatDeliveryMessage` + server-resolved `getDeliveryMessagePayload`) and
a `DeliveryMessagePanel` in the Video Workspace, reusing the Pricing Lab
copy-to-clipboard interaction. Content type, turnaround (only when
`startedAt` is a real fact), work-done bullets (from actually-tracked
work-session activity types, never invented), deliverables (HTTPS-
validated links only), and Agreed/Estimated-accrued (never both) --
editable before copy, nothing sent automatically. Payload is a plain
provider-independent object so a future Slack/email integration can reuse
it without a rewrite; no such integration was built this wave.

## Request registration (§12)

**Status: DEFERRED.** Not investigated deeply enough this round to
propose a safe minimal flow -- the brief's own instruction ("if an
existing notes/reference/evidence model supports this cleanly...
otherwise do not build a heavy ticketing system") needs a closer look at
whether `sourceMediaReferences` or `revisions` (both already have a
`note`/`sourceUrl`-shaped field) can be safely reused, which this round
did not have time to verify. Flagged for the next wave.

## Work Unit vs Deliverable (§13)

**Status: DEFERRED, with a written architecture note.** See
`docs/architecture/POST_JOB_SNIPER_DEFERRED_ARCHITECTURE.md`. Confirmed no
existing schema concept (parent video, production group, project-level
work session) is available to safely reuse -- a real schema addition is
required, correctly out of scope for this sniper wave per the brief's own
instruction.

## Sensor + Web duplicate evidence (§14)

**Status: DEFERRED, with a written architecture note.** See
`docs/architecture/POST_JOB_SNIPER_DEFERRED_ARCHITECTURE.md`. Confirmed the
real risk exists (`videoClosedSeconds` sums all closed `work_sessions`
rows with no overlap awareness across WEB_TIMER and approved MAC_SENSOR
sessions) and is now load-bearing for the Commercial Value Engine this
round built. A safe fix requires an interval-merge algorithm with its own
dedicated overlap regression tests, not a same-pass addition alongside
first building the engine that depends on its correctness.

## Video Workspace UX reorg (§15)

**Status: PARTIAL.** Only the Project-page notes demotion (§5) was
completed. A full primary/secondary reorganization of the Video Workspace
itself (`VideoEditor.tsx`) was not attempted this round -- flagged for a
dedicated UX pass given the size of that page.

## Migration authorization (§17)

**Status: IMPLEMENTED.** `0040_wakeful_paladin.sql`, additive-only
(`ALTER TABLE ... ADD ... REFERENCES ...`), no destructive rebuild, no
historical data rewrite, generated and verified locally only (no remote
D1 mutation). Full migration chain replayed against a real linux-arm64
D1 local emulator; `PRAGMA foreign_key_check` and `PRAGMA integrity_check`
both clean. See the main report for the exact commands run.
