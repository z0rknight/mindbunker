import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuoteRequestDescription,
  QUOTE_REQUEST_EVENT_TYPE,
  validateQuoteRequestInput,
} from "./core.ts";

const VALID = {
  name: "Dave Client",
  email: "dave@example.com",
  company: "",
  contentType: "short-form",
  whatAreYouCreating: "A launch video",
  mainObjective: "Drive signups",
  quantityFrequency: "",
  idealTimeline: "",
  referencesContext: "",
  notes: "",
};

test("valid input passes and normalizes empty optionals to null", () => {
  const result = validateQuoteRequestInput(VALID);
  assert.equal(result.success, true);
  assert.equal(result.data.name, "Dave Client");
  assert.equal(result.data.email, "dave@example.com");
  assert.equal(result.data.company, null);
  assert.equal(result.data.contentType, "short-form");
  assert.equal(result.data.quantityFrequency, null);
});

test("rejects a missing name, invalid email, unknown content type, and too-short answers", () => {
  const result = validateQuoteRequestInput({
    ...VALID,
    name: "  ",
    email: "not-an-email",
    contentType: "cinematic-universe",
    whatAreYouCreating: "hi",
    mainObjective: "x",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.email);
  assert.ok(result.errors.contentType);
  assert.ok(result.errors.whatAreYouCreating);
  assert.ok(result.errors.mainObjective);
});

test("email is cleaned/lowercased the same way booking's cleanEmail does", () => {
  const result = validateQuoteRequestInput({ ...VALID, email: "  Dave@Example.COM  " });
  assert.equal(result.success, true);
  assert.equal(result.data.email, "dave@example.com");
});

test("QUOTE_REQUEST_EVENT_TYPE matches the brief's example verbatim", () => {
  assert.equal(QUOTE_REQUEST_EVENT_TYPE, "quote.requested");
});

test("buildQuoteRequestDescription includes the key fields and omits blank optionals", () => {
  const result = validateQuoteRequestInput(VALID);
  assert.equal(result.success, true);
  const description = buildQuoteRequestDescription(result.data);
  assert.match(description, /Dave Client/);
  assert.match(description, /dave@example\.com/);
  assert.match(description, /short-form/);
  assert.match(description, /A launch video/);
  assert.match(description, /Drive signups/);
  assert.doesNotMatch(description, /Company:/);
  assert.doesNotMatch(description, /Quantity\/frequency:/);
});

test("buildQuoteRequestDescription includes optional fields when present", () => {
  const result = validateQuoteRequestInput({
    ...VALID,
    company: "Acme Inc.",
    quantityFrequency: "4 per month",
    idealTimeline: "This week",
    referencesContext: "See our brand guide",
    notes: "Budget-sensitive",
  });
  assert.equal(result.success, true);
  const description = buildQuoteRequestDescription(result.data);
  assert.match(description, /Company: Acme Inc\./);
  assert.match(description, /Quantity\/frequency: 4 per month/);
  assert.match(description, /Ideal timeline: This week/);
  assert.match(description, /References\/context: See our brand guide/);
  assert.match(description, /Notes: Budget-sensitive/);
});
