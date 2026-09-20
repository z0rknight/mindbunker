# Commercial Evidence Attribution & Delivery Truth — Release Train (2026-09-19/20 operator-local)

## 1. Source snapshot
GREEN. HEAD = release = `production/current` = `46c86d0cd`; migration head 0052, none pending; Operator `40e1d189…`, Client `6a619197…`; Sensor untouched.

## 2. Current attribution architecture (archaeology, one pass)
| Layer | Stored | Attributable to |
|---|---|---|
| EXTERNAL REGISTERED TIME | `billing_evidence` (Upwork weekly reports: minutes × rate, source UPWORK_REPORT/MANUAL) | **Client** (via its contract); not a batch or video by itself |
| ALLOCATION | `billing_allocations` (`video_id` nullable; method MANUAL_AMOUNT / MANUAL_MINUTES / DERIVED_PROPORTION; minutes; amount) | **Video**; **Production Order** via its operational container video (the same convention the order's "billed" figure already reads); **Project: no honest home** (no column, no container) |
| PAYMENT | `transactions` (income), client-level | Client only; no batch/video link |
| Before this train | `recordBillingAllocation` existed with **no UI caller and no ownership check** | the operator could not express attribution at all |
Semantics preserved: registered time ≠ invoice; billing evidence ≠ payment; allocation ≠ revenue; an attributed amount is an exact share of THAT evidence's gross, never revenue.

## 3. Historical coverage (read-only)
Taryn external registered time: **69.5 h** (7 Upwork reports, 4,170 min, Jul 27–Sep 13) plus one manual 3 h entry (Jan). Correction to the premise: all **9 existing allocations (90 min) are `DERIVED_PROPORTION`**, so **explicitly attributed = 0**; the "~1.5 h" is a historical proportional estimate on the Jul 27–Aug 2 week only. **Attributed (explicit) before: 0 h (0%); derived history: 1.5 h (2.2%); unallocated: 68.0 h (97.8%).** Billing evidence (Taryn, incl. manual): $1,812.51; income transactions (client level): $1,372.50; Production Orders: 1; revisions: 0.
Classification: EXPLICITLY ATTRIBUTABLE (new, promotable): **0**; HISTORICAL DERIVED (kept as history): 1 week / 90 min; POSSIBLY attributable: none classified (date overlap or Sensor proportions alone are not evidence); UNKNOWN: 4,080 min across 7 weeks. **No historical backfill was performed.**

## 4. Implemented attribution semantics (no migration)
- **Targets supported:** Client (implicit, via contract), **Production Order** (container), **Video**. **Project attribution: UNSUPPORTED** — needs a schema change; consolidated proposal below, not built (order level covers the current LET'S COOK flow).
- Finance → Contracts → selected evidence: a panel showing **Registered / Attributed by you / Historical (derived) / Unallocated**, plus an optional explicit "attribute N h to this batch or video" action. Unallocated is the normal starting state; there is no required workflow or nagging.
- Rules: least precise TRUE level (order, not children); same-client ownership validated; container can't be attributed as a video; over-allocation rejected; amount = exact share of that evidence's gross; only `MANUAL_MINUTES` is ever written; only the operator's own rows can be removed (history is preserved). **No automatic proportional spread exists anywhere** (no function divides by video count, Sensor time, sessions or deliveries; pinned by test). The legacy `recordBillingAllocation` now also rejects cross-client videos.
- Attribution writes exactly one `billing_allocations` row: no payment, status, session, evidence or event.
**Proposal (deferred, only if project-level attribution is later needed):** add nullable `billing_allocations.project_id` with a CHECK that at most one of `video_id`/`project_id` is set; existing rows stay valid (all have `project_id` NULL); SQL shape `ALTER TABLE billing_allocations ADD COLUMN project_id integer REFERENCES projects(id) ON DELETE SET NULL;` plus the CHECK via table rebuild. Why video-only is insufficient for projects: work without a Production Order has no container to hang an honest attribution on.

## 5. Dave delivery verdict: CANONICALIZED
Proved live before writing: note event **#75** (Aug 26) is on **video 25 "Landing Page"** (client 4 Dave DeMink, project "Website Videos"); it is the only "Landing Page" video; the note labels the link **"Download Link:"** (the Wise link is separate and excluded); the review link is a different, already-stored Frame.io URL; the URL was set nowhere; the video is DONE/delivered and visible to the client (he was sent this link, so portal display is appropriate); the Drive link answers HTTP 200. Code check: `delivery_url` is only ever displayed (Client Portal "Watch" link, video field, order/production-context rows); nothing derives status, payment or acceptance from it.
**Production write (exact):** `UPDATE video_logs SET delivery_url = 'https://drive.google.com/file/d/1Bv8Dy5MPKITs7VhBiVehTeIWWF0p8yV5/view?usp=share_link' WHERE id = 25 AND client_id = 4 AND title = 'Landing Page' AND status = 'DONE' AND delivered = 1 AND delivery_url IS NULL` → 1 row. Old value `NULL` → new value the URL above; video id 25; source note event **#75**. Read-back: only `delivery_url` changed; status/delivered/notes/review/published untouched; transactions, work sessions, billing evidence/allocations, events (263), payment requests, quotes, videos all identical. The historical Quick Note was not touched or deleted. Status/commercial side effects: 0.

## 6. Evidence-block changes
The existing Production Order block now states, per registered week, **registered / here / elsewhere / unallocated** (and the total attributed to the batch, with historical derived shown separately), labelled "not billed revenue, not paid". With nothing attributed it says so and points to Finance → Contracts. Footer corrected: "No profit figure is shown: payment is not tracked per batch, and registered time counts here only where you attributed it." Still no margin, profit, ROI or effective hourly rate. Local proof (6 h evidence → 4 h to one order → 2 h unallocated): UI showed exactly registered 6h00 · here 4h00 · elsewhere 0h00 · unallocated 2h00, one allocation on the container only, no child rows.

## 7. Not done (by design)
No mass historical allocation; no revision backfill (0 samples is acceptable; the optional `caused_by` control accumulates naturally); no mandatory phase logging (coarse `activity_type` exists: EDITING dominates; phase stays deferred); no Pricing Lab.

## 8. Tests, gates
30 new/updated: 20 attribution (semantics, ownership, over-allocation, no-spread, history, the 6h example, boundaries) + 5 delivery-canonicalization + evidence updates. Full gate once: `git diff --check` clean; **1376/1376**; `tsc` clean; `eslint` 0 errors (3 pre-existing warnings); build exit 0.

## 9. Deploy and authority
One deploy: Operator `51dc1808-da15-42b4-b50a-8b6f0cb30118` (from `1b8e8e1`); rollback `40e1d189-502e-4e45-be3c-5dcada4ee7fe`. Client, Sensor, public site untouched; no migration. **Production D1 writes: exactly one row (video 25 `delivery_url`).** HEAD = release = `production/current` at `1b8e8e1` before this report-only commit. Production reachability (unauthenticated): finance/orders → 307 to login; PDBM page 200; portal login 200. Production authenticated UI: not run / not required (deterministic UI; data read back).

## 10. Pricing-Lab readiness: NOT READY
The mechanism is now in place, the evidence is not: explicit attribution 0 h (new capability, no samples yet), one Production Order with time, billing evidence weekly (per contract), payments client-level only, revision burden 0. Blockers remaining: (1) a handful of completed batches with explicit attribution accumulated through normal use; (2) multiple Production Orders with tracked time; (3) revision causes recorded as revisions happen; (4) optionally project-level attribution for work outside Production Orders.
