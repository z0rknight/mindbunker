import "server-only";

import { getDb } from "@/db";
import { clients, crmEvents, projects, videoLogs } from "@/db/schema";
import { getGatewayContext } from "@/modules/gateway/data";
import { and, desc, eq } from "drizzle-orm";
import { buildClientDashboard, buildClientPortalProjects, type ClientDashboard } from "./core";

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
        projectId: videoLogs.projectId,
        clientId: videoLogs.clientId,
        projectClientId: projects.clientId,
        title: videoLogs.title,
        date: videoLogs.date,
        status: videoLogs.status,
        deliveryUrl: videoLogs.deliveryUrl,
        reviewUrl: videoLogs.reviewUrl,
        publishedUrl: videoLogs.publishedUrl,
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
        orientation: videoLogs.orientation,
        contentType: videoLogs.contentType,
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
