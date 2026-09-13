"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getAuthenticatedDb } from "@/db";
import { clients, paymentRequests } from "@/db/schema";
import {
  isMutablePaymentRequest,
  validatePaymentRequestCreateInput,
  type PaymentRequestCreateInput,
} from "./core";

export type PaymentRequestActionResult =
  | { success: true; id: number }
  | { success: false; error: string };

// Creates a new OPEN request. The partial unique index
// (payment_requests_one_open_per_client_idx) is the real guarantee that a
// client never has two simultaneous open asks -- this pre-check exists
// only to return a clear operator-facing error instead of a raw
// constraint-violation message.
export async function createPaymentRequest(
  input: PaymentRequestCreateInput,
): Promise<PaymentRequestActionResult> {
  const validationError = validatePaymentRequestCreateInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();

  const [clientRow] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);
  if (!clientRow) return { success: false, error: "Client not found." };

  const [existingOpen] = await db
    .select({ id: paymentRequests.id })
    .from(paymentRequests)
    .where(and(eq(paymentRequests.clientId, input.clientId), eq(paymentRequests.status, "OPEN")))
    .limit(1);
  if (existingOpen) {
    return {
      success: false,
      error: "This client already has an open payment request. Cancel or mark it paid first.",
    };
  }

  // The pre-check above is a friendly error message, not the real
  // guarantee -- payment_requests_one_open_per_client_idx (a partial
  // unique index) is what actually prevents two OPEN rows for the same
  // client under a race. A violation here surfaces as a thrown DB error,
  // which is the correct, honest outcome for that rare case.
  const [inserted] = await db
    .insert(paymentRequests)
    .values({
      clientId: input.clientId,
      amountCents: input.amountCents,
      currency: input.currency,
      paymentUrl: input.paymentUrl.trim(),
      note: input.note?.trim() || null,
      status: "OPEN",
    })
    .returning({ id: paymentRequests.id });

  revalidatePath(`/crm/${input.clientId}`);
  revalidatePath("/client/dashboard");

  return { success: true, id: inserted.id };
}

async function setStatus(
  id: number,
  nextStatus: "PAID" | "CANCELLED",
): Promise<PaymentRequestActionResult> {
  const db = await getAuthenticatedDb();
  const [existing] = await db
    .select({ id: paymentRequests.id, clientId: paymentRequests.clientId, status: paymentRequests.status })
    .from(paymentRequests)
    .where(eq(paymentRequests.id, id))
    .limit(1);
  if (!existing) return { success: false, error: "Payment request not found." };
  if (!isMutablePaymentRequest(existing)) {
    return { success: false, error: "This request is no longer open." };
  }

  await db
    .update(paymentRequests)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(paymentRequests.id, id));

  revalidatePath(`/crm/${existing.clientId}`);
  revalidatePath("/client/dashboard");

  return { success: true, id };
}

// Operator-set only -- a client clicking the Wise link never calls this.
// The canonical proof money moved stays `transactions`, entirely separate
// from this table (see the schema comment). Marking PAID here is purely
// "stop showing the CTA," an operator bookkeeping action.
export async function markPaymentRequestPaid(id: number): Promise<PaymentRequestActionResult> {
  return setStatus(id, "PAID");
}

export async function cancelPaymentRequest(id: number): Promise<PaymentRequestActionResult> {
  return setStatus(id, "CANCELLED");
}
