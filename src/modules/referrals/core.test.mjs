import assert from "node:assert/strict";
import test from "node:test";

import {
  describeLeadSource,
  isReferralSource,
  referralDescriptionPrefix,
  resolveReferral,
  shouldAdoptReferralSource,
  sourceForNewLead,
} from "./core.ts";
import { buildQuoteRequestDescription } from "../quote-intake/core.ts";

test("resolveReferral: only the closed allowlist resolves, case/space tolerant", () => {
  for (const good of ["pdbm", "PDBM", "  Pdbm "]) {
    assert.equal(resolveReferral(good)?.key, "pdbm");
  }
  for (const bad of [undefined, null, "", "  ", "pdbm2", "taryn", "<script>", "__proto__", "constructor", "toString", ["pdbm"], 42, "p".repeat(200)]) {
    assert.equal(resolveReferral(bad), null, `must not resolve: ${String(bad)}`);
  }
});

test("canonical attribution: category + program + referrer are all recoverable", () => {
  const pdbm = resolveReferral("pdbm");
  assert.equal(pdbm.source, "referral:pdbm");
  assert.ok(isReferralSource(pdbm.source));
  assert.match(pdbm.originStatement, /Perfect Day Business Mentorship/u);
  assert.match(pdbm.originStatement, /Taryn/u);
  assert.match(pdbm.originStatement, /CEO Clubhouse/u);
  assert.match(describeLeadSource("referral:pdbm"), /PDBM.*Taryn.*CEO Clubhouse/u);
});

test("visitor copy stays neutral: no partnership, discount, or endorsement claims", () => {
  const line = resolveReferral("pdbm").visitorLine;
  assert.doesNotMatch(line, /partner|official|discount|special|guarantee|endorse|testimonial|%|\$/iu);
});

test("new lead source: referral wins over the channel slug; no referral keeps the slug", () => {
  assert.equal(sourceForNewLead("quoteavideo", resolveReferral("pdbm")), "referral:pdbm");
  assert.equal(sourceForNewLead("quoteavideo", null), "quoteavideo");
  assert.equal(sourceForNewLead("book", null), "book");
});

test("source precedence: an existing origin is never overwritten, only an empty one is filled", () => {
  assert.equal(shouldAdoptReferralSource("referral:pdbm"), false);
  assert.equal(shouldAdoptReferralSource("quoteavideo"), false);
  assert.equal(shouldAdoptReferralSource("book"), false);
  assert.equal(shouldAdoptReferralSource("instagram dm"), false);
  assert.equal(shouldAdoptReferralSource(null), true);
  assert.equal(shouldAdoptReferralSource(""), true);
  assert.equal(shouldAdoptReferralSource("   "), true);
});

test("describeLeadSource: unknown/legacy sources render unchanged, empty renders null", () => {
  assert.equal(describeLeadSource("quoteavideo"), "quoteavideo");
  assert.equal(describeLeadSource("book"), "book");
  assert.equal(describeLeadSource(null), null);
  assert.equal(isReferralSource("quoteavideo"), false);
  assert.equal(isReferralSource(null), false);
});

test("quote request description leads with the referral fact and keeps the inquiry", () => {
  const data = {
    name: "PDBM QA Referral", email: "qa@example.com", company: null, contentType: "short-form",
    whatAreYouCreating: "Weekly reels", mainObjective: "Grow", quantityFrequency: "4 per month",
    idealTimeline: null, referencesContext: null, notes: null,
  };
  const referred = buildQuoteRequestDescription(data, resolveReferral("pdbm"));
  assert.ok(referred.startsWith(referralDescriptionPrefix(resolveReferral("pdbm"))));
  assert.match(referred, /Referred through Perfect Day Business Mentorship/u);
  assert.match(referred, /Weekly reels/u);
  assert.match(referred, /Quantity\/frequency: 4 per month/u);
  const plain = buildQuoteRequestDescription(data);
  assert.doesNotMatch(plain, /Referred through/u);
  assert.equal(plain, buildQuoteRequestDescription(data, null));
});
