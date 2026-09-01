"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { projects, videoLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { serializeTagList, parseTagsOverride, type TagsOverride } from "./core";

type Result = { success: true; message: string } | { success: false; error: string };

export async function setProjectTags(projectId: number, tags: string[]): Promise<Result> {
  const db = await getAuthenticatedDb();
  await db.update(projects).set({ tags: serializeTagList(tags) || null, updatedAt: new Date() }).where(eq(projects.id, projectId));
  revalidatePath("/lab");
  return { success: true, message: "Project tags saved." };
}

async function updateOverride(videoId: number, mutate: (o: TagsOverride) => TagsOverride): Promise<Result> {
  const db = await getAuthenticatedDb();
  const row = await db.select({ tagsOverride: videoLogs.tagsOverride }).from(videoLogs).where(eq(videoLogs.id, videoId)).limit(1);
  if (!row[0]) return { success: false, error: "Video not found." };
  const next = mutate(parseTagsOverride(row[0].tagsOverride));
  await db.update(videoLogs).set({ tagsOverride: JSON.stringify(next), updatedAt: new Date() }).where(eq(videoLogs.id, videoId));
  revalidatePath("/lab");
  return { success: true, message: "Saved." };
}

export async function addVideoLocalTag(videoId: number, tag: string): Promise<Result> {
  if (!tag.trim()) return { success: false, error: "Tag cannot be empty." };
  return updateOverride(videoId, (o) => ({
    added: [...o.added.filter((t) => t.toLowerCase() !== tag.toLowerCase()), tag.trim()],
    removed: o.removed.filter((t) => t.toLowerCase() !== tag.toLowerCase()),
  }));
}

export async function removeVideoTag(videoId: number, tag: string): Promise<Result> {
  return updateOverride(videoId, (o) => ({
    added: o.added.filter((t) => t.toLowerCase() !== tag.toLowerCase()),
    removed: [...o.removed.filter((t) => t.toLowerCase() !== tag.toLowerCase()), tag.trim()],
  }));
}
