# Human QA — Reality Reconciliation (Sep 2026)

Run these yourself; nothing here was verified against your live/production
database from this environment (no wrangler credentials were available).

## FINANCE

- [ ] Open `/finance` and confirm the "Reconcile with Wise" panel still
      shows the 3 business pockets with an Aug 31 WISE_PDF observation, plus
      (after applying the patch script) a Sep 3 SELF_REPORTED observation on
      each — both should be visible, neither should have overwritten the
      other.
- [ ] Confirm the Dashboard now shows **Available Cash** and **Reserved
      Cash** per currency, each labeled either "Wise-observed <date>" or
      "⚠ Not yet reconciled with Wise" — never silently presented as
      confirmed.
- [ ] Confirm the old "Current Balance" number (renamed "Economic Ledger
      Net") is still visible somewhere, now labeled "Recorded history · not
      Wise cash" — it should never again be the only cash figure shown.
- [ ] Before running `docs/reality-reconciliation-patch.sql` against your
      real database: open your Wise app and verify the four personal
      balances (BRL, USD, Dolarize USD, Dolarize BRL) and the Sep 3 company
      balances against what's actually there today — the numbers in the
      patch are your own typed figures from the brief, not independently
      verified statements.
- [ ] Specifically check the USD business reserve pocket: it goes from a
      Wise-confirmed $300.00 (Aug 31) to a self-reported $200.00 (Sep 3) with
      no matching movement found in either journal. Confirm whether that
      $100 actually moved, and where.
- [ ] Review the equipment/purchase NEEDS_REVIEW list in the final report
      (Amazon ~R$300, DDR3+HDD R$150, Terabyte R$140.39) and classify each
      as personal, RMEDIA, or mixed yourself — none were auto-classified.

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
