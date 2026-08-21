import "server-only";

import { getAuthenticatedDb, getDb } from "@/db";
import {
  clients,
  crmEvents,
  gatewayInvitations,
  intakeSubmissions,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  getGatewayAccessStatus,
  hashGatewayToken,
  isGatewayToken,
} from "./core";
import { isServiceInterest } from "./core";
import {
  getCurrentBookingForClient,
  getLatestBookingForClient,
} from "@/modules/booking/data";

export async function getGatewayContext(rawToken: string) {
  if (!isGatewayToken(rawToken)) {
    return null;
  }

  const db = await getDb();
  const tokenHash = await hashGatewayToken(rawToken);
  const rows = await db
    .select({
      invitationId: gatewayInvitations.id,
      clientId: clients.id,
      clientName: clients.name,
      clientEmail: clients.email,
      serviceInterest: clients.serviceInterest,
      opportunityStage: clients.opportunityStage,
      expiresAt: gatewayInvitations.expiresAt,
      revokedAt: gatewayInvitations.revokedAt,
      openedAt: gatewayInvitations.openedAt,
    })
    .from(gatewayInvitations)
    .innerJoin(clients, eq(gatewayInvitations.clientId, clients.id))
    .where(eq(gatewayInvitations.tokenHash, tokenHash))
    .limit(1);

  const invitation = rows[0];
  if (!invitation) {
    return null;
  }

  return {
    ...invitation,
    accessStatus: getGatewayAccessStatus(invitation),
  };
}

export type PublicGatewayView =
  | { status: "unavailable" }
  | {
      status: "active";
      clientName: string;
      serviceInterest: string | null;
      briefingSubmitted: boolean;
      booking: {
        status: "confirmed";
        startsAt: string;
        endsAt: string;
      } | null;
    };

export async function getPublicGatewayView(
  rawToken: string,
): Promise<PublicGatewayView> {
  const context = await getGatewayContext(rawToken);
  if (!context || context.accessStatus !== "active") {
    return { status: "unavailable" };
  }

  const db = await getDb();
  const [submitted, booking] = await Promise.all([
    db
      .select({ id: intakeSubmissions.id })
      .from(intakeSubmissions)
      .where(eq(intakeSubmissions.invitationId, context.invitationId))
      .limit(1),
    getCurrentBookingForClient(context.clientId),
  ]);

  return {
    status: "active",
    clientName: context.clientName,
    serviceInterest: isServiceInterest(context.serviceInterest)
      ? context.serviceInterest
      : null,
    briefingSubmitted: submitted.length > 0,
    booking: booking
      ? {
          status: "confirmed",
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString(),
        }
      : null,
  };
}

export async function getAdminGatewayWorkspace(clientId: number) {
  const db = await getAuthenticatedDb();

  const [invitationRows, briefingRows, eventRows, booking] = await Promise.all([
    db
      .select({
        id: gatewayInvitations.id,
        expiresAt: gatewayInvitations.expiresAt,
        revokedAt: gatewayInvitations.revokedAt,
        openedAt: gatewayInvitations.openedAt,
        createdAt: gatewayInvitations.createdAt,
      })
      .from(gatewayInvitations)
      .where(eq(gatewayInvitations.clientId, clientId))
      .orderBy(desc(gatewayInvitations.createdAt), desc(gatewayInvitations.id))
      .limit(1),
    db
      .select({
        id: intakeSubmissions.id,
        serviceInterest: intakeSubmissions.serviceInterest,
        projectSummary: intakeSubmissions.projectSummary,
        objective: intakeSubmissions.objective,
        contentVolume: intakeSubmissions.contentVolume,
        references: intakeSubmissions.references,
        timeline: intakeSubmissions.timeline,
        existingAssets: intakeSubmissions.existingAssets,
        notes: intakeSubmissions.notes,
        submittedAt: intakeSubmissions.submittedAt,
      })
      .from(intakeSubmissions)
      .where(eq(intakeSubmissions.clientId, clientId))
      .orderBy(desc(intakeSubmissions.submittedAt), desc(intakeSubmissions.id))
      .limit(1),
    db
      .select({
        id: crmEvents.id,
        type: crmEvents.type,
        actor: crmEvents.actor,
        description: crmEvents.description,
        createdAt: crmEvents.createdAt,
      })
      .from(crmEvents)
      .where(eq(crmEvents.clientId, clientId))
      .orderBy(desc(crmEvents.createdAt), desc(crmEvents.id))
      .limit(50),
    getLatestBookingForClient(clientId),
  ]);

  const invitation = invitationRows[0] ?? null;

  return {
    invitation: invitation
      ? {
          ...invitation,
          status: getGatewayAccessStatus(invitation),
        }
      : null,
    briefing: briefingRows[0] ?? null,
    booking,
    events: eventRows,
  };
}

export async function hasBriefingForInvitation(
  clientId: number,
  invitationId: number,
) {
  const db = await getDb();
  const rows = await db
    .select({ id: intakeSubmissions.id })
    .from(intakeSubmissions)
    .where(
      and(
        eq(intakeSubmissions.clientId, clientId),
        eq(intakeSubmissions.invitationId, invitationId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
