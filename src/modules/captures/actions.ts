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
import { and, eq, isNull, lt, or } from "drizzle-orm";
import {
  captureDurationMinutes,
  isPositiveId,
  isPromotionScopeComplete,
  validateCaptureInput,
  type CreateCaptureInput,
} from "./core";
import { getCaptureById } from "./data";
import { addClient } from "../crm/actions";
import { createProject } from "../projects/actions";
import { createVideoLog } from "../productivity/actions";
import { logManualWorkSession } from "../work-sessions/actions";
import { DEFAULT_WORK_SESSION_ACTIVITY, type WorkSessionActivityType } from "../work-sessions/core";
import { CAPTURE_EVENT_TYPE_LABELS, PROMOTION_CLAIM_STALE_MS } from "./config";

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
// Wave 2.1 (Promotion Custody release gate) rewrote this function's
// crash/retry and concurrency behavior after an audit found the Wave 2
// version's idempotency claim was only partially true -- see
// RMEDIA_ENGINE_CAPTURE_PROMOTION_RELEASE_GATE_WAVE_2_1.md for the full
// failure-matrix analysis. Two problems existed and are both fixed here:
//
// 1. CRASH BETWEEN INDEPENDENT WRITES: the old version only persisted
//    promoted*Id at the very end (or in one narrow video-failure branch).
//    A crash between e.g. addClient succeeding and createProject being
//    called left a real orphaned Client row with nothing on the Capture
//    recording it -- retry would call addClient again, duplicating it.
//    Fixed by checkpointing each promoted*Id onto the Capture
//    immediately after its corresponding entity is actually created
//    (checkpoint() below), so a retry's re-entry check
//    (capture.promotedClientId ?? ...) sees real, already-persisted
//    progress instead of re-deriving it from nothing.
//
// 2. CONCURRENT REQUESTS: the old top-of-function "already promoted?"
//    check reads before either of two near-simultaneous requests has
//    written anything, so both could pass it and both create a Client.
//    Fixed with an atomic claim: a conditional UPDATE that only succeeds
//    if no other request currently holds a live claim
//    (promotionClaimedAt is null or older than PROMOTION_CLAIM_STALE_MS)
//    and the Capture isn't already fully promoted. A losing concurrent
//    request is told to retry rather than proceeding. A crashed
//    request's claim goes stale after the window so it never permanently
//    locks the Capture -- this is a lease, not a distributed lock, using
//    only a conditional UPDATE on a column already on this table (no new
//    infrastructure, per mission §8's explicit instruction).
//
// Transactionality note (mission §10, restated from Wave 2: "if existing
// primitives cannot be safely composed transactionally, STOP and
// document the exact blocker"): addClient/createProject/createVideoLog/
// logManualWorkSession remain four independent, already-audited server
// actions, not one atomic SQL transaction -- composing them into one
// `db.batch()` would mean re-implementing their business rules here,
// which §10 explicitly prohibits. The claim + incremental checkpointing
// above is what makes that acceptable now: each step is individually
// idempotent-on-retry and mutually exclusive across concurrent requests,
// which is the property that actually matters, not atomicity of the
// whole sequence.
export async function promoteCapture(input: PromoteCaptureInput): Promise<PromoteCaptureResult> {
  if (!isPositiveId(input.captureId)) return { success: false, error: "Invalid capture." };

  const capture = await getCaptureById(input.captureId);
  if (!capture) return { success: false, error: "Capture not found." };

  // Idempotent re-entry: already fully promoted for the SCOPE THIS CALL
  // ACTUALLY REQUESTED (client + project always required; video/work
  // session only if input.createVideo). Checking client+project alone,
  // ignoring input.createVideo, was a real bug this release-gate audit's
  // own test caught: a retry that also asked for a video would silently
  // skip creating it once an earlier attempt had gotten as far as
  // checkpointing client+project. See core.ts's isPromotionScopeComplete.
  // No claim needed for a pure read-and-return.
  if (isPromotionScopeComplete(capture, Boolean(input.createVideo))) {
    return {
      success: true,
      clientId: capture.promotedClientId!,
      projectId: capture.promotedProjectId!,
      videoId: capture.promotedVideoId,
      workSessionId: capture.promotedWorkSessionId,
      alreadyPromoted: true,
    };
  }

  // Atomic claim: only one concurrent request may proceed past this
  // point for a given Capture. `affectedRows`-style check via
  // `.returning()` -- if this UPDATE matches zero rows, either another
  // request holds a live claim, or (race) the Capture reached full scope
  // completion (per this same request's scope) by someone else between
  // the read above and this UPDATE. The WHERE condition mirrors
  // isPromotionScopeComplete's own logic (negated) so the claim reopens
  // whenever there's still real work left for THIS call's requested
  // scope, even if an earlier, narrower-scoped attempt already finished
  // client+project.
  const db = await getAuthenticatedDb();
  const staleBefore = new Date(Date.now() - PROMOTION_CLAIM_STALE_MS);
  const scopeIncomplete = input.createVideo
    ? or(isNull(captures.promotedProjectId), isNull(captures.promotedVideoId))
    : isNull(captures.promotedProjectId);
  const claimed = await db
    .update(captures)
    .set({ promotionClaimedAt: new Date() })
    .where(
      and(
        eq(captures.id, input.captureId),
        scopeIncomplete,
        or(isNull(captures.promotionClaimedAt), lt(captures.promotionClaimedAt, staleBefore)),
      ),
    )
    .returning({ id: captures.id });

  if (claimed.length === 0) {
    const fresh = await getCaptureById(input.captureId);
    if (fresh && isPromotionScopeComplete(fresh, Boolean(input.createVideo))) {
      return {
        success: true,
        clientId: fresh.promotedClientId!,
        projectId: fresh.promotedProjectId!,
        videoId: fresh.promotedVideoId,
        workSessionId: fresh.promotedWorkSessionId,
        alreadyPromoted: true,
      };
    }
    return {
      success: false,
      error: "Promotion is already in progress for this capture. Try again in a moment.",
    };
  }

  // Clean (non-crash) failure from here on should release the claim so
  // an immediate retry isn't stuck waiting out the staleness window.
  async function releaseClaim() {
    await db.update(captures).set({ promotionClaimedAt: null }).where(eq(captures.id, input.captureId));
  }

  // Step 1: client -- reuse if this Capture was partially promoted on a
  // prior, failed/crashed attempt (re-entry safety).
  let clientId = capture.promotedClientId ?? input.existingClientId ?? null;
  if (!clientId) {
    const name = (input.clientName ?? capture.counterpartyLabel ?? "").trim();
    if (!name) {
      await releaseClaim();
      return { success: false, error: "A client name is required to promote this capture." };
    }
    let created;
    try {
      created = await addClient({ name, status: "active", source: capture.channel ?? undefined });
    } catch (error) {
      await releaseClaim();
      return { success: false, error: error instanceof Error ? error.message : "Client could not be created." };
    }
    if (!created.id) {
      await releaseClaim();
      return { success: false, error: "Client could not be created." };
    }
    clientId = created.id;
    // Checkpoint immediately -- if anything below crashes, a retry sees
    // this client already exists and will not create a second one.
    await db.update(captures).set({ promotedClientId: clientId, updatedAt: new Date() }).where(eq(captures.id, input.captureId));
  }

  // Step 2: project.
  let projectId = capture.promotedProjectId ?? null;
  if (!projectId) {
    const projectName = input.projectName.trim();
    if (!projectName) {
      await releaseClaim();
      return { success: false, error: "A project name is required to promote this capture." };
    }
    let project;
    try {
      project = await createProject(clientId, { name: projectName, status: "active" });
    } catch (error) {
      await releaseClaim();
      return { success: false, error: error instanceof Error ? error.message : "Project could not be created." };
    }
    if (!project.success || !project.projectId) {
      await releaseClaim();
      return { success: false, error: project.success ? "Project could not be created." : project.error };
    }
    projectId = project.projectId;
    // Checkpoint immediately, same reasoning as Step 1.
    await db.update(captures).set({ promotedProjectId: projectId, updatedAt: new Date() }).where(eq(captures.id, input.captureId));
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
    let videoResult;
    try {
      videoResult = await createVideoLog({
        title: input.videoTitle?.trim() || fallbackTitle,
        projectId,
        status: "PLANNED",
        notes: capture.note ?? undefined,
      });
    } catch (error) {
      // Client/project already checkpointed above -- safe partial state.
      await releaseClaim();
      return { success: false, error: error instanceof Error ? error.message : "Video could not be created." };
    }
    if (!videoResult.success || !videoResult.videoId) {
      await releaseClaim();
      return {
        success: false,
        error: videoResult.success ? "Video could not be created." : videoResult.error,
      };
    }
    videoId = videoResult.videoId;
    // Checkpoint immediately, same reasoning as Steps 1-2.
    await db.update(captures).set({ promotedVideoId: videoId, updatedAt: new Date() }).where(eq(captures.id, input.captureId));

    const minutes = captureDurationMinutes(capture.startedAt, capture.endedAt);
    if (minutes !== null && capture.startedAt && capture.endedAt) {
      try {
        const logged = await logManualWorkSession({
          videoId,
          startedAt: capture.startedAt.toISOString(),
          endedAt: capture.endedAt.toISOString(),
          activityType: input.activityType ?? DEFAULT_WORK_SESSION_ACTIVITY,
          note: capture.note,
        });
        if (logged.success) {
          workSessionId = logged.workSessionId ?? null;
          if (workSessionId) {
            await db.update(captures).set({ promotedWorkSessionId: workSessionId, updatedAt: new Date() }).where(eq(captures.id, input.captureId));
          }
        }
        // A failure here is not fatal to promotion -- the video now
        // exists and is linked; the operator can log time on it normally
        // from Productivity. We do not fabricate a work session, and we
        // do not fail the whole promotion over it.
      } catch {
        // Same reasoning: non-fatal, video/client/project remain linked
        // and checkpointed.
      }
    }
  }

  // Completion: only NOW does outcome flip to CONVERTED -- every
  // promoted*Id the requested scope needed is already durably
  // checkpointed above, so this final write changes exactly one
  // additional field. Mission §7: a Capture that is merely mid-promotion
  // (checkpointed but not yet here) must not read as CONVERTED.
  await db.update(captures).set({ outcome: "CONVERTED", updatedAt: new Date() }).where(eq(captures.id, input.captureId));
  revalidateCaptureSurfaces();
  return { success: true, clientId, projectId, videoId, workSessionId, alreadyPromoted: false };
}
