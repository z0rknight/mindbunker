import {
  DELIVERY_RECIPE_GATES,
  DELIVERY_RECIPE_STEP_STATES,
  type DeliveryRecipeGate,
  type DeliveryRecipeStepState,
} from "./config.ts";

export type RecipeStepSnapshot = {
  id: number;
  label: string;
  gate: DeliveryRecipeGate;
  position: number;
  qualityStandard: string | null;
  state: DeliveryRecipeStepState;
  updatedAt: string;
};

export type RecipeTransition = {
  id: number;
  stepId: number;
  stepLabel: string;
  previousState: DeliveryRecipeStepState;
  newState: DeliveryRecipeStepState;
  occurredAt: string;
  actor: string;
  source: string;
  provenance: string;
};

const TRANSITIONS: Record<DeliveryRecipeStepState, readonly DeliveryRecipeStepState[]> = {
  NOT_STARTED: ["ACTIVE", "N_A"],
  ACTIVE: ["DONE", "N_A"],
  DONE: ["ACTIVE"],
  N_A: ["NOT_STARTED"],
};

export function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isRecipeGate(value: unknown): value is DeliveryRecipeGate {
  return typeof value === "string" && (DELIVERY_RECIPE_GATES as readonly string[]).includes(value);
}

export function isRecipeStepState(value: unknown): value is DeliveryRecipeStepState {
  return typeof value === "string" && (DELIVERY_RECIPE_STEP_STATES as readonly string[]).includes(value);
}

export function canTransitionRecipeStep(
  from: DeliveryRecipeStepState,
  to: DeliveryRecipeStepState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function cleanRecipeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/gu, " ");
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

export function summarizeRecipeSteps(steps: readonly RecipeStepSnapshot[]) {
  const ordered = [...steps].sort((a, b) => a.position - b.position || a.id - b.id);
  const applicable = ordered.filter((step) => step.state !== "N_A");
  const done = applicable.filter((step) => step.state === "DONE").length;
  const active = ordered.find((step) => step.state === "ACTIVE") ?? null;
  const next = ordered.find((step) => step.state === "NOT_STARTED") ?? null;
  return {
    done,
    applicable: applicable.length,
    complete: ordered.length > 0 && applicable.every((step) => step.state === "DONE"),
    currentStep: active,
    nextStep: next,
  };
}

export type ClientRecipeStage = {
  key: "EDITING" | "FINISHING" | "QUALITY_REVIEW" | "READY_FOR_YOU";
  label: string;
  state: "DONE" | "ACTIVE" | "UP_NEXT" | "NOT_STARTED";
};

const CLIENT_STAGE_DEFINITIONS: ReadonlyArray<{
  key: ClientRecipeStage["key"];
  label: string;
  gates: readonly DeliveryRecipeGate[];
}> = [
  { key: "EDITING", label: "Editing", gates: ["STRUCTURE", "BUILD"] },
  { key: "FINISHING", label: "Finishing", gates: ["FINISH"] },
  { key: "QUALITY_REVIEW", label: "Quality review", gates: ["QUALITY_REVIEW"] },
  { key: "READY_FOR_YOU", label: "Ready for you", gates: ["REVIEW_DELIVERY"] },
];

export function buildClientRecipeProjection(
  steps: readonly Pick<RecipeStepSnapshot, "id" | "gate" | "position" | "state">[],
): ClientRecipeStage[] {
  const ordered = [...steps].sort((a, b) => a.position - b.position || a.id - b.id);
  const raw = CLIENT_STAGE_DEFINITIONS.flatMap((definition) => {
    const stageSteps = ordered.filter((step) => definition.gates.includes(step.gate));
    const applicable = stageSteps.filter((step) => step.state !== "N_A");
    if (stageSteps.length === 0 || applicable.length === 0) return [];
    const state: ClientRecipeStage["state"] = applicable.every((step) => step.state === "DONE")
      ? "DONE"
      : applicable.some((step) => step.state === "ACTIVE")
        ? "ACTIVE"
        : "NOT_STARTED";
    return [{ key: definition.key, label: definition.label, state }];
  });
  const firstIncomplete = raw.findIndex((stage) => stage.state === "NOT_STARTED");
  return raw.map((stage, index) =>
    index === firstIncomplete ? { ...stage, state: "UP_NEXT" as const } : stage,
  );
}
