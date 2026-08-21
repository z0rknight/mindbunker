"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clients, crmEvents, projects, videoLogs } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isPositiveId, validateProjectInput } from "./core";

type ProjectActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

function revalidateProjectViews(clientId: number) {
  revalidatePath("/");
  revalidatePath("/crm");
  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/productivity");
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
        revisionsCount: videoLogs.revisionsCount,
        delivered: videoLogs.delivered,
      })
      .from(videoLogs)
      .where(eq(videoLogs.clientId, clientId))
      .orderBy(desc(videoLogs.createdAt), desc(videoLogs.id)),
  ]);

  return projectRows.map((project) => ({
    ...project,
    videos: videoRows.filter((video) => video.projectId === project.id),
  }));
}

export async function createProject(
  clientId: number,
  input: {
    name: string;
    status: string;
    deadline?: string;
    notes?: string;
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
  await db.batch([
    db.insert(projects).values({
      clientId,
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    }),
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

  revalidateProjectViews(clientId);
  return { success: true, message: "Project created." };
}

export async function updateProject(
  projectId: number,
  input: {
    name: string;
    status: string;
    deadline?: string;
    notes?: string;
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
