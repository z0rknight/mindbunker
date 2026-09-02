"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clients, crmEvents, projects, videoLogs } from "@/db/schema";
import { desc, eq, ne, sql } from "drizzle-orm";
import { getLastActiveByProject } from "../work-sessions/data";
import { revalidatePath } from "next/cache";
import {
  isPositiveId,
  sortProjectWorkspaceVideos,
  validateProjectInput,
} from "./core";

type ProjectActionResult =
  | { success: true; message?: string; projectId?: number }
  | { success: false; error: string };

function revalidateProjectViews(clientId: number) {
  revalidatePath("/");
  revalidatePath("/crm");
  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/projects");
  revalidatePath("/productivity");
}

export async function getProjectWorkspace(projectId: number) {
  if (!isPositiveId(projectId)) return null;
  const db = await getAuthenticatedDb();
  const projectRows = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      clientName: clients.name,
      // Sprint 3 P1: cover fallback chain tier 3 -- see
      // modules/media/core.ts.
      clientAvatarUrl: clients.instagramProfilePictureUrl,
      name: projects.name,
      status: projects.status,
      deadline: projects.deadline,
      notes: projects.notes,
      coverUrl: projects.coverUrl,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!projectRows[0]) return null;

  const videos = await db
    .select({
      id: videoLogs.id,
      title: videoLogs.title,
      date: videoLogs.date,
      status: videoLogs.status,
      revisionsCount: videoLogs.revisionsCount,
      deliveryUrl: videoLogs.deliveryUrl,
      reviewUrl: videoLogs.reviewUrl,
      publishedUrl: videoLogs.publishedUrl,
      coverUrl: videoLogs.coverUrl,
      orientation: videoLogs.orientation,
      videoKind: videoLogs.videoKind,
      batchLabel: videoLogs.batchLabel,
      // Quick Morning Reality Patch §4/§7: read-only here (priority is
      // client-settable, see PriorityToggle) -- the operator command-card
      // view just needs to display the same canonical state the client
      // sees, never a second copy of it.
      isPriority: videoLogs.isPriority,
      createdAt: videoLogs.createdAt,
      updatedAt: videoLogs.updatedAt,
    })
    .from(videoLogs)
    .where(eq(videoLogs.projectId, projectId))
    .orderBy(desc(videoLogs.updatedAt), desc(videoLogs.createdAt), desc(videoLogs.id));

  // Brief C §9: deterministic ordering (batch label, then historical date,
  // then natural numeric-aware name order) replaces the previous
  // updatedAt-based order, which made bulk-generated batches appear in a
  // confusing sequence.
  return { ...projectRows[0], videos: sortProjectWorkspaceVideos(videos) };
}

function derivedProjectCount(clientId: number) {
  return sql<number>`(
    select count(*) from ${projects}
    where ${projects.clientId} = ${clientId}
  )`;
}

export async function getProjectsForClient(clientId: number) {
  if (!isPositiveId(clientId)) return [];
  const db = await getAuthenticatedDb();
  const [projectRows, videoRows] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(eq(projects.clientId, clientId))
      .orderBy(desc(projects.updatedAt), desc(projects.id)),
    db
      .select({
        id: videoLogs.id,
        projectId: videoLogs.projectId,
        title: videoLogs.title,
        date: videoLogs.date,
        status: videoLogs.status,
        revisionsCount: videoLogs.revisionsCount,
        delivered: videoLogs.delivered,
        coverUrl: videoLogs.coverUrl,
        // Lunch Reality Patch P1 §7: client-settable "priority now" video,
        // reflected read-only here for the operator.
        isPriority: videoLogs.isPriority,
      })
      .from(videoLogs)
      .where(eq(videoLogs.clientId, clientId))
      .orderBy(desc(videoLogs.createdAt), desc(videoLogs.id)),
  ]);

  return projectRows.map((project) => ({
    ...project,
    // Priority video floats to the front (stable sort -- otherwise
    // preserves the existing most-recent-first order) so it's always
    // visible in ProjectManager's slice(0, 6) preview, never pushed off
    // by newer non-priority videos.
    videos: videoRows
      .filter((video) => video.projectId === project.id)
      .sort((a, b) => Number(b.isPriority) - Number(a.isPriority)),
  }));
}

export async function getProjectsOverview() {
  const db = await getAuthenticatedDb();
  const [rows, lastActiveByProject] = await Promise.all([
    db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      clientName: clients.name,
      clientAvatarUrl: clients.instagramProfilePictureUrl,
      name: projects.name,
      status: projects.status,
      deadline: projects.deadline,
      notes: projects.notes,
      coverUrl: projects.coverUrl,
      updatedAt: projects.updatedAt,
      totalVideos: sql<number>`count(${videoLogs.id})`,
      doneVideos: sql<number>`coalesce(sum(case when ${videoLogs.status} = 'DONE' and ${videoLogs.videoKind} = 'CLIENT_WORK' then 1 else 0 end), 0)`,
      inFlightVideos: sql<number>`coalesce(sum(case when ${videoLogs.status} in ('IN_PROGRESS', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED') then 1 else 0 end), 0)`,
      plannedVideos: sql<number>`coalesce(sum(case when ${videoLogs.status} = 'PLANNED' then 1 else 0 end), 0)`,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(videoLogs, eq(videoLogs.projectId, projects.id))
    // Geladeira (Sprint 1.2 P0): the Projects overview is a P0 visibility
    // surface — a Geladeira client's Projects are hidden here by default.
    // Direct navigation to /projects/[id] (getProjectWorkspace, below) is
    // untouched and always works regardless of archival state.
    .where(ne(clients.archivalState, "GELADEIRA"))
    .groupBy(projects.id, clients.id)
    .orderBy(desc(projects.updatedAt), desc(projects.id)),
    getLastActiveByProject(),
  ]);

  return rows.map((row) => ({
    ...row,
    totalVideos: Number(row.totalVideos),
    doneVideos: Number(row.doneVideos),
    inFlightVideos: Number(row.inFlightVideos),
    plannedVideos: Number(row.plannedVideos),
    // MICRO PATCH §2: derived from explicit attributable Work Sessions
    // only, unbounded lookback (a project touched 40+ days ago must still
    // report its real date) -- never a persisted counter.
    lastActiveAt: lastActiveByProject.get(row.id) ?? null,
  }));
}

export async function createProject(
  clientId: number,
  input: {
    name: string;
    status: string;
    deadline?: string;
    notes?: string;
    coverUrl?: string;
  },
): Promise<ProjectActionResult> {
  if (!isPositiveId(clientId)) {
    return { success: false, error: "Invalid client." };
  }
  const parsed = validateProjectInput(input);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  const owner = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!owner[0]) return { success: false, error: "Client not found." };

  const now = new Date();
  const [inserted] = await db.batch([
    db
      .insert(projects)
      .values({
        clientId,
        ...parsed.data,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: projects.id }),
    db
      .update(clients)
      .set({ totalProjects: derivedProjectCount(clientId) })
      .where(eq(clients.id, clientId)),
    db.insert(crmEvents).values({
      clientId,
      type: "project_created",
      actor: "admin",
      description: `Project created: ${parsed.data.name}`,
    }),
  ]);
  const projectId = inserted[0]?.id;
  if (!projectId) {
    return { success: false, error: "Project could not be created." };
  }
  revalidateProjectViews(clientId);
  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: "Project created.", projectId };
}

export async function updateProject(
  projectId: number,
  input: {
    name: string;
    status: string;
    deadline?: string;
    notes?: string;
    coverUrl?: string;
  },
): Promise<ProjectActionResult> {
  if (!isPositiveId(projectId)) {
    return { success: false, error: "Invalid project." };
  }
  const parsed = validateProjectInput(input);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  const current = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      status: projects.status,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!current[0]) return { success: false, error: "Project not found." };

  const projectUpdate = db
    .update(projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  if (current[0].status !== parsed.data.status) {
    await db.batch([
      projectUpdate,
      db.insert(crmEvents).values({
        clientId: current[0].clientId,
        type: "project_status_changed",
        actor: "admin",
        description: `${parsed.data.name} moved to ${parsed.data.status}`,
      }),
    ]);
  } else {
    await projectUpdate;
  }

  revalidateProjectViews(current[0].clientId);
  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: "Project saved." };
}

export async function deleteProject(
  projectId: number,
): Promise<ProjectActionResult> {
  if (!isPositiveId(projectId)) {
    return { success: false, error: "Invalid project." };
  }
  const db = await getAuthenticatedDb();
  const current = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      name: projects.name,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!current[0]) return { success: false, error: "Project not found." };

  await db.batch([
    db.delete(projects).where(eq(projects.id, projectId)),
    db
      .update(clients)
      .set({ totalProjects: derivedProjectCount(current[0].clientId) })
      .where(eq(clients.id, current[0].clientId)),
    db.insert(crmEvents).values({
      clientId: current[0].clientId,
      type: "project_deleted",
      actor: "admin",
      description: `Project deleted: ${current[0].name}`,
    }),
  ]);

  revalidateProjectViews(current[0].clientId);
  return { success: true, message: "Project deleted. Its videos were kept." };
}
