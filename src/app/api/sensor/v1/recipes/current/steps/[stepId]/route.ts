import { getDb } from "@/db";
import { isPositiveId, isRecipeStepState } from "@/modules/delivery-recipes/core";
import { projectNativeDeliveryRecipe } from "@/modules/delivery-recipes/native";
import {
  getVideoRecipeWorkspaceWithDb,
  transitionDeliveryRecipeStepWithDb,
} from "@/modules/delivery-recipes/service";
import { readCanonicalExecution } from "@/modules/sensor/canonical-execution";
import { authenticateSensorRequest, readJson, sensorUnauthorized } from "@/modules/sensor/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stepId: string }> },
) {
  const device = await authenticateSensorRequest(request, "SESSION_WRITE");
  if (!device) return sensorUnauthorized();
  const stepId = Number((await params).stepId);
  if (!isPositiveId(stepId)) return Response.json({ error: "Invalid Recipe step." }, { status: 400 });
  let payload: unknown;
  try {
    payload = await readJson(request);
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  const nextState = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).next_state
    : null;
  if (!isRecipeStepState(nextState)) {
    return Response.json({ error: "Invalid Recipe step state." }, { status: 400 });
  }

  const db = await getDb();
  const execution = await readCanonicalExecution(db.$client);
  if (!execution) return Response.json({ error: "No canonical Work Session is active." }, { status: 409 });
  const result = await transitionDeliveryRecipeStepWithDb(db, {
    videoId: execution.video_id,
    stepId,
    nextState,
    source: "RMEDIA_APP",
    provenance: `native_operator_click:device:${device.publicId}`,
  });
  if (!result.success) return Response.json({ error: result.error }, { status: 409 });
  const workspace = await getVideoRecipeWorkspaceWithDb(db, execution.video_id, { includeTemplates: false });
  if (!workspace.success) return Response.json({ error: workspace.error }, { status: 409 });
  return Response.json({ message: result.message, ...projectNativeDeliveryRecipe(workspace.data) });
}
