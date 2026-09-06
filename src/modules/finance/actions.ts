"use server";

import { getAuthenticatedDb } from "@/db";
import {
  transactions,
  commercialContracts,
  billingEvidence,
  financeSettings,
  clients,
  platformFees,
  billingAllocations,
  reconciliationNotes,
  debts,
  subscriptions,
  operatingReserveSettings,
  fxConversions,
  personalTransactions,
  cashMovements,
} from "@/db/schema";
import { computeFxCashMovements } from "../fx/core";
import { getTodayWorkSessionStats } from "../work-sessions/data";
import { toUnixSeconds } from "../work-sessions/core";
import { and, eq, desc, sum } from "drizzle-orm";
import { todayISO, startOfMonthISO } from "@/utils/date";
import { revalidatePath } from "next/cache";
import { DEFAULT_CURRENCY, DEFAULT_TAX_RESERVE_PERCENT } from "./config";
import {
  CLIENT_OPERATIONAL_SESSIONS_SQL,
  computeClientOperationalMinutes,
  buildBillingEvidenceIdempotencyKey,
  computeReconciliation,
  computeEconomicLedgerPlanning,
  computeCashReconciliation,
  validateBillingEvidenceInput,
  validateContractInput,
  validateIncomeContractAttribution,
  validateFreelanceIncomeInput,
  validatePlatformFeeInput,
  validateBillingAllocationInput,
  computeDerivedProportionAllocation,
  validateDebtInput,
  computeDebtRemainingBalance,
  validateSubscriptionInput,
  computeMonthlyEquivalent,
  computeFinanceSummaryByCurrency,
  computeRateEquivalent,
  round2,
  validateOwnerPayCorrectionInput,
  validateTransactionCorrectionInput,
  type ReconciliationResult,
  type RateEquivalent,
} from "./core";
import {
  buildOwnerPayCorrectionStatements,
  buildOwnerPayStatements,
} from "./owner-pay-query";
import { getCashPocketReconciliation } from "../cash-accounts/actions";
import { computeFinanceHealth, type FinanceHealth } from "./health";

export async function getFinanceHealth(): Promise<FinanceHealth> {
  const db = await getAuthenticatedDb();
  const [businessPockets, personalPockets, businessRows, personalRows, fxRows, movementRows] =
    await Promise.all([
      getCashPocketReconciliation("BUSINESS"),
      getCashPocketReconciliation("PERSONAL"),
      db.select().from(transactions),
      db.select().from(personalTransactions),
      db.select().from(fxConversions),
      db.select({ state: cashMovements.state }).from(cashMovements),
    ]);

  const externalIdentities = new Map<string, number>();
  for (const row of [...businessRows, ...personalRows, ...fxRows]) {
    if (!row.externalSource || !row.externalId) continue;
    const key = `${row.externalSource}:${row.externalId}`;
    externalIdentities.set(key, (externalIdentities.get(key) ?? 0) + 1);
  }
  const duplicateExternalIdentities = [...externalIdentities.values()].filter((count) => count > 1).length;
  const malformedFx = fxRows.filter(
    (row) =>
      row.brlAmount <= 0 ||
      row.usdAmount <= 0 ||
      !["BUSINESS", "PERSONAL", "UNCLASSIFIED"].includes(row.scope) ||
      !row.fromCurrency,
  ).length;
  const unresolvedAttribution = businessRows.filter(
    (row) =>
      row.type === "income" &&
      row.externalSource === "WISE" &&
      row.notes?.includes("commercial client/contract/earning period unresolved"),
  ).length;

  return computeFinanceHealth({
    pocketDifferences: [...businessPockets, ...personalPockets].map((row) => row.difference),
    businessPocketIssues: Math.max(
      0,
      3 - businessPockets.filter(
        (row) => row.difference !== null && Math.abs(row.difference) < 0.005,
      ).length,
    ),
    personalPocketIssues: Math.max(
      0,
      4 - personalPockets.filter(
        (row) => row.difference !== null && Math.abs(row.difference) < 0.005,
      ).length,
    ),
    unresolvedAttribution,
    ambiguousEvidence: movementRows.filter((row) => row.state === "AMBIGUOUS").length,
    duplicateExternalIdentities,
    malformedFx,
  });
}

// ─── FINANCIAL TRUTH: transactions (existing table, extended) ──────────────

export type AddTransactionResult = { success: true } | { success: false; error: string };

// Monday Real-Operation Pre-Freeze §6: a Freelance income row REQUIRES a
// client (validateFreelanceIncomeInput) -- this is the app-level half of
// the guarantee; the DB-level half is the
// transactions_freelance_requires_client_check CHECK constraint added in
// migration 0019. contractId/debtId/subscriptionId stay optional
// provenance the same way clientId/billingEvidenceId already were.
export async function addTransaction(data: {
  type: "income" | "expense" | "owner_pay";
  amount: number;
  category: string;
  date?: string;
  notes?: string;
  currency?: string;
  billingEvidenceId?: number | null;
  clientId?: number | null;
  contractId?: number | null;
  debtId?: number | null;
  subscriptionId?: number | null;
}): Promise<AddTransactionResult> {
  // Client Portal Reality round §B: Owner Pay must always cross the
  // business/personal boundary through recordOwnerPay's atomic bridge --
  // this generic entry point accepted type:"owner_pay" with no bridge
  // call, a latent (never-exercised, but real) way to create an orphaned
  // business row with zero Personal Finance effect. Closed here rather
  // than removing the type from the parameter union, since a stray future
  // call site should get a clear error, not a silent type-widening
  // failure at the TypeScript layer alone.
  if (data.type === "owner_pay") {
    return {
      success: false,
      error: "Owner Pay must be recorded via recordOwnerPay, not addTransaction.",
    };
  }

  const date = data.date ?? todayISO();
  const currency = data.currency?.trim().toUpperCase() || DEFAULT_CURRENCY;
  const category = data.category.trim();
  const validationError = validateTransactionCorrectionInput({
    amount: data.amount,
    category,
    date,
    notes: data.notes,
    currency,
  });
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  let resolvedClientId = data.clientId ?? null;
  if (data.contractId) {
    const contractRows = await db
      .select({ clientId: commercialContracts.clientId })
      .from(commercialContracts)
      .where(eq(commercialContracts.id, data.contractId))
      .limit(1);
    const contract = contractRows[0] ?? null;
    const attributionError = validateIncomeContractAttribution({
      requestedClientId: resolvedClientId,
      contract,
    });
    if (attributionError) return { success: false, error: attributionError };
    if (!contract) return { success: false, error: "Selected contract was not found." };
    resolvedClientId = contract.clientId;
  }

  const freelanceError = validateFreelanceIncomeInput({
    category: data.category,
    type: data.type,
    clientId: resolvedClientId,
  });
  if (freelanceError) {
    return { success: false, error: freelanceError };
  }

  await db.insert(transactions).values({
    type: data.type,
    amount: data.amount,
    category,
    date,
    notes: data.notes ?? null,
    currency,
    billingEvidenceId: data.billingEvidenceId ?? null,
    clientId: resolvedClientId,
    contractId: data.contractId ?? null,
    debtId: data.debtId ?? null,
    subscriptionId: data.subscriptionId ?? null,
  });
  // FLOW CLOSURE (Sunday round): War Room reads the transactions table
  // directly for its Revenue Trend/Revenue Streak signals but this action
  // never told it to refresh, so it could show stale revenue after an
  // income/expense edit until a hard reload.
  revalidatePath("/");
  revalidatePath("/finance");
  revalidatePath("/war-room");
  return { success: true };
}

export async function deleteTransaction(id: number): Promise<AddTransactionResult> {
  const db = await getAuthenticatedDb();
  const existing = await db
    .select({ type: transactions.type })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);
  if (!existing[0]) return { success: false, error: "Transaction not found." };
  if (existing[0].type === "owner_pay") {
    return {
      success: false,
      error: "Owner Pay is paired with Personal Finance and cannot be deleted in isolation. Use Correct Owner Pay.",
    };
  }
  try {
    await db.delete(transactions).where(eq(transactions.id, id));
  } catch {
    return {
      success: false,
      error: "This transaction is linked to other financial evidence and cannot be deleted. Edit it instead.",
    };
  }
  // FLOW CLOSURE (Sunday round): War Room reads the transactions table
  // directly for its Revenue Trend/Revenue Streak signals but this action
  // never told it to refresh, so it could show stale revenue after an
  // income/expense edit until a hard reload.
  revalidatePath("/");
  revalidatePath("/finance");
  revalidatePath("/war-room");
  return { success: true };
}

export async function updateTransaction(
  id: number,
  data: {
    amount: number;
    category: string;
    date: string;
    notes?: string | null;
    currency: string;
  },
): Promise<AddTransactionResult> {
  const validationError = validateTransactionCorrectionInput(data);
  if (validationError) return { success: false, error: validationError };
  const db = await getAuthenticatedDb();
  const existing = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);
  const current = existing[0];
  if (!current) return { success: false, error: "Transaction not found." };
  if (current.type === "owner_pay") {
    return { success: false, error: "Use Correct Owner Pay for paired transfers." };
  }
  const freelanceError = validateFreelanceIncomeInput({
    category: data.category,
    type: current.type,
    clientId: current.clientId,
  });
  if (freelanceError) return { success: false, error: freelanceError };
  await db
    .update(transactions)
    .set({
      amount: data.amount,
      category: data.category.trim(),
      date: data.date,
      notes: data.notes?.trim() || null,
      currency: data.currency.trim().toUpperCase(),
    })
    .where(eq(transactions.id, id));
  // FLOW CLOSURE (Sunday round): War Room reads the transactions table
  // directly for its Revenue Trend/Revenue Streak signals but this action
  // never told it to refresh, so it could show stale revenue after an
  // income/expense edit until a hard reload.
  revalidatePath("/");
  revalidatePath("/finance");
  revalidatePath("/war-room");
  return { success: true };
}

// Owner Pay: RMEDIA CASH -> PERSONAL MONEY. Deliberately its own action
// (not just "addTransaction with a different category") so this specific,
// consequential money movement always has an explicit, greppable call
// site -- see the transactions.type comment in src/db/schema.ts for why
// this is a distinct type rather than a flavor of "expense".
export async function recordOwnerPay(data: {
  amount: number;
  currency?: string;
  date?: string;
  notes?: string;
  // Client Portal Reality round §C: client-minted, per-form-open
  // idempotency key -- same convention as recordDebtPayment/recordSubscriptionCharge
  // (see transactions.idempotencyKey's comment in src/db/schema.ts).
  // Optional so existing/future non-UI callers (e.g. a repair script)
  // aren't forced to invent one.
  idempotencyKey?: string | null;
}): Promise<AddTransactionResult> {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    return { success: false, error: "Owner Pay amount must be a positive number." };
  }
  const currency = data.currency?.trim() || DEFAULT_CURRENCY;
  const date = data.date ?? todayISO();
  const idempotencyKey =
    data.idempotencyKey?.trim() || `owner-pay:${crypto.randomUUID()}`;
  const db = await getAuthenticatedDb();

  // D1 batch is one transaction. The second statement resolves the
  // business row by its unique idempotency key, so it can insert the
  // dependent Personal receipt without guessing an auto-increment id.
  // If either statement fails, neither side survives. A replay inserts
  // neither a second business row nor a second 1:1 receipt.
  try {
    // Drizzle validates INSERT ... SELECT structurally before D1 ever sees
    // the batch: every target-table key must appear in the exact schema
    // order, including generated/defaulted columns. Omitting id/createdAt
    // made query construction throw outside the previous try/catch, which
    // is the precise cause of Finance falling into Next's generic
    // "Something went wrong" boundary on Owner Pay submission.
    const [businessInsert, personalInsert] = buildOwnerPayStatements(db, {
      amount: data.amount,
      currency,
      date,
      notes: data.notes ?? null,
      idempotencyKey,
    });

    await db.batch([businessInsert, personalInsert]);
  } catch {
    return {
      success: false,
      error: "Owner Pay could not be linked to Personal Finance, so nothing was recorded. Please try again.",
    };
  }

  revalidatePath("/finance");
  revalidatePath("/finance/personal");
  return { success: true };
}

export async function correctOwnerPay(
  transactionId: number,
  data: {
    amount: number;
    currency: string;
    date: string;
    notes?: string | null;
  },
): Promise<AddTransactionResult> {
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
    return { success: false, error: "Owner Pay transaction is invalid." };
  }
  const validationError = validateOwnerPayCorrectionInput(data);
  if (validationError) return { success: false, error: validationError };
  const db = await getAuthenticatedDb();
  const [businessRows, receiptRows] = await Promise.all([
    db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.type, "owner_pay")))
      .limit(1),
    db
      .select({ id: personalTransactions.id })
      .from(personalTransactions)
      .where(
        and(
          eq(personalTransactions.ownerPayTransactionId, transactionId),
          eq(personalTransactions.type, "owner_pay_receipt"),
        ),
      )
      .limit(1),
  ]);
  if (!businessRows[0] || !receiptRows[0]) {
    return {
      success: false,
      error: "The paired Owner Pay evidence is incomplete. Nothing was changed.",
    };
  }
  const statements = buildOwnerPayCorrectionStatements(db, transactionId, {
    amount: data.amount,
    currency: data.currency.trim().toUpperCase(),
    date: data.date,
    notes: data.notes?.trim() || null,
  });
  try {
    await db.batch(statements);
  } catch {
    return {
      success: false,
      error: "Owner Pay correction could not update both ledgers, so nothing was changed.",
    };
  }
  revalidatePath("/");
  revalidatePath("/finance");
  revalidatePath("/finance/personal");
  return { success: true };
}

// Business-scope FX conversions with a recorded direction, flattened into
// per-currency cash movements -- shared by getFinanceSummary and
// the canonical Economic Ledger Net below so every projection folds in
// exactly the same FX effect and never disagree with each other. Rows with
// no fromCurrency (legacy, or scope != BUSINESS) contribute nothing, per
// computeFxCashMovements.
async function getBusinessFxCashMovements() {
  const db = await getAuthenticatedDb();
  const businessFx = await db
    .select()
    .from(fxConversions)
    .where(eq(fxConversions.scope, "BUSINESS"));
  return businessFx.flatMap((fx) =>
    computeFxCashMovements({
      brlAmount: fx.brlAmount,
      usdAmount: fx.usdAmount,
      fromCurrency: fx.fromCurrency,
    }),
  );
}

export async function getFinanceSummary() {
  const db = await getAuthenticatedDb();
  const [allTransactions, fxMovements] = await Promise.all([
    db.select().from(transactions),
    getBusinessFxCashMovements(),
  ]);
  return computeFinanceSummaryByCurrency(allTransactions, startOfMonthISO(), fxMovements);
}

export async function getAllTransactions() {
  const db = await getAuthenticatedDb();
  return db.select().from(transactions).orderBy(transactions.date);
}

export async function getRecentIncome(limit = 10) {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.type, "income"))
    .orderBy(desc(transactions.date))
    .limit(limit);
  return rows;
}

// ─── RMEDIA CASH (§7) + TAX RESERVE (§9, experimental) ──────────────────────

export type EconomicLedgerPlanningByCurrency = {
  currency: string;
  totalIncome: number;
  totalExpenses: number;
  totalOwnerPay: number;
  economicLedgerNet: number;
  taxReserve: number;
  availableLedgerNet: number;
};

export async function getTaxReserveSettings() {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(financeSettings)
    .where(eq(financeSettings.id, 1));
  if (rows.length === 0) {
    return { taxReservePercent: DEFAULT_TAX_RESERVE_PERCENT };
  }
  return { taxReservePercent: rows[0].taxReservePercent };
}

export async function setTaxReservePercent(percent: number) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error("Tax reserve percent must be between 0 and 100.");
  }
  const db = await getAuthenticatedDb();
  const now = new Date();
  await db
    .insert(financeSettings)
    .values({ id: 1, taxReservePercent: percent, updatedAt: now })
    .onConflictDoUpdate({
      target: financeSettings.id,
      set: { taxReservePercent: percent, updatedAt: now },
    });
  revalidatePath("/finance");
}

// Grouped by currency -- never summed across currencies (no automatic FX
// this round, per the brief). Every currency that has ever appeared on a
// transaction gets its own row; a business that only ever used USD sees
// exactly one.
export async function getEconomicLedgerPlanning(): Promise<
  EconomicLedgerPlanningByCurrency[]
> {
  const [summary, settings] = await Promise.all([
    getFinanceSummary(),
    getTaxReserveSettings(),
  ]);
  return projectLedgerPlanning(summary, settings.taxReservePercent);
}

function projectLedgerPlanning(
  summary: Awaited<ReturnType<typeof getFinanceSummary>>,
  taxReservePercent: number,
): EconomicLedgerPlanningByCurrency[] {
  return summary.map((row) => {
    const planning = computeEconomicLedgerPlanning({
      totalIncome: row.totalIncome,
      economicLedgerNet: row.economicLedgerNet,
      taxReservePercent,
    });
    return {
      currency: row.currency,
      totalIncome: row.totalIncome,
      totalExpenses: row.totalExpenses,
      totalOwnerPay: row.totalOwnerPay,
      ...planning,
    };
  });
}

// Finance page reads the canonical ledger once and derives the planning
// overlay from those same rows. Other pages can keep projecting
// getFinanceSummary() without gaining a parallel formula.
export async function getFinanceOverview() {
  const [summary, settings] = await Promise.all([
    getFinanceSummary(),
    getTaxReserveSettings(),
  ]);
  return {
    summary,
    ledgerPlanning: projectLedgerPlanning(summary, settings.taxReservePercent),
  };
}

// ─── NIGHT SHIFT REALITY PATCH §6: contract rate -> attributable work value ─
//
// ATTRIBUTABLE WORK VALUE, never revenue/earned/paid. Sensor/Work Session
// time is MindBunker's own operational-involvement tracking -- a DIFFERENT
// fact from what a platform (e.g. Upwork) actually billed, which lives in
// billing_evidence and is entered separately, often conservatively, by the
// operator. This function only multiplies TODAY's attributable seconds
// (see getTodayWorkSessionStats, resolved via the same America/Sao_Paulo
// day-boundary convention as the rest of this patch) by an ACTIVE HOURLY
// contract's own rate. It creates zero Finance transactions and is never
// written to the transactions table -- see computeRateEquivalent's own
// comment in finance/core.ts for the full invariant.
export type TodayRateEquivalentRow = RateEquivalent & {
  clientId: number;
  clientName: string;
};

export async function getTodayRateEquivalents(): Promise<TodayRateEquivalentRow[]> {
  const db = await getAuthenticatedDb();
  const [hourlyContracts, todayStats] = await Promise.all([
    db
      .select({
        clientId: commercialContracts.clientId,
        clientName: clients.name,
        hourlyRate: commercialContracts.hourlyRate,
        currency: commercialContracts.currency,
      })
      .from(commercialContracts)
      .innerJoin(clients, eq(commercialContracts.clientId, clients.id))
      .where(
        and(
          eq(commercialContracts.billingType, "HOURLY"),
          eq(commercialContracts.status, "ACTIVE"),
        ),
      ),
    getTodayWorkSessionStats(),
  ]);

  const rows: TodayRateEquivalentRow[] = [];
  for (const contract of hourlyContracts) {
    if (contract.hourlyRate === null) continue; // only show when all required facts are explicit
    const seconds = todayStats.byClient.find((c) => c.clientId === contract.clientId)?.seconds ?? 0;
    if (seconds <= 0) continue; // omit the money entirely when attribution is absent, never show $0 as if it were a fact
    rows.push({
      clientId: contract.clientId,
      clientName: contract.clientName,
      ...computeRateEquivalent(seconds, contract.hourlyRate, contract.currency),
    });
  }
  return rows;
}

// ─── BILLING TRUTH: commercial contracts + billing evidence ────────────────

export type CommercialContractRow = {
  id: number;
  clientId: number;
  clientName: string;
  platform: string;
  externalReference: string | null;
  billingType: "HOURLY" | "FIXED";
  hourlyRate: number | null;
  currency: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  notes: string | null;
  createdAt: Date | null;
};

const CONTRACT_SELECT_SHAPE = {
  id: commercialContracts.id,
  clientId: commercialContracts.clientId,
  clientName: clients.name,
  platform: commercialContracts.platform,
  externalReference: commercialContracts.externalReference,
  billingType: commercialContracts.billingType,
  hourlyRate: commercialContracts.hourlyRate,
  currency: commercialContracts.currency,
  status: commercialContracts.status,
  notes: commercialContracts.notes,
  createdAt: commercialContracts.createdAt,
} as const;

export async function createCommercialContract(data: {
  clientId: number;
  platform: string;
  externalReference?: string | null;
  billingType: "HOURLY" | "FIXED";
  hourlyRate?: number | null;
  currency: string;
  status?: "ACTIVE" | "PAUSED" | "ENDED";
  notes?: string | null;
}) {
  const error = validateContractInput({
    clientId: data.clientId,
    platform: data.platform,
    billingType: data.billingType,
    hourlyRate: data.hourlyRate ?? null,
    currency: data.currency,
  });
  if (error) throw new Error(error);

  const db = await getAuthenticatedDb();
  const inserted = await db
    .insert(commercialContracts)
    .values({
      clientId: data.clientId,
      platform: data.platform.trim(),
      externalReference: data.externalReference?.trim() || null,
      billingType: data.billingType,
      hourlyRate: data.billingType === "HOURLY" ? data.hourlyRate ?? null : null,
      currency: data.currency.trim(),
      status: data.status ?? "ACTIVE",
      notes: data.notes?.trim() || null,
    })
    .returning({ id: commercialContracts.id });

  revalidatePath("/finance/contracts");
  revalidatePath("/finance");
  return inserted[0].id;
}

export async function getCommercialContracts(): Promise<
  CommercialContractRow[]
> {
  const db = await getAuthenticatedDb();
  return db
    .select(CONTRACT_SELECT_SHAPE)
    .from(commercialContracts)
    .innerJoin(clients, eq(clients.id, commercialContracts.clientId))
    .orderBy(desc(commercialContracts.createdAt));
}

export async function getCommercialContractById(
  id: number,
): Promise<CommercialContractRow | null> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select(CONTRACT_SELECT_SHAPE)
    .from(commercialContracts)
    .innerJoin(clients, eq(clients.id, commercialContracts.clientId))
    .where(eq(commercialContracts.id, id));
  return rows[0] ?? null;
}

export async function recordBillingEvidence(data: {
  contractId: number;
  periodStart: string;
  periodEnd: string;
  billableMinutes: number;
  rate: number;
  grossAmount: number;
  currency: string;
  source: "MANUAL" | "CSV_IMPORT" | "UPWORK_REPORT";
  externalReference?: string | null;
}): Promise<{ created: boolean; id: number }> {
  const error = validateBillingEvidenceInput({
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    billableMinutes: data.billableMinutes,
    rate: data.rate,
    grossAmount: data.grossAmount,
    currency: data.currency,
  });
  if (error) throw new Error(error);

  const idempotencyKey = buildBillingEvidenceIdempotencyKey({
    contractId: data.contractId,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    source: data.source,
    externalReference: data.externalReference,
  });

  const db = await getAuthenticatedDb();

  // Idempotency check first (a friendlier "already imported" result) --
  // the unique index on billing_evidence.idempotency_key is the actual
  // guarantee; this lookup just avoids a thrown constraint error on the
  // common, expected re-import case.
  const existing = await db
    .select({ id: billingEvidence.id })
    .from(billingEvidence)
    .where(eq(billingEvidence.idempotencyKey, idempotencyKey));

  if (existing.length > 0) {
    return { created: false, id: existing[0].id };
  }

  const inserted = await db
    .insert(billingEvidence)
    .values({
      contractId: data.contractId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      billableMinutes: Math.round(data.billableMinutes),
      rate: data.rate,
      grossAmount: data.grossAmount,
      currency: data.currency.trim(),
      source: data.source,
      externalReference: data.externalReference?.trim() || null,
      idempotencyKey,
    })
    .returning({ id: billingEvidence.id });

  revalidatePath("/finance/contracts");
  revalidatePath(`/finance/contracts/${data.contractId}`);
  return { created: true, id: inserted[0].id };
}

export async function getBillingEvidenceForContract(contractId: number) {
  const db = await getAuthenticatedDb();
  return db
    .select()
    .from(billingEvidence)
    .where(eq(billingEvidence.contractId, contractId))
    .orderBy(desc(billingEvidence.periodStart));
}

// ─── RECONCILIATION (§6) ─────────────────────────────────────────────────

export type ContractReconciliation = ReconciliationResult & {
  contractId: number;
  periodStart: string;
  periodEnd: string;
  billingEvidenceId: number | null;
  openSessionCount: number;
};

async function getClientOperationalMinutes(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<{ minutes: number; openSessionCount: number }> {
  const db = await getAuthenticatedDb();
  // DR-2 fix: the old query pre-aggregated in SQL using a UTC day boundary
  // (`date(ws.started_at, 'unixepoch')`) and no video_kind filter, which let
  // SAMPLE/INTERNAL session time inflate client billing reconciliation and
  // misattributed sessions near local midnight to the wrong operator day.
  // Fix follows this codebase's own established pattern (see
  // WORK_SESSION_ATTRIBUTION_SQL + computeTodayWorkSessionStats): fetch a
  // generously-bounded set of raw rows via SQL, then filter/aggregate exactly
  // in JS using the canonical dayKeyFor timezone boundary and the canonical
  // CLIENT_WORK-only production predicate. Bounds are widened by a day on
  // each side of the UTC-midnight reading of periodStart/periodEnd so no
  // session that could fall within the operator-local period is excluded by
  // the SQL fetch itself -- the exact-day filtering happens in
  // computeClientOperationalMinutes, not here.
  const lowerBoundSeconds =
    toUnixSeconds(new Date(`${periodStart}T00:00:00Z`)) - 24 * 60 * 60;
  const upperBoundSeconds =
    toUnixSeconds(new Date(`${periodEnd}T00:00:00Z`)) + 2 * 24 * 60 * 60;
  const { results } = await db.$client
    .prepare(CLIENT_OPERATIONAL_SESSIONS_SQL)
    .bind(clientId, lowerBoundSeconds, upperBoundSeconds)
    .all<{ started_at: number; ended_at: number | null; video_kind: string }>();
  const rows = (results ?? []).map((row) => ({
    startedAt: row.started_at,
    endedAt: row.ended_at,
    videoKind: row.video_kind,
  }));
  return computeClientOperationalMinutes(rows, periodStart, periodEnd);
}

// Reconciles one contract for one exact period. If billing evidence for
// that exact period has not been registered yet, the billed/derived side
// comes back UNATTRIBUTED (see computeReconciliation) -- operational
// minutes are still reported, because that half of the truth already
// exists regardless of what Upwork has or hasn't said yet.
export async function getContractReconciliation(
  contractId: number,
  periodStart: string,
  periodEnd: string,
): Promise<ContractReconciliation | null> {
  const contract = await getCommercialContractById(contractId);
  if (!contract) return null;

  const db = await getAuthenticatedDb();
  const [operational, evidenceRows] = await Promise.all([
    getClientOperationalMinutes(contract.clientId, periodStart, periodEnd),
    db
      .select()
      .from(billingEvidence)
      .where(eq(billingEvidence.contractId, contractId)),
  ]);

  const evidence =
    evidenceRows.find(
      (e) => e.periodStart === periodStart && e.periodEnd === periodEnd,
    ) ?? null;

  const result = computeReconciliation({
    operationalMinutes: operational.minutes,
    billingEvidence: evidence
      ? {
          billableMinutes: evidence.billableMinutes,
          rate: evidence.rate,
          grossAmount: evidence.grossAmount,
          currency: evidence.currency,
        }
      : null,
  });

  return {
    ...result,
    contractId,
    periodStart,
    periodEnd,
    billingEvidenceId: evidence?.id ?? null,
    openSessionCount: operational.openSessionCount,
  };
}

// "Reconciliation requiring attention" for the Finance summary (§11): the
// most recent billing-evidence period per ACTIVE contract, where a
// mismatch actually exists. A contract with no billing evidence yet, or
// with matching hours, does not show up here -- this list is for the
// cases that actually need a look, not a status board for every contract.
const RECONCILIATION_ATTENTION_THRESHOLD_MINUTES = 1;

export async function getReconciliationRequiringAttention(): Promise<
  Array<
    ContractReconciliation & { clientName: string; platform: string }
  >
> {
  const contracts = await getCommercialContracts();
  const results: Array<
    ContractReconciliation & { clientName: string; platform: string }
  > = [];

  for (const contract of contracts) {
    const db = await getAuthenticatedDb();
    const latestEvidence = await db
      .select()
      .from(billingEvidence)
      .where(eq(billingEvidence.contractId, contract.id))
      .orderBy(desc(billingEvidence.periodEnd))
      .limit(1);

    if (latestEvidence.length === 0) continue;
    const evidence = latestEvidence[0];

    const reconciliation = await getContractReconciliation(
      contract.id,
      evidence.periodStart,
      evidence.periodEnd,
    );
    if (!reconciliation) continue;

    const diff = reconciliation.differenceMinutes.value;
    if (diff !== null && Math.abs(diff) >= RECONCILIATION_ATTENTION_THRESHOLD_MINUTES) {
      results.push({
        ...reconciliation,
        clientName: contract.clientName,
        platform: contract.platform,
      });
    }
  }

  return results;
}

// ─── PLATFORM FEES (§8/§10) ─────────────────────────────────────────────────

export async function recordPlatformFee(data: {
  billingEvidenceId: number;
  amount: number;
  currency: string;
  occurredAt?: string | null;
  source: "MANUAL" | "CSV_IMPORT" | "UPWORK_REPORT";
  notes?: string | null;
}): Promise<AddTransactionResult> {
  const validationError = validatePlatformFeeInput(data);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  await db.insert(platformFees).values({
    billingEvidenceId: data.billingEvidenceId,
    amount: data.amount,
    currency: data.currency,
    occurredAt: data.occurredAt ?? null,
    source: data.source,
    notes: data.notes ?? null,
  });
  revalidatePath("/finance/contracts");
  return { success: true };
}

export async function getPlatformFeesForEvidence(billingEvidenceId: number) {
  const db = await getAuthenticatedDb();
  return db
    .select()
    .from(platformFees)
    .where(eq(platformFees.billingEvidenceId, billingEvidenceId))
    .orderBy(desc(platformFees.createdAt));
}

// §8/§10: the full gross/fee/derived-net/cash/difference picture for one
// billing evidence row, with every field provenance-tagged. cashReceived
// is summed from linked transactions (billingEvidenceId), never a
// separately-typed field -- see computeCashReconciliation in core.ts for
// why grossBilled/platformFeesTotal/derivedNetProceeds/cashReceived/
// differenceFromDerivedNet are never silently reconciled away.
export async function getCashReconciliationForEvidence(billingEvidenceId: number) {
  const db = await getAuthenticatedDb();
  const [evidenceRows, fees, linkedTransactions] = await Promise.all([
    db.select().from(billingEvidence).where(eq(billingEvidence.id, billingEvidenceId)).limit(1),
    db.select().from(platformFees).where(eq(platformFees.billingEvidenceId, billingEvidenceId)),
    db.select().from(transactions).where(eq(transactions.billingEvidenceId, billingEvidenceId)),
  ]);
  const evidence = evidenceRows[0];
  if (!evidence) return null;

  const cashReceived =
    linkedTransactions.length > 0
      ? round2(linkedTransactions.reduce((sum, t) => sum + t.amount, 0))
      : null;

  return computeCashReconciliation({
    grossBilled: evidence.grossAmount,
    platformFees: fees.map((f) => f.amount),
    cashReceived,
    currency: evidence.currency,
  });
}

// ─── BILLING ALLOCATIONS (§13) ──────────────────────────────────────────────

export async function recordBillingAllocation(data: {
  billingEvidenceId: number;
  videoId: number | null;
  method: "MANUAL_AMOUNT" | "MANUAL_MINUTES" | "DERIVED_PROPORTION";
  amount: number;
  minutes?: number | null;
  currency: string;
  notes?: string | null;
}): Promise<AddTransactionResult> {
  const validationError = validateBillingAllocationInput(data);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  await db.insert(billingAllocations).values({
    billingEvidenceId: data.billingEvidenceId,
    videoId: data.videoId,
    method: data.method,
    amount: data.amount,
    minutes: data.minutes ?? null,
    currency: data.currency,
    notes: data.notes ?? null,
  });
  revalidatePath("/finance/contracts");
  return { success: true };
}

export async function getBillingAllocationsForEvidence(billingEvidenceId: number) {
  const db = await getAuthenticatedDb();
  return db
    .select()
    .from(billingAllocations)
    .where(eq(billingAllocations.billingEvidenceId, billingEvidenceId))
    .orderBy(desc(billingAllocations.createdAt));
}

// Preview only -- computes the DERIVED_PROPORTION slices from tracked
// operational minutes per video, but does NOT persist anything. Emmanuel
// reviews the calculation (see computeDerivedProportionAllocation for the
// "0434+0435 account for 70%..." style breakdown) and explicitly confirms
// via recordBillingAllocation before it becomes a stored, provenance-tagged
// row -- §13's "Do not persist derived attribution as source fact without
// explicit approval."
export async function previewDerivedBillingAllocation(
  grossAmount: number,
  videoMinutes: Array<{ videoId: number; minutes: number }>,
) {
  return computeDerivedProportionAllocation({ grossAmount, videoMinutes });
}

// ─── RECONCILIATION NOTES (§11) ─────────────────────────────────────────────

export async function recordReconciliationNote(data: {
  contractId: number;
  date: string;
  note: string;
  videoId?: number | null;
}): Promise<AddTransactionResult> {
  if (!Number.isSafeInteger(data.contractId) || data.contractId <= 0) {
    return { success: false, error: "A contract is required." };
  }
  if (!data.date) return { success: false, error: "A date is required." };
  if (!data.note.trim()) return { success: false, error: "Note cannot be empty." };

  const db = await getAuthenticatedDb();
  await db.insert(reconciliationNotes).values({
    contractId: data.contractId,
    date: data.date,
    note: data.note.trim(),
    videoId: data.videoId ?? null,
  });
  revalidatePath("/finance/contracts");
  return { success: true };
}

export async function getReconciliationNotesForContract(contractId: number) {
  const db = await getAuthenticatedDb();
  return db
    .select()
    .from(reconciliationNotes)
    .where(eq(reconciliationNotes.contractId, contractId))
    .orderBy(desc(reconciliationNotes.date));
}

// ─── DEBTS (§16) ─────────────────────────────────────────────────────────────

export async function createDebt(data: {
  name: string;
  creditor: string;
  originalAmount: number;
  currency: string;
  notes?: string | null;
}): Promise<AddTransactionResult> {
  const validationError = validateDebtInput(data);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  await db.insert(debts).values({
    name: data.name.trim(),
    creditor: data.creditor.trim(),
    originalAmount: data.originalAmount,
    currency: data.currency,
    notes: data.notes ?? null,
  });
  revalidatePath("/finance/debts");
  return { success: true };
}

// A debt payment is an ordinary expense transaction carrying debtId
// provenance (see the debts.remainingBalance comment in db/schema.ts) --
// NOT a second ledger. Marks the debt PAID when the new remaining balance
// reaches zero.
export async function recordDebtPayment(data: {
  debtId: number;
  amount: number;
  date?: string;
  notes?: string | null;
  // Taryn August Ingest Readiness §2/§12: client-minted, per-form-open
  // idempotency key. See transactions.idempotencyKey comment in
  // src/db/schema.ts for why this differs from
  // buildBillingEvidenceIdempotencyKey's deterministic content hash.
  idempotencyKey?: string | null;
}): Promise<AddTransactionResult> {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    return { success: false, error: "Payment amount must be positive." };
  }
  const db = await getAuthenticatedDb();

  if (data.idempotencyKey) {
    const already = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.idempotencyKey, data.idempotencyKey))
      .limit(1);
    if (already.length > 0) {
      // Same submit already recorded -- a double-click/retry replay, not
      // a second payment. Report success without inserting again.
      return { success: true };
    }
  }

  const debtRows = await db.select().from(debts).where(eq(debts.id, data.debtId)).limit(1);
  const debt = debtRows[0];
  if (!debt) return { success: false, error: "Debt not found." };

  try {
    await db.insert(transactions).values({
      type: "expense",
      amount: data.amount,
      category: `Debt payment — ${debt.name}`,
      date: data.date ?? todayISO(),
      notes: data.notes ?? null,
      currency: debt.currency,
      debtId: debt.id,
      idempotencyKey: data.idempotencyKey ?? null,
    });
  } catch (err) {
    if (data.idempotencyKey) return { success: true };
    throw err;
  }

  await recomputeDebtStatus(db, debt.id);

  revalidatePath("/finance/debts");
  return { success: true };
}

// §3/§12: "REAL OPERATIONAL RECORDS MUST BE CORRECTABLE." A debt payment
// entered with the wrong amount/date, or twice by mistake, is corrected
// by editing/deleting the transaction row directly -- NEVER by inserting
// a second offsetting entry -- so paid/remaining stay derivable by a
// plain SUM (see debts.remainingBalance comment). Never touches a
// transaction that isn't actually a debt-payment expense row.
export async function updateDebtPayment(data: {
  paymentId: number;
  amount: number;
  date?: string;
  notes?: string | null;
}): Promise<AddTransactionResult> {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    return { success: false, error: "Payment amount must be positive." };
  }
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(transactions).where(eq(transactions.id, data.paymentId)).limit(1);
  const payment = rows[0];
  if (!payment || payment.debtId === null || payment.type !== "expense") {
    return { success: false, error: "Debt payment not found." };
  }

  await db
    .update(transactions)
    .set({
      amount: data.amount,
      date: data.date ?? payment.date,
      notes: data.notes ?? null,
    })
    .where(eq(transactions.id, data.paymentId));

  await recomputeDebtStatus(db, payment.debtId);

  revalidatePath("/finance/debts");
  return { success: true };
}

export async function deleteDebtPayment(paymentId: number): Promise<AddTransactionResult> {
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(transactions).where(eq(transactions.id, paymentId)).limit(1);
  const payment = rows[0];
  if (!payment || payment.debtId === null || payment.type !== "expense") {
    return { success: false, error: "Debt payment not found." };
  }
  const debtId = payment.debtId;
  await db.delete(transactions).where(eq(transactions.id, paymentId));
  await recomputeDebtStatus(db, debtId);

  revalidatePath("/finance/debts");
  return { success: true };
}

// Shared by recordDebtPayment/updateDebtPayment/deleteDebtPayment: the
// debt's ACTIVE/PAID status always reflects the CURRENT derived
// remainingBalance, recomputed from scratch -- including reverting PAID
// back to ACTIVE if editing/deleting a payment pushes the balance back
// above zero. Never trust a caller's belief about whether the debt is
// now paid off.
async function recomputeDebtStatus(
  db: Awaited<ReturnType<typeof getAuthenticatedDb>>,
  debtId: number,
): Promise<void> {
  const debtRows = await db.select().from(debts).where(eq(debts.id, debtId)).limit(1);
  const debt = debtRows[0];
  if (!debt) return;
  const paid = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(eq(transactions.debtId, debtId));
  const paidTotal = Number(paid[0]?.total ?? 0);
  const remaining = computeDebtRemainingBalance({
    originalAmount: debt.originalAmount,
    paymentsTotal: paidTotal,
  });
  const nextStatus = remaining <= 0 ? "PAID" : "ACTIVE";
  if (debt.status !== nextStatus) {
    await db.update(debts).set({ status: nextStatus }).where(eq(debts.id, debtId));
  }
}

export async function getDebts() {
  const db = await getAuthenticatedDb();
  const [allDebts, paymentTotals] = await Promise.all([
    db.select().from(debts),
    db
      .select({ debtId: transactions.debtId, total: sum(transactions.amount) })
      .from(transactions)
      .where(eq(transactions.type, "expense"))
      .groupBy(transactions.debtId),
  ]);
  const paidByDebt = new Map(
    paymentTotals
      .filter((p) => p.debtId !== null)
      .map((p) => [p.debtId as number, Number(p.total ?? 0)]),
  );
  return allDebts.map((d) => ({
    ...d,
    paidTotal: round2(paidByDebt.get(d.id) ?? 0),
    remainingBalance: computeDebtRemainingBalance({
      originalAmount: d.originalAmount,
      paymentsTotal: paidByDebt.get(d.id) ?? 0,
    }),
  }));
}

export async function getDebtById(id: number) {
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(debts).where(eq(debts.id, id)).limit(1);
  const debt = rows[0];
  if (!debt) return null;
  const payments = await db
    .select()
    .from(transactions)
    .where(eq(transactions.debtId, id))
    .orderBy(desc(transactions.date));
  const paidTotal = round2(payments.reduce((sum, p) => sum + p.amount, 0));
  return {
    ...debt,
    payments,
    paidTotal,
    remainingBalance: computeDebtRemainingBalance({
      originalAmount: debt.originalAmount,
      paymentsTotal: paidTotal,
    }),
  };
}

// ─── SUBSCRIPTIONS (§17/§18) ────────────────────────────────────────────────

export async function createSubscription(data: {
  name: string;
  vendor: string;
  amount: number;
  currency: string;
  cadence: "MONTHLY" | "ANNUAL";
  renewalDate?: string | null;
  category?: string | null;
  notes?: string | null;
}): Promise<AddTransactionResult> {
  const validationError = validateSubscriptionInput(data);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  await db.insert(subscriptions).values({
    name: data.name.trim(),
    vendor: data.vendor.trim(),
    amount: data.amount,
    currency: data.currency,
    cadence: data.cadence,
    renewalDate: data.renewalDate ?? null,
    category: data.category ?? null,
    notes: data.notes ?? null,
  });
  revalidatePath("/finance/subscriptions");
  return { success: true };
}

export async function recordSubscriptionPayment(data: {
  subscriptionId: number;
  amount?: number;
  date?: string;
  notes?: string | null;
  // Taryn August Ingest Readiness §2 (P0 safety fix): the Record Charge
  // confirm modal mints one key per form-open and disables its own submit
  // button, but the key is the actual server-side guarantee -- a
  // double-submit (double click, or a retried request) can never insert
  // two expense transactions for the same confirmed charge.
  idempotencyKey?: string | null;
}): Promise<AddTransactionResult> {
  const db = await getAuthenticatedDb();

  if (data.idempotencyKey) {
    const already = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.idempotencyKey, data.idempotencyKey))
      .limit(1);
    if (already.length > 0) {
      return { success: true };
    }
  }

  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, data.subscriptionId))
    .limit(1);
  const subscription = rows[0];
  if (!subscription) return { success: false, error: "Subscription not found." };

  const amount = data.amount ?? subscription.amount;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Payment amount must be positive." };
  }

  try {
    await db.insert(transactions).values({
      type: "expense",
      amount,
      category: `Subscription — ${subscription.name}`,
      date: data.date ?? todayISO(),
      notes: data.notes ?? null,
      currency: subscription.currency,
      subscriptionId: subscription.id,
      idempotencyKey: data.idempotencyKey ?? null,
    });
  } catch (err) {
    if (data.idempotencyKey) return { success: true };
    throw err;
  }

  revalidatePath("/finance/subscriptions");
  revalidatePath(`/finance/subscriptions/${subscription.id}`);
  return { success: true };
}

export async function updateSubscriptionStatus(
  id: number,
  status: "ACTIVE" | "CANCELLED" | "TRIAL",
): Promise<AddTransactionResult> {
  const db = await getAuthenticatedDb();
  await db.update(subscriptions).set({ status }).where(eq(subscriptions.id, id));
  revalidatePath("/finance/subscriptions");
  revalidatePath(`/finance/subscriptions/${id}`);
  return { success: true };
}

export async function getSubscriptions() {
  const db = await getAuthenticatedDb();
  return db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
}

export async function getSubscriptionById(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .limit(1);
  const subscription = rows[0];
  if (!subscription) return null;
  const payments = await db
    .select()
    .from(transactions)
    .where(eq(transactions.subscriptionId, id))
    .orderBy(desc(transactions.date), desc(transactions.id));
  return {
    ...subscription,
    monthlyEquivalent: computeMonthlyEquivalent(subscription),
    payments,
  };
}

// §18: MONTHLY RECURRING / ANNUAL COMMITTED / MONTHLY EQUIVALENT / UPCOMING
// RENEWALS, grouped by currency -- "Never sum USD+BRL silently."
export async function getSubscriptionSummary() {
  const db = await getAuthenticatedDb();
  const all = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.status, "ACTIVE"));

  const byCurrency = new Map<
    string,
    { monthlyRecurring: number; annualCommitted: number; monthlyEquivalent: number }
  >();
  for (const s of all) {
    const bucket = byCurrency.get(s.currency) ?? {
      monthlyRecurring: 0,
      annualCommitted: 0,
      monthlyEquivalent: 0,
    };
    if (s.cadence === "MONTHLY") bucket.monthlyRecurring += s.amount;
    else bucket.annualCommitted += s.amount;
    bucket.monthlyEquivalent += computeMonthlyEquivalent({
      amount: s.amount,
      cadence: s.cadence,
    });
    byCurrency.set(s.currency, bucket);
  }

  const upcomingRenewals = all
    .filter((s) => s.renewalDate)
    .sort((a, b) => (a.renewalDate ?? "").localeCompare(b.renewalDate ?? ""))
    .slice(0, 10);

  return {
    byCurrency: Array.from(byCurrency.entries()).map(([currency, totals]) => ({
      currency,
      monthlyRecurring: round2(totals.monthlyRecurring),
      annualCommitted: round2(totals.annualCommitted),
      monthlyEquivalent: round2(totals.monthlyEquivalent),
    })),
    upcomingRenewals,
  };
}

// ─── OPERATING COST RESERVE (§11) ───────────────────────────────────────────
// Minimal extension, NOT a treasury subsystem: a single target amount plus
// a DERIVED "reserved so far" total (sum of expense transactions tagged
// category = 'Operating Reserve'), same derived-balance discipline as
// debts.remainingBalance. Conceptually distinct from Owner Pay / Tax
// Reserve / general cash (§11) -- it is simply another expense category
// with its own read model, not a second ledger or a Wise integration.

const OPERATING_RESERVE_CATEGORY = "Operating Reserve";

export async function getOperatingReserveSettings() {
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(operatingReserveSettings).where(eq(operatingReserveSettings.id, 1));
  return rows[0] ?? { id: 1, targetAmount: null, currency: DEFAULT_CURRENCY, notes: null, updatedAt: null };
}

export async function setOperatingReserveTarget(data: {
  targetAmount: number | null;
  currency?: string;
  notes?: string | null;
}): Promise<AddTransactionResult> {
  if (data.targetAmount !== null && (!Number.isFinite(data.targetAmount) || data.targetAmount < 0)) {
    return { success: false, error: "Target amount must be zero or positive." };
  }
  const db = await getAuthenticatedDb();
  const existing = await db.select().from(operatingReserveSettings).where(eq(operatingReserveSettings.id, 1));
  if (existing.length > 0) {
    await db
      .update(operatingReserveSettings)
      .set({
        targetAmount: data.targetAmount,
        currency: data.currency?.trim() || DEFAULT_CURRENCY,
        notes: data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(operatingReserveSettings.id, 1));
  } else {
    await db.insert(operatingReserveSettings).values({
      id: 1,
      targetAmount: data.targetAmount,
      currency: data.currency?.trim() || DEFAULT_CURRENCY,
      notes: data.notes ?? null,
      updatedAt: new Date(),
    });
  }
  revalidatePath("/finance");
  return { success: true };
}

// Records a contribution TOWARD the reserve as an ordinary expense
// transaction (category = 'Operating Reserve') -- money leaving general
// RMEDIA cash into the earmarked Wise balance. This still shows up in
// normal expense totals (it is real money that left general cash); the
// reserve summary below is what tells the earmarked-vs-general story.
export async function recordOperatingReserveContribution(data: {
  amount: number;
  currency?: string;
  date?: string;
  notes?: string | null;
}): Promise<AddTransactionResult> {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    return { success: false, error: "Contribution amount must be positive." };
  }
  const db = await getAuthenticatedDb();
  await db.insert(transactions).values({
    type: "expense",
    amount: data.amount,
    category: OPERATING_RESERVE_CATEGORY,
    date: data.date ?? todayISO(),
    notes: data.notes ?? null,
    currency: data.currency?.trim() || DEFAULT_CURRENCY,
  });
  revalidatePath("/finance");
  return { success: true };
}

export async function getOperatingReserveSummary() {
  const db = await getAuthenticatedDb();
  const [settings, contributions] = await Promise.all([
    getOperatingReserveSettings(),
    db
      .select()
      .from(transactions)
      .where(eq(transactions.category, OPERATING_RESERVE_CATEGORY)),
  ]);
  const reservedSoFar = round2(
    contributions.reduce((sum, t) => sum + t.amount, 0),
  );
  return {
    targetAmount: settings.targetAmount,
    currency: settings.currency,
    reservedSoFar,
    remainingToTarget:
      settings.targetAmount === null ? null : round2(Math.max(0, settings.targetAmount - reservedSoFar)),
    notes: settings.notes,
  };
}
