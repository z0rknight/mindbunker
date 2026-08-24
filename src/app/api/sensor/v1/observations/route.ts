import { getDb } from "@/db";
import {
  SENSOR_OBSERVATION_INSERT_SQL,
  validateObservationBatch,
} from "@/modules/sensor/core";
import {
  authenticateSensorRequest,
  readJson,
  sensorUnauthorized,
} from "@/modules/sensor/server";

export async function POST(request: Request) {
  const device = await authenticateSensorRequest(request, "OBSERVATION_WRITE");
  if (!device) return sensorUnauthorized();
  let payload: unknown;
  try { payload = await readJson(request); } catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
  const parsed = validateObservationBatch(payload);
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 });
  const db = await getDb();
  const statements = parsed.data.map((row) =>
    db.$client
      .prepare(SENSOR_OBSERVATION_INSERT_SQL)
      .bind(
        device.id,
        row.localObservationId,
        row.startedAt,
        row.endedAt,
        row.appName,
        row.bundleId,
        row.windowTitle,
        row.idle ? 1 : 0,
        row.keystrokeCount,
        row.mouseMovementCount,
      ),
  );
  await db.$client.batch(statements);
  return Response.json({
    acknowledged: parsed.data.map((row) => row.localObservationId),
    idempotent: true,
  });
}
