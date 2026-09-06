"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { crmEvents, videoLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  CORRECT_WORK_SESSION_SQL,
  START_WORK_SESSION_SQL,
  STOP_WORK_SESSION_AT_SQL,
  STOP_WORK_SESSION_SQL,
  describeSessionCorrection,
  isWorkSessionActivityType,
  isWorkSessionId,
  isWorkSessionVideoId,
  toUnixSeconds,
  validateSessionCorrection,
  type VideoWorkSessionState,
  type WorkSessionActivityType,
} from "./core";
import { getVideoWorkSessionState, getWorkSessionById } from "./data";

type RawMutationRow = {
  id: number;
  video_id: number;
  started_at: number;
  ended_at: number | null;
  activity_type: string;
  note: string | null;
};

type RawCorrectionRow = RawMutationRow & { updated_at: number | null };

type WorkSessionActionResult =
  | {
      success: true;
      message: string;
      state: VideoWorkSessionState;
    }
  | {
      success: false;
      error: string;
      state?: VideoWorkSessionState;
    };

type CorrectionActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

async function videoExists(videoId: number) {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ id: videoLogs.id })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  return Boolean(rows[0]);
}

function activeSessionMessage(state: VideoWorkSessionState) {
  if (!state.openSession) return "Another work session could not be started.";
  return `Work is already running on ${state.openSession.videoTitle}.`;
}

// FLOW CLOSURE (Sunday round): a closed/corrected Work Session is the
// canonical operational fact every downstream projection (Dashboard,
// War Room, CRM, Projects) derives tracked time from -- this used to only
// revalidate /productivity, so a soft client-side navigation to any of
// those other surfaces right after closing a session could show stale
// (Next.js Router Cache) numbers until a hard reload. Mirrors
// productivity/actions.ts's revalidateProductivityViews, the existing
// reference pattern for this exact propagation shape.
export function revalidateWorkSessionSurfaces(
  attribution?: { clientId: number | null; projectId: number | null } | null,
) {
  revalidatePath("/productivity");
  revalidatePath("/productivity/sessions");
  revalidatePath("/");
  revalidatePath("/war-room");
  revalidatePath("/crm");
  revalidatePath("/projects");
  if (attribution?.clientId) revalidatePath(`/crm/${attribution.clientId}`);
  if (attribution?.projectId) revalidatePath(`/projects/${attribution.projectId}`);
}

export async function getVideoAttribution(videoId: number) {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ clientId: videoLogs.clientId, projectId: videoLogs.projectId })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  return rows[0] ?? null;
}

export async function startWorkSession(
  videoId: number,
  activityType: WorkSessionActivityType,
): Promise<WorkSessionActionResult> {
  if (!isWorkSessionVideoId(videoId)) {
    return { success: false, error: "Invalid video." };
  }
  if (!isWorkSessionActivityType(activityType)) {
    return { success: false, error: "Choose a valid activity." };
  }

  const db = await getAuthenticatedDb();
  const inserted = await db.$client
    .prepare(START_WORK_SESSION_SQL)
    .bind(videoId, toUnixSeconds(new Date()), activityType)
    .first<RawMutationRow>();

  if (!inserted) {
    if (!(await videoExists(videoId))) {
      return { success: false, error: "Video not found." };
    }
    const state = await getVideoWorkSessionState(videoId);
    return {
      success: false,
      error: activeSessionMessage(state),
      state,
    };
  }

  revalidatePath("/productivity");
  return {
    success: true,
    message: "Work session started.",
    state: await getVideoWorkSessionState(videoId),
  };
}

export async function stopWorkSession(
  videoId: number,
): Promise<WorkSessionActionResult> {
  if (!isWorkSessionVideoId(videoId)) {
    return { success: false, error: "Invalid video." };
  }

  const db = await getAuthenticatedDb();
  const endedAt = toUnixSeconds(new Date());
  const stopped = await db.$client
    .prepare(STOP_WORK_SESSION_SQL)
    .bind(videoId, endedAt)
    .first<RawMutationRow>();

  if (!stopped) {
    if (!(await videoExists(videoId))) {
      return { success: false, error: "Video not found." };
    }
    const state = await getVideoWorkSessionState(videoId);
    if (state.openSession?.videoId === videoId) {
      return {
        success: false,
        error: "The session just started. Wait a moment and stop again.",
        state,
      };
    }
    return {
      success: false,
      error: state.openSession
        ? `No open session for this video. Work is active on ${state.openSession.videoTitle}.`
        : "This work session is already stopped.",
      state,
    };
  }

  revalidateWorkSessionSurfaces(await getVideoAttribution(videoId));
  return {
    success: true,
    message: "Work session stopped.",
    state: await getVideoWorkSessionState(videoId),
  };
}

// Stale-session recovery, §6 model B's "Correct end time" branch: stops the
// one open session at an operator-chosen past timestamp instead of "now".
// This is still the session's *first* close — not a correction of an
// already-closed row — so it is not logged as a work_session.corrected
// audit event; pressing Stop with a chosen time is exactly as authoritative
// as pressing Stop with the implicit "now".
export async function stopWorkSessionAt(
  videoId: number,
  endedAtIso: string,
): Promise<WorkSessionActionResult> {
  if (!isWorkSessionVideoId(videoId)) {
    return { success: false, error: "Invalid video." };
  }
  const endedAt = new Date(endedAtIso);
  if (Number.isNaN(endedAt.getTime())) {
    return { success: false, error: "Choose a valid end time." };
  }

  const db = await getAuthenticatedDb();
  const now = new Date();
  const stopped = await db.$client
    .prepare(STOP_WORK_SESSION_AT_SQL)
    .bind(videoId, toUnixSeconds(endedAt), toUnixSeconds(now))
    .first<RawMutationRow>();

  if (!stopped) {
    if (!(await videoExists(videoId))) {
      return { success: false, error: "Video not found." };
    }
    const state = await getVideoWorkSessionState(videoId);
    if (!state.openSession || state.openSession.videoId !== videoId) {
      return {
        success: false,
        error: state.openSession
          ? `No open session for this video. Work is active on ${state.openSession.videoTitle}.`
          : "This work session is already stopped.",
        state,
      };
    }
    const startedAtMs = Date.parse(state.openSession.startedAt);
    if (endedAt.getTime() <= startedAtMs) {
      return { success: false, error: "End time must be after the session's start time.", state };
    }
    return { success: false, error: "End time cannot be in the future.", state };
  }

  revalidateWorkSessionSurfaces(await getVideoAttribution(videoId));
  return {
    success: true,
    message: "Work session stopped.",
    state: await getVideoWorkSessionState(videoId),
  };
}

// Safe completed-session correction (Sprint 1.2.1 Ledger P1, §5). Only a
// CLOSED session can be corrected — the open/live session is untouchable
// here by construction (CORRECT_WORK_SESSION_SQL's own WHERE guard), so
// this can never race the single-open-session invariant. Every correction
// that changes a field is logged as a crm_events row (type
// "work_session.corrected") rather than kept in a separate history table —
// the smallest audit mechanism that fits the existing house pattern
// (crm_events already carries CRM history and Video Memory notes the same
// way), not a new event-sourcing system.
export async function correctWorkSession(
  sessionId: number,
  input: {
    videoId: number;
    startedAt: string;
    endedAt: string;
    activityType: WorkSessionActivityType;
    note: string | null;
  },
): Promise<CorrectionActionResult> {
  if (!isWorkSessionId(sessionId)) {
    return { success: false, error: "Invalid session." };
  }

  const existing = await getWorkSessionById(sessionId);
  if (!existing) {
    return { success: false, error: "Work session not found." };
  }
  if (existing.before.endedAt === null) {
    return {
      success: false,
      error: "Stop this session before correcting it.",
    };
  }

  const validated = validateSessionCorrection({
    videoId: input.videoId,
    startedAt: new Date(input.startedAt),
    endedAt: new Date(input.endedAt),
    activityType: input.activityType,
    note: input.note,
  });
  if (!validated.success) return validated;

  const db = await getAuthenticatedDb();

  if (validated.data.videoId !== existing.before.videoId) {
    if (!(await videoExists(validated.data.videoId))) {
      return { success: false, error: "Chosen video not found." };
    }
  }

  const corrected = await db.$client
    .prepare(CORRECT_WORK_SESSION_SQL)
    .bind(
      sessionId,
      validated.data.videoId,
      toUnixSeconds(validated.data.startedAt),
      toUnixSeconds(validated.data.endedAt),
      validated.data.activityType,
      validated.data.note,
      toUnixSeconds(new Date()),
    )
    .first<RawCorrectionRow>();

  if (!corrected) {
    // The pre-checks above already ruled out "not found" and "still open";
    // what's left is the SQL-level duration/video guard rejecting the
    // write, or a race where the session was reopened between the checks
    // and this statement (extremely unlikely — correction only targets
    // already-closed rows, and nothing reopens a closed row). Fail closed
    // with a generic, honest message rather than guessing which.
    return {
      success: false,
      error: "Could not save this correction. Refresh and try again.",
    };
  }

  const newVideo = await db
    .select({
      clientId: videoLogs.clientId,
      projectId: videoLogs.projectId,
      title: videoLogs.title,
      date: videoLogs.date,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, validated.data.videoId))
    .limit(1);
  const newClientId = newVideo[0]?.clientId ?? null;
  const newProjectId = newVideo[0]?.projectId ?? null;
  const newVideoTitle = newVideo[0]?.title ?? `Video ${newVideo[0]?.date ?? validated.data.videoId}`;

  const description = describeSessionCorrection(
    sessionId,
    existing.before,
    validated.data,
    newVideoTitle,
  );

  await db.insert(crmEvents).values({
    clientId: newClientId,
    videoId: validated.data.videoId,
    type: "work_session.corrected",
    actor: "admin",
    description,
    createdAt: new Date(),
  });

  revalidateWorkSessionSurfaces({ clientId: newClientId, projectId: newProjectId });
  return { success: true, message: "Session corrected." };
}
