import "server-only";

import { getAuthenticatedDb } from "@/db";
import { sensorSessions, videoLogs, workSessions } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

// Operator-only READ. For one Production Order: how many closed Work Session
// seconds on the container / on the other videos originated from an APPROVED
// Sensor session (sensor_sessions.approved_work_session_id -> work_sessions).
// The sensor time is a share OF the Work Session time, not an extra amount.
// Consistent with computeProductionOrderTimeBreakdown: same video set (every
// video carrying this production_order_id), closed sessions only, container
// split by is_operational_container.
export async function getProductionOrderSensorSeconds(
  orderId: number,
): Promise<{ containerSensorSeconds: number; itemSensorSeconds: number }> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      startedAt: workSessions.startedAt,
      endedAt: workSessions.endedAt,
      isContainer: videoLogs.isOperationalContainer,
    })
    .from(workSessions)
    .innerJoin(videoLogs, eq(videoLogs.id, workSessions.videoId))
    .innerJoin(sensorSessions, eq(sensorSessions.approvedWorkSessionId, workSessions.id))
    .where(and(eq(videoLogs.productionOrderId, orderId), isNotNull(workSessions.endedAt)));

  let containerSensorSeconds = 0;
  let itemSensorSeconds = 0;
  for (const row of rows) {
    if (!row.endedAt) continue;
    const seconds = Math.max(0, Math.floor((row.endedAt.getTime() - row.startedAt.getTime()) / 1_000));
    if (row.isContainer) containerSensorSeconds += seconds;
    else itemSensorSeconds += seconds;
  }
  return { containerSensorSeconds, itemSensorSeconds };
}
