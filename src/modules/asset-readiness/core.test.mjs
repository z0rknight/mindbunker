import { test } from "node:test";
import assert from "node:assert/strict";
import { isReadyToProduce } from "./core.ts";

test("isReadyToProduce: false when checklist is empty (unknown, not ready)", () => {
  assert.equal(isReadyToProduce([]), false);
});
test("isReadyToProduce: true when every item is READY or NOT_REQUIRED", () => {
  assert.equal(isReadyToProduce([{ status: "READY" }, { status: "NOT_REQUIRED" }]), true);
});
test("isReadyToProduce: false when anything is MISSING or ARRIVING", () => {
  assert.equal(isReadyToProduce([{ status: "READY" }, { status: "MISSING" }]), false);
  assert.equal(isReadyToProduce([{ status: "ARRIVING" }]), false);
});
