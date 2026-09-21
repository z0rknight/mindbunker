import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clients, crmEvents } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import {
  SYSTEM_INTAKE_EVENT_TYPES,
  SYSTEM_INTAKE_SEEN_EVENT_TYPE,
  buildSystemInboundProjection,
  type SystemInboundGroup,
} from "./core";

export async function getSystemInbound(): Promise<{
  groups: SystemInboundGroup[];
  unreadEventCount: number;
}> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      eventId: crmEvents.id,
      clientId: crmEvents.clientId,
      eventType: crmEvents.type,
      payloadJson: crmEvents.payloadJson,
      createdAt: crmEvents.createdAt,
      name: clients.name,
      email: clients.email,
      status: clients.status,
    })
    .from(crmEvents)
    .leftJoin(clients, eq(clients.id, crmEvents.clientId))
    .where(inArray(crmEvents.type, [...SYSTEM_INTAKE_EVENT_TYPES, SYSTEM_INTAKE_SEEN_EVENT_TYPE]))
    .orderBy(desc(crmEvents.createdAt), desc(crmEvents.id));

  return buildSystemInboundProjection(rows);
}
