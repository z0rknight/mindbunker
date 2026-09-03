-- Reality Reconciliation (Sep 2026) -- reviewable, idempotent data patch.
-- DO NOT run this blind. Read docs/architecture/REALITY_RECONCILIATION_SEP2026.md
-- and the reconciliation table in the final report first. Every statement
-- below is guarded so running this file twice (or against a database where
-- some of it was already applied by hand) has no additional effect.
--
-- Apply locally first to see what it would do:
--   wrangler d1 execute mindbunker --local  --file=docs/reality-reconciliation-patch.sql
-- Then, only after you've reviewed the numbers against your real Wise app/statements:
--   wrangler d1 execute mindbunker --remote --file=docs/reality-reconciliation-patch.sql
--
-- Nothing in this file was run against your live database -- this environment
-- has no wrangler credentials for it. Every number below carries its
-- provenance in the row itself (source / external_id / note) so you can see
-- exactly why MindBunker would believe it.

-- ============================================================================
-- SECTION 1 -- PERSONAL CASH POCKETS (Sep 3, 2026, SELF-REPORTED)
-- ----------------------------------------------------------------------------
-- These four personal Wise balances came from your own typed numbers in the
-- mission brief, NOT from an attached Wise statement -- no personal statement
-- or screenshot was found anywhere in what you uploaded. They are tagged
-- SELF_REPORTED, not WISE_PDF/FINANCIAL_STATEMENT, specifically so MindBunker
-- (and anyone reading these rows later) can tell the difference. Treat these
-- as provisional until you reconcile them against the real Wise app the way
-- the three company pockets already were on Aug 31.
-- ============================================================================

-- 1a. Ensure the four personal pockets exist (create only if missing).
-- Guarded on (scope, currency, pocket), which is also a real unique index on
-- cash_accounts -- a second insert attempt would fail loudly, not duplicate.
-- external_source is tagged SELF_REPORTED (not the default 'WISE') because
-- these pockets are not actually linked to a Wise API import yet.
INSERT INTO cash_accounts (scope, currency, pocket, label, external_source, external_account_id, opening_balance, opening_as_of, active)
SELECT 'PERSONAL', 'BRL', 'MAIN', 'Personal BRL', 'SELF_REPORTED', 'self-reported-personal-brl-main', 0, '2026-09-03', 1
WHERE NOT EXISTS (
  SELECT 1 FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'BRL' AND pocket = 'MAIN'
);

INSERT INTO cash_accounts (scope, currency, pocket, label, external_source, external_account_id, opening_balance, opening_as_of, active)
SELECT 'PERSONAL', 'USD', 'MAIN', 'Personal USD', 'SELF_REPORTED', 'self-reported-personal-usd-main', 0, '2026-09-03', 1
WHERE NOT EXISTS (
  SELECT 1 FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'USD' AND pocket = 'MAIN'
);

INSERT INTO cash_accounts (scope, currency, pocket, label, external_source, external_account_id, opening_balance, opening_as_of, active)
SELECT 'PERSONAL', 'USD', 'RESERVE', 'Personal Dolarize (USD)', 'SELF_REPORTED', 'self-reported-personal-usd-dolarize', 0, '2026-09-03', 1
WHERE NOT EXISTS (
  SELECT 1 FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'USD' AND pocket = 'RESERVE'
);

INSERT INTO cash_accounts (scope, currency, pocket, label, external_source, external_account_id, opening_balance, opening_as_of, active)
SELECT 'PERSONAL', 'BRL', 'RESERVE', 'Personal Dolarize (BRL)', 'SELF_REPORTED', 'self-reported-personal-brl-dolarize', 0, '2026-09-03', 1
WHERE NOT EXISTS (
  SELECT 1 FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'BRL' AND pocket = 'RESERVE'
);

-- 1b. Record the self-reported Sep 3 balances as SELF_REPORTED snapshots.
-- external_id makes this idempotent: re-running never inserts a second copy
-- of the same (pocket, date, source) observation.
INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 2.60, '2026-09-03', 'SELF_REPORTED', 'self-reported:2026-09-03:personal-brl', 'Typed by operator in Reality Reconciliation brief. No source statement attached -- verify against the real Wise app before trusting this figure.'
FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'BRL' AND pocket = 'MAIN'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:personal-brl');

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 2.72, '2026-09-03', 'SELF_REPORTED', 'self-reported:2026-09-03:personal-usd', 'Typed by operator in Reality Reconciliation brief. No source statement attached -- verify against the real Wise app before trusting this figure.'
FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'USD' AND pocket = 'MAIN'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:personal-usd');

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 50.00, '2026-09-03', 'SELF_REPORTED', 'self-reported:2026-09-03:personal-dolarize-usd', 'Typed by operator in Reality Reconciliation brief. No source statement attached -- verify against the real Wise app before trusting this figure.'
FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'USD' AND pocket = 'RESERVE'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:personal-dolarize-usd');

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 33.16, '2026-09-03', 'SELF_REPORTED', 'self-reported:2026-09-03:personal-dolarize-brl', 'Typed by operator in Reality Reconciliation brief. No source statement attached -- verify against the real Wise app before trusting this figure.'
FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'BRL' AND pocket = 'RESERVE'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:personal-dolarize-brl');

-- ============================================================================
-- SECTION 2 -- COMPANY (RMEDIA) CASH POCKETS (Sep 3, 2026, SELF-REPORTED)
-- ----------------------------------------------------------------------------
-- The three company pockets (BRL main, USD main, USD reserve) already exist
-- and were properly Wise-reconciled as of 2026-08-31 (0 difference against
-- the real Wise PDF import). These rows add a NEW self-reported observation
-- three days later -- they do NOT overwrite or delete the Aug 31 WISE_PDF
-- snapshot, so both remain visible and the app's own difference/drift
-- tracking keeps working. This is provisional evidence, same caveat as
-- Section 1: no Sep 3 Wise statement was attached, so this is your own typed
-- figure, not a bank fact. The USD reserve pocket moving 300.00 -> 200.00
-- between Aug 31 and Sep 3 is NOT explained by anything in the two journals
-- reviewed for this round -- flagged in the report as needing your own check
-- before you treat it as correct.
-- ============================================================================

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 83.73, '2026-09-03', 'SELF_REPORTED', 'self-reported:2026-09-03:business-brl-main', 'Typed by operator in Reality Reconciliation brief, 3 days after the last Wise-confirmed observation (R$995.50 on 2026-08-31). No Sep 3 statement attached -- large drop is plausible given tracked spend but not verified against a bank source.'
FROM cash_accounts WHERE scope = 'BUSINESS' AND currency = 'BRL' AND pocket = 'MAIN'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:business-brl-main');

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 21.52, '2026-09-03', 'SELF_REPORTED', 'self-reported:2026-09-03:business-usd-main', 'Typed by operator in Reality Reconciliation brief, 3 days after the last Wise-confirmed observation ($128.85 on 2026-08-31). No Sep 3 statement attached.'
FROM cash_accounts WHERE scope = 'BUSINESS' AND currency = 'USD' AND pocket = 'MAIN'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:business-usd-main');

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 200.00, '2026-09-03', 'SELF_REPORTED', 'self-reported:2026-09-03:business-usd-reserve', 'Typed by operator in Reality Reconciliation brief. UNEXPLAINED $100 drop from the Aug 31 Wise-confirmed $300.00 -- neither journal reviewed this round mentions a reserve withdrawal. Verify before trusting.'
FROM cash_accounts WHERE scope = 'BUSINESS' AND currency = 'USD' AND pocket = 'RESERVE'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:business-usd-reserve');

-- ============================================================================
-- SECTION 3 -- SEP 2 TARYN RECONSTRUCTION (JOURNAL EVIDENCE)
-- ----------------------------------------------------------------------------
-- PENDING USER VERIFICATION: this environment has no access to your live
-- Work Session Ledger, so it is UNKNOWN whether this interval is already
-- captured by the Sensor or a WEB_TIMER session. Check the Ledger for Sep 2,
-- 02:15-04:36 (America/Sao_Paulo) on the Taryn "MINI SERIES" Video 1 before
-- running this. The overlap guard below is a second line of defense, not a
-- substitute for checking yourself -- it only protects against an EXACT
-- video-id match; if a differently-named/duplicate video row holds the same
-- real session it will not be caught.
--
-- Evidence: Quartaste.pdf (Sep 2, 2026 journal), entries 02h15-04h36:
-- reference review, graphics/animation screen (After Effects), text
-- animation, auto-caption pass, text support pass, screen positioning,
-- Frame.io prep. Confidence: HIGH (dense, specific, contemporaneous log --
-- but still hand-timestamped prose, not machine telemetry).
-- ============================================================================

INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note, source, confidence, source_reference, created_at)
SELECT
  v.id,
  strftime('%s', '2026-09-02T02:15:00-03:00'),
  strftime('%s', '2026-09-02T04:36:00-03:00'),
  'EDITING',
  'Reconstructed from Quartaste? journal (Sep 2, 2026): reference review, graphics/animation screen build (After Effects), text animation, auto-caption + text-support pass, screen positioning, Frame.io preview prep. Journal explicitly marks end of this session at 04:36 ("Fim da sessao da Taryn").',
  'JOURNAL_RECONSTRUCTION',
  'HIGH',
  'Quartaste.pdf (Sep 2 2026 operational journal), entries 02h15-04h36',
  unixepoch()
FROM video_logs v
JOIN clients c ON v.client_id = c.id
LEFT JOIN projects p ON v.project_id = p.id
WHERE c.name = 'Taryn Dubreuil'
  AND (p.name IS NULL OR p.name LIKE '%MINI SERIES%')
  AND v.title LIKE '%Video 1%'
  AND NOT EXISTS (
    SELECT 1 FROM work_sessions ws
    WHERE ws.video_id = v.id
      AND ws.started_at < strftime('%s', '2026-09-02T04:36:00-03:00')
      AND (ws.ended_at IS NULL OR ws.ended_at > strftime('%s', '2026-09-02T02:15:00-03:00'))
  )
LIMIT 1;

-- ============================================================================
-- SECTION 4 -- WHAT THIS FILE DELIBERATELY DOES NOT DO
-- ----------------------------------------------------------------------------
-- - No Sep 3 Taryn session is inserted. You already corrected Work Session
--   #41 yourself, live, in the app on Sep 3 (16:35-18:33). See the final
--   report for a note on the ~57-minute gap between that correction and the
--   journal's fuller 15:38-18:27 account, offered as an optional follow-up,
--   not auto-applied here.
-- - No Dave DeMink work_session, project, or video is touched, corrected, or
--   created by this file, per your explicit instruction to handle Dave's
--   time/billing manually yourself.
-- - No equipment/tech purchase (Amazon ~R$300, DDR3+HDD R$150, Terabyte
--   Gabinete+PSU+teclado/mouse R$140.39) is inserted as a transaction here.
--   Ownership (personal/family vs RMEDIA) is genuinely ambiguous from the
--   journal -- see the NEEDS_REVIEW list in the final report. Classifying
--   these is a judgment call only you can make.
