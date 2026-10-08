import { getDb } from "@/db";
import { projectNativeDeliveryRecipe } from "@/modules/delivery-recipes/native";
import { getVideoRecipeWorkspaceWithDb } from "@/modules/delivery-recipes/service";
import { readCanonicalExecution } from "@/modules/sensor/canonical-execution";
import { authenticateSensorRequest, sensorUnauthorized } from "@/modules/sensor/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const device = await authenticateSensorRequest(request, "CATALOG_READ");
  if (!device) return sensorUnauthorized();
  const db = await getDb();
  const execution = await readCanonicalExecution(db.$client);
  if (!execution) {
    return Response.json(
      { schema_version: 1, generated_at: new Date().toISOString(), video_id: null, mutable: false, recipe: null },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const workspace = await getVideoRecipeWorkspaceWithDb(db, execution.video_id, { includeTemplates: false });
  if (!workspace.success) return Response.json({ error: workspace.error }, { status: 409 });
  return Response.json(projectNativeDeliveryRecipe(workspace.data), { headers: { "cache-control": "no-store" } });
}
