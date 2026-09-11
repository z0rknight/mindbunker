"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedDb } from "@/db";
import { clients, productionOrders, projects, videoLogs } from "@/db/schema";
import { todayISO } from "@/utils/date";
import { deliveredForVideoStatus } from "@/modules/productivity/config";
import {
  canCancelProductionOrderItem,
  isProductionOrderMutable,
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
//  1. Insert the production_orders row with onConflictDoNothing on its
//     unique ingest_key index (the same atomic "insert or ignore" idiom
//     already used elsewhere in this repo -- see
//     modules/quote-intake/actions.ts / modules/booking/actions.ts), then
//     select the row back by ingest_key. Whether this call created it or
//     a prior attempt did, `order` below is always the one canonical row.
//  2. A second, independent idempotency guard covers the items: if this
//     order already has ANY video_logs rows linked to it (from a prior,
//     already-completed attempt), item creation is skipped entirely and
//     the existing order is returned as success. This is what makes a
//     network retry or a double-click safe even though D1/SQLite cannot
//     give us one interactive transaction spanning "resolve-or-create the
//     order" and "create its items" -- each half is independently
//     idempotent instead.
//
// The container row and every deliverable are created inside one
// db.batch() call (§4's required atomicity for the items themselves): all
// of them land, or none do, on any given attempt.
export async function ingestProductionOrder(
  input: ProductionOrderIngestInput,
): Promise<ProductionOrderActionResult> {
  const validationError = validateProductionOrderIngestInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();

  const [clientRow] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);
  if (!clientRow) return { success: false, error: "Client not found." };

  const [projectRow] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!projectRow) return { success: false, error: "Project not found." };

  await db
    .insert(productionOrders)
    .values({
      clientId: input.clientId,
      projectId: input.projectId,
      label: input.label.trim(),
      channel: input.channel?.trim() || null,
      pricingModel: input.pricingModel ?? null,
      expectedValueCents: input.expectedValueCents ?? null,
      currency: input.currency?.trim() || null,
      notes: input.notes?.trim() || null,
      receivedAt: input.receivedAt,
      ingestKey: input.ingestKey.trim(),
    })
    .onConflictDoNothing({ target: productionOrders.ingestKey });

  const [order] = await db
    .select({ id: productionOrders.id })
    .from(productionOrders)
    .where(eq(productionOrders.ingestKey, input.ingestKey.trim()))
    .limit(1);
  if (!order) {
    return { success: false, error: "Could not create or resolve the order. Please try again." };
  }

  const existingItems = await db
    .select({ id: videoLogs.id })
    .from(videoLogs)
    .where(eq(videoLogs.productionOrderId, order.id))
    .limit(1);

  if (existingItems.length === 0) {
    const now = new Date();
    const receivedDate = input.receivedAt || todayISO();
    const batchLabel = input.label.trim();

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
      productionOrderId: order.id,
      createdAt: now,
    });

    const itemInserts = input.items.map((item) =>
      db.insert(videoLogs).values({
        date: receivedDate,
        title: item.title.trim(),
        clientId: input.clientId,
        projectId: input.projectId,
        status: "PLANNED",
        delivered: deliveredForVideoStatus("PLANNED"),
        batchLabel,
        videoKind: "CLIENT_WORK",
        isOperationalContainer: false,
        productionOrderId: order.id,
        createdAt: now,
      }),
    );

    // db.batch requires a non-empty tuple type at the TS level (D1's real
    // transaction primitive; see the identical cast idiom already used in
    // modules/productivity/actions.ts). containerInsert alone already
    // guarantees non-emptiness; itemInserts (validated non-empty by
    // validateProductionOrderIngestInput above) is spread alongside it.
    const statements = [containerInsert, ...itemInserts];
    await db.batch(
      statements as unknown as [(typeof statements)[number], ...(typeof statements)[number][]],
    );
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
