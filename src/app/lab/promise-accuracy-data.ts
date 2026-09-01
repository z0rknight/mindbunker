import "server-only";
import { getAuthenticatedDb } from "@/db";
import { deliveries, commitments } from "@/db/schema";
import { isNotNull, eq } from "drizzle-orm";
import { computePromiseAccuracy } from "@/modules/deliveries/core";

export async function getPromiseAccuracySummary() {
  const db = await getAuthenticatedDb();
  const linkedDeliveries = await db.select().from(deliveries).where(isNotNull(deliveries.commitmentId));
  const deltas: number[] = [];
  for (const d of linkedDeliveries) {
    const commitmentRows = await db.select({ dueAt: commitments.dueAt }).from(commitments).where(eq(commitments.id, d.commitmentId!)).limit(1);
    const dueAt = commitmentRows[0]?.dueAt;
    if (dueAt) deltas.push((d.deliveredAt.getTime() - dueAt.getTime()) / 1000);
  }
  return computePromiseAccuracy(deltas);
}
