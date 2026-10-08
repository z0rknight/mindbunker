"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
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
import { revalidatePath } from "next/cache";
import type { DeliveryRecipeStepState } from "./config";
import {
  canTransitionRecipeStep,
  cleanRecipeText,
  isPositiveId,
  isRecipeGate,
  isRecipeStepState,
  summarizeRecipeSteps,
  type RecipeStepSnapshot,
  type RecipeTransition,
} from "./core";

type ActionResult =
  | { success: true; message: string; id?: number }
  | { success: false; error: string };

function revalidateRecipeViews(videoId?: number) {
  revalidatePath("/recipes");
  revalidatePath("/war-room/workspace");
  if (videoId) revalidatePath(`/client/dashboard/videos/${videoId}`);
}

function toIso(value: Date | string | number | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value * 1_000).toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date(0).toISOString();
}

export async function getRecipeManagement() {
  const db = await getAuthenticatedDb();
  const [recipes, steps] = await Promise.all([
    db.select().from(deliveryRecipes).orderBy(desc(deliveryRecipes.isActive), asc(deliveryRecipes.name)),
    db.select().from(deliveryRecipeSteps).orderBy(asc(deliveryRecipeSteps.recipeId), asc(deliveryRecipeSteps.position), asc(deliveryRecipeSteps.id)),
  ]);
  return recipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    applicability: recipe.applicability,
    isActive: recipe.isActive,
    steps: steps.filter((step) => step.recipeId === recipe.id).map((step) => ({
      id: step.id,
      label: step.label,
      gate: step.gate,
      position: step.position,
      qualityStandard: step.qualityStandard,
      enabled: step.enabled,
    })),
  }));
}

export async function createDeliveryRecipe(input: {
  name: unknown;
  applicability: unknown;
}): Promise<ActionResult> {
  const name = cleanRecipeText(input.name, 120);
  const applicability = cleanRecipeText(input.applicability, 240);
  if (!name || !applicability) {
    return { success: false, error: "Name and applicability are required." };
  }
  const db = await getAuthenticatedDb();
  try {
    const rows = await db.insert(deliveryRecipes).values({ name, applicability }).returning({ id: deliveryRecipes.id });
    const id = rows[0]?.id;
    if (!id) return { success: false, error: "Recipe could not be created." };
    revalidateRecipeViews();
    return { success: true, message: "Recipe created.", id };
  } catch (error) {
    if (error instanceof Error && /unique/iu.test(error.message)) {
      return { success: false, error: "A Recipe with this name already exists." };
    }
    throw error;
  }
}

export async function addDeliveryRecipeStep(input: {
  recipeId: unknown;
  label: unknown;
  gate: unknown;
  qualityStandard?: unknown;
}): Promise<ActionResult> {
  if (!isPositiveId(input.recipeId)) return { success: false, error: "Invalid Recipe." };
  const label = cleanRecipeText(input.label, 120);
  const qualityStandard = input.qualityStandard == null || input.qualityStandard === ""
    ? null
    : cleanRecipeText(input.qualityStandard, 300);
  if (!label || !isRecipeGate(input.gate) || (input.qualityStandard && !qualityStandard)) {
    return { success: false, error: "Enter a valid label, gate and optional completion standard." };
  }
  const db = await getAuthenticatedDb();
  const recipe = await db.select({ id: deliveryRecipes.id }).from(deliveryRecipes).where(eq(deliveryRecipes.id, input.recipeId)).limit(1);
  if (!recipe[0]) return { success: false, error: "Recipe not found." };
  const next = await db
    .select({ position: sql<number>`coalesce(max(${deliveryRecipeSteps.position}), -1) + 1` })
    .from(deliveryRecipeSteps)
    .where(eq(deliveryRecipeSteps.recipeId, input.recipeId));
  await db.insert(deliveryRecipeSteps).values({
    recipeId: input.recipeId,
    label,
    gate: input.gate,
    qualityStandard,
    position: Number(next[0]?.position ?? 0),
  });
  revalidateRecipeViews();
  return { success: true, message: "Step added." };
}

export async function moveDeliveryRecipeStep(
  stepId: number,
  direction: "UP" | "DOWN",
): Promise<ActionResult> {
  if (!isPositiveId(stepId) || !["UP", "DOWN"].includes(direction)) {
    return { success: false, error: "Invalid step move." };
  }
  const db = await getAuthenticatedDb();
  const current = await db.select().from(deliveryRecipeSteps).where(eq(deliveryRecipeSteps.id, stepId)).limit(1);
  if (!current[0]) return { success: false, error: "Step not found." };
  const siblings = await db
    .select({ id: deliveryRecipeSteps.id, position: deliveryRecipeSteps.position })
    .from(deliveryRecipeSteps)
    .where(eq(deliveryRecipeSteps.recipeId, current[0].recipeId))
    .orderBy(asc(deliveryRecipeSteps.position), asc(deliveryRecipeSteps.id));
  const index = siblings.findIndex((step) => step.id === stepId);
  const target = siblings[direction === "UP" ? index - 1 : index + 1];
  if (!target) return { success: true, message: "Step is already at the edge." };
  await db.batch([
    db.update(deliveryRecipeSteps).set({ position: target.position, updatedAt: new Date() }).where(eq(deliveryRecipeSteps.id, stepId)),
    db.update(deliveryRecipeSteps).set({ position: current[0].position, updatedAt: new Date() }).where(eq(deliveryRecipeSteps.id, target.id)),
  ]);
  revalidateRecipeViews();
  return { success: true, message: "Step moved." };
}

export async function setDeliveryRecipeStepEnabled(
  stepId: number,
  enabled: boolean,
): Promise<ActionResult> {
  if (!isPositiveId(stepId) || typeof enabled !== "boolean") {
    return { success: false, error: "Invalid step setting." };
  }
  const db = await getAuthenticatedDb();
  const rows = await db
    .update(deliveryRecipeSteps)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(deliveryRecipeSteps.id, stepId))
    .returning({ id: deliveryRecipeSteps.id });
  if (!rows[0]) return { success: false, error: "Step not found." };
  revalidateRecipeViews();
  return { success: true, message: enabled ? "Step enabled." : "Step disabled." };
}

async function getVideoSafety(videoId: number) {
  const db = await getAuthenticatedDb();
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

function videoMutationError(video: Awaited<ReturnType<typeof getVideoSafety>>): string | null {
  if (!video) return "Video not found.";
  if (video.isOperationalContainer) return "Production containers cannot own a Delivery Recipe.";
  if (video.status === "DONE") return "Completed Videos are historical and cannot start or change a Recipe.";
  if (video.projectStatus === "archived") return "Archived Project Videos are read-only.";
  return null;
}

export async function attachDeliveryRecipeToVideo(
  videoId: number,
  recipeId: number,
): Promise<ActionResult> {
  if (!isPositiveId(videoId) || !isPositiveId(recipeId)) {
    return { success: false, error: "Invalid Video or Recipe." };
  }
  const video = await getVideoSafety(videoId);
  const safetyError = videoMutationError(video);
  if (safetyError) return { success: false, error: safetyError };
  const db = await getAuthenticatedDb();
  const result = await db.$client.batch([
    db.$client.prepare(`INSERT INTO video_recipe_instances
      (video_id, recipe_id, recipe_name_snapshot, status, created_at, updated_at)
      SELECT ?1, r.id, r.name, 'ACTIVE', unixepoch(), unixepoch()
      FROM delivery_recipes r
      WHERE r.id = ?2 AND r.is_active = 1
        AND EXISTS (SELECT 1 FROM delivery_recipe_steps s WHERE s.recipe_id = r.id AND s.enabled = 1)
        AND NOT EXISTS (SELECT 1 FROM video_recipe_instances i WHERE i.video_id = ?1 AND i.archived_at IS NULL)
      RETURNING id`).bind(videoId, recipeId),
    db.$client.prepare(`WITH instance AS MATERIALIZED (SELECT last_insert_rowid() AS id)
      INSERT INTO video_recipe_instance_steps
        (instance_id, template_step_id, label_snapshot, gate_snapshot, position_snapshot,
         quality_standard_snapshot, state, created_at, updated_at)
      SELECT instance.id, s.id, s.label, s.gate, s.position, s.quality_standard,
             'NOT_STARTED', unixepoch(), unixepoch()
      FROM instance
      JOIN delivery_recipe_steps s ON s.recipe_id = ?1
      WHERE s.enabled = 1
      ORDER BY s.position, s.id`).bind(recipeId),
  ]);
  const id = Number((result[0].results[0] as { id?: number } | undefined)?.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { success: false, error: "Recipe could not be attached. It may be inactive, empty or already attached." };
  }
  revalidateRecipeViews(videoId);
  return { success: true, message: "Recipe attached.", id };
}

export async function transitionDeliveryRecipeStep(
  videoId: number,
  stepId: number,
  nextState: DeliveryRecipeStepState,
): Promise<ActionResult> {
  if (!isPositiveId(videoId) || !isPositiveId(stepId) || !isRecipeStepState(nextState)) {
    return { success: false, error: "Invalid Recipe transition." };
  }
  const video = await getVideoSafety(videoId);
  const safetyError = videoMutationError(video);
  if (safetyError) return { success: false, error: safetyError };
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: videoRecipeInstanceSteps.id,
      instanceId: videoRecipeInstanceSteps.instanceId,
      state: videoRecipeInstanceSteps.state,
      archivedAt: videoRecipeInstances.archivedAt,
    })
    .from(videoRecipeInstanceSteps)
    .innerJoin(videoRecipeInstances, eq(videoRecipeInstanceSteps.instanceId, videoRecipeInstances.id))
    .where(and(eq(videoRecipeInstanceSteps.id, stepId), eq(videoRecipeInstances.videoId, videoId), isNull(videoRecipeInstances.archivedAt)))
    .limit(1);
  const current = rows[0];
  if (!current || current.archivedAt) return { success: false, error: "Current Recipe step not found." };
  if (!canTransitionRecipeStep(current.state, nextState)) {
    return { success: false, error: `Cannot move ${current.state.replaceAll("_", " ")} to ${nextState.replaceAll("_", " ")}.` };
  }
  if (nextState === "ACTIVE") {
    const active = await db
      .select({ id: videoRecipeInstanceSteps.id })
      .from(videoRecipeInstanceSteps)
      .where(and(
        eq(videoRecipeInstanceSteps.instanceId, current.instanceId),
        eq(videoRecipeInstanceSteps.state, "ACTIVE"),
        ne(videoRecipeInstanceSteps.id, stepId),
      ))
      .limit(1);
    if (active[0]) return { success: false, error: "Finish or mark the current active step N/A first." };
  }
  const now = Math.floor(Date.now() / 1_000);
  const result = await db.$client.batch([
    db.$client.prepare(`UPDATE video_recipe_instance_steps
      SET state = ?1, updated_at = ?2
      WHERE id = ?3 AND instance_id = ?4 AND state = ?5
      RETURNING id`).bind(nextState, now, stepId, current.instanceId, current.state),
    db.$client.prepare(`INSERT INTO delivery_recipe_events
      (video_id, instance_id, instance_step_id, previous_state, new_state,
       occurred_at, actor, source, provenance)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'admin', 'MINDBUNKER_WEB', 'operator_click'
      WHERE changes() = 1`).bind(videoId, current.instanceId, stepId, current.state, nextState, now),
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
  if (!result[0].results[0]) return { success: false, error: "Recipe changed before this transition. Refresh and try again." };
  revalidateRecipeViews(videoId);
  return { success: true, message: nextState === "DONE" ? "Step completed." : "Recipe updated." };
}

export async function getVideoRecipeWorkspace(videoId: number) {
  if (!isPositiveId(videoId)) return { success: false as const, error: "Invalid Video." };
  const db = await getAuthenticatedDb();
  const video = await getVideoSafety(videoId);
  if (!video) return { success: false as const, error: "Video not found." };
  const templates = await db
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
        video: { id: video.id, title: video.title, mutable: videoMutationError(video) === null },
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
      video: { id: video.id, title: video.title, mutable: videoMutationError(video) === null },
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
