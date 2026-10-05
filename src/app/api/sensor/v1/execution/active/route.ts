import { getDb } from "@/db";
import { readCanonicalExecution } from "@/modules/sensor/canonical-execution";
import { authenticateSensorRequest, sensorUnauthorized } from "@/modules/sensor/server";

export async function GET(request: Request) {
  const device = await authenticateSensorRequest(request, "CATALOG_READ");
  if (!device) return sensorUnauthorized();
  const db = await getDb();
  return Response.json({ session: await readCanonicalExecution(db.$client) });
}
