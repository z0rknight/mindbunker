import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clients, projects, revisions, videoLogs } from "@/db/schema";
import { and, desc, eq, gte, sql as dsql } from "drizzle-orm";

// Small, purpose-built option lists for the Lab page's commitment-creation
// form. Deliberately not the full CRM/Projects list -- active clients,
// open projects, and the 25 most recent videos is enough for a dogfood
// surface; this is not meant to replace the real Client/Project pickers
// used elsewhere in the app.
export async function getLabOwnerOptions() {
  const db = await getAuthenticatedDb();
  const [clientRows, projectRows, videoRows] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.status, "active"))
      .orderBy(clients.name),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .orderBy(desc(projects.id))
      .limit(25),
    db
      .select({ id: videoLogs.id, title: videoLogs.title })
      .from(videoLogs)
      .orderBy(desc(videoLogs.id))
      .limit(25),
  ]);
  // video_logs.title is nullable in schema (an untitled draft video is
  // valid) -- every option list below expects a real display string, so
  // fall back honestly to "Untitled video #<id>" rather than widening
  // every consumer's type to allow null.
  const videos = videoRows.map((v) => ({ id: v.id, title: v.title ?? `Untitled video #${v.id}` }));
  return { clients: clientRows, projects: projectRows, videos };
}

// Cluster E (QA/Rework provenance): a simple rolling "avoidable failure
// rate" -- of revisions logged in the last N days with a causedBy
// classification other than UNKNOWN, what share were OUR_ERROR (avoidable)
// vs CLIENT_CHANGE/SCOPE_CHANGE (not avoidable, a real change of mind or
// scope, not a mistake). UNKNOWN-classified rows are excluded from the
// rate on purpose -- they're not evidence of anything either way, and
// folding them into the denominator would silently make the rate look
// better every time someone forgets to classify a revision, exactly
// backwards from the incentive this stat exists to create.
export async function getQaAvoidableFailureStats(days = 30) {
  const db = await getAuthenticatedDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ causedBy: revisions.causedBy, count: dsql<number>`count(*)` })
    .from(revisions)
    .where(and(gte(revisions.createdAt, since)))
    .groupBy(revisions.causedBy);

  let ourError = 0;
  let notAvoidable = 0;
  let unknown = 0;
  for (const r of rows) {
    if (r.causedBy === "OUR_ERROR") ourError += r.count;
    else if (r.causedBy === "CLIENT_CHANGE" || r.causedBy === "SCOPE_CHANGE") notAvoidable += r.count;
    else unknown += r.count;
  }
  const classified = ourError + notAvoidable;
  return {
    days,
    ourError,
    notAvoidable,
    unknown,
    classified,
    avoidableRate: classified > 0 ? ourError / classified : null,
  };
}

// Wave 2F: Factory State -- a facts surface, no scores. All real local
// objects, grouped: ATTENTION (things needing eyes), WAITING (grouped by
// waitingOn), FACTORY (WIP counts).
export async function getFactoryState() {
  const db = await getAuthenticatedDb();

  const [blockedVideos, activeProjects, allVideos] = await Promise.all([
    db.select({ id: videoLogs.id, title: videoLogs.title, waitingOn: videoLogs.waitingOn }).from(videoLogs).where(eq(videoLogs.status, "CHANGES_REQUESTED")),
    db.select({ id: projects.id, name: projects.name, waitingOn: projects.waitingOn, nextAction: projects.nextAction }).from(projects),
    db.select({ id: videoLogs.id, status: videoLogs.status, waitingOn: videoLogs.waitingOn, title: videoLogs.title }).from(videoLogs),
  ]);

  const waitingGroups: Record<string, { videoId?: number; projectId?: number; label: string }[]> = {};
  for (const p of activeProjects) {
    if (p.waitingOn && p.waitingOn !== "NONE") {
      (waitingGroups[p.waitingOn] ??= []).push({ projectId: p.id, label: p.name });
    }
  }
  for (const v of allVideos) {
    if (v.waitingOn && v.waitingOn !== "NONE") {
      (waitingGroups[v.waitingOn] ??= []).push({ videoId: v.id, label: v.title ?? `Video #${v.id}` });
    }
  }

  const videosByLifecycleBucket = allVideos.reduce<Record<string, number>>((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    blockedVideos,
    activeProjectCount: activeProjects.length,
    waitingGroups,
    videosByStatus: videosByLifecycleBucket,
  };
}
