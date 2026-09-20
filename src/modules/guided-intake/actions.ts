import "server-only";

import { getDb } from "@/db";
import { clients, crmEvents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  buildGuidedIntakeDescription,
  buildGuidedIntakePayload,
  GUIDED_INTAKE_EVENT_TYPE,
  GUIDED_STARTING_PATH_LABELS,
  isGuidedIntakePayload,
  serviceInterestForGuidedIntake,
  validateGuidedIntakeSubmission,
  type GuidedStartingPath,
} from "./core";
import {
  referralDescriptionPrefix,
  resolveReferral,
  shouldAdoptReferralSource,
  sourceForNewLead,
} from "../referrals/core";

export type GuidedIntakeSubmitResult =
  | {
      success: true;
      deduped: boolean;
      recommendedStartingPath: GuidedStartingPath;
      publicStartingPath: string;
    }
  | { success: false; status: 400 | 500; message: string; errors?: Record<string, string> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function submitGuidedIntake(value: unknown): Promise<GuidedIntakeSubmitResult> {
  // A real visitor never fills this hidden field. Match the existing public
  // quote/book behavior: return an ordinary success and perform zero writes.
  if (isRecord(value) && typeof value.company_website === "string" && value.company_website.trim() !== "") {
    return {
      success: true,
      deduped: true,
      recommendedStartingPath: "HUMAN_REVIEW_REQUIRED",
      publicStartingPath: GUIDED_STARTING_PATH_LABELS.HUMAN_REVIEW_REQUIRED,
    };
  }

  const validation = validateGuidedIntakeSubmission(value);
  if (!validation.success) {
    return {
      success: false,
      status: 400,
      message: "Check the highlighted details and try again.",
      errors: validation.errors,
    };
  }

  const data = validation.data;
  const referral = resolveReferral(data.ref);
  const db = await getDb();

  const existingRequest = await db
    .select({ payloadJson: crmEvents.payloadJson })
    .from(crmEvents)
    .where(eq(crmEvents.idempotencyKey, data.idempotencyKey))
    .limit(1);
  if (existingRequest[0]?.payloadJson) {
    try {
      const payload: unknown = JSON.parse(existingRequest[0].payloadJson);
      if (isGuidedIntakePayload(payload)) {
        return {
          success: true,
          deduped: true,
          recommendedStartingPath: payload.recommendedStartingPath,
          publicStartingPath: GUIDED_STARTING_PATH_LABELS[payload.recommendedStartingPath],
        };
      }
    } catch {
      // The unique key is authoritative even if historical evidence became
      // unreadable. Fail closed instead of creating a second submission.
    }
    return { success: false, status: 500, message: "We could not verify this submission. Please contact Emmanuel directly." };
  }

  const now = new Date();
  const payload = buildGuidedIntakePayload(data, referral);
  const description = buildGuidedIntakeDescription(payload);
  const existingClient = await db
    .select({ id: clients.id, source: clients.source })
    .from(clients)
    .where(sql`lower(${clients.email}) = ${data.answers.contact.email}`)
    .limit(1);

  let clientId: number;
  if (existingClient[0]) {
    clientId = existingClient[0].id;
    await db
      .update(clients)
      .set({
        lastInteractionAt: now,
        ...(referral && shouldAdoptReferralSource(existingClient[0].source)
          ? { source: referral.source }
          : {}),
      })
      .where(eq(clients.id, clientId));
  } else {
    const inserted = await db
      .insert(clients)
      .values({
        name: data.answers.contact.name,
        status: "lead",
        opportunityStage: "new",
        email: data.answers.contact.email,
        serviceInterest: serviceInterestForGuidedIntake(data.answers.contentType),
        source: sourceForNewLead("start", referral),
        contacted: false,
        converted: false,
        lastInteractionAt: now,
      })
      .returning({ id: clients.id });
    if (!inserted[0]) {
      return { success: false, status: 500, message: "Something went wrong. Please try again." };
    }
    clientId = inserted[0].id;
    await db.insert(crmEvents).values({
      clientId,
      type: "lead_created",
      actor: "gateway",
      description: `${referralDescriptionPrefix(referral)}Lead created from /start: ${data.answers.contact.name}`,
    });
  }

  const insertedEvent = await db
    .insert(crmEvents)
    .values({
      clientId,
      type: GUIDED_INTAKE_EVENT_TYPE,
      actor: "gateway",
      description,
      payloadJson: JSON.stringify(payload),
      idempotencyKey: data.idempotencyKey,
    })
    .onConflictDoNothing({ target: crmEvents.idempotencyKey })
    .returning({ id: crmEvents.id });

  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/crm");
  return {
    success: true,
    deduped: insertedEvent.length === 0,
    recommendedStartingPath: payload.recommendedStartingPath,
    publicStartingPath: GUIDED_STARTING_PATH_LABELS[payload.recommendedStartingPath],
  };
}
