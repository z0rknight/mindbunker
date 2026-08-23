"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { crmEvents, videoLogs } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  VIDEO_OPERATIONAL_NOTE_EVENT_TYPE,
  isVideoMemoryVideoId,
  validateVideoOperationalNote,
  type VideoOperationalMemoryEntry,
} from "./core";

type VideoMemoryResult =
  | { success: true; entries: VideoOperationalMemoryEntry[] }
  | { success: false; error: string };

type AddVideoMemoryResult =
  | { success: true; entry: VideoOperationalMemoryEntry }
  | { success: false; error: string };

async function findVideo(videoId: number) {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ id: videoLogs.id })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getVideoOperationalMemory(
  videoId: number,
): Promise<VideoMemoryResult> {
  if (!isVideoMemoryVideoId(videoId)) {
    return { success: false, error: "Invalid video." };
  }
  if (!(await findVideo(videoId))) {
    return { success: false, error: "Video not found." };
  }

  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: crmEvents.id,
      body: crmEvents.description,
      createdAt: crmEvents.createdAt,
    })
    .from(crmEvents)
    .where(
      and(
        eq(crmEvents.videoId, videoId),
        eq(crmEvents.type, VIDEO_OPERATIONAL_NOTE_EVENT_TYPE),
      ),
    )
    .orderBy(desc(crmEvents.createdAt), desc(crmEvents.id));

  return {
    success: true,
    entries: rows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: (row.createdAt ?? new Date(0)).toISOString(),
    })),
  };
}

// Session Narrative (Sunday Systems Round, Phase B/C): batch read across
// many videos at once, for correlating with a page of Work Session
// history without an N+1 query per session row. Read-only and additive —
// getVideoOperationalMemory() above (the Video Memory panel own data
// path) is unchanged.
export type VideoOperationalMemoryEntryWithVideo = VideoOperationalMemoryEntry & {
  videoId: number;
};

export async function getVideoOperationalMemoryForVideos(
  videoIds: readonly number[],
): Promise<VideoOperationalMemoryEntryWithVideo[]> {
  const uniqueIds = [...new Set(videoIds)].filter(isVideoMemoryVideoId);
  if (uniqueIds.length === 0) return [];

  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: crmEvents.id,
      videoId: crmEvents.videoId,
      body: crmEvents.description,
      createdAt: crmEvents.createdAt,
    })
    .from(crmEvents)
    .where(
      and(
        inArray(crmEvents.videoId, uniqueIds),
        eq(crmEvents.type, VIDEO_OPERATIONAL_NOTE_EVENT_TYPE),
      ),
    )
    .orderBy(desc(crmEvents.createdAt), desc(crmEvents.id));

  return rows
    .filter((row): row is typeof row & { videoId: number } => row.videoId !== null)
    .map((row) => ({
      id: row.id,
      videoId: row.videoId,
      body: row.body,
      createdAt: (row.createdAt ?? new Date(0)).toISOString(),
    }));
}

export async function addVideoOperationalNote(
  videoId: number,
  value: string,
): Promise<AddVideoMemoryResult> {
  if (!isVideoMemoryVideoId(videoId)) {
    return { success: false, error: "Invalid video." };
  }
  const parsed = validateVideoOperationalNote(value);
  if (!parsed.success) return parsed;
  if (!(await findVideo(videoId))) {
    return { success: false, error: "Video not found." };
  }

  const db = await getAuthenticatedDb();
  const createdAt = new Date();
  const inserted = await db
    .insert(crmEvents)
    .values({
      clientId: null,
      videoId,
      type: VIDEO_OPERATIONAL_NOTE_EVENT_TYPE,
      actor: "admin",
      description: parsed.body,
      createdAt,
    })
    .returning({ id: crmEvents.id });
  const id = inserted[0]?.id;
  if (!id) {
    return { success: false, error: "The note could not be saved." };
  }

  revalidatePath("/productivity");
  return {
    success: true,
    entry: { id, body: parsed.body, createdAt: createdAt.toISOString() },
  };
}
