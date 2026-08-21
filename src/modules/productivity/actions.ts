"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clients, crmEvents, projects, videoLogs } from "@/db/schema";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { startOfMonthISO, todayISO } from "@/utils/date";
import {
  isPositiveId,
  validateVideoInput,
  type VideoInputValues,
} from "./core";

type ProductivityActionResult =
  | { success: true; message?: string; revisionsCount?: number }
  | { success: false; error: string };

function revalidateProductivityViews(clientId?: number | null) {
  revalidatePath("/");
  revalidatePath("/productivity");
  revalidatePath("/war-room");
  if (clientId) revalidatePath(`/crm/${clientId}`);
}

export async function logFinishedVideo(
  values: VideoInputValues,
): Promise<ProductivityActionResult> {
  const parsed = validateVideoInput(values);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  let clientId = parsed.data.clientId;

  if (parsed.data.projectId) {
    const project = await db
      .select({ clientId: projects.clientId, status: projects.status })
      .from(projects)
      .where(eq(projects.id, parsed.data.projectId))
      .limit(1);
    if (!project[0]) return { success: false, error: "Project not found." };
    if (project[0].status === "archived") {
      return { success: false, error: "Choose a project that is not archived." };
    }
    clientId = project[0].clientId;
  } else if (clientId) {
    const owner = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);
    if (!owner[0]) return { success: false, error: "Client not found." };
  }

  const videoInsert = db.insert(videoLogs).values({
    date: todayISO(),
    title: parsed.data.title,
    clientId,
    projectId: parsed.data.projectId,
    revisionsCount: 0,
    delivered: true,
    notes: parsed.data.notes,
  });
  if (clientId) {
    await db.batch([
      videoInsert,
      db.insert(crmEvents).values({
        clientId,
        type: "video_delivered",
        actor: "admin",
        description: `Video delivered: ${parsed.data.title}`,
      }),
    ]);
  } else {
    await videoInsert;
  }

  revalidateProductivityViews(clientId);
  return { success: true, message: "Video linked and logged." };
}

export async function getVideoStats() {
  const db = await getAuthenticatedDb();
  const today = todayISO();
  const monthStart = startOfMonthISO();

  const [todayCount, monthCount, allLogs] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(videoLogs)
      .where(eq(videoLogs.date, today)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(videoLogs)
      .where(gte(videoLogs.date, monthStart)),
    db.select().from(videoLogs).orderBy(videoLogs.createdAt),
  ]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekStart = sevenDaysAgo.toISOString().split("T")[0];
  const weekLogs = allLogs.filter((log) => log.date >= weekStart);

  return {
    today: Number(todayCount[0]?.count ?? 0),
    week: weekLogs.length,
    month: Number(monthCount[0]?.count ?? 0),
    total: allLogs.length,
    totalRevisions: allLogs.reduce(
      (sum, log) => sum + log.revisionsCount,
      0,
    ),
  };
}

export async function getAllVideoLogs() {
  const db = await getAuthenticatedDb();
  return db
    .select({
      id: videoLogs.id,
      date: videoLogs.date,
      title: videoLogs.title,
      clientId: videoLogs.clientId,
      clientName: clients.name,
      projectId: videoLogs.projectId,
      projectName: projects.name,
      revisionsCount: videoLogs.revisionsCount,
      delivered: videoLogs.delivered,
      notes: videoLogs.notes,
      createdAt: videoLogs.createdAt,
    })
    .from(videoLogs)
    .leftJoin(clients, eq(videoLogs.clientId, clients.id))
    .leftJoin(projects, eq(videoLogs.projectId, projects.id))
    .orderBy(desc(videoLogs.createdAt), desc(videoLogs.id));
}

export async function getProductivityQuickOptions() {
  const db = await getAuthenticatedDb();
  const [projectRows, clientRows, videoRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
        clientName: clients.name,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(ne(projects.status, "archived"))
      .orderBy(desc(projects.updatedAt), desc(projects.id))
      .limit(50),
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .orderBy(desc(clients.createdAt), desc(clients.id))
      .limit(100),
    db
      .select({
        id: videoLogs.id,
        title: videoLogs.title,
        date: videoLogs.date,
        revisionsCount: videoLogs.revisionsCount,
        projectName: projects.name,
        clientName: clients.name,
      })
      .from(videoLogs)
      .leftJoin(projects, eq(videoLogs.projectId, projects.id))
      .leftJoin(clients, eq(videoLogs.clientId, clients.id))
      .orderBy(desc(videoLogs.createdAt), desc(videoLogs.id))
      .limit(50),
  ]);

  return { projects: projectRows, clients: clientRows, videos: videoRows };
}

export async function changeRevisionCount(
  videoId: number,
  delta: -1 | 1,
): Promise<ProductivityActionResult> {
  if (!isPositiveId(videoId) || (delta !== -1 && delta !== 1)) {
    return { success: false, error: "Invalid revision change." };
  }

  const db = await getAuthenticatedDb();
  const current = await db
    .select({
      id: videoLogs.id,
      clientId: videoLogs.clientId,
      revisionsCount: videoLogs.revisionsCount,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  if (!current[0]) return { success: false, error: "Video not found." };
  if (delta === -1 && current[0].revisionsCount === 0) {
    return { success: false, error: "This video has no revision to remove." };
  }

  const updated = await db
    .update(videoLogs)
    .set({
      revisionsCount: sql`max(${videoLogs.revisionsCount} + ${delta}, 0)`,
      updatedAt: new Date(),
    })
    .where(and(eq(videoLogs.id, videoId), gte(videoLogs.revisionsCount, 0)))
    .returning({ revisionsCount: videoLogs.revisionsCount });

  revalidateProductivityViews(current[0].clientId);
  return {
    success: true,
    message: delta === 1 ? "Revision added." : "Revision removed.",
    revisionsCount: updated[0]?.revisionsCount,
  };
}

export async function deleteVideoLog(
  id: number,
): Promise<ProductivityActionResult> {
  if (!isPositiveId(id)) return { success: false, error: "Invalid video." };
  const db = await getAuthenticatedDb();
  const current = await db
    .select({ clientId: videoLogs.clientId })
    .from(videoLogs)
    .where(eq(videoLogs.id, id))
    .limit(1);
  if (!current[0]) return { success: false, error: "Video not found." };

  await db.delete(videoLogs).where(eq(videoLogs.id, id));
  revalidateProductivityViews(current[0].clientId);
  return { success: true, message: "Video removed." };
}
