-- September 2026 human-input closure.
-- Idempotent, bounded to the seven operator-classified Wise movements and
-- four operator-confirmed Upwork withdrawal fees. Source cash evidence is
-- preserved; derived transactions retain the prior AMBIGUOUS classification.
PRAGMA foreign_keys=ON;

INSERT INTO transactions(
  type,amount,category,date,notes,currency,created_at,
  idempotency_key,external_source,external_id
)
SELECT
  'expense',150.00,'Equipment / Upgrade','2026-09-03',
  'HUMAN_CLASSIFICATION_2026-10-01 actor=operator; BUSINESS OPERATING; Compra de um HDD de 500GB e 2 pentes de RAM 4GB DDR3; prior cash classification=AMBIGUOUS',
  'BRL',unixepoch(),'sep2026-human:TRANSFER-2349804943','WISE','TRANSFER-2349804943'
WHERE EXISTS (
  SELECT 1 FROM cash_movements cm JOIN cash_accounts ca ON ca.id=cm.cash_account_id
  WHERE cm.external_source='WISE' AND cm.external_id='TRANSFER-2349804943'
    AND cm.date='2026-09-03' AND cm.amount=-150.00
    AND ca.scope='BUSINESS' AND ca.currency='BRL'
)
AND NOT EXISTS (
  SELECT 1 FROM transactions WHERE external_source='WISE' AND external_id='TRANSFER-2349804943'
);

INSERT INTO transactions(
  type,amount,category,date,notes,currency,created_at,
  idempotency_key,external_source,external_id
)
SELECT
  'expense',74.00,'Software / Editing','2026-09-05',
  'HUMAN_CLASSIFICATION_2026-10-01 actor=operator; BUSINESS OPERATING; Legendas para Premiere; prior cash classification=AMBIGUOUS',
  'BRL',unixepoch(),'sep2026-human:CARD-4292473562','WISE','CARD-4292473562'
WHERE EXISTS (
  SELECT 1 FROM cash_movements cm JOIN cash_accounts ca ON ca.id=cm.cash_account_id
  WHERE cm.external_source='WISE' AND cm.external_id='CARD-4292473562'
    AND cm.date='2026-09-05' AND cm.amount=-74.00
    AND ca.scope='BUSINESS' AND ca.currency='BRL'
)
AND NOT EXISTS (
  SELECT 1 FROM transactions WHERE external_source='WISE' AND external_id='CARD-4292473562'
);

INSERT INTO transactions(
  type,amount,category,date,notes,currency,created_at,
  idempotency_key,external_source,external_id
)
SELECT
  'expense',99.55,'Operating Meals','2026-09-08',
  'HUMAN_CLASSIFICATION_2026-10-01 actor=operator; BUSINESS OPERATING; Comidas rápidas para dias de alta operação/demanda; prior cash classification=AMBIGUOUS',
  'BRL',unixepoch(),'sep2026-human:CARD-4303469528','WISE','CARD-4303469528'
WHERE EXISTS (
  SELECT 1 FROM cash_movements cm JOIN cash_accounts ca ON ca.id=cm.cash_account_id
  WHERE cm.external_source='WISE' AND cm.external_id='CARD-4303469528'
    AND cm.date='2026-09-08' AND cm.amount=-99.55
    AND ca.scope='BUSINESS' AND ca.currency='BRL'
)
AND NOT EXISTS (
  SELECT 1 FROM transactions WHERE external_source='WISE' AND external_id='CARD-4303469528'
);

INSERT INTO transactions(
  type,amount,category,date,notes,currency,created_at,
  idempotency_key,external_source,external_id
)
SELECT
  'owner_pay',12.90,'Personal','2026-09-13',
  'HUMAN_CLASSIFICATION_2026-10-01 actor=operator; PERSONAL; Clube iFood / assinatura de descontos e pontos Decolar; economic treatment=owner/personal draw from business pocket; prior cash classification=AMBIGUOUS',
  'BRL',unixepoch(),'sep2026-human:CARD-4326873397','WISE','CARD-4326873397'
WHERE EXISTS (
  SELECT 1 FROM cash_movements cm JOIN cash_accounts ca ON ca.id=cm.cash_account_id
  WHERE cm.external_source='WISE' AND cm.external_id='CARD-4326873397'
    AND cm.date='2026-09-13' AND cm.amount=-12.90
    AND ca.scope='BUSINESS' AND ca.currency='BRL'
)
AND NOT EXISTS (
  SELECT 1 FROM transactions WHERE external_source='WISE' AND external_id='CARD-4326873397'
);

INSERT INTO transactions(
  type,amount,category,date,notes,currency,created_at,
  idempotency_key,external_source,external_id
)
SELECT
  'expense',68.81,'Operating Meals','2026-09-13',
  'HUMAN_CLASSIFICATION_2026-10-01 actor=operator; BUSINESS OPERATING; Comidas rápidas para dias de alta operação/demanda; prior cash classification=AMBIGUOUS',
  'BRL',unixepoch(),'sep2026-human:CARD-4326876305','WISE','CARD-4326876305'
WHERE EXISTS (
  SELECT 1 FROM cash_movements cm JOIN cash_accounts ca ON ca.id=cm.cash_account_id
  WHERE cm.external_source='WISE' AND cm.external_id='CARD-4326876305'
    AND cm.date='2026-09-13' AND cm.amount=-68.81
    AND ca.scope='BUSINESS' AND ca.currency='BRL'
)
AND NOT EXISTS (
  SELECT 1 FROM transactions WHERE external_source='WISE' AND external_id='CARD-4326876305'
);

INSERT INTO transactions(
  type,amount,category,date,notes,currency,created_at,
  idempotency_key,external_source,external_id
)
SELECT
  'expense',211.08,'Operating Meals','2026-09-13',
  'HUMAN_CLASSIFICATION_2026-10-01 actor=operator; BUSINESS OPERATING; Comidas rápidas para dias de alta operação/demanda; prior cash classification=AMBIGUOUS',
  'BRL',unixepoch(),'sep2026-human:TRANSFER-2369452438','WISE','TRANSFER-2369452438'
WHERE EXISTS (
  SELECT 1 FROM cash_movements cm JOIN cash_accounts ca ON ca.id=cm.cash_account_id
  WHERE cm.external_source='WISE' AND cm.external_id='TRANSFER-2369452438'
    AND cm.date='2026-09-13' AND cm.amount=-211.08
    AND ca.scope='BUSINESS' AND ca.currency='BRL'
)
AND NOT EXISTS (
  SELECT 1 FROM transactions WHERE external_source='WISE' AND external_id='TRANSFER-2369452438'
);

INSERT INTO transactions(
  type,amount,category,date,notes,currency,created_at,
  idempotency_key,external_source,external_id
)
SELECT
  'owner_pay',222.00,'Personal','2026-09-15',
  'HUMAN_CLASSIFICATION_2026-10-01 actor=operator; PERSONAL; Cigarrinho de Artista; economic treatment=owner/personal draw from business pocket; prior cash classification=AMBIGUOUS',
  'BRL',unixepoch(),'sep2026-human:TRANSFER-2372318694','WISE','TRANSFER-2372318694'
WHERE EXISTS (
  SELECT 1 FROM cash_movements cm JOIN cash_accounts ca ON ca.id=cm.cash_account_id
  WHERE cm.external_source='WISE' AND cm.external_id='TRANSFER-2372318694'
    AND cm.date='2026-09-15' AND cm.amount=-222.00
    AND ca.scope='BUSINESS' AND ca.currency='BRL'
)
AND NOT EXISTS (
  SELECT 1 FROM transactions WHERE external_source='WISE' AND external_id='TRANSFER-2372318694'
);

UPDATE cash_movements
SET state='RECONCILED'
WHERE external_source='WISE'
  AND state='AMBIGUOUS'
  AND external_id IN (
    'TRANSFER-2349804943','CARD-4292473562','CARD-4303469528',
    'CARD-4326873397','CARD-4326876305','TRANSFER-2369452438',
    'TRANSFER-2372318694'
  );

-- The evidence pairing is arithmetic and chronological: each posted-gross
-- row less its service fee and the operator-confirmed 2.99 withdrawal fee
-- equals the corresponding Wise cash receipt. No independent payout report
-- is asserted.
INSERT INTO platform_fees(billing_evidence_id,amount,currency,source,occurred_at,notes)
SELECT 6,2.99,'USD','MANUAL','2026-09-08',
  'UPWORK_WITHDRAWAL_FEE_TRANSFER-2359165993 — operator-confirmed; 125.00 gross - 12.50 service fee - 2.99 withdrawal fee = 109.51 Wise cash; independent payout report unavailable'
WHERE NOT EXISTS (
  SELECT 1 FROM platform_fees WHERE notes LIKE 'UPWORK_WITHDRAWAL_FEE_TRANSFER-2359165993%'
);

INSERT INTO platform_fees(billing_evidence_id,amount,currency,source,occurred_at,notes)
SELECT 7,2.99,'USD','MANUAL','2026-09-14',
  'UPWORK_WITHDRAWAL_FEE_TRANSFER-2370743937 — operator-confirmed; 254.17 gross - 25.42 service fee - 2.99 withdrawal fee = 225.76 Wise cash; independent payout report unavailable'
WHERE NOT EXISTS (
  SELECT 1 FROM platform_fees WHERE notes LIKE 'UPWORK_WITHDRAWAL_FEE_TRANSFER-2370743937%'
);

INSERT INTO platform_fees(billing_evidence_id,amount,currency,source,occurred_at,notes)
SELECT 8,2.99,'USD','MANUAL','2026-09-22',
  'UPWORK_WITHDRAWAL_FEE_TRANSFER-2386078149 — operator-confirmed; 166.67 gross - 16.67 service fee - 2.99 withdrawal fee = 147.01 Wise cash; independent payout report unavailable'
WHERE NOT EXISTS (
  SELECT 1 FROM platform_fees WHERE notes LIKE 'UPWORK_WITHDRAWAL_FEE_TRANSFER-2386078149%'
);

INSERT INTO platform_fees(billing_evidence_id,amount,currency,source,occurred_at,notes)
SELECT 10,2.99,'USD','MANUAL','2026-09-29',
  'UPWORK_WITHDRAWAL_FEE_TRANSFER-2399609176 — operator-confirmed; 183.33 gross - 18.33 service fee - 2.99 withdrawal fee = 162.01 Wise cash; independent payout report unavailable'
WHERE NOT EXISTS (
  SELECT 1 FROM platform_fees WHERE notes LIKE 'UPWORK_WITHDRAWAL_FEE_TRANSFER-2399609176%'
);

INSERT INTO reconciliation_notes(contract_id,date,note,video_id,created_at)
SELECT 1,'2026-09-30',
  'UPWORK_WITHDRAWAL_FEES_RESOLVED_2026-10-01 — operator confirms four USD 2.99 payout/withdrawal fees, total USD 11.96. September posted gross USD 729.17; service fees USD 72.92; pre-withdrawal net USD 656.25; withdrawal fees USD 11.96; net platform proceeds and Wise cash USD 644.29. Exact pairing is supported by arithmetic and chronology; independent payout report unavailable. Do not subtract platform fees again from net Wise cash in a cash-basis operating result.',
  NULL,unixepoch()
WHERE NOT EXISTS (
  SELECT 1 FROM reconciliation_notes
  WHERE contract_id=1 AND date='2026-09-30'
    AND note LIKE 'UPWORK_WITHDRAWAL_FEES_RESOLVED_2026-10-01%'
);

INSERT INTO reconciliation_notes(contract_id,date,note,video_id,created_at)
SELECT 1,'2026-10-01',
  'TARYN_DFY_WORK_MODE_V1 — Taryn Dubreuil (client 2) is the sole canonical commercial relationship. Taryn DFY (client 12) is a structured operational alias mapped in source to canonical client 2 with work_mode=DFY; canonical client 2 defaults to work_mode=DIRECT. DFY is excluded from distinct commercial-client and revenue counts but its project/video/work-session context remains separately queryable. Reconciliation must not mutate alias lifecycle.',
  NULL,unixepoch()
WHERE NOT EXISTS (
  SELECT 1 FROM reconciliation_notes
  WHERE contract_id=1 AND date='2026-10-01'
    AND note LIKE 'TARYN_DFY_WORK_MODE_V1%'
);
