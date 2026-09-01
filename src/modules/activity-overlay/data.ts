import "server-only";
import { getAuthenticatedDb } from "@/db";
import { deviceActivityObservations } from "@/db/schema";
import { and, gte, lte } from "drizzle-orm";
import { computeActivityOverlay, type ActivityOverlay } from "./core";

export async function getActivityOverlayForRange(startedAt: Date, endedAt: Date): Promise<ActivityOverlay> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ appName: deviceActivityObservations.appName, startedAt: deviceActivityObservations.startedAt, endedAt: deviceActivityObservations.endedAt })
    .from(deviceActivityObservations)
    .where(and(gte(deviceActivityObservations.startedAt, startedAt), lte(deviceActivityObservations.endedAt, endedAt)));
  return computeActivityOverlay(rows);
}
