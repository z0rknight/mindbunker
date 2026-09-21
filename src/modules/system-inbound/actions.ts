"use server";

import { getAuthenticatedDb } from "@/db";
import { crmEvents } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  SYSTEM_INTAKE_SEEN_EVENT_TYPE,
  isSystemIntakeEventType,
  buildSystemIntakeSeenPayload,
  systemIntakeSeenIdempotencyKey,
} from "./core";

export async function acknowledgeAndOpenSystemIntakes(sourceEventIds: number[], clientId: number) {
  const destination = Number.isSafeInteger(clientId) && clientId > 0 ? `/crm/${clientId}` : "/crm/inbound";
  try {
    const uniqueSourceEventIds = Array.from(new Set(sourceEventIds)).filter(
      (sourceEventId) => Number.isSafeInteger(sourceEventId) && sourceEventId > 0,
    );
    if (uniqueSourceEventIds.length === 0 || !Number.isSafeInteger(clientId) || clientId <= 0) {
      redirect(destination);
    }
    const db = await getAuthenticatedDb();
    const sources = await db
      .select({ id: crmEvents.id, type: crmEvents.type })
      .from(crmEvents)
      .where(and(inArray(crmEvents.id, uniqueSourceEventIds), eq(crmEvents.clientId, clientId)));
    const registeredSources = sources.filter((source) => isSystemIntakeEventType(source.type));
    if (registeredSources.length > 0) {
      await db
        .insert(crmEvents)
        .values(registeredSources.map((source) => ({
          clientId,
          type: SYSTEM_INTAKE_SEEN_EVENT_TYPE,
          actor: "admin" as const,
          description: `System intake reviewed · source event ${source.id}`,
          payloadJson: buildSystemIntakeSeenPayload(source.id),
          idempotencyKey: systemIntakeSeenIdempotencyKey(source.id),
        })))
        .onConflictDoNothing({ target: crmEvents.idempotencyKey });
      revalidatePath("/crm/inbound");
      revalidatePath(`/crm/${clientId}`);
    }
  } catch (error) {
    // Viewing the canonical Lead must remain available if acknowledgement
    // persistence has a transient failure. Auth failures still surface.
    if (error instanceof Error && error.message === "Unauthorized") throw error;
  }
  redirect(destination);
}
