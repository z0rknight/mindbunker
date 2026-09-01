"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { videoLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type Result = { success: true; message: string } | { success: false; error: string };

// Wave 4J: "final published URL" reuses the existing canonical
// videoLogs.publishedUrl column (already distinct from deliveryUrl/
// reviewUrl -- see the Monday Real-Operation Pre-Freeze comment on that
// table) rather than adding a new column. This is a narrow, single-field
// setter deliberately separate from the full updateVideoLog validation
// path, matching the same "small single-purpose actions" pattern used
// throughout the Lab (upsertAssetItem, resolveBlocker, etc).
export async function setPublishedUrl(videoId: number, url: string): Promise<Result> {
  const trimmed = url.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    return { success: false, error: "Live URL must start with http:// or https://" };
  }
  const db = await getAuthenticatedDb();
  await db.update(videoLogs).set({ publishedUrl: trimmed || null, updatedAt: new Date() }).where(eq(videoLogs.id, videoId));
  revalidatePath("/lab");
  return { success: true, message: "Live URL saved." };
}
