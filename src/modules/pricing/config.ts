/**
 * Pricing Lab P0 — canonical product/price config.
 *
 * EXPERIMENTAL CONFIGURATION, not validated commercial truth. These
 * numbers were supplied directly by Emmanuel this round after two
 * independent forensic passes confirmed no existing pricing calculator
 * source could be located anywhere reachable (see
 * docs/architecture/PRICING_LAB_P0_IMPLEMENTATION_REPORT.md). This file
 * is now the single source of truth for both the a-la-carte calculator
 * and the Monthly Package Builder -- change a price here once and both
 * surfaces update together.
 *
 * Amounts are stored in integer cents (never floats) so downstream
 * arithmetic (subtotal, 20% discount, savings, total) is deterministic
 * and never accumulates floating-point drift. Display formatting
 * converts to dollars only at the last step (see core.ts's
 * `centsToDollarsString`).
 */

import type { PricingConfig } from "./core";

export const PRICING_PRODUCTS = [
  {
    id: "long-form",
    label: "Long-form video",
    unitPriceCents: 40_000, // $400 -- EXPERIMENTAL, operator-supplied 2026-08-23
  },
  {
    id: "short-form",
    label: "Short-form video",
    unitPriceCents: 7_500, // $75 -- EXPERIMENTAL, operator-supplied 2026-08-23
  },
  {
    id: "thumbnail",
    label: "Thumbnail",
    unitPriceCents: 1_500, // $15 -- EXPERIMENTAL, operator-supplied 2026-08-23
    // Standalone add-on: independently selectable quantity, NOT tied 1:1
    // to selected long-form videos. Operator-confirmed semantics, 2026-08-23.
  },
] as const;

/**
 * EXPERIMENTAL_PACKAGE_DISCOUNT -- owner review required before production.
 * This is local dogfooding config, not a proven or committed business
 * rule. Change this single value to test 15%, 10%, or any other rate;
 * every downstream calculation (discount amount, savings, package total,
 * copy summary) follows automatically.
 */
export const PACKAGE_DISCOUNT_RATE = 0.2;

export const PRICING_CONFIG: PricingConfig = {
  products: PRICING_PRODUCTS.map((p) => ({
    id: p.id,
    label: p.label,
    unitPriceCents: p.unitPriceCents,
  })),
  packageDiscountRate: PACKAGE_DISCOUNT_RATE,
};
