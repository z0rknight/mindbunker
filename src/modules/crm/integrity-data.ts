import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  clients,
  commercialContracts,
  paymentRequests,
  projects,
  transactions,
  videoLogs,
} from "@/db/schema";
import { scanRelationshipIntegrity } from "./integrity";

export async function getRelationshipIntegrity() {
  const db = await getAuthenticatedDb();
  const [clientRows, projectRows, videoRows, contractRows, paymentRequestRows, transactionRows] =
    await Promise.all([
      db.select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        archivalState: clients.archivalState,
        source: clients.source,
      }).from(clients),
      db.select({
        id: projects.id,
        clientId: projects.clientId,
        name: projects.name,
        status: projects.status,
      }).from(projects),
      db.select({
        id: videoLogs.id,
        clientId: videoLogs.clientId,
        projectId: videoLogs.projectId,
        title: videoLogs.title,
        status: videoLogs.status,
        videoKind: videoLogs.videoKind,
        cancelledAt: videoLogs.cancelledAt,
      }).from(videoLogs),
      db.select({
        id: commercialContracts.id,
        clientId: commercialContracts.clientId,
        status: commercialContracts.status,
      }).from(commercialContracts),
      db.select({
        id: paymentRequests.id,
        clientId: paymentRequests.clientId,
        status: paymentRequests.status,
      }).from(paymentRequests),
      db.select({
        id: transactions.id,
        clientId: transactions.clientId,
        type: transactions.type,
        category: transactions.category,
      }).from(transactions),
    ]);

  const issues = scanRelationshipIntegrity({
    clients: clientRows,
    projects: projectRows,
    videos: videoRows,
    contracts: contractRows,
    paymentRequests: paymentRequestRows,
    transactions: transactionRows,
  });
  return {
    status: issues.length === 0 ? "HEALTHY" as const : "ISSUES" as const,
    issues,
    checkedAt: new Date().toISOString(),
  };
}
