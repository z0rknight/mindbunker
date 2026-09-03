# POST-JOB COMMERCIAL + DELIVERY SNIPER

## BASE SHA
`57e0449cb6cac0e4dc7ec639dcb9db7a01a22725` (main, local dogfooding lineage — confirmed via `LOCAL_DOGFOODING_CONSOLIDATION.md` project doc as the correct working checkout for this engagement's local-dogfooding rounds)

## CANDIDATE SHA
`1644ba9f817201b92efbd9db81956d4637cbcb6c` (main, committed this round)

## CONTRACT ATTRIBUTION
**Current model, before this round:** `getCommercialTermsForVideo` resolved HOURLY billing by looking up the video's client, then taking `.limit(1)` of that client's ACTIVE HOURLY `commercial_contracts` row — an unlabeled, silent pick with no protection if a client had more than one such contract (e.g. an Upwork contract and a separate direct retainer).

**Changes:** Additive migration `0040_wakeful_paladin` adds nullable `projects.contract_id` and `video_logs.contract_id` (FK → `commercial_contracts`, `onDelete: set null`). Resolution order in `getCommercialTermsForVideo`: explicit video contract → explicit project contract → the legacy client-single-active-contract fallback (preserved unchanged for backward compatibility with every video that predates this column) → none. `setVideoContract`/`setProjectContract` (new server actions) validate the contract belongs to the same client, unconditionally, server-side.

## COMMERCIAL VALUE ENGINE
**Hourly:** `computeRateEquivalent` (`modules/finance/core.ts`) — tracked seconds ÷ 3600 × contract hourly rate, `round2`'d — is now the single function every surface calls. Two independent recomputations were found and collapsed into it. Worked example verified in tests: 46 minutes × USD 25/hour = USD 19.17.
**Fixed:** unchanged — the agreed price is a recorded fact, never derived from hours.
**Unknown:** billingModel `NONE` renders "—", never $0.
**Currency:** every aggregation buckets strictly by currency; USD and BRL are never summed together.

## VIDEO WORKSPACE RESULT
`CommercialTermsPanel` shows Tracked production time / Contract rate / Estimated accrued value together, plus a provenance tag. A "Link contract" picker appears when unattributed and the client has contracts on file.

## PROJECT COMMERCIAL SUMMARY
New section near the top of the Project workspace page. Project Notes demoted to a closed-by-default `<details>` element after it.

## PRODUCTIVITY OUTPUT
Not changed this round — deferred, see QA ledger.

## DASHBOARD OUTPUT
Not changed — verified already correct (`getTodayRateEquivalents`).

## WAR ROOM OUTPUT
Not changed — deferred.

## CLIENT DASHBOARD
Client video detail page now shows hourly rate/tracked/estimated-accrued for HOURLY videos. Paid/Unpaid omitted deliberately — no deterministic payment link exists. Period views not added.

## DELIVERY LINK BUG
Two real root causes found and fixed: (1) the Lab's "Deliver Video" flow wrote only to the `deliveries` audit table, never `video_logs.delivery_url` (the field the client portal reads). (2) `setPublishedUrl` accepted plain `http://` URLs while every client-facing read re-validates HTTPS-only, silently nulling the link. Both now share the one canonical `validateDeliveryUrl`.

## DELIVERY GENERATOR
New `modules/delivery-message` module + Video Workspace panel, reusing the Pricing Lab copy pattern. Client-safe facts only, editable before copy, nothing sent automatically.

## REQUEST REGISTRATION
Deferred.

## WORK UNIT VS DELIVERABLE
Deferred, architecture note written (`POST_JOB_SNIPER_DEFERRED_ARCHITECTURE.md`).

## SENSOR + WEB EVIDENCE
Deferred, architecture note written (same file).

## BILLING SAFE-MARGIN POLICY
Deferred as COMMERCIAL POLICY BACKLOG per the brief's own escape hatch.

## PROJECT NOTES UX
Fixed.

## WORKSPACE DENSITY
Partial — only Project-page notes demotion done.

## MIGRATION
`0040_wakeful_paladin.sql` — additive only. Replayed against the full local migration chain (0000–0040) in a VM-local linux-arm64 D1 emulator; clean.

## TESTS
727 total, 724 pass. 3 pre-existing failures on unmodified main (confirmed via git stash), unrelated to this change. 19 new tests added this round, all passing.

## TYPESCRIPT
Clean.

## ESLINT
Clean on all changed/new files.

## NEXT
`next build` succeeds (VM-local scratch build).

## OPENNEXT
`opennextjs-cloudflare build` succeeds.

## RESPONSIVE
Not independently re-verified visually (no browser reachable from this sandbox). New UI reuses already-responsive existing patterns.

## D1 MUTATION
NONE REMOTE.

## DEPLOY
NO.

## QA LEDGER
YES — `docs/architecture/POST_JOB_QA_LEDGER.md` (committed).

## FINAL VERDICT
**YELLOW — USEFUL PATCH — Productivity/War Room/Client-period-views/Request-registration/Video-Workspace-UX-reorg remain genuinely unimplemented (documented, not silently dropped); Sensor/Web dedup and Work Unit vs Deliverable correctly deferred with written architecture notes.**

NO DEPLOY.
