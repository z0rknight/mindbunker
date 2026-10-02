import "server-only";

import { getAuthenticatedDb } from "@/db";
import { currentMonthKey, shiftMonthKey } from "@/utils/date";
import { dayKeyFor } from "@/modules/work-sessions/core";
import { getApplicationUsage } from "@/modules/sensor/data";
import { resolveTimeWindow } from "@/modules/sensor/app-intelligence";
import {
  buildCoverageMatrix,
  computeMonthlyFinance,
  computeMonthlyTime,
  computeWeeklyCommercialLine,
  deriveCommercialPosition,
  roundMoney,
  type CommercialPosition,
  type CoverageDimension,
  type MonthlyFinanceRow,
} from "./core";

type D1Result<T> = { results: T[] };

async function all<T>(statement: Promise<D1Result<T>>): Promise<T[]> {
  return (await statement).results ?? [];
}

function monthDateRange(monthKey: string) {
  return { start: `${monthKey}-01`, end: `${shiftMonthKey(monthKey, 1)}-01` };
}

type ReconciliationOverride = {
  contractId: number;
  minutes: number;
  amount: number;
  currency: string;
};

// Existing close notes preserve the exact work-date month result when a
// platform week crosses a month boundary. This parser reads the evidence;
// it does not manufacture or persist a monthly total.
export function parseWorkDateOverride(note: string, contractId: number): ReconciliationOverride | null {
  const match = note.match(/work-date\s+(\d+)\s+min\s*\/\s*([A-Z]{3})\s+([\d.]+)\s+gross value/iu);
  if (!match) return null;
  return {
    contractId,
    minutes: Number(match[1]),
    currency: match[2].toUpperCase(),
    amount: Number(match[3]),
  };
}

export function parseRequestedOverride(note: string): { amount: number; currency: string } | null {
  const match = note.match(/BILLED_REQUESTED_([A-Z]{3})_([0-9_]+)/u);
  if (!match) return null;
  const numeric = match[2].replace(/_(\d{2})$/u, ".$1").replaceAll("_", "");
  const amount = Number(numeric);
  return Number.isFinite(amount) ? { amount, currency: match[1] } : null;
}

type BillingRow = {
  id: number;
  contract_id: number;
  period_start: string;
  period_end: string;
  billable_minutes: number;
  gross_amount: number;
  currency: string;
  earning_date: string | null;
  external_reference: string | null;
};

function registeredBillingForMonth(
  monthKey: string,
  billingRows: BillingRow[],
  overrides: ReconciliationOverride[],
): Array<{ amount: number; currency: string }> {
  const { start, end } = monthDateRange(monthKey);
  const overriddenContracts = new Set(overrides.map((row) => row.contractId));
  const rows = overrides.map(({ amount, currency }) => ({ amount, currency }));
  for (const row of billingRows) {
    if (overriddenContracts.has(row.contract_id)) continue;
    if (row.period_start >= start && row.period_end < end) {
      rows.push({ amount: row.gross_amount, currency: row.currency });
      continue;
    }
    // Boundary-week evidence may explicitly name an outside-month daily
    // slice (the current Upwork close does). Allocate only that stated slice.
    const partial = row.external_reference?.match(/includes\s+(\d+)\s+minutes\s+on\s+([A-Z][a-z]+)\s+(\d+)/u);
    if (!partial) continue;
    const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" })
      .format(new Date(`${monthKey}-01T00:00:00Z`));
    if (partial[2] !== monthName) continue;
    const minutes = Number(partial[1]);
    rows.push({ amount: roundMoney((minutes / 60) * (row.gross_amount / (row.billable_minutes / 60))), currency: row.currency });
  }
  return rows;
}

function registeredMinutesForMonth(monthKey: string, billingRows: BillingRow[], overrides: ReconciliationOverride[]): number {
  if (overrides.length > 0) return overrides.reduce((sum, row) => sum + row.minutes, 0);
  const { start, end } = monthDateRange(monthKey);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" })
    .format(new Date(`${monthKey}-01T00:00:00Z`));
  return billingRows.reduce((sum, row) => {
    if (row.period_start >= start && row.period_end < end) return sum + row.billable_minutes;
    const partial = row.external_reference?.match(/includes\s+(\d+)\s+minutes\s+on\s+([A-Z][a-z]+)\s+(\d+)/u);
    return partial && partial[2] === monthName ? sum + Number(partial[1]) : sum;
  }, 0);
}

export type MonthlyTimeReality = {
  rawSeconds: number;
  reconciledSeconds: number;
  clientSeconds: number;
  internalSeconds: number;
  adminSeconds: number;
  leadSeconds: number;
  excludedSeconds: number;
  excludedCount: number;
  implausibleSeconds: number;
  implausibleCount: number;
  syntheticFixtureSeconds: number;
};

export type MonthlyReality = {
  monthKey: string;
  finance: MonthlyFinanceRow[];
  time: MonthlyTimeReality;
  sensor: {
    intentionalSeconds: number;
    telemetrySeconds: number;
    activeSeconds: number;
    idleSeconds: number;
    noTelemetrySeconds: number;
    manualOffsiteSeconds: null;
    unresolvedContextCount: number;
    implausibleSessionCount: number;
  };
  coverage: CoverageDimension[];
  operations: {
    activeClients: number;
    activeProjects: number;
    openProductionOrders: number;
    newLeads: number;
    systemInboundTotal: number;
    systemInboundNew: number;
    unresolvedSessions: number;
    unclassifiedFinancialMovements: number;
    externalRegisteredMinutes: number;
    openCommercial: Array<{ currency: string; amount: number }>;
  };
};

export async function getMonthlyReality(monthKey: string): Promise<MonthlyReality> {
  const db = await getAuthenticatedDb();
  const { start, end } = monthDateRange(monthKey);
  const window = resolveTimeWindow("MONTH", new Date().toISOString(), monthKey);
  const [transactionRows, billingRows, requestRows, feeRows, unknownRows, sessionRows, notes, evidenceCounts, sensor, activeClients, operationCounts, openRequests, aliasNotes] = await Promise.all([
    all(db.$client.prepare(`
      SELECT type, amount, currency,
        CASE WHEN client_id IS NOT NULL AND contract_id IS NOT NULL THEN 1 ELSE 0 END AS attributed
      FROM transactions WHERE date >= ?1 AND date < ?2
    `).bind(start, end).all<{ type: "income" | "expense" | "owner_pay"; amount: number; currency: string; attributed: number }>()),
    all(db.$client.prepare(`
      SELECT id, contract_id, period_start, period_end, billable_minutes, gross_amount,
        currency, earning_date, external_reference
      FROM billing_evidence
      WHERE (period_end >= ?1 AND period_start < ?2) OR (earning_date >= ?1 AND earning_date < ?2)
    `).bind(start, end).all<BillingRow>()),
    all(db.$client.prepare(`
      SELECT amount_cents, currency FROM payment_requests
      WHERE created_at >= ?1 AND created_at < ?2 AND status != 'CANCELLED'
    `).bind(window.startSeconds, window.endSeconds).all<{ amount_cents: number; currency: string }>()),
    all(db.$client.prepare(`
      SELECT amount, currency FROM platform_fees
      WHERE occurred_at >= ?1 AND occurred_at < ?2
    `).bind(start, end).all<{ amount: number; currency: string }>()),
    all(db.$client.prepare(`
      SELECT -cm.amount AS amount, ca.currency
      FROM cash_movements cm JOIN cash_accounts ca ON ca.id=cm.cash_account_id
      WHERE ca.scope='BUSINESS' AND cm.date >= ?1 AND cm.date < ?2
        AND cm.amount < 0 AND cm.state='AMBIGUOUS'
    `).bind(start, end).all<{ amount: number; currency: string }>()),
    all(db.$client.prepare(`
      SELECT ws.id, ws.started_at, ws.ended_at, ws.activity_type,
        c.name AS client_name, c.status AS client_status, COALESCE(c.source,'') AS client_source
      FROM work_sessions ws
      JOIN video_logs v ON v.id=ws.video_id
      JOIN clients c ON c.id=v.client_id
      WHERE ws.started_at >= ?1 AND ws.started_at < ?2 AND ws.ended_at IS NOT NULL
    `).bind(window.startSeconds, window.endSeconds).all<{
      id: number; started_at: number; ended_at: number; activity_type: string;
      client_name: string; client_status: string; client_source: string;
    }>()),
    all(db.$client.prepare(`
      SELECT contract_id, note FROM reconciliation_notes WHERE date >= ?1 AND date < ?2
    `).bind(start, end).all<{ contract_id: number; note: string }>()),
    db.$client.prepare(`
      SELECT
        (SELECT COUNT(*) FROM crm_events WHERE type='video.finished' AND created_at >= ?1 AND created_at < ?2) AS deliveries,
        (SELECT COUNT(*) FROM revisions WHERE created_at >= ?1 AND created_at < ?2) AS reviews
    `).bind(window.startSeconds, window.endSeconds).first<{ deliveries: number; reviews: number }>(),
    getApplicationUsage("MONTH", monthKey),
    all(db.$client.prepare(`SELECT id FROM clients WHERE status='active' AND COALESCE(source,'')!='RELEASE_TEST'`).all<{ id: number }>()),
    db.$client.prepare(`
      SELECT
        (SELECT COUNT(*) FROM projects WHERE status='active') AS active_projects,
        (SELECT COUNT(*) FROM production_orders WHERE state='OPEN') AS open_orders,
        (SELECT COUNT(*) FROM clients WHERE status='lead' AND created_at>=?1 AND created_at<?2) AS new_leads,
        (SELECT COUNT(*) FROM clients WHERE source='start') AS inbound_total,
        (SELECT COUNT(*) FROM clients WHERE source='start' AND created_at>=?1 AND created_at<?2) AS inbound_new,
        (SELECT COUNT(*) FROM work_sessions WHERE (ended_at IS NULL OR ended_at-started_at>43200) AND started_at>=?1 AND started_at<?2) AS unresolved_sessions
    `).bind(window.startSeconds, window.endSeconds).first<{
      active_projects: number; open_orders: number; new_leads: number; inbound_total: number; inbound_new: number; unresolved_sessions: number;
    }>(),
    all(db.$client.prepare(`SELECT amount_cents,currency FROM payment_requests WHERE status='OPEN'`).all<{ amount_cents: number; currency: string }>()),
    all(db.$client.prepare(`SELECT note FROM reconciliation_notes WHERE note LIKE '%operational alias mapped in source%'`).all<{ note: string }>()),
  ]);

  const overrides = notes
    .map((row) => parseWorkDateOverride(row.note, row.contract_id))
    .filter((row): row is ReconciliationOverride => row !== null);
  const registeredBilling = registeredBillingForMonth(monthKey, billingRows, overrides);
  const reconciledRevenue = billingRows
    .filter((row) => row.earning_date !== null && row.earning_date >= start && row.earning_date < end)
    .map((row) => ({ amount: row.gross_amount, currency: row.currency }));
  const finance = computeMonthlyFinance({
    transactions: transactionRows.map((row) => ({ ...row, amount: Number(row.amount), attributed: Boolean(row.attributed) })),
    registeredBilling,
    reconciledRevenue,
    requested: [
      ...requestRows.map((row) => ({ amount: row.amount_cents / 100, currency: row.currency })),
      ...notes.map((row) => parseRequestedOverride(row.note)).filter((row): row is { amount: number; currency: string } => row !== null),
    ],
    platformFees: feeRows.map((row) => ({ amount: Number(row.amount), currency: row.currency })),
    unknownCosts: unknownRows.map((row) => ({ amount: Number(row.amount), currency: row.currency })),
  });

  const time = computeMonthlyTime(sessionRows.map((row) => ({
    startedAt: Number(row.started_at),
    endedAt: Number(row.ended_at),
    activityType: row.activity_type,
    clientName: row.client_name,
    clientStatus: row.client_status,
    clientSource: row.client_source,
  })));
  const unknownCost = finance.reduce((sum, row) => sum + row.unknownCost, 0);
  const unattributedPaid = finance.reduce((sum, row) => sum + row.unattributedPaid, 0);
  const deliveries = Number(evidenceCounts?.deliveries ?? 0);
  const reviews = Number(evidenceCounts?.reviews ?? 0);
  const aliasIds = new Set(aliasNotes.flatMap((row) => {
    const match = row.note.match(/client\s+(\d+).*canonical client\s+(\d+)/iu);
    return match ? [Number(match[1])] : [];
  }));
  const openCommercial = [...openRequests.reduce((map, row) => {
    map.set(row.currency, (map.get(row.currency) ?? 0) + row.amount_cents / 100);
    return map;
  }, new Map<string, number>())].map(([currency, amount]) => ({ currency, amount: roundMoney(amount) }));
  const externalRegisteredMinutes = registeredMinutesForMonth(monthKey, billingRows, overrides);

  return {
    monthKey,
    finance,
    time,
    sensor: {
      intentionalSeconds: sensor.sessionCoverage.sessionSeconds,
      telemetrySeconds: sensor.sessionCoverage.telemetrySeconds,
      activeSeconds: sensor.sessionCoverage.activeSeconds,
      idleSeconds: sensor.sessionCoverage.idleSeconds,
      noTelemetrySeconds: sensor.sessionCoverage.uncoveredSeconds,
      manualOffsiteSeconds: null,
      unresolvedContextCount: 0,
      implausibleSessionCount: time.implausibleCount,
    },
    coverage: buildCoverageMatrix({
      financeUnknownCost: unknownCost,
      excludedSeconds: time.excludedSeconds,
      unattributedPaid,
      deliveryEvidenceCount: deliveries,
      reviewEvidenceCount: reviews,
      sourceAuthorityClean: true,
    }),
    operations: {
      activeClients: activeClients.filter((row) => !aliasIds.has(row.id)).length,
      activeProjects: Number(operationCounts?.active_projects ?? 0),
      openProductionOrders: Number(operationCounts?.open_orders ?? 0),
      newLeads: Number(operationCounts?.new_leads ?? 0),
      systemInboundTotal: Number(operationCounts?.inbound_total ?? 0),
      systemInboundNew: Number(operationCounts?.inbound_new ?? 0),
      unresolvedSessions: Number(operationCounts?.unresolved_sessions ?? 0),
      unclassifiedFinancialMovements: unknownRows.length,
      externalRegisteredMinutes,
      openCommercial,
    },
  };
}

export type WeeklyCommercialReality = {
  periodStart: string;
  periodEnd: string;
  registeredMinutes: number;
  workDateGross: number;
  postedGross: number;
  serviceFees: number;
  withdrawalFees: number;
  netPlatformValue: number | null;
  bankSettlement: number | null;
  directMinutes: number;
  dfyMinutes: number;
};

export type ClientReality = {
  clientId: number;
  canonicalName: string;
  activeRelationship: boolean;
  projectCount: number;
  productionOrderCount: number;
  deliveryCount: number;
  reviewCount: number;
  commercial: CommercialPosition;
  directMinutes: number;
  dfyMinutes: number;
  registeredMinutes: number | null;
  workDateGross: number | null;
  postedGross: number;
  serviceFees: number;
  withdrawalFees: number;
  netCash: number;
  weekly: WeeklyCommercialReality[];
  exceptions: string[];
  periodMonthKey: string;
};

function totalWholeMinutes(rows: Array<{ started_at: number; ended_at: number | null }>): number {
  return Math.floor(rows.reduce((sum, row) => sum + Math.max(0, (row.ended_at ?? row.started_at) - row.started_at), 0) / 60);
}

export async function getClientReality(clientId: number, periodMonthKey = shiftMonthKey(currentMonthKey(), -1)): Promise<ClientReality | null> {
  const db = await getAuthenticatedDb();
  const client = await db.$client.prepare(`SELECT id,name,status FROM clients WHERE id=?1`).bind(clientId)
    .first<{ id: number; name: string; status: string }>();
  if (!client) return null;
  const { start, end } = monthDateRange(periodMonthKey);
  const window = resolveTimeWindow("MONTH", new Date().toISOString(), periodMonthKey);
  const aliasRows = await all(db.$client.prepare(`
    SELECT note FROM reconciliation_notes WHERE note LIKE '%operational alias mapped in source%'
  `).all<{ note: string }>());
  const aliasIds = aliasRows.flatMap((row) => {
    const match = row.note.match(/client\s+(\d+).*canonical client\s+(\d+)/iu);
    return match && Number(match[2]) === clientId ? [Number(match[1])] : [];
  });
  const relationshipIds = [clientId, ...aliasIds];
  const placeholders = relationshipIds.map((_, index) => `?${index + 1}`).join(",");
  const [contracts, requests, sessions, paid, counts, billingRows, notes, fees, cashRows, revisions] = await Promise.all([
    all(db.$client.prepare(`SELECT id,billing_type,hourly_rate,currency,status,platform FROM commercial_contracts WHERE client_id=?1`).bind(clientId).all<{
      id: number; billing_type: "HOURLY" | "FIXED"; hourly_rate: number | null; currency: string;
      status: "ACTIVE" | "PAUSED" | "ENDED"; platform: string;
    }>()),
    all(db.$client.prepare(`SELECT id,amount_cents,currency,status,created_at,note FROM payment_requests WHERE client_id=?1 ORDER BY created_at`).bind(clientId).all<{
      id: number; amount_cents: number; currency: string; status: "OPEN" | "PAID" | "CANCELLED"; created_at: number; note: string | null;
    }>()),
    all(db.$client.prepare(`
      SELECT ws.started_at,ws.ended_at,v.client_id
      FROM work_sessions ws JOIN video_logs v ON v.id=ws.video_id
      WHERE v.client_id IN (${placeholders}) AND ws.ended_at IS NOT NULL
      ORDER BY ws.started_at
    `).bind(...relationshipIds).all<{ started_at: number; ended_at: number | null; client_id: number }>()),
    all(db.$client.prepare(`SELECT amount,currency,date FROM transactions WHERE client_id=?1 AND type='income'`).bind(clientId).all<{ amount: number; currency: string; date: string }>()),
    db.$client.prepare(`
      SELECT
        (SELECT COUNT(*) FROM projects WHERE client_id IN (${placeholders}) AND status='active') AS projects,
        (SELECT COUNT(*) FROM production_orders WHERE client_id IN (${placeholders}) AND state='OPEN') AS orders,
        (SELECT COUNT(*) FROM video_logs WHERE client_id IN (${placeholders}) AND delivered=1) AS deliveries
    `).bind(...relationshipIds).first<{ projects: number; orders: number; deliveries: number }>(),
    all(db.$client.prepare(`
      SELECT be.id,be.contract_id,be.period_start,be.period_end,be.billable_minutes,be.gross_amount,
        be.currency,be.earning_date,be.external_reference
      FROM billing_evidence be JOIN commercial_contracts cc ON cc.id=be.contract_id
      WHERE cc.client_id=?1 AND ((be.period_end>=?2 AND be.period_start<?3) OR (be.earning_date>=?2 AND be.earning_date<?3))
      ORDER BY be.period_start
    `).bind(clientId, start, end).all<BillingRow>()),
    all(db.$client.prepare(`SELECT contract_id,note FROM reconciliation_notes WHERE date>=?1 AND date<?2`).bind(start, end).all<{ contract_id: number; note: string }>()),
    all(db.$client.prepare(`
      SELECT pf.billing_evidence_id,pf.amount,pf.occurred_at,pf.notes
      FROM platform_fees pf JOIN billing_evidence be ON be.id=pf.billing_evidence_id
      JOIN commercial_contracts cc ON cc.id=be.contract_id
      WHERE cc.client_id=?1 AND pf.occurred_at>=?2 AND pf.occurred_at<?3
    `).bind(clientId, start, end).all<{ billing_evidence_id: number; amount: number; occurred_at: string | null; notes: string | null }>()),
    all(db.$client.prepare(`SELECT amount,date FROM transactions WHERE client_id=?1 AND contract_id IS NOT NULL AND type='income' AND date>=?2 AND date<?3`).bind(clientId, start, end).all<{ amount: number; date: string }>()),
    db.$client.prepare(`SELECT COUNT(*) AS count FROM revisions r JOIN video_logs v ON v.id=r.video_id WHERE v.client_id IN (${placeholders})`).bind(...relationshipIds).first<{ count: number }>(),
  ]);

  const commercial = deriveCommercialPosition({
    contracts: contracts.map((row) => ({ id: row.id, billingType: row.billing_type, hourlyRate: row.hourly_rate, currency: row.currency, status: row.status })),
    requests: requests.map((row) => ({ id: row.id, amountCents: row.amount_cents, currency: row.currency, status: row.status, createdAt: row.created_at, note: row.note })),
    sessions: sessions.map((row) => ({ startedAt: row.started_at, endedAt: row.ended_at })),
    paidTransactions: paid.map((row) => ({ amount: row.amount, currency: row.currency, occurredAt: Math.floor(Date.parse(`${row.date}T23:59:59-03:00`) / 1000) })),
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  const periodSessions = sessions.filter((row) => row.started_at >= window.startSeconds && row.started_at < window.endSeconds);
  const directMinutes = totalWholeMinutes(periodSessions.filter((row) => row.client_id === clientId));
  const dfyMinutes = totalWholeMinutes(periodSessions.filter((row) => aliasIds.includes(row.client_id)));
  const overrides = notes.map((row) => parseWorkDateOverride(row.note, row.contract_id)).filter((row): row is ReconciliationOverride => row !== null);
  const registered = registeredBillingForMonth(periodMonthKey, billingRows, overrides);
  const overrideMinutes = overrides.reduce((sum, row) => sum + row.minutes, 0);
  const postedGross = billingRows.filter((row) => row.earning_date !== null && row.earning_date >= start && row.earning_date < end).reduce((sum, row) => sum + row.gross_amount, 0);
  const serviceFees = fees.filter((row) => row.notes?.includes("SERVICE_FEE")).reduce((sum, row) => sum + row.amount, 0);
  const withdrawalFees = fees.filter((row) => row.notes?.includes("WITHDRAWAL_FEE")).reduce((sum, row) => sum + row.amount, 0);
  const weekly = billingRows.map((billing): WeeklyCommercialReality => {
    const linkedFees = fees.filter((fee) => fee.billing_evidence_id === billing.id);
    const service = linkedFees.filter((fee) => fee.notes?.includes("SERVICE_FEE")).reduce((sum, fee) => sum + fee.amount, 0);
    const withdrawal = linkedFees.filter((fee) => fee.notes?.includes("WITHDRAWAL_FEE")).reduce((sum, fee) => sum + fee.amount, 0);
    const inWeek = periodSessions.filter((row) => {
      const day = dayKeyFor(new Date(row.started_at * 1000).toISOString());
      return day >= billing.period_start && day <= billing.period_end;
    });
    const computed = computeWeeklyCommercialLine({
      grossAmount: billing.gross_amount,
      posted: Boolean(billing.earning_date),
      serviceFees: service,
      withdrawalFees: withdrawal,
      candidateSettlements: cashRows.map((row) => row.amount),
      directSeconds: inWeek.filter((row) => row.client_id === clientId).reduce((sum, row) => sum + Math.max(0, (row.ended_at ?? row.started_at) - row.started_at), 0),
      dfySeconds: inWeek.filter((row) => aliasIds.includes(row.client_id)).reduce((sum, row) => sum + Math.max(0, (row.ended_at ?? row.started_at) - row.started_at), 0),
    });
    return {
      periodStart: billing.period_start,
      periodEnd: billing.period_end,
      registeredMinutes: billing.billable_minutes,
      workDateGross: billing.gross_amount,
      ...computed,
    };
  });
  const exceptions: string[] = [];
  if (aliasIds.length > 0) exceptions.push(`Operational alias ${aliasIds.join(", ")} rolls up here; it is not another commercial client.`);
  if (weekly.some((row) => row.periodStart < start || row.periodEnd >= end)) exceptions.push("A platform week crosses the month boundary; the monthly total uses reconciled work-date evidence.");
  if (commercial.model === "UNCLEAR" || commercial.model === "MIXED") exceptions.push("Commercial model requires operator review before time can produce a billable delta.");

  return {
    clientId,
    canonicalName: client.name,
    activeRelationship: client.status === "active",
    projectCount: Number(counts?.projects ?? 0),
    productionOrderCount: Number(counts?.orders ?? 0),
    deliveryCount: Number(counts?.deliveries ?? 0),
    reviewCount: Number(revisions?.count ?? 0),
    commercial,
    directMinutes,
    dfyMinutes,
    registeredMinutes: overrideMinutes > 0 ? overrideMinutes : billingRows.reduce((sum, row) => sum + row.billable_minutes, 0) || null,
    workDateGross: registered.reduce((sum, row) => sum + row.amount, 0) || null,
    postedGross: roundMoney(postedGross),
    serviceFees: roundMoney(serviceFees),
    withdrawalFees: roundMoney(withdrawalFees),
    netCash: roundMoney(cashRows.reduce((sum, row) => sum + row.amount, 0)),
    weekly,
    exceptions,
    periodMonthKey,
  };
}
