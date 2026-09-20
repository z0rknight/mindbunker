# Production Order — Final-State Truth (Wave 1, 2026-09-19)

## 1. Source authority
GREEN. HEAD `1fef380` = `origin/release/video-workspace-hotfix` = `origin/production/current` = deployed Operator code before this patch. Primary evidence: operator log "19sep - sabadou", p.8 (order detail showing **IN PRODUCTION + CLOSED** with 3 deliverables Done and 1 Planned).

## 2. Current model discovered
HYBRID, and intentional:
- `production_orders.state` — persisted `OPEN | CLOSED | CANCELLED`, operator-set. Close/cancel do **not** require children DONE.
- `phase` — `RECEIVED | IN_PRODUCTION | REVIEW | DELIVERED`, **derived on every read** from active children by `deriveProductionOrderPhase` (`core.ts`). Never stored.
- The operational container (`is_operational_container=1`) and cancelled children are excluded from every count and from the phase.

`state` (scope was finalized) and `phase` (what production looks like) answer different questions, so they are not merged.

## 3. Reproduced root cause
The derivation was already correct. The pages printed the derived phase **and** the state as two independent badges, so a closed order with an unfinished child read "IN PRODUCTION · CLOSED". Separately, the phase label for "every active child DONE" was **"Delivered"**, which claimed delivery from production status alone (DONE ≠ DELIVERED).

## 4. Canonical state rules (`describeProductionOrderStatus`, `core.ts`)
- CANCELLED → "Cancelled". CLOSED → "Closed" (tone *complete* only if every active child is DONE, else *closed*). The headline follows `state` first.
- OPEN → the derived phase label: Received / In production / In review / **All done**.
- A tally line is always shown: "All N deliverables done" or "X of N deliverables done · Y not finished". A closed order with unfinished work therefore never claims completion, and never shows a stale "in production".
- READY_FOR_REVIEW ≠ done; done never implies delivered/paid.

## 5. Duplicated calculations
Not found. One derivation (`deriveProductionOrderPhase`) feeds production-orders `data.ts`, Client Portal and War Room. Only the two LET'S COOK pages duplicated *presentation*; they now share one describer and one tone→class map (`PRODUCTION_ORDER_TONE_CLASSES`).

## 6. Production read-only findings
Read-only `--remote` queries. Exactly **1** real false-state order: id 1, CLOSED, 3 DONE + 1 PLANNED (+1 container, 0 cancelled). No writes.

## 7. Code changes
- `core.ts`: `describeProductionOrderStatus`, `ProductionOrderHeadlineTone`.
- `config.ts`: `DELIVERED` label "Delivered" → "All done" (enum key unchanged; many consumers switch on it); `PRODUCTION_ORDER_TONE_CLASSES`.
- `orders/page.tsx`, `orders/[id]/page.tsx`: render the shared headline + tally instead of phase + state badges.
- No migration, no new status, no data change, no Client Portal change.

## 8. Tests
`core.test.mjs`: 11 new tests (A–G, closed-regression, closed+all-done, cancelled, empty, page-wiring source check). Targeted 32/32; full `npm test` 1222/1222; `tsc` clean; `eslint` 0 errors (3 pre-existing warnings); `next build` OK; `git diff --check` clean.

## 9. Deploy
Operator Worker only, deployed from `42b7415` as version `4263be80-c688-45b0-8765-d15b470359e7`. Unauthenticated production check: `/mindbunker/productivity/orders` → 307 to login (reachable). Rollback version `7c7996b1-cd34-457b-8383-cf9b8001fc12`. Client, Sensor and public site untouched; no D1 mutation.

## 10. Functional QA
Local sandbox D1 (order 1: 5 active + 1 cancelled + container), list and detail, then restored:

| Scenario | Rendered |
|---|---|
| all 5 DONE (OPEN) | All done · All 5 deliverables done |
| 4 DONE + 1 IN_PROGRESS | In production · 4 of 5 · 1 not finished |
| all READY_FOR_REVIEW | In review · 0 of 5 |
| CLOSED, 4 DONE + 1 PLANNED | Closed · 4 of 5 · 1 not finished |
| CLOSED, all DONE | Closed (complete) · All 5 done |
| CANCELLED | Cancelled |

Cancelled child (video 9) and container never counted. Video IDs, Work Sessions, billing evidence and delivery data fingerprint identical before/after. Authenticated production QA was **not** performed.

## 11. Deliberately NOT changed
Derivation logic, `state` semantics, close/cancel rules (no "children must be DONE" gate), Client Portal, War Room logic, delivery/billing, any migration or backfill, and everything on the out-of-scope list (PDBM, Vault, QA checklist, economics, Quick Notes, analytics, Pricing Lab).
