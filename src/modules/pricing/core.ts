/**
 * Pricing Lab P0 -- pure, deterministic pricing math.
 *
 * No DB, no framework imports, no side effects. Every function here is
 * independently testable (see core.test.mjs). Money is handled in
 * integer cents throughout to avoid floating-point drift; conversion to
 * a display dollar string happens only at the edge
 * (`centsToDollarsString`).
 */

export interface PricingProduct {
  id: string;
  label: string;
  /** Integer cents. Never a float dollar amount. */
  unitPriceCents: number;
}

export interface PricingConfig {
  products: PricingProduct[];
  /** e.g. 0.20 for the current 20% experimental package discount. */
  packageDiscountRate: number;
}

export type ProductQuantities = Record<string, number>;

export interface LineItem {
  id: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface PackagePricingResult {
  lineItems: LineItem[];
  retailSubtotalCents: number;
  discountRate: number;
  discountAmountCents: number;
  packageTotalCents: number;
  hasAnySelection: boolean;
}

/**
 * Quantities are always non-negative integers. Anything else (negative,
 * NaN, Infinity, a fraction, undefined/missing) sanitizes to 0 rather
 * than propagating a broken value into money math.
 */
export function sanitizeQuantity(quantity: number | undefined | null): number {
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }
  return Math.floor(quantity);
}

/**
 * The a-la-carte price for a single product at a given quantity -- the
 * same unit price the Monthly Package Builder derives its retail
 * subtotal from. There is exactly one place a unit price is read
 * (`config.products`), so a-la-carte and package pricing can never
 * silently diverge.
 */
export function computeALaCarteLineCents(
  config: PricingConfig,
  productId: string,
  quantity: number | undefined | null,
): number {
  const product = config.products.find((p) => p.id === productId);
  if (!product) return 0;
  return sanitizeQuantity(quantity) * product.unitPriceCents;
}

/**
 * The full package computation: one line item per canonical product,
 * the retail subtotal (identical to what the a-la-carte view would sum
 * to for the same quantities), the experimental discount, savings, and
 * the final monthly package total. Products with unknown ids in
 * `quantities` are ignored; products in `config` with no entry in
 * `quantities` are treated as quantity 0.
 */
export function computePackagePricing(
  config: PricingConfig,
  quantities: ProductQuantities,
): PackagePricingResult {
  const lineItems: LineItem[] = config.products.map((product) => {
    const quantity = sanitizeQuantity(quantities[product.id]);
    return {
      id: product.id,
      label: product.label,
      quantity,
      unitPriceCents: product.unitPriceCents,
      lineTotalCents: quantity * product.unitPriceCents,
    };
  });

  const retailSubtotalCents = lineItems.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0,
  );

  const discountRate = config.packageDiscountRate;
  // A single multiply-then-round, never a sum of independently-rounded
  // parts -- this is what keeps the math deterministic and free of
  // accumulated floating-point drift regardless of how many line items
  // exist or what the discount rate is.
  const discountAmountCents = Math.round(retailSubtotalCents * discountRate);
  const packageTotalCents = retailSubtotalCents - discountAmountCents;

  return {
    lineItems,
    retailSubtotalCents,
    discountRate,
    discountAmountCents,
    packageTotalCents,
    hasAnySelection: lineItems.some((item) => item.quantity > 0),
  };
}

export function centsToDollarsString(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * A compact, copy-paste-ready plain-text summary of the currently
 * selected package -- for a DM, an email, a call note. Reflects exactly
 * the selected quantities and computed totals passed in; never adds
 * unsupported promises (turnaround, revision limits, guarantees) that
 * aren't already part of `config`/`result`.
 */
export function buildPackageSummaryText(result: PackagePricingResult): string {
  const lines: string[] = ["Custom Monthly Content Package", ""];

  for (const item of result.lineItems) {
    if (item.quantity > 0) {
      lines.push(`${item.quantity}x ${item.label}`);
    }
  }

  lines.push("");
  lines.push(`Retail value: ${centsToDollarsString(result.retailSubtotalCents)}`);
  lines.push(
    `Package savings (${Math.round(result.discountRate * 100)}%): ${centsToDollarsString(result.discountAmountCents)}`,
  );
  lines.push(`Monthly package: ${centsToDollarsString(result.packageTotalCents)}`);

  return lines.join("\n");
}

// ─── Client Presentation (Client Service Reality Patch, 25 Aug 2026) ───────
//
// "One engine. Two views: INTERNAL CALCULATION / CLIENT PRESENTATION."
// (brief §4). These functions compute NOTHING -- they only format fields
// Emmanuel already has: the investment amount comes straight from
// computeALaCarteHourlyEstimate's totalCents (the one calculation engine
// above), and turnaround/complexity/revisions/scope are presentation-only
// choices that never feed back into the price. There is exactly one
// place a price is computed in this module; this is just its second
// rendering.

export interface ClientQuotePresentation {
  contentTypeLabel: string;
  turnaroundLabel: string;
  complexityLabel: string;
  revisionsIncluded: number;
  scopeLines: string[];
  investmentCents: number;
}

/**
 * Plain text, suitable for Slack/Email/WhatsApp -- matches the brief's
 * example format verbatim (brief §4/§5).
 */
export function buildClientQuoteText(input: ClientQuotePresentation): string {
  const lines = [
    `Content type: ${input.contentTypeLabel}`,
    `ETA: ${input.turnaroundLabel}`,
    `Complexity: ${input.complexityLabel}`,
    `Revisions included: ${input.revisionsIncluded}`,
    "What I will do:",
    ...input.scopeLines.map((line) => `\u2022 ${line}`),
    `Investment: ${centsToDollarsString(input.investmentCents)}`,
    "Sounds good to you?",
  ];
  return lines.join("\n");
}

/** Same content, Markdown-formatted -- trivial once the text version exists (brief §5). */
export function buildClientQuoteMarkdown(input: ClientQuotePresentation): string {
  const lines = [
    `**Content type:** ${input.contentTypeLabel}`,
    `**ETA:** ${input.turnaroundLabel}`,
    `**Complexity:** ${input.complexityLabel}`,
    `**Revisions included:** ${input.revisionsIncluded}`,
    "",
    "**What I will do:**",
    ...input.scopeLines.map((line) => `- ${line}`),
    "",
    `**Investment:** ${centsToDollarsString(input.investmentCents)}`,
    "",
    "Sounds good to you?",
  ];
  return lines.join("\n");
}

// ─── À la carte hourly-effort estimator (Monday Local Intelligence Lab §A) ──
//
// A DIFFERENT concept from computeALaCarteLineCents above (N units at
// canonical list price). This estimates a single flat suggested price from
// an internal effort target: hours x an experimental $/hour rate x a
// complexity multiplier, plus optional add-ons -- never a client-facing
// hourly rate, never persisted, always returned with a full breakdown so
// nothing about the number is a black box.

export interface ALaCarteHourlyConfig {
  hourlyRateCents: number;
  thumbnailUnitPriceCents: number;
  rushSurchargeRate: number;
  revisionRoundHours: number;
}

export interface ALaCarteHourlyInput {
  estimatedHours: number;
  complexityMultiplier: number;
  includeRush: boolean;
  extraRevisionRounds: number;
  thumbnailCount: number;
}

export interface ALaCarteHourlyBreakdown {
  baseHours: number;
  complexityMultiplier: number;
  adjustedHours: number;
  extraRevisionRounds: number;
  revisionHours: number;
  totalHours: number;
  laborCents: number;
  includeRush: boolean;
  rushSurchargeCents: number;
  thumbnailCount: number;
  thumbnailCents: number;
  totalCents: number;
}

function sanitizeNonNegativeNumber(value: number | undefined | null): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function sanitizeNonNegativeInt(value: number | undefined | null): number {
  return Math.floor(sanitizeNonNegativeNumber(value));
}

/**
 * Pure, deterministic breakdown -- the same discipline as
 * computePackagePricing: one multiply-then-round for the labor total
 * (never a sum of independently-rounded parts), every input sanitized so a
 * bad/missing value degrades to 0 rather than propagating NaN or a
 * negative price.
 */
export function computeALaCarteHourlyEstimate(
  config: ALaCarteHourlyConfig,
  input: ALaCarteHourlyInput,
): ALaCarteHourlyBreakdown {
  const baseHours = sanitizeNonNegativeNumber(input.estimatedHours);
  const complexityMultiplier =
    Number.isFinite(input.complexityMultiplier) &&
    input.complexityMultiplier > 0
      ? input.complexityMultiplier
      : 1;
  const adjustedHours = baseHours * complexityMultiplier;

  const extraRevisionRounds = sanitizeNonNegativeInt(
    input.extraRevisionRounds,
  );
  const revisionHours = extraRevisionRounds * config.revisionRoundHours;

  const totalHours = adjustedHours + revisionHours;
  const laborCents = Math.round(totalHours * config.hourlyRateCents);

  const includeRush = Boolean(input.includeRush);
  const rushSurchargeCents = includeRush
    ? Math.round(laborCents * config.rushSurchargeRate)
    : 0;

  const thumbnailCount = sanitizeNonNegativeInt(input.thumbnailCount);
  const thumbnailCents = thumbnailCount * config.thumbnailUnitPriceCents;

  const totalCents = laborCents + rushSurchargeCents + thumbnailCents;

  return {
    baseHours,
    complexityMultiplier,
    adjustedHours,
    extraRevisionRounds,
    revisionHours,
    totalHours,
    laborCents,
    includeRush,
    rushSurchargeCents,
    thumbnailCount,
    thumbnailCents,
    totalCents,
  };
}
