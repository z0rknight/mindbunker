import assert from "node:assert/strict";
import test from "node:test";
import { isValidEmail, normalizeEmail } from "./config.ts";

test("email normalization is deterministic and lower-case", () => {
  assert.equal(normalizeEmail("  Emmanuel@Example.COM "), "emmanuel@example.com");
  assert.equal(normalizeEmail(null), "");
});

test("email validation rejects incomplete addresses", () => {
  assert.equal(isValidEmail("hello@example.com"), true);
  assert.equal(isValidEmail("hello@"), false);
  assert.equal(isValidEmail("hello example.com"), false);
});
