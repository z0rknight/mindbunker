import "server-only";

import { getDb } from "@/db";
import { projects, videoLogs } from "@/db/schema";
import { getGatewayContext } from "@/modules/gateway/data";
import { and, desc, eq } from "drizzle-orm";
import { buildClientPortalProjects } from "./core";

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
