import assert from "node:assert/strict";
import test from "node:test";

import { isSafeInternalPath } from "./navigation.ts";

test("accepts genuine internal paths", () => {
  assert.equal(isSafeInternalPath("/projects/42"), true);
  assert.equal(isSafeInternalPath("/productivity"), true);
  assert.equal(isSafeInternalPath("/productivity?video=1"), true);
});

test("rejects protocol-relative and off-site targets (open-redirect prevention)", () => {
  assert.equal(isSafeInternalPath("//evil.com"), false);
  assert.equal(isSafeInternalPath("https://evil.com"), false);
  assert.equal(isSafeInternalPath("javascript:alert(1)"), false);
  assert.equal(isSafeInternalPath("/\\evil.com"), false);
  assert.equal(isSafeInternalPath("evil.com"), false);
  assert.equal(isSafeInternalPath(""), false);
  assert.equal(isSafeInternalPath(null), false);
  assert.equal(isSafeInternalPath(undefined), false);
  assert.equal(isSafeInternalPath(42), false);
  assert.equal(isSafeInternalPath("/a\nLocation: evil.com"), false);
});
