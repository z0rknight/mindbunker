"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  blockers,
  commitments,
  deliveries,
  frictionEvents,
  productionChecklistItems,
  revisions,
  videoLogs,
  workSessions,
} from "@/db/schema";
import { validateDeliveryUrl } from "@/modules/productivity/core";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
  BlockerCategory,
  ChecklistStatus,
  FrictionCategory,
  ProductionStep,
  RevisionCategory,
  RevisionCause,
} from "./config";
import {
  cleanOptionalText,
  cleanRequiredText,
  computeChecklistProgress,
  computePromiseAccuracy,
  commitmentChronologyIssue,
  isBlockerCategory,
  isChecklistStatus,
  isFrictionCategory,
  isPositiveId,
  isProductionStep,
  isRevisionCategory,
  isRevisionCause,
  parseOptionalDueAt,
  parseOptionalNonNegativeMinutes,
} from "./core";

type Result =
  | { success: true; message: string }
  | { success: false; error: string };

function revalidateVideoOperations(videoId: number) {
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/productivity");
  revalidatePath(`/productivity?video=${videoId}`);
}

async function getVideoContext(videoId: number) {
  if (!isPositiveId(videoId)) return null;
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: videoLogs.id,
      title: videoLogs.title,
      status: videoLogs.status,
      clientId: videoLogs.clientId,
      projectId: videoLogs.projectId,
      deliveryUrl: videoLogs.deliveryUrl,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getVideoOperationalSnapshot(videoId: number) {
  const video = await getVideoContext(videoId);
  if (!video) return { success: false as const, error: "Video not found." };
  const db = await getAuthenticatedDb();

  const [commitmentRows, frictionRows, blockerRows, deliveryRows, checklistRows, revisionRows, workRows] =
    await Promise.all([
      db.select().from(commitments).where(eq(commitments.videoId, videoId)).orderBy(asc(commitments.dueAt), desc(commitments.createdAt)),
      db.select().from(frictionEvents).where(eq(frictionEvents.videoId, videoId)).orderBy(desc(frictionEvents.createdAt)).limit(20),
      db.select().from(blockers).where(eq(blockers.videoId, videoId)).orderBy(desc(blockers.startedAt)),
      db.select().from(deliveries).where(eq(deliveries.videoId, videoId)).orderBy(desc(deliveries.version)),
      db.select().from(productionChecklistItems).where(eq(productionChecklistItems.videoId, videoId)),
      db.select().from(revisions).where(eq(revisions.videoId, videoId)).orderBy(desc(revisions.createdAt)).limit(20),
      db
        .select({
          sessionCount: sql<number>`count(*)`,
          closedSeconds: sql<number>`coalesce(sum(${workSessions.endedAt} - ${workSessions.startedAt}), 0)`,
        })
        .from(workSessions)
        .where(and(eq(workSessions.videoId, videoId), isNotNull(workSessions.endedAt))),
    ]);

  const commitmentById = new Map(commitmentRows.map((row) => [row.id, row]));
  const accuracy = computePromiseAccuracy(
    deliveryRows.map((delivery) => ({
      dueAt: delivery.commitmentId
        ? commitmentById.get(delivery.commitmentId)?.dueAt ?? null
        : null,
      deliveredAt: delivery.deliveredAt,
    })),
  );

  return {
    success: true as const,
    data: {
      video,
      commitments: commitmentRows,
      friction: frictionRows,
      blockers: blockerRows,
      deliveries: deliveryRows,
      checklist: checklistRows,
      revisions: revisionRows,
      checklistProgress: computeChecklistProgress(checklistRows),
      promiseAccuracy: accuracy,
      work: {
        sessionCount: Number(workRows[0]?.sessionCount ?? 0),
        closedSeconds: Number(workRows[0]?.closedSeconds ?? 0),
      },
    },
  };
}

export async function createVideoCommitment(input: {
  videoId: number;
  title: unknown;
  dueAt?: unknown;
}): Promise<Result> {
  if (!(await getVideoContext(input.videoId))) return { success: false, error: "Video not found." };
  const title = cleanRequiredText(input.title, "Commitment", 300);
  if (!title.success) return title;
  const dueAt = parseOptionalDueAt(input.dueAt);
  if (dueAt === false) return { success: false, error: "Enter a valid due date with an explicit timezone." };
  if (dueAt === null) return { success: false, error: "Due date is required." };
  const createdAt = new Date();
  if (commitmentChronologyIssue({ createdAt, dueAt })) {
    return { success: false, error: "Due date cannot be before the promise was created." };
  }

  const db = await getAuthenticatedDb();
  await db.insert(commitments).values({
    videoId: input.videoId,
    title: title.value,
    dueAt,
    createdAt,
  });
  revalidateVideoOperations(input.videoId);
  return { success: true, message: "Commitment recorded." };
}

export async function updateVideoCommitmentDue(
  videoId: number,
  commitmentId: number,
  dueAtInput: unknown,
): Promise<Result> {
  if (!isPositiveId(videoId) || !isPositiveId(commitmentId)) {
    return { success: false, error: "Invalid commitment." };
  }
  const dueAt = parseOptionalDueAt(dueAtInput);
  if (dueAt === false) {
    return { success: false, error: "Enter a valid due date with an explicit timezone." };
  }
  if (dueAt === null) return { success: false, error: "Due date is required." };

  const db = await getAuthenticatedDb();
  const current = await db
    .select({ id: commitments.id, createdAt: commitments.createdAt })
    .from(commitments)
    .where(
      and(
        eq(commitments.id, commitmentId),
        eq(commitments.videoId, videoId),
        eq(commitments.status, "OPEN"),
      ),
    )
    .limit(1);
  if (!current[0]) return { success: false, error: "Open commitment not found." };
  if (commitmentChronologyIssue({ createdAt: current[0].createdAt, dueAt })) {
    return { success: false, error: "Due date cannot be before the promise was created." };
  }

  await db
    .update(commitments)
    .set({ dueAt })
    .where(
      and(
        eq(commitments.id, commitmentId),
        eq(commitments.videoId, videoId),
        eq(commitments.status, "OPEN"),
      ),
    );
  revalidateVideoOperations(videoId);
  return { success: true, message: "Commitment deadline corrected." };
}

export async function setCommitmentStatus(
  videoId: number,
  commitmentId: number,
  target: "DONE" | "CANCELLED",
): Promise<Result> {
  if (!isPositiveId(videoId) || !isPositiveId(commitmentId)) {
    return { success: false, error: "Invalid commitment." };
  }
  const db = await getAuthenticatedDb();
  const updated = await db
    .update(commitments)
    .set({ status: target, completedAt: target === "DONE" ? new Date() : null })
    .where(and(eq(commitments.id, commitmentId), eq(commitments.videoId, videoId), eq(commitments.status, "OPEN")))
    .returning({ id: commitments.id });
  if (!updated[0]) return { success: false, error: "Open commitment not found." };
  revalidateVideoOperations(videoId);
  return { success: true, message: target === "DONE" ? "Commitment completed." : "Commitment cancelled." };
}

export async function logVideoFriction(input: {
  videoId: number;
  category: unknown;
  minutesLost?: unknown;
  note?: unknown;
  workSessionId?: number | null;
}): Promise<Result> {
  if (!(await getVideoContext(input.videoId))) return { success: false, error: "Video not found." };
  if (!isFrictionCategory(input.category)) return { success: false, error: "Invalid friction category." };
  const minutesLost = parseOptionalNonNegativeMinutes(input.minutesLost);
  if (minutesLost === false) return { success: false, error: "Minutes lost must be between 0 and 10,080." };
  const note = cleanOptionalText(input.note, 1_000);
  if (note === false) return { success: false, error: "Friction note is too long." };

  const db = await getAuthenticatedDb();
  let workSessionId: number | null = null;
  if (input.workSessionId != null) {
    if (!isPositiveId(input.workSessionId)) return { success: false, error: "Invalid work session." };
    const session = await db
      .select({ id: workSessions.id })
      .from(workSessions)
      .where(and(eq(workSessions.id, input.workSessionId), eq(workSessions.videoId, input.videoId)))
      .limit(1);
    if (!session[0]) return { success: false, error: "Work session does not belong to this video." };
    workSessionId = input.workSessionId;
  }
  await db.insert(frictionEvents).values({
    videoId: input.videoId,
    workSessionId,
    category: input.category,
    minutesLost,
    note,
  });
  revalidateVideoOperations(input.videoId);
  return { success: true, message: "Friction recorded." };
}

export async function openVideoBlocker(input: {
  videoId: number;
  category: unknown;
  note?: unknown;
}): Promise<Result> {
  if (!(await getVideoContext(input.videoId))) return { success: false, error: "Video not found." };
  if (!isBlockerCategory(input.category)) return { success: false, error: "Invalid blocker category." };
  const note = cleanOptionalText(input.note, 1_000);
  if (note === false) return { success: false, error: "Blocker note is too long." };
  const db = await getAuthenticatedDb();
  await db.insert(blockers).values({ videoId: input.videoId, category: input.category, note });
  revalidateVideoOperations(input.videoId);
  return { success: true, message: "Blocker opened." };
}

export async function resolveVideoBlocker(videoId: number, blockerId: number): Promise<Result> {
  if (!isPositiveId(videoId) || !isPositiveId(blockerId)) return { success: false, error: "Invalid blocker." };
  const db = await getAuthenticatedDb();
  const updated = await db
    .update(blockers)
    .set({ resolvedAt: new Date() })
    .where(and(eq(blockers.id, blockerId), eq(blockers.videoId, videoId), sql`${blockers.resolvedAt} is null`))
    .returning({ id: blockers.id });
  if (!updated[0]) return { success: false, error: "Open blocker not found." };
  revalidateVideoOperations(videoId);
  return { success: true, message: "Blocker resolved." };
}

export async function setProductionChecklistStep(
  videoId: number,
  step: unknown,
  status: unknown,
): Promise<Result> {
  if (!(await getVideoContext(videoId))) return { success: false, error: "Video not found." };
  if (!isProductionStep(step) || !isChecklistStatus(status)) {
    return { success: false, error: "Invalid checklist value." };
  }
  const db = await getAuthenticatedDb();
  await db
    .insert(productionChecklistItems)
    .values({ videoId, step, status, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [productionChecklistItems.videoId, productionChecklistItems.step],
      set: { status, updatedAt: new Date() },
    });
  revalidateVideoOperations(videoId);
  return { success: true, message: "Checklist updated." };
}

export async function recordDetailedRevision(input: {
  videoId: number;
  causedBy: unknown;
  category?: unknown;
  minutesRework?: unknown;
  note?: unknown;
}): Promise<Result> {
  const video = await getVideoContext(input.videoId);
  if (!video) return { success: false, error: "Video not found." };
  if (!isRevisionCause(input.causedBy)) return { success: false, error: "Invalid revision cause." };
  if (input.category != null && input.category !== "" && !isRevisionCategory(input.category)) {
    return { success: false, error: "Invalid revision category." };
  }
  const category = (input.category || null) as RevisionCategory | null;
  const minutesRework = parseOptionalNonNegativeMinutes(input.minutesRework);
  if (minutesRework === false) return { success: false, error: "Rework minutes must be between 0 and 10,080." };
  const note = cleanOptionalText(input.note, 1_000);
  if (note === false) return { success: false, error: "Revision note is too long." };
  const db = await getAuthenticatedDb();
  await db.batch([
    db.insert(revisions).values({
      videoId: input.videoId,
      actor: "admin",
      causedBy: input.causedBy,
      category,
      minutesRework,
      note,
    }),
    db
      .update(videoLogs)
      .set({ revisionsCount: sql`${videoLogs.revisionsCount} + 1`, updatedAt: new Date() })
      .where(eq(videoLogs.id, input.videoId)),
  ]);
  revalidateVideoOperations(input.videoId);
  return { success: true, message: "Revision recorded." };
}

export async function recordVideoDelivery(input: {
  videoId: number;
  deliveryUrl?: unknown;
  note?: unknown;
  commitmentId?: number | null;
}): Promise<Result> {
  const video = await getVideoContext(input.videoId);
  if (!video) return { success: false, error: "Video not found." };
  const validatedUrl = validateDeliveryUrl(input.deliveryUrl);
  if (!validatedUrl.success) return { success: false, error: validatedUrl.error };
  const note = cleanOptionalText(input.note, 1_000);
  if (note === false) return { success: false, error: "Delivery note is too long." };

  const db = await getAuthenticatedDb();
  let commitmentId: number | null = null;
  if (input.commitmentId != null) {
    if (!isPositiveId(input.commitmentId)) return { success: false, error: "Invalid commitment." };
    const row = await db
      .select({ id: commitments.id })
      .from(commitments)
      .where(and(eq(commitments.id, input.commitmentId), eq(commitments.videoId, input.videoId), eq(commitments.status, "OPEN")))
      .limit(1);
    if (!row[0]) return { success: false, error: "Open commitment does not belong to this video." };
    commitmentId = input.commitmentId;
  }

  const prior = await db
    .select({ version: deliveries.version })
    .from(deliveries)
    .where(eq(deliveries.videoId, input.videoId))
    .orderBy(desc(deliveries.version))
    .limit(1);
  const version = (prior[0]?.version ?? 0) + 1;
  const deliveredAt = new Date();
  const deliveryInsert = db.insert(deliveries).values({
      videoId: input.videoId,
      commitmentId,
      version,
      status: version === 1 ? "DELIVERED" : "REDELIVERED",
      deliveryUrl: validatedUrl.value,
      note,
      deliveredAt,
    });
  const currentLinkUpdate = db
    .update(videoLogs)
    .set({ deliveryUrl: validatedUrl.value, updatedAt: deliveredAt })
    .where(eq(videoLogs.id, input.videoId));
  const commitmentUpdate = commitmentId
    ? db
        .update(commitments)
        .set({ status: "DONE", completedAt: deliveredAt })
        .where(eq(commitments.id, commitmentId))
    : null;
  if (validatedUrl.value && commitmentUpdate) {
    await db.batch([deliveryInsert, currentLinkUpdate, commitmentUpdate]);
  } else if (validatedUrl.value) {
    await db.batch([deliveryInsert, currentLinkUpdate]);
  } else if (commitmentUpdate) {
    await db.batch([deliveryInsert, commitmentUpdate]);
  } else {
    await deliveryInsert;
  }
  revalidateVideoOperations(input.videoId);
  return { success: true, message: `Delivery v${version} recorded without changing lifecycle.` };
}

export type VideoOperationalSnapshot = Awaited<ReturnType<typeof getVideoOperationalSnapshot>>;
export type { BlockerCategory, ChecklistStatus, FrictionCategory, ProductionStep, RevisionCause };
