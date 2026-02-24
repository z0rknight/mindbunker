"use server";

import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, gte, sql } from "drizzle-orm";
import { todayISO, startOfMonthISO } from "@/utils/date";
import { revalidatePath } from "next/cache";

export async function addTransaction(data: {
  type: "income" | "expense";
  amount: number;
  category: string;
  date?: string;
  notes?: string;
}) {
  await db.insert(transactions).values({
    type: data.type,
    amount: data.amount,
    category: data.category,
    date: data.date ?? todayISO(),
    notes: data.notes ?? null,
  });
  revalidatePath("/");
  revalidatePath("/finance");
}

export async function deleteTransaction(id: number) {
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/");
  revalidatePath("/finance");
}

export async function getFinanceSummary() {
  const monthStart = startOfMonthISO();

  const monthlyTransactions = await db
    .select()
    .from(transactions)
    .where(gte(transactions.date, monthStart));

  const monthlyRevenue = monthlyTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpenses = monthlyTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const allTransactions = await db.select().from(transactions);
  const totalIncome = allTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = allTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    monthlyRevenue,
    monthlyExpenses,
    monthlyNet: monthlyRevenue - monthlyExpenses,
    currentBalance: totalIncome - totalExpenses,
  };
}

export async function getAllTransactions() {
  return db.select().from(transactions).orderBy(transactions.date);
}
