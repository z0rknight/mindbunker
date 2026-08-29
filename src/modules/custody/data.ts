import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  billingEvidence,
  clients,
  commercialContracts,
  projects,
  quotes,
  transactions,
  videoLogs,
  workSessions,
} from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { buildCustodyProjection, type CustodyVideoInput } from "./core";

export async function getClientCustody(clientId: number) {
  if (!Number.isSafeInteger(clientId) || clientId <= 0) return null;

  const db = await getAuthenticatedDb();
  const [clientRows, quoteRows, contractRows, projectRows, videoRows, evidenceRows, incomeRows] =
    await Promise.all([
      db
        .select({ id: clients.id, name: clients.name, status: clients.status })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1),
      db
        .select({
          id: quotes.id,
          status: quotes.status,
          currency: quotes.currency,
          amountCents: quotes.amountCents,
          contentTypeLabel: quotes.contentTypeLabel,
          projectId: quotes.projectId,
          videoId: quotes.videoId,
        })
        .from(quotes)
        .where(eq(quotes.clientId, clientId)),
      db
        .select({
          id: commercialContracts.id,
          platform: commercialContracts.platform,
          billingType: commercialContracts.billingType,
          hourlyRate: commercialContracts.hourlyRate,
          currency: commercialContracts.currency,
          status: commercialContracts.status,
          externalReference: commercialContracts.externalReference,
        })
        .from(commercialContracts)
        .where(eq(commercialContracts.clientId, clientId)),
      db
        .select({ id: projects.id, name: projects.name, status: projects.status })
        .from(projects)
        .where(eq(projects.clientId, clientId)),
      db
        .select({
          id: videoLogs.id,
          projectId: videoLogs.projectId,
          title: videoLogs.title,
          date: videoLogs.date,
          status: videoLogs.status,
        })
        .from(videoLogs)
        .leftJoin(projects, eq(videoLogs.projectId, projects.id))
        .where(or(eq(videoLogs.clientId, clientId), eq(projects.clientId, clientId))),
      db
        .select({
          contractId: billingEvidence.contractId,
          currency: billingEvidence.currency,
          grossAmount: billingEvidence.grossAmount,
        })
        .from(billingEvidence)
        .innerJoin(commercialContracts, eq(billingEvidence.contractId, commercialContracts.id))
        .where(eq(commercialContracts.clientId, clientId)),
      db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          currency: transactions.currency,
          contractId: transactions.contractId,
          billingEvidenceId: transactions.billingEvidenceId,
        })
        .from(transactions)
        .where(and(eq(transactions.clientId, clientId), eq(transactions.type, "income"))),
    ]);

  const client = clientRows[0];
  if (!client) return null;

  const sessions = videoRows.length > 0
    ? await db
        .select({
          videoId: workSessions.videoId,
          startedAt: workSessions.startedAt,
          endedAt: workSessions.endedAt,
        })
        .from(workSessions)
        .innerJoin(videoLogs, eq(workSessions.videoId, videoLogs.id))
        .leftJoin(projects, eq(videoLogs.projectId, projects.id))
        .where(or(eq(videoLogs.clientId, clientId), eq(projects.clientId, clientId)))
    : [];

  const workByVideo = new Map<number, { sessionCount: number; closedSeconds: number }>();
  for (const session of sessions) {
    if (!session.endedAt) continue;
    const current = workByVideo.get(session.videoId) ?? { sessionCount: 0, closedSeconds: 0 };
    current.sessionCount += 1;
    current.closedSeconds += Math.max(
      0,
      Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1_000),
    );
    workByVideo.set(session.videoId, current);
  }

  const videos: CustodyVideoInput[] = videoRows.map((video) => ({
    id: video.id,
    projectId: video.projectId,
    title: video.title?.trim() || `Video ${video.date}`,
    status: video.status,
    sessionCount: workByVideo.get(video.id)?.sessionCount ?? 0,
    closedSeconds: workByVideo.get(video.id)?.closedSeconds ?? 0,
  }));

  return buildCustodyProjection({
    client,
    quotes: quoteRows,
    contracts: contractRows,
    projects: projectRows,
    videos,
    billingEvidence: evidenceRows,
    income: incomeRows,
  });
}
