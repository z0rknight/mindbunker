import "server-only";

import { getAuthenticatedDb, getDb } from "@/db";
import { clients, commercialCapacityState, crmEvents, quotes } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { COMMERCIAL_OFFER_DECISION_EVENT } from "./config";
import {
  hashPublicOfferToken,
  isPublicOfferToken,
  parseCommercialOfferDecision,
} from "./core";

export async function getCommercialCapacity() {
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(commercialCapacityState).where(eq(commercialCapacityState.id, 1)).limit(1);
  return rows[0] ?? null;
}

export async function getLatestCommercialOfferDecision(clientId: number) {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ payloadJson: crmEvents.payloadJson })
    .from(crmEvents)
    .where(and(eq(crmEvents.clientId, clientId), eq(crmEvents.type, COMMERCIAL_OFFER_DECISION_EVENT)))
    .orderBy(desc(crmEvents.createdAt), desc(crmEvents.id))
    .limit(50);
  for (const row of rows) {
    const decision = parseCommercialOfferDecision(row.payloadJson);
    if (decision) return decision;
  }
  return null;
}

export async function getPublicOffer(rawToken: string) {
  if (!isPublicOfferToken(rawToken)) return null;
  const db = await getDb();
  const tokenHash = await hashPublicOfferToken(rawToken);
  const rows = await db
    .select({
      id: quotes.id,
      clientName: clients.name,
      offerType: quotes.offerType,
      currency: quotes.currency,
      amountCents: quotes.amountCents,
      summary: quotes.summary,
      scopeText: quotes.scopeText,
      turnaroundLabel: quotes.turnaroundLabel,
      revisionsIncluded: quotes.revisionsIncluded,
      publishedAt: quotes.publicPublishedAt,
      expiresAt: quotes.publicExpiresAt,
      revokedAt: quotes.publicRevokedAt,
      paymentUrl: quotes.paymentUrl,
      paymentLabel: quotes.paymentLabel,
    })
    .from(quotes)
    .innerJoin(clients, eq(quotes.clientId, clients.id))
    .where(eq(quotes.publicTokenHash, tokenHash))
    .limit(1);
  const offer = rows[0];
  if (!offer || !offer.publishedAt || offer.revokedAt || (offer.expiresAt && offer.expiresAt.getTime() <= Date.now())) return null;
  return offer;
}
