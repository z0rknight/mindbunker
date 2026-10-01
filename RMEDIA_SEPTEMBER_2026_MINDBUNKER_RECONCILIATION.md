# RMEDIA OS — September 2026 MindBunker Reconciliation

**As of:** 1 October 2026  
**Scope:** final September closure against production D1, Wise, Upwork screenshots, Notion, Gmail, Slack, Calendar, current source and prior reconciliation artifacts.  
**Final state:** **CLOSED WITH EXCEPTIONS** — Finance, Taryn attribution and the seven BRL classifications are reconciled. The remaining exceptions are bounded: Health Meeting duration, delivery/review precision and Operator source authority.

## Executive answer

- **[CANONICAL FACT]** Raw September Work Sessions: **153.8425h / 66**.
- **[DERIVED FACT]** Admissible recorded operating time: **112.7725h / 64**. This is a lower bound, not all work performed.
- **[UNRESOLVED]** Work Session 83 remains **41.0533h raw**, preserved and excluded; exact Health Meeting hours were not recoverable.
- **[SOURCE-SUPPORTED FACT]** September Taryn time in Upwork by work date: **33h40m / 2,020 min**.
- **[DERIVED FACT]** Gross value of that September work at USD 25/h: **USD 841.67**.
- **[CANONICAL FACT]** Upwork gross transactions posted in September: **USD 729.17**.
- **[CANONICAL FACT]** Upwork service fees posted in September: **USD 72.92**.
- **[DERIVED FACT]** Net after service fees, before withdrawal: **USD 656.25**.
- **[CANONICAL FACT]** Four Wise settlements received: **USD 644.29**; all are attributed to the Taryn commercial relationship at client level.
- **[SOURCE-SUPPORTED FACT]** Four operator-confirmed Upwork withdrawal fees: **USD 11.96** total. Net platform proceeds after service and withdrawal fees are **USD 644.29**, matching Wise cash exactly.
- **[CANONICAL FACT]** Health Meeting cash: **BRL 400.00**, reconciled to Agência Preview while Jefferson Bottin Bernardes remains the payer.
- **[CANONICAL + SOURCE-SUPPORTED FACT]** Confirmed operating cost: **USD 117.63** (USD 32.75 Wise-paid operating cost + USD 72.92 service fees + USD 11.96 withdrawal fees) and **BRL 923.48**.
- **[CANONICAL FACT]** **BRL 234.90** is personal/owner draw and excluded; remaining unknown BRL is **0.00**.
- **[DERIVED FACT]** Management operating result is **READY by currency**: **USD 611.54** and **BRL -523.48**. USD uses either the posted-gross bridge or Wise cash basis, never both. “Profit” remains disallowed.

## Evidence and non-collapse rule

Every number keeps its own question and date basis:

`WORK PERFORMED → GROSS PLATFORM EARNING → SERVICE FEE → NET PLATFORM VALUE → PAYOUT/SETTLEMENT → WISE CASH`

Gross Upwork earnings and Wise cash are not added as two revenues. Fees are recorded in `platform_fees`, not duplicated as bank expenses. Upwork daily time is external registered time, not automatically added to Work Sessions. Existing `DERIVED_PROPORTION` allocations remain derived and were not expanded to 33h40m.

## Time truth

### MindBunker operating time

| Context | Hours | Sessions |
|---|---:|---:|
| CLIENT | 72.0350 | 49 |
| INTERNAL | 28.7931 | 9 |
| ADMIN | 11.4594 | 5 |
| LEAD | 0.4850 | 1 |
| **Admissible total** | **112.7725** | **64** |

Excluded without deletion:

- Work Session 83: 41.0533h, implausible interval, exact replacement unknown.
- Release fixture: 0.0167h, excluded by `source=RELEASE_TEST`.

### Taryn: Upwork time versus MindBunker time

| Measure | Time | Meaning |
|---|---:|---|
| Upwork registered by September work date | **33h40m** | External commercial-time evidence |
| MindBunker Taryn + Taryn DFY Work Sessions | **33h51m25s** | Intentional internal session truth |
| Maximum compatible overlap by date | **26h40m47s** | Date-level ceiling, not timestamp overlap |
| Upwork excess on matched dates | **6h59m13s** | Known Upwork time not covered by same-date Taryn sessions |
| MindBunker excess on matched dates | **7h10m38s** | Same-date Taryn session time above Upwork totals |

The screenshots provide daily totals, not exact intervals. Therefore the exact overlap is unknown and **33h40m is not added on top of 112.7725h**. Sensor also does not resolve interval overlap: it is observation evidence, not a work definition.

### Upwork work-date reconstruction

| Week | September minutes | September time | Gross work value |
|---|---:|---:|---:|
| 31 Aug–6 Sep | 540 | 9h00 | USD 225.00 |
| 7–13 Sep | 400 | 6h40 | USD 166.67 |
| 14–20 Sep | 440 | 7h20 | USD 183.33 |
| 21–27 Sep | 0 | 0h00 | USD 0.00 |
| 28 Sep–4 Oct | 640 | 10h40 | USD 266.67 |
| **September** | **2,020** | **33h40** | **USD 841.67** |

Aug 31 (1h10) and Oct 1 (3h00) are explicitly outside the September work-date calculation.

## Taryn / Upwork commercial chain

| View | Amount | Status |
|---|---:|---|
| September work-date gross value | USD 841.67 | SOURCE-SUPPORTED + DERIVED |
| September-posted gross | USD 729.17 | CANONICAL |
| September-posted service fees | USD 72.92 | CANONICAL |
| Net after service fees / before withdrawal | USD 656.25 | DERIVED |
| Withdrawal fees | USD 11.96 | SOURCE-SUPPORTED |
| Net platform proceeds | USD 644.29 | DERIVED |
| Wise cash received | USD 644.29 | CANONICAL |
| Settlement reconciliation gap | USD 0.00 | RECONCILED |

The operator statement resolves **client-level attribution** and identifies the four USD 2.99 differences as Upwork withdrawal/payout fees. The exact arithmetic and chronology pair each posted earning with its next Wise receipt; the independent payout report remains unavailable, so the pairing is source-supported rather than promoted to a separate canonical payout object.

| Wise date | Wise ID | Amount | Client-level state |
|---|---|---:|---|
| 8 Sep | `TRANSFER-2359165993` | USD 109.51 | Taryn / Upwork settlement |
| 14 Sep | `TRANSFER-2370743937` | USD 225.76 | Taryn / Upwork settlement |
| 22 Sep | `TRANSFER-2386078149` | USD 147.01 | Taryn / Upwork settlement |
| 29 Sep | `TRANSFER-2399609176` | USD 162.01 | Taryn / Upwork settlement |

Each bridge closes exactly: posted gross − service fee − USD 2.99 withdrawal fee = Wise receipt. The operational decision is to concentrate future withdrawals because Upwork charges USD 2.99 per payout.

## Cost close

| Class | USD | BRL | Treatment |
|---|---:|---:|---|
| Software / collaboration | 32.75 | 394.04 | Confirmed operating cost |
| Equipment / upgrade | 0.00 | 150.00 | Confirmed operating cost |
| Operating meals | 0.00 | 379.44 | Confirmed operating cost |
| Upwork service fees | 72.92 | 0.00 | Confirmed direct platform cost for Taryn |
| Upwork withdrawal fees | 11.96 | 0.00 | Confirmed direct platform/withdrawal cost |
| **Confirmed operating cost** | **117.63** | **923.48** | No double subtraction from net Wise cash |
| Personal / owner draw excluded | 0.00 | 234.90 | iFood Club + Wellington |
| Mixed / unknown business outflow | 0.00 | 0.00 | Closed |
| Owner transfer | 125.00 | 0.00 | Separate from cost and revenue |

The operator classified Jonas 150.00, Hotmart 74.00, Restaurante Árabe 99.55, iFood/Adilson 68.81 and iFood transfer 211.08 as BUSINESS OPERATING; iFood Club 12.90 and Wellington 222.00 as PERSONAL. Exact Wise IDs, human notes, actor, classification date and prior `AMBIGUOUS` state are retained in the derived transactions; source cash descriptions were not overwritten.

Management operating result by currency:

| Currency | Revenue basis | Cost treatment | Result |
|---|---:|---:|---:|
| USD | Wise Taryn cash 644.29 | Wise-paid operating 32.75 | **611.54** |
| USD bridge | Posted gross 729.17 | service 72.92 + withdrawal 11.96 + Wise-paid operating 32.75 | **611.54** |
| BRL | reconciled cash revenue 400.00 | operating 923.48 | **-523.48** |

The two USD routes reconcile; they are alternative views and are never added together.

All seven modeled Wise pockets still close at zero difference. USD/BRL are not combined without a dated FX policy.

## CRM identity: Taryn and Taryn DFY

- Taryn (client 2) is the canonical commercial relationship.
- Taryn DFY (client 12) remains an active operational surface, now mapped in source as `canonical_client_id=2`, `work_mode=DFY`; client 2 maps to `work_mode=DIRECT`.
- September MindBunker time is separable: **DIRECT 23.8506h / 17 sessions** and **DFY 10.0064h / 6 sessions**, while commercial reporting rolls both into one Taryn relationship.
- CRM/War Room analytics exclude the alias from client counts, roll its project/activity context to canonical Taryn, and keep project/video/session context separately queryable.
- Root cause: the earlier reconciliation runner wrote client surface state. The maintained runner now has a regression guard forbidding `UPDATE clients`; later legitimate operator state is preserved.
- No migration was needed: the existing alias `client_id` plus a bounded structured source registry is the smallest honest existing-domain model. Finance remains on client 2 / contract 1.

[Notion — Taryn DFY creation context](https://app.notion.com/p/3e9623142ad58002ad4afa07fa86efb7) and [Notion — 1 October state](https://app.notion.com/p/3ec623142ad5803caba0d87816818119?pvs=204) support the operational interpretation.

## Health Meeting

Notion and Calendar prove the event and an all-day Sep 22–25 window (later invitation Sep 22–24), but not Emmanuel’s actual operating interval. The 9:00 meeting on Sep 24 is an agenda fact, not a day-length. Work Session 83 stays excluded. Status: **YELLOW** and included in the single human-input page.

## Delivery and review

- MindBunker: 26 `video.finished` events; 35 videos currently DONE; 0 structured revisions; 0 delivered final assets.
- Slack: Dave had two Meta Ads complete on Sep 3 and a five-video series complete/ready for review on Sep 6.
- Frame.io email: Taryn left 11 comments and then 8 comments on Sep 2 on the same MINI Series asset.

Comment counts are not revision counts; DONE is not blindly treated as delivered. Unique delivery and review denominators remain **YELLOW**, a bounded secondary exception.

## Previous 14 updates — custody audit

The prior production run reported 14 updates at execution level. Reconstructing pre-state backup against retained post-state identifies 11 distinct rows with durable differences:

| Entity | ID | Before | After | Evidence / custody result |
|---|---:|---|---|---|
| `transactions` | 19 | No Wise identity; prior note about mercado/cigarro/gás | Wise owner-transfer identity + explanatory note | Original note was overwritten; **repaired now by appending it verbatim** |
| `transactions` | 20 | `Subscription — Slack`; no Wise identity | `Software / Collaboration`; exact Wise ID and note | Supported by statement/vendor |
| `clients` | 12 | active, no alias note | temporarily GELADEIRA + alias note | Surface write was unsafe; later operator reactivation is preserved; runner now forbids client updates |
| `cash_movements` | 171 | Description ended “(operating)” | Canonical statement description | State unchanged; source PDF retained |
| `cash_movements` | 173 | Description ended “with reference” | Canonical statement description | State unchanged; source PDF retained |
| `cash_movements` | 181 | Description ended “with reference” | Canonical statement description | State unchanged; source PDF retained |
| `cash_movements` | 184 | RECONCILED | INTERNAL_TRANSFER | Exact Emmanuel-controlled transfer |
| `cash_movements` | 185 | RECONCILED | AMBIGUOUS | Jonas purpose not proved |
| `cash_movements` | 189 | Description ended “with reference” | Canonical statement description | State unchanged; source PDF retained |
| `cash_movements` | 197 | EXTERNAL_TRANSFER | RECONCILED | Exact Gabriely movement classification |
| `cash_movements` | 205 | INTERNAL_TRANSFER | RECONCILED | Exact Microsoft card purchase classification |

The three-update difference between the execution counter and the 11 durable row deltas cannot be uniquely reconstructed from end state; it may reflect repeated/transient updates, but that is not asserted as fact. Current immutable identities, source PDFs and original transaction 19 note are preserved. Because the requested 14-line historical enumeration cannot be proven exactly, the audit completeness result is **RED**, while current custody repair is **GREEN**.

## Final closure writes and verification

New evidence was applied with [`scripts/september-2026-taryn-upwork-close.sql`](scripts/september-2026-taryn-upwork-close.sql):

- 3 billing evidence inserts and 1 completion update;
- 4 platform fee inserts;
- 1 append-only reconciliation note;
- 4 client-level settlement updates and 4 matching cash-state updates;
- 1 custody-note repair.

That is **18 semantic row mutations**. Wrangler reported `changes=19` / 42 physical rows written; the semantic table-level diff is the reporting authority. Dry-run replay produced byte-identical dumps. Post-write: migration `0053_slow_shen.sql`, FK 0, duplicate transaction identities 0, duplicate cash identities 0, and no October transactions/cash/Work Sessions.

Backup: `/private/tmp/rmedia-sep-final/mindbunker-pre-upwork-close-relevant-2026-10-01.sql`, SHA-256 `a5891271553a888e775f1411b6241bf436998bc936a5b480da735d0d7fbfb193`. Post-write D1 bookmark: `00000409-00000032-000050f7-37195520f9d3eed6d8c81003ad76e7ab`.

The human-input pass used [`scripts/september-2026-human-input-close.sql`](scripts/september-2026-human-input-close.sql): 7 derived transactions, 7 cash-state classifications, 4 withdrawal-fee rows and 2 append-only reconciliation notes = **20 semantic row mutations**. Wrangler reported `changes=21` / 81 physical rows written; the extra engine-level change is not counted as a business record. Replay against a fresh export was idempotent. Backup: `/private/tmp/rmedia-sep-human-close/mindbunker-pre-human-close-2026-10-01.sql`, SHA-256 `aa182797f4bc36351fdfb5e83ae9d81a7383530f4bee49f12a2ef4cc70e93292`. Post-write bookmark: `0000040c-00000092-000050f7-8fb353efb066dbe9f2ed5d0a307744e9`.

## Source authority

Repo HEAD, `origin/production/current` and `origin/release/video-workspace-hotfix` resolve to `d474213dfeb05ad084763a675ec0488b5f44e0ee`. Current Operator deployment/version `89cbf14a-8ef2-4a10-8521-050f2da91ad4` has `Source: Unknown` and no commit annotation that proves its exact source. No deploy was made. Status: **YELLOW**.

## Closure matrix

| Domain | Status | Answer |
|---|---|---|
| Core time | YELLOW | 112.7725h recorded lower bound; Health duration unresolved |
| Taryn Upwork attribution | GREEN | All period Upwork commercial evidence belongs to Taryn |
| External Taryn time | GREEN | 33h40 by September work date |
| Bank cash | GREEN | USD 644.29 Taryn/Upwork + BRL 400 Health |
| Revenue attribution | GREEN | Client-level Taryn attribution closed; weekly payout mapping YELLOW |
| Operating cost | GREEN | USD 117.63 + BRL 923.48 confirmed; BRL 234.90 personal excluded; unknown 0 |
| CRM client identity | GREEN | One Taryn commercial relationship; DIRECT/DFY structured in source |
| No-double-count semantics | GREEN | Work, gross, fee, net and cash remain separate |
| Delivery | YELLOW | External evidence exists; denominator incomplete |
| Review | YELLOW | Frame.io comments exist; revision denominator incomplete |
| Source authority | YELLOW | Exact deployed Operator commit unproved |
| Operating result | READY | USD 611.54; BRL -523.48; currencies separate |

## Final business answers

1. **How many hours did I operate?** 112.7725h of admissible recorded Work Sessions, with Work Session 83 and uncaptured/offsite duration explicitly unresolved.
2. **How much Taryn Upwork work occurred?** 33h40m by September work date.
3. **Gross value of September work?** USD 841.67.
4. **Gross Upwork transactions posted?** USD 729.17.
5. **Service fees posted?** USD 72.92.
6. **Net Upwork value posted?** USD 656.25 before withdrawal; USD 644.29 after withdrawal.
7. **USD cash received in Wise?** USD 644.29.
8. **How much is attributable to Taryn?** All five commercial views above at client level; exact week-to-payout mapping remains unproved.
9. **Confirmed operating cost?** USD 117.63 and BRL 923.48.
10. **Personal/unknown?** BRL 234.90 personal excluded; BRL 0.00 unknown.
11. **Is management operating result ready?** Yes: USD 611.54 and BRL -523.48, separately.

The same Notion item is retained: [\[SEPTEMBER CLOSE\] Human Inputs](https://app.notion.com/p/3ec623142ad581e4b188d31ca837b121?pvs=204). BRL and withdrawal-fee sections are resolved; only Health Meeting work time remains active.

## Sources

- [September Reality Review](/Users/emmanueldarosadillenburg/Desktop/_Fechando%20Setembro/RMEDIA_SEPTEMBER_2026_REALITY_REVIEW.md) — preserved pre-reconciliation snapshot.
- [Notion — DATA DUMP](https://app.notion.com/p/3ec623142ad58099adbdfdf51430b855?pvs=204)
- [Notion — Health Meeting event](https://app.notion.com/p/3e2623142ad58070b811d1d300b78684)
- [Notion — 22 Sep WAR MODE](https://app.notion.com/p/3e3623142ad580048fe5ec107a56ece2)
- Upwork screenshot set and Wise PDFs under `/Users/emmanueldarosadillenburg/Desktop/_Fechando Setembro/`.
