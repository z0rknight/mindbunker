import { getDb } from "@/db";
import { clients, projects, videoLogs } from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import {
  authenticateSensorRequest,
  sensorUnauthorized,
} from "@/modules/sensor/server";
import {
  WORK_SESSION_ACTIVITY_TYPES,
  WORK_SESSION_ACTIVITY_LABELS,
} from "@/modules/work-sessions/core";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const device = await authenticateSensorRequest(request, "CATALOG_READ");
  if (!device) return sensorUnauthorized();
  const db = await getDb();
  const [clientRows, projectRows, videoRows] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(ne(clients.archivalState, "GELADEIRA"))
      .orderBy(desc(clients.createdAt), desc(clients.id))
      .limit(100),
    db
      .select({ id: projects.id, clientId: projects.clientId, name: projects.name, status: projects.status })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(and(ne(projects.status, "archived"), ne(clients.archivalState, "GELADEIRA")))
      .orderBy(desc(projects.updatedAt), desc(projects.id))
      .limit(200),
    db
      .select({
        id: videoLogs.id,
        clientId: videoLogs.clientId,
        projectId: videoLogs.projectId,
        title: videoLogs.title,
        date: videoLogs.date,
        status: videoLogs.status,
      })
      .from(videoLogs)
      .innerJoin(projects, eq(videoLogs.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(and(ne(projects.status, "archived"), ne(clients.archivalState, "GELADEIRA")))
      .orderBy(desc(videoLogs.createdAt), desc(videoLogs.id))
      .limit(500),
  ]);
  return Response.json(
    {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      device: { id: device.publicId, name: device.name },
      // Client Service Reality Patch (25 Aug 2026): MindBunker owns the
      // canonical activity vocabulary (see work-sessions/core.ts); this is
      // now the one place a Sensor client can fetch it instead of
      // hardcoding its own copy that can silently drift from the server's.
      // A Sensor build that doesn't read this yet keeps working exactly as
      // before -- this is a pure addition to the response.
      activity_types: WORK_SESSION_ACTIVITY_TYPES.map((id) => ({
        id,
        label: WORK_SESSION_ACTIVITY_LABELS[id],
      })),
      clients: clientRows,
      projects: projectRows.map((row) => ({
        id: row.id,
        client_id: row.clientId,
        name: row.name,
        status: row.status,
      })),
      videos: videoRows.map((row) => ({
        id: row.id,
        client_id: row.clientId,
        project_id: row.projectId,
        title: row.title ?? `Video ${row.date}`,
        status: row.status,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
