import "server-only";

import type { getDb } from "@/db";
import {
  deliveryRecipeEvents,
  deliveryRecipes,
  deliveryRecipeSteps,
  projects,
  videoLogs,
  videoRecipeInstances,
  videoRecipeInstanceSteps,
  workSessions,
} from "@/db/schema";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { DeliveryRecipeEventSource, DeliveryRecipeStepState } from "./config";
import {
  canTransitionRecipeStep,
  isPositiveId,
  isRecipeStepState,
  summarizeRecipeSteps,
  type RecipeStepSnapshot,
  type RecipeTransition,
} from "./core";

type Database = Awaited<ReturnType<typeof getDb>>;

export type RecipeActionResult =
  | { success: true; message: string; id?: number }
  | { success: false; error: string };

function toIso(value: Date | string | number | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value * 1_000).toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date(0).toISOString();
}

export async function getVideoRecipeSafety(db: Database, videoId: number) {
  const rows = await db
    .select({
      id: videoLogs.id,
      title: videoLogs.title,
      status: videoLogs.status,
      isOperationalContainer: videoLogs.isOperationalContainer,
      projectStatus: projects.status,
    })
    .from(videoLogs)
    .leftJoin(projects, eq(videoLogs.projectId, projects.id))
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  return rows[0] ?? null;
}

export function videoRecipeMutationError(
  video: Awaited<ReturnType<typeof getVideoRecipeSafety>>,
): string | null {
  if (!video) return "Video not found.";
  if (video.isOperationalContainer) return "Production containers cannot own a Delivery Recipe.";
  if (video.status === "DONE") return "Completed Videos are historical and cannot start or change a Recipe.";
  if (video.projectStatus === "archived") return "Archived Project Videos are read-only.";
  return null;
}

export async function transitionDeliveryRecipeStepWithDb(
  db: Database,
  input: {
    videoId: number;
    stepId: number;
    nextState: DeliveryRecipeStepState;
    source: DeliveryRecipeEventSource;
    provenance: string;
  },
): Promise<RecipeActionResult> {
  if (!isPositiveId(input.videoId) || !isPositiveId(input.stepId) || !isRecipeStepState(input.nextState)) {
    return { success: false, error: "Invalid Recipe transition." };
  }
  const video = await getVideoRecipeSafety(db, input.videoId);
  const safetyError = videoRecipeMutationError(video);
  if (safetyError) return { success: false, error: safetyError };
  const rows = await db
    .select({
      id: videoRecipeInstanceSteps.id,
      instanceId: videoRecipeInstanceSteps.instanceId,
      state: videoRecipeInstanceSteps.state,
      archivedAt: videoRecipeInstances.archivedAt,
    })
    .from(videoRecipeInstanceSteps)
    .innerJoin(videoRecipeInstances, eq(videoRecipeInstanceSteps.instanceId, videoRecipeInstances.id))
    .where(and(
      eq(videoRecipeInstanceSteps.id, input.stepId),
      eq(videoRecipeInstances.videoId, input.videoId),
      isNull(videoRecipeInstances.archivedAt),
    ))
    .limit(1);
  const current = rows[0];
  if (!current || current.archivedAt) return { success: false, error: "Current Recipe step not found." };
  if (!canTransitionRecipeStep(current.state, input.nextState)) {
    return {
      success: false,
      error: `Cannot move ${current.state.replaceAll("_", " ")} to ${input.nextState.replaceAll("_", " ")}.`,
    };
  }
  if (input.nextState === "ACTIVE") {
    const active = await db
      .select({ id: videoRecipeInstanceSteps.id })
      .from(videoRecipeInstanceSteps)
      .where(and(
        eq(videoRecipeInstanceSteps.instanceId, current.instanceId),
        eq(videoRecipeInstanceSteps.state, "ACTIVE"),
        ne(videoRecipeInstanceSteps.id, input.stepId),
      ))
      .limit(1);
    if (active[0]) return { success: false, error: "Finish or mark the current active step N/A first." };
  }
  const now = Math.floor(Date.now() / 1_000);
  const result = await db.$client.batch([
    db.$client.prepare(`UPDATE video_recipe_instance_steps
      SET state = ?1, updated_at = ?2
      WHERE id = ?3 AND instance_id = ?4 AND state = ?5
      RETURNING id`).bind(input.nextState, now, input.stepId, current.instanceId, current.state),
    db.$client.prepare(`INSERT INTO delivery_recipe_events
      (video_id, instance_id, instance_step_id, previous_state, new_state,
       occurred_at, actor, source, provenance)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'admin', ?7, ?8
      WHERE changes() = 1`).bind(
        input.videoId,
        current.instanceId,
        input.stepId,
        current.state,
        input.nextState,
        now,
        input.source,
        input.provenance,
      ),
    db.$client.prepare(`UPDATE video_recipe_instances
      SET status = CASE
            WHEN EXISTS (SELECT 1 FROM video_recipe_instance_steps s WHERE s.instance_id = ?1 AND s.state NOT IN ('DONE', 'N_A'))
              THEN 'ACTIVE' ELSE 'COMPLETED' END,
          completed_at = CASE
            WHEN EXISTS (SELECT 1 FROM video_recipe_instance_steps s WHERE s.instance_id = ?1 AND s.state NOT IN ('DONE', 'N_A'))
              THEN NULL ELSE ?2 END,
          updated_at = ?2
      WHERE id = ?1`).bind(current.instanceId, now),
  ]);
  if (!result[0].results[0]) {
    return { success: false, error: "Recipe changed before this transition. Refresh and try again." };
  }
  return {
    success: true,
    message: input.nextState === "DONE" ? "Step completed." : "Recipe updated.",
  };
}

export async function getVideoRecipeWorkspaceWithDb(
  db: Database,
  videoId: number,
  options: { includeTemplates?: boolean } = {},
) {
  if (!isPositiveId(videoId)) return { success: false as const, error: "Invalid Video." };
  const video = await getVideoRecipeSafety(db, videoId);
  if (!video) return { success: false as const, error: "Video not found." };
  const templates = options.includeTemplates === false
    ? []
    : await db
      .select({
        id: deliveryRecipes.id,
        name: deliveryRecipes.name,
        applicability: deliveryRecipes.applicability,
        stepCount: sql<number>`count(${deliveryRecipeSteps.id})`,
      })
      .from(deliveryRecipes)
      .innerJoin(deliveryRecipeSteps, and(eq(deliveryRecipeSteps.recipeId, deliveryRecipes.id), eq(deliveryRecipeSteps.enabled, true)))
      .where(eq(deliveryRecipes.isActive, true))
      .groupBy(deliveryRecipes.id)
      .orderBy(asc(deliveryRecipes.name));
  const instances = await db
    .select()
    .from(videoRecipeInstances)
    .where(and(eq(videoRecipeInstances.videoId, videoId), isNull(videoRecipeInstances.archivedAt)))
    .limit(1);
  const instance = instances[0];
  if (!instance) {
    return {
      success: true as const,
      data: {
        video: { id: video.id, title: video.title, mutable: videoRecipeMutationError(video) === null },
        templates: templates.map((template) => ({ ...template, stepCount: Number(template.stepCount) })),
        instance: null,
      },
    };
  }
  const [stepRows, eventRows, workRows] = await Promise.all([
    db.select().from(videoRecipeInstanceSteps).where(eq(videoRecipeInstanceSteps.instanceId, instance.id)).orderBy(asc(videoRecipeInstanceSteps.positionSnapshot), asc(videoRecipeInstanceSteps.id)),
    db
      .select({
        id: deliveryRecipeEvents.id,
        stepId: deliveryRecipeEvents.instanceStepId,
        stepLabel: videoRecipeInstanceSteps.labelSnapshot,
        previousState: deliveryRecipeEvents.previousState,
        newState: deliveryRecipeEvents.newState,
        occurredAt: deliveryRecipeEvents.occurredAt,
        actor: deliveryRecipeEvents.actor,
        source: deliveryRecipeEvents.source,
        provenance: deliveryRecipeEvents.provenance,
      })
      .from(deliveryRecipeEvents)
      .innerJoin(videoRecipeInstanceSteps, eq(deliveryRecipeEvents.instanceStepId, videoRecipeInstanceSteps.id))
      .where(eq(deliveryRecipeEvents.instanceId, instance.id))
      .orderBy(desc(deliveryRecipeEvents.occurredAt), desc(deliveryRecipeEvents.id))
      .limit(20),
    db
      .select({
        sessionCount: sql<number>`count(*)`,
        closedSeconds: sql<number>`coalesce(sum(${workSessions.endedAt} - ${workSessions.startedAt}), 0)`,
      })
      .from(workSessions)
      .where(and(eq(workSessions.videoId, videoId), sql`${workSessions.endedAt} is not null`)),
  ]);
  const steps: RecipeStepSnapshot[] = stepRows.map((step) => ({
    id: step.id,
    label: step.labelSnapshot,
    gate: step.gateSnapshot,
    position: step.positionSnapshot,
    qualityStandard: step.qualityStandardSnapshot,
    state: step.state,
    updatedAt: toIso(step.updatedAt),
  }));
  const events: RecipeTransition[] = eventRows.map((event) => ({
    ...event,
    occurredAt: toIso(event.occurredAt),
  }));
  return {
    success: true as const,
    data: {
      video: { id: video.id, title: video.title, mutable: videoRecipeMutationError(video) === null },
      templates: templates.map((template) => ({ ...template, stepCount: Number(template.stepCount) })),
      instance: {
        id: instance.id,
        recipeId: instance.recipeId,
        recipeName: instance.recipeNameSnapshot,
        status: instance.status,
        createdAt: toIso(instance.createdAt),
        completedAt: instance.completedAt ? toIso(instance.completedAt) : null,
        steps,
        events,
        summary: summarizeRecipeSteps(steps),
        work: {
          sessionCount: Number(workRows[0]?.sessionCount ?? 0),
          closedSeconds: Number(workRows[0]?.closedSeconds ?? 0),
        },
      },
    },
  };
}
