import assert from "node:assert/strict";
import test from "node:test";
import {
  hashPublicOfferToken,
  isCommercialCapacityState,
  isCommercialOfferType,
  isPublicOfferToken,
  parseCommercialOfferDecision,
  validateHttpsUrl,
} from "./core.ts";

test("commercial vocabularies remain small and human-owned", () => {
  assert.equal(isCommercialCapacityState("OPEN"), true);
  assert.equal(isCommercialCapacityState("AUTO_CLOSED"), false);
  assert.equal(isCommercialOfferType("HERO_EDIT"), true);
  assert.equal(isCommercialOfferType("DFY"), false);
});

test("public Offer transport accepts only high-entropy tokens and HTTPS payments", async () => {
  const token = "a".repeat(43);
  assert.equal(isPublicOfferToken(token), true);
  assert.equal(isPublicOfferToken("quote-7"), false);
  assert.equal((await hashPublicOfferToken(token)).length, 64);
  assert.equal(validateHttpsUrl("https://wise.com/pay/example"), "https://wise.com/pay/example");
  assert.equal(validateHttpsUrl("http://wise.com/pay/example"), null);
  assert.equal(validateHttpsUrl("javascript:alert(1)"), null);
});

test("human Offer decisions preserve provenance and reject derived lookalikes", () => {
  const decision = parseCommercialOfferDecision(JSON.stringify({ offerType: "RECURRING_PARTNERSHIP", reason: "Cadence is confirmed", decidedAt: "2026-10-08T12:00:00.000Z", actor: "admin" }));
  assert.equal(decision?.offerType, "RECURRING_PARTNERSHIP");
  assert.equal(parseCommercialOfferDecision(JSON.stringify({ offerType: "RECURRING_PARTNERSHIP", decidedAt: "2026-10-08T12:00:00.000Z", actor: "system" })), null);
});
