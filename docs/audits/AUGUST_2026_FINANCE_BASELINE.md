# August 2026 Canonical Finance Baseline

Prepared on 2026-08-30 (America/Sao_Paulo). This is an operational reconciliation, not legal, tax, or accrual-accounting advice.

## August status

**YELLOW — the six supplied Wise pockets reconcile to zero difference for the statement window, but the close is provisional and material attribution remains unresolved.**

- The supplied Wise files cover **2026-08-02 through 2026-08-30**. The first transaction is on August 3 in most main pockets. August 1 is outside the export and August 31 has not happened at the time of this report.
- This report therefore proves the cash chain only through the latest supplied statement row. It must not be called a final calendar-month close until an August 31 / final August export confirms no additional movement.
- All **153 pocket movement rows** have a closure state: `RECONCILED`, `AMBIGUOUS`, `EXTERNAL_TRANSFER`, `INTERNAL_TRANSFER`, `FX`, or `IGNORE`. No row is silently dropped. There are no `IGNORE` rows in the supplied files.
- The six pocket equations close exactly. Remaining uncertainty concerns economic ownership, client attribution, Upwork gross/fees/earning period, and several transfers/merchant charges—not bank arithmetic.
- Production was queried read-only. Wrangler reported the canonical Cloudflare account `a2511426086f83bc2d6031478dbf2e69`, no pending D1 migration, and every query reported `changed_db: false` / zero rows written.

### Evidence boundary and authority

1. Six Wise CSV statements are the authority for cash movement and running balances.
2. No August-period Upwork transaction/earnings CSV was found. `lifetime_billings.csv` is lifetime-by-client only and cannot prove August worked, billed, fee, or payout composition.
3. Production MindBunker is the authority for the existing commercial labels and canonical Finance records.
4. Directory names such as `-maybe company` are not treated as proof by themselves. Pocket ownership is corroborated by the business merchants, Dave receipt, inter-pocket pairs, and production cash snapshots (`BUSINESS BRL 103.58` and `59.96`; `PERSONAL USD 0.00`).

## Opening balances

Opening means the balance immediately before the oldest movement in each supplied statement, calculated as `oldest running balance - oldest amount`. It is a balance fact and is excluded from income and expense.

| Scope | Pocket | Wise account | Opening | Opening evidence | Latest supplied closing |
|---|---|---:|---:|---|---:|
| Business | USD main | `118287732` | USD 0.00 | Before first row, 2026-08-06 | USD 68.85 on 2026-08-29 |
| Business | USD reserve | `171067558` | USD 0.00 | Before first/only row, 2026-08-26 | USD 100.00 on 2026-08-26 |
| Business | BRL main | `168497359` | BRL 0.00 | Before first row, 2026-08-03 | BRL 59.96 on 2026-08-29 |
| Personal | USD main | `45837980` | USD 0.25 | Before first row, 2026-08-03 | USD 0.00 on 2026-08-26 |
| Personal | BRL main | `44840079` | BRL 3.88 | Before first row, 2026-08-03 | BRL 37.72 on 2026-08-29 |
| Personal | BRL reserve | `171018409` | BRL 0.00 | Before first/only row, 2026-08-26 | BRL 33.16 on 2026-08-26 |

These are truthful openings for the **available window**, not evidence that no August 1 movement existed.

## Income

### Upwork cash received

Wise identifies four external deposits from `Payment Escrow I` with reference `EDI PYMNTS` into the Personal USD main pocket:

| Date | TransferWise ID | Cash received | Canonical attribution |
|---|---|---:|---|
| 2026-08-03 | `TRANSFER-2288098808` | USD 300.00 | Client/contract/earning period unknown |
| 2026-08-10 | `TRANSFER-2302130238` | USD 120.00 | Client/contract/earning period unknown |
| 2026-08-17 | `TRANSFER-2315340752` | USD 170.00 | Client/contract/earning period unknown |
| 2026-08-24 | `TRANSFER-2328142012` | USD 343.75 | MindBunker transaction `2`: Taryn Dubreuil, Freelance |
| **Total** |  | **USD 933.75** | **Cash received, not proven August earnings** |

MindBunker currently has one active Taryn Upwork hourly contract at USD 25/hour, but **no August billing-evidence rows**. The Wise deposits prove cash receipt only. They do not prove when work was performed, gross billed, Upwork fee, net payout composition, or that all four deposits belong to Taryn.

Canonical Finance represents USD 343.75 of the USD 933.75 cash receipts. The **USD 590.00 difference** is not silently converted into August P&L; it remains external Upwork cash with unresolved commercial attribution.

### Fixed-price / direct

| Date | TransferWise ID | Amount | Evidence |
|---|---|---:|---|
| 2026-08-27 | `TRANSFER-2335182410` | USD 100.00 | Dave DeMink payment reference `475648`; MindBunker transaction `6`; approved quote `1` for Landing Page Video, USD 100 |

The bank receipt, quote, and Finance income agree. The Finance row has no quote-specific foreign key, so it is client-linked/corroborated rather than technically quote-linked.

### Other inflows

- Self-named deposits and transfers are not income by default.
- The BRL 250.00 business-pocket top-up on August 3 is `AMBIGUOUS`, not income, until its funding source is confirmed.
- No other external business income is proven by the supplied statements.

## Expenses

### Business — observed and reconciled

| Date | Pocket | Merchant / fact | Amount | Canonical status |
|---|---|---|---:|---|
| 2026-08-03 | BRL main | Wise bank-details acquisition | BRL 250.00 | Observed; absent from Finance ledger |
| 2026-08-06 | BRL main | Google Workspace | BRL 80.61 | Observed; absent from Finance ledger |
| 2026-08-06 | USD main | Notion | USD 12.00 | Observed; absent from Finance ledger |
| 2026-08-10 | USD main | Slack | USD 5.25 | Observed; absent from Finance ledger |
| 2026-08-19 | USD main | Proton | USD 1.00 | Observed; absent from Finance ledger |
| 2026-08-25 | USD main | Mister Horse / Animation Composer | USD 19.90 | MindBunker transaction `4`, linked to subscription `2` |
| **Known total** |  |  | **BRL 330.61 + USD 38.15** | Currencies remain separate |

Business BRL also contains BRL 136.93 of food charges and a BRL 60.00 transfer to Wellington. Their cash movement is certain; business-vs-personal economic ownership is not. They remain `AMBIGUOUS` / `EXTERNAL_TRANSFER` rather than forced business expense.

### Personal — observed

The Personal BRL main pocket has 32 reconciled card rows totaling **BRL 1,941.88** and two ambiguous digital-service rows totaling **BRL 206.80**:

| Merchant group | Rows | Amount | Treatment |
|---|---:|---:|---|
| Box138 | 17 | BRL 951.45 | Personal observed expense |
| Merc Irmaos Constante | 4 | BRL 562.57 | Personal observed expense |
| Tecban / Sup Unisuper | 1 | BRL 150.00 | Personal observed expense |
| Multicoisas | 5 | BRL 67.00 | Personal observed expense |
| Restaurants / food card rows excluding Box138 | 3 | BRL 114.06 | Personal observed expense |
| Porto Alegre merchant label | 1 | BRL 71.80 | Personal observed expense; category not inferred |
| Darlan merchant label | 1 | BRL 25.00 | Personal observed expense; category not inferred |
| Apple.com/bill | 1 | BRL 129.90 | `AMBIGUOUS`: personal account, possible business use |
| Microsoft | 1 | BRL 76.90 | `AMBIGUOUS`: personal account, possible business use |

External transfers from Personal BRL total **BRL 1,822.86 out** and **BRL 173.00 in** after removing matched transfers between the six pockets. They are real cash movements but are not automatically personal expense/income; see the movement-state register and unresolved questions.

The existing personal Finance ledger only covers August 24–28 facts: the Owner Pay receipts and BRL expenses `CIGARRO DE ARTISTA` 120.00, `MERCADO` 203.78, iFood 38.99, and iFood 12.90. It is not a complete representation of the Wise statement.

## Owner Pay

Canonical Owner Pay is **USD 215.00**:

| Date | Business transaction | Personal receipt | Amount | Wise interpretation |
|---|---:|---:|---:|---|
| 2026-08-24 | `3` | `1` | USD 140.00 | Economic bridge: USD 343.75 Upwork receipt landed in Personal USD; USD 243.75 moved to Business USD; USD 40.00 moved back, leaving USD 140.00 personal before later FX. No single USD 140 bank leg exists. |
| 2026-08-27 | `5` | `6` | USD 30.00 | Business USD → Personal BRL 153.58, including observed FX |
| 2026-08-28 | `7` | `7` | USD 45.00 | Business USD → Personal BRL 232.02, including observed FX |

Other self-named transfers are **not** promoted to Owner Pay without operator evidence. This prevents ordinary pocket transfers and transitional crossover from becoming fake compensation.

## FX

Wise proves 22 ordinary USD→BRL conversion operations across the two USD main pockets:

| Scope | Operations | USD debited | BRL credited | Weighted observed BRL/USD | Wise fees shown |
|---|---:|---:|---:|---:|---:|
| Personal | 14 | USD 628.86 | BRL 3,195.97 | 5.08216 | USD 5.44 |
| Business | 8 | USD 121.75 | BRL 621.47 | 5.10448 | USD 1.04 |

The fee is already part of the Wise conversion economics; it is not added again to pocket outflow.

Three cross-account transfers also embed FX:

- 2026-08-12: Personal USD 1.39 → BRL 5.04 to a self-named account not identifiable among the six supplied pockets; fee USD 0.42. State: `EXTERNAL_TRANSFER`.
- 2026-08-27: Business USD 30.00 → Personal BRL 153.58; fee USD 0.25. State: `INTERNAL_TRANSFER`; economic purpose: canonical Owner Pay.
- 2026-08-28: Business USD 45.00 → Personal BRL 232.02; fee USD 0.39. State: `INTERNAL_TRANSFER`; economic purpose: canonical Owner Pay.

### MindBunker FX comparison

| Canonical FX row | Recorded | Wise evidence | Result |
|---:|---|---|---|
| `1` | Personal, USD 100.00 → BRL 510.21, dated 2026-08-25 | Exact amounts on 2026-08-24 | Amount reconciled; date differs by one day |
| `2` | Business, USD 20.00 → BRL 120.00, dated 2026-08-25 | USD 20.00 → BRL 102.02 on 2026-08-25 | **Amount mismatch** |
| `3` | Personal, USD 153.58 → BRL 25.00, dated 2026-08-27 | Business USD 30.00 → Personal BRL 153.58 | **Fields/amounts do not describe the Wise movement** |
| `4` | Personal, USD 45.00 → BRL 232.00, dated 2026-08-28 | USD 45.00 → BRL 232.02 | Reconciled with BRL 0.02 rounding difference |
| `5` | Business, USD 20.00 → BRL 102.96, dated 2026-08-29 | Exact | Reconciled |

MindBunker does not yet represent the remaining Wise conversions. This report records the discrepancy; it does not mutate production.

## Internal transfers

Internal transfers are balance movements, not income or expense.

Confirmed six-pocket relationships include:

- Personal USD main → Business USD main: USD 30.00, 50.00, 20.00, and 243.75.
- Business USD main → Personal USD main: USD 40.00.
- Business USD main → Business USD reserve: USD 100.00.
- Personal BRL main ↔ Business BRL main: matched BRL legs totaling BRL 102.03 into Business and BRL 386.00 out of Business.
- Personal BRL main → Personal BRL reserve: BRL 33.16.
- Business USD main → Personal BRL main: USD 30.00→BRL 153.58 and USD 45.00→BRL 232.02.

The August 3 Personal BRL transfer of BRL 250.00 and Business BRL top-up of BRL 250.00 occur about 52 minutes apart. They are plausible counterparts but not mechanically linked by Wise evidence, so the top-up remains `AMBIGUOUS` and the outgoing leg remains `EXTERNAL_TRANSFER`.

## Subscriptions observed

`CHARGE OBSERVED` and `CATALOG ENTRY` are separate facts.

| Service | August bank charge | Catalog state | Conclusion |
|---|---:|---|---|
| Animation Composer / Mister Horse | USD 19.90 | Active monthly, USD 19.90 | Charge and catalog agree; Finance transaction linked |
| Adobe Creative Cloud | None in supplied statements | Active monthly, BRL 250.00; next renewal 2026-09-10 | Catalog only; no August expense inferred |
| Google Workspace | BRL 80.61 | No subscription row | Observed charge only |
| Notion | USD 12.00 | No subscription row | Observed charge only |
| Slack | USD 5.25 | No subscription row | Observed charge only |
| Proton | USD 1.00 | No subscription row | Observed charge only |
| iFood | BRL 12.90 transfer | No subscription row; personal ledger note says `Assinatura` | Observed movement; recurrence/cadence not invented |
| Apple.com/bill | BRL 129.90 | No subscription row | Observed charge; business/personal ownership unresolved |
| Microsoft | BRL 76.90 | No subscription row | Observed charge; business/personal ownership unresolved |

## Unresolved items

These are the five movement rows whose closure state is `AMBIGUOUS`:

| Date | Amount | Account | TransferWise ID | Counterparty / fact | Operator question |
|---|---:|---|---|---|---|
| 2026-08-03 | BRL +250.00 | Business BRL main | `TRANSFER-2288613753` | Topped up account | Was this funded by the Personal BRL −250 transfer 52 minutes earlier, and should both be reclassified as one internal transfer? |
| 2026-08-11 | BRL −90.35 | Business BRL main | `CARD-4181763148` | Shaiki Sushi Delivery | Business production meal or personal spending from business cash? |
| 2026-08-20 | BRL −129.90 | Personal BRL main | `CARD-4220992530` | Apple.com/bill | Personal service or business software paid personally? |
| 2026-08-29 | BRL −76.90 | Personal BRL main | `CARD-4256897536` | Microsoft | Personal service or business software paid personally? |
| 2026-08-29 | BRL −46.58 | Business BRL main | `CARD-4259737412` | The West Burger | Business production meal or personal spending from business cash? |

Material unresolved external-transfer questions:

- Personal BRL has BRL 685.00 of unmatched self-named outflows and BRL 173.00 of unmatched self-named inflows. These may be transfers to/from an owner account outside the six Wise pockets; they are not income/expense until confirmed.
- Transfers to Wellington (Personal BRL 602.00; Business BRL 60.00), Matheus (BRL 305.96), Gabriely (BRL 111.00), Talia (BRL 66.00), and Darlan (BRL 40.00) are external cash outflows. Their purpose/category is not inferred.
- The Personal USD 1.39 cross-currency transfer terminates outside the six supplied pockets.
- Three Upwork payouts totaling USD 590.00 lack August client/contract/fee evidence.
- August 31 and a final month export are unavailable as of report preparation.

## Upwork ↔ Wise reconciliation

| Layer | August evidence | Amount/status |
|---|---|---|
| Worked | No August Upwork report | Unknown |
| Billed | No August Upwork report or billing evidence | Unknown |
| Upwork fee | No August Upwork report | Unknown |
| Payout | Four Wise `Payment Escrow I` deposits | USD 933.75 cash received |
| Cash received | Wise running balance confirms all four | Reconciled |
| Commercial attribution | One MindBunker income row for Taryn | USD 343.75 attributed; USD 590.00 unresolved |

`lifetime_billings.csv` says Taryn lifetime billed is USD 17,491.66, but it has no dates and is therefore excluded from August worked/billed reconciliation.

## Closing balance reconciliation

Positive/negative state totals below are pocket movements. A conversion appears once as a debit in its USD pocket and once as a credit in its BRL pocket; it is not double-counted as P&L.

| Pocket | Equation in pocket currency | Expected | Wise closing | Difference |
|---|---|---:|---:|---:|
| Business USD main | 0.00 + 100.00 reconciled inflow + 343.75 internal in − 38.15 expense − 121.75 FX − 215.00 internal out | USD 68.85 | USD 68.85 | **0.00** |
| Business USD reserve | 0.00 + 100.00 internal in | USD 100.00 | USD 100.00 | **0.00** |
| Business BRL main | 0.00 + 621.47 FX + 102.03 internal in + 250.00 ambiguous in − 330.61 expense − 136.93 ambiguous out − 60.00 external out − 386.00 internal out | BRL 59.96 | BRL 59.96 | **0.00** |
| Personal USD main | 0.25 + 933.75 external cash + 40.00 internal in − 628.86 FX − 343.75 internal out − 1.39 external out | USD 0.00 | USD 0.00 | **0.00** |
| Personal BRL main | 3.88 + 3,195.97 FX + 771.60 internal in + 173.00 external in − 1,941.88 expense − 206.80 ambiguous out − 135.19 internal out − 1,822.86 external out | BRL 37.72 | BRL 37.72 | **0.00** |
| Personal BRL reserve | 0.00 + 33.16 internal in | BRL 33.16 | BRL 33.16 | **0.00** |

## Movement-state register

This register assigns every CSV row to exactly one closure state. Shared Wise IDs appear in both pockets for the two balance legs of the same FX/internal operation.

| Pocket | State | Rows | Positive | Negative |
|---|---|---:|---:|---:|
| Business BRL main | AMBIGUOUS | 3 | BRL 250.00 | BRL 136.93 |
| Business BRL main | EXTERNAL_TRANSFER | 1 | — | BRL 60.00 |
| Business BRL main | FX | 8 | BRL 621.47 | — |
| Business BRL main | INTERNAL_TRANSFER | 9 | BRL 102.03 | BRL 386.00 |
| Business BRL main | RECONCILED | 2 | — | BRL 330.61 |
| Business USD main | FX | 8 | — | USD 121.75 |
| Business USD main | INTERNAL_TRANSFER | 8 | USD 343.75 | USD 215.00 |
| Business USD main | RECONCILED | 5 | USD 100.00 | USD 38.15 |
| Business USD reserve | INTERNAL_TRANSFER | 1 | USD 100.00 | — |
| Personal BRL main | AMBIGUOUS | 2 | — | BRL 206.80 |
| Personal BRL main | EXTERNAL_TRANSFER | 23 | BRL 173.00 | BRL 1,822.86 |
| Personal BRL main | FX | 14 | BRL 3,195.97 | — |
| Personal BRL main | INTERNAL_TRANSFER | 12 | BRL 771.60 | BRL 135.19 |
| Personal BRL main | RECONCILED | 32 | — | BRL 1,941.88 |
| Personal BRL reserve | INTERNAL_TRANSFER | 1 | BRL 33.16 | — |
| Personal USD main | EXTERNAL_TRANSFER | 1 | — | USD 1.39 |
| Personal USD main | FX | 14 | — | USD 628.86 |
| Personal USD main | INTERNAL_TRANSFER | 5 | USD 40.00 | USD 343.75 |
| Personal USD main | RECONCILED | 4 | USD 933.75 | — |

### Row IDs by pocket and state

This compact ledger is the row-level proof that all 153 rows have a state.

**Business USD main `118287732`**

- `FX`: `BALANCE-5822993980`, `BALANCE-5853766064`, `BALANCE-5857066962`, `BALANCE-5863458885`, `BALANCE-5901825388`, `BALANCE-5908862212`, `BALANCE-5942390276`, `BALANCE-5967532552`
- `INTERNAL_TRANSFER`: `TRANSFER-2294843160`, `TRANSFER-2302156564`, `TRANSFER-2318829131`, `TRANSFER-2328444134`, `TRANSFER-2328446414`, `BALANCE-5947752228`, `TRANSFER-2335040967`, `TRANSFER-2337399899`
- `RECONCILED`: `CARD-4157487310`, `CARD-4176371528`, `CARD-4213634062`, `CARD-4239902941`, `TRANSFER-2335182410`

**Business USD reserve `171067558`**

- `INTERNAL_TRANSFER`: `BALANCE-5947752228`

**Business BRL main `168497359`**

- `AMBIGUOUS`: `TRANSFER-2288613753`, `CARD-4181763148`, `CARD-4259737412`
- `EXTERNAL_TRANSFER`: `TRANSFER-2307269126`
- `FX`: `BALANCE-5822993980`, `BALANCE-5853766064`, `BALANCE-5857066962`, `BALANCE-5863458885`, `BALANCE-5901825388`, `BALANCE-5908862212`, `BALANCE-5942390276`, `BALANCE-5967532552`
- `INTERNAL_TRANSFER`: `TRANSFER-2304279736`, `TRANSFER-2307267684`, `TRANSFER-2312722624`, `TRANSFER-2318836820`, `TRANSFER-2318950302`, `TRANSFER-2321022395`, `TRANSFER-2321024954`, `TRANSFER-2321086263`, `TRANSFER-2332896624`
- `RECONCILED`: `BANK_DETAILS_ORDER_CHECKOUT-invoice-16947135`, `CARD-4157512742`

**Personal USD main `45837980`**

- `EXTERNAL_TRANSFER`: `TRANSFER-2307257547`
- `FX`: `BALANCE-5799727114`, `BALANCE-5800768244`, `BALANCE-5801532904`, `BALANCE-5809565364`, `BALANCE-5824156793`, `BALANCE-5831179949`, `BALANCE-5847341318`, `BALANCE-5848776047`, `BALANCE-5891771870`, `BALANCE-5902287793`, `BALANCE-5905321094`, `BALANCE-5912682402`, `BALANCE-5934593169`, `BALANCE-5947003355`
- `INTERNAL_TRANSFER`: `TRANSFER-2294843160`, `TRANSFER-2302156564`, `TRANSFER-2318829131`, `TRANSFER-2328444134`, `TRANSFER-2328446414`
- `RECONCILED`: `TRANSFER-2288098808`, `TRANSFER-2302130238`, `TRANSFER-2315340752`, `TRANSFER-2328142012`

**Personal BRL main `44840079`**

- `AMBIGUOUS`: `CARD-4220992530`, `CARD-4256897536`
- `EXTERNAL_TRANSFER`: `TRANSFER-2288389071`, `TRANSFER-2288456546`, `TRANSFER-2288501716`, `TRANSFER-2288616241`, `TRANSFER-2294830823`, `TRANSFER-2295697049`, `TRANSFER-2297900953`, `TRANSFER-2302200990`, `TRANSFER-2306674719`, `TRANSFER-2313535551`, `TRANSFER-2315648627`, `TRANSFER-2315651264`, `TRANSFER-2318839258`, `TRANSFER-2318867788`, `TRANSFER-2321110413`, `TRANSFER-2321843717`, `TRANSFER-2321964798`, `TRANSFER-2328479994`, `TRANSFER-2328635035`, `TRANSFER-2332143166`, `TRANSFER-2332509029`, `TRANSFER-2332755277`, `TRANSFER-2335317668`
- `FX`: `BALANCE-5799727114`, `BALANCE-5800768244`, `BALANCE-5801532904`, `BALANCE-5809565364`, `BALANCE-5824156793`, `BALANCE-5831179949`, `BALANCE-5847341318`, `BALANCE-5848776047`, `BALANCE-5891771870`, `BALANCE-5902287793`, `BALANCE-5905321094`, `BALANCE-5912682402`, `BALANCE-5934593169`, `BALANCE-5947003355`
- `INTERNAL_TRANSFER`: `TRANSFER-2304279736`, `TRANSFER-2307267684`, `TRANSFER-2312722624`, `TRANSFER-2318836820`, `TRANSFER-2318950302`, `TRANSFER-2321022395`, `TRANSFER-2321024954`, `TRANSFER-2321086263`, `BALANCE-5944626927`, `TRANSFER-2332896624`, `TRANSFER-2335040967`, `TRANSFER-2337399899`
- `RECONCILED`: `CARD-4144431540`, `CARD-4144892041`, `CARD-4145648849`, `CARD-4148974252`, `CARD-4149417131`, `CARD-4149443053`, `CARD-4150131526`, `CARD-4153642533`, `CARD-4158342738`, `CARD-4163002436`, `CARD-4163118774`, `CARD-4175226758`, `CARD-4176087937`, `CARD-4179448066`, `CARD-4181023476`, `CARD-4184866694`, `CARD-4199313125`, `CARD-4201991121`, `CARD-4206587540`, `CARD-4206617718`, `CARD-4207183164`, `CARD-4212059107`, `CARD-4215959610`, `CARD-4220294921`, `CARD-4220460287`, `CARD-4236951296`, `CARD-4240908881`, `CARD-4244545371`, `CARD-4244569133`, `CARD-4246302785`, `CARD-4250805328`, `CARD-4255225921`

**Personal BRL reserve `171018409`**

- `INTERNAL_TRANSFER`: `BALANCE-5944626927`

## Data quality

| Dimension | Assessment | Reason |
|---|---|---|
| Pocket arithmetic | High | Every supplied running balance reconciles exactly; six closing differences are zero |
| Pocket ownership | High, not absolute | Matched transfers, merchants, Dave receipt, and production snapshots corroborate the mapping; account labels are not embedded in the CSV |
| Cash receipt evidence | High | Wise rows and running balances |
| August earned/billed Upwork revenue | Low | No period-specific Upwork report and no August billing evidence |
| Expense existence | High | Wise proves charge/outflow |
| Expense economic ownership/category | Mixed | Transitional personal/business crossover and uncategorized transfers |
| FX cash movement | High in Wise | Exact source/destination legs and observed rates |
| FX representation in MindBunker | Low/partial | Only five canonical rows; two material discrepancies and many missing operations |
| Calendar-month completeness | Provisional | Export ends August 30; August 31 not yet available |

### Source fingerprints

| Account | SHA-256 |
|---:|---|
| `171018409` | `5e9b80880f26889125a6acaa80d2baac63089bf7854f8d4b6837e6f0b63a30c1` |
| `44840079` | `f76275d88936fec698a2bf4c5d1d12f6848ae34d056c0d80a56efe69c9ca6525` |
| `45837980` | `3ab48582a2f91805c8df9845445f42e6282ac28ce7530ee97a307e2d6d68696f` |
| `118287732` | `5062246fba894f0105a064a06f3ce26269254a88122144834aa4ee94fd1a23eb` |
| `168497359` | `ed9c2ea558fe3aa27cb7d8be752e397697974feb9afe51e870604446b3ae5337` |
| `171067558` | `10db3012494a29627bdaf0af52578fbd16027e9f253e189dd5af5528431dbc9e` |
| `lifetime_billings.csv` | `a5a42bbac84196123a419dac0187630db432029c2d6c851f9867220a6ccf708d` |

## What August now proves

- The six-pocket opening and latest supplied closing positions.
- USD 933.75 of Upwork-origin cash and USD 100.00 of direct Dave cash entered Wise during the available window.
- USD 215.00 is the canonical Owner Pay bridge, without misclassifying every self-transfer as Owner Pay.
- Business and personal FX can be reconstructed from source facts without normalizing all money into one currency.
- Internal transfers and reserves do not inflate income or expense.
- The business/personal crossover is measurable and can remain truthful even before every category is known.
- Production Finance is useful but not yet complete enough to replace the Wise movement ledger for August.

## What remains outside August

- Pre-August transaction reconstruction beyond the opening-balance evidence.
- Upwork worked/billed/fee detail and client attribution for the three unresolved payouts.
- Final August 31 statement rows and a true calendar month-end close.
- Tax characterization, accounting policy, accrual treatment, and legal conclusions.
- Importing or correcting Finance/FX rows in production; this report authorizes no writes.
- September subscription recurrence and subsequent pocket balances.

## Closure gate

August can remain **YELLOW and operationally useful** now. It may move to GREEN only after:

1. a final August export confirms the six closing balances through August 31;
2. the five `AMBIGUOUS` rows receive operator answers;
3. the material external transfers are identified as expense, internal-to-owner, reimbursement, or other truthful treatment;
4. an August Upwork transaction report resolves worked/billed/fee/payout attribution; and
5. the canonical FX discrepancies are corrected through a separately reviewed production-write round.

Until then, the zero pocket differences are a strong cash-control result—not permission to manufacture P&L certainty.
