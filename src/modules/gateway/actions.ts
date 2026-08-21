"use server";

import "server-only";

import { getAuthenticatedDb, getDb } from "@/db";
import {
  clients,
  crmEvents,
  gatewayInvitations,
  intakeSubmissions,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  createGatewayToken,
  isGatewayToken,
  isOpportunityStage,
  isServiceInterest,
  stageAfterGatewayInvitation,
  validateBriefingInput,
} from "./core";
import {
  GATEWAY_PATH_PREFIX,
  GATEWAY_TOKEN_TTL_DAYS,
  type OpportunityStage,
  type ServiceInterest,
} from "./config";
import {
  getGatewayContext,
  hasBriefingForInvitation,
} from "./data";
import { hashGatewayToken } from "./core";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

function isPositiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function cleanDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  ) {
    return undefined;
  }
  return value;
}

export type OpportunityUpdateState =
  | { success: true }
  | { success: false; error: string };

export async function updateOpportunity(
  clientId: number,
  input: {
    stage: string;
    serviceInterest: string;
    nextAction: string;
    nextActionDate: string;
    qualificationNotes: string;
  },
): Promise<OpportunityUpdateState> {
  if (!isPositiveId(clientId) || !isOpportunityStage(input.stage)) {
    return { success: false, error: "Invalid opportunity." };
  }

  const serviceInterest = input.serviceInterest || null;
  if (serviceInterest !== null && !isServiceInterest(serviceInterest)) {
    return { success: false, error: "Invalid service interest." };
  }

  const nextActionDate = cleanDate(input.nextActionDate);
  if (nextActionDate === undefined) {
    return { success: false, error: "Invalid next-action date." };
  }

  const db = await getAuthenticatedDb();
  const currentRows = await db
    .select({ stage: clients.opportunityStage })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const current = currentRows[0];
  if (!current) {
    return { success: false, error: "Contact not found." };
  }

  const stage = input.stage as OpportunityStage;
  await db
    .update(clients)
    .set({
      opportunityStage: stage,
      serviceInterest: serviceInterest as ServiceInterest | null,
      nextAction: cleanText(input.nextAction, 500) || null,
      nextActionDate,
      qualificationNotes:
        cleanText(input.qualificationNotes, 2_000) || null,
    })
    .where(eq(clients.id, clientId));

  const description =
    current.stage === stage
      ? "Opportunity details updated"
      : `Stage changed from ${current.stage} to ${stage}`;
  await db.insert(crmEvents).values({
    clientId,
    type: current.stage === stage ? "opportunity_updated" : "stage_changed",
    actor: "admin",
    description,
  });

  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/crm");
  return { success: true };
}

export type GatewayActionState =
  | { success: true; path?: string; expiresAt?: string }
  | { success: false; error: string };

export async function generateGatewayInvitation(
  clientId: number,
): Promise<GatewayActionState> {
  if (!isPositiveId(clientId)) {
    return { success: false, error: "Invalid contact." };
  }

  const db = await getAuthenticatedDb();
  const clientRows = await db
    .select({ stage: clients.opportunityStage })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const client = clientRows[0];
  if (!client) {
    return { success: false, error: "Contact not found." };
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + GATEWAY_TOKEN_TTL_DAYS * DAY_IN_MILLISECONDS,
  );
  const token = createGatewayToken();
  const tokenHash = await hashGatewayToken(token);

  await db
    .update(gatewayInvitations)
    .set({ revokedAt: now })
    .where(
      and(
        eq(gatewayInvitations.clientId, clientId),
        isNull(gatewayInvitations.revokedAt),
      ),
    );

  await db.insert(gatewayInvitations).values({
    clientId,
    tokenHash,
    expiresAt,
  });

  const nextStage = stageAfterGatewayInvitation(client.stage);
  if (nextStage !== client.stage) {
    await db
      .update(clients)
      .set({ opportunityStage: nextStage })
      .where(eq(clients.id, clientId));
  }

  await db.insert(crmEvents).values({
    clientId,
    type: "gateway_created",
    actor: "admin",
    description: `Gateway link created; expires in ${GATEWAY_TOKEN_TTL_DAYS} days`,
  });

  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/crm");
  return {
    success: true,
    path: `${GATEWAY_PATH_PREFIX}/${token}`,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function revokeGatewayInvitation(
  clientId: number,
  invitationId: number,
): Promise<GatewayActionState> {
  if (!isPositiveId(clientId) || !isPositiveId(invitationId)) {
    return { success: false, error: "Invalid invitation." };
  }

  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ revokedAt: gatewayInvitations.revokedAt })
    .from(gatewayInvitations)
    .where(
      and(
        eq(gatewayInvitations.id, invitationId),
        eq(gatewayInvitations.clientId, clientId),
      ),
    )
    .limit(1);
  const invitation = rows[0];
  if (!invitation) {
    return { success: false, error: "Invitation not found." };
  }
  if (invitation.revokedAt) {
    return { success: true };
  }

  await db
    .update(gatewayInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(gatewayInvitations.id, invitationId),
        eq(gatewayInvitations.clientId, clientId),
      ),
    );
  await db.insert(crmEvents).values({
    clientId,
    type: "gateway_revoked",
    actor: "admin",
    description: "Gateway link revoked",
  });

  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}

export type BriefingActionState = {
  success?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function submitBriefing(
  _previousState: BriefingActionState,
  formData: FormData,
): Promise<BriefingActionState> {
  const rawToken = formData.get("gatewayToken");
  if (!isGatewayToken(rawToken)) {
    return { message: "This gateway link is unavailable." };
  }

  const validation = validateBriefingInput({
    serviceInterest: formData.get("serviceInterest"),
    projectSummary: formData.get("projectSummary"),
    objective: formData.get("objective"),
    contentVolume: formData.get("contentVolume"),
    references: formData.get("references"),
    timeline: formData.get("timeline"),
    existingAssets: formData.get("existingAssets"),
    notes: formData.get("notes"),
  });
  if (!validation.success) {
    return { errors: validation.errors, message: "Check the highlighted fields." };
  }

  const context = await getGatewayContext(rawToken);
  if (!context || context.accessStatus !== "active") {
    return { message: "This gateway link is unavailable." };
  }

  if (await hasBriefingForInvitation(context.clientId, context.invitationId)) {
    return { success: true };
  }

  const db = await getDb();
  const data = validation.data;
  const inserted = await db
    .insert(intakeSubmissions)
    .values({
      clientId: context.clientId,
      invitationId: context.invitationId,
      serviceInterest: data.serviceInterest,
      projectSummary: data.projectSummary,
      objective: data.objective,
      contentVolume: data.contentVolume || null,
      references: data.references || null,
      timeline: data.timeline || null,
      existingAssets: data.existingAssets || null,
      notes: data.notes || null,
    })
    .onConflictDoNothing({ target: intakeSubmissions.invitationId })
    .returning({ id: intakeSubmissions.id });

  if (inserted.length === 0) {
    return { success: true };
  }

  const now = new Date();
  await db
    .update(clients)
    .set({
      serviceInterest: data.serviceInterest,
      nextAction: "Review submitted briefing",
      nextActionDate: now.toISOString().slice(0, 10),
      lastInteractionAt: now,
    })
    .where(eq(clients.id, context.clientId));
  await db.insert(crmEvents).values({
    clientId: context.clientId,
    type: "briefing_submitted",
    actor: "gateway",
    description: "Client briefing submitted",
  });

  revalidatePath(`/crm/${context.clientId}`);
  return { success: true };
}

export async function recordGatewayOpened(rawToken: string) {
  if (!isGatewayToken(rawToken)) {
    return;
  }

  const context = await getGatewayContext(rawToken);
  if (
    !context ||
    context.accessStatus !== "active" ||
    context.openedAt
  ) {
    return;
  }

  const db = await getDb();
  const updated = await db
    .update(gatewayInvitations)
    .set({ openedAt: new Date() })
    .where(
      and(
        eq(gatewayInvitations.id, context.invitationId),
        isNull(gatewayInvitations.openedAt),
      ),
    )
    .returning({ id: gatewayInvitations.id });

  if (updated.length > 0) {
    await db.insert(crmEvents).values({
      clientId: context.clientId,
      type: "gateway_opened",
      actor: "gateway",
      description: "Gateway link opened",
    });
    revalidatePath(`/crm/${context.clientId}`);
  }
}
