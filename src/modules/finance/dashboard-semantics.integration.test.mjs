import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(
  new URL("../../app/page.tsx", import.meta.url),
  "utf8",
);

test("Dashboard labels the finance summary as economic history, never current cash", () => {
  assert.match(dashboard, /label="Economic Ledger Net"/u);
  assert.match(dashboard, /Recorded history · not Wise cash/u);
  assert.doesNotMatch(dashboard, /label="Current Balance"/u);
});
