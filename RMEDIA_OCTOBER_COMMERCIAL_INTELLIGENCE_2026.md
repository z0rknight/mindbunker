# RMEDIA — October Commercial Intelligence Train

**Date:** 3 October 2026  
**Scope:** Expected Commercial Value → Lead Intelligence → Feedback gate  
**Operating constraint:** solo operator, low volume, no new schema, no automatic commercial action

## Executive decision

October now has one bounded commercial-intelligence train instead of three new subsystems:

1. direct hourly work can produce a Level 1 expected-value estimate after the strongest supported payment-request cutoff;
2. externally metered work, especially Taryn/Upwork, cannot be multiplied again from MindBunker time;
3. `/start` raw answers produce a compact internal Lead Intent projection without asking the lead to classify themselves;
4. delivery feedback stops at a V1 contract because the canonical review/delivery evidence is not yet sufficient to justify a production form.

September remains a frozen regression fixture. The expected monthly result remains **USD 611.54 / BRL -523.48**.

## Evidence classification

### CANONICAL FACT

- Production D1 migration head is `0053_slow_shen.sql`; `PRAGMA foreign_key_check` is empty.
- Dave is client 4 with one active Direct HOURLY contract at USD 25/h.
- Dave's payment requests are USD 372.66 CANCELLED, USD 400.00 CANCELLED and USD 468.33 OPEN.
- Dave's current Wise URL and USD 468.33 amount are stored in `payment_requests`; the open request is not proof of payment.
- Taryn is client 2 with one active Upwork HOURLY contract at USD 25/h. Client 12 is the operational DFY alias and not another commercial relationship.
- Taryn has Upwork billing evidence through the week ending 2026-10-04. The Sep 28–Oct 4 evidence is USD 341.67 gross and includes 180 October minutes.
- Production contains 28 `video.finished` CRM events, zero rows in `revisions`, and zero rows in `deliveries` for the Jul–Oct evidence window queried on 3 October.

### DERIVED FACT

- Dave's USD 468.33 open position is **USD 468.33 requested + USD 0 paid after the current request + USD 0 expected after its cutoff** at the production snapshot used for this train.
- The USD 68.33 inside Dave's current request is supported by 164 whole minutes after the prior USD 400 request and before the replacement request. It is historical request verification, not new expected value.
- Taryn's MindBunker DIRECT/DFY time cannot produce a second monetary estimate while Upwork is the commercial evidence authority.

### INFERENCE

- The existing `/start` questions already contain enough signal to infer relationship shape, content shape, primary need, supported priority, format maturity and likely starting path without adding another card.

### INSUFFICIENT EVIDENCE

- A canonical client-feedback taxonomy, recurring survey cadence or automatic Production Memory promotion.
- Thumbnail need as a reliable derived field; no current answer supplies that evidence.
- Cost-control or quality as an explicit Lead priority; the current answers support speed, consistency and flexibility only.

## Phase A — Expected Commercial Value

### Semantic contract

The operator block keeps these truths separate:

- **registered time:** operational evidence;
- **expected new value:** Level 1 estimate only;
- **requested:** an operator-issued payment request;
- **paid:** candidate receipts after the request, still subject to reconciliation;
- **reconciled revenue:** finance truth outside this read model.

### Authority rules

| Relationship | Value authority | Level 1 behavior |
| --- | --- | --- |
| Direct + HOURLY | completed tracked minutes after the latest effective request | estimate minutes × active rate |
| Upwork + HOURLY | external platform billing evidence | no time-derived monetary estimate |
| FIXED | fixed scope | hours never increase amount owed |
| MIXED | separated components | no combined estimate |
| UNCLEAR | human review | no estimate |

The compact CRM COMMERCIAL block shows model/platform, rate evidence, last request, unpaid requested, candidate paid amount, Level 1 expected value, value already supported inside the current request, current position and evidence cutoff. Its drill-down explains the derivation and the Level 2 boundary.

### Cutoff and double-counting rule

- With an OPEN request, its creation timestamp is the expected-value cutoff.
- The immediately prior request may verify the increment already included in the current request.
- Without an OPEN request, the latest non-cancelled request is the cutoff.
- Pre-cutoff sessions never enter expected new value.
- Incomplete sessions never enter expected new value.
- Whole tracked minutes are rounded down before multiplying by the hourly rate.

### Level 2 preparation hook

The read model exposes `CAN_PREPARE`, `NOTHING_NEW` or `UNSUPPORTED`. It creates nothing. The current `payment_requests` entity is immediately client-visible and has no draft status, so a persisted draft would require new semantics/schema. This train therefore does not create, send or expose a payment request automatically.

## Phase B — `/start` Demand Intelligence

### Question audit

| Current screen | Decision | Reason |
| --- | --- | --- |
| What are you trying to make? | KEEP | establishes bounded/recurring shape and volume |
| What kind of videos? | KEEP | supports content shape |
| Existing video style? | KEEP | supports format maturity and pilot need |
| What is ready? | KEEP | supports production readiness and dependencies |
| How defined is the work? | KEEP | supports exploratory vs defined collaboration |
| Anything special? | KEEP CONDITIONAL | supports technical/specialized demand without forcing the screen on simple work |
| Who approves? | KEEP | supports coordination load |
| Timing | KEEP | supports speed/cadence feasibility |
| Relationship/content/need/priority/maturity/path labels | DERIVE INSTEAD | already supported by the answers above |
| Thumbnail need | MISSING, NOT ADDED | not derivable, but not required to choose the next commercial path; ask during human scope review when relevant |
| Explicit cost vs quality preference | MISSING, NOT ADDED | current evidence does not support it and it would add cognitive load before a human commercial review |

Result: **zero new public questions**, no Card UX change and no lead-facing persona label.

### Lead Intent read model

New immutable submissions keep schema version 1 and use model `rmedia-guided-intake-v1`. The server recomputes and persists:

- relationship shape;
- content shape;
- primary need;
- supported priority;
- format maturity;
- likely path;
- short evidence explanations.

Historical `rmedia-guided-intake-v0` events remain readable. Their Lead Intent projection is recomputed from immutable raw answers at read time; no event is rewritten.

The CRM Lead dossier and System Inbound show the projection. It does not set price, accept work, convert the Lead, create a Client, Project, Video, Order or financial row.

## Phase C — Feedback gate

**Decision: NOT ENOUGH EVIDENCE. No feedback form was built.**

The evidence conflict is explicit: 28 `video.finished` CRM events exist, while the canonical `revisions` and `deliveries` tables both have zero rows in the inspected window. Building a taxonomy now would turn an evidence gap into a product rule.

### V1 contract only

Candidate future event: `delivery_feedback.submitted`.

Maximum three client questions:

1. **What felt strongest or most useful in this delivery?** Optional short text.
2. **Did anything need correction?** `NO` / `CLARITY` / `PACING` / `VISUAL_POLISH` / `ACCURACY` / `OTHER`, plus optional note.
3. **What should stay the same or change next time?** Optional short text.

Candidate payload boundary:

```json
{
  "schemaVersion": 1,
  "deliveryId": 0,
  "videoId": 0,
  "answers": {
    "strongest": null,
    "correctionTheme": "NO",
    "correctionNote": null,
    "nextCycle": null
  },
  "candidateThemes": [],
  "submissionContext": { "channel": "client_delivery" }
}
```

Any `candidateThemes` remain non-canonical. Promotion path is: **candidate → operator review → explicit approval → existing Production Memory**, only if repeated real cycles later justify it. No automatic memory write, score, analytics dashboard or taxonomy is authorized by this contract.

## Verification targets

- hourly expected value;
- fixed-price guard;
- mixed/unknown fail closed;
- strongest cutoff;
- no double counting;
- requested / paid / expected separation;
- Dave production fixture;
- Taryn Upwork non-double-count;
- recurring-capacity, defined-project and exploratory-specialized Lead fixtures;
- server recomputation and legacy-v0 readability;
- September USD 611.54 / BRL -523.48 fixture.

## Release boundary

- Schema migration: **NONE**; head remains `0053`.
- Client Portal speculative value: **NOT EXPOSED**.
- Public Card UX/questions: **UNCHANGED**.
- Feedback form: **NOT BUILT**.
- Sensor native app: **UNTOUCHED**.
- Deployment and final production proof: recorded at closure below.

## Closure proof

### Quality gate

- Focused commercial/intake suite: **32/32**.
- Full suite: **1508/1508**.
- TypeScript and production build: **GREEN**.
- ESLint: **0 errors**; 3 pre-existing warnings.
- September regression fixture: **USD 611.54 / BRL -523.48**.

### Production release

- Product source: `235c9a372f6b39ae8c7d0df0d26cb41f38a4afe2` (`feat: add commercial and lead intelligence`).
- Operator Worker: `26ba5530-84d8-4d7c-ab1c-17f5c40ad35a`.
- `origin/production/current`: `235c9a372f6b39ae8c7d0df0d26cb41f38a4afe2`.
- Schema: no migration added; production head remains `0053_slow_shen.sql` and `PRAGMA foreign_key_check` is empty.
- Public, Client and Sensor were not deployed or changed for this release.

### Live visual acceptance

- Dave CRM showed HOURLY / Direct / USD 25/h, USD 468.33 OPEN, USD 468.33 unpaid requested, USD 0 paid after the current request, USD 0 / 0m expected new value and USD 68.33 / 2h44m supported inside the current request.
- Taryn CRM showed Upwork as the external value authority, expected value unknown rather than multiplied from Direct/DFY time, and billing evidence through 4 October 2026.
- Historical v0 Guided Intake remained readable with its server-derived Lead Intent projection.

### Production E2E and cleanup

- `/start?ref=pdbm` created synthetic Lead 13 and immutable events 303/304; the replay returned `deduped: true` and created no duplicate.
- The stored event had `schemaVersion: 1`, `modelVersion: rmedia-guided-intake-v1`, server path `REPEATABLE_PRODUCTION`, referral source `referral:pdbm`, and Lead Intent `RECURRING / SHORT_FORM / CAPACITY / CONSISTENCY / DEFINED`.
- CRM dossier and System Inbound both rendered the new projection in production.
- Seventeen downstream relation families were zero before cleanup.
- The exact guarded cleanup deleted one synthetic Lead and its two events. Exact selectors returned zero afterward; production returned from 10 Leads / 295 events to the pre-E2E baseline of **9 Leads / 293 CRM events**.

### Feedback and operating record

- Feedback remained a contract only: zero revision rows, zero delivery rows and 28 `video.finished` events were insufficient evidence for productization.
- One closure section was appended and re-fetched successfully in Notion `[OCTOBER OVERVIEW]` (`3ed62314-2ad5-8095-b91c-eef13674d9d3`).
