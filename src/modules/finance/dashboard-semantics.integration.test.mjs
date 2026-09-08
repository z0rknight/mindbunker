import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(
  new URL("../../app/page.tsx", import.meta.url),
  "utf8",
);
const ledgerCard = readFileSync(
  new URL("../../components/finance/EconomicLedgerCard.tsx", import.meta.url),
  "utf8",
);

test("Dashboard labels the finance summary as economic history, never current cash", () => {
  assert.match(dashboard, /<EconomicLedgerCard/u);
  assert.match(ledgerCard, /Recorded economic history/u);
  assert.match(ledgerCard, /not Wise cash/iu);
  assert.doesNotMatch(dashboard, /label="Current Balance"/u);
});

// Tuesday Patch Priority 5 / metric semantics: the original QA complaint
// was literally "make the $918 figure say ALL TIME HISTORY so it's
// unambiguous in seconds" -- this must be a real, visible label on the
// card, not just implied by "economic history" prose.
test("the economic ledger card explicitly labels itself as all-time history, not an active-window figure", () => {
  assert.match(ledgerCard, /all time history/iu);
});
