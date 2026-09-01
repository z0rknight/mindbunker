import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTagList, serializeTagList, resolveVideoTags } from "./core.ts";

test("parseTagList: splits, trims, drops empties", () => {
  assert.deepEqual(parseTagList("MINI, TARYN,  , SHORT-FORM"), ["MINI", "TARYN", "SHORT-FORM"]);
  assert.deepEqual(parseTagList(null), []);
});
test("serializeTagList: dedups and joins", () => {
  assert.equal(serializeTagList(["MINI", "mini", "TARYN"]), "MINI, TARYN");
});
test("resolveVideoTags: pure inheritance when no override", () => {
  assert.deepEqual(resolveVideoTags("MINI, TARYN, VERTICAL", null), ["MINI", "TARYN", "VERTICAL"]);
});
test("resolveVideoTags: local removal drops an inherited tag", () => {
  const override = JSON.stringify({ added: [], removed: ["VERTICAL"] });
  assert.deepEqual(resolveVideoTags("MINI, TARYN, VERTICAL", override), ["MINI", "TARYN"]);
});
test("resolveVideoTags: local addition appends without duplicating", () => {
  const override = JSON.stringify({ added: ["BTS", "MINI"], removed: [] });
  assert.deepEqual(resolveVideoTags("MINI, TARYN", override), ["MINI", "TARYN", "BTS"]);
});
test("resolveVideoTags: a Project tag edit still propagates (override only encodes deltas)", () => {
  const override = JSON.stringify({ added: ["BTS"], removed: [] });
  assert.deepEqual(resolveVideoTags("MINI, TARYN, NEW_PROJECT_TAG", override), ["MINI", "TARYN", "NEW_PROJECT_TAG", "BTS"]);
});
