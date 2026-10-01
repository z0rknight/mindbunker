-- September 2026 final close: Taryn / Upwork reconciliation.
-- Evidence: operator confirmation, five Upwork screenshots, and exact Wise identities.
-- Intentionally does not assert a one-to-one Upwork-week -> Wise-payout mapping.

-- Complete the already-present Sep 7-13 weekly report with its verified posting date.
UPDATE billing_evidence
SET external_reference='Upwork transaction Added 2026-09-18',
    earning_date='2026-09-18',
    idempotency_key='1::2026-09-07::2026-09-13::UPWORK_REPORT::Upwork transaction Added 2026-09-18'
WHERE id=8
  AND contract_id=1
  AND period_start='2026-09-07'
  AND period_end='2026-09-13'
  AND billable_minutes=400
  AND rate=25
  AND gross_amount=166.67
  AND currency='USD'
  AND source='UPWORK_REPORT'
  AND (external_reference!='Upwork transaction Added 2026-09-18'
       OR earning_date IS NOT '2026-09-18'
       OR idempotency_key!='1::2026-09-07::2026-09-13::UPWORK_REPORT::Upwork transaction Added 2026-09-18');

-- Append the three weekly Work Diary facts not previously present.
INSERT INTO billing_evidence
  (contract_id,period_start,period_end,billable_minutes,rate,gross_amount,currency,source,external_reference,earning_date,idempotency_key,imported_at)
SELECT 1,'2026-09-14','2026-09-20',440,25,183.33,'USD','UPWORK_REPORT',
       'Upwork transaction Added 2026-09-25','2026-09-25',
       '1::2026-09-14::2026-09-20::UPWORK_REPORT::Upwork transaction Added 2026-09-25',unixepoch()
WHERE NOT EXISTS (
  SELECT 1 FROM billing_evidence
  WHERE idempotency_key='1::2026-09-14::2026-09-20::UPWORK_REPORT::Upwork transaction Added 2026-09-25'
);

INSERT INTO billing_evidence
  (contract_id,period_start,period_end,billable_minutes,rate,gross_amount,currency,source,external_reference,earning_date,idempotency_key,imported_at)
SELECT 1,'2026-09-21','2026-09-27',0,25,0,'USD','UPWORK_REPORT',
       'Upwork Work Diary Sep 21-27 — verified zero hours',NULL,
       '1::2026-09-21::2026-09-27::UPWORK_REPORT::verified-zero-hours',unixepoch()
WHERE NOT EXISTS (
  SELECT 1 FROM billing_evidence
  WHERE idempotency_key='1::2026-09-21::2026-09-27::UPWORK_REPORT::verified-zero-hours'
);

INSERT INTO billing_evidence
  (contract_id,period_start,period_end,billable_minutes,rate,gross_amount,currency,source,external_reference,earning_date,idempotency_key,imported_at)
SELECT 1,'2026-09-28','2026-10-04',820,25,341.67,'USD','UPWORK_REPORT',
       'Upwork Work Diary Sep 28-Oct 4 — includes 180 minutes on Oct 1 outside September',NULL,
       '1::2026-09-28::2026-10-04::UPWORK_REPORT::work-diary-820-minutes',unixepoch()
WHERE NOT EXISTS (
  SELECT 1 FROM billing_evidence
  WHERE idempotency_key='1::2026-09-28::2026-10-04::UPWORK_REPORT::work-diary-820-minutes'
);

-- Service fees remain their own source facts; they are not cash transactions.
INSERT INTO platform_fees(billing_evidence_id,amount,currency,occurred_at,source,notes,created_at)
SELECT id,12.50,'USD','2026-09-04','UPWORK_REPORT',
       'UPWORK_TX_2026-09-04_SERVICE_FEE — screenshot-verified posted service fee',unixepoch()
FROM billing_evidence be
WHERE be.contract_id=1 AND be.earning_date='2026-09-04' AND be.gross_amount=125
  AND NOT EXISTS (
    SELECT 1 FROM platform_fees pf
    WHERE pf.billing_evidence_id=be.id AND pf.amount=12.50 AND pf.currency='USD'
      AND pf.occurred_at='2026-09-04' AND pf.notes LIKE 'UPWORK_TX_2026-09-04_SERVICE_FEE%'
  );

INSERT INTO platform_fees(billing_evidence_id,amount,currency,occurred_at,source,notes,created_at)
SELECT id,25.42,'USD','2026-09-11','UPWORK_REPORT',
       'UPWORK_TX_2026-09-11_SERVICE_FEE — screenshot-verified posted service fee',unixepoch()
FROM billing_evidence be
WHERE be.contract_id=1 AND be.earning_date='2026-09-11' AND be.gross_amount=254.17
  AND NOT EXISTS (
    SELECT 1 FROM platform_fees pf
    WHERE pf.billing_evidence_id=be.id AND pf.amount=25.42 AND pf.currency='USD'
      AND pf.occurred_at='2026-09-11' AND pf.notes LIKE 'UPWORK_TX_2026-09-11_SERVICE_FEE%'
  );

INSERT INTO platform_fees(billing_evidence_id,amount,currency,occurred_at,source,notes,created_at)
SELECT id,16.67,'USD','2026-09-18','UPWORK_REPORT',
       'UPWORK_TX_2026-09-18_SERVICE_FEE — screenshot-verified posted service fee',unixepoch()
FROM billing_evidence be
WHERE be.contract_id=1 AND be.earning_date='2026-09-18' AND be.gross_amount=166.67
  AND NOT EXISTS (
    SELECT 1 FROM platform_fees pf
    WHERE pf.billing_evidence_id=be.id AND pf.amount=16.67 AND pf.currency='USD'
      AND pf.occurred_at='2026-09-18' AND pf.notes LIKE 'UPWORK_TX_2026-09-18_SERVICE_FEE%'
  );

INSERT INTO platform_fees(billing_evidence_id,amount,currency,occurred_at,source,notes,created_at)
SELECT id,18.33,'USD','2026-09-25','UPWORK_REPORT',
       'UPWORK_TX_2026-09-25_SERVICE_FEE — screenshot-verified posted service fee',unixepoch()
FROM billing_evidence be
WHERE be.contract_id=1 AND be.earning_date='2026-09-25' AND be.gross_amount=183.33
  AND NOT EXISTS (
    SELECT 1 FROM platform_fees pf
    WHERE pf.billing_evidence_id=be.id AND pf.amount=18.33 AND pf.currency='USD'
      AND pf.occurred_at='2026-09-25' AND pf.notes LIKE 'UPWORK_TX_2026-09-25_SERVICE_FEE%'
  );

-- Aggregate reconciliation. Exact weekly payout mapping and gap cause remain unasserted.
INSERT INTO reconciliation_notes(contract_id,date,note,video_id,created_at)
SELECT 1,'2026-09-30',
       'UPWORK_SEPTEMBER_2026_RECONCILIATION — work-date 2020 min / USD 841.67 gross value; September-posted gross USD 729.17; service fees USD 72.92; net platform value USD 656.25; Wise cash USD 644.29; settlement gap USD 11.96. Operator confirms all period Upwork commercial earnings belong to Taryn. Exact Upwork-week to Wise-payout mapping and gap cause are not asserted. Date-level comparison to MindBunker: maximum compatible same-date overlap 1600.788 min; Upwork excess 419.212 min; MindBunker excess 430.632 min; exact interval overlap unavailable.',
       NULL,unixepoch()
WHERE NOT EXISTS (
  SELECT 1 FROM reconciliation_notes
  WHERE contract_id=1 AND date='2026-09-30'
    AND note LIKE 'UPWORK_SEPTEMBER_2026_RECONCILIATION%'
);

-- Four exact Wise receipts become Taryn/Upwork settlements at client level only.
-- Original notes are retained as prior-state custody evidence.
UPDATE transactions
SET category='Upwork settlement',client_id=2,contract_id=1,
    notes=COALESCE(notes || ' | ','') ||
      'TARYN_UPWORK_SEPTEMBER_2026 — aggregate client attribution confirmed by operator; prior unattributed state superseded; exact Upwork week to Wise payout mapping not asserted'
WHERE id=21 AND date='2026-09-08' AND amount=109.51 AND currency='USD'
  AND external_source='WISE' AND external_id='TRANSFER-2359165993'
  AND (category!='Upwork settlement' OR client_id IS NOT 2 OR contract_id IS NOT 1
       OR COALESCE(notes,'') NOT LIKE '%TARYN_UPWORK_SEPTEMBER_2026%');

UPDATE transactions
SET category='Upwork settlement',client_id=2,contract_id=1,
    notes=COALESCE(notes || ' | ','') ||
      'TARYN_UPWORK_SEPTEMBER_2026 — aggregate client attribution confirmed by operator; prior unattributed state superseded; exact Upwork week to Wise payout mapping not asserted'
WHERE id=22 AND date='2026-09-14' AND amount=225.76 AND currency='USD'
  AND external_source='WISE' AND external_id='TRANSFER-2370743937'
  AND (category!='Upwork settlement' OR client_id IS NOT 2 OR contract_id IS NOT 1
       OR COALESCE(notes,'') NOT LIKE '%TARYN_UPWORK_SEPTEMBER_2026%');

UPDATE transactions
SET category='Upwork settlement',client_id=2,contract_id=1,
    notes=COALESCE(notes || ' | ','') ||
      'TARYN_UPWORK_SEPTEMBER_2026 — aggregate client attribution confirmed by operator; prior unattributed state superseded; exact Upwork week to Wise payout mapping not asserted'
WHERE id=23 AND date='2026-09-22' AND amount=147.01 AND currency='USD'
  AND external_source='WISE' AND external_id='TRANSFER-2386078149'
  AND (category!='Upwork settlement' OR client_id IS NOT 2 OR contract_id IS NOT 1
       OR COALESCE(notes,'') NOT LIKE '%TARYN_UPWORK_SEPTEMBER_2026%');

UPDATE transactions
SET category='Upwork settlement',client_id=2,contract_id=1,
    notes=COALESCE(notes || ' | ','') ||
      'TARYN_UPWORK_SEPTEMBER_2026 — aggregate client attribution confirmed by operator; prior unattributed state superseded; exact Upwork week to Wise payout mapping not asserted'
WHERE id=24 AND date='2026-09-29' AND amount=162.01 AND currency='USD'
  AND external_source='WISE' AND external_id='TRANSFER-2399609176'
  AND (category!='Upwork settlement' OR client_id IS NOT 2 OR contract_id IS NOT 1
       OR COALESCE(notes,'') NOT LIKE '%TARYN_UPWORK_SEPTEMBER_2026%');

UPDATE cash_movements SET state='RECONCILED'
WHERE id=219 AND cash_account_id=4 AND date='2026-09-08' AND amount=109.51
  AND external_source='WISE' AND external_id='TRANSFER-2359165993' AND state='AMBIGUOUS';
UPDATE cash_movements SET state='RECONCILED'
WHERE id=260 AND cash_account_id=4 AND date='2026-09-14' AND amount=225.76
  AND external_source='WISE' AND external_id='TRANSFER-2370743937' AND state='AMBIGUOUS';
UPDATE cash_movements SET state='RECONCILED'
WHERE id=295 AND cash_account_id=4 AND date='2026-09-22' AND amount=147.01
  AND external_source='WISE' AND external_id='TRANSFER-2386078149' AND state='AMBIGUOUS';
UPDATE cash_movements SET state='RECONCILED'
WHERE id=327 AND cash_account_id=4 AND date='2026-09-29' AND amount=162.01
  AND external_source='WISE' AND external_id='TRANSFER-2399609176' AND state='AMBIGUOUS';

-- Custody repair: preserve the exact note that the earlier pass replaced on transaction 19.
UPDATE transactions
SET notes=COALESCE(notes || ' | ','') ||
  'PRIOR_NOTE_PRESERVED — Mercado, Cigarro de Artista e Gás Geral pra produção que vai vir'
WHERE id=19 AND external_source='WISE' AND external_id='TRANSFER-2361264293'
  AND COALESCE(notes,'') NOT LIKE '%PRIOR_NOTE_PRESERVED%';
