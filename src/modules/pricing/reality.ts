/**
 * Read-only pricing evidence. This deliberately does not mutate the pricing
 * formula: observed work is evidence beside the operator's estimate, never an
 * automatic repricing rule.
 */

export type PricingEvidenceConfidence = "LOW" | "MEDIUM" | "HIGH";
export type PricingEvidenceClassification = "RECORDED" | "INFERRED_FROM_PROJECT";

export type PricingEvidenceRow = {
  videoId: number;
  title: string;
  clientName: string | null;
  projectName: string | null;
  status: string;
  contentType: string;
  classification: PricingEvidenceClassification;
  trackedHours: number;
  manualHours: number;
  sessionCount: number;
  revisionCount: number;
};

export type PricingReality = {
  rows: PricingEvidenceRow[];
  completedSampleCount: number;
  activeSampleCount: number;
  confidence: PricingEvidenceConfidence;
  note: string;
};

export function classifyPricingEvidence(
  completedSampleCount: number,
): PricingEvidenceConfidence {
  if (completedSampleCount >= 10) return "HIGH";
  if (completedSampleCount >= 4) return "MEDIUM";
  return "LOW";
}

export function describePricingEvidence(
  completedSampleCount: number,
  activeSampleCount: number,
): string {
  const confidence = classifyPricingEvidence(completedSampleCount);
  if (confidence === "LOW") {
    return `${completedSampleCount} completed and ${activeSampleCount} active comparable sample${completedSampleCount + activeSampleCount === 1 ? "" : "s"}. Use as a reality check, not a pricing rule.`;
  }
  return `${completedSampleCount} completed and ${activeSampleCount} active comparable samples. Evidence can inform an operator override, but never changes the estimate automatically.`;
}

export function selectPricingReality(
  reality: PricingReality,
  calculatorContentType: string,
): PricingReality {
  const canonicalType = calculatorContentType === "custom" ? "other" : calculatorContentType;
  const rows = reality.rows.filter((row) => row.contentType === canonicalType);
  const completedSampleCount = rows.filter((row) => row.status === "DONE").length;
  const activeSampleCount = rows.length - completedSampleCount;
  return {
    rows,
    completedSampleCount,
    activeSampleCount,
    confidence: classifyPricingEvidence(completedSampleCount),
    note: describePricingEvidence(completedSampleCount, activeSampleCount),
  };
}
