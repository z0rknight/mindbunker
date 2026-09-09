import "server-only";

import { getAuthenticatedDb } from "@/db";
import { captures } from "@/db/schema";
import { and, desc, eq, isNull, isNotNull, lt } from "drizzle-orm";
import { CAPTURE_UNRESOLVED_SIGNAL_DAYS } from "./config";
import { isCaptureResolved } from "./core";

export type CaptureRow = typeof captures.$inferSelect;

// Wave 2 §8 / Wave 2.1: /productivity/captures Inbox. Unresolved =
// outcome is not terminal AND not dismissed -- same boolean
// isCaptureResolved(...) in core.ts checks, expressed as SQL here so the
// list query itself never returns something the read model would then
// have to filter out client-side. Deliberately does NOT also require
// promoted*Id to be null: a Capture mid-promotion (e.g. Client
// checkpointed, Project not yet) must stay visible here so a stalled or
// crashed promotion attempt is noticed and retried, not hidden (mission
// §7 / Wave 2.1's incremental-checkpoint design -- see core.ts).
export async function getUnresolvedCaptures(): Promise<CaptureRow[]> {
  const db = await getAuthenticatedDb();
  return db
    .select()
    .from(captures)
    .where(and(eq(captures.outcome, "UNRESOLVED"), isNull(captures.dismissedAt)))
    .orderBy(desc(captures.createdAt));
}

// Resolved (terminal outcome, e.g. CONVERTED once a promotion actually
// completes, or dismissed) but not archived -- mirrors the Sensor review
// page's "Approved Sensor evidence" section.
export async function getResolvedCaptures(limit = 50): Promise<CaptureRow[]> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(captures)
    .where(isNull(captures.archivedAt))
    .orderBy(desc(captures.createdAt))
    .limit(limit);
  return rows.filter((row) => isCaptureResolved(row));
}

// Mirrors the Sensor review page's collapsed "Archived Sensor evidence"
// section -- hidden from active review, never deleted.
export async function getArchivedCaptures(limit = 50): Promise<CaptureRow[]> {
  const db = await getAuthenticatedDb();
  return db
    .select()
    .from(captures)
    .where(isNotNull(captures.archivedAt))
    .orderBy(desc(captures.createdAt))
    .limit(limit);
}

export async function getCaptureById(id: number): Promise<CaptureRow | null> {
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(captures).where(eq(captures.id, id)).limit(1);
  return rows[0] ?? null;
}

// War Room signal input (Wave 1.5 Decision D / Wave 2 §17): count of
// Captures that are still unresolved AND older than the aging
// threshold. Read-only -- nothing here mutates outcome.
export async function countStaleUnresolvedCaptures(now: Date): Promise<number> {
  const db = await getAuthenticatedDb();
  const thresholdMs = now.getTime() - CAPTURE_UNRESOLVED_SIGNAL_DAYS * 24 * 60 * 60 * 1_000;
  const rows = await db
    .select({ id: captures.id })
    .from(captures)
    .where(
      and(
        eq(captures.outcome, "UNRESOLVED"),
        isNull(captures.dismissedAt),
        lt(captures.createdAt, new Date(thresholdMs)),
      ),
    );
  return rows.length;
}
