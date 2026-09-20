# RMEDIA Guided Lead Engine V0 — September 2026

Status: Phase 0 archaeology, deterministic decision model, and isolated local
prototype. No production route, write, migration, price, or automatic
commercial decision was created.

## 1. Current funnel archaeology

### Public and Worker ownership

- The root public site is the separate `late-disk-3e57` static-assets Worker.
- The private/operator application is the `mindbunker` Worker, mounted at
  `emmanueldarosa.com/mindbunker*` with Next `basePath=/mindbunker`.
- The Client application is independently built with an empty base path and a
  separate Worker configuration.
- The public site currently links to `/mindbunker/quoteavideo` and `/book`.
- `/mindbunker/quoteavideo` is the canonical public project inquiry today.
  `/book` is demoted to it in source while preserving a recognized referral.
- `/hello-world` is an existing process/standards page, not a commercial
  intake. `/invite` already has invitation/capability semantics elsewhere in
  the product family and should not be overloaded.

### Existing intake safety that should be reused

The quote and booking paths already implement the useful plumbing:

- honeypot validation before database access;
- closed referral allowlist via `resolveReferral`;
- email-normalized Lead reuse instead of duplicate Client creation;
- `clients.source` precedence: an existing non-empty source is not overwritten;
- immutable `quote.requested` / booking event recording;
- idempotency keys preventing replay duplicates;
- `lead_created` only when the email is genuinely new;
- no Lead creation on page view;
- CRM Lead visibility through the existing `clients` row.

The current quote event is readable but flattens the intake into a description.
That is sufficient for today's form, but not an ideal structured evidence
boundary for a branching diagnostic.

## 2. Recommended route

**Canonical future path: `https://emmanueldarosa.com/start`**

| Candidate | Decision | Reason |
|---|---|---|
| `/start` | Recommend | Short, human, flexible, and does not prematurely promise a quote or call. |
| `/work-with-me` | Secondary wording only | Understandable but longer and more marketing-led than an operating entry point. |
| `/hire-me` | Reject as canonical | Prematurely transactional for an uncertain lead and implies the decision is already made. |
| `/invite` | Reject | Conflicts with private Gateway/Vault capability-link semantics. |
| `/hello-world` | Reject | Already represents process/standards content, not lead diagnosis. |

Because `/start` is outside `/mindbunker*`, its eventual public page belongs to
the public-site Worker. A future same-origin submission can target a narrow
public action under the operator Worker after security and persistence are
implemented. This phase creates neither route.

## 3. Evidence-backed decision variables

Authority order used:

1. `RMEDIA_OFFER_INTAKE_REVERSE_ENGINEERING_2026-09-20.md`;
2. Notion-derived operational reading;
3. original operator idea;
4. secondary AI / NotebookLM material.

The operational report supports intake engineering only **partially** and
labels offer engineering **insufficient**, with **low** economic and
recovery/workload confidence. Its strongest supported distinction is the
number of unresolved decisions, not the number of videos.

V0 captures 15 input groups (some contain more than one value):

1. deliverable count band;
2. recurrence;
3. content type;
4. duration band;
5. format maturity;
6. source readiness;
7. editorial readiness / who finds the story or cuts;
8. desired creative flexibility;
9. progressive technical-complexity signals;
10. review complexity / decision authority;
11. deadline type or cadence;
12. unresolved dependencies;
13. canonical referral source;
14. optional free-form context;
15. contact identity near the end.

These preserve the top operational variables without pretending the evidence
supports automatic effort, margin, or price calculation.

## 4. Variables deliberately excluded

The experience does not ask or infer:

- exact expected revision count before a formula exists;
- subjective quality score without references;
- preferred editing software unless later required by a real technical need;
- virality or performance expectation as a scope proxy;
- Emmanuel's health, sleep, recovery, stress, or cognitive load;
- final commercial model (“hourly or fixed?”) as a lead-facing decision;
- final budget-to-price matching;
- acceptance, capacity approval, or a promised deadline.

The original idea's speculative hourly/referral numbers and the secondary AI's
stronger economic claims are not promoted into product behavior.

## 5. Client-language question map

The normal flow is six meaningful screens; the progressive complexity branch
makes seven. The result is the review screen, not another question.

1. **What are you hoping to make?** — content type and rough duration.
2. **Is this one piece or the start of a rhythm?** — volume and recurrence.
3. **How established is the format?** — approved formula, references, or discovery.
4. **What would Emmanuel receive to begin?** — footage/assets and editorial readiness.
5. **Extra exploration or coordination?** — shown only when earlier answers
   justify technical/dependency detail.
6. **What does a good working process look like?** — timing and decision makers.
7. **Where should Emmanuel continue the conversation?** — contact and optional context.

Every ambiguous area includes a truthful “I'm not sure” path. The lead never
needs to understand Production Orders, Work Sessions, billing evidence,
Content Waterfalls, setup economics, or internal system vocabulary.

## 6. Branching logic

The technical/dependency screen is skipped for a single or small request when:

- the format is established;
- footage/assets are ready;
- the story/cuts are defined;
- volume and cadence do not imply a larger repeatable system.

It is revealed when any of these are true:

- format is new, reference-only, or unknown;
- source or editorial decisions remain open;
- five-plus or ongoing output is expected;
- recurrence is expected.

The model is deterministic JavaScript. There is no ML, magic lead score, hidden
sales qualification, or probabilistic commercial decision.

## 7. Derived dimensions

V0 derives eight explainable operational dimensions:

1. `productionReadiness` — ready, partial, or needs definition;
2. `repeatabilityPotential` — high, emerging, or not primary;
3. `decisionUncertainty` — low, medium, high;
4. `technicalUncertainty` — low, medium, high, or unknown;
5. `coordinationLoad` — low, medium, high;
6. `schedulePressure` — flexible, defined, or high;
7. `likelyPilotNeed` — boolean derived mostly from recurrence plus format maturity;
8. `uncertaintyLevel` — a plain summary, not a score.

No dimension produces price, discount, margin, capacity, timeline acceptance,
or probability-to-close.

## 8. Starting-path rules

Rules are applied in restrained precedence:

1. **Human review required** when core facts remain widely unknown, especially
   under urgency.
2. **Pilot / setup** when a recurring/batch-shaped need lacks an established
   formula.
3. **Flexible, exploratory collaboration** when creative exploration or
   technical uncertainty is materially high.
4. **Repeatable production** when a recurring/batch shape has a known formula,
   ready inputs, and defined cuts.
5. **Defined project** when one or a small number of pieces are bounded, ready,
   and have one clear decision maker.
6. Anything still ambiguous returns to human review rather than forcing a fit.

The recommendation is a conversation starter. Emmanuel remains responsible
for fit, scope, commercial model, timing, capacity, and acceptance.

## 9. Canonical MindBunker contract proposal

Future submission should atomically produce:

1. **one canonical Lead** — reuse the normalized-email behavior in `clients`;
2. **one immutable structured intake snapshot/event** — preserve what was
   answered and what V0 derived at that moment.

Recommended future additive persistence (not created now):

`lead_intake_submissions`

- `id`
- `client_id` FK to the canonical Lead
- `schema_version`
- `referral_source` nullable
- `answers_json`
- `derived_json`
- `human_summary`
- `idempotency_key` unique
- `created_at`

One compact `crm_events` row may reference the submission for the operator
timeline. Do not overload the Gateway-specific `intake_submissions`, and do
not flatten the only structured copy into `crm_events.description`.

Security and write order should reuse current honeypot, referral allowlist,
email dedup, source precedence, server validation, and idempotency behavior.
The browser may supply answers; the server must re-derive classifications from
validated canonical values.

Submission must **not** create a Client relationship, Project, Video,
Production Order, quote, booking, price, or acceptance. Conversion remains a
separate human-authenticated action.

## 10. PDBM compatibility

`/start?ref=pdbm` resolves to the existing canonical origin
`referral:pdbm`. Unknown referral values resolve to nothing. The origin stays
in the structured snapshot and participates in the existing `clients.source`
precedence rules.

It does not produce a discount, special rate, commission, altered path, or
automatic acceptance. The prototype visibly explains that boundary and
includes `referral:pdbm` in its debug payload.

## 11. Capacity behavior

Capacity may later inform Emmanuel's private review, but it never blocks the
public submission. A full workload does not make the lead's needs invalid and
must not silently change the diagnostic result. No capacity fact is currently
derived because workload/recovery confidence is low.

## 12. Pricing boundary

V0 is explicitly not a quote calculator. It emits:

- `price: null`
- `discount: null`
- `commercialDecision: null`
- `capacityDecision: null`
- `requiresHumanReview: true`

The evidence is insufficient for automatic offer engineering, sustainable
effective-hourly-rate estimates, fixed-versus-hourly selection, or referral
discounts. Those stay human and require better job-level all-in/revision/
payment/setup evidence.

## 13. Prototype structure

The static prototype lives at:

`docs/prototypes/guided-intake/`

- `index.html` — semantic shell and local-only warning;
- `styles.css` — RMEDIA OS public-density responsive layer;
- `app.mjs` — accessible branching conversation and session persistence;
- `model.mjs` — pure decision model and payload builder;
- `model.test.mjs` — deterministic scenario coverage;
- `README.md` — local run and safety boundary.

It reuses the non-gamified RMEDIA OS styleboard tokens and choice-card grammar.
It is outside `src/app/` and `public/`, so Next/OpenNext does not route or copy
it. There are no API calls, Server Actions, analytics, cookies, or D1 bindings.
Only `sessionStorage` preserves incomplete local answers.

Interaction details:

- semantic fieldsets, radios, and checkboxes;
- progress without pressure;
- Back and preserved answers;
- 48px controls and mobile safe-area handling;
- keyboard submission and visible focus;
- selected state communicated by marker and text, not color alone;
- heading focus after navigation;
- reduced-motion support;
- final human-readable recommendation plus debug payload.

## 14. Six scenario results

| Case | Evidence shape | Result |
|---|---|---|
| A — repeatable batch | 10 short videos monthly, known template, ready footage/cuts, one approver | Repeatable production |
| B — new recurring format | Weekly series with references but no established formula | Pilot / setup |
| C — exploratory custom video | One important long-form piece with motion, exploration, and evolving scope | Flexible, exploratory collaboration |
| D — defined single video | One bounded piece, known reference/formula, ready inputs, one approver | Defined project |
| E — unclear lead | Knows video help is needed but core format and production decisions are unknown | Conversation first / human review required; never rejected |
| F — PDBM | Case A with `?ref=pdbm` | Repeatable production plus `referral:pdbm` preserved; no price/discount |

All six are executable tests. Two additional tests prove progressive branching
and the evidence invariant that several known pieces may be operationally
simpler than one unresolved custom piece.

## 15. Missing evidence

The next evidence gaps are operational, not more wizard fields:

- stable request → project → sessions → revisions → delivery → invoice → payment custody;
- all-in job time separated into production, coordination, ingest, render,
  upload, and billing without microtracking;
- revision cause, responsibility, and duration;
- source state at acceptance and a distinct `production_ready_at` fact;
- final acceptance and rounds per job;
- received revenue attributed to job/batch;
- pilot/setup time separated from second and third comparable pieces;
- sample outcome (won/lost, acquired value, total time);
- repeated comparable fixed-price work;
- observable recovery/capacity evidence.

Until that exists, economic automation and workload optimization remain out of
scope.

## 16. Next implementation decision

After human review of this prototype, the smallest production decision is:

1. confirm `/start` as the public-site route;
2. freeze the V0 question/branch vocabulary after real lead-language QA;
3. review the additive immutable snapshot schema and public Server Action/API
   boundary;
4. implement same-origin submission by reusing current referral, honeypot,
   normalized-email dedup, source precedence, and idempotency primitives;
5. keep `/quoteavideo` intact until `/start` has real evidence and an explicit
   replacement/migration decision.

Do not begin pricing automation next. The justified next milestone is a safe,
structured Lead intake with human review.
