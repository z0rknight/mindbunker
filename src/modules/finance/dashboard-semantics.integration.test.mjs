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

// Sunday QA Patch — Bug 2 regression: "Faturado hoje" disappeared (or
// silently read as $0) on a day with no recorded income. Verifies the
// exact guard is still present: an empty todayIncome array renders "—",
// never a fabricated zero, and the value comes from a length check on
// real rows, not a falsy-number check that would misread a genuine $0.
test("Faturado hoje renders an em dash on a day with no recorded income, never a fabricated zero", () => {
  assert.match(dashboard, /label="Faturado hoje"/u);
  assert.match(
    dashboard,
    /todayIncome\.length > 0[\s\S]{0,200}:\s*"—"/u,
    "the empty-income fallback must be a length check on the real income rows, not `amount || 0` or similar",
  );
});
