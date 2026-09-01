import "server-only";

import { getAuthenticatedDb } from "@/db";
import { commitments, clients, projects, videoLogs } from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import {
  sortCommitmentsByUrgency,
  type CommitmentOwnerType,
  type CommitmentRow,
} from "./core";

export type CommitmentWithOwnerLabel = CommitmentRow & { ownerLabel: string };

async function resolveOwnerLabels(
  rows: CommitmentRow[],
): Promise<Map<string, string>> {
  const db = await getAuthenticatedDb();
  const idsByType: Record<CommitmentOwnerType, number[]> = {
    CLIENT: [],
    PROJECT: [],
    VIDEO: [],
  };
  for (const r of rows) idsByType[r.ownerType].push(r.ownerId);

  const labels = new Map<string, string>();

  if (idsByType.CLIENT.length) {
    const rows2 = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(inArray(clients.id, idsByType.CLIENT));
    for (const r of rows2) labels.set(`CLIENT:${r.id}`, r.name);
  }
  if (idsByType.PROJECT.length) {
    const rows2 = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(inArray(projects.id, idsByType.PROJECT));
    for (const r of rows2) labels.set(`PROJECT:${r.id}`, r.name);
  }
  if (idsByType.VIDEO.length) {
    const rows2 = await db
      .select({ id: videoLogs.id, title: videoLogs.title })
      .from(videoLogs)
      .where(inArray(videoLogs.id, idsByType.VIDEO));
    for (const r of rows2) labels.set(`VIDEO:${r.id}`, r.title ?? `Untitled video #${r.id}`);
  }
  return labels;
}

async function withOwnerLabels(
  rows: CommitmentRow[],
): Promise<CommitmentWithOwnerLabel[]> {
  const labels = await resolveOwnerLabels(rows);
  return rows.map((r) => ({
    ...r,
    ownerLabel: labels.get(`${r.ownerType}:${r.ownerId}`) ?? `#${r.ownerId}`,
  }));
}

// Every non-terminal commitment (OPEN), across all owner types, newest-due
// first via sortCommitmentsByUrgency -- the primary feed for the Lab
// dashboard's "Commitments" widget.
export async function listOpenCommitments(): Promise<
  CommitmentWithOwnerLabel[]
> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(commitments)
    .where(eq(commitments.status, "OPEN"));
  return withOwnerLabels(sortCommitmentsByUrgency(rows as CommitmentRow[]));
}

export async function listCommitmentsForOwner(
  ownerType: CommitmentOwnerType,
  ownerId: number,
): Promise<CommitmentWithOwnerLabel[]> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(commitments)
    .where(
      and(
        eq(commitments.ownerType, ownerType),
        eq(commitments.ownerId, ownerId),
        ne(commitments.status, "CANCELLED"),
      ),
    );
  return withOwnerLabels(sortCommitmentsByUrgency(rows as CommitmentRow[]));
}
