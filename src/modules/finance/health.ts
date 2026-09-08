export type FinanceHealthStatus = "GREEN" | "YELLOW" | "RED";

export type FinanceHealth = {
  status: FinanceHealthStatus;
  reason: string;
  reconciledPockets: number;
  expectedPockets: number;
  unresolvedAttribution: number;
  ambiguousEvidence: number;
  duplicateExternalIdentities: number;
  malformedFx: number;
  businessPocketIssues: number;
  personalPocketIssues: number;
  actionableItems: number;
};

export function computeFinanceHealth(input: {
  pocketDifferences: Array<number | null>;
  expectedPockets?: number;
  unresolvedAttribution: number;
  ambiguousEvidence: number;
  duplicateExternalIdentities: number;
  malformedFx: number;
  businessPocketIssues?: number;
  personalPocketIssues?: number;
}): FinanceHealth {
  const expectedPockets = input.expectedPockets ?? 7;
  const businessPocketIssues = input.businessPocketIssues ?? 0;
  const personalPocketIssues = input.personalPocketIssues ?? 0;
  const reconciledPockets = input.pocketDifferences.filter(
    (difference) => difference !== null && Math.abs(difference) < 0.005,
  ).length;
  const structuralFailure =
    input.pocketDifferences.length !== expectedPockets ||
    reconciledPockets !== expectedPockets ||
    input.duplicateExternalIdentities > 0 ||
    input.malformedFx > 0;
  const actionableItems =
    input.unresolvedAttribution +
    input.ambiguousEvidence +
    input.duplicateExternalIdentities +
    input.malformedFx +
    Math.max(0, expectedPockets - reconciledPockets);

  if (structuralFailure) {
    return {
      status: "RED",
      reason:
        reconciledPockets !== expectedPockets
          ? `${expectedPockets - reconciledPockets} pocket(s) differ from Wise or lack evidence`
          : "Structural finance evidence needs repair",
      reconciledPockets,
      expectedPockets,
      unresolvedAttribution: input.unresolvedAttribution,
      ambiguousEvidence: input.ambiguousEvidence,
      duplicateExternalIdentities: input.duplicateExternalIdentities,
      malformedFx: input.malformedFx,
      businessPocketIssues,
      personalPocketIssues,
      actionableItems,
    };
  }
  if (input.unresolvedAttribution > 0 || input.ambiguousEvidence > 0) {
    return {
      status: "YELLOW",
      reason: `Cash reconciled · ${input.unresolvedAttribution + input.ambiguousEvidence} item(s) need attention`,
      reconciledPockets,
      expectedPockets,
      unresolvedAttribution: input.unresolvedAttribution,
      ambiguousEvidence: input.ambiguousEvidence,
      duplicateExternalIdentities: input.duplicateExternalIdentities,
      malformedFx: input.malformedFx,
      businessPocketIssues,
      personalPocketIssues,
      actionableItems,
    };
  }
  return {
    status: "GREEN",
    reason: `Cash reconciled · ${expectedPockets}/${expectedPockets} pockets`,
    reconciledPockets,
    expectedPockets,
    unresolvedAttribution: 0,
    ambiguousEvidence: 0,
    duplicateExternalIdentities: 0,
    malformedFx: 0,
    businessPocketIssues,
    personalPocketIssues,
    actionableItems: 0,
  };
}

export type FinanceHealthSentence = { emoji: string; text: string };

// Tuesday Patch Priority 4 (brief §Finance.3): "Saude financeira deveria
// ser uma frase, não um relatório" -- the pockets/action-queue readout
// stays available one layer down (FinanceHealthPanel, inside Accounting
// details); Overview gets one plain sentence off the same status this
// module already computes.
export function financeHealthSentence(health: FinanceHealth): FinanceHealthSentence {
  if (health.status === "RED") {
    return { emoji: "🔴", text: "Something doesn't match your records." };
  }
  if (health.status === "YELLOW") {
    const n = health.actionableItems;
    return {
      emoji: "🟡",
      text: `Everything is accounted for, but ${n} item${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} organizing.`,
    };
  }
  return { emoji: "🟢", text: "Everything looks good." };
}

export type FinanceHealthActionItem = { key: string; label: string; href: string };

// The Overview "Needs You" panel and the deeper FinanceHealthPanel (brief
// §Finance.4) both link to the same set of structural issues -- one shared
// mapping so the copy and hrefs never drift between the two renderings.
export function getFinanceHealthActionItems(health: FinanceHealth): FinanceHealthActionItem[] {
  const items: FinanceHealthActionItem[] = [];
  if (health.businessPocketIssues > 0) {
    items.push({
      key: "business-pockets",
      label: `${health.businessPocketIssues} business pocket${health.businessPocketIssues === 1 ? "" : "s"} need reconciliation`,
      href: "/finance#business-wise",
    });
  }
  if (health.personalPocketIssues > 0) {
    items.push({
      key: "personal-pockets",
      label: `${health.personalPocketIssues} personal pocket${health.personalPocketIssues === 1 ? "" : "s"} need reconciliation`,
      href: "/finance/personal#personal-wise",
    });
  }
  if (health.unresolvedAttribution > 0) {
    items.push({
      key: "attribution",
      label: `${health.unresolvedAttribution} income receipt${health.unresolvedAttribution === 1 ? "" : "s"} need a client/project assigned`,
      href: "/finance#transactions",
    });
  }
  if (health.ambiguousEvidence > 0) {
    items.push({
      key: "ambiguous-evidence",
      label: `${health.ambiguousEvidence} custody movement${health.ambiguousEvidence === 1 ? "" : "s"} remain evidence-only`,
      href: "/finance#business-wise",
    });
  }
  if (health.malformedFx > 0) {
    items.push({
      key: "malformed-fx",
      label: `${health.malformedFx} FX row${health.malformedFx === 1 ? "" : "s"} need review`,
      href: "/finance/fx",
    });
  }
  if (health.duplicateExternalIdentities > 0) {
    items.push({
      key: "duplicate-identities",
      label: `${health.duplicateExternalIdentities} duplicate external identity issue${health.duplicateExternalIdentities === 1 ? "" : "s"}`,
      href: "/finance#business-wise",
    });
  }
  return items;
}
