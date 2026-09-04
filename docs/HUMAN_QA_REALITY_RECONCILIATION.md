# Human QA — Reality Reconciliation (Sep 2026)

Run these yourself; nothing here was applied against your live/production
database from this environment (no wrangler credentials were available).

**Evidence correction note:** an earlier revision of this checklist asked
you to independently re-verify the Sep 3 balances against your Wise app
because no statement had been found. That search was incomplete — the seven
real Wise PDF statements for 1-3 Sep 2026 were on the Desktop the whole
time (`biz-statement_2026-09-01_2026-09-03_pdf/` and
`persona-statement_2026-09-01_2026-09-03_pdf/`), were read in full this
round, and all seven numbers below are now statement-verified (`WISE_PDF`),
not self-reported. You can still spot-check them against the live Wise app
if you want extra confidence, but it is no longer required before running
the patch — see `docs/architecture/REALITY_RECONCILIATION_SEP2026.md`
("EVIDENCE CORRECTION") for the full citation of which statement backs
which number.

## FINANCE

- [ ] Open `/finance` and confirm the "Reconcile with Wise" panel shows all
      7 pockets (3 business, 4 personal) with a Sep 3 `WISE_PDF` observation
      — the Aug 31 `WISE_PDF` observation on the 3 business pockets should
      still be visible too (both dates coexist; neither overwrote the
      other).
- [ ] Confirm the Dashboard shows **Available Cash** and **Reserved Cash**
      per currency, each labeled "Wise-observed <date>" now that both
      currencies have a real Sep 3 statement behind them. BUSINESS USD
      should show Available $21.52 and Reserved $200.00 as two separate
      figures (total $221.52), never collapsed into one number.
- [ ] Confirm the "Economic Ledger Net" card (recorded transaction history)
      is still visible separately from the Wise-observed cash cards — it
      should never again be the only cash figure shown.
- [ ] Confirm the BUSINESS USD Savings/Reserve pocket's history now shows
      the Aug 31 → Sep 3 $300.00 → $200.00 change as a labeled
      `INTERNAL_TRANSFER` (Wise transaction `BALANCE-6001326761`), not an
      unexplained drop — this is resolved, no further investigation needed
      unless the number itself looks wrong to you.
- [ ] Review the equipment/purchase NEEDS_REVIEW list in the final report
      (Amazon ~R$300, DDR3+HDD R$150, Terabyte R$140.39) and classify each
      as personal, RMEDIA, or mixed yourself — none were auto-classified.
      Note: the Terabyte R$140.39 payment is now confirmed, by the BUSINESS
      BRL operating Wise statement itself, to have been paid from the
      RMEDIA pocket — that's a fact about which account paid, not a
      classification of whether it should count as a business expense.

## OPERATIONS

- [ ] Before running Section 3 of the patch script, check the Work Session
      Ledger yourself for Sep 2, 02:15–04:36, on Taryn's MINI SERIES Video 1
      — confirm nothing already covers that window (the script's overlap
      guard only protects against an exact video-id match).
- [ ] Confirm Work Session #41 (Taryn, Sep 3) still reflects your own
      correction (16:35–18:33) — the journal's fuller account (15:38–18:27)
      is offered as an optional note in the final report, not auto-applied.
- [ ] Confirm no Dave DeMink session, project, or video was touched by
      anything in this round — search the repo diff and the patch script
      for "Dave" if you want to double-check (there should be nothing).

## DASHBOARD

- [ ] Visually check the Dashboard on a real device/browser — the new
      4-card Finance grid (Available / Reserved / Economic Ledger Net / Net
      This Month) should render correctly at both mobile and desktop widths.

## REGRESSION

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test` — expect 731 tests, 728 pass. The 3 pre-existing failures
      (`custody/core.test.mjs`, two `owner-pay-bridge` Drizzle-shape tests)
      were present before this round; confirm they're still the *same* 3,
      not new ones.
- [ ] `npm run build` — this environment confirmed a clean production build
      with these changes included; re-confirm on your machine since this
      environment cannot reach your remote D1 or Cloudflare account.
