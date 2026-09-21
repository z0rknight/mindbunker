import {
  GUIDED_INTAKE_EVENT_TYPE,
  isGuidedIntakePayload,
  projectGuidedIntakePayload,
  type GuidedIntakeProjection,
} from "../guided-intake/core.ts";

export const SYSTEM_INTAKE_EVENT_TYPES = [GUIDED_INTAKE_EVENT_TYPE] as const;
export const SYSTEM_INTAKE_SEEN_EVENT_TYPE = "system_intake.seen";

export type SystemIntakeEventType = (typeof SYSTEM_INTAKE_EVENT_TYPES)[number];

export function isSystemIntakeEventType(value: string): value is SystemIntakeEventType {
  return (SYSTEM_INTAKE_EVENT_TYPES as readonly string[]).includes(value);
}

export function systemIntakeSeenIdempotencyKey(sourceEventId: number) {
  return `system-intake-seen:${sourceEventId}`;
}

export function buildSystemIntakeSeenPayload(sourceEventId: number) {
  return JSON.stringify({ sourceEventId });
}

export function readSystemIntakeSeenSourceEventId(payloadJson: string | null): number | null {
  if (!payloadJson) return null;
  try {
    const value: unknown = JSON.parse(payloadJson);
    if (typeof value !== "object" || value === null || !("sourceEventId" in value)) return null;
    const sourceEventId = (value as { sourceEventId?: unknown }).sourceEventId;
    return Number.isSafeInteger(sourceEventId) && Number(sourceEventId) > 0
      ? Number(sourceEventId)
      : null;
  } catch {
    return null;
  }
}

export function projectSystemIntakePayload(
  eventType: string,
  payloadJson: string | null,
): GuidedIntakeProjection | null {
  if (!isSystemIntakeEventType(eventType) || !payloadJson) return null;
  try {
    const value: unknown = JSON.parse(payloadJson);
    return isGuidedIntakePayload(value) ? projectGuidedIntakePayload(value) : null;
  } catch {
    return null;
  }
}

export function systemIntakeSourceLabel(projection: GuidedIntakeProjection | null) {
  return projection?.referralSource ?? "RMEDIA /start";
}

export type SystemInboundRow = {
  eventId: number;
  clientId: number | null;
  eventType: string;
  payloadJson: string | null;
  createdAt: Date | null;
  name: string | null;
  email: string | null;
  status: string | null;
};

export type SystemInboundIntake = {
  eventId: number;
  receivedAt: Date | null;
  sourceLabel: string;
  projection: GuidedIntakeProjection;
  unread: boolean;
};

export type SystemInboundGroup = {
  clientId: number;
  name: string;
  email: string | null;
  status: string;
  latestReceivedAt: Date | null;
  latestSourceLabel: string;
  latestProjection: GuidedIntakeProjection;
  intakeCount: number;
  unreadCount: number;
  intakes: SystemInboundIntake[];
};

export function buildSystemInboundProjection(rows: SystemInboundRow[]): {
  groups: SystemInboundGroup[];
  unreadEventCount: number;
} {
  const seen = new Set<number>();
  for (const row of rows) {
    if (row.eventType !== SYSTEM_INTAKE_SEEN_EVENT_TYPE) continue;
    const sourceEventId = readSystemIntakeSeenSourceEventId(row.payloadJson);
    if (sourceEventId !== null) seen.add(sourceEventId);
  }

  const groupsByClient = new Map<number, SystemInboundGroup>();
  let unreadEventCount = 0;
  for (const row of rows) {
    if (!isSystemIntakeEventType(row.eventType) || row.clientId === null || row.name === null || row.status === null) continue;
    const projection = projectSystemIntakePayload(row.eventType, row.payloadJson);
    if (!projection) continue;
    const unread = !seen.has(row.eventId);
    if (unread) unreadEventCount += 1;
    const intake: SystemInboundIntake = {
      eventId: row.eventId,
      receivedAt: row.createdAt,
      sourceLabel: systemIntakeSourceLabel(projection),
      projection,
      unread,
    };
    const existing = groupsByClient.get(row.clientId);
    if (existing) {
      existing.intakes.push(intake);
      existing.intakeCount += 1;
      if (unread) existing.unreadCount += 1;
    } else {
      groupsByClient.set(row.clientId, {
        clientId: row.clientId,
        name: row.name,
        email: row.email,
        status: row.status,
        latestReceivedAt: row.createdAt,
        latestSourceLabel: intake.sourceLabel,
        latestProjection: projection,
        intakeCount: 1,
        unreadCount: unread ? 1 : 0,
        intakes: [intake],
      });
    }
  }

  return { groups: [...groupsByClient.values()], unreadEventCount };
}
