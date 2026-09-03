# Reality Reconciliation (Sep 2026) — Architecture Findings

Source-of-truth reconciliation round. This document covers the parts of the
brief that are findings/recommendations rather than code changes: provenance
(E), Sensor-gap reconciliation UX (F), client-vs-internal classification (G),
pre-flight representation (H), batch production (I), deletion safety (J),
equipment/CAPEX (L), and journal privacy handling (M). The code change for
Part A/K (Dashboard cash source of truth) and the Part E schema extension
ship separately — see the commit and `docs/reality-reconciliation-patch.sql`.

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
  distinguish `WISE_PDF` from anything else. This round adds a
  `SELF_REPORTED` value to that existing vocabulary (see the patch script),
  it does not invent a new mechanism.

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
