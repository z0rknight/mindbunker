import { computeClientCommercialValue } from "@/modules/quotes/core";
import type { QuoteStatus } from "@/modules/quotes/config";

export type CustodyQuoteInput = {
  id: number;
  status: QuoteStatus;
  currency: string;
  amountCents: number;
  contentTypeLabel: string;
  projectId: number | null;
  videoId: number | null;
};

export type CustodyContractInput = {
  id: number;
  platform: string;
  billingType: "HOURLY" | "FIXED";
  hourlyRate: number | null;
  currency: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  externalReference: string | null;
};

export type CustodyVideoInput = {
  id: number;
  projectId: number | null;
  title: string;
  status: string;
  sessionCount: number;
  closedSeconds: number;
};

export type CustodyProjectInput = {
  id: number;
  name: string;
  status: string;
};

export type CustodyBillingEvidenceInput = {
  contractId: number;
  currency: string;
  grossAmount: number;
};

export type CustodyIncomeInput = {
  id: number;
  amount: number;
  currency: string;
  contractId: number | null;
  billingEvidenceId: number | null;
};

export type CustodyProjection = {
  client: {
    id: number;
    name: string;
    status: "lead" | "active" | "inactive";
  };
  quotes: Array<CustodyQuoteInput & { commercialState: "PIPELINE" | "CLOSED" | "DECLINED" }>;
  contracts: Array<CustodyContractInput & { externalUrl: string | null }>;
  projects: Array<CustodyProjectInput & { videos: CustodyVideoInput[] }>;
  commercialValue: ReturnType<typeof computeClientCommercialValue>;
  billingByContract: Array<{
    contractId: number;
    currency: string;
    count: number;
    grossAmount: number;
  }>;
  financeIncomeByCurrency: Array<{
    currency: string;
    count: number;
    amount: number;
  }>;
  contractLinkedIncomeCount: number;
  clientOnlyIncomeCount: number;
};

export function parseHttpsExternalReference(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function buildCustodyProjection(input: {
  client: CustodyProjection["client"];
  quotes: CustodyQuoteInput[];
  contracts: CustodyContractInput[];
  projects: CustodyProjectInput[];
  videos: CustodyVideoInput[];
  billingEvidence: CustodyBillingEvidenceInput[];
  income: CustodyIncomeInput[];
}): CustodyProjection {
  const quotes = input.quotes.map((quote) => ({
    ...quote,
    commercialState:
      quote.status === "APPROVED"
        ? "CLOSED" as const
        : quote.status === "DECLINED"
          ? "DECLINED" as const
          : "PIPELINE" as const,
  }));

  const contracts = input.contracts.map((contract) => ({
    ...contract,
    externalUrl: parseHttpsExternalReference(contract.externalReference),
  }));

  const projects = input.projects.map((project) => ({
    ...project,
    videos: input.videos.filter((video) => video.projectId === project.id),
  }));

  const billing = new Map<string, CustodyProjection["billingByContract"][number]>();
  for (const evidence of input.billingEvidence) {
    const key = `${evidence.contractId}:${evidence.currency}`;
    const current = billing.get(key) ?? {
      contractId: evidence.contractId,
      currency: evidence.currency,
      count: 0,
      grossAmount: 0,
    };
    current.count += 1;
    current.grossAmount += evidence.grossAmount;
    billing.set(key, current);
  }

  const income = new Map<string, CustodyProjection["financeIncomeByCurrency"][number]>();
  for (const transaction of input.income) {
    const current = income.get(transaction.currency) ?? {
      currency: transaction.currency,
      count: 0,
      amount: 0,
    };
    current.count += 1;
    current.amount += transaction.amount;
    income.set(transaction.currency, current);
  }

  return {
    client: input.client,
    quotes,
    contracts,
    projects,
    commercialValue: computeClientCommercialValue(input.quotes),
    billingByContract: Array.from(billing.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
    financeIncomeByCurrency: Array.from(income.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
    contractLinkedIncomeCount: input.income.filter(
      (transaction) => transaction.contractId !== null || transaction.billingEvidenceId !== null,
    ).length,
    clientOnlyIncomeCount: input.income.filter(
      (transaction) => transaction.contractId === null && transaction.billingEvidenceId === null,
    ).length,
  };
}
