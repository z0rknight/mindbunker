# RMEDIA Monthly Reality Check v1

**Purpose:** close one calendar month with defensible operating truth, cheaply enough to repeat.  
**Output:** one evidence-backed month state, one short carryover, and at most one human-input item.  
**Non-goal:** this is not a feature backlog, tax return, BI project or invitation to rebuild MindBunker.

## 1. Month period

Declare before querying:

- month and operator timezone;
- local start/end boundaries and their UTC equivalents;
- work-date period versus posting-date versus cash-date;
- allowed carryover window (normally day 1 of the next month only for current state).

Never include boundary-day work merely because it appears in a cross-month weekly report.

## 2. Source snapshot

Capture source and freshness before interpretation:

| Domain | Preferred source | Snapshot evidence |
|---|---|---|
| Intentional time | Work Sessions | count, raw duration, open/closed, exact month boundary |
| Device evidence | Sensor | approval/context state, never promoted automatically |
| External time | platform diary/report | daily or interval time and source file |
| Billing | platform/billing evidence | period, posting date, gross, fee, currency |
| Cash | bank statement | account, date, amount, external ID, closing balance |
| Client identity | contract + CRM | commercial client, payer, alias/work mode |
| Deliveries | actual link/channel/recipient | asset identity and delivery date |
| Review | Frame.io/Slack/email/revision ledger | version/pass evidence, not comment count alone |
| Source authority | Git + deployed metadata | commit, ref, deployment/version |

Record conflicts as source A/source B/canonical choice/remaining uncertainty. Never resolve silently.

## 3. Bank reconciliation

For every modeled pocket:

1. Import or query exact statement movements with stable external identity.
2. Separate inflow, outflow, internal transfer, FX, reversal and zero-net authorization.
3. Reconcile opening + signed movements = closing balance.
4. Require difference zero before calling cash custody green.
5. Keep currency separate.

MindBunker should answer automatically by month close:

- bank receipts/outflows by currency;
- unrepresented or duplicate external identities;
- closing balance difference per pocket;
- unresolved `AMBIGUOUS` amount.

## 4. Platform billing / fees

Build the chain without collapsing dates:

`WORK DATE → GROSS EARNING POST → SERVICE FEE → PRE-WITHDRAWAL NET → WITHDRAWAL FEE → NET PROCEEDS → BANK CASH`

Required views:

- work-date gross value;
- gross transactions posted during the month;
- service fees posted during the month;
- withdrawal/payout fees during the month;
- net before withdrawal and net platform proceeds;
- bank cash received;
- settlement gap and its evidence state.

Rules:

- gross + cash is never two revenues;
- service and withdrawal fees are distinct direct platform costs;
- do not subtract either fee twice from already-net cash;
- exact earning-to-payout mapping requires payout evidence;
- a numerical match is not proof of causal mapping.

## 5. Work Session reconciliation

Compute:

- raw closed Work Session count/time;
- admissible time after explicit fixture/invalid-interval exclusions;
- CLIENT / INTERNAL / ADMIN / LEAD as mutually exclusive contexts;
- excluded rows with ID, duration and reason;
- unknown manual/offsite duration separately.

No exact interval means no correction. Preserve the original row and annotate the uncertainty.

MindBunker observation targets for the next close:

- intentional operating hours by context;
- open/implausible session exceptions;
- retrospective corrections with original/new timestamps;
- explicit lower-bound label when coverage is incomplete.

## 6. External registered time

Track platform diaries as first-class evidence in the close even when they are outside Work Session truth.

For each client/platform period report:

- external registered minutes by work date;
- MindBunker intentional minutes;
- Sensor observed minutes;
- explicitly attributed minutes;
- unallocated minutes;
- exact interval overlap when available;
- otherwise only date-level compatible overlap and excess.

Never spread total time proportionally over videos without evidence. Never automatically add external time to the operating total.

## 7. Client attribution

Resolve separately:

- commercial client;
- payer;
- platform/contract;
- operational alias/work mode;
- project/video allocation.

Client-level confirmation can close revenue ownership without closing exact weekly payout or video allocation. Aliases roll up commercially and must not create a second client count, revenue line or profitability unit.

When one relationship has more than one operating mode, use the strongest existing structured context:

- `DIRECT` for work contracted directly inside the canonical relationship;
- `DFY` when the client sells/includes the operator's capacity in the client's own customer deal;
- `UNCLASSIFIED` when historical evidence is insufficient.

Report time and project/order context by mode where evidence exists, while billing/payment remains rolled to the canonical commercial relationship. Do not infer an end customer or create a reseller/partner model without evidence.

MindBunker should answer automatically:

- reconciled revenue by commercial relationship;
- paid but unattributed cash;
- operational aliases excluded from client counts;
- client-level versus project-level attribution coverage.

## 8. Operating cost

Classify each business-pocket outflow as:

- confirmed operating cost;
- direct project/platform cost;
- overhead;
- owner transfer;
- personal;
- mixed/unknown.

Merchant name alone is insufficient. Preserve exact IDs and exclude mixed/unknown from confirmed cost. Report each currency independently. A settlement difference is not automatically a fee or cost.

For a human-resolved movement, preserve the source bank row and record classification date, actor, human note and prior state on the derived economic record. A personal purchase made directly from a business pocket is an owner/personal draw, not operating cost.

Operating result is `NOT READY` when material outflows remain unknown, revenue semantics are incomplete, a platform fee would be double-counted, or currency treatment is implicit.

## 9. Deliveries

A unique delivery needs an identifiable asset plus delivery evidence such as recipient/channel/date. Keep separate:

- current DONE state;
- immutable finish event;
- actual delivered asset;
- review request;
- accepted/final state.

Do not sum these as interchangeable denominators. If the source set cannot establish unique outputs, report YELLOW and the exact missing denominator.

## 10. Review

Track evidence of review without fabricating revision passes:

- Frame.io comments show review activity;
- comment count is not revision count;
- Slack/email “ready for review” is not accepted/final;
- structured revision rows describe only their own coverage.

The automatic observation target is review coverage by asset/version, not a generic “AI helped” or “zero revisions” claim.

## 11. Source authority

For each deployed surface capture:

- canonical repo and branch/ref;
- local HEAD;
- release/current ref;
- deployed version/deployment ID;
- deployment annotation or other commit link;
- whether exact deployed source is proven.

No deploy is allowed merely to turn source authority green. An unproved commit is YELLOW housekeeping for the next authorized release.

## 12. Human input fallback

Research connected sources first. If material facts remain unresolved, create exactly one item dated on close day:

`[MONTH CLOSE] Human Inputs`

Each question must contain:

- question in plain language;
- why it matters;
- what is already known;
- source evidence;
- checkboxes/short answer;
- what the answer unlocks.

Ask only facts the operator can actually supply. Do not ask the operator to resolve technical model gaps, delivery precision or source authority unless their direct memory is the missing evidence.

## 13. Final month state

Choose one:

- **CLOSED:** core operating/financial truth is reconciled and no material unknown changes the month interpretation.
- **CLOSED WITH EXCEPTIONS:** core financial/operating truth is trustworthy; bounded gaps may remain in a non-financial time denominator, delivery/review precision or source authority.
- **PARTIAL:** material time, revenue or cost uncertainty still prevents business-level closure.

Required final matrix:

| Domain | Required answer |
|---|---|
| Core time | admissible hours + excluded/unknown caveat |
| External client time | minutes/hours by work date |
| Gross work value | by work date and currency |
| Posted gross | by posting date and currency |
| Service fee | by posting date and currency |
| Withdrawal fee | by payout/cash bridge and currency |
| Net platform proceeds | gross minus service and withdrawal fees once |
| Bank cash | actual statement inflow |
| Client attribution | green/yellow/red and level of precision |
| Confirmed operating cost | by currency |
| Unknown/mixed cost | by currency |
| Operating result | ready/not ready + exact blockers |
| Delivery/review | coverage status, no invented denominator |
| Source authority | proven/unproved deployed source |
| Human input | one page URL or not needed |

## 14. Safety gate

Before any reconciliation write:

1. fresh read, migration head, FK and duplicate checks;
2. export/Time Travel bookmark;
3. exact source IDs and guarded SQL;
4. sandbox dry-run and idempotency replay;
5. no client-state, Work Session or immutable-identity rewrite unless directly proved;
6. post-write counts, FK, duplicates and unrelated-next-month check.

No migration, deploy or feature work belongs to a monthly truth close unless the user separately authorizes it.

## 15. Cheap October close checklist

- [ ] Boundaries declared.
- [ ] Source snapshot recorded.
- [ ] Every bank pocket balances.
- [ ] Gross/fee/net/cash shown separately.
- [ ] Withdrawal fees separated from service fees and never double-counted.
- [ ] Work Sessions raw/admissible/context totals computed.
- [ ] External time compared without automatic addition.
- [ ] Client, payer and alias separated.
- [ ] Work mode (`DIRECT` / `DFY` / `UNCLASSIFIED`) reported where evidence supports it.
- [ ] Costs classified; unknown amount explicit.
- [ ] Human classifications retain actor/date/note/prior state and source IDs.
- [ ] Deliveries and review use real denominators or remain YELLOW.
- [ ] Deployed source link checked.
- [ ] At most one human-input card exists.
- [ ] Final state and exact blockers written.
- [ ] October starting state updated.

The goal is not “all fields green”. The goal is that the next operating decision no longer requires reconstructing the month from scratch.
