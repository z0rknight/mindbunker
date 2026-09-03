import "server-only";

import { getDb } from "@/db";
import { clients, crmEvents, projects, videoLogs } from "@/db/schema";
import { getGatewayContext } from "@/modules/gateway/data";
import { and, desc, eq } from "drizzle-orm";
import {
  buildClientDashboard,
  buildClientPortalProjects,
  buildClientVideoDetail,
  type ClientDashboard,
  type ClientVideoDetail,
} from "./core";
import { getApprovedQuoteForVideo } from "@/modules/quotes/data";
import { buildClientQuoteSummary, buildClientHourlySummary } from "@/modules/quotes/core";
import { getCommercialTermsForVideo } from "@/modules/quotes/actions";

export type ClientPortalView =
  | { status: "unavailable" }
  | {
      status: "active";
      clientName: string;
      projects: ReturnType<typeof buildClientPortalProjects>;
    };

export async function getClientPortalView(
  rawToken: string,
): Promise<ClientPortalView> {
  const identity = await getGatewayContext(rawToken);
  if (!identity || identity.accessStatus !== "active") {
    return { status: "unavailable" };
  }

  const db = await getDb();
  const [projectRows, videoRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        name: projects.name,
        status: projects.status,
        deadline: projects.deadline,
      })
      .from(projects)
      .where(eq(projects.clientId, identity.clientId))
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
        // Client Portal Reality round: same tier-2 cover chain as
        // getClientDashboardView below -- free, projects is already
        // inner-joined here for ownership verification.
        coverUrl: videoLogs.coverUrl,
        projectCoverUrl: projects.coverUrl,
        createdAt: videoLogs.createdAt,
        updatedAt: videoLogs.updatedAt,
      })
      .from(videoLogs)
      .innerJoin(projects, eq(videoLogs.projectId, projects.id))
      .where(
        and(
          eq(videoLogs.clientId, identity.clientId),
          eq(projects.clientId, identity.clientId),
        ),
      )
      .orderBy(desc(videoLogs.updatedAt), desc(videoLogs.createdAt)),
  ]);

  return {
    status: "active",
    clientName: identity.clientName,
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
  | ({ status: "active"; clientName: string } & ClientDashboard);

export async function getClientDashboardView(
  authenticatedClientId: number,
): Promise<ClientDashboardView> {
  const db = await getDb();
  const clientRow = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, authenticatedClientId))
    .limit(1);
  if (!clientRow[0]) {
    return { status: "unavailable" };
  }

  const [projectRows, videoRows, completionEventRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        name: projects.name,
        status: projects.status,
        deadline: projects.deadline,
      })
      .from(projects)
      .where(eq(projects.clientId, authenticatedClientId))
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
  ]);

  return {
    status: "active",
    clientName: clientRow[0].name,
    ...buildClientDashboard(
      authenticatedClientId,
      projectRows,
      videoRows,
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
  | { status: "active"; clientName: string; video: ClientVideoDetail };

export async function getClientVideoDetailView(
  authenticatedClientId: number,
  videoId: number,
): Promise<ClientVideoDetailView> {
  const db = await getDb();
  const clientRow = await db
    .select({ id: clients.id, name: clients.name })
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
      ),
    )
    .limit(1);
  const video = rows[0];
  if (!video) {
    return { status: "unavailable" };
  }

  const projectNameById = new Map<number, string>();
  if (video.projectId !== null) {
    projectNameById.set(video.projectId, video.projectName);
  }

  const approvedQuote = await getApprovedQuoteForVideo(videoId);
  const quote = approvedQuote ? buildClientQuoteSummary(approvedQuote) : null;
  // Post-Job Commercial + Delivery Sniper §9: reuse the SAME canonical
  // commercial engine every operator surface already calls -- no second
  // derivation for the client portal.
  const commercialTerms = quote ? null : await getCommercialTermsForVideo(videoId);
  const hourly = commercialTerms ? buildClientHourlySummary(commercialTerms) : null;

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
              ),
            )
        ).length
      : null;

  return {
    status: "active",
    clientName: clientRow[0].name,
    video: buildClientVideoDetail(video, projectNameById, quote, projectVideoCount, hourly),
  };
}
