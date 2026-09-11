import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  billingAllocations,
  clients,
  productionOrders,
  projects,
  videoLogs,
  workSessions,
} from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { VideoStatus } from "@/modules/productivity/config";
import {
  activeDeliverableItems,
  computeProductionOrderTimeBreakdown,
  computeProductionOrderVariance,
  countActiveDeliverables,
  countCancelledDeliverables,
  countDoneDeliverables,
  deriveProductionOrderPhase,
  sumBilledByCurrency,
  type ProductionOrderItem,
} from "./core.ts";
import type { ProductionOrderPhase } from "./config.ts";

// ─── List (brief §15) ───────────────────────────────────────────────────────

export type ProductionOrderListRow = {
  id: number;
  label: string;
  channel: string | null;
  state: "OPEN" | "CLOSED" | "CANCELLED";
  phase: ProductionOrderPhase;
  clientId: number;
  clientName: string;
  projectId: number;
  projectName: string;
  receivedAt: string;
  activeItemCount: number;
  doneItemCount: number;
  cancelledItemCount: number;
  expectedValueCents: number | null;
  currency: string | null;
};

export async function getProductionOrders(): Promise<ProductionOrderListRow[]> {
  const db = await getAuthenticatedDb();

  const orders = await db
    .select({
      id: productionOrders.id,
      label: productionOrders.label,
      channel: productionOrders.channel,
      state: productionOrders.state,
      clientId: productionOrders.clientId,
      clientName: clients.name,
      projectId: productionOrders.projectId,
      projectName: projects.name,
      receivedAt: productionOrders.receivedAt,
      expectedValueCents: productionOrders.expectedValueCents,
      currency: productionOrders.currency,
    })
    .from(productionOrders)
    .innerJoin(clients, eq(clients.id, productionOrders.clientId))
    .innerJoin(projects, eq(projects.id, productionOrders.projectId))
    .orderBy(desc(productionOrders.receivedAt), desc(productionOrders.id));

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const items = await db
    .select({
      productionOrderId: videoLogs.productionOrderId,
      status: videoLogs.status,
      cancelledAt: videoLogs.cancelledAt,
      isOperationalContainer: videoLogs.isOperationalContainer,
      videoId: videoLogs.id,
    })
    .from(videoLogs)
    .where(inArray(videoLogs.productionOrderId, orderIds));

  const itemsByOrder = new Map<number, ProductionOrderItem[]>();
  for (const row of items) {
    if (row.productionOrderId === null) continue;
    const list = itemsByOrder.get(row.productionOrderId) ?? [];
    list.push({
      videoId: row.videoId,
      status: row.status as VideoStatus,
      cancelledAt: row.cancelledAt,
      isOperationalContainer: row.isOperationalContainer,
    });
    itemsByOrder.set(row.productionOrderId, list);
  }

  return orders.map((order) => {
    const orderItems = itemsByOrder.get(order.id) ?? [];
    return {
      id: order.id,
      label: order.label,
      channel: order.channel,
      state: order.state,
      phase: deriveProductionOrderPhase(orderItems),
      clientId: order.clientId,
      clientName: order.clientName,
      projectId: order.projectId,
      projectName: order.projectName,
      receivedAt: order.receivedAt,
      activeItemCount: countActiveDeliverables(orderItems),
      doneItemCount: countDoneDeliverables(orderItems),
      cancelledItemCount: countCancelledDeliverables(orderItems),
      expectedValueCents: order.expectedValueCents,
      currency: order.currency,
    };
  });
}

// ─── Detail ("comanda", brief §10) ──────────────────────────────────────────

export type ProductionOrderDetailItem = {
  videoId: number;
  title: string | null;
  status: VideoStatus;
  cancelledAt: Date | null;
  isOperationalContainer: boolean;
  deliveryUrl: string | null;
  reviewUrl: string | null;
};

export type ProductionOrderDetail = {
  id: number;
  label: string;
  channel: string | null;
  state: "OPEN" | "CLOSED" | "CANCELLED";
  phase: ProductionOrderPhase;
  pricingModel: "HOURLY" | "FIXED" | "OTHER" | null;
  expectedValueCents: number | null;
  currency: string | null;
  notes: string | null;
  receivedAt: string;
  closedAt: Date | null;
  cancelledAt: Date | null;
  clientId: number;
  clientName: string;
  projectId: number;
  projectName: string;
  containerVideoId: number | null;
  items: ProductionOrderDetailItem[]; // deliverables only, container excluded
  billedByCurrency: Array<{ currency: string; amount: number }>;
  variance: { billedCents: number | null; varianceCents: number | null };
  timeBreakdown: ReturnType<typeof computeProductionOrderTimeBreakdown>;
};

export async function getProductionOrderDetail(
  id: number,
): Promise<ProductionOrderDetail | null> {
  const db = await getAuthenticatedDb();

  const [order] = await db
    .select({
      id: productionOrders.id,
      label: productionOrders.label,
      channel: productionOrders.channel,
      state: productionOrders.state,
      pricingModel: productionOrders.pricingModel,
      expectedValueCents: productionOrders.expectedValueCents,
      currency: productionOrders.currency,
      notes: productionOrders.notes,
      receivedAt: productionOrders.receivedAt,
      closedAt: productionOrders.closedAt,
      cancelledAt: productionOrders.cancelledAt,
      clientId: productionOrders.clientId,
      clientName: clients.name,
      projectId: productionOrders.projectId,
      projectName: projects.name,
    })
    .from(productionOrders)
    .innerJoin(clients, eq(clients.id, productionOrders.clientId))
    .innerJoin(projects, eq(projects.id, productionOrders.projectId))
    .where(eq(productionOrders.id, id))
    .limit(1);

  if (!order) return null;

  const rows = await db
    .select({
      videoId: videoLogs.id,
      title: videoLogs.title,
      status: videoLogs.status,
      cancelledAt: videoLogs.cancelledAt,
      isOperationalContainer: videoLogs.isOperationalContainer,
      deliveryUrl: videoLogs.deliveryUrl,
      reviewUrl: videoLogs.reviewUrl,
    })
    .from(videoLogs)
    .where(eq(videoLogs.productionOrderId, id));

  const coreItems: ProductionOrderItem[] = rows.map((r) => ({
    videoId: r.videoId,
    status: r.status as VideoStatus,
    cancelledAt: r.cancelledAt,
    isOperationalContainer: r.isOperationalContainer,
  }));

  const containerRow = rows.find((r) => r.isOperationalContainer) ?? null;
  const deliverables = rows
    .filter((r) => !r.isOperationalContainer)
    .map((r) => ({
      videoId: r.videoId,
      title: r.title,
      status: r.status as VideoStatus,
      cancelledAt: r.cancelledAt,
      isOperationalContainer: r.isOperationalContainer,
      deliveryUrl: r.deliveryUrl,
      reviewUrl: r.reviewUrl,
    }));

  const videoIds = rows.map((r) => r.videoId);
  const [allocations, sessions] = await Promise.all([
    containerRow
      ? db
          .select({ amount: billingAllocations.amount, currency: billingAllocations.currency })
          .from(billingAllocations)
          .where(eq(billingAllocations.videoId, containerRow.videoId))
      : Promise.resolve([]),
    videoIds.length > 0
      ? db
          .select({
            videoId: workSessions.videoId,
            startedAt: workSessions.startedAt,
            endedAt: workSessions.endedAt,
          })
          .from(workSessions)
          .where(inArray(workSessions.videoId, videoIds))
      : Promise.resolve([]),
  ]);

  const billedByCurrency = sumBilledByCurrency(allocations);
  const variance = computeProductionOrderVariance({
    expectedValueCents: order.expectedValueCents,
    currency: order.currency,
    billedByCurrency,
  });
  const timeBreakdown = computeProductionOrderTimeBreakdown({
    containerVideoId: containerRow?.videoId ?? null,
    sessions,
  });

  return {
    id: order.id,
    label: order.label,
    channel: order.channel,
    state: order.state,
    phase: deriveProductionOrderPhase(coreItems),
    pricingModel: order.pricingModel,
    expectedValueCents: order.expectedValueCents,
    currency: order.currency,
    notes: order.notes,
    receivedAt: order.receivedAt,
    closedAt: order.closedAt,
    cancelledAt: order.cancelledAt,
    clientId: order.clientId,
    clientName: order.clientName,
    projectId: order.projectId,
    projectName: order.projectName,
    containerVideoId: containerRow?.videoId ?? null,
    items: deliverables,
    billedByCurrency,
    variance,
    timeBreakdown,
  };
}

// ─── War Room / Dashboard support ──────────────────────────────────────────

export async function countOpenProductionOrders(): Promise<number> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ id: productionOrders.id })
    .from(productionOrders)
    .where(eq(productionOrders.state, "OPEN"));
  return rows.length;
}

// ─── Ingest form support ────────────────────────────────────────────────────

export type IngestClientOption = { id: number; name: string };
export type IngestProjectOption = { id: number; clientId: number; name: string };

// Deliberately its own minimal query rather than reusing
// getProjectsOverview (modules/projects/actions.ts) -- the ingest form's
// picker only needs id/name/clientId, not that query's per-project video
// counts and joins.
export async function getClientsAndProjectsForIngest(): Promise<{
  clients: IngestClientOption[];
  projects: IngestProjectOption[];
}> {
  const db = await getAuthenticatedDb();
  const [clientRows, projectRows] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .orderBy(clients.name),
    db
      .select({ id: projects.id, clientId: projects.clientId, name: projects.name })
      .from(projects)
      .orderBy(projects.name),
  ]);
  return { clients: clientRows, projects: projectRows };
}

export type OpenProductionOrderRow = {
  id: number;
  label: string;
  clientName: string;
  projectName: string;
  receivedAt: Date;
};

// Feeds the "stale open order" War Room signal (see
// modules/signals/core.ts computeStaleProductionOrdersSignals) -- every
// OPEN order, regardless of age; the age filter itself is a pure
// function applied in core.ts, not a WHERE clause here, so it stays
// testable without a DB.
export async function getOpenProductionOrdersForSignals(): Promise<
  OpenProductionOrderRow[]
> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: productionOrders.id,
      label: productionOrders.label,
      clientName: clients.name,
      projectName: projects.name,
      receivedAt: productionOrders.receivedAt,
    })
    .from(productionOrders)
    .innerJoin(clients, eq(clients.id, productionOrders.clientId))
    .innerJoin(projects, eq(projects.id, productionOrders.projectId))
    .where(eq(productionOrders.state, "OPEN"));

  return rows.map((row) => ({
    ...row,
    receivedAt: new Date(`${row.receivedAt}T00:00:00Z`),
  }));
}
