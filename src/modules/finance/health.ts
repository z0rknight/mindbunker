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
  actionableItems: number;
};

export function computeFinanceHealth(input: {
  pocketDifferences: Array<number | null>;
  expectedPockets?: number;
  unresolvedAttribution: number;
  ambiguousEvidence: number;
  duplicateExternalIdentities: number;
  malformedFx: number;
}): FinanceHealth {
  const expectedPockets = input.expectedPockets ?? 7;
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
    actionableItems: 0,
  };
}
