// Monday Money Lab P0 -- pure logic only. No DB access here (that lives in
// actions.ts); everything below is unit-testable in isolation and is what
// core.test.mjs exercises directly.

import {
  EFFECTIVE_USD_TO_BRL_RATE,
  isContractBillingType,
} from "./config.ts";
import { dayKeyFor } from "../work-sessions/core.ts";

export type Provenance = "SOURCE_FACT" | "DERIVED" | "UNATTRIBUTED";

export type ReconciliationField<T> = {
  value: T;
  provenance: Provenance;
};

export type ReconciliationResult = {
  operationalMinutes: ReconciliationField<number>;
  billedMinutes: ReconciliationField<number | null>;
  differenceMinutes: ReconciliationField<number | null>;
  contractRate: ReconciliationField<number | null>;
  grossBilled: ReconciliationField<number | null>;
  grossPerOperationalHour: ReconciliationField<number | null>;
  currency: string | null;
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type FinanceSummaryTransaction = {
  type: "income" | "expense" | "owner_pay";
  amount: number;
  currency: string;
  date: string;
};

export type FinanceSummaryByCurrency = {
  currency: string;
  totalIncome: number;
  totalExpenses: number;
  totalOwnerPay: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyNet: number;
  economicLedgerNet: number;
};

// A BUSINESS-scope FX conversion's cash effect on one currency position --
// see computeFxCashMovements in modules/fx/core.ts, which is what actually
// derives these from a raw fx_conversions row (direction-aware). Passed in
// pre-flattened here so this function stays free of FX-specific logic.
export type FinanceSummaryFxMovement = { currency: string; amount: number };

// Currency is the first grouping key. Raw amounts from different ledgers are
// never added together; Owner Pay reduces cash but remains outside revenue,
// expenses, and monthly net. FX movements (fxMovements) shift cash between
// currency positions the same way -- they are NEVER folded into income,
// expenses, monthlyRevenue, or monthlyNet (a conversion is neither revenue
// nor expense), only into economicLedgerNet, exactly like Owner Pay already
// affects that ledger without being revenue or expense. This remains an
// economic-history projection, never a claim about observed Wise cash.
export function computeFinanceSummaryByCurrency(
  transactions: FinanceSummaryTransaction[],
  monthStart: string,
  fxMovements: FinanceSummaryFxMovement[] = [],
): FinanceSummaryByCurrency[] {
  const byCurrency = new Map<
    string,
    { monthlyRevenue: number; monthlyExpenses: number; income: number; expenses: number; ownerPay: number; fxNet: number }
  >();
  const getBucket = (currency: string) =>
    byCurrency.get(currency) ?? {
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      income: 0,
      expenses: 0,
      ownerPay: 0,
      fxNet: 0,
    };

  for (const transaction of transactions) {
    const currency = transaction.currency.trim().toUpperCase();
    if (!currency) continue;
    const bucket = getBucket(currency);
    const inCurrentMonth = transaction.date.slice(0, 7) === monthStart.slice(0, 7);
    if (transaction.type === "income") {
      bucket.income += transaction.amount;
      if (inCurrentMonth) bucket.monthlyRevenue += transaction.amount;
    } else if (transaction.type === "expense") {
      bucket.expenses += transaction.amount;
      if (inCurrentMonth) bucket.monthlyExpenses += transaction.amount;
    } else {
      bucket.ownerPay += transaction.amount;
    }
    byCurrency.set(currency, bucket);
  }

  for (const movement of fxMovements) {
    const currency = movement.currency.trim().toUpperCase();
    if (!currency) continue;
    const bucket = getBucket(currency);
    bucket.fxNet += movement.amount;
    byCurrency.set(currency, bucket);
  }

  return Array.from(byCurrency.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, bucket]) => ({
      currency,
      totalIncome: round2(bucket.income),
      totalExpenses: round2(bucket.expenses),
      totalOwnerPay: round2(bucket.ownerPay),
      monthlyRevenue: round2(bucket.monthlyRevenue),
      monthlyExpenses: round2(bucket.monthlyExpenses),
      monthlyNet: round2(bucket.monthlyRevenue - bucket.monthlyExpenses),
      economicLedgerNet: round2(
        bucket.income - bucket.expenses - bucket.ownerPay + bucket.fxNet,
      ),
    }));
}

export function convertUsdToBrl(
  usdAmount: number,
  effectiveRate = EFFECTIVE_USD_TO_BRL_RATE,
): number {
  return round2(usdAmount * effectiveRate);
}

// Formats total minutes the way the Monday Money Lab P0 brief's own
// fixture does: "15h10", "0h52" -- always hours + zero-padded minutes,
// never dropping the hour segment even at zero (unlike
// formatClosedDuration in work-sessions/core.ts, which is tuned for a
// different, more casual display context).
export function formatMinutesAsHours(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${String(remainder).padStart(2, "0")}`;
}

// Deterministic dedupe key for one piece of billing evidence. Same
// contract + period + source + external reference => same key, so
// re-registering (accidental double-click, re-run CSV import, re-paste
// the same manual entry) can never create a second row -- see
// billing_evidence_idempotency_idx in src/db/schema.ts, which is what
// actually enforces this at the DB level; this function only has to be
// deterministic, the uniqueness guarantee lives in the index.
export function buildBillingEvidenceIdempotencyKey(input: {
  contractId: number;
  periodStart: string;
  periodEnd: string;
  source: string;
  externalReference?: string | null;
}): string {
  const ref = input.externalReference?.trim() || "none";
  return [input.contractId, input.periodStart, input.periodEnd, input.source, ref].join("::");
}

// Sep 16 Operational Reality Patch: the one piece of arithmetic behind
// "Register Upwork time" (recordQuickUpworkTime in modules/finance/actions.ts)
// -- an hourly contract already knows its own rate, so the operator only
// ever types minutes. Pulled out as a pure function so the rounding rule
// (cents, never more) is unit-testable without a database.
export function computeUpworkQuickEntryGrossAmount(minutes: number, hourlyRate: number): number {
  return Math.round((minutes / 60) * hourlyRate * 100) / 100;
}

// Reconciliation: reads OPERATIONAL TRUTH (already-summed work_sessions
// minutes for a contract's client + period) and BILLING TRUTH (one
// billing_evidence row for that period, or null if none has been
// registered yet) and reports the difference. Never mutates either truth,
// never guesses a value that isn't present -- an absent billing evidence
// row means every billed/derived field comes back UNATTRIBUTED rather
// than zero.
export function computeReconciliation(input: {
  operationalMinutes: number;
  billingEvidence: {
    billableMinutes: number;
    rate: number;
    grossAmount: number;
    currency: string;
  } | null;
}): ReconciliationResult {
  const operationalMinutes: ReconciliationField<number> = {
    value: input.operationalMinutes,
    provenance: "SOURCE_FACT",
  };

  if (!input.billingEvidence) {
    return {
      operationalMinutes,
      billedMinutes: { value: null, provenance: "UNATTRIBUTED" },
      differenceMinutes: { value: null, provenance: "UNATTRIBUTED" },
      contractRate: { value: null, provenance: "UNATTRIBUTED" },
      grossBilled: { value: null, provenance: "UNATTRIBUTED" },
      grossPerOperationalHour: { value: null, provenance: "UNATTRIBUTED" },
      currency: null,
    };
  }

  const evidence = input.billingEvidence;
  const differenceMinutes = input.operationalMinutes - evidence.billableMinutes;
  const operationalHours = input.operationalMinutes / 60;
  const grossPerOperationalHour =
    operationalHours > 0 ? round2(evidence.grossAmount / operationalHours) : null;

  return {
    operationalMinutes,
    billedMinutes: { value: evidence.billableMinutes, provenance: "SOURCE_FACT" },
    differenceMinutes: { value: differenceMinutes, provenance: "DERIVED" },
    contractRate: { value: evidence.rate, provenance: "SOURCE_FACT" },
    grossBilled: { value: evidence.grossAmount, provenance: "SOURCE_FACT" },
    grossPerOperationalHour: {
      value: grossPerOperationalHour,
      provenance: grossPerOperationalHour === null ? "UNATTRIBUTED" : "DERIVED",
    },
    currency: evidence.currency,
  };
}

// SEM-001 / FIN-001: tax/reserve planning is a projection over the ONE
// canonical Economic Ledger Net computed above. It must never reconstruct
// income - expenses - owner pay +/- FX itself, and it must never be called
// cash: the ledger is recorded economic history, not an observed Wise pocket.
export function computeEconomicLedgerPlanning(input: {
  totalIncome: number;
  economicLedgerNet: number;
  taxReservePercent: number;
}): { economicLedgerNet: number; taxReserve: number; availableLedgerNet: number } {
  const taxReserve = round2(input.totalIncome * (input.taxReservePercent / 100));
  const economicLedgerNet = round2(input.economicLedgerNet);
  const availableLedgerNet = round2(economicLedgerNet - taxReserve);
  return { economicLedgerNet, taxReserve, availableLedgerNet };
}

export function validateContractInput(input: {
  clientId: number | null | undefined;
  platform: string;
  billingType: string;
  hourlyRate: number | null;
  currency: string;
}): string | null {
  if (!input.clientId) return "A client is required.";
  if (!input.platform || !input.platform.trim()) return "Platform is required.";
  if (!isContractBillingType(input.billingType)) {
    return "Billing type must be HOURLY or FIXED.";
  }
  if (
    input.billingType === "HOURLY" &&
    (input.hourlyRate === null || input.hourlyRate === undefined || input.hourlyRate <= 0)
  ) {
    return "Hourly rate is required and must be positive for HOURLY contracts.";
  }
  if (!input.currency || !input.currency.trim()) return "Currency is required.";
  return null;
}

export function validateIncomeContractAttribution(input: {
  requestedClientId: number | null;
  contract: { clientId: number } | null;
}): string | null {
  if (!input.contract) return "Selected contract was not found.";
  if (
    input.requestedClientId !== null &&
    input.requestedClientId !== input.contract.clientId
  ) {
    return "Selected contract does not belong to the selected client.";
  }
  return null;
}

// Sums CLOSED work_sessions duration (seconds) for one client, attributed
// the same way WORK_SESSION_HISTORY_SQL already attributes client hours
// elsewhere in this app (video_logs.client_id directly, no project
// fallback) -- so this reconciliation query can never silently disagree
// with what the existing Session Ledger shows for the same client. Bound
// params: ?1 = clientId, ?2 = periodStart (inclusive, YYYY-MM-DD), ?3 =
// periodEnd (inclusive, YYYY-MM-DD). Open (still-running) sessions are
// counted separately and excluded from the minutes total -- an in-progress
// session has no honest duration yet.
// P0 POST-AUDIT FIX (DR-2): this used to be a single pre-aggregated SQL
// SUM with two defects proven in the Post-Flow-Closure Congruence Audit:
// (1) no video_kind filter, so a SAMPLE/INTERNAL session on a real
// client's clientId silently inflated their reconciliation minutes; (2)
// SQLite's date(started_at, 'unixepoch') resolves the UTC calendar day,
// not the operator's actual (America/Sao_Paulo) day -- work-sessions/
// core.ts's own comment on computeTodayWorkSessionStats explicitly
// documents that this exact query was "deliberately not reused" there
// for that reason, and never got the fix itself. Fixed now by reusing
// the SAME canonical day-boundary function (dayKeyFor) everywhere else
// in the app already uses, instead of a second timezone convention.
//
// This query now only narrows by clientId and a generously widened
// Unix-second range (a performance bound, not the correctness boundary)
// -- the exact video_kind filter and exact local-day inclusion decision
// are made afterwards by computeClientOperationalMinutes, in JS, using
// dayKeyFor, mirroring the same raw-rows-then-JS-filter pattern
// WORK_SESSION_ATTRIBUTION_SQL + computeTodayWorkSessionStats already
// use for the identical "operator-local day" problem.
export const CLIENT_OPERATIONAL_SESSIONS_SQL = `
  SELECT
    ws.started_at,
    ws.ended_at,
    v.video_kind AS video_kind
  FROM work_sessions ws
  INNER JOIN video_logs v ON v.id = ws.video_id
  WHERE v.client_id = ?1
    AND ws.started_at >= ?2
    AND ws.started_at <= ?3
`;

export type ClientOperationalSessionRow = {
  startedAt: number;
  endedAt: number | null;
  videoKind: string;
};

export type ClientOperationalMinutes = {
  minutes: number;
  openSessionCount: number;
};

// Only CLIENT_WORK time may participate in client billing reconciliation
// -- the same eligibility rule productivity/core.ts's countsToward
// Production already enforces for every other production count in the
// app (Dashboard/CRM/War Room output figures). Reimplemented here as a
// literal string check rather than importing countsTowardProduction
// itself, since that function lives in the productivity module and
// finance/core.ts is documented as pure-logic-only with no cross-module
// DB-shaped dependencies beyond this file's own config -- the semantics
// (exactly "CLIENT_WORK" counts) are identical and this is the one
// existing cross-import (dayKeyFor) this fix already needed.
function isClientProductionSession(videoKind: string): boolean {
  return videoKind === "CLIENT_WORK";
}

export function computeClientOperationalMinutes(
  rows: readonly ClientOperationalSessionRow[],
  periodStart: string,
  periodEnd: string,
): ClientOperationalMinutes {
  let closedSeconds = 0;
  let openSessionCount = 0;
  for (const row of rows) {
    if (!isClientProductionSession(row.videoKind)) continue;
    const dayKey = dayKeyFor(new Date(row.startedAt * 1_000).toISOString());
    if (dayKey < periodStart || dayKey > periodEnd) continue;
    if (row.endedAt === null) {
      openSessionCount += 1;
    } else {
      closedSeconds += Math.max(0, row.endedAt - row.startedAt);
    }
  }
  return { minutes: Math.floor(closedSeconds / 60), openSessionCount };
}

export function validateBillingEvidenceInput(input: {
  periodStart: string;
  periodEnd: string;
  billableMinutes: number;
  rate: number;
  grossAmount: number;
  currency: string;
}): string | null {
  if (!input.periodStart || !input.periodEnd) {
    return "Period start and end are required.";
  }
  if (input.periodEnd < input.periodStart) {
    return "Period end cannot be before period start.";
  }
  if (!Number.isFinite(input.billableMinutes) || input.billableMinutes < 0) {
    return "Billable minutes must be zero or positive.";
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    return "Rate must be zero or positive.";
  }
  if (!Number.isFinite(input.grossAmount) || input.grossAmount < 0) {
    return "Gross amount must be zero or positive.";
  }
  if (!input.currency || !input.currency.trim()) return "Currency is required.";
  return null;
}

// ─── Monday Pre-Freeze Consolidation: platform fee / cash reconciliation (§8/§10) ─

export type CashReconciliation = {
  grossBilled: ReconciliationField<number>;
  platformFeesTotal: ReconciliationField<number>;
  derivedNetProceeds: ReconciliationField<number>;
  cashReceived: ReconciliationField<number | null>;
  differenceFromDerivedNet: ReconciliationField<number | null>;
  currency: string;
};

// Never merges gross billing, platform fee, and cash received into one
// event -- each stays its own SOURCE FACT (or, for cash, UNATTRIBUTED
// until an actual transaction is linked). Only the net proceeds and the
// difference are ever DERIVED. A mismatch (e.g. the real Taryn case:
// derived net USD 341.25 vs USD 343.75 actually arriving) is surfaced,
// never "corrected" or hidden.
export function computeCashReconciliation(input: {
  grossBilled: number;
  platformFees: number[]; // amounts already filtered to this evidence's currency
  cashReceived: number | null; // null = no linked transaction yet
  currency: string;
}): CashReconciliation {
  const platformFeesTotal = round2(input.platformFees.reduce((sum, f) => sum + f, 0));
  const derivedNetProceeds = round2(input.grossBilled - platformFeesTotal);
  const differenceFromDerivedNet =
    input.cashReceived === null ? null : round2(input.cashReceived - derivedNetProceeds);

  return {
    grossBilled: { value: input.grossBilled, provenance: "SOURCE_FACT" },
    platformFeesTotal: {
      value: platformFeesTotal,
      provenance: input.platformFees.length > 0 ? "SOURCE_FACT" : "UNATTRIBUTED",
    },
    derivedNetProceeds: { value: derivedNetProceeds, provenance: "DERIVED" },
    cashReceived: {
      value: input.cashReceived,
      provenance: input.cashReceived === null ? "UNATTRIBUTED" : "SOURCE_FACT",
    },
    differenceFromDerivedNet: {
      value: differenceFromDerivedNet,
      provenance: differenceFromDerivedNet === null ? "UNATTRIBUTED" : "DERIVED",
    },
    currency: input.currency,
  };
}

export function validatePlatformFeeInput(input: {
  amount: number;
  currency: string;
}): string | null {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return "Fee amount must be zero or positive.";
  }
  if (!input.currency || !input.currency.trim()) return "Currency is required.";
  return null;
}

// ─── §6: Freelance income cannot be orphaned ────────────────────────────────

export function validateFreelanceIncomeInput(input: {
  category: string;
  type: "income" | "expense" | "owner_pay";
  clientId: number | null;
}): string | null {
  if (input.type !== "income") return null;
  if (input.category.trim().toLowerCase() !== "freelance") return null;
  if (!input.clientId) {
    return "Freelance income must be associated with a client.";
  }
  return null;
}

export type TransactionCorrectionInput = {
  amount: number;
  category: string;
  date: string;
  notes?: string | null;
  currency: string;
};

function isCalendarDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
}

/** Validates correction fields without changing ledger identity or links. */
export function validateTransactionCorrectionInput(
  input: TransactionCorrectionInput,
): string | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "Amount must be a positive number.";
  }
  if (!input.category.trim()) return "Category is required.";
  if (!isCalendarDateKey(input.date)) return "Enter a valid transaction date.";
  if (!/^[A-Za-z]{3}$/u.test(input.currency.trim())) {
    return "Currency must be a three-letter code.";
  }
  return null;
}

export function validateOwnerPayCorrectionInput(
  input: Omit<TransactionCorrectionInput, "category">,
): string | null {
  return validateTransactionCorrectionInput({ ...input, category: "Owner Pay" });
}

// ─── §13: billing allocation ────────────────────────────────────────────────

export type DerivedAllocationSlice = {
  videoId: number;
  minutes: number;
  proportion: number; // 0..1
  derivedAmount: number;
};

// Derives a proportional split of one billing evidence's gross amount
// across videos, based on each video's share of tracked operational
// minutes within the evidence's period. Purely a computation -- the
// caller decides whether/how to persist the result, always tagged
// DERIVED_PROPORTION (see billing_allocations.method), never silently
// promoted to a confirmed/manual fact.
export function computeDerivedProportionAllocation(input: {
  grossAmount: number;
  videoMinutes: Array<{ videoId: number; minutes: number }>;
}): DerivedAllocationSlice[] {
  const totalMinutes = input.videoMinutes.reduce((sum, v) => sum + v.minutes, 0);
  if (totalMinutes <= 0) return [];
  return input.videoMinutes
    .filter((v) => v.minutes > 0)
    .map((v) => {
      const proportion = v.minutes / totalMinutes;
      return {
        videoId: v.videoId,
        minutes: v.minutes,
        proportion,
        derivedAmount: round2(input.grossAmount * proportion),
      };
    });
}

export function validateBillingAllocationInput(input: {
  method: string;
  amount: number;
  currency: string;
}): string | null {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return "Allocation amount must be zero or positive.";
  }
  if (!input.currency || !input.currency.trim()) return "Currency is required.";
  return null;
}

// ─── §16: debts ──────────────────────────────────────────────────────────

// Remaining balance is always derived from the real payment ledger
// (transactions rows carrying this debt's id), never a separately stored,
// independently-mutated column -- see the debts table comment in
// src/db/schema.ts.
export function computeDebtRemainingBalance(input: {
  originalAmount: number;
  paymentsTotal: number;
}): number {
  return round2(input.originalAmount - input.paymentsTotal);
}

export function validateDebtInput(input: {
  name: string;
  creditor: string;
  originalAmount: number;
  currency: string;
}): string | null {
  if (!input.name.trim()) return "Debt name is required.";
  if (!input.creditor.trim()) return "Creditor is required.";
  if (!Number.isFinite(input.originalAmount) || input.originalAmount <= 0) {
    return "Original amount must be positive.";
  }
  if (!input.currency || !input.currency.trim()) return "Currency is required.";
  return null;
}

// ─── §17/§18: subscriptions ──────────────────────────────────────────────

// The real billing event is always what's stored (amount + cadence); this
// is the only place an annual charge is ever divided by 12 -- MindBunker
// never pretends the charge itself happens monthly.
export function computeMonthlyEquivalent(input: {
  amount: number;
  cadence: "MONTHLY" | "ANNUAL";
}): number {
  return round2(input.cadence === "MONTHLY" ? input.amount : input.amount / 12);
}

export function validateSubscriptionInput(input: {
  name: string;
  vendor: string;
  amount: number;
  currency: string;
  cadence: string;
}): string | null {
  if (!input.name.trim()) return "Subscription name is required.";
  if (!input.vendor.trim()) return "Vendor is required.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "Amount must be positive.";
  }
  if (!input.currency || !input.currency.trim()) return "Currency is required.";
  if (input.cadence !== "MONTHLY" && input.cadence !== "ANNUAL") {
    return "Cadence must be MONTHLY or ANNUAL.";
  }
  return null;
}

// ─── NIGHT SHIFT REALITY PATCH §6: contract rate -> attributable work value ─

export type RateEquivalent = {
  attributableSeconds: number;
  hourlyRate: number;
  currency: string;
  rateEquivalent: number;
};

// This is NEVER "earned", "paid", or "revenue" -- see the module-level
// invariant in finance/actions.ts's getTodayRateEquivalents. It is purely:
// "if all attributable work were valued at the contract's hourly rate, it
// corresponds to this many currency units." Sensor/Work Session time is
// MindBunker's own operational-involvement tracking; it is explicitly NOT
// the same fact as what Upwork (or any platform) actually billed -- see
// commercial_contracts vs billing_evidence in db/schema.ts, permanently
// separate truths. This function never writes to transactions and never
// gets summed into any revenue figure.
export function computeRateEquivalent(
  attributableSeconds: number,
  hourlyRate: number,
  currency: string,
): RateEquivalent {
  const hours = attributableSeconds / 3_600;
  return {
    attributableSeconds,
    hourlyRate,
    currency,
    rateEquivalent: round2(hours * hourlyRate),
  };
}

// ─── Tuesday Patch Priority 4: "Your money, without the accounting" ────────
// The Overview layer collapses the whole page to at most three numbers
// (brief §Finance.2) -- Available (already computed elsewhere as
// availableLedgerNet), Reserved, and Upcoming. These two are the only new
// arithmetic Overview needs; both sum already-canonical facts, they don't
// invent new ones.

export type CurrencyAmount = { currency: string; amount: number };

/**
 * "Reserved -- dinheiro que decidi não tocar" (brief): tax reserve plus
 * the operating cost reserve, summed per currency. Both are already
 * displayed separately further down the page; this just adds them for
 * the top-of-page number.
 */
export function computeReservedByCurrency(
  taxReserveByCurrency: readonly CurrencyAmount[],
  operatingReserve: { currency: string; reservedSoFar: number },
): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const row of taxReserveByCurrency) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amount);
  }
  if (operatingReserve.reservedSoFar !== 0 || totals.has(operatingReserve.currency)) {
    totals.set(
      operatingReserve.currency,
      (totals.get(operatingReserve.currency) ?? 0) + operatingReserve.reservedSoFar,
    );
  }
  return Array.from(totals.entries())
    .filter(([, amount]) => amount !== 0)
    .map(([currency, amount]) => ({ currency, amount: round2(amount) }));
}

function daysUntil(todayISO: string, targetISO: string): number {
  return Math.floor((Date.parse(targetISO) - Date.parse(todayISO)) / (24 * 60 * 60 * 1000));
}

/**
 * "Upcoming -- coisas que vou precisar pagar" (brief): subscription
 * renewals due within the next `windowDays`. Debts have no fixed due
 * date in this schema (paid whenever, not a scheduled obligation), so
 * they're deliberately not part of this number -- this is a "what's
 * coming due" figure, not a general cash-flow forecast.
 */
export function computeUpcomingObligations(
  renewals: readonly { renewalDate: string | null; amount: number; currency: string }[],
  todayISO: string,
  windowDays = 30,
): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const renewal of renewals) {
    if (!renewal.renewalDate || renewal.renewalDate < todayISO) continue;
    if (daysUntil(todayISO, renewal.renewalDate) > windowDays) continue;
    totals.set(renewal.currency, (totals.get(renewal.currency) ?? 0) + renewal.amount);
  }
  return Array.from(totals.entries()).map(([currency, amount]) => ({ currency, amount: round2(amount) }));
}

// Operator Project Commercial Attribution (14SEP follow-up, Bonnie
// closure): picks out only the small, deliberately-curated set of
// billing_evidence rows an operator explicitly hand-typed a note for
// (source=MANUAL -- e.g. Dave's $100 landing-page entry, Taryn's
// January Bonnie Ads entry) that have never been allocated to a video.
// Deliberately NOT "all evidence minus all allocated" -- that would
// treat every routine weekly Upwork report row (expected to be
// project-unallocated by default) as a false signal. Pure so it's
// directly testable without a DB connection; the caller
// (finance/actions.ts's getClientProjectCommercialAttribution) does the
// real query and passes rows straight through.
export type UnallocatedManualEvidenceRow = {
  id: number;
  contractClientId: number;
  source: string;
  grossAmount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  externalReference: string | null;
};

export type UnallocatedManualEvidence = {
  id: number;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  label: string;
};

const UNALLOCATED_EVIDENCE_LABEL_MAX_LENGTH = 80;

export function selectUnallocatedManualEvidence(
  clientId: number,
  evidenceRows: readonly UnallocatedManualEvidenceRow[],
  allocatedEvidenceIds: ReadonlySet<number>,
): UnallocatedManualEvidence[] {
  return evidenceRows
    .filter(
      (evidence) =>
        evidence.contractClientId === clientId &&
        evidence.source === "MANUAL" &&
        !allocatedEvidenceIds.has(evidence.id),
    )
    .map((evidence) => ({
      id: evidence.id,
      amount: round2(evidence.grossAmount),
      currency: evidence.currency,
      periodStart: evidence.periodStart,
      periodEnd: evidence.periodEnd,
      // Truncated, never re-authored -- shows only what the evidence
      // row's own text already says.
      label: evidence.externalReference
        ? evidence.externalReference.length > UNALLOCATED_EVIDENCE_LABEL_MAX_LENGTH
          ? `${evidence.externalReference.slice(0, UNALLOCATED_EVIDENCE_LABEL_MAX_LENGTH)}…`
          : evidence.externalReference
        : "Manually recorded billing evidence",
    }));
}
