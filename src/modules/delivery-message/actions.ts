"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clients, videoLogs, workSessions } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { getCommercialTermsForVideo } from "@/modules/quotes/actions";
import { validateDeliveryUrl } from "@/modules/productivity/core";
import { VIDEO_CONTENT_TYPE_LABELS } from "@/modules/productivity/config";
import { WORK_SESSION_ACTIVITY_LABELS, type WorkSessionActivityType } from "@/modules/work-sessions/core";
import type { DeliveryMessagePayload } from "./core";

function isPositiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

// Post-Job Commercial + Delivery Sniper §11: assembles the delivery
// message payload from ONLY client-safe, deterministic facts -- reuses
// getCommercialTermsForVideo (the canonical commercial engine, §2) for
// the money line, and the same HTTPS-only validateDeliveryUrl every
// client-facing surface already re-validates through, so this can never
// surface an internal/non-HTTPS URL the client dashboard itself would
// have rejected.
export async function getDeliveryMessagePayload(
  videoId: number,
): Promise<DeliveryMessagePayload | null> {
  if (!isPositiveId(videoId)) return null;
  const db = await getAuthenticatedDb();

  const rows = await db
    .select({
      title: videoLogs.title,
      date: videoLogs.date,
      clientId: videoLogs.clientId,
      clientName: clients.name,
      contentType: videoLogs.contentType,
      startedAt: videoLogs.startedAt,
      revisionsCount: videoLogs.revisionsCount,
      deliveryUrl: videoLogs.deliveryUrl,
      reviewUrl: videoLogs.reviewUrl,
      publishedUrl: videoLogs.publishedUrl,
    })
    .from(videoLogs)
    .leftJoin(clients, eq(videoLogs.clientId, clients.id))
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  const video = rows[0];
  if (!video) return null;

  const activityRows = await db
    .selectDistinct({ activityType: workSessions.activityType })
    .from(workSessions)
    .where(and(eq(workSessions.videoId, videoId), isNotNull(workSessions.endedAt)));
  const workDone = activityRows.map(
    (row) => WORK_SESSION_ACTIVITY_LABELS[row.activityType as WorkSessionActivityType] ?? row.activityType,
  );

  const deliverables: DeliveryMessagePayload["deliverables"] = [];
  const review = validateDeliveryUrl(video.reviewUrl);
  if (review.success && review.value) {
    deliverables.push({ label: "Review link", url: review.value });
  }
  const published = validateDeliveryUrl(video.publishedUrl);
  if (published.success && published.value) {
    deliverables.push({ label: "Published", url: published.value });
  }
  const delivery = validateDeliveryUrl(video.deliveryUrl);
  if (delivery.success && delivery.value) {
    deliverables.push({ label: "Files", url: delivery.value });
  }

  // Turnaround: only when startedAt is a real recorded fact -- days
  // between that and "now" (message generation time). Never a guess when
  // startedAt is null.
  let turnaroundDays: number | null = null;
  if (video.startedAt instanceof Date && !Number.isNaN(video.startedAt.getTime())) {
    const ms = Date.now() - video.startedAt.getTime();
    turnaroundDays = Math.max(0, Math.round(ms / 86_400_000));
  }

  const terms = await getCommercialTermsForVideo(videoId);
  const estimatedAccrued =
    terms.billingModel === "HOURLY" && terms.trackedSeconds > 0
      ? { amount: terms.estimatedAccruedValue, currency: terms.currency }
      : null;
  const agreedAmount =
    terms.billingModel === "FIXED" ? { amountCents: terms.agreedPriceCents, currency: terms.currency } : null;

  return {
    clientName: video.clientName ?? "there",
    videoTitle: video.title?.trim() || `Video ${video.date}`,
    contentTypeLabel: video.contentType ? VIDEO_CONTENT_TYPE_LABELS[video.contentType] : null,
    turnaroundDays,
    workDone,
    deliverables,
    estimatedAccrued,
    agreedAmount,
    revisionsCount: video.revisionsCount,
  };
}
