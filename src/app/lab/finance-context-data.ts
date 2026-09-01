"use server";
import { getAuthenticatedDb } from "@/db";
import { commercialContracts, transactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Wave 4M: read-only Finance <-> Production context. Purely additive
// read-model -- no new write path, no redesign of Finance. Custody
// semantics preserved deliberately: cash != sale, sale != billed, billed
// != tracked work -- this returns each as its own count, never merged.
//
// Promotion Prep Patch P1: the standalone FinanceContextPanel surface
// (its own client/video selector) was killed as UX-redundant with the
// Economics panel's existing PROJECT/CLIENT selector. getClientFinanceContext
// below is the reusable core this file was already built on -- Economics
// now calls it directly with the clientId it has already resolved, so
// there is no second selector anywhere.
export async function getClientFinanceContext(clientId: number | null) {
  if (!clientId) {
    return { clientId: null, contracts: [], incomeTransactionCount: 0, unattributed: true };
  }
  const db = await getAuthenticatedDb();
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
