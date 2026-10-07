import assert from "node:assert/strict";
import test from "node:test";
import { parseSubjectInventory } from "./config.ts";

test("subject inventory keeps only explicit positive counts", () => {
  assert.deepEqual(parseSubjectInventory("coffee: 12\nwalking: 6\nidea\nbad: -1"), [
    { label: "coffee", shotCount: 12 },
    { label: "walking", shotCount: 6 },
  ]);
});
