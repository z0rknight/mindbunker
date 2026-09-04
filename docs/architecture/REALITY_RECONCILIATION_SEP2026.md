# Reality Reconciliation (Sep 2026) — Architecture Findings

Source-of-truth reconciliation round. This document covers the parts of the
brief that are findings/recommendations rather than code changes: provenance
(E), Sensor-gap reconciliation UX (F), client-vs-internal classification (G),
pre-flight representation (H), batch production (I), deletion safety (J),
equipment/CAPEX (L), and journal privacy handling (M). The code change for
Part A/K (Dashboard cash source of truth) and the Part E schema extension
ship separately — see the commit and `docs/reality-reconciliation-patch.sql`.

## EVIDENCE CORRECTION (this revision)

The prior revision of this document and the patch script both stated that
no Wise statement for Sep 1-3, 2026 had been found, and tagged the seven
Sep 3 closing balances `SELF_REPORTED` accordingly. That conclusion was
wrong. The seven real Wise-issued PDF statements for that exact window were
present on the Desktop the entire time, in two folders that were not
checked in the prior round because their names don't contain "wise":

- `biz-statement_2026-09-01_2026-09-03_pdf/` — 3 files: BUSINESS USD
  operating (`statement_118287732_...`), BUSINESS BRL operating
  (`statement_168497359_...`), BUSINESS USD Savings
  (`statement_171067558_...`).
- `persona-statement_2026-09-01_2026-09-03_pdf/` — 4 files: PERSONAL BRL
  main (`statement_44840079_...`), PERSONAL USD main
  (`statement_45837980_...`), PERSONAL 'Dolarize' USD
  (`statement_95876029_...`), PERSONAL 'Dolarize' BRL
  (`statement_171018409_...`).

All seven were read in full this round via `pdftotext -layout`. Each is a
genuine Wise-issued statement: real letterhead (Wise Payments Ltd for USD
accounts, Wise Brasil Instituição de Pagamento Ltda for BRL accounts),
"Generated on: 3 September 2026", a `ref:` UUID footer, and real Wise
transaction IDs on every line item. Every one of the seven closing balances
in the correction brief matches the statements' own "`<currency>` on 3
September 2026 [GMT-03:00]: `<amount>`" line exactly:

| Pocket | Statement balance ID | Sep 3 closing balance |
|---|---|---|
| PERSONAL BRL main | 44840079 | 2.60 BRL |
| PERSONAL USD main | 45837980 | 2.72 USD |
| PERSONAL 'Dolarize' USD | 95876029 | 50.00 USD |
| PERSONAL 'Dolarize' BRL | 171018409 | 33.16 BRL |
| BUSINESS USD operating | 118287732 | 21.52 USD |
| BUSINESS BRL operating | 168497359 | 83.73 BRL |
| BUSINESS USD Savings/reserve | 171067558 | 200.00 USD |

None of these were retyped from the correction brief into the patch script
— they were copied from the statement text directly, and the patch script
cites the exact line for each. See `docs/reality-reconciliation-patch.sql`
Sections 1 and 2 for the per-pocket citation and Wise transaction IDs.

### The $300 → $200 business reserve movement is resolved

The prior revision flagged the Aug 31 → Sep 3 drop in the USD business
reserve pocket ($300.00 → $200.00) as "UNEXPLAINED... neither journal
reviewed this round mentions a reserve withdrawal." That flag is now
resolved by direct statement evidence, not by journal inference:

- The BUSINESS USD Savings statement (`statement_171067558_...`) shows
  exactly one transaction in the window: "Moved 100.00 USD to USD",
  -100.00, Transaction `BALANCE-6001326761`, 3 September 2026. Opening
  300.00 → closing 200.00.
- The BUSINESS USD operating statement (`statement_118287732_...`) shows
  the matching credit: "Moved 100.00 USD from Savings", +100.00, same
  Transaction ID `BALANCE-6001326761`, same date.

Same Wise transaction ID on both sides is what makes this a single,
verified internal transfer rather than two unrelated $100 events — Wise's
own ledger records both legs of one balance-to-balance move. The patch
script represents this as two matched `cash_movements` rows
(`state = 'INTERNAL_TRANSFER'`, `external_source = 'WISE'`,
`external_id = 'BALANCE-6001326761'`), the same pattern already used by
`recordInternalPocketTransfer()` and already asserted in
`src/modules/cash-accounts/wise-identity.integration.test.mjs` to never
touch `transactions` or `personal_transactions` — this movement is neither
revenue nor expense, and does not change total company cash (it only moves
$100 between two pockets of the same currency, same scope). Company USD
total cash on Sep 3 is `21.52 (operating) + 200.00 (reserve) = 221.52 USD`,
correctly kept as two separate Dashboard figures (Available vs Reserved),
not collapsed into one number — the existing `computeCashHeadlineByCurrency`
already does this per-pocket, unchanged this round.

Currency-conversion lines that appear on both a USD and a BRL statement
(e.g. "Converted 27.66 USD to 140.00 BRL", same transaction ID on both
sides) were identified during this review but are NOT imported as
`cash_movements` or transactions — importing every FX/transfer/card line
from all seven statements would be a full ledger-import feature, out of
scope for this narrow correction. Only the one internal transfer the
correction brief specifically asked about was recorded as a movement.

Any remaining ambiguity in the Sep 3 evidence — e.g. the exact reason for
each individual card purchase or transfer in the window, or whether the
Terabyte/Amazon/DDR3 purchases should be classified as business vs personal
— is genuinely unsupported by the statements themselves (they show *that*
money moved and to/from where, not *why*) and is left as NEEDS_REVIEW,
unchanged from the prior revision.

## E — Provenance model

No new generic provenance framework was built. The existing pattern —
`work_sessions.source` as an open `text` column with no CHECK constraint,
an app-level const array (`WORK_SESSION_SOURCES`) as the real vocabulary
authority, and a review-queue table (`sensor_sessions`) for anything that
needs human approval before becoming canonical — was extended rather than
replaced:

- `work_sessions.source` gained `JOURNAL_RECONSTRUCTION`.
- `work_sessions` gained two nullable columns, `confidence` and
  `source_reference` (migration `0041`), so a reconstructed row can always
  point back at the evidence that justified it.
- Financial provenance needed no schema change at all —
  `cash_account_snapshots.source` and `transactions.externalSource` /
  `externalId` / `idempotencyKey` were already open-ended and already
  distinguish `WISE_PDF` from anything else. The prior revision of this
  document added a `SELF_REPORTED` value to that vocabulary because no Sep 3
  Wise statement had been found at the time. That was a search gap, not a
  real evidence gap: the seven real Wise PDF statements for 1-3 Sep 2026
  were on the Desktop the whole time, in two folders whose names don't
  contain "wise" (`biz-statement_2026-09-01_2026-09-03_pdf/` and
  `persona-statement_2026-09-01_2026-09-03_pdf/`) — see EVIDENCE CORRECTION
  below. All seven Sep 3 closing balances are now tagged `WISE_PDF`, the
  same value already used for the Aug 31 business-pocket reconciliation.
  `SELF_REPORTED` was removed from the patch script entirely — it is not
  kept around as a vestigial value, and no other row in this round ever
  used it.

This matches the brief's own instruction to avoid a giant migration if a
smaller extension solves it, and reuses a pattern the codebase had already
converged on twice (Sensor capture-method tagging, Wise import identity).

## F — Sensor gaps are data

The Sensor-side precedent for "the machine didn't observe this, but real
work still happened" already exists and is more mature than anything Web-
side: `sensor_sessions.approvalState` (PENDING/APPROVED/ARCHIVED/DELETED)
is a genuine human-in-the-loop review queue, and `reconciliation_notes` is
the Web-side "annotate the gap, don't fabricate a session for it" fallback,
explicitly documented in schema.ts as "a safer alternative to fabricating
historical Work Sessions... never counted as operational truth."

This round did not build a new "Day Reconciliation" screen — that's real UI
work the brief itself says should follow investigation, not precede it. What
it did instead, deliberately smaller: it used the *existing* mechanisms for
the two concrete gaps found in the Sep 2/3 evidence (see the patch script)
rather than inventing a third pattern:
- The Sep 2 Taryn gap (02:15–04:36, no existing session) becomes a real
  `work_sessions` row tagged `JOURNAL_RECONSTRUCTION`, guarded against
  overlapping anything that already exists.
- The Sep 3 Taryn interval needed *no* reconstruction at all — you already
  corrected Work Session #41 yourself, live, in the Work Session Ledger that
  day. That's the "operator confirms an ambiguous reconstruction" step the
  brief asks for, already done, just not by this round.

A real "UNTRACKED ACTIVITY DETECTED" surface (comparing journal-covered time
ranges against Sensor+WEB_TIMER coverage, prompting "Add Missed Session") is
a legitimate next feature, but it's exactly the kind of new UI layer the
brief's Part P discipline warns against building half of in the same round
as a financial source-of-truth fix. Recommended as a follow-up round, not
attempted here.

## G — Client vs internal classification

Two independent taxonomies already exist and already answer most of this:
`work_sessions.activityType` (EDITING/MOTION_GRAPHICS/COLOR/AUDIO/REVIEW/
EXPORT/ADMIN/CLIENT_SERVICE/OTHER — *what kind* of work) and
`video_logs.videoKind` (CLIENT_WORK/SAMPLE_VIDEO/INTERNAL/OTHER — *whose*
work), gated through `countsTowardRevenue`/`countsTowardProduction` in
`video-classification/core.ts`. No schema gap was found here worth closing
this round — the Sep 2/3 evidence classifies cleanly under the existing
vocabulary (Taryn work = CLIENT_SERVICE/EDITING against a CLIENT_WORK video;
"passe geral no MindBunker" = ADMIN against an INTERNAL video under the
RMEDIA pseudo-client).

## H — Pre-flight is already represented, and you built the pattern yourself on Sep 3

This was the single most interesting finding of the whole round: you didn't
need this investigated and then designed — you already invented the pattern
live, in the app, on Sep 3, for Dave's pre-flight. The Quinta journal shows
you creating an `OPERATION / ADMIN / PRE-FLIGHT` project under Dave DeMink
with a single `DAVE - PREFLIGHT` video, and starting the Sensor against it
("A ideia é que agora que eu estou organizando os projetos e baixando os
arquivos o relógio já esteja contando, afinal de contas eu já estou
trabalhando" — the clock should already be running because pre-flight is
real work). This is exactly the `RMEDIA`-pseudo-client + `videoKind=INTERNAL`
mechanism `client-identity.ts` was built for (see Post-Job Sniper round),
just pointed at a specific client's project instead of the general RMEDIA
bucket. No schema change is needed for this — it already works. The rough
edge is UX, not data model: there's no shortcut for "start a pre-flight
video for client X," so you hand-built the project/video pair from scratch
each time.

## I — Batch production

Also self-documented on Sep 3: `video_logs.batchLabel` (a plain scalar, "no
batches table, no batch analytics" by design per its own schema comment) is
exactly what the "3SEP - Short Form" / "HSF - 3SEP" / "VSF - 3SEP" labels in
the journal are exercising. The friction you hit live matches the schema's
own documented limitation almost exactly:
- **Bulk rename**: not supported — "Edit selected videos" only changes
  status/date/delivery-url/review-url/batch-label, never the title, and you
  ended up deleting and recreating five video rows individually because
  there is no bulk-video-delete either. This is a real, now-confirmed gap
  (not a guess).
- **Project deletion has no undo**: after mis-structuring a project (Long
  Form vs Horizontal/Vertical split), you deleted the whole "Long Form"
  project outright and wrote, verbatim, "seria bom se tivesse como reverter
  isso, não sei se tem atualmente" — see Part J below, this is the same
  finding from the inside.
- **Invoice-level attribution is still an open question** — your own note,
  "não sei como ficaria isso do ponto de vista do lado do faturamento do
  cliente, bom estudar essa UX," is worth carrying into whatever round
  eventually builds real batch-level billing.

Recommendation: PROJECT → (batchLabel, already free-text) → VIDEO →
WORK_SESSION is sufficient as a *time-attribution* model today. What's
missing is batch-level *operations* (rename-all, delete-all, one shared
pre-flight clock instead of the 20 minutes of untracked Sensor time you
explicitly noted losing on the first Dave video of a batch). That's real
scoped work for a future round, not a schema problem to fix now.

## J — Deletion safety

Confirmed, live, from your own Sep 3 use: `deleteProject` is a genuine hard
DELETE with no soft-delete/archive path and no undo, and you hit exactly
that gap in production this week ("Projeto deletado... seria bom se tivesse
como reverter isso"). Contrast with `video_logs`, which already refuses to
delete if any `work_sessions` reference it, and `clients`, which already has
a real soft-archive concept (`archivalState` = ACTIVE_SURFACE/GELADEIRA)
entirely separate from hard delete. Projects have neither guard. Given nine
active projects observed in the Sep 3 screenshots alone, and now a live
example of an accidental-adjacent deletion, this is the one item from this
whole findings section worth prioritizing as an actual next patch: either
(a) extend the existing `work_sessions`-reference guard pattern to projects
(refuse to hard-delete a project with any video that has tracked work), or
(b) give projects the same `archivalState` pattern clients already have.
Not implemented in this round to keep the patch narrow, per Part P.

## L — Equipment / CAPEX

Real Sep 3 purchases found in the Quinta journal, none currently recorded in
MindBunker (no live DB access to confirm the negative, but nothing in the
evidence suggests they were logged), all genuinely ambiguous ownership:

| Item | Amount | Evidence | Ownership signal |
|---|---|---|---|
| Amazon order (coffee grinder, Star Wars Xbox game, RJ45 crimp kit, 500GB HDD) | ~R$300 (itemized: R$41.90 + R$50 + R$89 + R$100) | Quinta p.4 | Mixed — grinder/game explicitly personal; HDD installed in a NAS described as "for family," RJ45 kit plausibly RMEDIA infra-adjacent |
| DDR3 RAM kit + 500GB HDD | R$150 | Quinta p.4 | Personal — explicitly for grandfather's photo computer |
| Terabyte order: Gabinete D100F + fonte 200W, teclado/mouse combo | R$140.39 (real receipt, order #8354209) | Quinta p.4–5 | Personal — billed to your own name/CPF/address; explicitly "fica como reserva," a possible future RMEDIA infra piece but not committed as one |

Per the brief's explicit instruction, none of these were inserted as
`transactions` or classified as CAPEX. All three are **NEEDS_REVIEW** —
carried into the reconciliation table in the final report, not the
database. This is a one-day sample; if this spending pattern is routine, an
Equipment Manager (purchase → asset → owner → cost → location → status →
purpose) is legitimate future scope, explicitly out of scope this round per
the brief.

## M — Journal privacy

The Quinta and Quartaste journals contain personal reflections on mood,
sleep, and substance use throughout. None of that content appears anywhere
in this document, the reconciliation table, the patch script, or any commit
message — only operationally relevant facts were extracted (work/break
boundaries, explicit decisions, timestamps, purchases, product ideas). No
medical or psychological classification was performed or inferred at any
point in this round.
