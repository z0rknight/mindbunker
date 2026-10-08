"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  deliveryRecipes,
  deliveryRecipeSteps,
} from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { DeliveryRecipeStepState } from "./config";
import {
  cleanRecipeText,
  isPositiveId,
  isRecipeGate,
} from "./core";
import {
  getVideoRecipeSafety,
  getVideoRecipeWorkspaceWithDb,
  transitionDeliveryRecipeStepWithDb,
  videoRecipeMutationError,
} from "./service";

type ActionResult =
  | { success: true; message: string; id?: number }
  | { success: false; error: string };

function revalidateRecipeViews(videoId?: number) {
  revalidatePath("/recipes");
  revalidatePath("/war-room/workspace");
  if (videoId) revalidatePath(`/client/dashboard/videos/${videoId}`);
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

export async function attachDeliveryRecipeToVideo(
  videoId: number,
  recipeId: number,
): Promise<ActionResult> {
  if (!isPositiveId(videoId) || !isPositiveId(recipeId)) {
    return { success: false, error: "Invalid Video or Recipe." };
  }
  const db = await getAuthenticatedDb();
  const video = await getVideoRecipeSafety(db, videoId);
  const safetyError = videoRecipeMutationError(video);
  if (safetyError) return { success: false, error: safetyError };
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
  const db = await getAuthenticatedDb();
  const result = await transitionDeliveryRecipeStepWithDb(db, {
    videoId,
    stepId,
    nextState,
    source: "MINDBUNKER_WEB",
    provenance: "operator_click",
  });
  if (result.success) revalidateRecipeViews(videoId);
  return result;
}

export async function getVideoRecipeWorkspace(videoId: number) {
  const db = await getAuthenticatedDb();
  return getVideoRecipeWorkspaceWithDb(db, videoId);
}
