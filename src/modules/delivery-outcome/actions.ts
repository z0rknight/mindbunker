"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { videoLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { validateDeliveryUrl } from "@/modules/productivity/core";

type Result = { success: true; message: string } | { success: false; error: string };

// Wave 4J: "final published URL" reuses the existing canonical
// videoLogs.publishedUrl column (already distinct from deliveryUrl/
// reviewUrl -- see the Monday Real-Operation Pre-Freeze comment on that
// table) rather than adding a new column. This is a narrow, single-field
// setter deliberately separate from the full updateVideoLog validation
// path, matching the same "small single-purpose actions" pattern used
// throughout the Lab (upsertAssetItem, resolveBlocker, etc).
//
// Post-Job Commercial + Delivery Sniper §10 root-cause fix: this used to
// accept any http:// OR https:// URL with its own looser regex, while
// every read path (toCard in modules/client-portal/core.ts) re-validates
// publishedUrl through validateDeliveryUrl, which is HTTPS-only. A plain
// http:// URL saved here would pass THIS write, show up if the operator
// reopened the Lab panel (so it looked "on file"), and then be silently
// nulled out on every client-facing card/detail page -- the exact
// diary-reported bug ("client can't open it even when the link exists").
// Reusing the one canonical validator everywhere closes that gap for good
// instead of just tightening this one call site.
export async function setPublishedUrl(videoId: number, url: string): Promise<Result> {
  const validated = validateDeliveryUrl(url);
  if (!validated.success) {
    return { success: false, error: validated.error };
  }
  const db = await getAuthenticatedDb();
  await db
    .update(videoLogs)
    .set({ publishedUrl: validated.value, updatedAt: new Date() })
    .where(eq(videoLogs.id, videoId));
  revalidatePath("/lab");
  revalidatePath("/productivity");
  revalidatePath("/client/dashboard");
  return { success: true, message: "Live URL saved." };
}
