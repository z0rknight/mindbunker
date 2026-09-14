"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { getAuthenticatedDb } from "@/db";
import { clients, commercialContracts, productionOrders, projects, videoLogs } from "@/db/schema";
import { todayISO } from "@/utils/date";
import { prepareVideoLogInserts } from "@/modules/productivity/creation";
import {
  canCancelProductionOrderItem,
  isProductionOrderMutable,
  validateProductionOrderContract,
  validateProductionOrderIngestInput,
  type ProductionOrderIngestInput,
} from "./core.ts";

export type ProductionOrderActionResult =
  | { success: true; orderId: number }
  | { success: false; error: string };

// ─── Ingest (brief §7, §8) — idempotent, retry-safe ────────────────────────
//
// `input.ingestKey` is generated once by the ingest form (crypto.randomUUID(),
// see src/app/productivity/orders/new) and resent unchanged on every retry
// of the same submit. This function is safe to call more than once with the
// same key:
//
//  1. Prepare and validate every ordinary child before any write.
//  2. If the ingest key already resolves to one complete order, return it.
//  3. Otherwise, insert-or-ignore the order and insert its container and
//     children in one atomic D1 batch.
//
// The order row, container, and every deliverable are created inside one
// db.batch() call. Child rows resolve the auto-generated order id through
// its unique ingest key, so the application never guesses an id and the
// full business ingest lands or rolls back as one D1 transaction.
export async function ingestProductionOrder(
  input: ProductionOrderIngestInput,
): Promise<ProductionOrderActionResult> {
  const validationError = validateProductionOrderIngestInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();

  const [clientRow] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);
  if (!clientRow) return { success: false, error: "Client not found." };

  const [projectRow] = await db
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!projectRow) return { success: false, error: "Project not found." };
  if (projectRow.clientId !== input.clientId) {
    return { success: false, error: "That project does not belong to the selected client." };
  }

  if (input.contractId != null) {
    const [contractRow] = await db
      .select({
        id: commercialContracts.id,
        clientId: commercialContracts.clientId,
        status: commercialContracts.status,
      })
      .from(commercialContracts)
      .where(eq(commercialContracts.id, input.contractId))
      .limit(1);
    const contractError = validateProductionOrderContract(input.clientId, contractRow ?? null);
    if (contractError) return { success: false, error: contractError };
  }

  const ingestKey = input.ingestKey.trim();
  const existingOrder = await db
    .select({ id: productionOrders.id })
    .from(productionOrders)
    .where(eq(productionOrders.ingestKey, ingestKey))
    .limit(1);

  if (existingOrder[0]) {
    const existingItems = await db
      .select({
        id: videoLogs.id,
        isOperationalContainer: videoLogs.isOperationalContainer,
      })
      .from(videoLogs)
      .where(eq(videoLogs.productionOrderId, existingOrder[0].id));
    const containerCount = existingItems.filter((row) => row.isOperationalContainer).length;
    const childCount = existingItems.length - containerCount;
    if (containerCount === 1 && childCount === input.items.length) {
      return { success: true, orderId: existingOrder[0].id };
    }
    if (existingItems.length > 0) {
      return {
        success: false,
        error: "This Production Order exists with an incomplete item set. Review it before retrying.",
      };
    }
  }

  const now = new Date();
  const receivedDate = input.receivedAt || todayISO();
  const batchLabel = input.label.trim();
  const orderId = sql<number>`(
    select ${productionOrders.id}
    from ${productionOrders}
    where ${productionOrders.ingestKey} = ${ingestKey}
    limit 1
  )`;
  const preparedChildren = prepareVideoLogInserts({
    projectId: input.projectId,
    rows: input.items.map((item) => ({
      title: item.title,
      date: receivedDate,
      status: "PLANNED",
    })),
    owner: { clientId: input.clientId, clientName: clientRow.name },
    batchLabel,
    productionOrderId: orderId,
    now,
  });
  if (!preparedChildren.success) {
    return { success: false, error: preparedChildren.error };
  }

  const orderInsert = db
    .insert(productionOrders)
    .values({
      clientId: input.clientId,
      projectId: input.projectId,
      contractId: input.contractId ?? null,
      label: input.label.trim(),
      channel: input.channel?.trim() || null,
      pricingModel: input.pricingModel ?? null,
      expectedValueCents: input.expectedValueCents ?? null,
      currency: input.currency?.trim() || null,
      notes: input.notes?.trim() || null,
      receivedAt: input.receivedAt,
      ingestKey,
    })
    .onConflictDoNothing({ target: productionOrders.ingestKey });
  // The container remains an explicit order-specific row. Only ordinary
  // deliverables use prepareVideoLogInserts; this distinction keeps the
  // queue/output semantics of is_operational_container unchanged.
  const containerInsert = db.insert(videoLogs).values({
    date: receivedDate,
    title: `[Container] ${batchLabel}`,
    clientId: input.clientId,
    projectId: input.projectId,
    status: "PLANNED",
    delivered: false,
    batchLabel,
    videoKind: "CLIENT_WORK",
    isOperationalContainer: true,
    productionOrderId: orderId,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const statements = [
      orderInsert,
      containerInsert,
      ...preparedChildren.data.map((row) => db.insert(videoLogs).values(row)),
    ];
    // One statement per child stays below D1's bound-parameter ceiling;
    // db.batch still executes the complete statement list as one atomic
    // transaction, so this does not relax the business boundary.
    await db.batch(
      statements as unknown as [
        (typeof statements)[number],
        ...(typeof statements)[number][],
      ],
    );
  } catch {
    // A simultaneous replay can lose the unique ingest-key race after the
    // read above. D1 rolls its whole batch back; if the winning request has
    // now committed a complete order, this request is the same successful
    // idempotent operation. Any other failure remains a clean zero/previous
    // state because batch() is atomic.
    const [resolved] = await db
      .select({ id: productionOrders.id })
      .from(productionOrders)
      .where(eq(productionOrders.ingestKey, ingestKey))
      .limit(1);
    if (!resolved) {
      return { success: false, error: "Could not create the Production Order. Nothing was saved." };
    }
    const resolvedItems = await db
      .select({ isOperationalContainer: videoLogs.isOperationalContainer })
      .from(videoLogs)
      .where(eq(videoLogs.productionOrderId, resolved.id));
    const containerCount = resolvedItems.filter((row) => row.isOperationalContainer).length;
    if (containerCount !== 1 || resolvedItems.length - containerCount !== input.items.length) {
      return { success: false, error: "Could not create the complete Production Order. Nothing new was saved." };
    }
  }

  const [order] = await db
    .select({ id: productionOrders.id })
    .from(productionOrders)
    .where(eq(productionOrders.ingestKey, ingestKey))
    .limit(1);
  if (!order) {
    return { success: false, error: "Could not resolve the Production Order after creation." };
  }

  revalidatePath("/productivity/orders");
  revalidatePath(`/productivity/orders/${order.id}`);
  revalidatePath("/productivity");
  revalidatePath("/war-room");
  revalidatePath("/");

  return { success: true, orderId: order.id };
}

// ─── Item cancellation (brief §1B, locked) ─────────────────────────────────
//
// Sets video_logs.cancelled_at only. Never deletes the row, never touches
// status, never touches any Work Session / revision / billing_allocation
// referencing this video -- all of that stays exactly as it was, as real
// history. The item simply stops counting as "active" everywhere
// activeDeliverableItems (./core.ts) is used: phase derivation, active
// counts, and the equivalent-per-active-item denominator.
export async function cancelProductionOrderItem(
  videoId: number,
): Promise<ProductionOrderActionResult> {
  const db = await getAuthenticatedDb();

  const [item] = await db
    .select({
      id: videoLogs.id,
      productionOrderId: videoLogs.productionOrderId,
      cancelledAt: videoLogs.cancelledAt,
      isOperationalContainer: videoLogs.isOperationalContainer,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);

  if (!item || item.productionOrderId === null) {
    return { success: false, error: "This video is not part of a Production Order." };
  }
  if (!canCancelProductionOrderItem(item)) {
    return {
      success: false,
      error: item.isOperationalContainer
        ? "The container row cannot be cancelled individually -- cancel the whole order instead."
        : "This item is already cancelled.",
    };
  }

  const [order] = await db
    .select({ state: productionOrders.state })
    .from(productionOrders)
    .where(eq(productionOrders.id, item.productionOrderId))
    .limit(1);
  if (!order || !isProductionOrderMutable(order)) {
    return { success: false, error: "This order is no longer open." };
  }

  await db
    .update(videoLogs)
    .set({ cancelledAt: new Date() })
    .where(eq(videoLogs.id, videoId));

  revalidatePath(`/productivity/orders/${item.productionOrderId}`);
  revalidatePath("/productivity/orders");
  revalidatePath("/war-room");

  return { success: true, orderId: item.productionOrderId };
}

// ─── Order-level lifecycle: close / cancel ─────────────────────────────────
//
// `state` is a small, operator-set lifecycle only (see the productionOrders
// table comment in src/db/schema.ts) -- neither action below requires every
// active deliverable to be DONE first. The operator, not the system, decides
// when an order is done being worked (a client can go quiet with two
// deliverables still open; closing the order is still the operator's real
// decision, not something MindBunker should block).
export async function closeProductionOrder(
  orderId: number,
): Promise<ProductionOrderActionResult> {
  const db = await getAuthenticatedDb();
  const [order] = await db
    .select({ state: productionOrders.state })
    .from(productionOrders)
    .where(eq(productionOrders.id, orderId))
    .limit(1);
  if (!order) return { success: false, error: "Order not found." };
  if (!isProductionOrderMutable(order)) {
    return { success: false, error: "Only an open order can be closed." };
  }

  await db
    .update(productionOrders)
    .set({ state: "CLOSED", closedAt: new Date(), updatedAt: new Date() })
    .where(eq(productionOrders.id, orderId));

  revalidatePath(`/productivity/orders/${orderId}`);
  revalidatePath("/productivity/orders");
  revalidatePath("/war-room");

  return { success: true, orderId };
}

export async function cancelProductionOrder(
  orderId: number,
): Promise<ProductionOrderActionResult> {
  const db = await getAuthenticatedDb();
  const [order] = await db
    .select({ state: productionOrders.state })
    .from(productionOrders)
    .where(eq(productionOrders.id, orderId))
    .limit(1);
  if (!order) return { success: false, error: "Order not found." };
  if (!isProductionOrderMutable(order)) {
    return { success: false, error: "Only an open order can be cancelled." };
  }

  // Cancelling the order does not cancel or delete its items -- their
  // video_logs rows, statuses, and history stay exactly as they are.
  // Nothing here writes to video_logs at all; the order's own state and
  // cancelled_at are the only fields set.
  await db
    .update(productionOrders)
    .set({ state: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(productionOrders.id, orderId), eq(productionOrders.state, "OPEN")));

  revalidatePath(`/productivity/orders/${orderId}`);
  revalidatePath("/productivity/orders");
  revalidatePath("/war-room");

  return { success: true, orderId };
}
