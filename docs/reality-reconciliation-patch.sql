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
--
-- ============================================================================
-- EVIDENCE CORRECTION (this revision)
-- ----------------------------------------------------------------------------
-- The prior revision of this file tagged the Sep 3, 2026 balances below as
-- SELF_REPORTED because no Wise statement for that period had been found in
-- what was searched at the time. That was wrong -- not because the prior
-- search was dishonest, but because it was incomplete: the seven real Wise
-- PDF statements (1-3 Sep 2026) live in two folders on the Desktop --
-- "biz-statement_2026-09-01_2026-09-03_pdf/" (3 files: BUSINESS USD
-- operating, BUSINESS BRL operating, BUSINESS USD Savings) and
-- "persona-statement_2026-09-01_2026-09-03_pdf/" (4 files: PERSONAL BRL
-- main, PERSONAL USD main, PERSONAL 'Dolarize' USD, PERSONAL 'Dolarize'
-- BRL) -- not in the Desktop/uploads locations checked previously, and not
-- named with "wise" anywhere in the filename. Every one of these seven PDFs
-- is a genuine Wise-issued statement (Wise Payments Ltd / Wise Brasil
-- letterhead, "Generated on: 3 September 2026", a `ref:` UUID footer, and
-- real Wise transaction IDs), read in full this round. All seven closing
-- balances below were copied verbatim from those statements' own
-- "<currency> on 3 September 2026 [GMT-03:00]: <amount>" lines -- not
-- retyped from the correction brief. They are tagged WISE_PDF, the same
-- provenance value already used for the real Aug 31, 2026 business-pocket
-- reconciliation, per "do not invent a new provenance enum" -- WISE_PDF was
-- already the established value for this exact evidence tier (see
-- src/modules/cash-accounts/core.test.mjs), so this file reuses it rather
-- than adding WISE_CSV/FINANCIAL_STATEMENT/anything new. See
-- docs/architecture/REALITY_RECONCILIATION_SEP2026.md for the full
-- per-pocket citation (statement filename, account number, and the exact
-- line copied).
--
-- Because nothing in this file was ever applied to any real database
-- (no wrangler credentials in this environment, and the prior revision
-- shipped as review-only), Sections 1 and 2 below simply insert the correct
-- WISE_PDF snapshots directly. They also include a defensive DELETE of the
-- old SELF_REPORTED rows/identities by exact external_id/source, in case you
-- ran the prior revision by hand before this correction reached you --
-- those DELETEs affect 0 rows (and are a no-op) if you never did.
-- ============================================================================

-- ============================================================================
-- SECTION 1 -- PERSONAL CASH POCKETS (Sep 3, 2026, WISE-STATEMENT VERIFIED)
-- ----------------------------------------------------------------------------
-- Source: persona-statement_2026-09-01_2026-09-03_pdf/ (4 files). Each
-- external_account_id below is Wise's own numeric balance id, taken from the
-- statement filename and confirmed against the account header inside each
-- PDF -- the same id Wise used for these four pockets' Aug 2-30 CSV exports,
-- so it is a stable identity across both evidence sets, not something this
-- round invented.
-- ============================================================================

-- 1a. Ensure the four personal pockets exist (create only if missing), with
-- their real Wise external identity -- not the SELF_REPORTED placeholder ids
-- the prior revision used.
INSERT INTO cash_accounts (scope, currency, pocket, label, external_source, external_account_id, opening_balance, opening_as_of, active)
SELECT 'PERSONAL', 'BRL', 'MAIN', 'Personal BRL', 'WISE', '44840079', 0, '2026-09-03', 1
WHERE NOT EXISTS (
  SELECT 1 FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'BRL' AND pocket = 'MAIN'
);

INSERT INTO cash_accounts (scope, currency, pocket, label, external_source, external_account_id, opening_balance, opening_as_of, active)
SELECT 'PERSONAL', 'USD', 'MAIN', 'Personal USD', 'WISE', '45837980', 0, '2026-09-03', 1
WHERE NOT EXISTS (
  SELECT 1 FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'USD' AND pocket = 'MAIN'
);

INSERT INTO cash_accounts (scope, currency, pocket, label, external_source, external_account_id, opening_balance, opening_as_of, active)
SELECT 'PERSONAL', 'USD', 'RESERVE', 'Personal Dolarize (USD)', 'WISE', '95876029', 0, '2026-09-03', 1
WHERE NOT EXISTS (
  SELECT 1 FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'USD' AND pocket = 'RESERVE'
);

INSERT INTO cash_accounts (scope, currency, pocket, label, external_source, external_account_id, opening_balance, opening_as_of, active)
SELECT 'PERSONAL', 'BRL', 'RESERVE', 'Personal Dolarize (BRL)', 'WISE', '171018409', 0, '2026-09-03', 1
WHERE NOT EXISTS (
  SELECT 1 FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'BRL' AND pocket = 'RESERVE'
);

-- 1a-fix. If the prior revision's SELF_REPORTED placeholder identity was
-- ever actually written (this environment never wrote it, but you may have
-- applied that revision by hand), correct it to the real Wise identity.
-- No-op (0 rows) if that never happened.
UPDATE cash_accounts SET external_source = 'WISE', external_account_id = '44840079'
WHERE scope = 'PERSONAL' AND currency = 'BRL' AND pocket = 'MAIN' AND external_source = 'SELF_REPORTED';

UPDATE cash_accounts SET external_source = 'WISE', external_account_id = '45837980'
WHERE scope = 'PERSONAL' AND currency = 'USD' AND pocket = 'MAIN' AND external_source = 'SELF_REPORTED';

UPDATE cash_accounts SET external_source = 'WISE', external_account_id = '95876029'
WHERE scope = 'PERSONAL' AND currency = 'USD' AND pocket = 'RESERVE' AND external_source = 'SELF_REPORTED';

UPDATE cash_accounts SET external_source = 'WISE', external_account_id = '171018409'
WHERE scope = 'PERSONAL' AND currency = 'BRL' AND pocket = 'RESERVE' AND external_source = 'SELF_REPORTED';

-- 1b. Remove the prior revision's SELF_REPORTED Sep 3 snapshots by their
-- exact external_id, if present. 0 rows affected if you never applied that
-- revision.
DELETE FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:personal-brl';
DELETE FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:personal-usd';
DELETE FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:personal-dolarize-usd';
DELETE FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:personal-dolarize-brl';

-- 1c. Record the Wise-statement-verified Sep 3 balances as WISE_PDF
-- snapshots. external_id makes this idempotent: re-running never inserts a
-- second copy of the same statement observation.
INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 2.60, '2026-09-03', 'WISE_PDF', 'wise-pdf:2026-09-03:44840079', 'statement_44840079_BRL_2026-09-01_2026-09-03.pdf, closing line "BRL on 3 September 2026 [GMT-03:00]: 2.60 BRL". Account holder Emmanuel da Rosa Dillenburg, account number 3501729.'
FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'BRL' AND pocket = 'MAIN'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'wise-pdf:2026-09-03:44840079');

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 2.72, '2026-09-03', 'WISE_PDF', 'wise-pdf:2026-09-03:45837980', 'statement_45837980_USD_2026-09-01_2026-09-03.pdf, closing line "USD on 3 September 2026 [GMT-03:00]: 2.72 USD". Account number 8312668042, routing 026073150.'
FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'USD' AND pocket = 'MAIN'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'wise-pdf:2026-09-03:45837980');

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 50.00, '2026-09-03', 'WISE_PDF', 'wise-pdf:2026-09-03:95876029', 'statement_95876029_USD_2026-09-01_2026-09-03.pdf ("''Dolarize'' USD statement"), closing line "''Dolarize'' USD on 3 September 2026 [GMT-03:00]: 50.00 USD". No transactions in the 1-3 Sep window -- balance carried flat from the opening figure.'
FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'USD' AND pocket = 'RESERVE'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'wise-pdf:2026-09-03:95876029');

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 33.16, '2026-09-03', 'WISE_PDF', 'wise-pdf:2026-09-03:171018409', 'statement_171018409_BRL_2026-09-01_2026-09-03.pdf ("''Dolarize'' BRL statement"), closing line "''Dolarize'' BRL on 3 September 2026 [GMT-03:00]: 33.16 BRL". No transactions in the 1-3 Sep window -- matches the same flat balance already seen in the Aug 2-30 CSV export for this account (only activity there: 26-08-2026, a 33.16 BRL top-up).'
FROM cash_accounts WHERE scope = 'PERSONAL' AND currency = 'BRL' AND pocket = 'RESERVE'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'wise-pdf:2026-09-03:171018409');

-- ============================================================================
-- SECTION 2 -- COMPANY (RMEDIA) CASH POCKETS (Sep 3, 2026, WISE-STATEMENT VERIFIED)
-- ----------------------------------------------------------------------------
-- Source: biz-statement_2026-09-01_2026-09-03_pdf/ (3 files). The three
-- company pockets already exist (created during the Aug 31, 2026
-- reconciliation) so this section only touches cash_account_snapshots, not
-- cash_accounts.
-- ============================================================================

-- 2a. Remove the prior revision's SELF_REPORTED Sep 3 snapshots by their
-- exact external_id, if present. 0 rows affected if you never applied that
-- revision.
DELETE FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:business-brl-main';
DELETE FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:business-usd-main';
DELETE FROM cash_account_snapshots WHERE external_id = 'self-reported:2026-09-03:business-usd-reserve';

-- 2b. Record the Wise-statement-verified Sep 3 balances as WISE_PDF
-- snapshots, same idempotency pattern as Section 1c.
INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 83.73, '2026-09-03', 'WISE_PDF', 'wise-pdf:2026-09-03:168497359', 'statement_168497359_BRL_2026-09-01_2026-09-03.pdf, closing line "BRL on 3 September 2026 [GMT-03:00]: 83.73 BRL". Includes a -140.39 BRL "Sent money to Emmanuel da Rosa Dillenburg" line on 3 Sep matching the Terabyte.com.br boleto (pedido 8354209) described in the Sep 3 journal.'
FROM cash_accounts WHERE scope = 'BUSINESS' AND currency = 'BRL' AND pocket = 'MAIN'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'wise-pdf:2026-09-03:168497359');

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 21.52, '2026-09-03', 'WISE_PDF', 'wise-pdf:2026-09-03:118287732', 'statement_118287732_USD_2026-09-01_2026-09-03.pdf, closing line "USD on 3 September 2026 [GMT-03:00]: 21.52 USD". Includes the +100.00 USD "Moved 100.00 USD from Savings" line (Transaction: BALANCE-6001326761) -- see Section 2c for the matching Savings-side entry; this is an internal transfer, not income.'
FROM cash_accounts WHERE scope = 'BUSINESS' AND currency = 'USD' AND pocket = 'MAIN'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'wise-pdf:2026-09-03:118287732');

INSERT INTO cash_account_snapshots (cash_account_id, balance_amount, observed_at, source, external_id, notes)
SELECT id, 200.00, '2026-09-03', 'WISE_PDF', 'wise-pdf:2026-09-03:171067558', 'statement_171067558_USD_2026-09-01_2026-09-03.pdf (''Savings'' USD statement), closing line "''Savings'' USD on 3 September 2026 [GMT-03:00]: 200.00 USD". The only transaction in the window is "Moved 100.00 USD to USD" -100.00 (Transaction: BALANCE-6001326761), i.e. 300.00 opening -> 200.00 closing. This is the SAME transfer as the +100.00 credit on the USD operating statement above (matching Wise transaction id both sides) -- an internal transfer between two company pockets, not a withdrawal, not expense, not a mystery. Previously reported as "unexplained"; that is now resolved.'
FROM cash_accounts WHERE scope = 'BUSINESS' AND currency = 'USD' AND pocket = 'RESERVE'
AND NOT EXISTS (SELECT 1 FROM cash_account_snapshots WHERE external_id = 'wise-pdf:2026-09-03:171067558');

-- 2c. Record the Savings -> Operating internal transfer itself as two
-- matched cash_movements rows, using Wise's own transaction id
-- (BALANCE-6001326761) as the dedupe key on both sides -- the same
-- INTERNAL_TRANSFER pattern already used by recordInternalPocketTransfer()
-- and asserted never to touch transactions/personal_transactions in
-- src/modules/cash-accounts/wise-identity.integration.test.mjs. This is
-- what keeps the two statement lines ("Moved 100.00 USD from Savings" /
-- "Moved 100.00 USD to USD") from ever being read as two unrelated $100
-- events instead of one transfer.
INSERT INTO cash_movements (cash_account_id, date, occurred_at, amount, state, description, counterparty, external_source, external_id)
SELECT id, '2026-09-03', '2026-09-03T00:00:00-03:00', 100.00, 'INTERNAL_TRANSFER', 'Moved 100.00 USD from Savings', 'RMEDIA USD Savings/Reserve', 'WISE', 'BALANCE-6001326761'
FROM cash_accounts WHERE scope = 'BUSINESS' AND currency = 'USD' AND pocket = 'MAIN'
AND NOT EXISTS (
  SELECT 1 FROM cash_movements
  WHERE cash_account_id = (SELECT id FROM cash_accounts WHERE scope = 'BUSINESS' AND currency = 'USD' AND pocket = 'MAIN')
    AND external_source = 'WISE' AND external_id = 'BALANCE-6001326761'
);

INSERT INTO cash_movements (cash_account_id, date, occurred_at, amount, state, description, counterparty, external_source, external_id)
SELECT id, '2026-09-03', '2026-09-03T00:00:00-03:00', -100.00, 'INTERNAL_TRANSFER', 'Moved 100.00 USD to USD (operating)', 'RMEDIA USD operating', 'WISE', 'BALANCE-6001326761'
FROM cash_accounts WHERE scope = 'BUSINESS' AND currency = 'USD' AND pocket = 'RESERVE'
AND NOT EXISTS (
  SELECT 1 FROM cash_movements
  WHERE cash_account_id = (SELECT id FROM cash_accounts WHERE scope = 'BUSINESS' AND currency = 'USD' AND pocket = 'RESERVE')
    AND external_source = 'WISE' AND external_id = 'BALANCE-6001326761'
);

-- ============================================================================
-- SECTION 3 -- SEP 2 TARYN RECONSTRUCTION (JOURNAL EVIDENCE)
-- ----------------------------------------------------------------------------
-- Unchanged by this correction round. PENDING USER VERIFICATION: this
-- environment has no access to your live Work Session Ledger, so it is
-- UNKNOWN whether this interval is already captured by the Sensor or a
-- WEB_TIMER session. Check the Ledger for Sep 2, 02:15-04:36
-- (America/Sao_Paulo) on the Taryn "MINI SERIES" Video 1 before running
-- this. The overlap guard below is a second line of defense, not a
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
--   these is a judgment call only you can make. (Note: the Terabyte
--   R$140.39 boleto DOES appear as a real, dated cash movement on the
--   company BRL operating Wise statement itself on 3 Sep -- see Section 2b's
--   note -- confirming it was paid from the RMEDIA pocket. That is a fact
--   about which account the money left, not a classification of whether the
--   purchase itself is a legitimate RMEDIA business expense; still your
--   call.)
-- - No other line item from the seven Sep 1-3 Wise statements (card
--   purchases, ordinary transfers, FX conversions other than the one tied to
--   the Savings/operating transfer above) is imported as a cash_movement or
--   transaction here. That would be a full ledger-import feature; this round
--   only corrects the seven closing-balance snapshots and the one internal
--   transfer the correction brief specifically asked about.
