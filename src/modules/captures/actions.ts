"use server";

// RMEDIA Engine — Operational Capture MVP (Wave 2). Mutation layer.
//
// Hard invariant (Wave 1 §1 / Wave 2 §1), enforced by construction, not
// by convention: nothing in this file ever writes to work_sessions,
// billingEvidence, transactions, or cashMovements directly. The only
// place a Capture ever produces a real Work Session is promoteCapture,
// and it does so exclusively by calling the existing, already-audited
// logManualWorkSession -- the same validation, the same crmEvents write,
// the same revalidation every other manual time entry gets. A Capture
// that is never promoted can never become billable time or revenue.

import { revalidatePath } from "next/cache";
import { getAuthenticatedDb } from "@/db";
import { captures } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  captureDurationMinutes,
  isPositiveId,
  validateCaptureInput,
  type CreateCaptureInput,
} from "./core";
import { getCaptureById } from "./data";
import { addClient } from "../crm/actions";
import { createProject } from "../projects/actions";
import { createVideoLog } from "../productivity/actions";
import { logManualWorkSession } from "../work-sessions/actions";
import { DEFAULT_WORK_SESSION_ACTIVITY, type WorkSessionActivityType } from "../work-sessions/core";
import { CAPTURE_EVENT_TYPE_LABELS } from "./config";

type CaptureActionResult =
  | { success: true; captureId: number }
  | { success: false; error: string };

function revalidateCaptureSurfaces() {
  // Wave 2 §8: canonical Inbox lives under Productivity; the War Room
  // signal (§17) reads Captures on every War Room render, so it needs
  // no separate revalidation trigger -- force-dynamic already recomputes
  // it per request, same as every other Active Signal.
  revalidatePath("/productivity/captures");
  revalidatePath("/war-room");
}

// Web Quick Capture entry point (Wave 2 §6). This is the ONLY write path
// in Wave 2 -- Sensor-originated Captures (source: "MAC_SENSOR") are
// explicitly deferred to Wave 3 per the mission's scope guard.
export async function createCapture(input: CreateCaptureInput): Promise<CaptureActionResult> {
  const validated = validateCaptureInput(input);
  if (!validated.success) return { success: false, error: validated.error };

  const db = await getAuthenticatedDb();
  const inserted = await db
    .insert(captures)
    .values({
      context: validated.data.context,
      counterpartyLabel: validated.data.counterpartyLabel,
      channel: validated.data.channel,
      eventType: validated.data.eventType,
      note: validated.data.note,
      startedAt: validated.data.startedAt,
      endedAt: validated.data.endedAt,
      outcome: validated.data.outcome,
      source: validated.data.source,
    })
    .returning({ id: captures.id });

  const captureId = inserted[0]?.id;
  if (!captureId) return { success: false, error: "Capture could not be saved." };

  revalidateCaptureSurfaces();
  return { success: true, captureId };
}

// Mission §4/§9: outcome transitions the operator makes explicitly from
// the Inbox. GHOSTED is only ever reachable through this function, never
// computed from age (core.ts's GHOSTING_IS_MANUAL_ONLY marker exists
// specifically so that invariant has one obvious place to check).
export async function setCaptureOutcome(
  captureId: number,
  outcome: "CONVERTED" | "GHOSTED" | "REJECTED" | "NOT_APPLICABLE",
): Promise<CaptureActionResult> {
  if (!isPositiveId(captureId)) return { success: false, error: "Invalid capture." };
  const db = await getAuthenticatedDb();
  const updated = await db
    .update(captures)
    .set({ outcome, updatedAt: new Date() })
    .where(eq(captures.id, captureId))
    .returning({ id: captures.id });
  if (!updated[0]) return { success: false, error: "Capture not found." };
  revalidateCaptureSurfaces();
  return { success: true, captureId };
}

export async function dismissCapture(captureId: number): Promise<CaptureActionResult> {
  if (!isPositiveId(captureId)) return { success: false, error: "Invalid capture." };
  const db = await getAuthenticatedDb();
  const updated = await db
    .update(captures)
    .set({ dismissedAt: new Date(), updatedAt: new Date() })
    .where(eq(captures.id, captureId))
    .returning({ id: captures.id });
  if (!updated[0]) return { success: false, error: "Capture not found." };
  revalidateCaptureSurfaces();
  return { success: true, captureId };
}

export async function archiveCapture(captureId: number): Promise<CaptureActionResult> {
  if (!isPositiveId(captureId)) return { success: false, error: "Invalid capture." };
  const db = await getAuthenticatedDb();
  const updated = await db
    .update(captures)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(captures.id, captureId))
    .returning({ id: captures.id });
  if (!updated[0]) return { success: false, error: "Capture not found." };
  revalidateCaptureSurfaces();
  return { success: true, captureId };
}

export type PromoteCaptureInput = {
  captureId: number;
  // Link to an already-existing client instead of creating one.
  existingClientId?: number | null;
  // Only used when existingClientId is absent -- defaults to the
  // Capture's own counterpartyLabel if not supplied.
  clientName?: string;
  projectName: string;
  createVideo?: boolean;
  videoTitle?: string;
  activityType?: WorkSessionActivityType;
};

type PromoteCaptureResult =
  | {
      success: true;
      clientId: number;
      projectId: number;
      videoId: number | null;
      workSessionId: number | null;
      alreadyPromoted: boolean;
    }
  | { success: false; error: string };

// Wave 1.5 Decision C / mission §10-12: Model B. The Capture row is
// never transformed into another entity -- it only gains linkage. This
// creates a *new* work_sessions row (never reattributes an existing
// one) seeded from the Capture's own honest timestamps, exactly the
// Backfill Day discipline of never rewriting createdAt.
//
// Idempotency (mission §11, required with a test): promotion is a
// one-way transition. If the Capture already has promotedClientId set,
// this returns the existing linked ids immediately and performs no
// further writes -- a duplicate click/request cannot create a second
// Client/Project/Video/Work Session.
//
// Transactionality note (mission §10: "if existing primitives cannot be
// safely composed transactionally, STOP and document the exact
// blocker"): this documents, rather than works around, a real
// constraint. addClient/createProject/createVideoLog/logManualWorkSession
// are each independent, already-audited server actions with their own
// validation and their own crmEvents writes -- composing them into one
// atomic SQL transaction would mean either re-implementing their
// business rules here (explicitly prohibited by §10) or accepting that
// this is a sequence of independent, already-safe writes rather than one
// multi-statement db.batch(). The idempotency guard above is what makes
// that acceptable: a failure partway through (e.g. client created,
// project creation fails) leaves the Capture still promotable on retry
// -- see promoteCapture's own re-entry behavior below, which reuses an
// already-created client/project instead of creating duplicates.
export async function promoteCapture(input: PromoteCaptureInput): Promise<PromoteCaptureResult> {
  if (!isPositiveId(input.captureId)) return { success: false, error: "Invalid capture." };

  const capture = await getCaptureById(input.captureId);
  if (!capture) return { success: false, error: "Capture not found." };

  // Idempotent re-entry: already fully promoted.
  if (capture.promotedClientId && capture.promotedProjectId) {
    return {
      success: true,
      clientId: capture.promotedClientId,
      projectId: capture.promotedProjectId,
      videoId: capture.promotedVideoId,
      workSessionId: capture.promotedWorkSessionId,
      alreadyPromoted: true,
    };
  }

  // Step 1: client -- reuse if this Capture was partially promoted on a
  // prior, failed attempt (re-entry safety, see note above).
  let clientId = capture.promotedClientId ?? input.existingClientId ?? null;
  if (!clientId) {
    const name = (input.clientName ?? capture.counterpartyLabel ?? "").trim();
    if (!name) {
      return { success: false, error: "A client name is required to promote this capture." };
    }
    try {
      const created = await addClient({ name, status: "active", source: capture.channel ?? undefined });
      if (!created.id) return { success: false, error: "Client could not be created." };
      clientId = created.id;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Client could not be created." };
    }
  }

  // Step 2: project.
  let projectId = capture.promotedProjectId ?? null;
  if (!projectId) {
    const projectName = input.projectName.trim();
    if (!projectName) return { success: false, error: "A project name is required to promote this capture." };
    const project = await createProject(clientId, { name: projectName, status: "active" });
    if (!project.success || !project.projectId) {
      return { success: false, error: project.success ? "Project could not be created." : project.error };
    }
    projectId = project.projectId;
  }

  // Step 3 (optional): video + work session -- only when the operator
  // asked for one. Internal/Admin Captures generally never reach this
  // (Wave 2 §12: "Internal/Admin Captures generally require NO
  // promotion" -- they resolve as NOT_APPLICABLE and stay history).
  let videoId: number | null = capture.promotedVideoId ?? null;
  let workSessionId: number | null = capture.promotedWorkSessionId ?? null;
  if (input.createVideo && !videoId) {
    const fallbackTitle = capture.counterpartyLabel
      ? `${capture.counterpartyLabel} — ${CAPTURE_EVENT_TYPE_LABELS[capture.eventType]}`
      : CAPTURE_EVENT_TYPE_LABELS[capture.eventType];
    const videoResult = await createVideoLog({
      title: input.videoTitle?.trim() || fallbackTitle,
      projectId,
      status: "PLANNED",
      notes: capture.note ?? undefined,
    });
    if (!videoResult.success || !videoResult.videoId) {
      // Client/project already exist and are linked below -- this is a
      // safe partial state; retrying promoteCapture will reuse them
      // (re-entry logic above) rather than duplicating.
      await linkPromotion(input.captureId, { clientId, projectId, videoId: null, workSessionId: null });
      return {
        success: false,
        error: videoResult.success ? "Video could not be created." : videoResult.error,
      };
    }
    videoId = videoResult.videoId;

    const minutes = captureDurationMinutes(capture.startedAt, capture.endedAt);
    if (minutes !== null && capture.startedAt && capture.endedAt) {
      const logged = await logManualWorkSession({
        videoId,
        startedAt: capture.startedAt.toISOString(),
        endedAt: capture.endedAt.toISOString(),
        activityType: input.activityType ?? DEFAULT_WORK_SESSION_ACTIVITY,
        note: capture.note,
      });
      if (logged.success) {
        workSessionId = logged.workSessionId ?? null;
      }
      // A failure here is not fatal to promotion -- the video now exists
      // and is linked; the operator can log time on it normally from
      // Productivity. We do not fabricate a work session.
    }
  }

  await linkPromotion(input.captureId, { clientId, projectId, videoId, workSessionId });
  revalidateCaptureSurfaces();
  return { success: true, clientId, projectId, videoId, workSessionId, alreadyPromoted: false };
}

async function linkPromotion(
  captureId: number,
  ids: { clientId: number; projectId: number; videoId: number | null; workSessionId: number | null },
) {
  const db = await getAuthenticatedDb();
  await db
    .update(captures)
    .set({
      promotedClientId: ids.clientId,
      promotedProjectId: ids.projectId,
      promotedVideoId: ids.videoId,
      promotedWorkSessionId: ids.workSessionId,
      outcome: "CONVERTED",
      updatedAt: new Date(),
    })
    .where(eq(captures.id, captureId));
}
