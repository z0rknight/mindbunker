// Client Service Reality Patch (25 Aug 2026) -- Quote Approval.
//
// Pure, deterministic logic for the `quotes` table: status transitions,
// input validation, and the client-safe summary shape. No DB, no
// framework imports -- same discipline as pricing/core.ts. This module
// never computes a price; every amount here is a number Emmanuel already
// calculated (in Pricing Lab or by hand) and is choosing to record.

import {
  QUOTE_STATUS_TRANSITIONS,
  type QuoteStatus,
} from "./config.ts";
import type { CommercialTerms } from "./actions";

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return (
    typeof value === "string" &&
    Object.keys(QUOTE_STATUS_TRANSITIONS).includes(value)
  );
}

export function canTransitionQuoteStatus(
  from: QuoteStatus,
  to: QuoteStatus,
): boolean {
  return QUOTE_STATUS_TRANSITIONS[from].includes(to);
}

export type QuoteOrigin = "INTAKE" | "MANUAL";

export function isQuoteOrigin(value: unknown): value is QuoteOrigin {
  return value === "INTAKE" || value === "MANUAL";
}

// Video Commercial Terms panel's exact wording (Reality Closure brief):
// "Source: Approved Quote / Manual Commercial Terms".
export function formatQuoteOriginLabel(origin: QuoteOrigin): string {
  return origin === "MANUAL" ? "Manual Commercial Terms" : "Approved Quote";
}

export function formatQuoteAmount(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    // An unrecognized currency code shouldn't ever throw all the way up
    // to a broken page -- degrade to a plain labeled number instead.
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

/**
 * scope_text is stored as free text, one deliverable per line (matching
 * how Emmanuel already writes "What I will do" bullets). Splitting here
 * keeps the DB column simple (one text field, easy to hand-edit) while
 * every UI still gets a clean bullet list.
 */
export function parseScopeLines(scopeText: string): string[] {
  return scopeText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Quick Morning Reality Patch (26 Aug 2026) §8: a small, fixed vocabulary
// of recurring scope items. These are pure convenience -- checking one
// just appends/removes its exact line in the SAME canonical scopeText
// free-text field every quote/commercial-terms form already has. No new
// services table, nothing required, free text stays fully available
// alongside these lines.
export const RECURRING_SCOPE_OPTIONS = [
  "Color correction",
  "Audio cleanup / adjustment",
  "Captions",
  "Basic motion / text animation",
  "Thumbnail",
] as const;

/**
 * Adds or removes exactly one line (case-insensitive match) from a
 * newline-delimited scope text, leaving every other line -- including
 * anything the operator typed by hand -- untouched and in place. This is
 * what backs the recurring-scope checkboxes: the checkbox's checked state
 * is simply "is this exact line present," so the checkbox and the free
 * text field can never drift out of sync with each other.
 */
export function toggleScopeLine(scopeText: string, line: string, checked: boolean): string {
  const lines = parseScopeLines(scopeText);
  const withoutLine = lines.filter((existing) => existing.toLowerCase() !== line.toLowerCase());
  const next = checked ? [...withoutLine, line] : withoutLine;
  return next.join("\n");
}

// Quick Morning Reality Patch (26 Aug 2026) §11: "Dave was a sale." A
// small derived Sales view, NOT a second ledger -- SALE = an approved
// commercial quote (status APPROVED, approvedAt set), full stop. Sale !=
// cash received, sale != revenue; Finance's own income transactions
// remain the only source of truth for money that actually moved. Grouped
// by currency on purpose (brief: "Do not mix currencies") -- a $100 sale
// and a R$50 sale are never summed into one number.
export type SalesThisMonthEntry = {
  currency: string;
  count: number;
  totalAmountCents: number;
};

export type SalesThisMonthSummary = {
  totalCount: number;
  byCurrency: SalesThisMonthEntry[];
};

type ApprovedQuoteLike = { currency: string; amountCents: number; approvedAt: Date | null };

function groupApprovedQuotesByCurrency(
  quotes: readonly ApprovedQuoteLike[],
): SalesThisMonthSummary {
  const byCurrency = new Map<string, SalesThisMonthEntry>();
  for (const quote of quotes) {
    const entry = byCurrency.get(quote.currency) ?? {
      currency: quote.currency,
      count: 0,
      totalAmountCents: 0,
    };
    entry.count += 1;
    entry.totalAmountCents += quote.amountCents;
    byCurrency.set(quote.currency, entry);
  }
  return {
    totalCount: quotes.length,
    byCurrency: Array.from(byCurrency.values()).sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

export function computeSalesThisMonth(
  approvedQuotes: readonly ApprovedQuoteLike[],
  monthStart: Date,
): SalesThisMonthSummary {
  const inMonth = approvedQuotes.filter(
    (quote) => quote.approvedAt !== null && quote.approvedAt.getTime() >= monthStart.getTime(),
  );
  return groupApprovedQuotesByCurrency(inMonth);
}

// First Sale Economics (26 Aug 2026): "Sales This Month" is a pace metric
// that honestly resets to zero on the 1st of every month -- exactly right
// for that KPI, but wrong for the underlying business fact "how many
// deals has MindBunker ever closed." Dave's sale doesn't stop being real
// once September starts. computeClosedSales is the same grouping with no
// time window at all -- every APPROVED quote, ever, currency never mixed.
// Reuses the exact grouping logic above rather than a second
// implementation, so the two can never silently disagree on how a
// currency total is summed.
export function computeClosedSales(
  approvedQuotes: readonly ApprovedQuoteLike[],
): SalesThisMonthSummary {
  const closed = approvedQuotes.filter((quote) => quote.approvedAt !== null);
  return groupApprovedQuotesByCurrency(closed);
}

export type ClientCommercialValueSummary = {
  pipelineByCurrency: SalesThisMonthEntry[];
  closedByCurrency: SalesThisMonthEntry[];
};

type CommercialQuoteLike = {
  status: QuoteStatus;
  currency: string;
  amountCents: number;
};

function groupCommercialQuotesByCurrency(
  quotes: readonly CommercialQuoteLike[],
): SalesThisMonthEntry[] {
  const grouped = new Map<string, SalesThisMonthEntry>();
  for (const quote of quotes) {
    const entry = grouped.get(quote.currency) ?? {
      currency: quote.currency,
      count: 0,
      totalAmountCents: 0,
    };
    entry.count += 1;
    entry.totalAmountCents += quote.amountCents;
    grouped.set(quote.currency, entry);
  }
  return Array.from(grouped.values()).sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
}

/**
 * CRM commercial truth, deliberately separate from Finance cash truth.
 * DRAFT/SENT are still pipeline, APPROVED is value closed, DECLINED is
 * neither. Nothing in this projection creates or implies an income row.
 */
export function computeClientCommercialValue(
  quotes: readonly CommercialQuoteLike[],
): ClientCommercialValueSummary {
  return {
    pipelineByCurrency: groupCommercialQuotesByCurrency(
      quotes.filter((quote) => quote.status === "DRAFT" || quote.status === "SENT"),
    ),
    closedByCurrency: groupCommercialQuotesByCurrency(
      quotes.filter((quote) => quote.status === "APPROVED"),
    ),
  };
}

export type QuoteCreateInput = {
  clientId: number;
  amountCents: number;
  currency: string;
  contentTypeLabel: string;
  turnaroundLabel: string;
  revisionsIncluded: number;
  summary: string;
  scopeText: string;
};

export type QuoteValidation =
  | { success: true; data: QuoteCreateInput }
  | { success: false; errors: Record<string, string> };

export function validateQuoteInput(
  values: Record<string, unknown>,
): QuoteValidation {
  const errors: Record<string, string> = {};

  const clientId = Number(values.clientId);
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    errors.clientId = "Invalid client.";
  }

  const amountCents = Number(values.amountCents);
  if (!Number.isFinite(amountCents) || amountCents <= 0 || !Number.isInteger(amountCents)) {
    errors.amountCents = "Enter a positive whole-cent amount.";
  }

  const currency =
    typeof values.currency === "string" ? values.currency.trim().toUpperCase().slice(0, 8) : "";
  if (!currency) {
    errors.currency = "Currency is required.";
  }

  const contentTypeLabel =
    typeof values.contentTypeLabel === "string" ? values.contentTypeLabel.trim().slice(0, 160) : "";
  if (!contentTypeLabel) {
    errors.contentTypeLabel = "Content type is required.";
  }

  const turnaroundLabel =
    typeof values.turnaroundLabel === "string" ? values.turnaroundLabel.trim().slice(0, 80) : "";
  if (!turnaroundLabel) {
    errors.turnaroundLabel = "ETA is required.";
  }

  const revisionsIncluded = Number(values.revisionsIncluded);
  if (!Number.isSafeInteger(revisionsIncluded) || revisionsIncluded < 0) {
    errors.revisionsIncluded = "Revisions must be zero or a positive whole number.";
  }

  const summary = typeof values.summary === "string" ? values.summary.trim().slice(0, 500) : "";

  const scopeText = typeof values.scopeText === "string" ? values.scopeText.trim().slice(0, 2_000) : "";
  if (parseScopeLines(scopeText).length === 0) {
    errors.scopeText = "Add at least one line describing what you'll do.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      clientId,
      amountCents,
      currency,
      contentTypeLabel,
      turnaroundLabel,
      revisionsIncluded,
      summary,
      scopeText,
    },
  };
}

// The client-safe shape: everything a client is allowed to see about a
// quote linked to one of their videos. No internal notes, no rate math,
// no reference to Emmanuel's own hourly cost -- just what was promised.
export type ClientQuoteSummary = {
  amount: string;
  turnaround: string;
  revisionsIncluded: number;
  scope: string[];
  summary: string | null;
};

export function buildClientQuoteSummary(quote: {
  amountCents: number;
  currency: string;
  turnaroundLabel: string;
  revisionsIncluded: number;
  scopeText: string;
  summary: string | null;
}): ClientQuoteSummary {
  return {
    amount: formatQuoteAmount(quote.amountCents, quote.currency),
    turnaround: quote.turnaroundLabel,
    revisionsIncluded: quote.revisionsIncluded,
    scope: parseScopeLines(quote.scopeText),
    summary: quote.summary,
  };
}

// ─── Video Commercial Terms economics (Reality Closure, 26 Aug 2026) ─────
//
// Brief's exact framing, worth repeating here because it's the whole
// point: "This is NOT automatically revenue / paid / billed... Never
// 'earned' merely because work time exists." These two functions compute
// numbers; the panel that renders them is responsible for the honest
// labels ("Agreed price", "Tracked production time", "Operational
// effective rate" / "Rate-equivalent") and never the word "earned".

/**
 * FIXED-price jobs: agreed price / tracked hours. Returns null (render as
 * "—") when there is no tracked time yet -- a rate implied by zero hours
 * is not a real number, and showing Infinity or 0 would both misrepresent
 * it.
 */
export function computeOperationalEffectiveRateCents(
  agreedPriceCents: number,
  trackedSeconds: number,
): number | null {
  if (trackedSeconds <= 0) return null;
  const trackedHours = trackedSeconds / 3600;
  return agreedPriceCents / trackedHours;
}

/**
 * HOURLY jobs: operational tracked time × the contract's rate. This is a
 * derived audit figure for comparison against Upwork's own billed
 * evidence -- it is deliberately never written anywhere as billed/paid
 * revenue itself.
 */
export function computeRateEquivalent(trackedSeconds: number, hourlyRate: number): number {
  const trackedHours = trackedSeconds / 3600;
  return trackedHours * hourlyRate;
}

// Post-Job Commercial + Delivery Sniper §5: aggregates a project's video-
// level CommercialTerms (already fetched once per video via
// getCommercialTermsForVideo -- no second derivation) into the summary
// the Project workspace header shows. Currencies and billing models are
// kept SEPARATE, never collapsed into one number: a FIXED "agreed" amount
// is a real recorded fact, an HOURLY "estimated accrued" amount is a
// derived estimate, and BRL is never added to USD. unattributedCount lets
// the UI say "3 of 7 videos have no commercial terms yet" instead of
// silently treating them as $0.
// Post-Job Commercial + Delivery Sniper §9: client-safe HOURLY summary --
// same discipline as ClientQuoteSummary/buildClientQuoteSummary above (no
// contractId, no platform name, no Upwork billing-evidence totals -- only
// facts the client is entitled to see about their own tracked work).
// FIXED already has buildClientQuoteSummary; this is HOURLY's equivalent.
// Never includes a "Paid"/"Unpaid" figure -- that requires canonical
// payment evidence this function has no access to and must not guess at.
export type ClientHourlySummary = {
  hourlyRateLabel: string;
  trackedSeconds: number;
  estimatedAccruedLabel: string;
  currency: string;
};

export function buildClientHourlySummary(terms: CommercialTerms): ClientHourlySummary | null {
  if (terms.billingModel !== "HOURLY") return null;
  return {
    hourlyRateLabel: formatCurrencyPerHour(terms.hourlyRate, terms.currency),
    trackedSeconds: terms.trackedSeconds,
    estimatedAccruedLabel: formatCurrencyPlain(terms.estimatedAccruedValue, terms.currency),
    currency: terms.currency,
  };
}

function formatCurrencyPerHour(rate: number, currency: string): string {
  try {
    return (
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        minimumFractionDigits: 2,
      }).format(rate) + "/h"
    );
  } catch {
    return `${currency} ${rate.toFixed(2)}/h`;
  }
}

function formatCurrencyPlain(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export type ProjectCommercialCurrencyBucket = {
  currency: string;
  agreedTotalCents: number | null;
  estimatedAccruedTotal: number | null;
};

export type ProjectCommercialSummary = {
  trackedSecondsTotal: number;
  videoCount: number;
  unattributedCount: number;
  byCurrency: ProjectCommercialCurrencyBucket[];
};

export function aggregateProjectCommercialSummary(
  termsList: readonly CommercialTerms[],
): ProjectCommercialSummary {
  const buckets = new Map<string, ProjectCommercialCurrencyBucket>();
  const getBucket = (currency: string) => {
    const existing = buckets.get(currency);
    if (existing) return existing;
    const created: ProjectCommercialCurrencyBucket = {
      currency,
      agreedTotalCents: null,
      estimatedAccruedTotal: null,
    };
    buckets.set(currency, created);
    return created;
  };

  let trackedSecondsTotal = 0;
  let unattributedCount = 0;

  for (const terms of termsList) {
    trackedSecondsTotal += terms.trackedSeconds;
    if (terms.billingModel === "FIXED") {
      const bucket = getBucket(terms.currency);
      bucket.agreedTotalCents = (bucket.agreedTotalCents ?? 0) + terms.agreedPriceCents;
    } else if (terms.billingModel === "HOURLY") {
      const bucket = getBucket(terms.currency);
      bucket.estimatedAccruedTotal = round2(
        (bucket.estimatedAccruedTotal ?? 0) + terms.estimatedAccruedValue,
      );
    } else {
      unattributedCount += 1;
    }
  }

  return {
    trackedSecondsTotal,
    videoCount: termsList.length,
    unattributedCount,
    byCurrency: Array.from(buckets.values()),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
