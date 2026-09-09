import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  blockers,
  clients,
  commitments,
  frictionEvents,
  projects,
  revisions,
  transactions,
  videoLogs,
} from "@/db/schema";
import { and, eq, gte, isNull } from "drizzle-orm";
import { startOfMonthISO } from "@/utils/date";
import { getReconciliation } from "@/modules/reconciliation/actions";
import { countStaleUnresolvedCaptures } from "@/modules/captures/data";
import {
  computeCashReconciliationSignals,
  computeOpenBlockerSignals,
  computeOverduePromiseSignals,
  computeRepeatedFrictionSignals,
  computeRevisionDragSignal,
  computeUnattributedRevenueSignals,
  computeUnresolvedCapturesSignal,
  rankSignals,
  type CommitmentRow,
  type Signal,
} from "./core";

// Operator Intelligence Patch Phase 2: gathers the facts each Active
// Signal needs and hands them to the pure functions in core.ts. Every
// query here reuses an existing table/canonical read model -- no new
// tables, no parallel Finance calculation (Cash Reconciliation reuses
// getReconciliation exactly, never recomputes cash).
// Tuesday Patch Completion Round §F: "one deadline object, visible in
// multiple surfaces, without duplication... use the existing commitments
// row." Extracted from getActiveSignals's own Promise.all (that query
// already fetched every OPEN commitment with full title/dueAt/video/
// client/project context -- computeOverduePromiseSignals just filtered
// it down to the overdue subset afterward). Dashboard and War Room read
// this same function directly instead of a second, parallel query.
export async function getOpenCommitmentsWithContext(): Promise<CommitmentRow[]> {
  const db = await getAuthenticatedDb();
  return db
    .select({
      id: commitments.id,
      title: commitments.title,
      dueAt: commitments.dueAt,
      videoId: commitments.videoId,
      videoTitle: videoLogs.title,
      clientName: clients.name,
      projectName: projects.name,
    })
    .from(commitments)
    .innerJoin(videoLogs, eq(videoLogs.id, commitments.videoId))
    .leftJoin(projects, eq(projects.id, videoLogs.projectId))
    .leftJoin(clients, eq(clients.id, videoLogs.clientId))
    .where(eq(commitments.status, "OPEN"));
}

// Incident fix (2026-09-08, resource-limit regression): War Room calls
// getOpenCommitmentsWithContext() itself for ActiveCommitmentsSection AND
// called getActiveSignals(), which used to fetch the identical OPEN-
// commitments row set a second time -- the exact same query running
// twice in one request. prefetchedCommitments lets a caller that already
// has the row set (War Room) hand it in instead of paying for it again;
// every other caller (Productivity) omits it and gets the prior
// single-query behavior unchanged.
export async function getActiveSignals(prefetchedCommitments?: CommitmentRow[]): Promise<Signal[]> {
  const db = await getAuthenticatedDb();
  const now = new Date();
  const monthStart = startOfMonthISO(now);

  const [
    overdueCommitmentRows,
    openBlockerRows,
    recentFrictionRows,
    revisionRows,
    reconciliation,
    unattributedRevenueRows,
    staleUnresolvedCaptureCount,
  ] = await Promise.all([
    prefetchedCommitments ? Promise.resolve(prefetchedCommitments) : getOpenCommitmentsWithContext(),
    db
      .select({
        id: blockers.id,
        category: blockers.category,
        note: blockers.note,
        startedAt: blockers.startedAt,
        videoId: blockers.videoId,
        videoTitle: videoLogs.title,
        clientName: clients.name,
      })
      .from(blockers)
      .innerJoin(videoLogs, eq(videoLogs.id, blockers.videoId))
      .leftJoin(clients, eq(clients.id, videoLogs.clientId))
      .where(isNull(blockers.resolvedAt)),
    // Repeated Friction: recent window (last 30 days), not all-time --
    // "repeated" is about a current pattern, not ancient history.
    db
      .select({ category: frictionEvents.category, videoId: frictionEvents.videoId })
      .from(frictionEvents)
      .where(gte(frictionEvents.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))),
    db
      .select({ causedBy: revisions.causedBy, videoId: revisions.videoId })
      .from(revisions),
    getReconciliation("BUSINESS"),
    db
      .select({ currency: transactions.currency, amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, "income"),
          isNull(transactions.clientId),
          gte(transactions.date, monthStart),
        ),
      ),
    countStaleUnresolvedCaptures(now),
  ]);

  // Unattributed revenue is summed per currency in JS (not SQL GROUP BY)
  // because the row set is already small and this keeps the query list
  // above uniform with the others -- no correctness difference.
  const unattributedByCurrency = new Map<string, number>();
  for (const row of unattributedRevenueRows) {
    unattributedByCurrency.set(
      row.currency,
      (unattributedByCurrency.get(row.currency) ?? 0) + row.amount,
    );
  }

  const signals: Signal[] = [
    ...computeOverduePromiseSignals(overdueCommitmentRows, now),
    ...computeOpenBlockerSignals(openBlockerRows, now),
    ...computeRepeatedFrictionSignals(recentFrictionRows),
    computeRevisionDragSignal(revisionRows),
    ...computeCashReconciliationSignals(reconciliation),
    ...computeUnattributedRevenueSignals(
      Array.from(unattributedByCurrency, ([currency, amount]) => ({ currency, amount })),
    ),
    ...computeUnresolvedCapturesSignal(staleUnresolvedCaptureCount),
  ];

  return rankSignals(signals);
}
