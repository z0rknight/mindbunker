import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  billingAllocations,
  billingEvidence,
  commercialContracts,
  productionOrders,
  videoLogs,
} from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  describeEvidenceForOrder,
  summarizeEvidenceAttribution,
  type AllocationMethod,
  type AttributionSummary,
  type EvidenceAllocationForOrder,
} from "./attribution";

// Operator-only READS for external-time attribution. No writes here (the
// writes live in attribution-actions.ts). Never reached by the Client Portal
// (pinned by attribution.test.mjs).

export type AttributionAllocationRow = {
  id: number;
  method: AllocationMethod;
  minutes: number | null;
  amount: number;
  currency: string;
  notes: string | null;
  /** Where the attribution points; null = no video (unattributed slice). */
  target: { kind: "ORDER" | "VIDEO"; label: string } | null;
};

export type EvidenceAttributionView = {
  evidence: {
    id: number;
    contractId: number;
    clientId: number;
    periodStart: string;
    periodEnd: string;
    billableMinutes: number;
    grossAmount: number;
    currency: string;
  };
  summary: AttributionSummary;
  allocations: AttributionAllocationRow[];
  orderOptions: Array<{ id: number; label: string; state: string }>;
  videoOptions: Array<{ id: number; title: string }>;
};

export async function getEvidenceAttributionView(evidenceId: number): Promise<EvidenceAttributionView | null> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: billingEvidence.id,
      contractId: billingEvidence.contractId,
      clientId: commercialContracts.clientId,
      periodStart: billingEvidence.periodStart,
      periodEnd: billingEvidence.periodEnd,
      billableMinutes: billingEvidence.billableMinutes,
      grossAmount: billingEvidence.grossAmount,
      currency: billingEvidence.currency,
    })
    .from(billingEvidence)
    .innerJoin(commercialContracts, eq(commercialContracts.id, billingEvidence.contractId))
    .where(eq(billingEvidence.id, evidenceId))
    .limit(1);
  const evidence = rows[0];
  if (!evidence) return null;

  const allocationRows = await db
    .select({
      id: billingAllocations.id,
      method: billingAllocations.method,
      minutes: billingAllocations.minutes,
      amount: billingAllocations.amount,
      currency: billingAllocations.currency,
      notes: billingAllocations.notes,
      videoId: billingAllocations.videoId,
      videoTitle: videoLogs.title,
      isContainer: videoLogs.isOperationalContainer,
      orderId: videoLogs.productionOrderId,
    })
    .from(billingAllocations)
    .leftJoin(videoLogs, eq(videoLogs.id, billingAllocations.videoId))
    .where(eq(billingAllocations.billingEvidenceId, evidenceId))
    .orderBy(desc(billingAllocations.createdAt));

  const orderIds = Array.from(new Set(allocationRows.filter((r) => r.isContainer && r.orderId !== null).map((r) => r.orderId as number)));
  const orderLabels = new Map<number, string>();
  if (orderIds.length > 0) {
    const labelRows = await db
      .select({ id: productionOrders.id, label: productionOrders.label })
      .from(productionOrders)
      .where(inArray(productionOrders.id, orderIds));
    for (const row of labelRows) orderLabels.set(row.id, row.label);
  }

  const allocations: AttributionAllocationRow[] = allocationRows.map((r) => ({
    id: r.id,
    method: r.method,
    minutes: r.minutes,
    amount: r.amount,
    currency: r.currency,
    notes: r.notes,
    target:
      r.videoId === null
        ? null
        : r.isContainer && r.orderId !== null
          ? { kind: "ORDER", label: orderLabels.get(r.orderId) ?? `Production Order #${r.orderId}` }
          : { kind: "VIDEO", label: r.videoTitle ?? `Video #${r.videoId}` },
  }));

  const [orders, videos] = await Promise.all([
    db
      .select({ id: productionOrders.id, label: productionOrders.label, state: productionOrders.state })
      .from(productionOrders)
      .where(eq(productionOrders.clientId, evidence.clientId))
      .orderBy(desc(productionOrders.receivedAt), desc(productionOrders.id))
      .limit(50),
    db
      .select({ id: videoLogs.id, title: videoLogs.title })
      .from(videoLogs)
      .where(and(eq(videoLogs.clientId, evidence.clientId), eq(videoLogs.isOperationalContainer, false), isNull(videoLogs.cancelledAt)))
      .orderBy(desc(videoLogs.date), desc(videoLogs.id))
      .limit(150),
  ]);

  return {
    evidence,
    summary: summarizeEvidenceAttribution(evidence.billableMinutes, allocations),
    allocations,
    orderOptions: orders,
    videoOptions: videos.map((v) => ({ id: v.id, title: v.title ?? `Video #${v.id}` })),
  };
}

/**
 * For the Production Order evidence block: every evidence row that has any
 * attribution touching THIS order (its container or its deliverables), seen
 * from the order's point of view -- registered / here / elsewhere / unallocated.
 */
export async function getOrderExternalTimeEvidence(orderId: number): Promise<EvidenceAllocationForOrder[]> {
  const db = await getAuthenticatedDb();
  const orderVideos = await db.select({ id: videoLogs.id }).from(videoLogs).where(eq(videoLogs.productionOrderId, orderId));
  if (orderVideos.length === 0) return [];
  const orderVideoIds = new Set(orderVideos.map((v) => v.id));

  const touching = await db
    .select({ evidenceId: billingAllocations.billingEvidenceId })
    .from(billingAllocations)
    .where(inArray(billingAllocations.videoId, Array.from(orderVideoIds)));
  const evidenceIds = Array.from(new Set(touching.map((r) => r.evidenceId)));
  if (evidenceIds.length === 0) return [];

  const [evidenceRows, allocationRows] = await Promise.all([
    db
      .select({
        id: billingEvidence.id,
        periodStart: billingEvidence.periodStart,
        periodEnd: billingEvidence.periodEnd,
        billableMinutes: billingEvidence.billableMinutes,
      })
      .from(billingEvidence)
      .where(inArray(billingEvidence.id, evidenceIds))
      .orderBy(desc(billingEvidence.periodStart)),
    db
      .select({
        evidenceId: billingAllocations.billingEvidenceId,
        id: billingAllocations.id,
        method: billingAllocations.method,
        minutes: billingAllocations.minutes,
        videoId: billingAllocations.videoId,
      })
      .from(billingAllocations)
      .where(inArray(billingAllocations.billingEvidenceId, evidenceIds)),
  ]);

  return evidenceRows.map((evidence) =>
    describeEvidenceForOrder({
      evidenceId: evidence.id,
      periodStart: evidence.periodStart,
      periodEnd: evidence.periodEnd,
      registeredMinutes: evidence.billableMinutes,
      allocations: allocationRows
        .filter((row) => row.evidenceId === evidence.id)
        .map((row) => ({
          id: row.id,
          method: row.method,
          minutes: row.minutes,
          onThisOrder: row.videoId !== null && orderVideoIds.has(row.videoId),
        })),
    }),
  );
}
