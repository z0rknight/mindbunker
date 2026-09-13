import "server-only";

import { getDb } from "@/db";
import {
  billingAllocations,
  billingEvidence,
  clients,
  commercialContracts,
  crmEvents,
  productionOrders,
  projects,
  videoLogs,
} from "@/db/schema";
import { getGatewayContext } from "@/modules/gateway/data";
import { and, eq, desc, inArray, isNull } from "drizzle-orm";
import { deriveProductionOrderPhase, sumBilledByCurrency } from "@/modules/production-orders/core";
import type { VideoStatus } from "@/modules/productivity/config";
import {
  buildClientBillingSummary,
  buildClientDashboard,
  buildClientPortalProjects,
  buildClientVideoDetail,
  type ClientBillingSummary,
  type ClientDashboard,
  type ClientVideoDetail,
} from "./core";
import { getApprovedQuoteForVideo } from "@/modules/quotes/data";
import { buildClientQuoteSummary } from "@/modules/quotes/core";
import { getOpenPaymentRequestForClient } from "@/modules/payment-requests/data";
import { toClientPaymentRequestView, type ClientPaymentRequestView } from "@/modules/payment-requests/core";

// RMEDIA MINDBUNKER Solo-Operator Health round: a LET'S COOK operational
// container (isOperationalContainer=true) or a cancelled Production Order
// item (cancelledAt set) must never reach a client -- see
// isDeliverableVideo in modules/productivity/core.ts, the same predicate
// applied on the operator side. Applied at the SQL level (not just
// filtered in JS after) so these rows are never even fetched for a client
// session.
const CLIENT_VISIBLE_VIDEO = and(
  eq(videoLogs.isOperationalContainer, false),
  isNull(videoLogs.cancelledAt),
  eq(videoLogs.visibleToClient, true),
);

export type ClientPortalView =
  | { status: "unavailable" }
  | {
      status: "active";
      clientName: string;
      projects: ReturnType<typeof buildClientPortalProjects>;
      batches: ClientBatchView[];
    };

export async function getClientPortalView(
  rawToken: string,
): Promise<ClientPortalView> {
  const identity = await getGatewayContext(rawToken);
  if (!identity || identity.accessStatus !== "active") {
    return { status: "unavailable" };
  }

  const db = await getDb();
  const [projectRows, videoRows, clientSettings, batches] = await Promise.all([
    db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        name: projects.name,
        status: projects.status,
        deadline: projects.deadline,
      })
      .from(projects)
      .where(
        and(
          eq(projects.clientId, identity.clientId),
          eq(projects.visibleToClient, true),
        ),
      )
      .orderBy(desc(projects.updatedAt), desc(projects.id)),
    db
      .select({
        id: videoLogs.id,
        projectId: videoLogs.projectId,
        clientId: videoLogs.clientId,
        projectClientId: projects.clientId,
        title: videoLogs.title,
        date: videoLogs.date,
        status: videoLogs.status,
        deliveryUrl: videoLogs.deliveryUrl,
        reviewUrl: videoLogs.reviewUrl,
        publishedUrl: videoLogs.publishedUrl,
        batchLabel: videoLogs.batchLabel,
        // Client Portal Reality round: same tier-2 cover chain as
        // getClientDashboardView below -- free, projects is already
        // inner-joined here for ownership verification.
        coverUrl: videoLogs.coverUrl,
        projectCoverUrl: projects.coverUrl,
        clientDefaultCoverUrl: clients.defaultCoverUrl,
        createdAt: videoLogs.createdAt,
        updatedAt: videoLogs.updatedAt,
      })
      .from(videoLogs)
      .innerJoin(projects, eq(videoLogs.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(
        and(
          eq(videoLogs.clientId, identity.clientId),
          eq(projects.clientId, identity.clientId),
          eq(projects.visibleToClient, true),
          CLIENT_VISIBLE_VIDEO,
        ),
      )
      .orderBy(desc(videoLogs.updatedAt), desc(videoLogs.createdAt)),
    db
      .select({ canSeeFinancials: clients.portalCanSeeFinancials })
      .from(clients)
      .where(eq(clients.id, identity.clientId))
      .limit(1),
    getClientBatchViews(identity.clientId),
  ]);

  return {
    status: "active",
    clientName: identity.clientName,
    batches: clientSettings[0]?.canSeeFinancials
      ? batches
      : batches.map((batch) => ({ ...batch, expectedValue: null, billed: [] })),
    projects: buildClientPortalProjects(
      identity.clientId,
      projectRows,
      videoRows,
    ),
  };
}

// --- Authenticated Client Dashboard (Sprint 1.2.2) -------------------------
//
// Distinct entry point from getClientPortalView above: that one resolves
// identity from a capability TOKEN (the /g and /client/[token] links) with
// no session involved. This one resolves identity from an already-verified
// clientId (the mb_client_session cookie, checked upstream by
// requireClientAuth/isClientAuthenticated before this is ever called) --
// it never trusts a clientId that didn't come from a verified session.

export type ClientDashboardView =
  | { status: "unavailable" }
  | ({
      status: "active";
      clientName: string;
      // Dave Monday Release: null whenever there is no OPEN request, OR
      // whenever portalCanSeeFinancials is false -- both cases render
      // identically (no Current Account section), which is exactly right:
      // a client with financials off must not be able to tell a hidden
      // request apart from no request at all.
      paymentRequest: ClientPaymentRequestView;
      permissions: {
        canSeeFinancials: boolean;
        canReview: boolean;
        canSetPriority: boolean;
      };
      batches: ClientBatchView[];
    } & ClientDashboard);

export type ClientBatchView = {
  id: number;
  label: string;
  state: "OPEN" | "CLOSED" | "CANCELLED";
  phase: "RECEIVED" | "IN_PRODUCTION" | "REVIEW" | "DELIVERED";
  projectName: string;
  receivedAt: string;
  closedAt: string | null;
  items: Array<{ id: number; title: string; status: VideoStatus }>;
  expectedValue: { amount: number; currency: string } | null;
  billed: Array<{ amount: number; currency: string }>;
};

async function getClientBatchViews(clientId: number): Promise<ClientBatchView[]> {
  const db = await getDb();
  const orders = await db
    .select({
      id: productionOrders.id,
      label: productionOrders.label,
      state: productionOrders.state,
      projectName: projects.name,
      receivedAt: productionOrders.receivedAt,
      closedAt: productionOrders.closedAt,
      expectedValueCents: productionOrders.expectedValueCents,
      currency: productionOrders.currency,
    })
    .from(productionOrders)
    .innerJoin(projects, eq(projects.id, productionOrders.projectId))
    .where(and(eq(productionOrders.clientId, clientId), eq(projects.clientId, clientId), eq(projects.visibleToClient, true)))
    .orderBy(desc(productionOrders.receivedAt), desc(productionOrders.id));
  if (orders.length === 0) return [];

  const orderIds = orders.map((order) => order.id);
  const [items, containers] = await Promise.all([
    db
      .select({
        id: videoLogs.id,
        productionOrderId: videoLogs.productionOrderId,
        title: videoLogs.title,
        date: videoLogs.date,
        status: videoLogs.status,
        cancelledAt: videoLogs.cancelledAt,
        isOperationalContainer: videoLogs.isOperationalContainer,
      })
      .from(videoLogs)
      .innerJoin(projects, eq(projects.id, videoLogs.projectId))
      .where(and(
        inArray(videoLogs.productionOrderId, orderIds),
        eq(videoLogs.clientId, clientId),
        eq(projects.clientId, clientId),
        eq(projects.visibleToClient, true),
        CLIENT_VISIBLE_VIDEO,
      )),
    db
      .select({ id: videoLogs.id, productionOrderId: videoLogs.productionOrderId })
      .from(videoLogs)
      .where(and(
        inArray(videoLogs.productionOrderId, orderIds),
        eq(videoLogs.clientId, clientId),
        eq(videoLogs.isOperationalContainer, true),
      )),
  ]);

  const containerIds = containers.map((row) => row.id);
  const allocationRows = containerIds.length > 0
    ? await db
        .select({ videoId: billingAllocations.videoId, amount: billingAllocations.amount, currency: billingAllocations.currency })
        .from(billingAllocations)
        .where(inArray(billingAllocations.videoId, containerIds))
    : [];
  const orderByContainer = new Map(containers.map((row) => [row.id, row.productionOrderId]));

  return orders.map((order) => {
    const orderItems = items.filter((item) => item.productionOrderId === order.id);
    return {
      id: order.id,
      label: order.label,
      state: order.state,
      phase: deriveProductionOrderPhase(orderItems.map((item) => ({
        videoId: item.id,
        status: item.status,
        cancelledAt: item.cancelledAt,
        isOperationalContainer: item.isOperationalContainer,
      }))),
      projectName: order.projectName,
      receivedAt: order.receivedAt,
      closedAt: order.closedAt?.toISOString() ?? null,
      items: orderItems.map((item) => ({
        id: item.id,
        title: item.title?.trim() || `Video ${item.date}`,
        status: item.status,
      })),
      expectedValue: order.expectedValueCents != null && order.currency
        ? { amount: order.expectedValueCents / 100, currency: order.currency }
        : null,
      billed: sumBilledByCurrency(
        allocationRows
          .filter((allocation) => orderByContainer.get(allocation.videoId ?? -1) === order.id)
          .map((allocation) => ({ amount: allocation.amount, currency: allocation.currency })),
      ),
    };
  });
}

export async function getClientDashboardView(
  authenticatedClientId: number,
): Promise<ClientDashboardView> {
  const db = await getDb();
  const clientRow = await db
    .select({
      id: clients.id,
      name: clients.name,
      defaultCoverUrl: clients.defaultCoverUrl,
      instagramProfilePictureUrl: clients.instagramProfilePictureUrl,
      portalCanSeeFinancials: clients.portalCanSeeFinancials,
      portalCanReview: clients.portalCanReview,
      portalCanSetPriority: clients.portalCanSetPriority,
    })
    .from(clients)
    .where(eq(clients.id, authenticatedClientId))
    .limit(1);
  if (!clientRow[0]) {
    return { status: "unavailable" };
  }

  const [projectRows, videoRows, completionEventRows, batches, paymentRequestRow] = await Promise.all([
    db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        name: projects.name,
        status: projects.status,
        deadline: projects.deadline,
      })
      .from(projects)
      .where(
        and(
          eq(projects.clientId, authenticatedClientId),
          eq(projects.visibleToClient, true),
        ),
      )
      .orderBy(desc(projects.updatedAt), desc(projects.id)),
    db
      .select({
        id: videoLogs.id,
        projectId: videoLogs.projectId,
        clientId: videoLogs.clientId,
        projectClientId: projects.clientId,
        title: videoLogs.title,
        date: videoLogs.date,
        status: videoLogs.status,
        deliveryUrl: videoLogs.deliveryUrl,
        reviewUrl: videoLogs.reviewUrl,
        publishedUrl: videoLogs.publishedUrl,
        batchLabel: videoLogs.batchLabel,
        coverUrl: videoLogs.coverUrl,
        // Sprint 3 P1: fallback tier 2 of the cover chain -- see
        // resolveCoverUrl in modules/media/core.ts. Free: projects is
        // already inner-joined here for ownership verification.
        projectCoverUrl: projects.coverUrl,
        orientation: videoLogs.orientation,
        contentType: videoLogs.contentType,
        // Lunch Reality Patch P1 §7: client-settable "priority now" video.
        isPriority: videoLogs.isPriority,
        createdAt: videoLogs.createdAt,
        updatedAt: videoLogs.updatedAt,
      })
      .from(videoLogs)
      .innerJoin(projects, eq(videoLogs.projectId, projects.id))
      .where(
        and(
          eq(videoLogs.clientId, authenticatedClientId),
          eq(projects.clientId, authenticatedClientId),
          eq(projects.visibleToClient, true),
          CLIENT_VISIBLE_VIDEO,
        ),
      )
      .orderBy(desc(videoLogs.updatedAt), desc(videoLogs.createdAt)),
    db
      .select({ videoId: crmEvents.videoId, createdAt: crmEvents.createdAt })
      .from(crmEvents)
      .where(
        and(
          eq(crmEvents.clientId, authenticatedClientId),
          eq(crmEvents.type, "video.finished"),
        ),
      )
      .orderBy(desc(crmEvents.createdAt))
      .limit(100),
    getClientBatchViews(authenticatedClientId),
    // Dave Monday Release: fetched unconditionally (cheap, indexed,
    // client-scoped), but gated to null below when portalCanSeeFinancials
    // is false -- server-side, not left to the page's render logic. See
    // the same hardening already applied to `batches` a few lines down.
    getOpenPaymentRequestForClient(authenticatedClientId),
  ]);

  return {
    status: "active",
    clientName: clientRow[0].name,
    paymentRequest: clientRow[0].portalCanSeeFinancials
      ? toClientPaymentRequestView(paymentRequestRow)
      : null,
    permissions: {
      canSeeFinancials: clientRow[0].portalCanSeeFinancials,
      canReview: clientRow[0].portalCanReview,
      canSetPriority: clientRow[0].portalCanSetPriority,
    },
    // Sunday QA Patch hardening: strip financial fields at the read-model
    // level, exactly like getClientPortalView already does -- the page's
    // own `view.permissions.canSeeFinancials` render gate stays as a second,
    // belt-and-suspenders check, but the server must never put a real
    // expectedValue/billed figure into this response when the client's own
    // portalCanSeeFinancials is false. A viewer inspecting the raw RSC/JSON
    // payload must see the same absence the rendered page shows.
    batches: clientRow[0].portalCanSeeFinancials
      ? batches
      : batches.map((batch) => ({ ...batch, expectedValue: null, billed: [] })),
    ...buildClientDashboard(
      authenticatedClientId,
      projectRows,
      videoRows.map((video) => ({
        ...video,
        clientDefaultCoverUrl: clientRow[0].defaultCoverUrl,
        clientLogoUrl: clientRow[0].instagramProfilePictureUrl,
      })),
      completionEventRows,
      new Date(),
    ),
  };
}

// Client Vault "video must act like a video" fix (25 Aug 2026, brief §9):
// the client-safe single-video detail page. Ownership is verified the
// same way getClientDashboardView verifies every video -- both
// clientId AND the joined project's clientId must match the
// authenticated session, so client A can never reach client B's video by
// guessing an id.
export type ClientVideoDetailView =
  | { status: "unavailable" }
  | {
      status: "active";
      clientName: string;
      video: ClientVideoDetail & { canReview: boolean; canSetPriority: boolean };
    };

export async function getClientVideoDetailView(
  authenticatedClientId: number,
  videoId: number,
): Promise<ClientVideoDetailView> {
  const db = await getDb();
  const clientRow = await db
    .select({
      id: clients.id,
      name: clients.name,
      defaultCoverUrl: clients.defaultCoverUrl,
      instagramProfilePictureUrl: clients.instagramProfilePictureUrl,
      portalCanReview: clients.portalCanReview,
      portalCanSetPriority: clients.portalCanSetPriority,
    })
    .from(clients)
    .where(eq(clients.id, authenticatedClientId))
    .limit(1);
  if (!clientRow[0]) {
    return { status: "unavailable" };
  }

  const rows = await db
    .select({
      id: videoLogs.id,
      projectId: videoLogs.projectId,
      clientId: videoLogs.clientId,
      projectClientId: projects.clientId,
      projectName: projects.name,
      title: videoLogs.title,
      date: videoLogs.date,
      status: videoLogs.status,
      deliveryUrl: videoLogs.deliveryUrl,
      reviewUrl: videoLogs.reviewUrl,
      publishedUrl: videoLogs.publishedUrl,
      batchLabel: videoLogs.batchLabel,
      coverUrl: videoLogs.coverUrl,
      projectCoverUrl: projects.coverUrl,
      orientation: videoLogs.orientation,
      contentType: videoLogs.contentType,
      isPriority: videoLogs.isPriority,
      createdAt: videoLogs.createdAt,
      updatedAt: videoLogs.updatedAt,
    })
    .from(videoLogs)
    .innerJoin(projects, eq(videoLogs.projectId, projects.id))
    .where(
      and(
        eq(videoLogs.id, videoId),
        eq(videoLogs.clientId, authenticatedClientId),
        eq(projects.clientId, authenticatedClientId),
        eq(projects.visibleToClient, true),
        CLIENT_VISIBLE_VIDEO,
      ),
    )
    .limit(1);
  const video = rows[0]
    ? {
        ...rows[0],
        clientDefaultCoverUrl: clientRow[0].defaultCoverUrl,
        clientLogoUrl: clientRow[0].instagramProfilePictureUrl,
      }
    : null;
  if (!video) {
    return { status: "unavailable" };
  }

  const projectNameById = new Map<number, string>();
  if (video.projectId !== null) {
    projectNameById.set(video.projectId, video.projectName);
  }

  const approvedQuote = await getApprovedQuoteForVideo(videoId);
  const quote = approvedQuote ? buildClientQuoteSummary(approvedQuote) : null;

  // Quick Morning Reality Patch §4: sibling count within the SAME
  // clientId+projectId ownership check as the main query above, so this
  // can never leak a count from a project the client doesn't own.
  const projectVideoCount =
    video.projectId !== null
      ? (
          await db
            .select({ id: videoLogs.id })
            .from(videoLogs)
            .where(
              and(
                eq(videoLogs.projectId, video.projectId),
                eq(videoLogs.clientId, authenticatedClientId),
                CLIENT_VISIBLE_VIDEO,
              ),
            )
        ).length
      : null;

  return {
    status: "active",
    clientName: clientRow[0].name,
    video: {
      ...buildClientVideoDetail(video, projectNameById, quote, projectVideoCount),
      canReview: clientRow[0].portalCanReview,
      canSetPriority: clientRow[0].portalCanSetPriority,
    },
  };
}

// Client Portal Gateway round (Client Billing Transparency): "current
// recorded spend." Deliberately a standalone function, not merged into
// getClientDashboardView -- that function and buildClientDashboard have
// extensive existing test coverage keyed to their current shape, and this
// data has nothing to do with video/project state. Called separately
// (Promise.all alongside getClientDashboardView) from the dashboard page.
//
// Every query below is scoped by an INNER JOIN back to commercial_contracts
// on the authenticated clientId -- never by contractId/evidenceId ranges
// alone -- and buildClientBillingSummary re-checks ownership again in pure
// code, matching the double-check pattern used throughout this module.
export async function getClientBillingSummary(
  authenticatedClientId: number,
): Promise<ClientBillingSummary> {
  const db = await getDb();

  const permission = await db
    .select({ canSeeFinancials: clients.portalCanSeeFinancials })
    .from(clients)
    .where(eq(clients.id, authenticatedClientId))
    .limit(1);
  if (!permission[0]?.canSeeFinancials) {
    return {
      visibility: "hidden",
      hasAnyRecordedWork: false,
      byCurrency: [],
      byProject: [],
    };
  }

  const [contractRows, evidenceRows, allocationRows, projectRows] = await Promise.all([
    db
      .select({
        id: commercialContracts.id,
        clientId: commercialContracts.clientId,
        currency: commercialContracts.currency,
        billingType: commercialContracts.billingType,
        hourlyRate: commercialContracts.hourlyRate,
      })
      .from(commercialContracts)
      .where(eq(commercialContracts.clientId, authenticatedClientId)),
    db
      .select({
        contractId: billingEvidence.contractId,
        contractClientId: commercialContracts.clientId,
        currency: billingEvidence.currency,
        billableMinutes: billingEvidence.billableMinutes,
        grossAmount: billingEvidence.grossAmount,
      })
      .from(billingEvidence)
      .innerJoin(commercialContracts, eq(billingEvidence.contractId, commercialContracts.id))
      .where(eq(commercialContracts.clientId, authenticatedClientId)),
    db
      .select({
        contractClientId: commercialContracts.clientId,
        amount: billingAllocations.amount,
        minutes: billingAllocations.minutes,
        currency: billingAllocations.currency,
        videoId: billingAllocations.videoId,
        // Re-verified below: a videoId is only trusted for project
        // attribution if that video also belongs to this same client --
        // otherwise it's treated as unattributed rather than risking
        // exposing another client's project name.
        videoClientId: videoLogs.clientId,
        videoProjectId: videoLogs.projectId,
      })
      .from(billingAllocations)
      .innerJoin(billingEvidence, eq(billingAllocations.billingEvidenceId, billingEvidence.id))
      .innerJoin(commercialContracts, eq(billingEvidence.contractId, commercialContracts.id))
      .leftJoin(videoLogs, eq(billingAllocations.videoId, videoLogs.id))
      .where(eq(commercialContracts.clientId, authenticatedClientId)),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.clientId, authenticatedClientId)),
  ]);

  const projectNameById = new Map(projectRows.map((project) => [project.id, project.name]));

  const safeAllocationRows = allocationRows.map((row) => ({
    contractClientId: row.contractClientId,
    amount: row.amount,
    minutes: row.minutes,
    currency: row.currency,
    videoId: row.videoId,
    projectId:
      row.videoId !== null && row.videoClientId === authenticatedClientId
        ? row.videoProjectId
        : null,
  }));

  return {
    ...buildClientBillingSummary(
      authenticatedClientId,
      contractRows,
      evidenceRows,
      safeAllocationRows,
      projectNameById,
    ),
    visibility: "visible",
  };
}
