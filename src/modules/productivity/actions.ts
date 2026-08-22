"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clients, crmEvents, projects, videoLogs, workSessions } from "@/db/schema";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { startOfMonthISO, todayISO } from "@/utils/date";
import {
  completedVideoLogs,
  getVideoMetadataChanges,
  isPositiveId,
  planVideoTransition,
  validateVideoAssignment,
  validateVideoCreateInput,
  validateVideoInput,
  type VideoCreateInputValues,
  type VideoInputValues,
} from "./core";
import {
  VIDEO_STATUS_LABELS,
  deliveredForVideoStatus,
  isVideoStatus,
  type VideoStatus,
} from "./config";
import {
  VIDEO_OPERATIONAL_MEMORY_DELETE_ERROR,
  VIDEO_OPERATIONAL_NOTE_EVENT_TYPE,
  videoOperationalMemoryBlocksDeletion,
} from "@/modules/video-memory/core";

type ProductivityActionResult =
  | {
      success: true;
      message?: string;
      revisionsCount?: number;
      status?: VideoStatus;
      videoId?: number;
      changedFields?: string[];
    }
  | { success: false; error: string };

type AuthenticatedDb = Awaited<ReturnType<typeof getAuthenticatedDb>>;

function revalidateProductivityViews(...clientIds: Array<number | null | undefined>) {
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/productivity");
  revalidatePath("/war-room");
  for (const clientId of new Set(clientIds.filter(Boolean))) {
    revalidatePath(`/crm/${clientId}`);
  }
}

async function resolveVideoAssignment(
  db: AuthenticatedDb,
  input: { projectId: number | null; clientId: number | null },
  options: { allowArchivedProjectId?: number | null } = {},
) {
  const project = input.projectId
    ? (
        await db
          .select({ clientId: projects.clientId, status: projects.status })
          .from(projects)
          .where(eq(projects.id, input.projectId))
          .limit(1)
      )[0] ?? null
    : null;

  const assignment = validateVideoAssignment({
    requestedClientId: input.clientId,
    projectId: input.projectId,
    project,
    allowArchivedProject:
      input.projectId !== null &&
      input.projectId === options.allowArchivedProjectId,
  });
  if (!assignment.success) return assignment;

  if (!input.projectId && assignment.clientId) {
    const owner = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, assignment.clientId))
      .limit(1);
    if (!owner[0]) {
      return { success: false as const, error: "Client not found." };
    }
  }

  return { success: true as const, clientId: assignment.clientId };
}

export async function createVideoLog(
  values: VideoCreateInputValues,
): Promise<ProductivityActionResult> {
  const parsed = validateVideoCreateInput(values);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  const assignment = await resolveVideoAssignment(db, parsed.data);
  if (!assignment.success) return assignment;

  const now = new Date();
  const inserted = await db
    .insert(videoLogs)
    .values({
      date: todayISO(),
      title: parsed.data.title,
      clientId: assignment.clientId,
      projectId: parsed.data.projectId,
      status: parsed.data.status,
      startedAt: null,
      revisionsCount: 0,
      delivered: deliveredForVideoStatus(parsed.data.status),
      deliveryUrl: parsed.data.deliveryUrl,
      notes: parsed.data.notes,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: videoLogs.id });
  const videoId = inserted[0]?.id;
  if (!videoId) {
    return { success: false, error: "Video could not be created." };
  }

  await db.insert(crmEvents).values({
    clientId: assignment.clientId,
    videoId,
    type: "video.created",
    actor: "admin",
    description: `Video created: ${parsed.data.title}`,
    createdAt: now,
  });

  revalidateProductivityViews(assignment.clientId);
  return {
    success: true,
    videoId,
    status: parsed.data.status,
    message: "Planned video created.",
  };
}

export async function getVideoStats() {
  const db = await getAuthenticatedDb();
  const today = todayISO();
  const monthStart = startOfMonthISO();

  const [todayCount, monthCount, allLogs] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(videoLogs)
      .where(and(eq(videoLogs.date, today), eq(videoLogs.status, "DONE"))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(videoLogs)
      .where(
        and(gte(videoLogs.date, monthStart), eq(videoLogs.status, "DONE")),
      ),
    db.select().from(videoLogs).orderBy(videoLogs.createdAt),
  ]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekStart = sevenDaysAgo.toISOString().split("T")[0];
  const completedLogs = completedVideoLogs(allLogs);
  const weekLogs = completedLogs.filter((log) => log.date >= weekStart);

  return {
    today: Number(todayCount[0]?.count ?? 0),
    week: weekLogs.length,
    month: Number(monthCount[0]?.count ?? 0),
    total: allLogs.length,
    totalRevisions: completedLogs.reduce(
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
      projectStatus: projects.status,
      projectDeadline: projects.deadline,
      status: videoLogs.status,
      startedAt: videoLogs.startedAt,
      revisionsCount: videoLogs.revisionsCount,
      delivered: videoLogs.delivered,
      deliveryUrl: videoLogs.deliveryUrl,
      notes: videoLogs.notes,
      createdAt: videoLogs.createdAt,
      updatedAt: videoLogs.updatedAt,
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
        status: videoLogs.status,
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

export async function updateVideoMetadata(
  videoId: number,
  values: VideoInputValues,
): Promise<ProductivityActionResult> {
  if (!isPositiveId(videoId)) {
    return { success: false, error: "Invalid video." };
  }
  const parsed = validateVideoInput(values);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  const current = await db
    .select({
      id: videoLogs.id,
      title: videoLogs.title,
      clientId: videoLogs.clientId,
      projectId: videoLogs.projectId,
      deliveryUrl: videoLogs.deliveryUrl,
      notes: videoLogs.notes,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  if (!current[0]) return { success: false, error: "Video not found." };

  const assignment = await resolveVideoAssignment(db, parsed.data, {
    allowArchivedProjectId: current[0].projectId,
  });
  if (!assignment.success) return assignment;

  const next = { ...parsed.data, clientId: assignment.clientId };
  const changedFields = getVideoMetadataChanges(
    {
      title: current[0].title ?? "",
      clientId: current[0].clientId,
      projectId: current[0].projectId,
      deliveryUrl: current[0].deliveryUrl,
      notes: current[0].notes,
    },
    next,
  );
  if (changedFields.length === 0) {
    return { success: true, message: "No changes to save.", changedFields };
  }

  const now = new Date();
  await db
    .update(videoLogs)
    .set({ ...next, updatedAt: now })
    .where(eq(videoLogs.id, videoId));

  await db.insert(crmEvents).values({
    clientId: next.clientId,
    videoId,
    type: "video.updated",
    actor: "admin",
    description: `Video updated: ${next.title} (${changedFields.join(", ")})`,
    createdAt: now,
  });

  revalidateProductivityViews(current[0].clientId, next.clientId);
  return {
    success: true,
    message: "Video details saved.",
    changedFields,
  };
}

export async function transitionVideoStatus(
  videoId: number,
  expectedStatus: VideoStatus,
  targetStatus: VideoStatus,
): Promise<ProductivityActionResult> {
  if (
    !isPositiveId(videoId) ||
    !isVideoStatus(expectedStatus) ||
    !isVideoStatus(targetStatus)
  ) {
    return { success: false, error: "Invalid lifecycle transition." };
  }

  const db = await getAuthenticatedDb();
  const current = await db
    .select({
      id: videoLogs.id,
      title: videoLogs.title,
      clientId: videoLogs.clientId,
      status: videoLogs.status,
      startedAt: videoLogs.startedAt,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  if (!current[0]) return { success: false, error: "Video not found." };

  const transition = planVideoTransition({
    currentStatus: current[0].status,
    expectedStatus,
    targetStatus,
  });
  if (!transition.success) return transition;
  if (!transition.changed) {
    return {
      success: true,
      status: transition.status,
      message: "Video already has that status.",
    };
  }

  const now = new Date();
  const updated = await db
    .update(videoLogs)
    .set({
      status: transition.status,
      delivered: transition.delivered,
      startedAt:
        transition.status === "IN_PROGRESS" && !current[0].startedAt
          ? now
          : current[0].startedAt,
      date: transition.status === "DONE" ? todayISO() : undefined,
      updatedAt: now,
    })
    .where(
      and(
        eq(videoLogs.id, videoId),
        eq(videoLogs.status, current[0].status),
      ),
    )
    .returning({ id: videoLogs.id });
  if (!updated[0]) {
    return {
      success: false,
      error: "This video changed elsewhere. Refresh and try again.",
    };
  }

  const title = current[0].title ?? `Video ${videoId}`;
  await db.insert(crmEvents).values({
    clientId: current[0].clientId,
    videoId,
    type: transition.eventType,
    actor: "admin",
    description: `${title} moved to ${VIDEO_STATUS_LABELS[transition.status]}`,
    createdAt: now,
  });

  revalidateProductivityViews(current[0].clientId);
  return {
    success: true,
    status: transition.status,
    message: `Moved to ${VIDEO_STATUS_LABELS[transition.status]}.`,
  };
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

  const [trackedWork, operationalMemory] = await Promise.all([
    db
      .select({ id: workSessions.id })
      .from(workSessions)
      .where(eq(workSessions.videoId, id))
      .limit(1),
    db
      .select({ id: crmEvents.id })
      .from(crmEvents)
      .where(
        and(
          eq(crmEvents.videoId, id),
          eq(crmEvents.type, VIDEO_OPERATIONAL_NOTE_EVENT_TYPE),
        ),
      )
      .limit(1),
  ]);
  if (trackedWork[0]) {
    return {
      success: false,
      error: "Videos with tracked work cannot be deleted.",
    };
  }
  if (videoOperationalMemoryBlocksDeletion(operationalMemory.length)) {
    return {
      success: false,
      error: VIDEO_OPERATIONAL_MEMORY_DELETE_ERROR,
    };
  }

  await db.delete(videoLogs).where(eq(videoLogs.id, id));
  revalidateProductivityViews(current[0].clientId);
  return { success: true, message: "Video removed." };
}
