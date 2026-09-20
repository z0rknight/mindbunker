import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clientExportReminders, clientProtectedTerms, clients, videoLogs } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getProductionMemoryForClient, type ProductionMemoryRecord } from "@/modules/production-memory/data";
import type { ProtectedTermKind } from "./config";
import { buildPreExportView, type PreExportView } from "./core";

// Operator-only reads (getAuthenticatedDb requires the operator session).
// Nothing under src/modules/client-portal imports this module (pinned by
// client-qa.integration.test.mjs). Read-only by construction: no insert /
// update / delete anywhere in this file.

export type ProtectedTermRecord = { id: number; term: string; kind: ProtectedTermKind | null; note: string | null };
export type ExportReminderRecord = { id: number; text: string };

export async function getClientQaForClient(
  clientId: number,
): Promise<{ terms: ProtectedTermRecord[]; reminders: ExportReminderRecord[] }> {
  const db = await getAuthenticatedDb();
  const [terms, reminders] = await Promise.all([
    db
      .select({
        id: clientProtectedTerms.id,
        term: clientProtectedTerms.term,
        kind: clientProtectedTerms.kind,
        note: clientProtectedTerms.note,
      })
      .from(clientProtectedTerms)
      .where(eq(clientProtectedTerms.clientId, clientId))
      .orderBy(asc(clientProtectedTerms.id)),
    db
      .select({ id: clientExportReminders.id, text: clientExportReminders.text })
      .from(clientExportReminders)
      .where(eq(clientExportReminders.clientId, clientId))
      .orderBy(asc(clientExportReminders.id)),
  ]);
  return { terms, reminders };
}

export type PreExportContext = {
  clientName: string | null;
  view: PreExportView<ProductionMemoryRecord>;
};

/**
 * The client is derived from the VIDEO ROW itself -- never from a caller-
 * supplied client id -- so a workspace can only ever be shown its own
 * client's data. A video with no client gets the generic baseline only.
 */
export async function getPreExportContext(videoId: number): Promise<PreExportContext | null> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({ clientId: videoLogs.clientId, clientName: clients.name })
    .from(videoLogs)
    .leftJoin(clients, eq(clients.id, videoLogs.clientId))
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.clientId === null) return { clientName: null, view: buildPreExportView<ProductionMemoryRecord>({}) };

  const [qa, memories] = await Promise.all([
    getClientQaForClient(row.clientId),
    getProductionMemoryForClient(row.clientId),
  ]);
  return {
    clientName: row.clientName,
    view: buildPreExportView({ terms: qa.terms, reminders: qa.reminders, memories }),
  };
}
