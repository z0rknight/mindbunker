-- September 2026 reconciliation read model. Read-only by design.
-- Month edges are America/Sao_Paulo expressed in UTC: [2026-09-01 03:00, 2026-10-01 03:00).

-- 1. Raw Work Session custody. This includes the unresolved 41.0533h interval and release fixture.
SELECT 'RAW_WORK_SESSION_TIME' AS metric,
  COUNT(*) AS records,
  ROUND(SUM((ended_at-started_at)/3600.0),4) AS hours
FROM work_sessions
WHERE started_at>=unixepoch('2026-09-01T03:00:00Z')
  AND started_at<unixepoch('2026-10-01T03:00:00Z');

-- 2. Admissible intentional operating time by mutually exclusive context.
WITH admissible AS (
  SELECT ws.id,(ws.ended_at-ws.started_at)/3600.0 AS hours,
    CASE
      WHEN c.status='lead' THEN 'LEAD'
      WHEN c.name='RMEDIA' AND ws.activity_type='ADMIN' THEN 'ADMIN'
      WHEN c.name='RMEDIA' THEN 'INTERNAL'
      ELSE 'CLIENT'
    END AS context
  FROM work_sessions ws
  JOIN video_logs v ON v.id=ws.video_id
  JOIN clients c ON c.id=v.client_id
  WHERE ws.started_at>=unixepoch('2026-09-01T03:00:00Z')
    AND ws.started_at<unixepoch('2026-10-01T03:00:00Z')
    AND (ws.ended_at-ws.started_at)<=43200
    AND COALESCE(c.source,'')!='RELEASE_TEST'
)
SELECT context,COUNT(*) AS sessions,ROUND(SUM(hours),4) AS admissible_hours
FROM admissible GROUP BY context
UNION ALL
SELECT 'TOTAL',COUNT(*),ROUND(SUM(hours),4) FROM admissible
ORDER BY context;

-- 3. Explicit exclusions/unresolved intervals. Their rows remain intact.
SELECT ws.id,c.name AS client,v.title AS video,
  ROUND((ws.ended_at-ws.started_at)/3600.0,4) AS raw_hours,
  CASE
    WHEN ws.id=83 THEN 'UNRESOLVED_IMPLAUSIBLE_INTERVAL'
    WHEN c.source='RELEASE_TEST' THEN 'PROVEN_SYNTHETIC_FIXTURE'
  END AS exclusion_reason
FROM work_sessions ws
JOIN video_logs v ON v.id=ws.video_id
JOIN clients c ON c.id=v.client_id
WHERE ws.id=83 OR (
  ws.started_at>=unixepoch('2026-09-01T03:00:00Z')
  AND ws.started_at<unixepoch('2026-10-01T03:00:00Z')
  AND c.source='RELEASE_TEST'
)
ORDER BY ws.id;

-- 4. Sensor is evidence coverage, not intentional work by definition.
SELECT 'SENSOR_COVERAGE' AS metric,context_type,approval_state,
  COUNT(*) AS sessions,
  ROUND(SUM((ended_at-started_at)/3600.0),4) AS observed_hours
FROM sensor_sessions
WHERE started_at>=unixepoch('2026-09-01T03:00:00Z')
  AND started_at<unixepoch('2026-10-01T03:00:00Z')
GROUP BY context_type,approval_state
ORDER BY context_type,approval_state;

-- 5. Taryn/Upwork commercial chain. Work-date, posting-date and cash-date views stay separate.
WITH commercial_chain(economic_layer,currency,amount) AS (
  VALUES
    ('TARYN_UPWORK_WORK_DATE_GROSS_VALUE','USD',
      (SELECT CASE WHEN EXISTS (
        SELECT 1 FROM reconciliation_notes WHERE contract_id=1 AND date='2026-09-30'
          AND note LIKE 'UPWORK_SEPTEMBER_2026_RECONCILIATION%'
      ) THEN 841.67 END)),
    ('TARYN_UPWORK_POSTED_GROSS','USD',
      (SELECT ROUND(SUM(gross_amount),2) FROM billing_evidence
       WHERE contract_id=1 AND earning_date>='2026-09-01' AND earning_date<'2026-10-01')),
    ('TARYN_UPWORK_SERVICE_FEES','USD',
      (SELECT ROUND(SUM(amount),2) FROM platform_fees
       WHERE occurred_at>='2026-09-01' AND occurred_at<'2026-10-01'
         AND notes LIKE 'UPWORK_TX_%_SERVICE_FEE%')),
    ('TARYN_UPWORK_WITHDRAWAL_FEES','USD',
      (SELECT ROUND(SUM(amount),2) FROM platform_fees
       WHERE occurred_at>='2026-09-01' AND occurred_at<'2026-10-01'
         AND notes LIKE 'UPWORK_WITHDRAWAL_FEE_%')),
    ('TARYN_UPWORK_PRE_WITHDRAWAL_NET','USD',
      (SELECT ROUND(
        (SELECT SUM(gross_amount) FROM billing_evidence WHERE contract_id=1 AND earning_date>='2026-09-01' AND earning_date<'2026-10-01')
        - (SELECT SUM(amount) FROM platform_fees WHERE occurred_at>='2026-09-01' AND occurred_at<'2026-10-01' AND notes LIKE 'UPWORK_TX_%_SERVICE_FEE%'),2))),
    ('TARYN_UPWORK_NET_PLATFORM_PROCEEDS','USD',
      (SELECT ROUND(
        (SELECT SUM(gross_amount) FROM billing_evidence WHERE contract_id=1 AND earning_date>='2026-09-01' AND earning_date<'2026-10-01')
        - (SELECT SUM(amount) FROM platform_fees WHERE occurred_at>='2026-09-01' AND occurred_at<'2026-10-01'),2))),
    ('TARYN_UPWORK_WISE_CASH','USD',
      (SELECT ROUND(SUM(amount),2) FROM transactions
       WHERE date>='2026-09-01' AND date<'2026-10-01' AND type='income'
         AND category='Upwork settlement' AND client_id=2 AND contract_id=1)),
    ('TARYN_UPWORK_SETTLEMENT_GAP','USD',0.00)
)
SELECT economic_layer,currency,amount FROM commercial_chain WHERE amount IS NOT NULL;

SELECT 'BILLED_REQUESTED' AS economic_layer,'USD' AS currency,243.25 AS amount
WHERE EXISTS (
  SELECT 1 FROM reconciliation_notes WHERE contract_id=2 AND date='2026-09-30'
    AND note LIKE 'DAVE_SEPTEMBER_2026_BILLED_REQUESTED_USD_243_25%'
);

SELECT 'PAID_UNATTRIBUTED' AS economic_layer,currency,ROUND(SUM(amount),2) AS amount
FROM transactions
WHERE date>='2026-09-01' AND date<'2026-10-01'
  AND type='income' AND category='Unattributed paid receipt'
GROUP BY currency;

SELECT 'PAID_RECONCILED' AS economic_layer,currency,ROUND(SUM(amount),2) AS amount
FROM transactions
WHERE date>='2026-09-01' AND date<'2026-10-01'
  AND type='income' AND client_id IS NOT NULL AND contract_id IS NOT NULL
GROUP BY currency;

-- 6. External registered time versus MindBunker intentional time.
-- Daily screenshots permit date-level compatibility only, not exact timestamp overlap.
WITH time_comparison(time_layer,minutes,hours) AS (
  VALUES
    ('UPWORK_REGISTERED_TIME',2020.000,33.6667),
    ('MINDBUNKER_TARYN_TIME',2031.420,33.8570),
    ('MAX_SAME_DATE_COMPATIBLE_OVERLAP',1600.788,26.6798),
    ('UPWORK_EXCESS_ON_SAME_DATE',419.212,6.9869),
    ('MINDBUNKER_EXCESS_ON_SAME_DATE',430.632,7.1772)
)
SELECT * FROM time_comparison
WHERE EXISTS (
  SELECT 1 FROM reconciliation_notes WHERE contract_id=1 AND date='2026-09-30'
    AND note LIKE 'UPWORK_SEPTEMBER_2026_RECONCILIATION%'
);

-- 7. Structured alias-aware work-mode rollup. Client 12 is the existing
-- operational alias; source maps it to canonical client 2 / DFY. Client 2 is
-- DIRECT. The alias remains usable and never becomes a second commercial row.
SELECT CASE WHEN c.id IN (2,12) THEN 'Taryn Dubreuil' ELSE c.name END AS canonical_relationship,
  CASE WHEN c.id=12 THEN 'DFY' WHEN c.id=2 THEN 'DIRECT' ELSE 'UNCLASSIFIED' END AS work_mode,
  ws.activity_type,COUNT(*) AS sessions,
  ROUND(SUM((ws.ended_at-ws.started_at)/3600.0),4) AS admissible_hours
FROM work_sessions ws
JOIN video_logs v ON v.id=ws.video_id
JOIN clients c ON c.id=v.client_id
WHERE ws.started_at>=unixepoch('2026-09-01T03:00:00Z')
  AND ws.started_at<unixepoch('2026-10-01T03:00:00Z')
  AND (ws.ended_at-ws.started_at)<=43200
  AND COALESCE(c.source,'')!='RELEASE_TEST'
GROUP BY canonical_relationship,work_mode,ws.activity_type
ORDER BY canonical_relationship,work_mode,admissible_hours DESC;

SELECT CASE WHEN p.client_id=12 THEN 2 ELSE p.client_id END AS canonical_client_id,
  CASE WHEN p.client_id=12 THEN 'DFY' WHEN p.client_id=2 THEN 'DIRECT' ELSE 'UNCLASSIFIED' END AS work_mode,
  p.id AS project_id,p.name AS project_name,
  COUNT(DISTINCT po.id) AS production_orders,
  COUNT(DISTINCT v.id) AS videos
FROM projects p
LEFT JOIN production_orders po ON po.project_id=p.id
LEFT JOIN video_logs v ON v.project_id=p.id
WHERE p.client_id IN (2,12)
GROUP BY canonical_client_id,work_mode,p.id,p.name
ORDER BY work_mode,p.id;

-- 8. Confirmed costs, owner transfer, and unresolved/mixed business outflows are distinct.
SELECT 'CONFIRMED_OPERATING_COST' AS cost_layer,currency,ROUND(SUM(amount),2) AS amount
FROM transactions
WHERE date>='2026-09-01' AND date<'2026-10-01'
  AND type='expense'
GROUP BY currency
UNION ALL
SELECT 'CONFIRMED_SERVICE_FEE',currency,ROUND(SUM(amount),2)
FROM platform_fees
WHERE occurred_at>='2026-09-01' AND occurred_at<'2026-10-01'
  AND notes LIKE 'UPWORK_TX_%_SERVICE_FEE%'
GROUP BY currency
UNION ALL
SELECT 'CONFIRMED_WITHDRAWAL_FEE',currency,ROUND(SUM(amount),2)
FROM platform_fees
WHERE occurred_at>='2026-09-01' AND occurred_at<'2026-10-01'
  AND notes LIKE 'UPWORK_WITHDRAWAL_FEE_%'
GROUP BY currency
UNION ALL
SELECT 'PERSONAL_EXCLUDED',currency,ROUND(SUM(amount),2)
FROM transactions
WHERE date>='2026-09-01' AND date<'2026-10-01' AND type='owner_pay'
GROUP BY currency
UNION ALL
SELECT 'UNKNOWN_MIXED_COST',ca.currency,ROUND(-SUM(cm.amount),2)
FROM cash_movements cm
JOIN cash_accounts ca ON ca.id=cm.cash_account_id
WHERE ca.scope='BUSINESS'
  AND cm.date>='2026-09-01' AND cm.date<'2026-10-01'
  AND cm.amount<0 AND cm.state='AMBIGUOUS'
GROUP BY ca.currency;

-- 9. Management operating result, separated by currency. USD uses the Wise
-- cash basis (already net of service and withdrawal fees), so only the USD
-- operating expenses that actually left Wise are subtracted here. The
-- equivalent posted-gross bridge is shown separately to prove no double count.
SELECT 'MANAGEMENT_OPERATING_RESULT' AS metric,'USD' AS currency,
  ROUND(
    (SELECT SUM(amount) FROM transactions WHERE date>='2026-09-01' AND date<'2026-10-01' AND type='income' AND category='Upwork settlement')
    - (SELECT SUM(amount) FROM transactions WHERE date>='2026-09-01' AND date<'2026-10-01' AND type='expense' AND currency='USD'),
  2) AS amount,'READY' AS status,'WISE_CASH_BASIS' AS basis
UNION ALL
SELECT 'MANAGEMENT_OPERATING_RESULT','BRL',
  ROUND(
    (SELECT SUM(amount) FROM transactions WHERE date>='2026-09-01' AND date<'2026-10-01' AND type='income' AND currency='BRL')
    - (SELECT SUM(amount) FROM transactions WHERE date>='2026-09-01' AND date<'2026-10-01' AND type='expense' AND currency='BRL'),
  2),'READY','WISE_CASH_BASIS'
UNION ALL
SELECT 'USD_POSTED_GROSS_BRIDGE','USD',
  ROUND(
    (SELECT SUM(gross_amount) FROM billing_evidence WHERE contract_id=1 AND earning_date>='2026-09-01' AND earning_date<'2026-10-01')
    - (SELECT SUM(amount) FROM platform_fees WHERE occurred_at>='2026-09-01' AND occurred_at<'2026-10-01')
    - (SELECT SUM(amount) FROM transactions WHERE date>='2026-09-01' AND date<'2026-10-01' AND type='expense' AND currency='USD'),
  2),'READY','POSTED_GROSS_LESS_PLATFORM_AND_WISE_COSTS';

-- 10. Delivery and review signals are separate and coverage remains YELLOW.
SELECT
  'YELLOW' AS delivery_coverage,
  (SELECT COUNT(*) FROM crm_events WHERE type='video.finished' AND created_at>=unixepoch('2026-09-01T03:00:00Z') AND created_at<unixepoch('2026-10-01T03:00:00Z')) AS finished_events,
  (SELECT COUNT(*) FROM video_logs WHERE status='DONE' AND created_at>=unixepoch('2026-09-01T03:00:00Z') AND created_at<unixepoch('2026-10-01T03:00:00Z')) AS done_videos,
  'YELLOW' AS review_coverage,
  (SELECT COUNT(*) FROM revisions r JOIN video_logs v ON v.id=r.video_id WHERE v.created_at>=unixepoch('2026-09-01T03:00:00Z') AND v.created_at<unixepoch('2026-10-01T03:00:00Z')) AS structured_revisions,
  (SELECT COUNT(*) FROM assets WHERE type='FINAL_DELIVERABLE' AND delivered_at>='2026-09-01' AND delivered_at<'2026-10-01') AS ledger_deliveries;
