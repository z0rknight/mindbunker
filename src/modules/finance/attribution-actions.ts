"use server";

import { getAuthenticatedDb } from "@/db";
import {
  billingAllocations,
  billingEvidence,
  commercialContracts,
  productionOrders,
  videoLogs,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  attributedAmount,
  checkAttributionTarget,
  summarizeEvidenceAttribution,
  toMinutes,
  validateAttributionMinutes,
  type AttributionTargetType,
  type ResolvedTarget,
} from "./attribution";

// Operator-only. Records WHICH WORK an amount of external registered time
// belonged to -- nothing else. It writes exactly one billing_allocations row
// (method MANUAL_MINUTES) and never touches a payment/transaction, a video's
// status, work or Sensor sessions, or any other evidence. There is no code
// path here that divides time across videos: the operator names the target
// and the minutes, or leaves the time unallocated.

export type AttributionActionResult = { success: true } | { success: false; error: string };

const positiveInt = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

export async function attributeRegisteredTime(input: {
  billingEvidenceId: number;
  targetType: AttributionTargetType;
  targetId: number;
  hours?: unknown;
  minutes?: unknown;
  notes?: unknown;
}): Promise<AttributionActionResult> {
  if (!positiveInt(input.billingEvidenceId) || !positiveInt(input.targetId)) {
    return { success: false, error: "Choose a target." };
  }
  if (input.targetType !== "PRODUCTION_ORDER" && input.targetType !== "VIDEO") {
    return { success: false, error: "Choose a Production Order or a video." };
  }
  const db = await getAuthenticatedDb();

  const evidenceRows = await db
    .select({
      id: billingEvidence.id,
      contractId: billingEvidence.contractId,
      clientId: commercialContracts.clientId,
      billableMinutes: billingEvidence.billableMinutes,
      grossAmount: billingEvidence.grossAmount,
      currency: billingEvidence.currency,
    })
    .from(billingEvidence)
    .innerJoin(commercialContracts, eq(commercialContracts.id, billingEvidence.contractId))
    .where(eq(billingEvidence.id, input.billingEvidenceId))
    .limit(1);
  const evidence = evidenceRows[0];
  if (!evidence) return { success: false, error: "That billing evidence was not found." };

  // Resolve the target to the video row the allocation will point at.
  let target: ResolvedTarget | null = null;
  if (input.targetType === "PRODUCTION_ORDER") {
    const orders = await db
      .select({ id: productionOrders.id, clientId: productionOrders.clientId })
      .from(productionOrders)
      .where(eq(productionOrders.id, input.targetId))
      .limit(1);
    const order = orders[0];
    if (order) {
      const containers = await db
        .select({ id: videoLogs.id, clientId: videoLogs.clientId, isOperationalContainer: videoLogs.isOperationalContainer })
        .from(videoLogs)
        .where(and(eq(videoLogs.productionOrderId, order.id), eq(videoLogs.isOperationalContainer, true)))
        .limit(1);
      const container = containers[0];
      target = container
        ? { videoId: container.id, clientId: container.clientId, isOperationalContainer: true, orderClientId: order.clientId }
        : { videoId: 0, clientId: order.clientId, isOperationalContainer: false, orderClientId: order.clientId };
    }
  } else {
    const videos = await db
      .select({ id: videoLogs.id, clientId: videoLogs.clientId, isOperationalContainer: videoLogs.isOperationalContainer })
      .from(videoLogs)
      .where(eq(videoLogs.id, input.targetId))
      .limit(1);
    const video = videos[0];
    if (video) target = { videoId: video.id, clientId: video.clientId, isOperationalContainer: video.isOperationalContainer };
  }
  const targetError = checkAttributionTarget(evidence.clientId, input.targetType, target);
  if (targetError || !target) return { success: false, error: targetError ?? "That target was not found." };

  const existing = await db
    .select({ id: billingAllocations.id, method: billingAllocations.method, minutes: billingAllocations.minutes })
    .from(billingAllocations)
    .where(eq(billingAllocations.billingEvidenceId, evidence.id));
  const summary = summarizeEvidenceAttribution(evidence.billableMinutes, existing);
  const minutes = toMinutes(input.hours, input.minutes);
  const minutesError = validateAttributionMinutes(minutes, summary.unallocatedMinutes);
  if (minutesError || minutes === null) return { success: false, error: minutesError ?? "Enter a duration." };

  const notes = typeof input.notes === "string" && input.notes.trim() !== "" ? input.notes.trim().slice(0, 500) : null;
  await db.insert(billingAllocations).values({
    billingEvidenceId: evidence.id,
    videoId: target.videoId,
    method: "MANUAL_MINUTES",
    amount: attributedAmount(evidence.grossAmount, evidence.billableMinutes, minutes),
    minutes,
    currency: evidence.currency,
    notes,
  });
  revalidatePath(`/finance/contracts/${evidence.contractId}`);
  revalidatePath("/productivity/orders");
  return { success: true };
}

// Only the operator's own explicit attributions can be removed. Historical
// DERIVED_PROPORTION rows are preserved evidence and are never deleted here.
export async function removeAttribution(allocationId: number): Promise<AttributionActionResult> {
  if (!positiveInt(allocationId)) return { success: false, error: "Unknown attribution." };
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ id: billingAllocations.id, method: billingAllocations.method, evidenceId: billingAllocations.billingEvidenceId })
    .from(billingAllocations)
    .where(eq(billingAllocations.id, allocationId))
    .limit(1);
  const row = rows[0];
  if (!row) return { success: false, error: "Unknown attribution." };
  if (row.method !== "MANUAL_MINUTES") return { success: false, error: "Historical allocations are kept as evidence and can't be removed here." };
  await db.delete(billingAllocations).where(and(eq(billingAllocations.id, allocationId), eq(billingAllocations.method, "MANUAL_MINUTES")));
  const evidence = await db
    .select({ contractId: billingEvidence.contractId })
    .from(billingEvidence)
    .where(eq(billingEvidence.id, row.evidenceId))
    .limit(1);
  if (evidence[0]) revalidatePath(`/finance/contracts/${evidence[0].contractId}`);
  revalidatePath("/productivity/orders");
  return { success: true };
}
