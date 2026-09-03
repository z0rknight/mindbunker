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
  assert.match(ledgerCard, /Not Wise cash/u);
  assert.doesNotMatch(dashboard, /label="Current Balance"/u);
});
