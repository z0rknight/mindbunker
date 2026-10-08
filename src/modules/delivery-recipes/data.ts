import "server-only";

import { getDb } from "@/db";
import { videoRecipeInstances, videoRecipeInstanceSteps } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { buildClientRecipeProjection } from "./core";

// Client-safe read model. Ownership is checked by the caller's existing
// Client Video Detail query before this function is reached. No step labels,
// standards, event history, Sessions, Sensor or operator-only metadata leave it.
export async function getClientRecipeProjectionForVideo(videoId: number) {
  const db = await getDb();
  const instances = await db
    .select({ id: videoRecipeInstances.id })
    .from(videoRecipeInstances)
    .where(and(eq(videoRecipeInstances.videoId, videoId), isNull(videoRecipeInstances.archivedAt)))
    .limit(1);
  const instance = instances[0];
  if (!instance) return null;
  const steps = await db
    .select({
      id: videoRecipeInstanceSteps.id,
      gate: videoRecipeInstanceSteps.gateSnapshot,
      position: videoRecipeInstanceSteps.positionSnapshot,
      state: videoRecipeInstanceSteps.state,
    })
    .from(videoRecipeInstanceSteps)
    .where(eq(videoRecipeInstanceSteps.instanceId, instance.id))
    .orderBy(asc(videoRecipeInstanceSteps.positionSnapshot), asc(videoRecipeInstanceSteps.id));
  const stages = buildClientRecipeProjection(steps);
  return stages.length > 0 ? { stages } : null;
}
