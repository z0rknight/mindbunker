"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { deliveries, commitments, videoLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { validateDeliveryUrl } from "@/modules/productivity/core";

type Result = { success: true; message: string } | { success: false; error: string };

// Post-Job Commercial + Delivery Sniper §10 root-cause fix: this Lab
// "Deliver Video" flow wrote ONLY to the deliveries audit table (its own
// versioned log, distinct on purpose -- redelivery history), never to
// video_logs.delivery_url, which is the ONE field the client portal
// actually reads (see toCard in modules/client-portal/core.ts and
// primaryLink in VideoCard.tsx / the video detail page). An operator
// using this flow believed a video was "delivered" -- the deliveries log
// even shows it -- while the client dashboard silently kept showing no
// link at all. This now syncs the same URL into the canonical field
// (through the same HTTPS-only validateDeliveryUrl every other write path
// uses) whenever one is given, in addition to (not instead of) the
// existing audit-log insert.
export async function recordDelivery(input: {
  videoId: number;
  deliveryUrl?: string | null;
  note?: string | null;
  commitmentId?: number | null;
}): Promise<Result> {
  if (!Number.isInteger(input.videoId) || input.videoId <= 0) return { success: false, error: "Invalid video." };

  const rawUrl = input.deliveryUrl?.trim() || null;
  let canonicalSyncWarning: string | null = null;
  let validatedUrl: string | null = null;
  if (rawUrl) {
    const validated = validateDeliveryUrl(rawUrl);
    if (validated.success) {
      validatedUrl = validated.value;
    } else {
      // Still record the audit entry below (this log is operator-facing,
      // not client-facing), but be explicit that the client-facing field
      // was NOT updated -- never silently drop the client's visibility.
      canonicalSyncWarning = `Note: "${rawUrl}" is not a valid HTTPS URL, so the client-facing delivery link was NOT updated (${validated.error})`;
    }
  }

  const db = await getAuthenticatedDb();

  const prior = await db.select({ version: deliveries.version }).from(deliveries).where(eq(deliveries.videoId, input.videoId)).orderBy(desc(deliveries.version)).limit(1);
  const nextVersion = (prior[0]?.version ?? 0) + 1;

  await db.insert(deliveries).values({
    videoId: input.videoId,
    commitmentId: input.commitmentId ?? null,
    version: nextVersion,
    deliveryUrl: rawUrl,
    note: input.note?.trim() || null,
    status: nextVersion > 1 ? "REDELIVERED" : "DELIVERED",
    actor: "admin",
  });

  if (validatedUrl) {
    await db
      .update(videoLogs)
      .set({ deliveryUrl: validatedUrl, updatedAt: new Date() })
      .where(eq(videoLogs.id, input.videoId));
  }

  if (input.commitmentId) {
    await db.update(commitments).set({ status: "DONE", completedAt: new Date() }).where(eq(commitments.id, input.commitmentId));
  }

  revalidatePath("/lab");
  revalidatePath("/productivity");
  revalidatePath("/client/dashboard");

  return {
    success: true,
    message: canonicalSyncWarning
      ? `Delivery v${nextVersion} recorded. ${canonicalSyncWarning}`
      : `Delivery v${nextVersion} recorded.`,
  };
}

export async function listDeliveriesForVideo(videoId: number) {
  const db = await getAuthenticatedDb();
  return db.select().from(deliveries).where(eq(deliveries.videoId, videoId)).orderBy(desc(deliveries.version));
}
