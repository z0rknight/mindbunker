"use server";
import { getAuthenticatedDb } from "@/db";
import { videoLogs, commercialContracts, transactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Wave 4M: read-only Finance <-> Production context. Purely additive
// read-model -- no new write path, no redesign of Finance. Custody
// semantics preserved deliberately: cash != sale, sale != billed, billed
// != tracked work -- this returns each as its own count, never merged.
export async function getVideoFinanceContext(videoId: number) {
  const db = await getAuthenticatedDb();
  const video = await db.select({ clientId: videoLogs.clientId, projectId: videoLogs.projectId }).from(videoLogs).where(eq(videoLogs.id, videoId)).limit(1);
  const clientId = video[0]?.clientId ?? null;
  if (!clientId) {
    return { clientId: null, contracts: [], incomeTransactionCount: 0, unattributed: true };
  }

  const [contracts, incomeRows] = await Promise.all([
    db.select().from(commercialContracts).where(eq(commercialContracts.clientId, clientId)),
    db.select({ id: transactions.id, amount: transactions.amount, currency: transactions.currency, date: transactions.date }).from(transactions).where(and(eq(transactions.clientId, clientId), eq(transactions.type, "income"))),
  ]);

  return {
    clientId,
    contracts,
    incomeTransactionCount: incomeRows.length,
    incomeTransactions: incomeRows.slice(0, 10),
    unattributed: contracts.length === 0 && incomeRows.length === 0,
  };
}
