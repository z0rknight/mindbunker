import { getDb } from "@/db";
import { CanonicalExecutionError, endCanonicalExecution } from "@/modules/sensor/canonical-execution";
import { validateCanonicalExecutionEnd } from "@/modules/sensor/core";
import { authenticateSensorRequest, readJson, sensorUnauthorized } from "@/modules/sensor/server";

export async function POST(request: Request) {
  const device = await authenticateSensorRequest(request, "SESSION_WRITE");
  if (!device) return sensorUnauthorized();
  let payload: unknown;
  try { payload = await readJson(request); } catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
  const parsed = validateCanonicalExecutionEnd(payload);
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 });
  const db = await getDb();
  try {
    return Response.json(await endCanonicalExecution(db.$client, parsed.data.workSessionId));
  } catch (error) {
    if (error instanceof CanonicalExecutionError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
