"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clients, commercialCapacityState, crmEvents, quotes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { COMMERCIAL_CAPACITY_EVENT, COMMERCIAL_OFFER_DECISION_EVENT } from "./config";
import {
  createPublicOfferToken,
  hashPublicOfferToken,
  isCommercialCapacityState,
  isCommercialOfferType,
  offerLabel,
  validateHttpsUrl,
} from "./core";

type Result = { success: true; message: string; publicPath?: string } | { success: false; error: string };

export async function confirmCommercialOffer(clientId: number, offerType: string, reason: string): Promise<Result> {
  if (!Number.isSafeInteger(clientId) || clientId <= 0 || !isCommercialOfferType(offerType)) return { success: false, error: "Invalid commercial decision." };
  const cleanReason = reason.trim().slice(0, 500) || null;
  const db = await getAuthenticatedDb();
  const client = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client[0]) return { success: false, error: "Lead not found." };
  const decidedAt = new Date().toISOString();
  await db.insert(crmEvents).values({
    clientId,
    type: COMMERCIAL_OFFER_DECISION_EVENT,
    actor: "admin",
    description: `Offer fit confirmed: ${offerLabel(offerType)}`,
    payloadJson: JSON.stringify({ offerType, reason: cleanReason, decidedAt, actor: "admin" }),
  });
  revalidatePath(`/crm/${clientId}`);
  return { success: true, message: "Human offer decision recorded." };
}

export async function updateCommercialCapacity(input: {
  state: string;
  recurringSeats: number;
  heroProjects: number;
  reason: string;
}): Promise<Result> {
  if (!isCommercialCapacityState(input.state)) return { success: false, error: "Choose a valid capacity state." };
  if (!Number.isSafeInteger(input.recurringSeats) || input.recurringSeats < 0 || input.recurringSeats > 3) return { success: false, error: "Recurring seats must be between 0 and 3." };
  if (!Number.isSafeInteger(input.heroProjects) || input.heroProjects < 0 || input.heroProjects > 1) return { success: false, error: "Hero projects must be 0 or 1." };
  const reason = input.reason.trim().slice(0, 500) || null;
  const now = new Date();
  const db = await getAuthenticatedDb();
  await db.update(commercialCapacityState).set({ state: input.state, recurringSeats: input.recurringSeats, heroProjects: input.heroProjects, reason, actor: "operator", updatedAt: now }).where(eq(commercialCapacityState.id, 1));
  await db.insert(crmEvents).values({
    clientId: null,
    type: COMMERCIAL_CAPACITY_EVENT,
    actor: "admin",
    description: `Capacity set to ${input.state}: recurring ${input.recurringSeats}/3 · Hero ${input.heroProjects}/1`,
    payloadJson: JSON.stringify({ ...input, reason, decidedAt: now.toISOString(), actor: "admin" }),
  });
  revalidatePath("/crm");
  return { success: true, message: "Capacity decision saved." };
}

export async function publishPublicOffer(quoteId: number, input: {
  offerType: string;
  expiresAt: string;
  paymentUrl: string;
  paymentLabel: string;
  strategicExceptionNote: string;
}): Promise<Result> {
  if (!Number.isSafeInteger(quoteId) || quoteId <= 0 || !isCommercialOfferType(input.offerType)) return { success: false, error: "Invalid offer." };
  if (input.offerType === "NEEDS_DISCOVERY" || input.offerType === "NOT_A_FIT") return { success: false, error: "Only a sellable Offer can be published." };
  const expiresAt = new Date(input.expiresAt);
  if (!input.expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return { success: false, error: "Choose a future expiry." };
  const paymentUrl = input.paymentUrl.trim() ? validateHttpsUrl(input.paymentUrl) : null;
  if (input.paymentUrl.trim() && !paymentUrl) return { success: false, error: "Payment URL must be a valid HTTPS address." };
  const paymentLabel = input.paymentLabel.trim().slice(0, 80) || (paymentUrl ? "Pay with Wise" : null);
  const strategicExceptionNote = input.strategicExceptionNote.trim().slice(0, 500) || null;
  const db = await getAuthenticatedDb();
  const rows = await db.select({ id: quotes.id, clientId: quotes.clientId }).from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  const quote = rows[0];
  if (!quote) return { success: false, error: "Quote not found." };
  const token = createPublicOfferToken();
  const tokenHash = await hashPublicOfferToken(token);
  const now = new Date();
  await db.update(quotes).set({ offerType: input.offerType, publicTokenHash: tokenHash, publicPublishedAt: now, publicExpiresAt: expiresAt, publicRevokedAt: null, paymentUrl, paymentLabel, strategicExceptionNote }).where(eq(quotes.id, quoteId));
  await db.insert(crmEvents).values({ clientId: quote.clientId, type: "commercial.offer_published", actor: "admin", description: `Public Offer published from Quote ${quoteId}: ${offerLabel(input.offerType)}`, payloadJson: JSON.stringify({ quoteId, offerType: input.offerType, expiresAt: expiresAt.toISOString(), hasPaymentUrl: Boolean(paymentUrl), publishedAt: now.toISOString() }) });
  revalidatePath(`/crm/${quote.clientId}`);
  return { success: true, message: "Public Offer published.", publicPath: `/offer/${token}` };
}

export async function revokePublicOffer(quoteId: number): Promise<Result> {
  if (!Number.isSafeInteger(quoteId) || quoteId <= 0) return { success: false, error: "Invalid offer." };
  const db = await getAuthenticatedDb();
  const rows = await db.select({ clientId: quotes.clientId, publicPublishedAt: quotes.publicPublishedAt }).from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  const quote = rows[0];
  if (!quote?.publicPublishedAt) return { success: false, error: "Published Offer not found." };
  await db.update(quotes).set({ publicRevokedAt: new Date() }).where(eq(quotes.id, quoteId));
  await db.insert(crmEvents).values({ clientId: quote.clientId, type: "commercial.offer_revoked", actor: "admin", description: `Public Offer revoked for Quote ${quoteId}` });
  revalidatePath(`/crm/${quote.clientId}`);
  return { success: true, message: "Public Offer revoked." };
}
