import "server-only";

import { getAuthenticatedDb } from "@/db";
import { videoLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// BUILD GATE FIX (Post-Audit Root Fix Wave follow-up): this file holds
// internal, non-Server-Action server utilities that used to live as
// exports of work-sessions/actions.ts, a "use server" module. Next.js 16
// treats EVERY export of a "use server" file as a remotely-invocable
// Server Action and requires each one to be an async function --
// revalidateWorkSessionSurfaces is synchronous by design (it is a plain
// revalidatePath fan-out, not a mutation) and fails `next build` there
// with "Server Actions must be async functions." These were never meant
// to be callable from the client at all; they exist purely for reuse
// between server modules (work-sessions/actions.ts itself, and
// sensor/actions.ts's approveSensorSession). Moving them to a plain
// server-only module (no "use server") both fixes the build and removes
// them from the Server Action surface entirely, which is the more
// correct home for an internal helper regardless of the sync/async
// build rule.

// FLOW CLOSURE (Sunday round): a closed/corrected Work Session is the
// canonical operational fact every downstream projection (Dashboard,
// War Room, CRM, Projects) derives tracked time from -- this used to only
// revalidate /productivity, so a soft client-side navigation to any of
// those other surfaces right after closing a session could show stale
// (Next.js Router Cache) numbers until a hard reload. Mirrors
// productivity/revalidation.ts's revalidateProductivityViews, the
// existing reference pattern for this exact propagation shape.
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
