import assert from "node:assert/strict";
import test from "node:test";
import { validateSubjectInventory } from "./config.ts";

test("subject inventory accepts explicit positive counts", () => {
  assert.deepEqual(validateSubjectInventory("coffee: 12\nwalking: 6"), {
    success: true,
    subjects: [
      { label: "coffee", shotCount: 12 },
      { label: "walking", shotCount: 6 },
    ],
  });
});

test("subject inventory rejects malformed evidence instead of silently dropping it", () => {
  assert.deepEqual(validateSubjectInventory("coffee: 12\nidea"), {
    success: false,
    error: "Subject line 2 must use “label: positive count”.",
  });
  assert.equal(validateSubjectInventory("coffee: 12\nCoffee: 2").success, false);
  assert.equal(validateSubjectInventory("bad: -1").success, false);
});
