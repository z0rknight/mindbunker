"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { billingEvidence, clients, commercialContracts, crmEvents, quotes } from "@/db/schema";
import { and, desc, eq, sql as drizzleSql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  canTransitionQuoteStatus,
  computeClosedSales,
  computeSalesThisMonth,
  formatQuoteOriginLabel,
  isQuoteOrigin,
  isQuoteStatus,
  validateQuoteInput,
  type SalesThisMonthSummary,
} from "./core";
import { startOfMonthISO } from "@/utils/date";
import { videoLogs } from "@/db/schema";
import { videoClosedSeconds } from "@/modules/work-sessions/data";
import type { QuoteStatus } from "./config";
import { createProject } from "@/modules/projects/actions";
import { createVideoLog } from "@/modules/productivity/actions";
import { getQuoteForVideoAsOperator } from "./data";

function isPositiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

export type QuoteActionResult =
  | { success: true; quoteId?: number; message?: string }
  | { success: false; error: string; errors?: Record<string, string> };

// Logged manually by Emmanuel from a Pricing Lab calculation he already
// ran -- see quotes/core.ts's header. Always starts DRAFT; there is no
// "create already SENT" shortcut so every quote has a real paper trail of
// having been reviewed once before going out.
export async function createQuote(
  input: Record<string, unknown>,
): Promise<QuoteActionResult> {
  const validation = validateQuoteInput(input);
  if (!validation.success) {
    return { success: false, error: "Check the highlighted fields.", errors: validation.errors };
  }
  const data = validation.data;

  const db = await getAuthenticatedDb();
  const clientRows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, data.clientId))
    .limit(1);
  if (!clientRows[0]) {
    return { success: false, error: "Client not found." };
  }

  const inserted = await db
    .insert(quotes)
    .values({
      clientId: data.clientId,
      status: "DRAFT",
      currency: data.currency,
      amountCents: data.amountCents,
      contentTypeLabel: data.contentTypeLabel,
      turnaroundLabel: data.turnaroundLabel,
      revisionsIncluded: data.revisionsIncluded,
      summary: data.summary || null,
      scopeText: data.scopeText,
    })
    .returning({ id: quotes.id });
  const quoteId = inserted[0]?.id;
  if (!quoteId) {
    return { success: false, error: "Quote could not be created." };
  }

  await db.insert(crmEvents).values({
    clientId: data.clientId,
    type: "quote.logged",
    actor: "admin",
    description: `Quote logged: ${data.contentTypeLabel} — ${data.currency} ${(data.amountCents / 100).toFixed(2)}`,
  });

  revalidatePath(`/crm/${data.clientId}`);
  return { success: true, quoteId, message: "Quote logged." };
}

// DRAFT -> SENT -> APPROVED, or DRAFT/SENT -> DECLINED. See
// QUOTE_STATUS_TRANSITIONS in config.ts for the full state machine --
// this action is the single place it's enforced, so no caller can skip a
// step by calling the DB directly.
export async function updateQuoteStatus(
  quoteId: number,
  nextStatus: string,
): Promise<QuoteActionResult> {
  if (!isPositiveId(quoteId) || !isQuoteStatus(nextStatus)) {
    return { success: false, error: "Invalid request." };
  }

  const db = await getAuthenticatedDb();
  const current = await db
    .select({ id: quotes.id, clientId: quotes.clientId, status: quotes.status })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);
  const quote = current[0];
  if (!quote) {
    return { success: false, error: "Quote not found." };
  }
  const currentStatus = quote.status as QuoteStatus;
  if (!canTransitionQuoteStatus(currentStatus, nextStatus)) {
    return { success: false, error: `A ${currentStatus.toLowerCase()} quote can't move to ${nextStatus.toLowerCase()}.` };
  }

  const now = new Date();
  const timestampColumn =
    nextStatus === "SENT" ? { sentAt: now } : nextStatus === "APPROVED" ? { approvedAt: now } : { declinedAt: now };

  await db
    .update(quotes)
    .set({ status: nextStatus, ...timestampColumn })
    .where(eq(quotes.id, quoteId));

  await db.insert(crmEvents).values({
    clientId: quote.clientId,
    type: "quote.status_changed",
    actor: "admin",
    description: `Quote ${quoteId} moved from ${currentStatus} to ${nextStatus}`,
  });

  // FLOW CLOSURE (Sunday round): this is the canonical mutation that
  // creates a "sale" (APPROVED) -- the Dashboard's Sales/Closed-Sales
  // cards and the celebratory sale banner (src/app/page.tsx) read quotes
  // too, but this action previously only revalidated the CRM client page.
  revalidatePath("/");
  revalidatePath(`/crm/${quote.clientId}`);
  return { success: true, message: `Quote marked ${nextStatus.toLowerCase()}.` };
}

// The one operator action for Sprint's "APPROVED QUOTE -> PRODUCTION"
// step (brief §7/§8). Only runs on an APPROVED quote with no production
// linked yet -- reuses the canonical createProject/createVideoLog actions
// verbatim (no duplicate creation model), then links the quote to what it
// authorized. If the client is still a Lead, promotes them to an active
// Client via the existing convertLeadToClient (same row, status change,
// no duplication -- brief §15).
export async function createProductionFromQuote(
  quoteId: number,
  input: { projectName: string; videoTitle: string },
): Promise<QuoteActionResult> {
  if (!isPositiveId(quoteId)) {
    return { success: false, error: "Invalid quote." };
  }
  const projectName = typeof input.projectName === "string" ? input.projectName.trim().slice(0, 200) : "";
  const videoTitle = typeof input.videoTitle === "string" ? input.videoTitle.trim().slice(0, 200) : "";
  if (!projectName || !videoTitle) {
    return { success: false, error: "Project name and video title are required." };
  }

  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: quotes.id,
      clientId: quotes.clientId,
      status: quotes.status,
      projectId: quotes.projectId,
      videoId: quotes.videoId,
      contentTypeLabel: quotes.contentTypeLabel,
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);
  const quote = rows[0];
  if (!quote) {
    return { success: false, error: "Quote not found." };
  }
  if (quote.status !== "APPROVED") {
    return { success: false, error: "Only an approved quote can become production work." };
  }
  if (quote.projectId !== null || quote.videoId !== null) {
    return { success: false, error: "Production work already exists for this quote." };
  }

  const clientRow = await db
    .select({ id: clients.id, status: clients.status })
    .from(clients)
    .where(eq(clients.id, quote.clientId))
    .limit(1);
  if (!clientRow[0]) {
    return { success: false, error: "Client not found." };
  }

  const projectResult = await createProject(quote.clientId, {
    name: projectName,
    status: "active",
  });
  if (!projectResult.success || !projectResult.projectId) {
    return { success: false, error: projectResult.success ? "Project could not be created." : projectResult.error };
  }

  const videoResult = await createVideoLog({
    title: videoTitle,
    clientId: quote.clientId,
    projectId: projectResult.projectId,
    status: "PLANNED",
  });
  if (!videoResult.success || !videoResult.videoId) {
    return { success: false, error: videoResult.success ? "Video could not be created." : videoResult.error };
  }

  await db
    .update(quotes)
    .set({ projectId: projectResult.projectId, videoId: videoResult.videoId })
    .where(eq(quotes.id, quoteId));

  // Lead -> Client (brief §15): same client row, status change only, and
  // only if they're still a Lead -- reuses convertLeadToClient rather
  // than reimplementing the transition here.
  if (clientRow[0].status === "lead") {
    const { convertLeadToClient } = await import("@/modules/crm/actions");
    await convertLeadToClient(quote.clientId);
  }

  await db.insert(crmEvents).values({
    clientId: quote.clientId,
    videoId: videoResult.videoId,
    type: "quote.production_created",
    actor: "admin",
    description: `Production work created from approved quote: ${quote.contentTypeLabel}`,
  });

  revalidatePath(`/crm/${quote.clientId}`);
  revalidatePath(`/projects/${projectResult.projectId}`);
  revalidatePath("/productivity");
  return {
    success: true,
    message: "Production work created.",
  };
}


// Reality Closure (26 Aug 2026): the old single-purpose
// getApprovedQuoteForVideoOperator/ApprovedQuotePanel (FIXED-only) was
// superseded by getCommercialTermsForVideo/CommercialTermsPanel below,
// which covers both FIXED and HOURLY billing models.

// Video Commercial Terms panel (Reality Closure, 26 Aug 2026): a video
// created outside the quote flow entirely -- Dave's fixed $100 landing
// page, agreed and worked before /quoteavideo or the quotes table
// existed -- has no quote to point to, and the commercial agreement was
// living in the Notes field (wrong ownership: Notes is operational
// memory, not commercial terms). Rather than invent a second price
// model, this creates a real `quotes` row for that video directly, in
// APPROVED status immediately (skipping DRAFT/SENT: this documents a
// deal already struck, not a proposal awaiting review), tagged
// origin="MANUAL" so the Commercial Terms panel can honestly say "Manual
// Commercial Terms" rather than implying it came through the public
// intake form. video and project must already exist -- this never
// constructs a fake lead/client to attach itself to.
export async function createManualApprovedQuoteForVideo(
  videoId: number,
  input: Record<string, unknown>,
): Promise<QuoteActionResult> {
  if (!isPositiveId(videoId)) {
    return { success: false, error: "Invalid video." };
  }

  const db = await getAuthenticatedDb();
  const videoRows = await db
    .select({
      id: videoLogs.id,
      clientId: videoLogs.clientId,
      projectId: videoLogs.projectId,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  const video = videoRows[0];
  if (!video) {
    return { success: false, error: "Video not found." };
  }
  if (video.clientId === null) {
    return { success: false, error: "This video has no client attached yet -- attach one before recording commercial terms." };
  }

  const existing = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(eq(quotes.videoId, videoId))
    .limit(1);
  if (existing[0]) {
    return { success: false, error: "This video already has commercial terms recorded." };
  }

  const validation = validateQuoteInput({ ...input, clientId: video.clientId });
  if (!validation.success) {
    return { success: false, error: "Check the highlighted fields.", errors: validation.errors };
  }
  const data = validation.data;

  const inserted = await db
    .insert(quotes)
    .values({
      clientId: video.clientId,
      status: "APPROVED",
      currency: data.currency,
      amountCents: data.amountCents,
      contentTypeLabel: data.contentTypeLabel,
      turnaroundLabel: data.turnaroundLabel,
      revisionsIncluded: data.revisionsIncluded,
      summary: data.summary || null,
      scopeText: data.scopeText,
      approvedAt: new Date(),
      projectId: video.projectId,
      videoId: video.id,
      origin: "MANUAL",
    })
    .returning({ id: quotes.id });
  const quoteId = inserted[0]?.id;
  if (!quoteId) {
    return { success: false, error: "Commercial terms could not be recorded." };
  }

  await db.insert(crmEvents).values({
    clientId: video.clientId,
    videoId: video.id,
    type: "quote.manual_commercial_terms_recorded",
    actor: "admin",
    description: `Manual commercial terms recorded: ${data.contentTypeLabel} — ${data.currency} ${(data.amountCents / 100).toFixed(2)}`,
  });

  // Quick Morning Reality Patch (26 Aug 2026) §13: a video predating the
  // quote flow (Dave's exact shape -- brief §11) recording its terms here
  // is just as real a sale as one that went through
  // createProductionFromQuote above, which already does this same
  // promotion. Without it, a client stays visually "Lead" forever if
  // their only commercial record was ever created this way -- same fix,
  // same reused convertLeadToClient, only if they're still a Lead.
  const clientRow = await db
    .select({ status: clients.status })
    .from(clients)
    .where(eq(clients.id, video.clientId))
    .limit(1);
  if (clientRow[0]?.status === "lead") {
    const { convertLeadToClient } = await import("@/modules/crm/actions");
    await convertLeadToClient(video.clientId);
  }

  revalidatePath(`/crm/${video.clientId}`);
  revalidatePath("/productivity");
  if (video.projectId) revalidatePath(`/projects/${video.projectId}`);
  return { success: true, quoteId, message: "Commercial terms recorded." };
}

// ─── Video Commercial Terms panel (Reality Closure, 26 Aug 2026) ─────────
//
// "Commercial agreement = commercial terms. Notes = operational memory."
// One derivation, two shapes -- FIXED (backed by a `quotes` row, same
// table §6/§7/§8 already use) or HOURLY (backed by the client's ACTIVE
// commercial_contracts row, the same table /finance/contracts already
// reads/writes). Neither branch invents a new price model; this only
// reads what already exists and adds the one thing that didn't: tracked
// production time per video (videoClosedSeconds, already canonical) and
// the derived rate that time implies. Never labeled "earned" or
// "revenue" -- see formatOperationalEffectiveRate/formatRateEquivalent.
export type CommercialTerms =
  | {
      billingModel: "FIXED";
      quoteId: number;
      source: string;
      currency: string;
      agreedPriceCents: number;
      turnaroundLabel: string;
      revisionsIncluded: number;
      scopeText: string;
      trackedSeconds: number;
    }
  | {
      billingModel: "HOURLY";
      contractId: number;
      platform: string;
      currency: string;
      hourlyRate: number;
      trackedSeconds: number;
      upworkBilledTotal: number | null;
      upworkBilledCurrency: string | null;
      upworkEvidenceCount: number;
    }
  | { billingModel: "NONE"; trackedSeconds: number };

export async function getCommercialTermsForVideo(videoId: number): Promise<CommercialTerms> {
  if (!isPositiveId(videoId)) {
    return { billingModel: "NONE", trackedSeconds: 0 };
  }
  const trackedSeconds = await videoClosedSeconds(videoId);

  // FIXED first: a quote directly linked to THIS video is the most
  // specific commercial fact available, regardless of what the client's
  // contract situation looks like otherwise.
  const quote = await getQuoteForVideoAsOperator(videoId);
  if (quote && quote.status === "APPROVED") {
    const origin = isQuoteOrigin(quote.origin) ? quote.origin : "INTAKE";
    return {
      billingModel: "FIXED",
      quoteId: quote.id,
      source: formatQuoteOriginLabel(origin),
      currency: quote.currency,
      agreedPriceCents: quote.amountCents,
      turnaroundLabel: quote.turnaroundLabel,
      revisionsIncluded: quote.revisionsIncluded,
      scopeText: quote.scopeText,
      trackedSeconds,
    };
  }

  // No video-specific quote -- fall back to the client's ACTIVE HOURLY
  // commercial contract, if one exists (the Taryn/$25-per-hour shape).
  const db = await getAuthenticatedDb();
  const videoRows = await db
    .select({ clientId: videoLogs.clientId })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  const clientId = videoRows[0]?.clientId ?? null;
  if (clientId === null) {
    return { billingModel: "NONE", trackedSeconds };
  }

  const contractRows = await db
    .select({
      id: commercialContracts.id,
      platform: commercialContracts.platform,
      hourlyRate: commercialContracts.hourlyRate,
      currency: commercialContracts.currency,
    })
    .from(commercialContracts)
    .where(
      and(
        eq(commercialContracts.clientId, clientId),
        eq(commercialContracts.billingType, "HOURLY"),
        eq(commercialContracts.status, "ACTIVE"),
      ),
    )
    .limit(1);
  const contract = contractRows[0];
  if (!contract || contract.hourlyRate === null) {
    return { billingModel: "NONE", trackedSeconds };
  }

  // Upwork billed evidence is CONTRACT-level (billing periods, not
  // per-video), so this total is an audit figure for the whole contract
  // on file -- never presented as "this video's revenue". See the panel
  // for the exact honest labeling.
  const evidenceTotal = await db
    .select({
      total: drizzleSql<number>`coalesce(sum(${billingEvidence.grossAmount}), 0)`,
      count: drizzleSql<number>`count(*)`,
      currency: billingEvidence.currency,
    })
    .from(billingEvidence)
    .where(eq(billingEvidence.contractId, contract.id))
    .groupBy(billingEvidence.currency)
    .limit(1);

  return {
    billingModel: "HOURLY",
    contractId: contract.id,
    platform: contract.platform,
    currency: contract.currency,
    hourlyRate: contract.hourlyRate,
    trackedSeconds,
    upworkBilledTotal: evidenceTotal[0]?.total ?? null,
    upworkBilledCurrency: evidenceTotal[0]?.currency ?? null,
    upworkEvidenceCount: evidenceTotal[0]?.count ?? 0,
  };
}

// Quick Morning Reality Patch (26 Aug 2026) §11: every APPROVED quote is a
// SALE, full stop -- see computeSalesThisMonth for why this is grouped by
// currency and never conflated with revenue. Reads the same `quotes`
// table every other commercial-terms feature this round already uses; no
// second ledger.
export async function getSalesThisMonth(): Promise<SalesThisMonthSummary> {
  const db = await getAuthenticatedDb();
  const approvedQuotes = await db
    .select({
      currency: quotes.currency,
      amountCents: quotes.amountCents,
      approvedAt: quotes.approvedAt,
    })
    .from(quotes)
    .where(eq(quotes.status, "APPROVED"));

  const monthStart = new Date(startOfMonthISO());
  return computeSalesThisMonth(approvedQuotes, monthStart);
}

// First Sale Economics (26 Aug 2026) §2: "Closed sales" / "Value closed"
// -- APPROVED QUOTE = SALE, no time window, so a real closed deal (Dave's
// $100) doesn't silently vanish from the dashboard once the calendar
// month rolls over. Same query shape as getSalesThisMonth above (status
// = APPROVED, nothing else); this is a read model over the exact same
// `quotes` table, never a second ledger.
export async function getClosedSales(): Promise<SalesThisMonthSummary> {
  const db = await getAuthenticatedDb();
  const approvedQuotes = await db
    .select({
      currency: quotes.currency,
      amountCents: quotes.amountCents,
      approvedAt: quotes.approvedAt,
    })
    .from(quotes)
    .where(eq(quotes.status, "APPROVED"));

  return computeClosedSales(approvedQuotes);
}

// Quick Morning Reality Patch §14: "small sales feedback," not a
// notification system -- just the single most recent sale this month, if
// any, derived from the same canonical approved-quote event this whole
// feature reuses. No new table, no persistence, recomputed on every
// dashboard load.
export type RecentSale = {
  quoteId: number;
  clientName: string;
  videoTitle: string | null;
  currency: string;
  amountCents: number;
  approvedAt: Date;
};

export async function getMostRecentSaleThisMonth(): Promise<RecentSale | null> {
  const db = await getAuthenticatedDb();
  const monthStart = new Date(startOfMonthISO());

  const rows = await db
    .select({
      quoteId: quotes.id,
      clientName: clients.name,
      videoTitle: videoLogs.title,
      currency: quotes.currency,
      amountCents: quotes.amountCents,
      approvedAt: quotes.approvedAt,
    })
    .from(quotes)
    .innerJoin(clients, eq(quotes.clientId, clients.id))
    .leftJoin(videoLogs, eq(quotes.videoId, videoLogs.id))
    .where(eq(quotes.status, "APPROVED"))
    .orderBy(desc(quotes.approvedAt))
    .limit(1);

  const row = rows[0];
  if (!row || !row.approvedAt || row.approvedAt.getTime() < monthStart.getTime()) {
    return null;
  }
  return {
    quoteId: row.quoteId,
    clientName: row.clientName,
    videoTitle: row.videoTitle,
    currency: row.currency,
    amountCents: row.amountCents,
    approvedAt: row.approvedAt,
  };
}
