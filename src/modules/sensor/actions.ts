"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { sensorDevices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  SENSOR_SESSION_APPROVE_INSERT_SQL,
  SENSOR_SESSION_APPROVE_MARK_SQL,
  SENSOR_SESSION_ARCHIVE_SQL,
  SENSOR_SESSION_DELETE_SQL,
  SENSOR_SCOPES,
  createSensorCredential,
} from "./core";
import { getVideoAttribution, revalidateWorkSessionSurfaces } from "../work-sessions/revalidation";

function validSensorSessionId(id: number) {
  return Number.isSafeInteger(id) && id > 0;
}

export async function createSensorDevice(name: string) {
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 80) {
    return { success: false as const, error: "Choose a device name between 2 and 80 characters." };
  }
  const credential = await createSensorCredential();
  const db = await getAuthenticatedDb();
  await db.insert(sensorDevices).values({
    publicId: credential.publicId,
    name: cleanName,
    tokenHash: credential.tokenHash,
    scopes: SENSOR_SCOPES.join(","),
  });
  revalidatePath("/productivity/sensor");
  return {
    success: true as const,
    token: credential.token,
    publicId: credential.publicId,
    message: "Credential created. Copy it now; MindBunker stores only its hash.",
  };
}

export async function revokeSensorDevice(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return { success: false as const, error: "Invalid device." };
  const db = await getAuthenticatedDb();
  await db.update(sensorDevices).set({ revokedAt: new Date() }).where(eq(sensorDevices.id, id));
  revalidatePath("/productivity/sensor");
  return { success: true as const };
}

export async function rotateSensorDevice(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return { success: false as const, error: "Invalid device." };
  const credential = await createSensorCredential();
  const db = await getAuthenticatedDb();
  const updated = await db
    .update(sensorDevices)
    .set({
      publicId: credential.publicId,
      tokenHash: credential.tokenHash,
      revokedAt: null,
      lastSeenAt: null,
    })
    .where(eq(sensorDevices.id, id))
    .returning({ id: sensorDevices.id });
  if (!updated[0]) return { success: false as const, error: "Device not found." };
  revalidatePath("/productivity/sensor");
  return { success: true as const, token: credential.token, publicId: credential.publicId };
}

export async function approveSensorSession(id: number) {
  if (!validSensorSessionId(id)) {
    return { success: false as const, error: "Invalid Sensor session." };
  }
  const db = await getAuthenticatedDb();
  const now = Math.floor(Date.now() / 1_000);
  await db.$client.batch([
    db.$client.prepare(SENSOR_SESSION_APPROVE_INSERT_SQL).bind(id),
    db.$client.prepare(SENSOR_SESSION_APPROVE_MARK_SQL).bind(id, now),
  ]);
  const row = await db.$client
    .prepare(`
      SELECT approval_state, approved_work_session_id, video_id
      FROM sensor_sessions WHERE id = ?1
    `)
    .bind(id)
    .first<{ approval_state: string; approved_work_session_id: number | null; video_id: number }>();
  if (!row || row.approval_state !== "APPROVED" || row.approved_work_session_id === null) {
    return { success: false as const, error: "Only a completed pending Sensor session can be approved." };
  }
  revalidatePath("/productivity/sensor");
  revalidatePath(`/productivity/sensor/sessions/${id}`);
  revalidatePath("/productivity/sessions");
  // P1 POST-AUDIT FIX (DR-1): approveSensorSession writes the exact same
  // canonical work_sessions fact a manual stopWorkSession/stopWorkSessionAt
  // write (SENSOR_SESSION_APPROVE_INSERT_SQL inserts one real work_sessions
  // row), but before this fix only revalidated its own Sensor admin
  // surfaces above -- Dashboard, War Room, CRM, and Projects could show
  // stale tracked-time numbers after an approval until a hard reload, the
  // same propagation gap already fixed for manual stop/correct in the
  // Sunday Flow Closure round. Reuses that same shared helper (not a new,
  // parallel surface list) so this stays in lockstep with wherever that
  // helper's surface set changes in the future. Approval semantics,
  // Sensor-to-work-session truth semantics, and Sensor-session-shaped data
  // exposure are unchanged -- only downstream cache invalidation of the
  // already-written canonical fact is added.
  revalidateWorkSessionSurfaces(await getVideoAttribution(row.video_id));
  return { success: true as const, workSessionId: Number(row.approved_work_session_id) };
}

export async function archiveSensorSession(id: number) {
  if (!validSensorSessionId(id)) {
    return { success: false as const, error: "Invalid Sensor session." };
  }
  const db = await getAuthenticatedDb();
  const now = Math.floor(Date.now() / 1_000);
  const row = await db.$client
    .prepare(SENSOR_SESSION_ARCHIVE_SQL)
    .bind(id, now)
    .first<{ id: number }>();
  if (!row) return { success: false as const, error: "Only a completed pending Sensor session can be archived." };
  revalidatePath("/productivity/sensor");
  revalidatePath(`/productivity/sensor/sessions/${id}`);
  return { success: true as const };
}

export async function deleteArchivedSensorSession(id: number) {
  if (!validSensorSessionId(id)) {
    return { success: false as const, error: "Invalid Sensor session." };
  }
  const db = await getAuthenticatedDb();
  const now = Math.floor(Date.now() / 1_000);
  const row = await db.$client
    .prepare(SENSOR_SESSION_DELETE_SQL)
    .bind(id, now)
    .first<{ id: number }>();
  if (!row) return { success: false as const, error: "Archive the Sensor session before deleting it." };
  revalidatePath("/productivity/sensor");
  revalidatePath(`/productivity/sensor/sessions/${id}`);
  return { success: true as const };
}
