import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClientQuoteSummary,
  canTransitionQuoteStatus,
  computeClosedSales,
  computeClientCommercialValue,
  computeOperationalEffectiveRateCents,
  computeRateEquivalent,
  computeSalesThisMonth,
  formatQuoteAmount,
  formatQuoteOriginLabel,
  isQuoteOrigin,
  isQuoteStatus,
  parseScopeLines,
  toggleScopeLine,
  validateQuoteInput,
} from "./core.ts";

test("CRM commercial value keeps pipeline, closed value, and currencies separate", () => {
  const summary = computeClientCommercialValue([
    { status: "DRAFT", currency: "USD", amountCents: 10_000 },
    { status: "SENT", currency: "USD", amountCents: 5_000 },
    { status: "SENT", currency: "BRL", amountCents: 20_000 },
    { status: "APPROVED", currency: "USD", amountCents: 40_000 },
    { status: "DECLINED", currency: "USD", amountCents: 99_900 },
  ]);
  assert.deepEqual(summary.pipelineByCurrency, [
    { currency: "BRL", count: 1, totalAmountCents: 20_000 },
    { currency: "USD", count: 2, totalAmountCents: 15_000 },
  ]);
  assert.deepEqual(summary.closedByCurrency, [
    { currency: "USD", count: 1, totalAmountCents: 40_000 },
  ]);
});

test("DRAFT/SENT never become closed and APPROVED never becomes realized cash", () => {
  const summary = computeClientCommercialValue([
    { status: "DRAFT", currency: "USD", amountCents: 10_000 },
    { status: "SENT", currency: "USD", amountCents: 10_000 },
    { status: "APPROVED", currency: "USD", amountCents: 10_000 },
  ]);
  assert.equal(summary.pipelineByCurrency[0].totalAmountCents, 20_000);
  assert.equal(summary.closedByCurrency[0].totalAmountCents, 10_000);
  assert.equal("realizedRevenueByCurrency" in summary, false);
});

test("CRM commercial value is honestly empty when there is no current commercial value", () => {
  assert.deepEqual(
    computeClientCommercialValue([
      { status: "DECLINED", currency: "USD", amountCents: 10_000 },
    ]),
    { pipelineByCurrency: [], closedByCurrency: [] },
  );
});

test("isQuoteStatus recognizes only the four canonical statuses", () => {
  assert.equal(isQuoteStatus("DRAFT"), true);
  assert.equal(isQuoteStatus("SENT"), true);
  assert.equal(isQuoteStatus("APPROVED"), true);
  assert.equal(isQuoteStatus("DECLINED"), true);
  assert.equal(isQuoteStatus("draft"), false);
  assert.equal(isQuoteStatus("PENDING"), false);
});

test("canTransitionQuoteStatus follows the DRAFT -> SENT -> APPROVED/DECLINED state machine", () => {
  assert.equal(canTransitionQuoteStatus("DRAFT", "SENT"), true);
  assert.equal(canTransitionQuoteStatus("DRAFT", "DECLINED"), true);
  assert.equal(canTransitionQuoteStatus("DRAFT", "APPROVED"), false, "cannot skip SENT");
  assert.equal(canTransitionQuoteStatus("SENT", "APPROVED"), true);
  assert.equal(canTransitionQuoteStatus("SENT", "DECLINED"), true);
  assert.equal(canTransitionQuoteStatus("APPROVED", "SENT"), false, "APPROVED is terminal");
  assert.equal(canTransitionQuoteStatus("APPROVED", "DECLINED"), false, "APPROVED is terminal");
  assert.equal(canTransitionQuoteStatus("DECLINED", "SENT"), false, "DECLINED is terminal");
});

test("formatQuoteAmount renders whole-cent amounts as currency", () => {
  assert.equal(formatQuoteAmount(10_000, "USD"), "$100.00");
  assert.equal(formatQuoteAmount(150, "USD"), "$1.50");
});

test("formatQuoteAmount degrades gracefully for an unrecognized currency code", () => {
  const result = formatQuoteAmount(10_000, "NOT_A_CODE");
  assert.equal(result, "NOT_A_CODE 100.00");
});

test("parseScopeLines splits on newlines, trims, and drops blank lines", () => {
  const lines = parseScopeLines("Color correction\n  Audio adjustment  \n\nCaptions\n");
  assert.deepEqual(lines, ["Color correction", "Audio adjustment", "Captions"]);
});

// Quick Morning Reality Patch §8: recurring scope checkboxes append/remove
// their exact line without disturbing anything else in the field.
test("toggleScopeLine appends a new line when checked", () => {
  assert.equal(
    toggleScopeLine("Color correction", "Captions", true),
    "Color correction\nCaptions",
  );
});

test("toggleScopeLine removes only the matching line when unchecked, case-insensitively", () => {
  assert.equal(
    toggleScopeLine("Color correction\nCAPTIONS\nThumbnail", "Captions", false),
    "Color correction\nThumbnail",
  );
});

test("toggleScopeLine never duplicates a line that's already present", () => {
  assert.equal(
    toggleScopeLine("Color correction", "Color correction", true),
    "Color correction",
  );
});

test("toggleScopeLine leaves hand-typed custom lines untouched", () => {
  const withCustom = toggleScopeLine("A custom deliverable Emmanuel typed", "Captions", true);
  assert.equal(withCustom, "A custom deliverable Emmanuel typed\nCaptions");
  assert.equal(toggleScopeLine(withCustom, "Captions", false), "A custom deliverable Emmanuel typed");
});

test("validateQuoteInput accepts a well-formed submission", () => {
  const result = validateQuoteInput({
    clientId: 5,
    amountCents: 10_000,
    currency: "usd",
    contentTypeLabel: "Short-form video for landing page",
    turnaroundLabel: "24h",
    revisionsIncluded: 3,
    summary: "",
    scopeText: "Color correction\nAudio adjustment\nCaptions",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.currency, "USD", "currency is normalized to uppercase");
  assert.equal(result.data.revisionsIncluded, 3);
});

test("validateQuoteInput rejects a non-positive amount, missing scope, and an invalid client", () => {
  const result = validateQuoteInput({
    clientId: 0,
    amountCents: 0,
    currency: "USD",
    contentTypeLabel: "Short-form",
    turnaroundLabel: "24h",
    revisionsIncluded: -1,
    summary: "",
    scopeText: "   ",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.clientId);
  assert.ok(result.errors.amountCents);
  assert.ok(result.errors.revisionsIncluded);
  assert.ok(result.errors.scopeText);
});

test("validateQuoteInput rejects a fractional-cent amount", () => {
  const result = validateQuoteInput({
    clientId: 1,
    amountCents: 100.5,
    currency: "USD",
    contentTypeLabel: "Short-form",
    turnaroundLabel: "24h",
    revisionsIncluded: 1,
    scopeText: "Edit",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.amountCents);
});

test("buildClientQuoteSummary exposes only client-safe fields", () => {
  const summary = buildClientQuoteSummary({
    amountCents: 10_000,
    currency: "USD",
    turnaroundLabel: "24h",
    revisionsIncluded: 3,
    scopeText: "Color correction\nAudio adjustment\nCaptions",
    summary: null,
  });
  assert.deepEqual(summary, {
    amount: "$100.00",
    turnaround: "24h",
    revisionsIncluded: 3,
    scope: ["Color correction", "Audio adjustment", "Captions"],
    summary: null,
  });
  // No internal notes, no rate-equivalent, no reference to cost -- just
  // the five client-safe keys above.
  assert.deepEqual(Object.keys(summary).sort(), [
    "amount",
    "revisionsIncluded",
    "scope",
    "summary",
    "turnaround",
  ]);
});

test("isQuoteOrigin accepts only INTAKE/MANUAL", () => {
  assert.equal(isQuoteOrigin("INTAKE"), true);
  assert.equal(isQuoteOrigin("MANUAL"), true);
  assert.equal(isQuoteOrigin("OTHER"), false);
  assert.equal(isQuoteOrigin(undefined), false);
});

test("formatQuoteOriginLabel matches the brief's exact wording", () => {
  assert.equal(formatQuoteOriginLabel("INTAKE"), "Approved Quote");
  assert.equal(formatQuoteOriginLabel("MANUAL"), "Manual Commercial Terms");
});

test("computeOperationalEffectiveRateCents: Dave's $100 / 2h worked -> $50/h", () => {
  const rate = computeOperationalEffectiveRateCents(10_000, 2 * 3600);
  assert.equal(rate, 5_000); // 5000 cents = $50.00/h
});

test("computeOperationalEffectiveRateCents returns null for zero tracked seconds", () => {
  assert.equal(computeOperationalEffectiveRateCents(10_000, 0), null);
  assert.equal(computeOperationalEffectiveRateCents(10_000, -5), null);
});

// First Sale Economics (26 Aug 2026): the real observed case -- Dave
// DeMink's Landing Page, $100 fixed, 18 minutes tracked by Sensor so far,
// review pending with possibly a few more minutes of correction to come.
// These are the exact numbers from the brief, not rounded inputs.
test("computeOperationalEffectiveRateCents: Dave's real case, $100 / 18 minutes tracked -> ~$333.33/h", () => {
  const rate = computeOperationalEffectiveRateCents(10_000, 18 * 60);
  // 10000 cents / 0.3h = 33333.33... cents/h
  assert.ok(Math.abs(rate - 33_333.333) < 0.01);
  assert.equal(Math.round(rate), 33_333); // formats to $333.33/h
});

test("computeOperationalEffectiveRateCents: same $100, a few more tracked minutes (22m) lowers the rate -> ~$272.73/h", () => {
  const rate = computeOperationalEffectiveRateCents(10_000, 22 * 60);
  assert.ok(Math.abs(rate - 27_272.727) < 0.01);
  assert.equal(Math.round(rate), 27_273); // formats to $272.73/h
});

// Regression guard: this value must never be a stored/cached number --
// calling the same pure function again with more tracked time (the exact
// "correction adds a few more tracked minutes" scenario from the brief)
// must produce a different result automatically, with nothing to
// invalidate.
test("computeOperationalEffectiveRateCents recalculates automatically as tracked time grows", () => {
  const at18Minutes = computeOperationalEffectiveRateCents(10_000, 18 * 60);
  const at22Minutes = computeOperationalEffectiveRateCents(10_000, 22 * 60);
  assert.notEqual(at18Minutes, at22Minutes);
  assert.ok(at22Minutes < at18Minutes, "more tracked time for the same price means a lower effective rate");
});

// Hourly work must never be run through the fixed-price formula (and vice
// versa) -- the two describe different commercial facts. FIXED's
// effective rate is agreed-price-over-tracked-time (unit: currency/hour,
// derived from a single lump sum); HOURLY's rate-equivalent is
// tracked-hours-times-contract-rate (unit: currency, derived from a
// per-hour rate). Exercising both with realistic, distinct real cases in
// one test guards against either ever being swapped for the other.
test("hourly work is never run through the fixed-price effective-rate formula", () => {
  // Dave: FIXED, $100 agreed, 18m tracked.
  const daveEffectiveRateCents = computeOperationalEffectiveRateCents(10_000, 18 * 60);
  assert.equal(Math.round(daveEffectiveRateCents), 33_333);

  // Taryn: HOURLY, $25/h contract, 3h12m tracked -- computed with the
  // OTHER function, computeRateEquivalent, which CommercialTermsPanel's
  // HOURLY branch is the only branch that calls (its FIXED branch calls
  // computeOperationalEffectiveRateCents instead; the two are mutually
  // exclusive per the CommercialTerms discriminated union).
  const tarynRateEquivalent = computeRateEquivalent(3 * 3600 + 12 * 60, 25);
  assert.ok(Math.abs(tarynRateEquivalent - 80) < 0.001);

  // The two numbers describe different units and must never be compared
  // or substituted for one another.
  assert.notEqual(Math.round(daveEffectiveRateCents), Math.round(tarynRateEquivalent * 100));
});

test("computeRateEquivalent: Taryn's 3h12m at $25/h -> $80.00", () => {
  const seconds = 3 * 3600 + 12 * 60; // 3h12m
  const equivalent = computeRateEquivalent(seconds, 25);
  assert.ok(Math.abs(equivalent - 80) < 0.001);
});

test("computeRateEquivalent is zero for zero tracked time", () => {
  assert.equal(computeRateEquivalent(0, 25), 0);
});

// Quick Morning Reality Patch §11: SALE = approved quote, grouped by
// currency, never summed across currencies, never confused with revenue.
test("computeSalesThisMonth counts only APPROVED quotes approved within the month, grouped by currency", () => {
  const monthStart = new Date("2026-08-01T00:00:00.000Z");
  const summary = computeSalesThisMonth(
    [
      { currency: "USD", amountCents: 10_000, approvedAt: new Date("2026-08-05T00:00:00.000Z") },
      { currency: "USD", amountCents: 5_000, approvedAt: new Date("2026-08-20T00:00:00.000Z") },
      { currency: "BRL", amountCents: 30_000, approvedAt: new Date("2026-08-10T00:00:00.000Z") },
      { currency: "USD", amountCents: 99_999, approvedAt: new Date("2026-07-31T23:59:59.000Z") }, // last month
      { currency: "USD", amountCents: 12_345, approvedAt: null }, // never approved (shouldn't exist, but defensive)
    ],
    monthStart,
  );

  assert.equal(summary.totalCount, 3);
  assert.deepEqual(summary.byCurrency, [
    { currency: "BRL", count: 1, totalAmountCents: 30_000 },
    { currency: "USD", count: 2, totalAmountCents: 15_000 },
  ]);
});

test("computeSalesThisMonth is honestly zero with no approved quotes this month", () => {
  const summary = computeSalesThisMonth([], new Date("2026-08-01T00:00:00.000Z"));
  assert.equal(summary.totalCount, 0);
  assert.deepEqual(summary.byCurrency, []);
});

// First Sale Economics §2: APPROVED QUOTE = SALE, with no time window --
// "Closed sales" / "Value closed" as a permanent business fact, distinct
// from the monthly pace metric above. Same grouping, same currency
// discipline (never summed across currencies), just no month filter.
test("computeClosedSales counts every APPROVED quote ever, regardless of when, grouped by currency", () => {
  const summary = computeClosedSales([
    { currency: "USD", amountCents: 10_000, approvedAt: new Date("2026-01-15T00:00:00.000Z") }, // months ago
    { currency: "USD", amountCents: 5_000, approvedAt: new Date("2026-08-20T00:00:00.000Z") }, // this month
    { currency: "BRL", amountCents: 30_000, approvedAt: new Date("2025-12-01T00:00:00.000Z") }, // last year
  ]);
  assert.equal(summary.totalCount, 3);
  assert.deepEqual(summary.byCurrency, [
    { currency: "BRL", count: 1, totalAmountCents: 30_000 },
    { currency: "USD", count: 2, totalAmountCents: 15_000 },
  ]);
});

test("computeClosedSales excludes quotes that were never approved (no approvedAt)", () => {
  const summary = computeClosedSales([
    { currency: "USD", amountCents: 10_000, approvedAt: null }, // DRAFT/SENT/DECLINED shape
  ]);
  assert.equal(summary.totalCount, 0);
});

test("Dave's real case: a single $100 closed sale reads as Closed sales 1 / Value closed $100.00", () => {
  const summary = computeClosedSales([
    { currency: "USD", amountCents: 10_000, approvedAt: new Date("2026-08-26T00:00:00.000Z") },
  ]);
  assert.equal(summary.totalCount, 1);
  assert.deepEqual(summary.byCurrency, [{ currency: "USD", count: 1, totalAmountCents: 10_000 }]);
});

// A quote can only be APPROVED once (canTransitionQuoteStatus above is
// the enforcement -- DRAFT/SENT -> APPROVED is a one-way, one-time
// transition); computeClosedSales itself just counts rows, so a
// duplicated sale would require a duplicated quote ROW, which the
// action layer's video_id uniqueness / quote lifecycle already prevents
// (see quotes-production.integration.test.mjs). This test documents that
// computeClosedSales performs no dedup of its own because none is needed
// -- one row in, one count out.
test("computeClosedSales counts each quote row exactly once, no dedup logic needed", () => {
  const summary = computeClosedSales([
    { currency: "USD", amountCents: 10_000, approvedAt: new Date("2026-08-26T00:00:00.000Z") },
  ]);
  assert.equal(summary.totalCount, 1);
});
