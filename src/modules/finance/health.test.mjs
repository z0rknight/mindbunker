import assert from "node:assert/strict";
import test from "node:test";
import { computeFinanceHealth, financeHealthSentence } from "./health.ts";

const sevenZero = [0, 0, 0, 0, 0, 0, 0];

test("Finance Health is GREEN only when seven pockets and all structural facts are clean", () => {
  const result = computeFinanceHealth({
    pocketDifferences: sevenZero,
    unresolvedAttribution: 0,
    ambiguousEvidence: 0,
    duplicateExternalIdentities: 0,
    malformedFx: 0,
  });
  assert.equal(result.status, "GREEN");
  assert.equal(result.reason, "Cash reconciled · 7/7 pockets");
});

test("Finance Health is YELLOW when cash is exact but attribution or classification remains", () => {
  const result = computeFinanceHealth({
    pocketDifferences: sevenZero,
    unresolvedAttribution: 3,
    ambiguousEvidence: 5,
    duplicateExternalIdentities: 0,
    malformedFx: 0,
  });
  assert.equal(result.status, "YELLOW");
  assert.equal(result.actionableItems, 8);
});

test("Finance Health is RED for a pocket difference or structural duplication", () => {
  const pocketResult = computeFinanceHealth({
    pocketDifferences: [0, 0, 0, 0, 0, 0, 0.01],
    unresolvedAttribution: 0,
    ambiguousEvidence: 0,
    duplicateExternalIdentities: 0,
    malformedFx: 0,
    businessPocketIssues: 0,
    personalPocketIssues: 1,
  });
  assert.equal(pocketResult.status, "RED");
  assert.equal(pocketResult.personalPocketIssues, 1);
  assert.equal(pocketResult.businessPocketIssues, 0);
  assert.equal(computeFinanceHealth({
    pocketDifferences: sevenZero,
    unresolvedAttribution: 0,
    ambiguousEvidence: 0,
    duplicateExternalIdentities: 1,
    malformedFx: 0,
  }).status, "RED");
});

test("financeHealthSentence renders one plain sentence per status, not a report", () => {
  const green = computeFinanceHealth({
    pocketDifferences: sevenZero,
    unresolvedAttribution: 0,
    ambiguousEvidence: 0,
    duplicateExternalIdentities: 0,
    malformedFx: 0,
  });
  assert.deepEqual(financeHealthSentence(green), { emoji: "🟢", text: "Everything looks good." });

  const yellowOne = computeFinanceHealth({
    pocketDifferences: sevenZero,
    unresolvedAttribution: 1,
    ambiguousEvidence: 0,
    duplicateExternalIdentities: 0,
    malformedFx: 0,
  });
  assert.deepEqual(financeHealthSentence(yellowOne), {
    emoji: "🟡",
    text: "Everything is accounted for, but 1 item needs organizing.",
  });

  const yellowMany = computeFinanceHealth({
    pocketDifferences: sevenZero,
    unresolvedAttribution: 3,
    ambiguousEvidence: 0,
    duplicateExternalIdentities: 0,
    malformedFx: 0,
  });
  assert.deepEqual(financeHealthSentence(yellowMany), {
    emoji: "🟡",
    text: "Everything is accounted for, but 3 items need organizing.",
  });

  const red = computeFinanceHealth({
    pocketDifferences: sevenZero,
    unresolvedAttribution: 0,
    ambiguousEvidence: 0,
    duplicateExternalIdentities: 1,
    malformedFx: 0,
  });
  assert.deepEqual(financeHealthSentence(red), {
    emoji: "🔴",
    text: "Something doesn't match your records.",
  });
});
