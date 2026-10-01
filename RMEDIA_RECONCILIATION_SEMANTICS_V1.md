# RMEDIA Reconciliation Semantics v1

**Effective:** 1 October 2026  
**Scope:** Management truth inside MindBunker. This is not tax/accounting policy and creates no automatic feature backlog.

## 1. Principle

MindBunker may only answer a question at the strongest level supported by its evidence. A more complete-looking number is worse than an explicit unknown.

Precedence:

1. canonical domain record with authoritative external identity;
2. authoritative source evidence retained with provenance;
3. deterministic derivation from 1–2;
4. unresolved/unattributed state;
5. no answer.

Never silently promote:

- registered → billed;
- billed/requested → paid;
- paid → attributed/reconciled revenue;
- bank outflow → operating cost;
- Sensor observation → intentional Work Session;
- video DONE/finished event → delivered output;
- zero internal revisions → no review/rework happened.

## 2. Fact labels

| Label | Meaning | Example |
|---|---|---|
| CANONICAL FACT | Current domain record with stable identity and verified meaning | Wise receipt with exact external ID in `transactions` |
| SOURCE-SUPPORTED FACT | External evidence supports it, but the domain cannot fully structure it | Dave USD 243.25 note |
| DERIVED FACT | Reproducible calculation from supported inputs | 112.7725 admissible hours at the final September read |
| UNATTRIBUTED | Fact exists but commercial owner is unproved | A bank receipt before client-level evidence is found |
| UNRESOLVED | Known conflict or incomplete correction | Work Session 83 duration |
| INSUFFICIENT EVIDENCE | No safe answer | September profit |

## 3. Financial layers

### REGISTERED

A billing record exists. It does not prove an invoice/request was sent or cash was received.

Canonical source: `billing_evidence`.

### BILLED / REQUESTED

There is evidence that an amount was requested or communicated to the client. It does not prove payment.

Current September example: Dave USD 243.25, retained in `reconciliation_notes` because `payment_requests` requires a real payment URL and no honest URL exists.

### PAID BANK MOVEMENT

An authoritative bank statement contains an incoming movement with exact account, date, currency, amount and external ID.

Canonical custody sources: `cash_movements` + `cash_account_snapshots`.

### PAID + UNATTRIBUTED

The bank movement is proven, but the client, contract or billing evidence is not.

Canonical economic representation: `transactions.type='income'`, category `Unattributed paid receipt`, exact Wise external ID, null client/contract.

### PAID + RECONCILED REVENUE

The incoming bank movement is linked by evidence to the correct commercial client and contract while preserving payer differences.

September example: BRL 400 Health Meeting 12 → Agência Preview / contract 4; payer Jefferson Bottin Bernardes remains in the note.

September Taryn example: four Wise `Payment Escrow` receipts total USD 644.29 and are attributed to Taryn / contract 1 by explicit operator confirmation that all period Upwork earnings belong to Taryn. This is client-level reconciliation; it does not assert which weekly Upwork earning funded each receipt.

### Platform commercial chain

Keep these questions separate by their own dates and evidence:

`WORK DATE → GROSS EARNING POST DATE → SERVICE FEE POST DATE → NET PLATFORM VALUE → PAYOUT/SETTLEMENT → BANK CASH DATE`

- work-date value is accrual-style evidence of work performed;
- posted gross is platform transaction evidence;
- a service fee and a withdrawal/payout fee are separate direct platform costs stored in `platform_fees`;
- net before withdrawal is gross minus service fee;
- net platform proceeds are gross minus service fee minus withdrawal fee;
- payout/settlement is a transfer of platform proceeds, not a second revenue;
- bank cash is authoritative for cash arrival.

Never add posted gross and the related bank settlement as two revenues. Never subtract service or withdrawal fees again from already-net cash when explaining the cash position. A gap between net platform proceeds and cash remains a settlement reconciliation gap until payout evidence or operator confirmation explains it. September's four operator-confirmed USD 2.99 withdrawal fees close this bridge at USD 644.29.

### Multi-currency

USD and BRL stay separate. Do not compute a cross-currency total or profit without an explicit, dated FX policy. EUR, GBP, CAD and JPY zero-balance statements remain evidence but are not forced into the current USD/BRL domain.

## 4. Cash custody versus economic meaning

`cash_movements` answers: **what moved through this Wise pocket?**

`transactions` answers: **what economic event can the business defend?**

They may share an external ID, but they are not duplicates:

- one is custody;
- one is economic classification.

Cash movement states:

| State | Meaning |
|---|---|
| RECONCILED | Counterparty/purpose is sufficiently identified for custody |
| AMBIGUOUS | Movement is real, but business meaning remains unresolved |
| INTERNAL_TRANSFER | Movement between Emmanuel-controlled pockets; never revenue/cost |
| FX | Currency conversion; never revenue/cost by itself |
| EXTERNAL_TRANSFER | External movement known as a transfer, without claiming expense class |
| IGNORE | Proven non-economic/noise case when the schema can represent it honestly |

Current external identity invariant: one `cash_movements` row per `(cash_account_id, external_source, external_id)`. A charge and reversal using the same Wise ID cannot both be stored. When their net is exactly zero, retain the gap explicitly; do not suffix or fabricate the bank ID.

## 5. Cost classes

### Confirmed operating cost

Requirements:

- exact bank ID;
- business pocket;
- business purpose supported by vendor/subscription/context;
- canonical `expense` transaction;
- currency preserved.

### Direct project cost

Requires a defensible project/client link. Do not infer from proximity in time.

### Overhead

Recurring business cost not tied to one project, supported by vendor/use.

### Owner transfer

Movement from business to owner/personal domain. It is neither operating cost nor revenue. Represent the business row once and link the personal receipt through `owner_pay_transaction_id`.

### Personal

Movement in a personal pocket or externally supported personal use. It must not enter business operating cost.

When the personal purchase came directly from a business pocket, represent its economic meaning as `transactions.type='owner_pay'`, category `Personal`, with the exact bank identity and human-classification note. This keeps cash custody complete without promoting personal consumption to operating cost.

### Human classification

A human answer may resolve an ambiguous bank movement when it supplies exact source identity and business meaning. Preserve the source cash row and description; create or update only the derived economic row; record actor, classification date, human note and prior classification where the schema permits. Human memory does not authorize changing amount, date, currency or external ID.

### Mixed / unknown

Bank movement exists but business/personal/direct/overhead classification is unresolved. Preserve as `AMBIGUOUS`; exclude from confirmed cost and list the exact amount blocking result/profit.

## 6. Time custody

Keep five objects distinct:

1. **Observed Sensor time** — device/session evidence; may be pending or archived.
2. **Intentional Work Session time** — canonical work attached to a Video.
3. **Manual/offsite time** — supported retrospective work; only enter exact intervals with a valid domain attachment.
4. **Retrospective correction** — explicit original/new timestamps and correction event.
5. **Unknown/unresolved time** — known work or interval with no defensible duration.
6. **External registered time** — a client/platform diary with its own custody and date basis; it is commercial-time evidence, not automatically a Work Session.

### Reconciled intentional operating time

For a calendar month:

`admissible closed Work Sessions + supported exact manual/offsite intervals - invalid/synthetic/unresolved intervals`

Rules:

- local month boundary is America/Sao_Paulo;
- open sessions do not enter closed totals;
- an implausible interval is excluded until exact correction evidence exists;
- synthetic/test fixtures are excluded by a proven marker, not by name similarity alone;
- missing work stays unknown; no agenda-based or Sensor-based minute fabrication;
- aliases may roll up to the proven commercial relationship without rewriting historical sessions.
- external registered minutes may be compared with Work Sessions by date, but exact overlap requires interval evidence;
- never add external registered time to the monthly Work Session total merely because both exist;
- daily-total compatibility is labeled a ceiling/lower-bound comparison, never exact timestamp overlap.

September context mapping:

- external active client → CLIENT;
- RMEDIA + `activity_type=ADMIN` → ADMIN;
- other RMEDIA → INTERNAL;
- lead-status record → LEAD;
- Taryn DFY → Taryn commercial relationship;
- `source=RELEASE_TEST` → excluded synthetic fixture.

## 7. Client, payer and operational alias

Three identities may differ:

- **commercial client** — contractual relationship;
- **payer** — name on the bank movement;
- **operational label/alias** — convenience container used during production.

Do not merge them silently.

Taryn DFY means **DONE FOR YOU**: Taryn sells Emmanuel's service capacity inside her own deal with her customer. It is a distinct work mode, not a separate commercial client. Its row and evidence remain operational, its admissible time rolls up commercially to Taryn, and its current `ACTIVE_SURFACE`/`GELADEIRA` state remains an operator-controlled workflow decision. Reconciliation must not overwrite a later user reactivation.

The no-migration v1 mapping is structured in source: client 2 → canonical 2 / `DIRECT`; client 12 → canonical 2 / `DFY`. The existing `client_id` on project/video/session context keeps DIRECT and DFY separable, while CRM/War Room reporting deduplicates on canonical client 2. Revenue and contract truth remain on client 2. Unknown historical mode stays unclassified; no broad backfill is allowed.

The alias's earlier trip to Geladeira was caused by a reconciliation script mutating client lifecycle. That class of write is prohibited: reconciliation may map identities for reads, but may not archive/reactivate the operational alias. Operator lifecycle actions remain authoritative.

Health Meeting 12 preserves:

- commercial client: Agência Preview;
- payer: Jefferson Bottin Bernardes;
- lead record: Jefferson B Bernardes;
- project/event context: Health Meeting.

## 8. Delivery and review

These are separate facts:

- video lifecycle state `DONE`;
- immutable `video.finished` event;
- delivery asset/channel/date;
- review request/comment/version;
- structured revision/rework.

No one signal substitutes for another. A delivery count requires a delivery ledger or source-by-source reconciliation. Revision count zero means **coverage zero**, not “no revisions”.

## 9. Coverage status

Coverage is per domain, never one global percentage.

- **GREEN:** core question is answerable from MindBunker without external archaeology and unresolved residue is immaterial to that question.
- **YELLOW:** a defensible partial answer exists, with exact known gaps.
- **RED:** the domain cannot answer the business question from its internal evidence.

Required domains:

- Finance
- Time
- Client attribution
- Delivery
- Review
- Source authority

## 10. Operating result and profit

Management operating result may be shown per currency only when:

- paid reconciled revenue coverage is sufficient;
- confirmed operating cost coverage is sufficient;
- unknown/mixed outflows are either classified or explicitly immaterial under an approved threshold;
- owner transfers and personal spending are excluded;
- no currency conversion is implied.

If any requirement fails, output `NOT READY` and list exact blockers. A missing time denominator does not block a cash/management result unless that result divides by time. “Profit” is not an allowed label for September 2026.

For a platform settlement already net of service and withdrawal fees, choose one equivalent basis and label it:

- posted-gross bridge: gross − service fees − withdrawal fees − other operating cost; or
- bank-cash basis: net cash received − other operating cost.

Never subtract platform fees from net bank cash a second time.

## 11. Read model

The read-only projection is `scripts/september-2026-reconciliation-read-model.sql`.

It answers:

- raw versus admissible Work Session time, with explicit exclusions;
- Sensor coverage by context/review state without promoting Sensor to work truth;
- Taryn work-date gross value / posted gross / service fee / withdrawal fee / pre-withdrawal net / net proceeds / Wise cash / settlement gap as separate layers;
- billed-requested / paid-unattributed / paid-reconciled by currency;
- external Upwork registered time versus MindBunker Taryn time, with only date-level compatible overlap;
- admissible Work Session time by canonical relationship, DIRECT/DFY work mode and activity;
- projects/orders/videos by canonical relationship and work mode where evidence exists;
- confirmed operating cost, service fee, withdrawal fee, personal exclusion and mixed/unknown outflow;
- management operating result by currency with basis explicit;
- separate YELLOW delivery/review signals for DONE, finish events, revisions and delivery assets.

It deliberately does not create a dashboard, view, migration, tax model, profit recommendation or automatic client scoring.

## 12. Write guardrails

Any historical reconciliation write must be:

- preceded by fresh production read, migration head, FK check, counts and Time Travel/backup;
- tested against a current sandbox/export;
- guarded by exact IDs and source facts;
- idempotent under replay;
- append-only where the domain supports evidence notes/events;
- non-destructive unless exact proof and explicit scope justify deletion;
- followed by FK, duplicate, balance and semantic-layer verification.

If the current domain cannot represent a fact without inventing meaning, stop at an explicit note/read-model exclusion. Do not create a migration merely to make the report look complete.
