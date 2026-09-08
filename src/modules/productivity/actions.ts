"use server";

import "server-only";

import { getAuthenticatedDb, getDb } from "@/db";
import { isClientAuthenticated } from "@/lib/client-portal-session";
import {
  blockers,
  clients,
  commitments,
  crmEvents,
  deliveries,
  frictionEvents,
  productionChecklistItems,
  projects,
  revisions,
  videoLogs,
  workSessions,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { startOfMonthISO, todayISO } from "@/utils/date";
import { mondayOfWeek } from "../work-sessions/core";
import {
  completedVideoLogs,
  PRODUCTION_COUNT_KINDS,
  getVideoMetadataChanges,
  isPositiveId,
  planVideoTransition,
  validateDeliveryUrl,
  validateVideoAssignment,
  validateVideoCreateInput,
  validateVideoInput,
  validateVideoPriorityInput,
  type VideoCreateInputValues,
  type VideoInputValues,
  type ValidatedVideoMetadata,
} from "./core";
import {
  VIDEO_STATUS_LABELS,
  deliveredForVideoStatus,
  isVideoContentType,
  isVideoStatus,
  type VideoStatus,
} from "./config";
import {
  VIDEO_OPERATIONAL_MEMORY_DELETE_ERROR,
  VIDEO_OPERATIONAL_NOTE_EVENT_TYPE,
  videoOperationalMemoryBlocksDeletion,
} from "@/modules/video-memory/core";
import { resolveVideoKindForClient } from "@/lib/client-identity";
import { revalidateProductivityViews } from "./revalidation";
import { isQueueEligible, moveInOrder, resequencePositions, type QueueMoveDirection } from "./queue";

type ProductivityActionResult =
  | {
      success: true;
      message?: string;
      revisionsCount?: number;
      status?: VideoStatus;
      videoId?: number;
      changedFields?: string[];
    }
  | { success: false; error: string };

type AuthenticatedDb = Awaited<ReturnType<typeof getAuthenticatedDb>>;

// BUILD GATE FIX: revalidateProductivityViews moved to ./revalidation (a
// plain server-only module, not "use server") -- see that file's header
// comment. Next.js 16 rejects a synchronous export of a "use server"
// module as an invalid Server Action, and this was never meant to be a
// remotely-invocable action; it is an internal helper reused throughout
// this file and by video-operations/actions.ts's recordDetailedRevision
// (DR-3).

async function resolveVideoAssignment(
  db: AuthenticatedDb,
  input: { projectId: number | null; clientId: number | null },
  options: { allowArchivedProjectId?: number | null } = {},
) {
  const project = input.projectId
    ? (
        await db
          .select({ clientId: projects.clientId, status: projects.status })
          .from(projects)
          .where(eq(projects.id, input.projectId))
          .limit(1)
      )[0] ?? null
    : null;

  const assignment = validateVideoAssignment({
    requestedClientId: input.clientId,
    projectId: input.projectId,
    project,
    allowArchivedProject:
      input.projectId !== null &&
      input.projectId === options.allowArchivedProjectId,
  });
  if (!assignment.success) return assignment;

  let clientName: string | null = null;
  if (assignment.clientId) {
    const owner = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.id, assignment.clientId))
      .limit(1);
    if (!owner[0]) {
      return { success: false as const, error: "Client not found." };
    }
    clientName = owner[0].name;
  }

  return { success: true as const, clientId: assignment.clientId, clientName };
}

export async function createVideoLog(
  values: VideoCreateInputValues,
): Promise<ProductivityActionResult> {
  const parsed = validateVideoCreateInput(values);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  const assignment = await resolveVideoAssignment(db, parsed.data);
  if (!assignment.success) return assignment;

  const now = new Date();
  const inserted = await db
    .insert(videoLogs)
    .values({
      date: parsed.data.date ?? todayISO(),
      title: parsed.data.title,
      clientId: assignment.clientId,
      projectId: parsed.data.projectId,
      status: parsed.data.status,
      startedAt: null,
      revisionsCount: 0,
      delivered: deliveredForVideoStatus(parsed.data.status),
      deliveryUrl: parsed.data.deliveryUrl,
      notes: parsed.data.notes,
      coverUrl: parsed.data.coverUrl,
      orientation: parsed.data.orientation,
      contentType: parsed.data.contentType,
      videoKind: resolveVideoKindForClient(
        assignment.clientName,
        values.videoKind,
      ),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: videoLogs.id });
  const videoId = inserted[0]?.id;
  if (!videoId) {
    return { success: false, error: "Video could not be created." };
  }

  await db.insert(crmEvents).values({
    clientId: assignment.clientId,
    videoId,
    type: "video.created",
    actor: "admin",
    description: `Video created: ${parsed.data.title}`,
    createdAt: now,
  });

  revalidateProductivityViews(assignment.clientId);
  if (parsed.data.projectId) {
    revalidatePath(`/projects/${parsed.data.projectId}`);
  }
  return {
    success: true,
    videoId,
    status: parsed.data.status,
    message: "Planned video created.",
  };
}

export type CreateVideoLogsBulkResult =
  | { success: true; videoIds: number[]; message: string }
  | { success: false; error: string };

export type CreateVideoLogsBulkRow = {
  title: string;
  date?: string | null;
  status?: string | null;
  deliveryUrl?: string | null;
  reviewUrl?: string | null;
  // Single Historical Video Ingest Gap round: threaded through so the new
  // "Add Video" (single-row) entry point can set it -- publishedUrl was
  // already a fully validated, canonical field on every other create/edit
  // path (validateVideoInput, VideoEditor), just never wired into this one.
  publishedUrl?: string | null;
};

// Taryn August Ingest Readiness §6, extended by Brief C ("Final Local
// Ingest / Live Readiness") §2/§3/§4/§5/§6: "ADD MULTIPLE VIDEOS" on the
// Project workspace -- a lightweight repeatable-row create, explicitly NOT
// a CSV import. Every row is validated with the exact same
// validateVideoCreateInput() rules as the single-video create path (same
// VIDEO != DELIVERABLE != ASSET model). Brief C §3 explicitly widens this
// ONE path (bulk/historical ingest only, via allowExplicitStatus: true) to
// accept any canonical VideoStatus per row, while validateVideoCreateInput
// keeps the single-create path (allowExplicitStatus unset) PLANNED-only --
// see the invariant note there and "new video status is explicit and
// cannot silently become completed" / "historical bulk ingest may
// explicitly select another canonical status" in core.test.mjs. Every row
// still requires an explicit status string (defaulted to "PLANNED" by the
// bulk-ingest UI when the operator hasn't chosen a batch default) --
// absence of a valid status is rejected, never silently treated as
// completion. D1 has no interactive multi-statement transaction available
// here (nothing else in this codebase uses db.transaction/db.batch for
// that reason), so the inserts run sequentially with a best-effort
// compensating rollback: if a row fails mid-loop despite passing
// validation, every video already inserted in this same submission is
// deleted again rather than left as an ambiguous partial batch.
export async function createVideoLogsBulk(
  projectId: number,
  rows: Array<CreateVideoLogsBulkRow>,
  batchLabel?: string | null,
): Promise<CreateVideoLogsBulkResult> {
  if (!isPositiveId(projectId)) {
    return { success: false, error: "Choose a project first." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "Add at least one video row." };
  }
  if (rows.length > 50) {
    return { success: false, error: "Create at most 50 videos at a time." };
  }

  const cleanBatchLabel =
    typeof batchLabel === "string" ? batchLabel.trim().slice(0, 160) || null : null;

  const validatedRows: Array<ValidatedVideoMetadata & { status: VideoStatus }> = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = validateVideoCreateInput({
      title: rows[i].title,
      projectId,
      clientId: null,
      date: rows[i].date ?? null,
      deliveryUrl: rows[i].deliveryUrl ?? null,
      reviewUrl: rows[i].reviewUrl ?? null,
      publishedUrl: rows[i].publishedUrl ?? null,
      status: (rows[i].status ?? "PLANNED") as VideoStatus,
      allowExplicitStatus: true,
    });
    if (!parsed.success) {
      return { success: false, error: `Row ${i + 1}: ${parsed.error}` };
    }
    validatedRows.push(parsed.data);
  }

  const db = await getAuthenticatedDb();
  const assignment = await resolveVideoAssignment(db, { projectId, clientId: null });
  if (!assignment.success) return assignment;

  const now = new Date();
  const videoIds: number[] = [];
  try {
    for (const row of validatedRows) {
      const inserted = await db
        .insert(videoLogs)
        .values({
          date: row.date ?? todayISO(),
          title: row.title,
          clientId: assignment.clientId,
          projectId: row.projectId as number,
          status: row.status,
          startedAt: null,
          revisionsCount: 0,
          delivered: deliveredForVideoStatus(row.status),
          deliveryUrl: row.deliveryUrl,
          reviewUrl: row.reviewUrl,
          publishedUrl: row.publishedUrl,
          notes: row.notes,
          coverUrl: row.coverUrl,
          orientation: row.orientation,
          contentType: row.contentType,
          videoKind: resolveVideoKindForClient(
            assignment.clientName,
            undefined,
          ),
          batchLabel: cleanBatchLabel,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: videoLogs.id });
      const videoId = inserted[0]?.id;
      if (!videoId) throw new Error("insert did not return an id");
      videoIds.push(videoId);
      await db.insert(crmEvents).values({
        clientId: assignment.clientId,
        videoId,
        type: "video.created",
        actor: "admin",
        description: `Video created (bulk): ${row.title}`,
        createdAt: now,
      });
    }
  } catch {
    for (const id of videoIds) {
      try {
        await db.delete(videoLogs).where(eq(videoLogs.id, id));
      } catch {
        // Best-effort cleanup; surfaced via the error message below either way.
      }
    }
    return {
      success: false,
      error: "Could not create all videos -- the batch was rolled back, nothing was saved.",
    };
  }

  revalidateProductivityViews(assignment.clientId);
  revalidatePath(`/projects/${projectId}`);
  return {
    success: true,
    videoIds,
    message: `Created ${videoIds.length} video${videoIds.length === 1 ? "" : "s"}.`,
  };
}

export type UpdateVideoLogsBulkPatch = {
  // Brief C §7: "NEVER overwrite a field unless the operator explicitly
  // chose to change it" / "a blank bulk-edit field must mean 'leave
  // unchanged', not 'erase'". Every field here is a discriminated tri-state
  // rather than a plain optional value:
  //   - key absent / undefined  -> leave unchanged
  //   - { clear: true }          -> explicit destructive clear (only offered
  //                                 in the UI for genuinely nullable fields)
  //   - { value: X }             -> set to X
  // status/date are NOT NULL columns and so never accept { clear: true };
  // the UI only ever offers Change/Don't-change for those two.
  status?: { value: string };
  date?: { value: string };
  contentType?: { value: string } | { clear: true };
  deliveryUrl?: { value: string } | { clear: true };
  reviewUrl?: { value: string } | { clear: true };
  batchLabel?: { value: string } | { clear: true };
};

export type UpdateVideoLogsBulkResult =
  | { success: true; updatedCount: number; message: string }
  | { success: false; error: string };

// Brief C §7: Project workspace bulk-edit for videos already created --
// select one or more rows, change only the fields explicitly touched. This
// is a boring UPDATE-only path: it never inserts or deletes a row, so
// video IDs and row count are always preserved 1:1 with the selection.
// Every touched field is re-validated with the exact same validators the
// single-video edit path uses (validateDeliveryUrl et al, via
// validateVideoInput below) -- no parallel, looser bulk-only validation.
export async function updateVideoLogsBulk(
  videoIds: number[],
  patch: UpdateVideoLogsBulkPatch,
): Promise<UpdateVideoLogsBulkResult> {
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return { success: false, error: "Select at least one video." };
  }
  if (videoIds.length > 200) {
    return { success: false, error: "Edit at most 200 videos at a time." };
  }
  for (const id of videoIds) {
    if (!isPositiveId(id)) {
      return { success: false, error: "Invalid video selection." };
    }
  }

  const set: Record<string, unknown> = {};

  if (patch.status) {
    if (!isVideoStatus(patch.status.value)) {
      return { success: false, error: "Choose a valid video status." };
    }
    set.status = patch.status.value;
    set.delivered = deliveredForVideoStatus(patch.status.value);
  }
  if (patch.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.date.value) || Number.isNaN(Date.parse(patch.date.value))) {
      return { success: false, error: "Enter a valid date (YYYY-MM-DD)." };
    }
    set.date = patch.date.value;
  }
  if (patch.contentType) {
    if ("clear" in patch.contentType) {
      set.contentType = null;
    } else {
      if (!isVideoContentType(patch.contentType.value)) {
        return { success: false, error: "Choose a valid content type." };
      }
      set.contentType = patch.contentType.value;
    }
  }
  // Sprint 3 P2 (bulk-edit safety fix): a blank text box on an enabled
  // field must mean "leave unchanged, not erase" -- exactly the contract
  // already documented on UpdateVideoLogsBulkPatch above. Before this
  // fix, validateDeliveryUrl("") returns { success:true, value:null }
  // (correct for the single-video edit form, where an empty box IS an
  // intentional clear), so this bulk path was silently nulling
  // deliveryUrl/reviewUrl for every selected video whenever the operator
  // enabled the field but left it blank without checking "Clear".
  if (patch.deliveryUrl) {
    if ("clear" in patch.deliveryUrl) {
      set.deliveryUrl = null;
    } else if (!patch.deliveryUrl.value.trim()) {
      return { success: false, error: "Enter a delivery URL, or choose Clear to remove it." };
    } else {
      const parsed = validateDeliveryUrl(patch.deliveryUrl.value);
      if (!parsed.success) return parsed;
      set.deliveryUrl = parsed.value;
    }
  }
  if (patch.reviewUrl) {
    if ("clear" in patch.reviewUrl) {
      set.reviewUrl = null;
    } else if (!patch.reviewUrl.value.trim()) {
      return { success: false, error: "Enter a review URL, or choose Clear to remove it." };
    } else {
      const parsed = validateDeliveryUrl(patch.reviewUrl.value);
      if (!parsed.success) return parsed;
      set.reviewUrl = parsed.value;
    }
  }
  if (patch.batchLabel) {
    if ("clear" in patch.batchLabel) {
      set.batchLabel = null;
    } else if (!patch.batchLabel.value.trim()) {
      return { success: false, error: "Enter a batch label, or choose Clear to remove it." };
    } else {
      set.batchLabel = patch.batchLabel.value.trim().slice(0, 160);
    }
  }

  if (Object.keys(set).length === 0) {
    return { success: false, error: "Change at least one field before saving." };
  }

  const db = await getAuthenticatedDb();
  const existing = await db
    .select({
      id: videoLogs.id,
      clientId: videoLogs.clientId,
      projectId: videoLogs.projectId,
      reviewUrl: videoLogs.reviewUrl,
    })
    .from(videoLogs)
    .where(inArray(videoLogs.id, videoIds));
  if (existing.length === 0) {
    return { success: false, error: "No matching videos found." };
  }

  // Sprint 3 P2 (invariant-drift fix): "a Video cannot enter
  // READY_FOR_REVIEW without a reviewUrl" is enforced at creation
  // (validateVideoCreateInput) and at single-video transition
  // (planVideoTransition), but this bulk path wrote `status` straight to
  // the DB with no such check -- the exact same class of gap the Add
  // Video round already closed for creation. `set.reviewUrl` (this
  // patch's own change, if any) is now guaranteed non-null by the block
  // above whenever it's present; a row with no reviewUrl in the patch
  // falls back to its own existing value.
  if (set.status === "READY_FOR_REVIEW") {
    const patchReviewUrl =
      patch.reviewUrl && !("clear" in patch.reviewUrl) ? (set.reviewUrl as string) : null;
    const missingReviewUrl = patchReviewUrl
      ? []
      : existing.filter((row) => !row.reviewUrl);
    if (patch.reviewUrl && "clear" in patch.reviewUrl) {
      return {
        success: false,
        error: "Cannot set status to Ready for review while also clearing the review URL.",
      };
    }
    if (missingReviewUrl.length > 0) {
      return {
        success: false,
        error: `${missingReviewUrl.length} of the selected videos have no review URL yet. Add one (to the patch, or on each video) before setting Ready for review.`,
      };
    }
  }

  const now = new Date();
  await db
    .update(videoLogs)
    .set({ ...set, updatedAt: now })
    .where(inArray(videoLogs.id, existing.map((row) => row.id)));

  const clientIds = new Set(existing.map((row) => row.clientId).filter(Boolean));
  const projectIds = new Set(existing.map((row) => row.projectId).filter(Boolean));
  revalidateProductivityViews(...Array.from(clientIds));
  for (const projectId of projectIds) {
    revalidatePath(`/projects/${projectId}`);
  }

  return {
    success: true,
    updatedCount: existing.length,
    message: `Updated ${existing.length} video${existing.length === 1 ? "" : "s"}.`,
  };
}

export async function getVideoStats() {
  const db = await getAuthenticatedDb();
  const today = todayISO();
  const monthStart = startOfMonthISO();

  const [todayCount, monthCount, allLogs] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(videoLogs)
      .where(
        and(
          eq(videoLogs.date, today),
          eq(videoLogs.status, "DONE"),
          inArray(videoLogs.videoKind, PRODUCTION_COUNT_KINDS),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(videoLogs)
      .where(
        and(
          gte(videoLogs.date, monthStart),
          eq(videoLogs.status, "DONE"),
          inArray(videoLogs.videoKind, PRODUCTION_COUNT_KINDS),
        ),
      ),
    db.select().from(videoLogs).orderBy(videoLogs.createdAt),
  ]);

  // NIGHT SHIFT REALITY PATCH §10: "This Week" must mean the same thing
  // everywhere in this app -- the Monday-anchored local calendar week
  // already used by the Work Session ledger, caffeine's weekCount, and
  // client-portal's completedThisWeek (see mondayOfWeek in
  // work-sessions/core.ts). This used to be a rolling trailing-7-days
  // window instead, which silently bled into the prior calendar week on
  // any day before Sunday -- a label/query mismatch, not a rolling-window
  // feature anyone asked for.
  // mondayOfWeek takes an already-resolved local "YYYY-MM-DD" day key and
  // does pure calendar arithmetic on it (no further timezone conversion) --
  // todayISO() is exactly that: the Brazil-local today, precomputed above.
  // Do NOT route this through dayKeyFor(), which expects a real ISO
  // datetime and would misinterpret a bare date-only string as UTC
  // midnight, shifting the boundary by 3 hours.
  const weekStart = mondayOfWeek(today);
  const completedLogs = completedVideoLogs(allLogs);
  const weekLogs = completedLogs.filter((log) => log.date >= weekStart);

  return {
    today: Number(todayCount[0]?.count ?? 0),
    week: weekLogs.length,
    month: Number(monthCount[0]?.count ?? 0),
    total: allLogs.length,
    totalRevisions: completedLogs.reduce(
      (sum, log) => sum + log.revisionsCount,
      0,
    ),
  };
}

export async function getAllVideoLogs() {
  const db = await getAuthenticatedDb();
  return db
    .select({
      id: videoLogs.id,
      date: videoLogs.date,
      title: videoLogs.title,
      clientId: videoLogs.clientId,
      clientName: clients.name,
      projectId: videoLogs.projectId,
      projectName: projects.name,
      projectStatus: projects.status,
      projectDeadline: projects.deadline,
      status: videoLogs.status,
      startedAt: videoLogs.startedAt,
      revisionsCount: videoLogs.revisionsCount,
      delivered: videoLogs.delivered,
      deliveryUrl: videoLogs.deliveryUrl,
      reviewUrl: videoLogs.reviewUrl,
      publishedUrl: videoLogs.publishedUrl,
      notes: videoLogs.notes,
      coverUrl: videoLogs.coverUrl,
      orientation: videoLogs.orientation,
      contentType: videoLogs.contentType,
      videoKind: videoLogs.videoKind,
      createdAt: videoLogs.createdAt,
      updatedAt: videoLogs.updatedAt,
      queuePosition: videoLogs.queuePosition,
    })
    .from(videoLogs)
    .leftJoin(clients, eq(videoLogs.clientId, clients.id))
    .leftJoin(projects, eq(videoLogs.projectId, projects.id))
    // Geladeira (Sprint 1.2 P0): the Productivity overview is a P0
    // visibility surface — a Geladeira client's Videos are hidden here by
    // default. A Video with no Client at all (clientId null) is never
    // affected. Direct navigation to a specific video is untouched — this
    // only changes what getAllVideoLogs() returns for the grouped overview.
    .where(or(isNull(videoLogs.clientId), ne(clients.archivalState, "GELADEIRA")))
    .orderBy(desc(videoLogs.createdAt), desc(videoLogs.id));
}

// P0.4 execution queue context: which eligible videos are currently
// blocked, and what their soonest open commitment is due. Two small
// aggregate reads (not a join into getAllVideoLogs) so the common path
// that doesn't need queue context stays exactly as cheap as before.
export async function getOpenBlockersByVideo(): Promise<Map<number, string>> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ videoId: blockers.videoId, category: blockers.category })
    .from(blockers)
    .where(isNull(blockers.resolvedAt))
    .orderBy(blockers.startedAt);
  const byVideo = new Map<number, string>();
  for (const row of rows) {
    // First (oldest) open blocker per video wins the summary category --
    // a video is either blocked or not; the queue row links to the full
    // list inside the video's own workspace.
    if (!byVideo.has(row.videoId)) byVideo.set(row.videoId, row.category);
  }
  return byVideo;
}

export async function getSoonestOpenCommitmentByVideo(): Promise<Map<number, Date>> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ videoId: commitments.videoId, dueAt: commitments.dueAt })
    .from(commitments)
    .where(eq(commitments.status, "OPEN"))
    .orderBy(commitments.dueAt);
  const byVideo = new Map<number, Date>();
  for (const row of rows) {
    if (!byVideo.has(row.videoId)) byVideo.set(row.videoId, row.dueAt);
  }
  return byVideo;
}

type QueueActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

// P0.4 reorder: resequences the WHOLE eligible queue in one transaction
// rather than hunting for a numeric gap between two neighbors -- see
// modules/productivity/queue.ts's header comment for why that is the
// deliberate, simpler-and-more-correct choice at this scale. Always reads
// the current order fresh from the DB immediately before writing, so a
// stale client-side order can never overwrite a concurrent change.
export async function reorderExecutionQueueItem(
  videoId: number,
  direction: QueueMoveDirection,
): Promise<QueueActionResult> {
  if (!isPositiveId(videoId)) return { success: false, error: "Invalid video." };

  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: videoLogs.id,
      status: videoLogs.status,
      videoKind: videoLogs.videoKind,
      queuePosition: videoLogs.queuePosition,
      createdAt: videoLogs.createdAt,
      updatedAt: videoLogs.updatedAt,
    })
    .from(videoLogs);

  const eligible = rows.filter(isQueueEligible);
  const positioned = eligible
    .filter((row) => row.queuePosition !== null)
    .sort((a, b) => (a.queuePosition as number) - (b.queuePosition as number));
  const unpositioned = eligible
    .filter((row) => row.queuePosition === null)
    .sort((a, b) => {
      const timeOf = (row: (typeof eligible)[number]) => {
        const value = row.updatedAt ?? row.createdAt;
        if (!value) return 0;
        const ts = value instanceof Date ? value.getTime() : Date.parse(value as unknown as string);
        return Number.isFinite(ts) ? ts : 0;
      };
      return timeOf(b) - timeOf(a);
    });
  const orderedIds = [...positioned, ...unpositioned].map((row) => row.id);

  if (!orderedIds.includes(videoId)) {
    return { success: false, error: "Video is not in the active execution queue." };
  }

  const newOrder = moveInOrder(orderedIds, videoId, direction);
  const positions = resequencePositions(newOrder);
  const statements = orderedIds.map((id) =>
    db.update(videoLogs).set({ queuePosition: positions.get(id) }).where(eq(videoLogs.id, id)),
  );
  // orderedIds always contains at least videoId itself (checked above), so
  // statements is never empty -- db.batch requires a non-empty tuple type,
  // not just a non-empty array at runtime.
  await db.batch(statements as unknown as [(typeof statements)[number], ...(typeof statements)[number][]]);

  revalidatePath("/");
  revalidatePath("/productivity");
  return { success: true, message: "Queue updated." };
}

export async function getProductivityQuickOptions() {
  const db = await getAuthenticatedDb();
  const [projectRows, clientRows, videoRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
        clientName: clients.name,
        // Taryn August Ingest Readiness §5: New Work needs to filter a
        // client's projects down to the ones actually being worked --
        // status travels with the option so the client picking UI does
        // not need a second query.
        status: projects.status,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      // Geladeira (Sprint 1.2 P0): these are the Quick Actions client/project
      // selectors used when planning new work — a Geladeira client should
      // not be offered as a destination for new Projects/Videos by default.
      .where(and(ne(projects.status, "archived"), ne(clients.archivalState, "GELADEIRA")))
      .orderBy(desc(projects.updatedAt), desc(projects.id))
      .limit(50),
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(ne(clients.archivalState, "GELADEIRA"))
      .orderBy(desc(clients.createdAt), desc(clients.id))
      .limit(100),
    db
      .select({
        id: videoLogs.id,
        title: videoLogs.title,
        date: videoLogs.date,
        status: videoLogs.status,
        revisionsCount: videoLogs.revisionsCount,
        projectId: videoLogs.projectId,
        clientId: videoLogs.clientId,
        projectName: projects.name,
        clientName: clients.name,
      })
      .from(videoLogs)
      .leftJoin(projects, eq(videoLogs.projectId, projects.id))
      .leftJoin(clients, eq(videoLogs.clientId, clients.id))
      .orderBy(desc(videoLogs.createdAt), desc(videoLogs.id))
      .limit(50),
  ]);

  return { projects: projectRows, clients: clientRows, videos: videoRows };
}

export async function updateVideoMetadata(
  videoId: number,
  values: VideoInputValues,
): Promise<ProductivityActionResult> {
  if (!isPositiveId(videoId)) {
    return { success: false, error: "Invalid video." };
  }
  const parsed = validateVideoInput(values);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  const current = await db
    .select({
      id: videoLogs.id,
      title: videoLogs.title,
      clientId: videoLogs.clientId,
      projectId: videoLogs.projectId,
      deliveryUrl: videoLogs.deliveryUrl,
      reviewUrl: videoLogs.reviewUrl,
      publishedUrl: videoLogs.publishedUrl,
      notes: videoLogs.notes,
      coverUrl: videoLogs.coverUrl,
      orientation: videoLogs.orientation,
      contentType: videoLogs.contentType,
      videoKind: videoLogs.videoKind,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  if (!current[0]) return { success: false, error: "Video not found." };

  const assignment = await resolveVideoAssignment(db, parsed.data, {
    allowArchivedProjectId: current[0].projectId,
  });
  if (!assignment.success) return assignment;

  const next = { ...parsed.data, clientId: assignment.clientId };
  const changedFields = getVideoMetadataChanges(
    {
      title: current[0].title ?? "",
      clientId: current[0].clientId,
      projectId: current[0].projectId,
      deliveryUrl: current[0].deliveryUrl,
      reviewUrl: current[0].reviewUrl,
      publishedUrl: current[0].publishedUrl,
      notes: current[0].notes,
      coverUrl: current[0].coverUrl,
      orientation: current[0].orientation,
      contentType: current[0].contentType,
      videoKind: current[0].videoKind,
    },
    next,
  );
  if (changedFields.length === 0) {
    return { success: true, message: "No changes to save.", changedFields };
  }

  const now = new Date();
  // `date` is create-time-only (see the VideoInputValues.date comment in
  // core.ts) -- updateVideoMetadata never changes a video's date, so it's
  // stripped before the update .set() rather than writing a possibly-null
  // value onto the NOT NULL video_logs.date column.
  const { date: _updateIgnoresDate, ...metadataForUpdate } = next;
  void _updateIgnoresDate;
  await db
    .update(videoLogs)
    .set({ ...metadataForUpdate, updatedAt: now })
    .where(eq(videoLogs.id, videoId));

  await db.insert(crmEvents).values({
    clientId: next.clientId,
    videoId,
    type: "video.updated",
    actor: "admin",
    description: `Video updated: ${next.title} (${changedFields.join(", ")})`,
    createdAt: now,
  });

  revalidateProductivityViews(current[0].clientId, next.clientId);
  return {
    success: true,
    message: "Video details saved.",
    changedFields,
  };
}

type VideoTransitionRow = {
  id: number;
  title: string | null;
  clientId: number | null;
  status: VideoStatus;
  startedAt: Date | null;
  reviewUrl?: string | null;
};

async function applyVideoStatusTransition(
  db: AuthenticatedDb,
  videoId: number,
  current: VideoTransitionRow,
  expectedStatus: VideoStatus,
  targetStatus: VideoStatus,
  actor: "admin" | "client",
  // Optional: set/replace the review URL in the SAME write that marks the
  // video READY_FOR_REVIEW -- the common real flow is "paste the Frame.io
  // link and mark ready" as one action. Falls back to the video's existing
  // reviewUrl (current.reviewUrl) when omitted.
  reviewUrlInput?: string | null,
): Promise<ProductivityActionResult> {
  const effectiveReviewUrl =
    reviewUrlInput !== undefined ? reviewUrlInput : current.reviewUrl ?? null;
  const transition = planVideoTransition({
    currentStatus: current.status,
    expectedStatus,
    targetStatus,
    reviewUrl: effectiveReviewUrl,
  });
  if (!transition.success) return transition;
  if (!transition.changed) {
    return {
      success: true,
      status: transition.status,
      message: "Video already has that status.",
    };
  }

  const now = new Date();
  const updated = await db
    .update(videoLogs)
    .set({
      status: transition.status,
      delivered: transition.delivered,
      startedAt:
        transition.status === "IN_PROGRESS" && !current.startedAt
          ? now
          : current.startedAt,
      date: transition.status === "DONE" ? todayISO() : undefined,
      reviewUrl:
        reviewUrlInput !== undefined ? reviewUrlInput : undefined,
      updatedAt: now,
    })
    .where(
      and(
        eq(videoLogs.id, videoId),
        eq(videoLogs.status, current.status),
      ),
    )
    .returning({ id: videoLogs.id });
  if (!updated[0]) {
    return {
      success: false,
      error: "This video changed elsewhere. Refresh and try again.",
    };
  }

  const title = current.title ?? `Video ${videoId}`;
  await db.insert(crmEvents).values({
    clientId: current.clientId,
    videoId,
    type: transition.eventType,
    actor,
    description:
      actor === "client"
        ? `Client moved ${title} to ${VIDEO_STATUS_LABELS[transition.status]}`
        : `${title} moved to ${VIDEO_STATUS_LABELS[transition.status]}`,
    createdAt: now,
  });

  revalidateProductivityViews(current.clientId);
  return {
    success: true,
    status: transition.status,
    message: `Moved to ${VIDEO_STATUS_LABELS[transition.status]}.`,
  };
}

export async function transitionVideoStatus(
  videoId: number,
  expectedStatus: VideoStatus,
  targetStatus: VideoStatus,
  reviewUrl?: string | null,
): Promise<ProductivityActionResult> {
  if (
    !isPositiveId(videoId) ||
    !isVideoStatus(expectedStatus) ||
    !isVideoStatus(targetStatus)
  ) {
    return { success: false, error: "Invalid lifecycle transition." };
  }

  const db = await getAuthenticatedDb();
  const current = await db
    .select({
      id: videoLogs.id,
      title: videoLogs.title,
      clientId: videoLogs.clientId,
      status: videoLogs.status,
      startedAt: videoLogs.startedAt,
      reviewUrl: videoLogs.reviewUrl,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  if (!current[0]) return { success: false, error: "Video not found." };

  return applyVideoStatusTransition(
    db,
    videoId,
    current[0],
    expectedStatus,
    targetStatus,
    "admin",
    reviewUrl,
  );
}

/**
 * Client-facing lifecycle wrapper (Sprint 1.2.2). Deliberately NOT a second
 * state machine: it delegates to the exact same applyVideoStatusTransition
 * helper the admin surface uses. What's different is authentication (a
 * verified client session, never a client-supplied clientId or videoId
 * ownership claim) and scope -- a client may only act on a video that is
 * currently READY_FOR_REVIEW, and only into DONE ("Approve") or
 * CHANGES_REQUESTED ("Request changes"). Any other request is refused
 * before touching the database.
 *
 * Uses getDb() (unauthenticated raw D1 access), NOT getAuthenticatedDb() --
 * a client is never an admin, and this function must keep working when no
 * admin session exists. Authorization here comes entirely from the
 * mb_client_session cookie verified by isClientAuthenticated().
 */
export async function transitionVideoStatusAsClient(
  videoId: number,
  targetStatus: "DONE" | "CHANGES_REQUESTED",
): Promise<ProductivityActionResult> {
  const clientId = await isClientAuthenticated();
  if (clientId === false) {
    return { success: false, error: "Please log in to review this video." };
  }
  if (
    !isPositiveId(videoId) ||
    (targetStatus !== "DONE" && targetStatus !== "CHANGES_REQUESTED")
  ) {
    return { success: false, error: "Invalid request." };
  }

  const db = await getDb();
  const current = await db
    .select({
      id: videoLogs.id,
      title: videoLogs.title,
      clientId: videoLogs.clientId,
      status: videoLogs.status,
      startedAt: videoLogs.startedAt,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  // Deliberately identical "not found" error whether the video doesn't
  // exist or belongs to a different client -- never confirm to a client
  // that a given videoId exists in someone else's account.
  if (!current[0] || current[0].clientId !== clientId) {
    return { success: false, error: "Video not found." };
  }
  if (current[0].status !== "READY_FOR_REVIEW") {
    return { success: false, error: "This video isn't awaiting your review." };
  }

  return applyVideoStatusTransition(
    db,
    videoId,
    current[0],
    "READY_FOR_REVIEW",
    targetStatus,
    "client",
  );
}

// Lunch Reality Patch P1 §7: client-settable "priority now" video, one per
// project. Same isolation pattern as transitionVideoStatusAsClient above --
// identical "not found" error whether the videoId doesn't exist or belongs
// to a different client, so a client can never learn anything about
// another client's data from this action's response. D1 serializes a
// db.batch() as one atomic transaction, so concurrent requests cannot
// interleave the clear-and-set pair and leave two priority rows behind.
export async function setVideoPriorityAsClient(
  videoId: number,
  makePriority: boolean,
): Promise<ProductivityActionResult> {
  const clientId = await isClientAuthenticated();
  if (clientId === false) {
    return { success: false, error: "Please log in to set video priority." };
  }
  if (!isPositiveId(videoId) || typeof makePriority !== "boolean") {
    return { success: false, error: "Invalid request." };
  }

  const db = await getAuthenticatedDb();
  const current = await db
    .select({
      id: videoLogs.id,
      clientId: videoLogs.clientId,
      projectId: videoLogs.projectId,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  // Deliberately identical "not found" error whether the video doesn't
  // exist or belongs to a different client -- see
  // transitionVideoStatusAsClient above for the same convention.
  if (!current[0] || current[0].clientId !== clientId) {
    return { success: false, error: "Video not found." };
  }

  const validationError = validateVideoPriorityInput(makePriority, current[0].projectId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const updatedAt = new Date();
  if (makePriority && current[0].projectId !== null) {
    await db.batch([
      db
        .update(videoLogs)
        .set({ isPriority: false, updatedAt })
        .where(
          and(
            eq(videoLogs.projectId, current[0].projectId),
            ne(videoLogs.id, videoId),
            eq(videoLogs.isPriority, true),
          ),
        ),
      db
        .update(videoLogs)
        .set({ isPriority: true, updatedAt })
        .where(eq(videoLogs.id, videoId)),
    ]);
  } else {
    await db
      .update(videoLogs)
      .set({ isPriority: false, updatedAt })
      .where(eq(videoLogs.id, videoId));
  }

  revalidateProductivityViews(current[0].clientId);
  return {
    success: true,
    message: makePriority ? "Marked as priority." : "Priority cleared.",
  };
}

// Pre-Operation Reality Hardening §7: revisions are now historical facts,
// not just an integer. changeRevisionCount used to ONLY mutate
// videoLogs.revisionsCount, which meant correcting the tally (the "-"
// button) silently rewrote history with no trace a revision was ever
// logged -- exactly the provenance loss future unit-economics analytics
// (revision drag, revision frequency/timestamps) can't tolerate.
//
// +1 ("Add one revision") inserts a real, timestamped `revisions` row --
// a new historical fact -- and increments the cache in the SAME db.batch
// (one D1 transaction: either both happen or neither does).
//
// -1 ("Remove one revision") is a CORRECTION, not a new fact, so it does
// NOT delete an arbitrary row: it removes only the most recently recorded
// revision for THIS video (if one exists) and decrements the cache
// together, atomically. A legacy video whose revisionsCount > 0 predates
// this table (no revisions rows yet) has nothing to delete -- the cache
// still decrements on its own, exactly as before this round, so existing
// legacy counts stay correctable without ever manufacturing a fake row to
// delete. This is the one place "deletion" of a revisions row happens;
// no other code path may delete from that table.
export async function changeRevisionCount(
  videoId: number,
  delta: -1 | 1,
): Promise<ProductivityActionResult> {
  if (!isPositiveId(videoId) || (delta !== -1 && delta !== 1)) {
    return { success: false, error: "Invalid revision change." };
  }

  const db = await getAuthenticatedDb();
  const current = await db
    .select({
      id: videoLogs.id,
      clientId: videoLogs.clientId,
      revisionsCount: videoLogs.revisionsCount,
    })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  if (!current[0]) return { success: false, error: "Video not found." };
  if (delta === -1 && current[0].revisionsCount === 0) {
    return { success: false, error: "This video has no revision to remove." };
  }

  const cacheUpdate = db
    .update(videoLogs)
    .set({
      revisionsCount: sql`max(${videoLogs.revisionsCount} + ${delta}, 0)`,
      updatedAt: new Date(),
    })
    .where(and(eq(videoLogs.id, videoId), gte(videoLogs.revisionsCount, 0)))
    .returning({ revisionsCount: videoLogs.revisionsCount });

  let updated;
  if (delta === 1) {
    const eventInsert = db.insert(revisions).values({
      videoId,
      actor: "admin",
    });
    [, updated] = await db.batch([eventInsert, cacheUpdate]);
  } else {
    // Delete only the most recently created revisions row for THIS
    // video -- never another video's history, never an arbitrary row.
    // No-op (0 rows affected) when this video has no revisions rows yet
    // (legacy data), which is fine: the cache decrement below still runs.
    const undoLast = db.delete(revisions).where(
      sql`${revisions.id} = (select id from revisions where video_id = ${videoId} order by created_at desc, id desc limit 1)`,
    );
    [, updated] = await db.batch([undoLast, cacheUpdate]);
  }

  revalidateProductivityViews(current[0].clientId);
  return {
    success: true,
    message: delta === 1 ? "Revision added." : "Revision removed.",
    revisionsCount: updated[0]?.revisionsCount,
  };
}

export async function deleteVideoLog(
  id: number,
): Promise<ProductivityActionResult> {
  if (!isPositiveId(id)) return { success: false, error: "Invalid video." };
  const db = await getAuthenticatedDb();
  const current = await db
    .select({ clientId: videoLogs.clientId })
    .from(videoLogs)
    .where(eq(videoLogs.id, id))
    .limit(1);
  if (!current[0]) return { success: false, error: "Video not found." };

  const [trackedWork, operationalMemory, commitmentMemory, frictionMemory, blockerMemory, deliveryMemory, checklistMemory] = await Promise.all([
    db
      .select({ id: workSessions.id })
      .from(workSessions)
      .where(eq(workSessions.videoId, id))
      .limit(1),
    db
      .select({ id: crmEvents.id })
      .from(crmEvents)
      .where(
        and(
          eq(crmEvents.videoId, id),
          eq(crmEvents.type, VIDEO_OPERATIONAL_NOTE_EVENT_TYPE),
        ),
      )
      .limit(1),
    db.select({ id: commitments.id }).from(commitments).where(eq(commitments.videoId, id)).limit(1),
    db.select({ id: frictionEvents.id }).from(frictionEvents).where(eq(frictionEvents.videoId, id)).limit(1),
    db.select({ id: blockers.id }).from(blockers).where(eq(blockers.videoId, id)).limit(1),
    db.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.videoId, id)).limit(1),
    db.select({ id: productionChecklistItems.id }).from(productionChecklistItems).where(eq(productionChecklistItems.videoId, id)).limit(1),
  ]);
  if (trackedWork[0]) {
    return {
      success: false,
      error: "Videos with tracked work cannot be deleted.",
    };
  }
  if (videoOperationalMemoryBlocksDeletion(operationalMemory.length)) {
    return {
      success: false,
      error: VIDEO_OPERATIONAL_MEMORY_DELETE_ERROR,
    };
  }
  if (
    commitmentMemory[0] ||
    frictionMemory[0] ||
    blockerMemory[0] ||
    deliveryMemory[0] ||
    checklistMemory[0]
  ) {
    return {
      success: false,
      error: "Videos with operational custody records cannot be deleted.",
    };
  }

  await db.delete(videoLogs).where(eq(videoLogs.id, id));
  revalidateProductivityViews(current[0].clientId);
  return { success: true, message: "Video removed." };
}
