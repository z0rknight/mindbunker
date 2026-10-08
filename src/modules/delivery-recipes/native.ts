import "server-only";

import type { getVideoRecipeWorkspaceWithDb } from "./service";

type WorkspaceResult = Awaited<ReturnType<typeof getVideoRecipeWorkspaceWithDb>>;
type WorkspaceData = Extract<WorkspaceResult, { success: true }>["data"];

export function projectNativeDeliveryRecipe(data: WorkspaceData) {
  const instance = data.instance;
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    video_id: data.video.id,
    mutable: data.video.mutable,
    recipe: instance ? {
      id: instance.id,
      name: instance.recipeName,
      status: instance.status,
      summary: {
        done: instance.summary.done,
        applicable: instance.summary.applicable,
        complete: instance.summary.complete,
        current_step_id: instance.summary.currentStep?.id ?? null,
        next_step_id: instance.summary.nextStep?.id ?? null,
      },
      steps: instance.steps.map((step) => ({
        id: step.id,
        label: step.label,
        gate: step.gate,
        position: step.position,
        quality_standard: step.qualityStandard,
        state: step.state,
        updated_at: step.updatedAt,
      })),
      recent_transitions: instance.events.map((event) => ({
        id: event.id,
        step_id: event.stepId,
        step_label: event.stepLabel,
        previous_state: event.previousState,
        new_state: event.newState,
        occurred_at: event.occurredAt,
        source: event.source,
      })),
    } : null,
  };
}
