import "server-only";
import { getAuthenticatedDb, getDb } from "@/db";
import { paymentRequests } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { PaymentRequestRow } from "./core";

// Operator-side: every request for a client, newest first -- the full
// history (OPEN/PAID/CANCELLED), for the Client Detail panel.
export async function getPaymentRequestsForClient(
  clientId: number,
): Promise<PaymentRequestRow[]> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: paymentRequests.id,
      clientId: paymentRequests.clientId,
      amountCents: paymentRequests.amountCents,
      currency: paymentRequests.currency,
      paymentUrl: paymentRequests.paymentUrl,
      status: paymentRequests.status,
      note: paymentRequests.note,
    })
    .from(paymentRequests)
    .where(eq(paymentRequests.clientId, clientId))
    .orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id));
  return rows;
}

// Client-portal side: the one OPEN request, if any -- getDb() (not
// getAuthenticatedDb()), matching every other client-portal read in this
// module, since this runs under the client's own session, not an
// operator's. Ownership is the caller's job (both getClientPortalView and
// getClientDashboardView already resolve clientId from a verified
// token/session before calling this), same convention as every other
// client-portal query in this codebase.
export async function getOpenPaymentRequestForClient(
  clientId: number,
): Promise<PaymentRequestRow | null> {
  const db = await getDb();
  const rows = await db
    .select({
      id: paymentRequests.id,
      clientId: paymentRequests.clientId,
      amountCents: paymentRequests.amountCents,
      currency: paymentRequests.currency,
      paymentUrl: paymentRequests.paymentUrl,
      status: paymentRequests.status,
      note: paymentRequests.note,
    })
    .from(paymentRequests)
    .where(and(eq(paymentRequests.clientId, clientId), eq(paymentRequests.status, "OPEN")))
    .limit(1);
  return rows[0] ?? null;
}
