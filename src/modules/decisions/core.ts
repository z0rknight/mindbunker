// Operator Intelligence Patch Phase 5: pure validation for the Decision
// Loop. Vocabulary is deliberately tiny -- see the decisions table
// comment in db/schema.ts for why this is not a task manager.

export function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export const DECISION_STATUSES = ["OPEN", "REVIEWED", "CANCELLED"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export type RecordDecisionInput = {
  signalType?: string | null;
  videoId?: number | null;
  clientId?: number | null;
  projectId?: number | null;
  decision: string;
  reviewAt?: string | null;
};

export type ValidatedRecordDecisionInput = {
  signalType: string | null;
  videoId: number | null;
  clientId: number | null;
  projectId: number | null;
  decision: string;
  reviewAt: Date | null;
};

type ValidationResult =
  | { success: true; data: ValidatedRecordDecisionInput }
  | { success: false; error: string };

function optionalId(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  return undefined;
}

export function validateRecordDecisionInput(values: RecordDecisionInput): ValidationResult {
  const decision = typeof values.decision === "string" ? values.decision.trim().slice(0, 500) : "";
  if (!decision) {
    return { success: false, error: "Describe the decision." };
  }

  const videoId = optionalId(values.videoId);
  const clientId = optionalId(values.clientId);
  const projectId = optionalId(values.projectId);
  if (videoId === undefined || clientId === undefined || projectId === undefined) {
    return { success: false, error: "Invalid context reference." };
  }

  const signalType =
    typeof values.signalType === "string" && values.signalType.trim()
      ? values.signalType.trim().slice(0, 60)
      : null;

  let reviewAt: Date | null = null;
  if (values.reviewAt !== undefined && values.reviewAt !== null && values.reviewAt !== "") {
    if (typeof values.reviewAt !== "string" || Number.isNaN(Date.parse(values.reviewAt))) {
      return { success: false, error: "Enter a valid review date." };
    }
    reviewAt = new Date(values.reviewAt);
  }

  return {
    success: true,
    data: { signalType, videoId, clientId, projectId, decision, reviewAt },
  };
}

export function validateResultInput(value: unknown): { success: true; result: string } | { success: false; error: string } {
  const result = typeof value === "string" ? value.trim().slice(0, 1000) : "";
  if (!result) {
    return { success: false, error: "Describe what happened." };
  }
  return { success: true, result };
}
