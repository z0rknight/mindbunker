import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(
  new URL("../../app/page.tsx", import.meta.url),
  "utf8",
);
const financePage = readFileSync(
  new URL("../../app/finance/page.tsx", import.meta.url),
  "utf8",
);
const ledgerCard = readFileSync(
  new URL("../../components/finance/EconomicLedgerCard.tsx", import.meta.url),
  "utf8",
);
const operatingReality = readFileSync(
  new URL("../../components/operating-reality/DashboardOperatingReality.tsx", import.meta.url),
  "utf8",
);

// House Cleaning Wave 2 §11 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
// Dashboard no longer restates Finance's own numbers (that whole section
// was removed, not just collapsed -- see the Dashboard-simplification
// tests in productivity/master-qa-wave1.integration.test.mjs), so this
// semantic guard now targets the one place EconomicLedgerCard actually
// renders: Finance's own page.
test("Finance labels the economic ledger card as economic history, never current cash", () => {
  assert.match(financePage, /<EconomicLedgerCard/u);
  assert.match(ledgerCard, /Recorded economic history/u);
  assert.match(ledgerCard, /not Wise cash/iu);
  assert.doesNotMatch(financePage, /label="Current Balance"/u);
});

// Tuesday Patch Priority 5 / metric semantics: the original QA complaint
// was literally "make the $918 figure say ALL TIME HISTORY so it's
// unambiguous in seconds" -- this must be a real, visible label on the
// card, not just implied by "economic history" prose.
test("the economic ledger card explicitly labels itself as all-time history, not an active-window figure", () => {
  assert.match(ledgerCard, /all time history/iu);
});

// Wave 5 intentionally retires the isolated daily-income card. The
// replacement keeps Finance semantics stronger: cash received, open
// receivable and registered/expected billing are three visible categories,
// while a currency with no evidence is omitted instead of fabricated.
test("Operating Reality keeps received, receivable and expected evidence visibly separate", () => {
  assert.match(dashboard, /getOperatingReality/u);
  assert.match(operatingReality, /label="Received"/u);
  assert.match(operatingReality, /label="Receivable"/u);
  assert.match(operatingReality, /label="Expected \/ registered"/u);
  assert.match(operatingReality, /No current-month money evidence/u);
  assert.doesNotMatch(operatingReality, /Faturado hoje/u);
});
