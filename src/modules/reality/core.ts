export type RealityStatus = "GREEN" | "YELLOW" | "RED";
export type CommercialModel = "HOURLY" | "FIXED" | "MIXED" | "UNCLEAR";

export type ContractFact = {
  id: number;
  billingType: "HOURLY" | "FIXED";
  hourlyRate: number | null;
  currency: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  platform?: string | null;
};

export type BillingEvidenceFact = {
  periodEnd: string;
  grossAmount: number;
  currency: string;
  earningDate: string | null;
};

export type PaymentRequestFact = {
  id: number;
  amountCents: number;
  currency: string;
  status: "OPEN" | "PAID" | "CANCELLED";
  createdAt: number;
  note: string | null;
};

export type SessionFact = { startedAt: number; endedAt: number | null };

export type CommercialPosition = {
  model: CommercialModel;
  currency: string | null;
  hourlyRate: number | null;
  platform: string | null;
  valueAuthority: "DIRECT_TIME" | "EXTERNAL_PLATFORM" | "FIXED_SCOPE" | "MIXED" | "UNKNOWN";
  lastRequest: PaymentRequestFact | null;
  previousRequest: PaymentRequestFact | null;
  currentRequest: PaymentRequestFact | null;
  paidAgainstCurrent: number;
  unpaidRequested: number;
  supportedDeltaInCurrent: number | null;
  draftDeltaAfterCurrent: number | null;
  expectedNewValue: number | null;
  expectedMinutes: number | null;
  expectedValueState: "ESTIMATED" | "EXTERNAL_SOURCE" | "FIXED_SCOPE" | "MIXED_MODEL" | "INSUFFICIENT_EVIDENCE";
  expectedValueBasis: string;
  requestDraftReadiness: "CAN_PREPARE" | "NOTHING_NEW" | "UNSUPPORTED";
  currentOpenTotal: number;
  includedMinutes: number | null;
  draftMinutes: number | null;
  evidenceCutoff: number | null;
  externalEvidenceThrough: string | null;
  readiness: "REQUESTED" | "READY_TO_REQUEST" | "PARTIAL" | "UNKNOWN";
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function summarizeTopApplications(
  rows: readonly { appKey: string; seconds: number }[],
  limit = 5,
) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.appKey, (totals.get(row.appKey) ?? 0) + row.seconds);
  return [...totals.entries()]
    .map(([appKey, seconds]) => ({ appKey, seconds }))
    .sort((a, b) => b.seconds - a.seconds || a.appKey.localeCompare(b.appKey))
    .slice(0, Math.max(0, limit));
}

export function classifyCommercialModel(contracts: readonly ContractFact[]): CommercialModel {
  const active = contracts.filter((contract) => contract.status === "ACTIVE");
  const types = new Set(active.map((contract) => contract.billingType));
  if (types.size === 0) return "UNCLEAR";
  if (types.size > 1) return "MIXED";
  return types.has("HOURLY") ? "HOURLY" : "FIXED";
}

function completeMinutesBetween(
  sessions: readonly SessionFact[],
  startExclusive: number,
  endInclusive: number,
): { minutes: number; cutoff: number | null } {
  const included = sessions.filter(
    (session): session is SessionFact & { endedAt: number } =>
      session.endedAt !== null &&
      session.startedAt > startExclusive &&
      session.startedAt <= endInclusive,
  );
  const seconds = included.reduce(
    (total, session) => total + Math.max(0, session.endedAt - session.startedAt),
    0,
  );
  return {
    // The payment-request evidence uses whole tracked minutes. Seconds stay
    // preserved in work_sessions but never silently turn into a higher ask.
    minutes: Math.floor(seconds / 60),
    cutoff: included.reduce<number | null>(
      (latest, session) => (latest === null ? session.endedAt : Math.max(latest, session.endedAt)),
      null,
    ),
  };
}

function isExternallyMeteredPlatform(platform: string | null | undefined) {
  return platform?.trim().toLowerCase() === "upwork";
}

export function deriveCommercialPosition(input: {
  contracts: readonly ContractFact[];
  requests: readonly PaymentRequestFact[];
  sessions: readonly SessionFact[];
  billingEvidence?: readonly BillingEvidenceFact[];
  paidTransactions: readonly { amount: number; currency: string; occurredAt: number }[];
  nowSeconds: number;
}): CommercialPosition {
  const model = classifyCommercialModel(input.contracts);
  const sortedRequests = [...input.requests].sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
  const lastRequest = sortedRequests.at(-1) ?? null;
  const currentRequest = [...sortedRequests].reverse().find((request) => request.status === "OPEN") ?? null;
  const previousRequest = currentRequest
    ? [...sortedRequests].reverse().find((request) => request.createdAt < currentRequest.createdAt) ?? null
    : sortedRequests.at(-1) ?? null;
  const activeHourly = input.contracts.find(
    (contract) => contract.status === "ACTIVE" && contract.billingType === "HOURLY",
  );
  const activeContract = input.contracts.find((contract) => contract.status === "ACTIVE") ?? null;
  const platform = activeContract?.platform ?? null;
  const externalPlatform = model === "HOURLY" && isExternallyMeteredPlatform(platform);
  const currency = currentRequest?.currency ?? activeHourly?.currency ?? input.contracts[0]?.currency ?? null;
  const paidAgainstCurrent = currentRequest
    ? roundMoney(input.paidTransactions
        .filter((transaction) => transaction.currency === currentRequest.currency && transaction.occurredAt >= currentRequest.createdAt)
        .reduce((total, transaction) => total + transaction.amount, 0))
    : 0;

  let supportedDeltaInCurrent: number | null = null;
  let draftDeltaAfterCurrent: number | null = null;
  let includedMinutes: number | null = null;
  let draftMinutes: number | null = null;
  let evidenceCutoff: number | null = null;
  let externalEvidenceThrough: string | null = null;
  let valueAuthority: CommercialPosition["valueAuthority"] = "UNKNOWN";
  let expectedValueState: CommercialPosition["expectedValueState"] = "INSUFFICIENT_EVIDENCE";
  let expectedValueBasis = "No supported commercial basis.";

  if (externalPlatform) {
    valueAuthority = "EXTERNAL_PLATFORM";
    expectedValueState = "EXTERNAL_SOURCE";
    expectedValueBasis = `${platform} billing evidence controls commercial value; tracked time is operational context only.`;
    externalEvidenceThrough = [...(input.billingEvidence ?? [])]
      .map((row) => row.periodEnd)
      .sort()
      .at(-1) ?? null;
  } else if (model === "HOURLY" && activeHourly?.hourlyRate != null) {
    valueAuthority = "DIRECT_TIME";
    expectedValueState = "ESTIMATED";
    expectedValueBasis = "Completed tracked minutes after the latest effective payment-request cutoff, multiplied by the active hourly rate.";
    const previousCutoff = previousRequest?.createdAt ?? 0;
    const latestEffectiveRequest = [...sortedRequests]
      .reverse()
      .find((request) => request.status !== "CANCELLED") ?? null;
    const currentCutoff = currentRequest?.createdAt ?? latestEffectiveRequest?.createdAt ?? 0;
    const included = completeMinutesBetween(input.sessions, previousCutoff, currentCutoff);
    const expected = completeMinutesBetween(input.sessions, currentCutoff, input.nowSeconds);
    includedMinutes = currentRequest && previousRequest ? included.minutes : null;
    draftMinutes = expected.minutes;
    supportedDeltaInCurrent = currentRequest && previousRequest
      ? roundMoney((included.minutes / 60) * activeHourly.hourlyRate)
      : null;
    draftDeltaAfterCurrent = roundMoney((expected.minutes / 60) * activeHourly.hourlyRate);
    evidenceCutoff = expected.cutoff ?? currentRequest?.createdAt ?? null;
  } else if (model === "FIXED") {
    valueAuthority = "FIXED_SCOPE";
    expectedValueState = "FIXED_SCOPE";
    expectedValueBasis = "Fixed-price scope controls value; tracked time never increases the amount owed.";
  } else if (model === "MIXED") {
    valueAuthority = "MIXED";
    expectedValueState = "MIXED_MODEL";
    expectedValueBasis = "Hourly and fixed components must remain separate before an estimate is supported.";
  }

  /*
   * Compatibility aliases: the first reality patch called post-request
   * expected value a "draft delta". Keep the fields stable for existing
   * readers while exposing the explicit commercial vocabulary above.
   */
  if (valueAuthority !== "DIRECT_TIME") {
    includedMinutes = null;
    draftMinutes = null;
    supportedDeltaInCurrent = null;
    draftDeltaAfterCurrent = null;
  }

  const currentOpenTotal = currentRequest
    ? roundMoney(Math.max(0, currentRequest.amountCents / 100 - paidAgainstCurrent))
    : 0;
  const readiness = currentRequest
    ? "REQUESTED"
    : valueAuthority === "DIRECT_TIME" && (draftDeltaAfterCurrent ?? 0) > 0
      ? "READY_TO_REQUEST"
      : valueAuthority === "FIXED_SCOPE" || valueAuthority === "MIXED" || valueAuthority === "EXTERNAL_PLATFORM"
        ? "PARTIAL"
        : "UNKNOWN";
  const requestDraftReadiness = valueAuthority !== "DIRECT_TIME"
    ? "UNSUPPORTED"
    : (draftDeltaAfterCurrent ?? 0) > 0
      ? "CAN_PREPARE"
      : "NOTHING_NEW";

  return {
    model,
    currency,
    hourlyRate: activeHourly?.hourlyRate ?? null,
    platform,
    valueAuthority,
    lastRequest,
    previousRequest,
    currentRequest,
    paidAgainstCurrent,
    unpaidRequested: currentOpenTotal,
    supportedDeltaInCurrent,
    draftDeltaAfterCurrent,
    expectedNewValue: draftDeltaAfterCurrent,
    expectedMinutes: draftMinutes,
    expectedValueState,
    expectedValueBasis,
    requestDraftReadiness,
    currentOpenTotal,
    includedMinutes,
    draftMinutes,
    evidenceCutoff,
    externalEvidenceThrough,
    readiness,
  };
}

export type MonthlyFinanceInput = {
  transactions: Array<{
    type: "income" | "expense" | "owner_pay";
    amount: number;
    currency: string;
    attributed: boolean;
  }>;
  registeredBilling: Array<{ amount: number; currency: string }>;
  reconciledRevenue: Array<{ amount: number; currency: string }>;
  requested: Array<{ amount: number; currency: string }>;
  platformFees: Array<{ amount: number; currency: string }>;
  unknownCosts: Array<{ amount: number; currency: string }>;
};

export type MonthlyFinanceRow = {
  currency: string;
  cashReceived: number;
  reconciledRevenue: number;
  unattributedPaid: number;
  billedRequested: number;
  registeredBilling: number;
  operatingCost: number;
  personalExcluded: number;
  unknownCost: number;
  managementOperatingResult: number;
};

export function computeMonthlyFinance(input: MonthlyFinanceInput): MonthlyFinanceRow[] {
  const currencies = new Set<string>();
  for (const collection of [
    input.transactions,
    input.registeredBilling,
    input.reconciledRevenue,
    input.requested,
    input.platformFees,
    input.unknownCosts,
  ]) {
    for (const row of collection) currencies.add(row.currency);
  }
  return [...currencies].sort().map((currency) => {
    const transactions = input.transactions.filter((row) => row.currency === currency);
    const cashReceived = transactions
      .filter((row) => row.type === "income")
      .reduce((total, row) => total + row.amount, 0);
    const reconciledRevenue = transactions
      .filter((row) => row.type === "income" && row.attributed)
      .reduce((total, row) => total + row.amount, 0);
    const unattributedPaid = transactions
      .filter((row) => row.type === "income" && !row.attributed)
      .reduce((total, row) => total + row.amount, 0);
    const directOperatingCost = transactions
      .filter((row) => row.type === "expense")
      .reduce((total, row) => total + row.amount, 0);
    const platformCost = input.platformFees
      .filter((row) => row.currency === currency)
      .reduce((total, row) => total + row.amount, 0);
    const registeredBilling = input.registeredBilling
      .filter((row) => row.currency === currency)
      .reduce((total, row) => total + row.amount, 0);
    const postedRevenue = input.reconciledRevenue
      .filter((row) => row.currency === currency)
      .reduce((total, row) => total + row.amount, 0) || reconciledRevenue;
    const operatingCost = directOperatingCost + platformCost;
    return {
      currency,
      cashReceived: roundMoney(cashReceived),
      // Billing is the revenue basis when posted billing evidence exists;
      // otherwise attributed cash is the best supported basis.
      reconciledRevenue: roundMoney(postedRevenue),
      unattributedPaid: roundMoney(unattributedPaid),
      billedRequested: roundMoney(input.requested.filter((row) => row.currency === currency).reduce((t, row) => t + row.amount, 0)),
      registeredBilling: roundMoney(registeredBilling),
      operatingCost: roundMoney(operatingCost),
      personalExcluded: roundMoney(transactions.filter((row) => row.type === "owner_pay").reduce((t, row) => t + row.amount, 0)),
      unknownCost: roundMoney(input.unknownCosts.filter((row) => row.currency === currency).reduce((t, row) => t + row.amount, 0)),
      managementOperatingResult: roundMoney(postedRevenue - operatingCost),
    };
  });
}

export type CoverageDimension = {
  key: "FINANCE" | "TIME" | "CLIENT_ATTRIBUTION" | "DELIVERY" | "REVIEW" | "SOURCE_AUTHORITY";
  status: RealityStatus;
  reason: string;
};

export type MonthlySessionInput = {
  startedAt: number;
  endedAt: number;
  activityType: string;
  clientName: string;
  clientStatus: string;
  clientSource: string;
};

export type MonthlyTimeResult = {
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

export function computeMonthlyTime(rows: readonly MonthlySessionInput[]): MonthlyTimeResult {
  return rows.reduce<MonthlyTimeResult>((total, row) => {
    const seconds = Math.max(0, row.endedAt - row.startedAt);
    total.rawSeconds += seconds;
    if (seconds > 43_200 || row.clientSource === "RELEASE_TEST") {
      total.excludedSeconds += seconds;
      total.excludedCount += 1;
      if (seconds > 43_200) {
        total.implausibleSeconds += seconds;
        total.implausibleCount += 1;
      }
      if (row.clientSource === "RELEASE_TEST") total.syntheticFixtureSeconds += seconds;
      return total;
    }
    total.reconciledSeconds += seconds;
    if (row.clientStatus === "lead") total.leadSeconds += seconds;
    else if (row.clientName === "RMEDIA" && row.activityType === "ADMIN") total.adminSeconds += seconds;
    else if (row.clientName === "RMEDIA") total.internalSeconds += seconds;
    else total.clientSeconds += seconds;
    return total;
  }, { rawSeconds: 0, reconciledSeconds: 0, clientSeconds: 0, internalSeconds: 0, adminSeconds: 0, leadSeconds: 0, excludedSeconds: 0, excludedCount: 0, implausibleSeconds: 0, implausibleCount: 0, syntheticFixtureSeconds: 0 });
}

export function computeWeeklyCommercialLine(input: {
  grossAmount: number;
  posted: boolean;
  serviceFees: number;
  withdrawalFees: number;
  candidateSettlements: readonly number[];
  directSeconds: number;
  dfySeconds: number;
}) {
  const netPlatformValue = input.posted
    ? roundMoney(input.grossAmount - input.serviceFees - input.withdrawalFees)
    : null;
  const exactMatches = netPlatformValue === null
    ? []
    : input.candidateSettlements.filter((amount) => roundMoney(amount) === netPlatformValue);
  return {
    postedGross: input.posted ? roundMoney(input.grossAmount) : 0,
    serviceFees: roundMoney(input.serviceFees),
    withdrawalFees: roundMoney(input.withdrawalFees),
    netPlatformValue,
    bankSettlement: exactMatches.length === 1 ? exactMatches[0] : null,
    directMinutes: Math.floor(input.directSeconds / 60),
    dfyMinutes: Math.floor(input.dfySeconds / 60),
  };
}

export function buildCoverageMatrix(input: {
  financeUnknownCost: number;
  excludedSeconds: number;
  unattributedPaid: number;
  deliveryEvidenceCount: number;
  reviewEvidenceCount: number;
  sourceAuthorityClean: boolean;
}): CoverageDimension[] {
  return [
    { key: "FINANCE", status: input.financeUnknownCost === 0 ? "GREEN" : "YELLOW", reason: input.financeUnknownCost === 0 ? "No unknown operating cost in this month." : "Unknown operating cost remains." },
    { key: "TIME", status: input.excludedSeconds === 0 ? "GREEN" : "YELLOW", reason: input.excludedSeconds === 0 ? "No excluded interval." : "An implausible or unresolved interval is preserved and excluded." },
    { key: "CLIENT_ATTRIBUTION", status: input.unattributedPaid === 0 ? "GREEN" : "YELLOW", reason: input.unattributedPaid === 0 ? "Paid income is attributed." : "Paid income still lacks client/contract attribution." },
    { key: "DELIVERY", status: input.deliveryEvidenceCount > 0 ? "GREEN" : "YELLOW", reason: input.deliveryEvidenceCount > 0 ? "Delivery evidence exists." : "No canonical delivery evidence in this month." },
    { key: "REVIEW", status: input.reviewEvidenceCount > 0 ? "GREEN" : "YELLOW", reason: input.reviewEvidenceCount > 0 ? "Review evidence exists." : "Review coverage is incomplete." },
    { key: "SOURCE_AUTHORITY", status: input.sourceAuthorityClean ? "GREEN" : "YELLOW", reason: input.sourceAuthorityClean ? "Canonical source facts are queryable." : "A reconciliation note is still required for part of this view." },
  ];
}
