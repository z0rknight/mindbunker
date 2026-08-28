import "server-only";

import { getAuthenticatedDb, getDb } from "@/db";
import { quotes } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { QuoteStatus } from "./config";

export type QuoteRow = {
  id: number;
  clientId: number;
  status: QuoteStatus;
  currency: string;
  amountCents: number;
  contentTypeLabel: string;
  turnaroundLabel: string;
  revisionsIncluded: number;
  summary: string | null;
  scopeText: string;
  createdAt: Date | null;
  sentAt: Date | null;
  approvedAt: Date | null;
  declinedAt: Date | null;
  projectId: number | null;
  videoId: number | null;
  origin: "INTAKE" | "MANUAL";
};

const QUOTE_COLUMNS = {
  id: quotes.id,
  clientId: quotes.clientId,
  status: quotes.status,
  currency: quotes.currency,
  amountCents: quotes.amountCents,
  contentTypeLabel: quotes.contentTypeLabel,
  turnaroundLabel: quotes.turnaroundLabel,
  revisionsIncluded: quotes.revisionsIncluded,
  summary: quotes.summary,
  scopeText: quotes.scopeText,
  createdAt: quotes.createdAt,
  sentAt: quotes.sentAt,
  approvedAt: quotes.approvedAt,
  declinedAt: quotes.declinedAt,
  projectId: quotes.projectId,
  videoId: quotes.videoId,
  origin: quotes.origin,
} as const;

export async function getQuotesForClient(clientId: number): Promise<QuoteRow[]> {
  const db = await getAuthenticatedDb();
  return db
    .select(QUOTE_COLUMNS)
    .from(quotes)
    .where(eq(quotes.clientId, clientId))
    .orderBy(desc(quotes.createdAt), desc(quotes.id));
}

export async function getQuoteById(id: number): Promise<QuoteRow | null> {
  const db = await getAuthenticatedDb();
  const rows = await db.select(QUOTE_COLUMNS).from(quotes).where(eq(quotes.id, id)).limit(1);
  return rows[0] ?? null;
}

// Client-portal-safe: no getAuthenticatedDb (no admin-session requirement)
// -- the caller (client-portal/data.ts) is responsible for verifying the
// video actually belongs to the authenticated client before this is ever
// invoked, same convention as every other client-portal data reader.
export async function getApprovedQuoteForVideo(videoId: number): Promise<QuoteRow | null> {
  const db = await getDb();
  const rows = await db
    .select(QUOTE_COLUMNS)
    .from(quotes)
    .where(eq(quotes.videoId, videoId))
    .orderBy(desc(quotes.id))
    .limit(1);
  const quote = rows[0];
  if (!quote || quote.status !== "APPROVED") return null;
  return quote;
}

// Operator-side equivalent for the Video workspace panel -- same query,
// authenticated session required.
export async function getQuoteForVideoAsOperator(videoId: number): Promise<QuoteRow | null> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select(QUOTE_COLUMNS)
    .from(quotes)
    .where(eq(quotes.videoId, videoId))
    .orderBy(desc(quotes.id))
    .limit(1);
  return rows[0] ?? null;
}
