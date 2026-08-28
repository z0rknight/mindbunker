// ActivityWatch CLI import (ACTIVITYWATCH CLI IMPORT round, 26 Aug 2026).
//
// The missing tool the brief for this round asked for: `npm run aw:import`,
// a thin command-line adapter over the exact same canonical logic the
// browser importer (src/app/all-history/import/ImportActivityWatchPanel.tsx
// -> the upload route handler -> previewActivityWatchImport /
// confirmActivityWatchImport in actions.ts) already uses -- NOT a second
// parser, NOT hand-generated SQL for events, NOT a new fingerprint or
// dedupe algorithm. Everything that decides what an event IS and whether
// it's already been seen lives in ./core.ts and is imported here unchanged:
// ActivityWatchEventScanner / scanActivityWatchEventsFromStream (streaming
// array scan), normalizeActivityWatchEvent / deriveEventFingerprint
// (identical per-event fingerprint), resolveBucketIdentity (real on-disk
// bucket metadata, not filename guessing), and the summary-folding reducers
// so preview and confirm numbers can never silently drift from what the
// web UI would have computed for the same bytes.
//
// WHY THIS FILE EXISTS SEPARATELY FROM actions.ts, RATHER THAN CALLING
// previewActivityWatchImport/confirmActivityWatchImport DIRECTLY:
// those two are Next.js Server Actions -- previewActivityWatchImport calls
// getAuthenticatedDb() (requires a real authenticated Next.js request) and
// reads its input from an R2 object (getCloudflareContext()). A bare Node
// process has neither. This is the exact same constraint
// scripts/local-only-import-historical.mjs already solved for the
// historical-artifact importer, and this file follows that established
// precedent: getPlatformProxy() from the `wrangler` package for a real D1
// binding outside of any Worker request (local by default, real remote D1
// only with --remote), and drizzle(proxy.env.DB, { schema }) for the same
// Drizzle query builder actions.ts uses -- so every write below is a real
// `db.insert(...).values(...).onConflictDoNothing(...)` / `db.batch([...])`
// call, never a hand-assembled SQL string. runConfirmForFile() below is a
// deliberate, minimal adaptation of confirmActivityWatchImport's body (same
// KEEP IN SYNC discipline local-only-import-historical.mjs already
// documents for its own equivalent): only the Drizzle row-shaping/db.batch
// glue and the "read from a local file stream instead of an R2 object"
// swap are re-expressed here; parsing, normalization, and fingerprinting
// are 100% imported from core.ts, not reimplemented.
//
// MODES
//   npm run aw:import -- --dry-run <files...>
//       Zero writes. Prints, per file: filename, bucket id, bucket type,
//       hostname, first/last timestamp, parsed events, exact duplicates
//       (checked read-only against the target DB), rejected count, and
//       which target mode was checked against. Bucket identity for every
//       file is resolved and validated BEFORE any DB connection is opened
//       at all -- a file that fails identity validation aborts the whole
//       run before touching a database, per the brief's own "do not
//       continue to production if parsing materially fails."
//   npm run aw:import -- --remote <files...>
//       Prints the TARGET/DATABASE/ID banner and independently re-verifies
//       migration 0034 is already applied to remote D1 (`npx wrangler d1
//       migrations list mindbunker --remote`) BEFORE opening any DB
//       connection or writing a single row. Then imports for real against
//       production D1 via getPlatformProxy({ remoteBindings: true }).
//       There is no flag that silently falls back to local D1 if remote
//       verification fails -- it aborts instead.
//   --dry-run and --remote may be combined: a read-only check against
//   REMOTE D1 (still zero writes) -- useful as a true pre-flight for the
//   real import.
//   Without --remote, all DB access (dry-run or real) targets LOCAL D1
//   (the same Miniflare-backed local state `wrangler d1 migrations apply
//   --local` / `next dev` use) -- never production by accident.
//
// WHAT THIS NEVER TOUCHES: sensor_sessions, work_sessions,
// device_activity_observations, transactions, personal_transactions,
// video_logs, quotes. This file imports only activitywatchImports /
// activitywatchEvents from the schema and writes to nothing else.

import { createHash } from "node:crypto";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";

import * as schema from "../../db/schema.ts";
import { activitywatchEvents, activitywatchImports } from "../../db/schema.ts";
import {
  emptyActivityWatchImportSummary,
  extractActivityWatchBucketHeader,
  foldNormalizedEventIntoSummary,
  foldRejectionIntoSummary,
  resolveBucketIdentity,
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

export const EXPECTED_DATABASE_NAME = "mindbunker";
export const EXPECTED_DATABASE_ID = "d6ada5db-1f36-4ee9-9a05-01d131abf219";

// Bounded prefix read for bucket-identity extraction -- never the whole
// file. Real headers observed on real exports are well under 1KB; this is
// generous headroom while staying tiny relative to a 64MB file.
const HEADER_PREFIX_BYTES = 65_536;

function repoRootFromThisFile(): string {
  // this file: <repo>/src/modules/activitywatch/import-cli.ts
  return fileURLToPath(new URL("../../../", import.meta.url));
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size) as T[]);
  return chunks;
}

export function parseArgs(argv: string[]): { dryRun: boolean; remote: boolean; files: string[] } {
  const dryRun = argv.includes("--dry-run");
  const remote = argv.includes("--remote");
  const files = argv.filter((a) => a !== "--dry-run" && a !== "--remote" && !a.startsWith("-"));
  if (files.length === 0) {
    throw new Error(
      "Usage: npm run aw:import -- [--dry-run] [--remote] <aw-watcher-window_*.json | aw-watcher-afk_*.json ...>",
    );
  }
  return { dryRun, remote, files };
}

function readHeaderPrefix(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    const stream = createReadStream(path, { start: 0, end: HEADER_PREFIX_BYTES - 1 });
    stream.on("data", (piece) => parts.push(piece as Buffer));
    stream.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    stream.on("error", reject);
  });
}

function fileSha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (piece) => hash.update(piece as Buffer));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function fileToWebStream(path: string): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(path)) as unknown as ReadableStream<Uint8Array>;
}

type InspectedFile = {
  path: string;
  sizeBytes: number;
  bucketId: string;
  bucketType: ActivityWatchBucketType;
  hostname: string | null;
};

// Reads only a bounded header prefix and resolves real bucket identity via
// core.ts's resolveBucketIdentity -- filename is a hint, never authority.
// Throws (with a message meant to be printed and to abort the whole run)
// if the file's own declared metadata doesn't match a known WINDOW/AFK
// combination, or disagrees with what the filename suggested.
async function inspectFile(path: string): Promise<InspectedFile> {
  const stat = statSync(path);
  const headerText = await readHeaderPrefix(path);
  const header = extractActivityWatchBucketHeader(headerText);
  const identity = resolveBucketIdentity(path, header);
  if (!identity.ok) {
    throw new Error(`${path}: ${identity.reason}`);
  }
  return {
    path,
    sizeBytes: stat.size,
    bucketId: identity.bucketId,
    bucketType: identity.bucketType,
    hostname: identity.hostname,
  };
}

function verifyConfiguredDatabaseIdentity(configPath: string): void {
  const raw = readFileSync(configPath, "utf8");
  const name = raw.match(/"database_name"\s*:\s*"([^"]+)"/)?.[1];
  const id = raw.match(/"database_id"\s*:\s*"([^"]+)"/)?.[1];
  if (name !== EXPECTED_DATABASE_NAME || id !== EXPECTED_DATABASE_ID) {
    throw new Error(
      `wrangler.jsonc database identity mismatch: expected ${EXPECTED_DATABASE_NAME}/${EXPECTED_DATABASE_ID}, ` +
        `found ${name ?? "(none)"}/${id ?? "(none)"}. Refusing to proceed.`,
    );
  }
}

function printRemoteTargetBanner(): void {
  console.log("TARGET: REMOTE D1");
  console.log(`DATABASE: ${EXPECTED_DATABASE_NAME}`);
  console.log(`ID: ${EXPECTED_DATABASE_ID}`);
}

// Independently re-proves migration 0034 is already applied to remote D1
// by shelling out to the same command the brief itself specifies --
// `npx wrangler d1 migrations list mindbunker --remote` -- rather than
// trusting anything cached from a previous round. Wrangler's "list"
// output enumerates migrations NOT YET applied; an applied migration does
// not appear in it at all, so 0034 appearing anywhere in the output means
// it is still pending and this throws (aborting before any DB connection
// is opened, let alone any write).
export function verifyMigration0034AppliedRemote(repoRoot: string): string {
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "migrations", "list", EXPECTED_DATABASE_NAME, "--remote"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `Could not verify remote migration state (npx wrangler d1 migrations list ${EXPECTED_DATABASE_NAME} --remote ` +
        `failed, status=${result.status}): ${result.stderr || result.stdout || result.error?.message || "unknown error"}`,
    );
  }
  const output = `${result.stdout}`;
  if (/0034_activitywatch_import/.test(output)) {
    throw new Error(
      "Migration 0034_activitywatch_import.sql is NOT yet applied to remote D1 (still listed as pending). " +
        "Run `npm run db:migrate:remote` first -- refusing to import against an unmigrated database.",
    );
  }
  return output;
}

type DbHandle = Awaited<ReturnType<typeof drizzle<typeof schema>>>;

async function openDb(remote: boolean, repoRoot: string): Promise<{ db: DbHandle; dispose: () => Promise<void> }> {
  const configPath = join(repoRoot, "wrangler.jsonc");
  verifyConfiguredDatabaseIdentity(configPath);
  const proxy = await getPlatformProxy<CloudflareEnv>({
    configPath,
    remoteBindings: remote,
    persist: remote ? false : true,
  });
  const db = drizzle(proxy.env.DB, { schema });
  return { db, dispose: () => proxy.dispose() };
}

type ScanContext = { bucketId: string; bucketType: ActivityWatchBucketType; hostname: string | null };

// Read-only pass: reused summary-folding reducers from core.ts, batched
// existence checks against activitywatch_events at the same batch size
// (PREVIEW_DEDUPE_CHECK_BATCH_SIZE) previewActivityWatchImport uses. Never
// calls db.insert / db.batch -- this function performs SELECT only.
async function dryRunScan(
  path: string,
  context: ScanContext,
  db: DbHandle,
): Promise<{ summary: ActivityWatchImportSummary; exactDuplicates: number }> {
  let summary = emptyActivityWatchImportSummary();
  let exactDuplicates = 0;
  let pending: NormalizedActivityWatchEvent[] = [];

  async function flush() {
    if (pending.length === 0) return;
    const fingerprints = pending.map((e) => e.fingerprint);
    const existingRows = await db
      .select({ fingerprint: activitywatchEvents.fingerprint })
      .from(activitywatchEvents)
      .where(inArray(activitywatchEvents.fingerprint, fingerprints));
    const existingSet = new Set(existingRows.map((r) => r.fingerprint));
    for (const event of pending) {
      const isDuplicate = existingSet.has(event.fingerprint);
      if (isDuplicate) exactDuplicates += 1;
      summary = foldNormalizedEventIntoSummary(summary, event, isDuplicate);
    }
    pending = [];
  }

  let seen = 0;
  const progressStart = Date.now();
  for await (const result of scanActivityWatchEventsFromStream(fileToWebStream(path), context)) {
    if (!result.ok) {
      summary = foldRejectionIntoSummary(summary);
      continue;
    }
    pending.push(result.event);
    seen += 1;
    if (pending.length >= PREVIEW_DEDUPE_CHECK_BATCH_SIZE) await flush();
    if (seen % 20_000 === 0) {
      const elapsedS = ((Date.now() - progressStart) / 1000).toFixed(1);
      const rssMb = (process.memoryUsage().rss / (1024 * 1024)).toFixed(0);
      console.log(`  ... ${seen} events scanned (${elapsedS}s elapsed, RSS ${rssMb}MB)`);
    }
  }
  await flush();
  return { summary, exactDuplicates };
}

type ConfirmOutcome = {
  alreadyImported: boolean;
  importId: number;
  summary: ActivityWatchImportSummary;
};

function summaryFromImportRow(row: {
  totalEventsInFile: number;
  newEventCount: number;
  duplicateEventCount: number;
  rejectedEventCount: number;
  rangeStart: Date | null;
  rangeEnd: Date | null;
}): ActivityWatchImportSummary {
  return {
    totalEventsInFile: row.totalEventsInFile,
    newCount: row.newEventCount,
    duplicateCount: row.duplicateEventCount,
    rejectedCount: row.rejectedEventCount,
    rangeStart: row.rangeStart,
    rangeEnd: row.rangeEnd,
  };
}

// KEEP IN SYNC with confirmActivityWatchImport in actions.ts -- same
// fields, same onConflictDoNothing/fingerprint-driven idempotency, same
// db.batch() chunking constants imported from config.ts. What's actually
// different here (and the only reason this isn't a call to the Server
// Action itself): the R2 object read is a local file stream instead, and
// `db` comes from getPlatformProxy() instead of an authenticated Next.js
// request's getAuthenticatedDb().
async function runConfirmForFile(
  path: string,
  context: ScanContext,
  db: DbHandle,
  fileFingerprint: string,
  fileSizeBytes: number,
): Promise<ConfirmOutcome> {
  const existing = await db
    .select({
      id: activitywatchImports.id,
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
  if (existing[0]) {
    return { alreadyImported: true, importId: existing[0].id, summary: summaryFromImportRow(existing[0]) };
  }

  const created = await db
    .insert(activitywatchImports)
    .values({
      bucketId: context.bucketId,
      bucketType: context.bucketType,
      hostname: context.hostname,
      fileFingerprint,
      // No R2 object backs a CLI import -- this key documents the real
      // provenance (a local file path, not scratch R2 input) rather than
      // reusing the R2-prefix convention for something that isn't one.
      r2ObjectKey: `cli-import://${basename(path)}`,
      fileSizeBytes,
    })
    .onConflictDoNothing({ target: activitywatchImports.fileFingerprint })
    .returning({ id: activitywatchImports.id });

  let importId = created[0]?.id;
  if (importId === undefined) {
    const raced = await db
      .select({
        id: activitywatchImports.id,
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
    if (raced[0]) {
      return { alreadyImported: true, importId: raced[0].id, summary: summaryFromImportRow(raced[0]) };
    }
    throw new Error("Could not create the import record (race with no winner found). Please re-run.");
  }

  let summary = emptyActivityWatchImportSummary();
  let pending: NormalizedActivityWatchEvent[] = [];

  async function flush() {
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
          statements as unknown as [(typeof statements)[number], ...(typeof statements)[number][]],
        );
        for (const rows of results) {
          for (const row of rows) insertedFingerprints.add(row.fingerprint);
        }
      }
    }

    for (const event of pending) {
      summary = foldNormalizedEventIntoSummary(summary, event, !insertedFingerprints.has(event.fingerprint));
    }
    pending = [];
  }

  for await (const result of scanActivityWatchEventsFromStream(fileToWebStream(path), context)) {
    if (!result.ok) {
      summary = foldRejectionIntoSummary(summary);
      continue;
    }
    pending.push(result.event);
    if (pending.length >= CONFIRM_INSERT_ROWS_PER_STATEMENT * CONFIRM_STATEMENTS_PER_BATCH) await flush();
  }
  await flush();

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

  return { alreadyImported: false, importId, summary };
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString() : "(none)";
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const repoRoot = repoRootFromThisFile();
  const { dryRun, remote, files } = parseArgs(argv);

  console.log(`Mode: ${dryRun ? "DRY RUN (zero writes)" : "REAL IMPORT (writes to " + (remote ? "REMOTE" : "LOCAL") + " D1)"}`);

  // Inspect + validate bucket identity for every file BEFORE opening any DB
  // connection, before any remote verification, before any write. A single
  // bad file aborts the entire run.
  const inspected: InspectedFile[] = [];
  for (const path of files) {
    inspected.push(await inspectFile(path));
  }

  if (remote) {
    printRemoteTargetBanner();
    verifyMigration0034AppliedRemote(repoRoot);
    console.log("Migration 0034 confirmed already applied to remote D1 (not listed as pending).");
  }

  const { db, dispose } = await openDb(remote, repoRoot);
  try {
    for (const file of inspected) {
      const context: ScanContext = { bucketId: file.bucketId, bucketType: file.bucketType, hostname: file.hostname };
      console.log(`\n=== ${basename(file.path)} ===`);
      console.log(`file: ${file.path}`);
      console.log(`bucket id: ${context.bucketId}`);
      console.log(`bucket type: ${context.bucketType}`);
      console.log(`hostname: ${context.hostname ?? "(none)"}`);
      console.log(`file size bytes: ${file.sizeBytes}`);

      if (dryRun) {
        const { summary, exactDuplicates } = await dryRunScan(file.path, context, db);
        console.log(`first timestamp: ${fmtDate(summary.rangeStart)}`);
        console.log(`last timestamp: ${fmtDate(summary.rangeEnd)}`);
        console.log(`parsed events: ${summary.totalEventsInFile}`);
        console.log(`exact duplicates: ${exactDuplicates}`);
        console.log(`rejected: ${summary.rejectedCount}`);
        console.log(`target mode: ${remote ? "REMOTE D1 (read-only check)" : "LOCAL D1 (read-only check)"}`);
        continue;
      }

      const fileFingerprint = await fileSha256(file.path);
      const result = await runConfirmForFile(file.path, context, db, fileFingerprint, file.sizeBytes);
      console.log(`already imported: ${result.alreadyImported}`);
      console.log(`import id: ${result.importId}`);
      console.log(`total events in file: ${result.summary.totalEventsInFile}`);
      console.log(`new: ${result.summary.newCount}`);
      console.log(`duplicate: ${result.summary.duplicateCount}`);
      console.log(`rejected: ${result.summary.rejectedCount}`);
      console.log(`range: ${fmtDate(result.summary.rangeStart)} .. ${fmtDate(result.summary.rangeEnd)}`);
    }
  } finally {
    await dispose();
  }
}

const isMainModule = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`;
  } catch {
    return false;
  }
})();

if (isMainModule) {
  main().catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    process.exitCode = 1;
  });
}
