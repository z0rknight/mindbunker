"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { activitywatchEvents, activitywatchImports } from "@/db/schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  emptyActivityWatchImportSummary,
  foldNormalizedEventIntoSummary,
  foldRejectionIntoSummary,
  scanActivityWatchEventsFromStream,
  type ActivityWatchBucketType,
  type ActivityWatchImportSummary,
  type NormalizedActivityWatchEvent,
} from "./core.ts";
import {
  CONFIRM_INSERT_ROWS_PER_STATEMENT,
  CONFIRM_STATEMENTS_PER_BATCH,
  PREVIEW_DEDUPE_CHECK_BATCH_SIZE,
} from "./config.ts";

// ARCHITECTURE (Pre-Operation Reality Hardening — ActivityWatch Import):
//
// A real ActivityWatch window-watcher export can be ~64MB, AFK ~12MB. A
// standard Cloudflare Worker isolate has roughly 128MB of memory, and a
// traditional Server Action receiving/parsing the whole JSON body (or a
// route handler calling request.json()/request.text()) would materialize
// that entire file as one JS string (UTF-16 internally, so a 64MB UTF-8
// file can already be ~128MB in memory) plus the fully parsed object
// graph on top of it -- not a safe assumption at this scale. So the flow
// here is three separate steps, and NONE of them ever buffers a whole
// file in a JS variable:
//
//   1. UPLOAD (route handler, src/app/api/activitywatch/upload/route.ts):
//      the browser POSTs the raw file bytes directly (not multipart
//      FormData, which Next/undici would still buffer). The route handler
//      pipes request.body -- a ReadableStream -- straight into
//      env.MEDIA.put(), so R2 receives the file as a stream; the Worker
//      never holds more than R2's own internal chunk buffers in memory.
//      The browser computes the whole-file SHA-256 fingerprint itself
//      (trivial for a browser tab to hold 64MB; not true for a Worker
//      isolate) and sends it alongside.
//
//   2. PREVIEW (previewActivityWatchImport below, a Server Action): reads
//      the now-staged R2 object back as a stream
//      (scanActivityWatchEventsFromStream in core.ts), normalizing one
//      event at a time and batching ONLY small groups of fingerprints
//      (PREVIEW_DEDUPE_CHECK_BATCH_SIZE) for a D1 existence check. Fully
//      read-only -- no row is written anywhere. Memory use is bounded by
//      one batch's worth of pending events, never by file size.
//
//   3. CONFIRM (confirmActivityWatchImport below, a Server Action):
//      re-reads the SAME R2 object the same streaming way (stateless --
//      nothing from Preview needs to survive between requests) and writes
//      normalized events in small multi-row INSERT statements
//      (CONFIRM_INSERT_ROWS_PER_STATEMENT rows/statement,
//      CONFIRM_STATEMENTS_PER_BATCH statements/db.batch() call), each
//      using onConflictDoNothing on the fingerprint unique index so a
//      re-run of the exact same file is a true no-op at the row level,
//      not just at the file-fingerprint fast-path level checked first.
//
// Residual, explicitly unverified risk (see the final report): CPU/wall-
// clock time for step 3 at true ~64MB scale (potentially 100,000+ window
// events) was not measured against a live Cloudflare Worker from this
// session -- there is no deploy access here. The streaming design keeps
// MEMORY bounded regardless of file size, which was the concrete risk the
// brief raised; whether one HTTP request's time budget is enough to
// finish writing every row for the single largest realistic file is a
// question only a real deploy + real large file can answer.

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size) as T[]);
  }
  return chunks;
}

async function getMediaBucket() {
  const { env } = await getCloudflareContext({ async: true });
  return env.MEDIA;
}

export type ActivityWatchImportRequest = {
  r2ObjectKey: string;
  bucketId: string;
  bucketType: ActivityWatchBucketType;
  hostname: string | null;
  fileFingerprint: string;
  fileSizeBytes: number;
};

type ExistingImportRow = {
  id: number;
  importedAt: Date;
  totalEventsInFile: number;
  newEventCount: number;
  duplicateEventCount: number;
  rejectedEventCount: number;
  rangeStart: Date | null;
  rangeEnd: Date | null;
};

function summaryFromExistingRow(row: ExistingImportRow): ActivityWatchImportSummary {
  return {
    totalEventsInFile: row.totalEventsInFile,
    newCount: row.newEventCount,
    duplicateCount: row.duplicateEventCount,
    rejectedCount: row.rejectedEventCount,
    rangeStart: row.rangeStart,
    rangeEnd: row.rangeEnd,
  };
}

async function findExistingImport(
  db: Awaited<ReturnType<typeof getAuthenticatedDb>>,
  fileFingerprint: string,
): Promise<ExistingImportRow | null> {
  const rows = await db
    .select({
      id: activitywatchImports.id,
      importedAt: activitywatchImports.importedAt,
      totalEventsInFile: activitywatchImports.totalEventsInFile,
      newEventCount: activitywatchImports.newEventCount,
      duplicateEventCount: activitywatchImports.duplicateEventCount,
      rejectedEventCount: activitywatchImports.rejectedEventCount,
      rangeStart: activitywatchImports.rangeStart,
      rangeEnd: activitywatchImports.rangeEnd,
    })
    .from(activitywatchImports)
    .where(eq(activitywatchImports.fileFingerprint, fileFingerprint))
    .limit(1);
  return rows[0] ?? null;
}

export type ActivityWatchPreviewResult =
  | { success: true; alreadyImported: true; previousImportedAt: Date; summary: ActivityWatchImportSummary }
  | { success: true; alreadyImported: false; summary: ActivityWatchImportSummary }
  | { success: false; error: string };

// Read-only. Never writes to activitywatch_imports or activitywatch_events
// -- see the brief's own "Nenhuma escrita antes da confirmação" rule.
export async function previewActivityWatchImport(
  request: ActivityWatchImportRequest,
): Promise<ActivityWatchPreviewResult> {
  const db = await getAuthenticatedDb();

  const existing = await findExistingImport(db, request.fileFingerprint);
  if (existing) {
    return {
      success: true,
      alreadyImported: true,
      previousImportedAt: existing.importedAt,
      summary: summaryFromExistingRow(existing),
    };
  }

  const bucket = await getMediaBucket();
  const object = await bucket.get(request.r2ObjectKey);
  if (!object) {
    return { success: false, error: "Uploaded file could not be found. Please upload it again." };
  }

  const context = {
    bucketId: request.bucketId,
    bucketType: request.bucketType,
    hostname: request.hostname,
  };

  let summary = emptyActivityWatchImportSummary();
  let pending: NormalizedActivityWatchEvent[] = [];

  async function flushPending() {
    if (pending.length === 0) return;
    const fingerprints = pending.map((e) => e.fingerprint);
    const existingRows = await db
      .select({ fingerprint: activitywatchEvents.fingerprint })
      .from(activitywatchEvents)
      .where(inArray(activitywatchEvents.fingerprint, fingerprints));
    const existingSet = new Set(existingRows.map((r) => r.fingerprint));
    for (const event of pending) {
      summary = foldNormalizedEventIntoSummary(summary, event, existingSet.has(event.fingerprint));
    }
    pending = [];
  }

  for await (const result of scanActivityWatchEventsFromStream(object.body, context)) {
    if (!result.ok) {
      summary = foldRejectionIntoSummary(summary);
      continue;
    }
    pending.push(result.event);
    if (pending.length >= PREVIEW_DEDUPE_CHECK_BATCH_SIZE) {
      await flushPending();
    }
  }
  await flushPending();

  return { success: true, alreadyImported: false, summary };
}

export type ActivityWatchConfirmResult =
  | { success: true; alreadyImported: boolean; importId: number; summary: ActivityWatchImportSummary }
  | { success: false; error: string };

// The one place activitywatch_imports / activitywatch_events rows are
// ever written. Append-only: no UPDATE/DELETE of an existing event row
// anywhere in this module, and re-confirming the exact same file (by
// fileFingerprint) is a pure no-op fast path -- neither a duplicate
// import row nor duplicate event rows are possible.
export async function confirmActivityWatchImport(
  request: ActivityWatchImportRequest,
): Promise<ActivityWatchConfirmResult> {
  const db = await getAuthenticatedDb();

  const existing = await findExistingImport(db, request.fileFingerprint);
  if (existing) {
    return {
      success: true,
      alreadyImported: true,
      importId: existing.id,
      summary: summaryFromExistingRow(existing),
    };
  }

  const bucket = await getMediaBucket();
  const object = await bucket.get(request.r2ObjectKey);
  if (!object) {
    return { success: false, error: "Uploaded file could not be found. Please upload it again." };
  }

  const created = await db
    .insert(activitywatchImports)
    .values({
      bucketId: request.bucketId,
      bucketType: request.bucketType,
      hostname: request.hostname,
      fileFingerprint: request.fileFingerprint,
      r2ObjectKey: request.r2ObjectKey,
      fileSizeBytes: request.fileSizeBytes,
    })
    .onConflictDoNothing({ target: activitywatchImports.fileFingerprint })
    .returning({ id: activitywatchImports.id });

  let importId = created[0]?.id;
  if (importId === undefined) {
    // Race: another confirm for the exact same file completed between our
    // existence check above and this insert. Same file fingerprint means
    // same outcome -- treat it as the already-imported fast path rather
    // than erroring out.
    const raced = await findExistingImport(db, request.fileFingerprint);
    if (raced) {
      return {
        success: true,
        alreadyImported: true,
        importId: raced.id,
        summary: summaryFromExistingRow(raced),
      };
    }
    return { success: false, error: "Could not create the import record. Please try again." };
  }

  const context = {
    bucketId: request.bucketId,
    bucketType: request.bucketType,
    hostname: request.hostname,
  };

  let summary = emptyActivityWatchImportSummary();
  let pending: NormalizedActivityWatchEvent[] = [];

  async function flushPending() {
    if (pending.length === 0) return;
    const rowChunks = chunk(pending, CONFIRM_INSERT_ROWS_PER_STATEMENT);
    const statementGroups = chunk(rowChunks, CONFIRM_STATEMENTS_PER_BATCH);
    const insertedFingerprints = new Set<string>();

    for (const group of statementGroups) {
      const statements = group.map((rows) =>
        db
          .insert(activitywatchEvents)
          .values(
            rows.map((event) => ({
              importId: importId as number,
              bucketId: event.bucketId,
              bucketType: event.bucketType,
              hostname: event.hostname,
              startedAt: event.startedAt,
              durationSeconds: event.durationSeconds,
              appName: event.appName,
              windowTitle: event.windowTitle,
              afkStatus: event.afkStatus,
              fingerprint: event.fingerprint,
            })),
          )
          .onConflictDoNothing({ target: activitywatchEvents.fingerprint })
          .returning({ fingerprint: activitywatchEvents.fingerprint }),
      );

      if (statements.length === 1) {
        const rows = await statements[0];
        for (const row of rows) insertedFingerprints.add(row.fingerprint);
      } else {
        const results = await db.batch(
          statements as unknown as [
            (typeof statements)[number],
            ...(typeof statements)[number][],
          ],
        );
        for (const rows of results) {
          for (const row of rows) insertedFingerprints.add(row.fingerprint);
        }
      }
    }

    for (const event of pending) {
      summary = foldNormalizedEventIntoSummary(
        summary,
        event,
        !insertedFingerprints.has(event.fingerprint),
      );
    }
    pending = [];
  }

  for await (const result of scanActivityWatchEventsFromStream(object.body, context)) {
    if (!result.ok) {
      summary = foldRejectionIntoSummary(summary);
      continue;
    }
    pending.push(result.event);
    if (pending.length >= CONFIRM_INSERT_ROWS_PER_STATEMENT * CONFIRM_STATEMENTS_PER_BATCH) {
      await flushPending();
    }
  }
  await flushPending();

  await db
    .update(activitywatchImports)
    .set({
      totalEventsInFile: summary.totalEventsInFile,
      newEventCount: summary.newCount,
      duplicateEventCount: summary.duplicateCount,
      rejectedEventCount: summary.rejectedCount,
      rangeStart: summary.rangeStart,
      rangeEnd: summary.rangeEnd,
    })
    .where(eq(activitywatchImports.id, importId));

  revalidatePath("/all-history");
  revalidatePath("/all-history/import");

  return { success: true, alreadyImported: false, importId, summary };
}
