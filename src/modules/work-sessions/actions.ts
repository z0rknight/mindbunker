"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { videoLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  START_WORK_SESSION_SQL,
  STOP_WORK_SESSION_SQL,
  isWorkSessionActivityType,
  isWorkSessionVideoId,
  toUnixSeconds,
  type VideoWorkSessionState,
  type WorkSessionActivityType,
} from "./core";
import { getVideoWorkSessionState } from "./data";

type RawMutationRow = {
  id: number;
  video_id: number;
  started_at: number;
  ended_at: number | null;
  activity_type: string;
  note: string | null;
};

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

  revalidatePath("/productivity");
  return {
    success: true,
    message: "Work session stopped.",
    state: await getVideoWorkSessionState(videoId),
  };
}
