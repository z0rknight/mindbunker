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

/**
 * À la carte HOURLY EFFORT ESTIMATOR (Monday Local Intelligence Lab, §A) --
 * a completely separate experiment from PRICING_PRODUCTS/PRICING_CONFIG
 * above. This is an INTERNAL production-cost target, never a client-facing
 * hourly rate: it estimates a single flat suggested price from an assumed
 * effort (hours), not a rate someone is billed by the hour against. All of
 * this is EXPERIMENTAL CONFIGURATION, operator-supplied 2026-08-24, and
 * none of it changes the Monthly Package numbers above.
 */
export const A_LA_CARTE_HOURLY_RATE_CENTS = 5_000; // $50/effective-production-hour

export const A_LA_CARTE_CONTENT_TYPES = [
  { id: "short-form", label: "Short-form video", estimatedHours: 3 },
  { id: "long-form", label: "Long-form video", estimatedHours: 8 },
  { id: "mini-doc", label: "Mini-doc", estimatedHours: 20 },
  { id: "testimonial", label: "Testimonial", estimatedHours: 4 },
  { id: "custom", label: "Custom / other", estimatedHours: 5 },
] as const;

export const A_LA_CARTE_COMPLEXITY_LEVELS = [
  { id: "simple", label: "Simple", multiplier: 0.8 },
  { id: "standard", label: "Standard", multiplier: 1.0 },
  { id: "complex", label: "Complex", multiplier: 1.3 },
  { id: "very-complex", label: "Very complex", multiplier: 1.6 },
] as const;

export const A_LA_CARTE_RUSH_SURCHARGE_RATE = 0.25; // +25% -- EXPERIMENTAL
export const A_LA_CARTE_REVISION_ROUND_HOURS = 1.5; // hours added per extra revision round beyond the included ones
export const A_LA_CARTE_INCLUDED_REVISION_ROUNDS = 2;
// Reuses the canonical thumbnail price from PRICING_PRODUCTS above -- one
// place a thumbnail price is ever defined, same discipline as the Monthly
// Package's line items.
export const A_LA_CARTE_THUMBNAIL_UNIT_PRICE_CENTS = PRICING_PRODUCTS.find(
  (p) => p.id === "thumbnail",
)!.unitPriceCents;
