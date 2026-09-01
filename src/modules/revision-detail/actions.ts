"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { revisions } from "@/db/schema";
import { sql } from "drizzle-orm";
import { changeRevisionCount } from "@/modules/productivity/actions";

type Result = { success: true; message: string } | { success: false; error: string };

// Wave 4I: concise revision detail, layered on top of the existing
// canonical write path (changeRevisionCount) rather than duplicating it.
// The insert itself is still the one shared production action every
// quick-action button also uses; this only attaches category/minutesRework/
// note to the row it just created, via the same "most recent row for this
// video" lookup changeRevisionCount's own undo path already uses.
export async function recordRevisionDetail(
  videoId: number,
  causedBy: "UNKNOWN" | "OUR_ERROR" | "CLIENT_CHANGE" | "SCOPE_CHANGE",
  note: string,
  category?: string,
  minutesRework?: number,
): Promise<Result> {
  const created = await changeRevisionCount(videoId, 1, causedBy);
  if (!created.success) return { success: false, error: created.error ?? "Could not record revision." };

  const db = await getAuthenticatedDb();
  await db
    .update(revisions)
    .set({ note: note.trim() || null, category: category?.trim() || null, minutesRework: minutesRework ?? null })
    .where(sql`${revisions.id} = (select id from revisions where video_id = ${videoId} order by created_at desc, id desc limit 1)`);

  return { success: true, message: "Revision recorded with detail." };
}
